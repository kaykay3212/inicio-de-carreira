const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./src/config');
const { criarStore } = require('./src/store');

const app = express();
const store = criarStore();
const PORT = process.env.PORT || 3000;
const SENHA_ADMIN = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'admin123');

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

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

const somarDias = (data, dias) => {
  const d = new Date(data + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const diaDaSemana = (data) => new Date(data + 'T12:00:00Z').getUTCDay();
const dataValida = (data) => /^\d{4}-\d{2}-\d{2}$/.test(data) && !isNaN(new Date(data + 'T12:00:00Z'));

function dataDentroDoPeriodo(data) {
  const hoje = agoraNoStudio().data;
  return data >= hoje && data <= somarDias(hoje, config.diasAntecedencia);
}

async function horariosLivres(data, servico) {
  const expediente = config.horarios[diaDaSemana(data)];
  if (!expediente || !dataDentroDoPeriodo(data)) return [];

  const ocupados = (await store.ativosNaData(data)).map((a) => ({ inicio: paraMin(a.inicio), fim: paraMin(a.fim) }));
  if (config.pausa) ocupados.push({ inicio: paraMin(config.pausa.inicio), fim: paraMin(config.pausa.fim) });

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

const acharServico = (id) => config.servicos.find((s) => s.id === id);

// ------------------------------------------------------------ API pública
app.get('/api/config', (req, res) => {
  const { nome, slogan, whatsapp, instagram, endereco, servicos, horarios, diasAntecedencia } = config;
  res.json({ nome, slogan, whatsapp, instagram, endereco, servicos, horarios, diasAntecedencia, hoje: agoraNoStudio().data });
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
    const { data, servico } = req.query;
    const s = acharServico(servico);
    if (!s || !dataValida(data)) return res.status(400).json({ erro: 'Data ou serviço inválido.' });
    res.json({ data, horarios: await horariosLivres(data, s) });
  } catch (e) {
    next(e);
  }
});

app.post('/api/agendamentos', async (req, res, next) => {
  try {
    const { servicoId, data, inicio } = req.body || {};
    const nome = String(req.body?.nome || '').trim().slice(0, 80);
    const telefone = String(req.body?.telefone || '').replace(/\D/g, '');
    const observacoes = String(req.body?.observacoes || '').trim().slice(0, 300);
    const s = acharServico(servicoId);

    if (!s) return res.status(400).json({ erro: 'Escolha um serviço.' });
    if (!dataValida(data) || !/^\d{2}:\d{2}$/.test(inicio || '')) return res.status(400).json({ erro: 'Escolha data e horário.' });
    if (nome.length < 2) return res.status(400).json({ erro: 'Informe seu nome.' });
    if (telefone.length < 10 || telefone.length > 13) return res.status(400).json({ erro: 'Informe um WhatsApp válido com DDD.' });

    const livres = await horariosLivres(data, s);
    if (!livres.includes(inicio)) return res.status(409).json({ erro: 'Esse horário não está mais disponível. Escolha outro, por favor.' });

    const ag = await store.criar({
      servicoId: s.id,
      servicoNome: s.nome,
      data,
      inicio,
      fim: paraHHMM(paraMin(inicio) + s.duracao),
      nome,
      telefone,
      observacoes,
    });
    res.status(201).json({ id: ag.id, servicoNome: ag.servicoNome, data: ag.data, inicio: ag.inicio, fim: ag.fim, nome: ag.nome, preco: s.preco });
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

app.get('/api/admin/agendamentos', exigirAdmin, async (req, res, next) => {
  try {
    const aPartirDe = req.query.todos ? null : agoraNoStudio().data;
    res.json(await store.listar(aPartirDe));
  } catch (e) {
    next(e);
  }
});

app.post('/api/admin/agendamentos/:id/cancelar', exigirAdmin, async (req, res, next) => {
  try {
    const ag = await store.cancelar(req.params.id);
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    res.json(ag);
  } catch (e) {
    next(e);
  }
});

app.get('/healthz', (req, res) => res.send('ok'));

app.use((err, req, res, next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ erro: err.message });
  console.error(err);
  res.status(500).json({ erro: 'Ops! Algo deu errado. Tente novamente.' });
});

app.listen(PORT, () => {
  console.log(`💅 ${config.nome} rodando em http://localhost:${PORT} (armazenamento: ${store.tipo})`);
  if (!SENHA_ADMIN) console.warn('⚠️  Defina ADMIN_PASSWORD para acessar o painel /admin.');
  else if (!process.env.ADMIN_PASSWORD) console.warn('⚠️  Painel /admin usando senha padrão de desenvolvimento: admin123');
});
