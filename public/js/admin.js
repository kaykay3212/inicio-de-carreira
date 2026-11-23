const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
let senha = sessionStorage.getItem('senha-admin') || '';

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked') e.checked = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...filhos);
  return e;
}

function aviso(texto, erro) {
  const t = el('div', { class: 'toast' + (erro ? ' toast--erro' : '') }, texto);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3200);
}

async function api(url, opcoes = {}) {
  const resp = await fetch(url, {
    ...opcoes,
    headers: { 'x-admin-senha': senha, ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}), ...(opcoes.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (resp.status === 401) {
    sair(senha ? 'Senha incorreta.' : '');
    throw new Error('não autorizado');
  }
  if (resp.status === 204) return null;
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(corpo.erro || 'Algo deu errado.');
  return corpo;
}

// ------------------------------------------------------------ datas
const fuso = 'America/Sao_Paulo';
const hojeISO = (soma = 0) => {
  const d = new Date(Date.now() + soma * 864e5);
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(d);
};
const dataLonga = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
const dataCurta = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
function telefoneBonito(t) {
  const n = t.length > 11 && t.startsWith('55') ? t.slice(2) : t;
  return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}` : t;
}
const whats = (t, texto) => `https://wa.me/${t.length <= 11 ? '55' + t : t}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ------------------------------------------------------------ login
function sair(msg) {
  senha = '';
  sessionStorage.removeItem('senha-admin');
  clearInterval(timerAgenda);
  $('#painel').hidden = true;
  $('#sair').hidden = true;
  $('#login').hidden = false;
  $('#erro-login').textContent = msg || '';
}
$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  senha = e.target.senha.value;
  $('#erro-login').textContent = '';
  try {
    await entrar();
  } catch {}
});
$('#sair').onclick = () => sair();

async function entrar() {
  await carregarAgenda(true);
  sessionStorage.setItem('senha-admin', senha);
  $('#login').hidden = true;
  $('#painel').hidden = false;
  $('#sair').hidden = false;
  $('#dica-alerta').hidden = false;
  clearInterval(timerAgenda);
  timerAgenda = setInterval(() => !document.hidden && carregarAgenda(false).catch(() => {}), 30000);
  carregarAjustes().then(() => desenharAgenda()).catch(() => {}); // preços para o total do dia
}

// ------------------------------------------------------------ abas
const carregadores = { agenda: () => carregarAgenda(false), lembretes: () => mostrarLembretes(), folgas: carregarFolgas, servicos: carregarAjustes, horarios: carregarAjustes, avisos: carregarAvisos };
$$('#abas button').forEach((b) =>
  b.addEventListener('click', () => {
    $$('#abas button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('.aba').forEach((a) => (a.hidden = a.dataset.aba !== b.dataset.aba));
    location.hash = b.dataset.aba;
    carregadores[b.dataset.aba]?.().catch?.((e) => aviso(e.message, true));
  })
);

// ------------------------------------------------------------ agenda
let agendamentos = [];
let conhecidos = null; // ids já vistos, para detectar os novos
let timerAgenda;

async function carregarAgenda(primeira) {
  const lista = await api('/api/admin/agendamentos');
  const novos = conhecidos ? lista.filter((a) => a.status === 'confirmado' && !conhecidos.has(a.id)) : [];
  conhecidos = new Set(lista.map((a) => a.id));
  agendamentos = lista;
  desenharAgenda(new Set(novos.map((a) => a.id)));
  if (novos.length && !primeira) alertarNovo(novos);
  const hoje = hojeISO();
  const qtdHoje = lista.filter((a) => a.data === hoje && a.status === 'confirmado').length;
  $('#badge-agenda').textContent = qtdHoje || '';
}

function desenharAgenda(destacar = new Set()) {
  const alvo = $('#lista-agenda');
  const mostrarCancelados = $('#mostrar-cancelados').checked;
  const visiveis = agendamentos.filter((a) => mostrarCancelados || a.status !== 'cancelado');
  alvo.replaceChildren();
  if (!visiveis.length) return alvo.append(el('p', { class: 'vazio' }, 'Nenhum agendamento por enquanto. 💅'));
  const porDia = {};
  visiveis.forEach((a) => (porDia[a.data] ||= []).push(a));
  const hoje = hojeISO(), amanha = hojeISO(1);
  for (const [data, itens] of Object.entries(porDia)) {
    const ativos = itens.filter((a) => a.status !== 'cancelado');
    const total = ativos.reduce((s, a) => s + (precoDe(a.servicoId) || 0), 0);
    const nomeDia = data === hoje ? 'Hoje' : data === amanha ? 'Amanhã' : dataLonga(data);
    alvo.append(
      el('div', { class: 'dia' },
        el('h3', {}, nomeDia, el('small', {}, `${ativos.length} ${ativos.length === 1 ? 'cliente' : 'clientes'}${total ? ' · ' + brl(total) : ''}`)),
        ...itens.map((a) => itemAgendamento(a, destacar.has(a.id))))
    );
  }
}

let servicosAtuais = [];
const precoDe = (id) => servicosAtuais.find((s) => s.id === id)?.preco;

function itemAgendamento(a, novo) {
  const cancelado = a.status === 'cancelado';
  return el('div', { class: `item${cancelado ? ' item--cancelado' : ''}${novo ? ' item--novo' : ''}` },
    el('div', { class: 'item__hora' }, `${a.inicio} – ${a.fim}`),
    el('div', { class: 'item__info' },
      el('strong', {}, a.nome),
      el('small', {}, `${a.servicoNome} · ${telefoneBonito(a.telefone)}`),
      a.observacoes ? el('small', {}, `📝 ${a.observacoes}`) : ''),
    el('div', { class: 'item__acoes' },
      ...(cancelado
        ? [el('small', {}, 'Cancelado')]
        : [
            el('a', { class: 'pilula pilula--whats', href: whats(a.telefone), target: '_blank', rel: 'noopener' }, 'WhatsApp'),
            el('button', { class: 'pilula pilula--perigo', type: 'button', onclick: () => cancelar(a) }, 'Cancelar'),
          ])));
}

async function cancelar(a) {
  if (!confirm(`Cancelar o horário de ${a.nome} (${dataCurta(a.data)} às ${a.inicio})?\nO horário volta a ficar livre no site.`)) return;
  try {
    await api(`/api/admin/agendamentos/${a.id}/cancelar`, { method: 'POST' });
    aviso('Horário cancelado.');
    if (confirm('Quer avisar a cliente pelo WhatsApp?')) {
      window.open(whats(a.telefone, `Oi ${a.nome.split(' ')[0]}! Precisei cancelar seu horário de ${dataCurta(a.data)} às ${a.inicio}. Me chama aqui pra gente remarcar? 💅`), '_blank');
    }
    carregarAgenda(false);
  } catch (e) {
    aviso(e.message, true);
  }
}
$('#mostrar-cancelados').onchange = () => desenharAgenda();
$('#atualizar').onclick = () => carregarAgenda(false).then(() => aviso('Agenda atualizada.')).catch((e) => aviso(e.message, true));

// alerta de novo agendamento: som + notificação do navegador
function tocarSom() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175, 1568].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g).connect(ctx.destination);
      const t = ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch {}
}
function alertarNovo(novos) {
  tocarSom();
  const a = novos[0];
  const texto = novos.length > 1 ? `${novos.length} novos agendamentos!` : `Novo: ${a.nome} · ${dataCurta(a.data)} às ${a.inicio}`;
  aviso('💅 ' + texto);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('💅 Novo agendamento', { body: texto }); } catch {}
  }
}
$('#ativar-alerta').onclick = async () => {
  if (!('Notification' in window)) return aviso('Este navegador não suporta notificações. Use os avisos no celular (aba Avisos).', true);
  const p = await Notification.requestPermission();
  aviso(p === 'granted' ? 'Alerta do navegador ativado ✓' : 'Permissão negada pelo navegador.', p !== 'granted');
  tocarSom();
};

// ------------------------------------------------------------ lembretes
let diaLembrete = 1;
$$('#dia-lembrete button').forEach((b) =>
  b.addEventListener('click', () => {
    diaLembrete = Number(b.dataset.dia);
    $$('#dia-lembrete button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    mostrarLembretes();
  })
);
async function mostrarLembretes() {
  await carregarAgenda(false).catch(() => {});
  const data = hojeISO(diaLembrete);
  const quando = diaLembrete === 0 ? 'hoje' : 'amanhã';
  const lista = agendamentos.filter((a) => a.data === data && a.status === 'confirmado');
  const alvo = $('#lista-lembretes');
  alvo.replaceChildren();
  if (!lista.length) return alvo.append(el('p', { class: 'vazio' }, `Nenhuma cliente marcada para ${quando}.`));
  lista.forEach((a) => {
    const msg = `Oi ${a.nome.split(' ')[0]}! 💅 Passando pra lembrar do seu horário ${quando} às ${a.inicio} — ${a.servicoNome}. Te espero! Se precisar remarcar, me avisa por aqui.`;
    const botao = el('a', { class: 'pilula pilula--whats', href: whats(a.telefone, msg), target: '_blank', rel: 'noopener', onclick: () => marcarEnviado(a.id, botao) }, foiEnviado(a.id) ? '✓ Enviado' : 'Enviar lembrete');
    alvo.append(el('div', { class: 'item' },
      el('div', { class: 'item__hora' }, a.inicio),
      el('div', { class: 'item__info' }, el('strong', {}, a.nome), el('small', {}, `${a.servicoNome} · ${telefoneBonito(a.telefone)}`)),
      el('div', { class: 'item__acoes' }, botao)));
  });
}
const enviados = () => { try { return JSON.parse(localStorage.getItem('lembretes-enviados') || '[]'); } catch { return []; } };
const foiEnviado = (id) => enviados().includes(id);
function marcarEnviado(id, botao) {
  try { localStorage.setItem('lembretes-enviados', JSON.stringify([...enviados().slice(-200), id])); } catch {}
  setTimeout(() => (botao.textContent = '✓ Enviado'), 300);
}

// ------------------------------------------------------------ folgas
const formFolga = $('#form-folga');
formFolga.diaInteiro.onchange = () => ($('#folga-horas').hidden = formFolga.diaInteiro.checked);
formFolga.data.min = hojeISO();
formFolga.ate.min = hojeISO();
formFolga.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = formFolga;
  $('#erro-folga').textContent = '';
  const corpo = { data: f.data.value, ate: f.ate.value || undefined, motivo: f.motivo.value };
  if (!f.diaInteiro.checked) Object.assign(corpo, { inicio: f.inicio.value, fim: f.fim.value });
  try {
    const criados = await api('/api/admin/bloqueios', { method: 'POST', body: JSON.stringify(corpo) });
    aviso(criados.length > 1 ? `${criados.length} dias bloqueados ✓` : 'Bloqueado ✓');
    f.reset();
    $('#folga-horas').hidden = true;
    carregarFolgas();
  } catch (err) {
    $('#erro-folga').textContent = err.message;
  }
});
async function carregarFolgas() {
  const lista = await api('/api/admin/bloqueios');
  const alvo = $('#lista-folgas');
  alvo.replaceChildren();
  if (!lista.length) return alvo.append(el('p', { class: 'vazio' }, 'Nenhuma folga marcada.'));
  lista.forEach((b) =>
    alvo.append(el('div', { class: 'item' },
      el('div', { class: 'item__hora' }, b.inicio ? `${b.inicio} – ${b.fim}` : 'Dia todo'),
      el('div', { class: 'item__info' }, el('strong', {}, dataLonga(b.data)), b.motivo ? el('small', {}, b.motivo) : ''),
      el('div', { class: 'item__acoes' },
        el('button', { class: 'pilula pilula--perigo', type: 'button', onclick: async () => {
          await api(`/api/admin/bloqueios/${b.id}`, { method: 'DELETE' }).catch((e) => aviso(e.message, true));
          aviso('Liberado ✓');
          carregarFolgas();
        } }, 'Liberar'))))
  );
}

// ------------------------------------------------------------ serviços e horários
let ajustes = null;
async function carregarAjustes() {
  ajustes = await api('/api/admin/ajustes');
  servicosAtuais = ajustes.servicos;
  desenharServicos();
  desenharHorarios();
}

function linhaServico(s = {}) {
  const linha = el('div', { class: 'servico', 'data-id': s.id || '' },
    el('label', { class: 'campo campo--nome' }, el('span', {}, 'Nome'), el('input', { name: 'nome', value: s.nome || '', maxlength: 60, placeholder: 'Ex.: Banho de gel' })),
    el('label', { class: 'campo' }, el('span', {}, 'Preço (R$)'), el('input', { name: 'preco', value: s.preco ?? '', inputmode: 'decimal', placeholder: '80' })),
    el('label', { class: 'campo' }, el('span', {}, 'Duração (min)'), el('input', { name: 'duracao', type: 'number', min: 10, max: 600, step: 5, value: s.duracao ?? 60 })),
    el('button', { class: 'servico__remover', type: 'button', title: 'Remover serviço', 'aria-label': 'Remover serviço', onclick: () => linha.remove() }, '✕'),
    el('label', { class: 'campo campo--desc' }, el('span', {}, 'Descrição'), el('input', { name: 'descricao', value: s.descricao || '', maxlength: 160 })));
  return linha;
}
function desenharServicos() {
  $('#lista-servicos').replaceChildren(...ajustes.servicos.map(linhaServico));
}
$('#add-servico').onclick = () => {
  const l = linhaServico();
  $('#lista-servicos').append(l);
  $('input', l).focus();
};
$('#salvar-servicos').onclick = async () => {
  const servicos = $$('#lista-servicos .servico').map((l) => ({
    id: l.dataset.id,
    nome: $('[name=nome]', l).value,
    preco: $('[name=preco]', l).value,
    duracao: $('[name=duracao]', l).value,
    descricao: $('[name=descricao]', l).value,
  }));
  await salvarAjustes({ servicos }, '#erro-servicos', '#salvar-servicos', 'Serviços salvos ✓ Já aparecem no site.');
  desenharServicos();
};

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function desenharHorarios() {
  const alvo = $('#lista-dias');
  alvo.replaceChildren(
    ...[1, 2, 3, 4, 5, 6, 0].map((d) => {
      const h = ajustes.horarios[d];
      const linha = el('div', { class: 'dia-semana' + (h ? '' : ' fechado'), 'data-dia': d },
        el('label', { class: 'chave' }, el('input', { type: 'checkbox', checked: Boolean(h), onchange: (e) => linha.classList.toggle('fechado', !e.target.checked) }), el('span'), DIAS[d]),
        el('label', { class: 'campo' }, el('input', { type: 'time', step: 1800, name: 'inicio', value: h?.inicio || '09:00', 'aria-label': `${DIAS[d]}: abre às` })),
        el('label', { class: 'campo' }, el('input', { type: 'time', step: 1800, name: 'fim', value: h?.fim || '18:00', 'aria-label': `${DIAS[d]}: fecha às` })));
      return linha;
    })
  );
  $('#tem-pausa').checked = Boolean(ajustes.pausa);
  $('#pausa-inicio').value = ajustes.pausa?.inicio || '12:00';
  $('#pausa-fim').value = ajustes.pausa?.fim || '13:00';
  $('#pausa-horas').hidden = !ajustes.pausa;
  $('#slogan').value = ajustes.slogan || '';
  $('#endereco').value = ajustes.endereco || '';
}
$('#tem-pausa').onchange = (e) => ($('#pausa-horas').hidden = !e.target.checked);
$('#salvar-horarios').onclick = () => {
  const horarios = {};
  $$('#lista-dias .dia-semana').forEach((l) => {
    horarios[l.dataset.dia] = $('input[type=checkbox]', l).checked ? { inicio: $('[name=inicio]', l).value, fim: $('[name=fim]', l).value } : null;
  });
  const pausa = $('#tem-pausa').checked ? { inicio: $('#pausa-inicio').value, fim: $('#pausa-fim').value } : null;
  salvarAjustes({ horarios, pausa, slogan: $('#slogan').value, endereco: $('#endereco').value }, '#erro-horarios', '#salvar-horarios', 'Horários salvos ✓');
};

async function salvarAjustes(corpo, erroSel, botaoSel, sucesso) {
  const botao = $(botaoSel);
  $(erroSel).textContent = '';
  botao.disabled = true;
  try {
    ajustes = await api('/api/admin/ajustes', { method: 'PUT', body: JSON.stringify(corpo) });
    servicosAtuais = ajustes.servicos;
    aviso(sucesso);
  } catch (e) {
    $(erroSel).textContent = e.message;
  } finally {
    botao.disabled = false;
  }
}

// ------------------------------------------------------------ avisos (ntfy)
async function carregarAvisos() {
  const info = await api('/api/admin/avisos');
  const alvo = $('#conteudo-avisos');
  if (!info.ativo) {
    alvo.replaceChildren(el('div', { class: 'cartao' }, el('p', { class: 'status status--off' }, 'Avisos desligados'), el('p', { class: 'dica' }, 'Os avisos ainda não foram configurados no servidor.')));
    return;
  }
  const copiar = el('button', { class: 'pilula', type: 'button', onclick: async () => {
    try { await navigator.clipboard.writeText(info.topico); aviso('Copiado ✓'); } catch { aviso('Selecione o texto e copie', true); }
  } }, 'Copiar');
  alvo.replaceChildren(
    el('div', { class: 'cartao' },
      el('p', { class: 'status' }, 'Avisos ligados no servidor'),
      el('ol', { class: 'passos' },
        el('li', {}, el('strong', {}, 'Instale o app gratuito “ntfy” no celular'),
          el('div', { class: 'lojas' },
            el('a', { class: 'pilula', href: 'https://play.google.com/store/apps/details?id=io.heckel.ntfy', target: '_blank', rel: 'noopener' }, 'Android (Play Store)'),
            el('a', { class: 'pilula', href: 'https://apps.apple.com/app/ntfy/id1625396347', target: '_blank', rel: 'noopener' }, 'iPhone (App Store)'))),
        el('li', {}, el('strong', {}, 'No app, toque em “+” e assine este tópico'),
          el('p', {}, 'Ele é como uma senha: não compartilhe.'),
          el('div', { class: 'topico' }, el('code', {}, info.topico), copiar)),
        el('li', {}, el('strong', {}, 'Teste'),
          el('p', {}, 'Toque no botão e confira se o aviso chegou no celular.'),
          el('button', { class: 'botao', type: 'button', style: 'margin-top:.6rem', onclick: async (e) => {
            e.target.disabled = true;
            try { await api('/api/admin/avisos/teste', { method: 'POST' }); aviso('Aviso de teste enviado ✓'); } catch (err) { aviso(err.message, true); }
            e.target.disabled = false;
          } }, 'Enviar aviso de teste'))))
  );
}

// ------------------------------------------------------------ início
(async () => {
  if (!senha) return;
  try {
    await entrar();
    const aba = location.hash.slice(1);
    if (aba && carregadores[aba]) $(`#abas button[data-aba="${aba}"]`)?.click();
  } catch {}
})();
