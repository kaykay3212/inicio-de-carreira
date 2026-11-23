const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./src/config');
const { criarStore } = require('./src/store');
const { criarAjustes } = require('./src/ajustes');
const avisos = require('./src/avisos');

const app = express();
const store = criarStore();
const ajustes = criarAjustes(store);
const PORT = process.env.PORT || 3000;
const SENHA_ADMIN = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'admin123');
const SITE_URL = process.env.RENDER_EXTERNAL_URL || '';

app.use(express.json({ limit: '50kb' }));
app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    setHeaders(res, arquivo) {
      // fotos podem ficar guardadas no celular por 7 dias; o resto é revalidado
      if (/\/img\//.test(arquivo)) res.setHeader('Cache-Control', 'public, max-age=604800');
    },
  })
);

// ------------------------------------------------------------ utilidades de horário
const paraMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const paraHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Data e hora atuais no fuso do studio
function agoraNoStudio() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: config.fusoHorario,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return { data: `${partes.year}-${partes.month}-${partes.day}`, minutos: Number(partes.hour) * 60 + Number(partes.minute) };
}

// Converte "2026-11-24" + "14:00" (hora do studio) para um instante UTC
function paraUTC(data, hhmm) {
  const chute = new Date(`${data}T${hhmm}:00Z`);
  const local = new Date(chute.toLocaleString('en-US', { timeZone: config.fusoHorario }));
  const utc = new Date(chute.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(chute.getTime() + (utc - local));
}

const somarDias = (data, dias) => {
  const d = new Date(data + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const diaDaSemana = (data) => new Date(data + 'T12:00:00Z').getUTCDay();
const dataValida = (data) => /^\d{4}-\d{2}-\d{2}$/.test(data || '') && !isNaN(new Date(data + 'T12:00:00Z'));
const horaValida = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h || '');

function dataDentroDoPeriodo(data) {
  const hoje = agoraNoStudio().data;
  return data >= hoje && data <= somarDias(hoje, config.diasAntecedencia);
}

async function horariosLivres(data, servico, cfg) {
  const expediente = cfg.horarios[diaDaSemana(data)];
  if (!expediente || !dataDentroDoPeriodo(data)) return [];

  const bloqueios = await store.bloqueiosNaData(data);
  if (bloqueios.some((b) => !b.inicio)) return []; // dia inteiro fechado

  const ocupados = (await store.ativosNaData(data)).map((a) => ({ inicio: paraMin(a.inicio), fim: paraMin(a.fim) }));
  bloqueios.forEach((b) => ocupados.push({ inicio: paraMin(b.inicio), fim: paraMin(b.fim) }));
  if (cfg.pausa) ocupados.push({ inicio: paraMin(cfg.pausa.inicio), fim: paraMin(cfg.pausa.fim) });

  const agora = agoraNoStudio();
  const minimo = data === agora.data ? agora.minutos + config.antecedenciaMinima : -1;
  const livres = [];
  for (let ini = paraMin(expediente.inicio); ini + servico.duracao <= paraMin(expediente.fim); ini += config.intervaloMinutos) {
    const fim = ini + servico.duracao;
    if (ini < minimo) continue;
    if (ocupados.some((o) => ini < o.fim && o.inicio < fim)) continue;
    livres.push(paraHHMM(ini));
  }
  return livres;
}

// Links para a cliente salvar o horário no calendário do celular (lembrete automático)
function linksCalendario(cfg, ag) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ini = fmt(paraUTC(ag.data, ag.inicio));
  const fim = fmt(paraUTC(ag.data, ag.fim));
  const titulo = `${ag.servicoNome} — ${cfg.nome}`;
  const detalhes = `Agendado pelo site. Dúvidas: https://wa.me/${cfg.whatsapp}`;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${ini}/${fim}&details=${encodeURIComponent(detalhes)}${cfg.endereco ? '&location=' + encodeURIComponent(cfg.endereco) : ''}`;
  const ics = `/api/calendario.ics?${new URLSearchParams({ servico: ag.servicoNome, data: ag.data, inicio: ag.inicio, fim: ag.fim })}`;
  return { google, ics };
}

// ------------------------------------------------------------ API pública
app.get('/api/config', async (req, res, next) => {
  try {
    const cfg = await ajustes.obter();
    const hoje = agoraNoStudio().data;
    const bloqueios = await store.listarBloqueios(hoje).catch(() => []);
    const diasFechados = [...new Set(bloqueios.filter((b) => !b.inicio).map((b) => b.data))];
    const { nome, slogan, whatsapp, instagram, endereco, servicos, horarios, diasAntecedencia } = cfg;
    res.json({ nome, slogan, whatsapp, instagram, endereco, servicos, horarios, diasAntecedencia, diasFechados, hoje });
  } catch (e) {
    next(e);
  }
});

app.get('/api/galeria', (req, res) => {
  const pasta = path.join(__dirname, 'public', 'img', 'galeria');
  const arquivos = fs.existsSync(pasta) ? fs.readdirSync(pasta) : [];
  const fotos = arquivos
    .filter((f) => /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(f))
    .sort()
    .map((f) => ({
      url: `/img/galeria/${encodeURIComponent(f)}`,
      // "01-francesinha-rosa.jpg" vira "Francesinha rosa"
      legenda: f.replace(/\.[^.]+$/, '').replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    }));
  res.json(fotos);
});

app.get('/api/horarios', async (req, res, next) => {
  try {
    const cfg = await ajustes.obter();
    const { data, servico } = req.query;
    const s = cfg.servicos.find((x) => x.id === servico);
    if (!s || !dataValida(data)) return res.status(400).json({ erro: 'Data ou serviço inválido.' });
    res.json({ data, horarios: await horariosLivres(data, s, cfg) });
  } catch (e) {
    next(e);
  }
});

app.post('/api/agendamentos', async (req, res, next) => {
  try {
    const cfg = await ajustes.obter();
    const { servicoId, data, inicio } = req.body || {};
    const nome = String(req.body?.nome || '').trim().slice(0, 80);
    const telefone = String(req.body?.telefone || '').replace(/\D/g, '');
    const observacoes = String(req.body?.observacoes || '').trim().slice(0, 300);
    const s = cfg.servicos.find((x) => x.id === servicoId);

    if (!s) return res.status(400).json({ erro: 'Escolha um serviço.' });
    if (!dataValida(data) || !horaValida(inicio)) return res.status(400).json({ erro: 'Escolha data e horário.' });
    if (nome.length < 2) return res.status(400).json({ erro: 'Informe seu nome.' });
    if (telefone.length < 10 || telefone.length > 13) return res.status(400).json({ erro: 'Informe um WhatsApp válido com DDD.' });

    const livres = await horariosLivres(data, s, cfg);
    if (!livres.includes(inicio)) return res.status(409).json({ erro: 'Esse horário não está mais disponível. Escolha outro, por favor.' });

    const ag = await store.criar({ servicoId: s.id, servicoNome: s.nome, data, inicio, fim: paraHHMM(paraMin(inicio) + s.duracao), nome, telefone, observacoes });

    // avisa a dona do studio no celular (sem atrasar a resposta da cliente)
    avisos.novoAgendamento(ag, SITE_URL).catch((e) => console.warn('Aviso de novo agendamento falhou:', e.message));

    res.status(201).json({
      id: ag.id, servicoNome: ag.servicoNome, data: ag.data, inicio: ag.inicio, fim: ag.fim, nome: ag.nome, preco: s.preco,
      calendario: linksCalendario(cfg, ag),
    });
  } catch (e) {
    next(e);
  }
});

// Arquivo de calendário (.ics) — no iPhone abre direto "Adicionar ao Calendário"
app.get('/api/calendario.ics', async (req, res, next) => {
  try {
    const cfg = await ajustes.obter();
    const { servico, data, inicio, fim } = req.query;
    if (!dataValida(data) || !horaValida(inicio) || !horaValida(fim)) return res.status(400).send('Dados inválidos');
    const limpar = (t) => String(t || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, ' ').slice(0, 120);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const linhas = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studio//Agendamento//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${crypto.randomUUID()}@agendamento`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(paraUTC(data, inicio))}`,
      `DTEND:${fmt(paraUTC(data, fim))}`,
      `SUMMARY:${limpar(`${servico} — ${cfg.nome}`)}`,
      `DESCRIPTION:${limpar(`Dúvidas: https://wa.me/${cfg.whatsapp}`)}`,
      ...(cfg.endereco ? [`LOCATION:${limpar(cfg.endereco)}`] : []),
      'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', `DESCRIPTION:${limpar('Amanhã: ' + servico)}`, 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${limpar('Daqui a 2 horas: ' + servico)}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ];
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="agendamento.ics"');
    res.send(linhas.join('\r\n'));
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------ API administrativa
function exigirAdmin(req, res, next) {
  const enviada = Buffer.from(String(req.get('x-admin-senha') || ''));
  const correta = Buffer.from(SENHA_ADMIN || '');
  if (!SENHA_ADMIN || enviada.length !== correta.length || !crypto.timingSafeEqual(enviada, correta)) {
    return res.status(401).json({ erro: 'Senha incorreta.' });
  }
  next();
}
const rota = (fn) => (req, res, next) => fn(req, res).catch(next);

app.get('/api/admin/agendamentos', exigirAdmin, rota(async (req, res) => {
  const aPartirDe = req.query.todos ? null : agoraNoStudio().data;
  res.json(await store.listar(aPartirDe));
}));

app.post('/api/admin/agendamentos/:id/cancelar', exigirAdmin, rota(async (req, res) => {
  const ag = await store.cancelar(req.params.id);
  if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
  res.json(ag);
}));

app.get('/api/admin/bloqueios', exigirAdmin, rota(async (req, res) => {
  res.json(await store.listarBloqueios(agoraNoStudio().data));
}));

app.post('/api/admin/bloqueios', exigirAdmin, rota(async (req, res) => {
  const { data, ate, inicio, fim } = req.body || {};
  const motivo = String(req.body?.motivo || '').trim().slice(0, 80);
  if (!dataValida(data)) return res.status(400).json({ erro: 'Escolha a data.' });
  const ultima = dataValida(ate) ? ate : data;
  if (ultima < data) return res.status(400).json({ erro: 'A data final precisa ser depois da inicial.' });
  const diaInteiro = !inicio && !fim;
  if (!diaInteiro && (!horaValida(inicio) || !horaValida(fim) || inicio >= fim)) {
    return res.status(400).json({ erro: 'Horário inválido: o início precisa ser antes do fim.' });
  }
  const criados = [];
  for (let d = data, n = 0; d <= ultima && n < 62; d = somarDias(d, 1), n++) {
    criados.push(await store.criarBloqueio({ data: d, inicio: diaInteiro ? null : inicio, fim: diaInteiro ? null : fim, motivo }));
  }
  res.status(201).json(criados);
}));

app.delete('/api/admin/bloqueios/:id', exigirAdmin, rota(async (req, res) => {
  const ok = await store.removerBloqueio(req.params.id);
  if (!ok) return res.status(404).json({ erro: 'Bloqueio não encontrado.' });
  res.status(204).end();
}));

app.get('/api/admin/ajustes', exigirAdmin, rota(async (req, res) => {
  const { slogan, endereco, servicos, horarios, pausa } = await ajustes.obter();
  res.json({ slogan, endereco, servicos, horarios, pausa });
}));

app.put('/api/admin/ajustes', exigirAdmin, rota(async (req, res) => {
  const { slogan, endereco, servicos, horarios, pausa } = await ajustes.salvar(req.body);
  res.json({ slogan, endereco, servicos, horarios, pausa });
}));

app.get('/api/admin/avisos', exigirAdmin, (req, res) => {
  res.json({ ativo: avisos.ativo(), topico: avisos.topico(), servidor: avisos.servidor });
});

app.post('/api/admin/avisos/teste', exigirAdmin, rota(async (req, res) => {
  if (!avisos.ativo()) return res.status(400).json({ erro: 'Os avisos ainda não foram configurados no servidor.' });
  await avisos.teste(SITE_URL);
  res.json({ ok: true });
}));

app.get('/healthz', (req, res) => res.send('ok'));

// chamado quando alguém abre o site: acorda o banco antes da cliente escolher o horário
app.get('/api/aquecer', (req, res) => {
  store.aquecer().catch((e) => console.warn('Aquecimento do banco falhou:', e.message));
  res.status(204).end();
});

app.use((err, req, res, next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ erro: err.message });
  console.error(err);
  res.status(500).json({ erro: 'Ops! Algo deu errado. Tente novamente.' });
});

// ------------------------------------------------------------ manter acordado
// O Render grátis desliga o site após 15 min sem visitas. Durante o horário configurado,
// o próprio site se visita a cada 10 min pelo endereço público, o que conta como visita.
function manterAcordado() {
  const janela = config.manterAcordado;
  if (!janela || !SITE_URL) return;
  const dentroDoHorario = () => {
    const { minutos } = agoraNoStudio();
    return minutos >= paraMin(janela.inicio) && minutos < paraMin(janela.fim);
  };
  const visitar = async () => {
    if (!dentroDoHorario()) return;
    try {
      await fetch(`${SITE_URL}/healthz`, { signal: AbortSignal.timeout(30000) });
    } catch (e) {
      console.warn('Manter acordado: visita falhou:', e.message);
    }
  };
  setInterval(visitar, 10 * 60 * 1000);
  console.log(`⏰ Mantendo o site acordado das ${janela.inicio} às ${janela.fim}`);
}

app.listen(PORT, () => {
  console.log(`💅 ${config.nome} rodando em http://localhost:${PORT} (armazenamento: ${store.tipo})`);
  console.log(avisos.ativo() ? '🔔 Avisos de novo agendamento ativos (ntfy)' : '🔕 Avisos desativados (defina NTFY_TOPICO)');
  manterAcordado();
  if (!SENHA_ADMIN) console.warn('⚠️  Defina ADMIN_PASSWORD para acessar o painel /admin.');
  else if (!process.env.ADMIN_PASSWORD) console.warn('⚠️  Painel /admin usando senha padrão de desenvolvimento: admin123');
});
