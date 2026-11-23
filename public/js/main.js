const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const duracaoTexto = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);
const dataLonga = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
const linkWhats = (numero, texto) => `https://wa.me/${numero}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const temMouse = matchMedia('(hover: hover) and (pointer: fine)').matches;

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') Object.entries(v).forEach(([p, val]) => e.style.setProperty(p, val));
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...filhos);
  return e;
}

function rolarAte(elemento, bloco = 'nearest') {
  setTimeout(() => elemento.scrollIntoView({ behavior: menosMovimento ? 'auto' : 'smooth', block: bloco, inline: 'nearest' }), 120);
}

// Busca JSON com limite de tempo; tenta de novo se a conexão falhar
async function buscarJson(url, opcoes = {}, { tentativas = 1, limite = 15000 } = {}) {
  for (let n = 1; ; n++) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), limite);
    try {
      const resp = await fetch(url, { ...opcoes, signal: controle.signal });
      const corpo = await resp.json().catch(() => ({}));
      if (resp.status >= 500) throw new Error(corpo.erro || 'Erro no servidor');
      return { resp, corpo };
    } catch (e) {
      if (n >= tentativas) throw e;
      await new Promise((ok) => setTimeout(ok, 800 * n));
    } finally {
      clearTimeout(timer);
    }
  }
}

function aviso(texto) {
  const t = el('div', { class: 'toast' }, texto);
  $('#toasts').append(t);
  setTimeout(() => {
    t.classList.add('sair');
    setTimeout(() => t.remove(), 450);
  }, 2800);
}

let config;
const escolha = { servico: null, data: null, hora: null };

// =============================================================== REVELAR AO ROLAR
const observador = new IntersectionObserver(
  (entradas) => entradas.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('visivel');
    observador.unobserve(e.target);
  }),
  { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
);
const revelar = (lista) => lista.forEach((e) => observador.observe(e));

// títulos: cada palavra sobe
function prepararTitulos() {
  $$('.titulo-revelar').forEach((titulo) => {
    let i = 0;
    const quebrar = (no) => {
      [...no.childNodes].forEach((filho) => {
        if (filho.nodeType !== 3) return quebrar(filho);
        const frag = document.createDocumentFragment();
        filho.textContent.split(/(\s+)/).forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) return frag.append(' ');
          frag.append(el('span', { class: 'palavra' }, el('span', { style: { '--atraso': `${i++ * 0.07}s` } }, p)));
        });
        filho.replaceWith(frag);
      });
    };
    quebrar(titulo);
  });
  revelar($$('.titulo-revelar'));
}

// =============================================================== TOPO, MENU, BARRA DO CELULAR
const topo = $('#topo');
const barraCelular = $('#barra-celular');
let ultimoY = 0;
let pendente = false;
function aoRolar() {
  pendente = false;
  const y = scrollY;
  // esconde o topo ao descer e mostra ao subir
  topo.classList.toggle('topo--escondido', y > 300 && y > ultimoY && !menuAberto);
  ultimoY = y;
  const agenda = $('#agendar').getBoundingClientRect();
  const naAgenda = agenda.top < innerHeight * 0.6 && agenda.bottom > innerHeight * 0.3;
  barraCelular.classList.toggle('visivel', y > innerHeight * 0.6 && !naAgenda);
  desenharFita();
  profundidade();
}
// fotos dos trabalhos se movem um pouco mais devagar que a página (sensação de profundidade)
let moveres = [];
function profundidade() {
  if (menosMovimento) return;
  for (const m of moveres) {
    const r = m.parentElement.getBoundingClientRect();
    if (r.bottom < -50 || r.top > innerHeight + 50) continue;
    const centro = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    m.style.transform = `translate3d(0, ${(-centro * 6).toFixed(2)}%, 0)`;
  }
}
addEventListener('scroll', () => {
  if (!pendente) {
    pendente = true;
    requestAnimationFrame(aoRolar);
  }
}, { passive: true });

let menuAberto = false;
const menu = $('#menu');
const menuBotao = $('#menu-botao');
function alternarMenu(abrir) {
  menuAberto = abrir;
  menuBotao.setAttribute('aria-expanded', String(abrir));
  $('.menu-rotulo', menuBotao).textContent = abrir ? 'Fechar' : 'Menu';
  document.body.style.overflow = abrir ? 'hidden' : '';
  if (abrir) {
    menu.hidden = false;
    $$('nav a', menu).forEach((a, i) => (a.style.transitionDelay = `${0.05 + i * 0.05}s`));
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('aberto')));
  } else {
    menu.classList.remove('aberto');
    $$('nav a', menu).forEach((a) => (a.style.transitionDelay = '0s'));
    setTimeout(() => !menuAberto && (menu.hidden = true), 400);
  }
}
menuBotao.addEventListener('click', () => alternarMenu(!menuAberto));
$$('a', menu).forEach((a) => a.addEventListener('click', () => alternarMenu(false)));

// =============================================================== FITA DESENHADA NA ROLAGEM
const fita = $('#fita-caminho');
let comprimentoFita = 0;
function prepararFita() {
  comprimentoFita = fita.getTotalLength();
  fita.style.strokeDasharray = comprimentoFita;
  desenharFita();
}
function desenharFita() {
  if (!comprimentoFita) return;
  const r = $('#fita').getBoundingClientRect();
  const progresso = Math.min(Math.max((innerHeight * 0.85 - r.top) / (r.height * 0.85), 0), 1);
  fita.style.strokeDashoffset = comprimentoFita * (1 - progresso);
}

// =============================================================== CURSOR (computador)
function prepararCursor() {
  const cursor = $('#cursor');
  if (!temMouse || menosMovimento) return;
  const texto = $('.cursor__texto', cursor);
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, ativo = false;
  addEventListener('pointermove', (e) => {
    x = e.clientX;
    y = e.clientY;
    if (!ativo) {
      ativo = true;
      requestAnimationFrame(mover);
    }
  }, { passive: true });
  function mover() {
    cx += (x - cx) * 0.22;
    cy += (y - cy) * 0.22;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    if (Math.abs(x - cx) + Math.abs(y - cy) > 0.3) requestAnimationFrame(mover);
    else ativo = false;
  }
  document.addEventListener('pointerover', (e) => {
    const alvo = e.target.closest('[data-cursor]');
    const link = e.target.closest('a, button, [role=button]');
    cursor.classList.toggle('com-texto', Boolean(alvo));
    cursor.classList.toggle('sobre-link', Boolean(link) && !alvo);
    if (alvo) texto.textContent = alvo.dataset.cursor;
  });
}

// =============================================================== INICIALIZAÇÃO
(async function iniciar() {
  fetch('/api/aquecer').catch(() => {}); // acorda o banco antes da cliente escolher o horário
  prepararTitulos();
  revelar($$('.revelar'));
  prepararFita();
  prepararCursor();
  aoRolar();

  try {
    config = await fetch('/api/config').then((r) => r.json());
  } catch {
    return aviso('Não foi possível carregar o site. Atualize a página.');
  }
  $('#ano').textContent = new Date().getFullYear();
  if (config.slogan) $('[data-slogan]').textContent = config.slogan;
  $('[data-endereco]').textContent = config.endereco || `@${config.instagram}`;
  $$('[data-whats]').forEach((a) => (a.href = linkWhats(config.whatsapp, 'Olá! Vim pelo seu site e quero agendar um horário 💅')));
  $$('[data-insta]').forEach((a) => (a.href = `https://instagram.com/${config.instagram}`));
  montarServicos();
  carregarGaleria();
})();

// =============================================================== GALERIA
let fotos = [];
async function carregarGaleria() {
  try {
    fotos = await fetch('/api/galeria').then((r) => r.json());
  } catch {
    fotos = [];
  }
  const galeria = $('#galeria');
  if (!fotos.length) return galeria.replaceWith(el('p', { class: 'micro' }, 'Em breve, fotos dos trabalhos por aqui.'));
  fotos.forEach((f, i) => {
    const img = el('img', { src: f.url, alt: f.legenda, loading: i < 2 ? 'eager' : 'lazy', decoding: 'async' });
    const pronta = () => img.classList.add('carregada');
    img.complete ? pronta() : img.addEventListener('load', pronta);
    galeria.append(
      el('button', { class: 'card', type: 'button', 'data-cursor': 'Ver', onclick: () => abrirLightbox(i) },
        el('div', { class: 'card__img' }, el('div', { class: 'card__mover' }, img)),
        el('div', { class: 'card__rodape' },
          el('span', { class: 'card__titulo' }, f.legenda),
          el('span', { class: 'micro' }, String(i + 1).padStart(2, '0'))))
    );
  });
  revelar($$('.card'));
  moveres = $$('.card__mover');
  aoRolar();
  $('#hero-fallback').style.backgroundImage = `url("${fotos[0].url}")`;
}

// Lightbox: setas, teclado, arrastar para o lado (trocar) e para baixo (fechar)
let fotoAtual = 0;
const lightbox = $('#lightbox');
const imgLightbox = $('img', lightbox);
function abrirLightbox(i, trocando) {
  fotoAtual = (i + fotos.length) % fotos.length;
  imgLightbox.classList.remove('trocando');
  void imgLightbox.offsetWidth;
  if (trocando) imgLightbox.classList.add('trocando');
  imgLightbox.src = fotos[fotoAtual].url;
  imgLightbox.alt = fotos[fotoAtual].legenda;
  $('.lightbox__legenda').textContent = fotos[fotoAtual].legenda;
  $('.lightbox__contador').textContent = `${String(fotoAtual + 1).padStart(2, '0')} / ${String(fotos.length).padStart(2, '0')}`;
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}
function fecharLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
}
const anterior = () => abrirLightbox(fotoAtual - 1, true);
const proxima = () => abrirLightbox(fotoAtual + 1, true);
$('.lightbox__fechar').onclick = fecharLightbox;
$('.lightbox__nav--ant').onclick = anterior;
$('.lightbox__nav--prox').onclick = proxima;
lightbox.addEventListener('click', (e) => (e.target === lightbox || e.target.tagName === 'FIGURE') && fecharLightbox());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuAberto) alternarMenu(false);
  if (lightbox.hidden) return;
  if (e.key === 'Escape') fecharLightbox();
  if (e.key === 'ArrowLeft') anterior();
  if (e.key === 'ArrowRight') proxima();
});
let toqueX = null, toqueY = null;
lightbox.addEventListener('touchstart', (e) => ((toqueX = e.touches[0].clientX), (toqueY = e.touches[0].clientY)), { passive: true });
lightbox.addEventListener('touchend', (e) => {
  if (toqueX === null) return;
  const dx = e.changedTouches[0].clientX - toqueX;
  const dy = e.changedTouches[0].clientY - toqueY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx > 0 ? anterior : proxima)();
  else if (dy > 90) fecharLightbox();
  toqueX = toqueY = null;
});

// "Quero esse estilo": anota a foto nas observações e leva ao agendamento
$('#quero-estilo').addEventListener('click', () => {
  const estilo = fotos[fotoAtual].legenda;
  const obs = $('[name=observacoes]');
  const texto = `Quero o estilo da foto: ${estilo}`;
  if (!obs.value.includes(texto)) obs.value = obs.value ? `${obs.value}\n${texto}` : texto;
  fecharLightbox();
  aviso(`✨ "${estilo}" anotado no seu agendamento`);
  rolarAte($('#agendar'), 'start');
});

// =============================================================== SERVIÇOS
function montarServicos() {
  const lista = $('#lista-servicos');
  const opcoes = $('#opcoes-servico');
  lista.replaceChildren();
  opcoes.replaceChildren();
  config.servicos.forEach((s, i) => {
    const agendarEste = () => {
      escolherServico(s, false);
      rolarAte($('#agendar'), 'start');
    };
    const linha = el('li', { class: 'servico revelar', tabindex: '0', role: 'button', 'aria-label': `Agendar ${s.nome}, ${brl(s.preco)}`, style: { '--atraso': `${i * 0.06}s` } },
      el('span', { class: 'servico__num' }, String(i + 1).padStart(2, '0')),
      el('span', { class: 'servico__nome' }, s.nome, s.descricao ? el('small', { class: 'servico__desc' }, s.descricao) : ''),
      el('span', { class: 'servico__tempo' }, duracaoTexto(s.duracao)),
      el('span', { class: 'servico__preco' }, brl(s.preco)),
      el('span', { class: 'servico__seta', 'aria-hidden': 'true' }, '→'));
    linha.addEventListener('click', agendarEste);
    linha.addEventListener('mouseenter', () => mostrarPrevia(i));
    linha.addEventListener('mouseleave', esconderPrevia);
    linha.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), agendarEste()));
    lista.append(linha);

    opcoes.append(
      el('button', { class: 'opcao', type: 'button', 'aria-pressed': 'false', 'data-id': s.id, style: { '--atraso': `${i * 0.04}s` }, onclick: () => escolherServico(s) },
        el('span', {}, el('strong', {}, s.nome), el('small', {}, duracaoTexto(s.duracao))),
        el('b', {}, brl(s.preco)))
    );
  });
  revelar($$('.servico'));
}

// prévia de foto que segue o mouse sobre a lista de serviços
const previa = $('#previa');
let previaAtiva = false;
function mostrarPrevia(i) {
  if (!temMouse || !fotos.length) return;
  $('img', previa).src = fotos[(i * 3 + 1) % fotos.length].url;
  previa.classList.add('visivel');
  previaAtiva = true;
}
function esconderPrevia() {
  previa.classList.remove('visivel');
  previaAtiva = false;
}
addEventListener('pointermove', (e) => {
  if (!previaAtiva) return;
  previa.style.transform = `translate3d(${e.clientX - 110}px, ${e.clientY - 137}px, 0) rotate(${Math.max(-8, Math.min(8, (e.movementX || 0) * 0.4))}deg)`;
}, { passive: true });

// =============================================================== AGENDAMENTO
function marcar(container, seletor, valor, atributo) {
  $$(seletor, container).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[atributo] === valor)));
}
function atualizarEtapas() {
  const etapa = escolha.hora ? 4 : escolha.data ? 3 : escolha.servico ? 2 : 1;
  $$('#etapas li').forEach((li, i) => li.classList.toggle('ativa', i < etapa));
  $('#etapas-barra').style.transform = `scaleX(${etapa / 4})`;
}
function mostrarServicoEscolhido(mostrar) {
  $('#servico-escolhido').hidden = !mostrar;
  $('#opcoes-servico').hidden = mostrar;
}

function escolherServico(s, rolar = true) {
  escolha.servico = s;
  escolha.hora = null;
  marcar($('#opcoes-servico'), '.opcao', s.id, 'id');
  $('#escolhido-nome').textContent = s.nome;
  $('#escolhido-info').textContent = `${brl(s.preco)} · ${duracaoTexto(s.duracao)}`;
  setTimeout(() => mostrarServicoEscolhido(true), rolar ? 250 : 0);
  montarDias();
  carregarSugestoes(s);
  $('#passo-data').hidden = false;
  $('#passo-dados').hidden = true;
  atualizarEtapas();
  if (escolha.data) carregarHorarios(rolar);
  else if (rolar) rolarAte($('#passo-data'), 'center');
}
$('#trocar-servico').addEventListener('click', () => {
  mostrarServicoEscolhido(false);
  $$('.opcao').forEach((o) => o.classList.remove('pronto'));
});

function nomeDoDia(iso) {
  const i = Math.round((new Date(iso + 'T12:00:00Z') - new Date(config.hoje + 'T12:00:00Z')) / 864e5);
  if (i === 0) return 'Hoje';
  if (i === 1) return 'Amanhã';
  const semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const d = new Date(iso + 'T12:00:00Z');
  return `${semana[d.getUTCDay()]} ${d.getUTCDate()}`;
}
async function carregarSugestoes(s) {
  const caixa = $('#rapido');
  const lista = $('#rapido-lista');
  caixa.hidden = false;
  lista.replaceChildren(el('div', { class: 'carregando' }, el('i'), el('i'), el('i')));
  try {
    const { corpo } = await buscarJson(`/api/sugestoes?servico=${s.id}`, {}, { tentativas: 2, limite: 12000 });
    if (escolha.servico?.id !== s.id) return;
    const sugestoes = corpo.sugestoes || [];
    if (!sugestoes.length) {
      caixa.hidden = true;
      return;
    }
    lista.replaceChildren(
      ...sugestoes.map((sg, i) =>
        el('button', { type: 'button', style: { '--atraso': `${i * 0.06}s` }, onclick: () => reservarRapido(sg) },
          el('small', {}, nomeDoDia(sg.data)),
          el('strong', {}, sg.inicio)))
    );
  } catch {
    caixa.hidden = true; // sem atalhos: a cliente escolhe pelo calendário normalmente
  }
}
async function reservarRapido(sg) {
  await escolherDia(sg.data, false);
  if ($(`.hora[data-hora="${sg.inicio}"]`)) escolherHora(sg.inicio);
  else aviso('Esse horário acabou de ser ocupado. Escolha outro abaixo.');
  const botaoDia = $(`.dia[data-data="${sg.data}"]`);
  if (botaoDia) botaoDia.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function montarDias() {
  const dias = $('#dias');
  if (dias.childElementCount) return;
  const semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const fechados = new Set(config.diasFechados || []);
  const base = new Date(config.hoje + 'T12:00:00Z');
  let n = 0;
  for (let i = 0; i <= config.diasAntecedencia; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    if (!config.horarios[d.getUTCDay()]) continue;
    const iso = d.toISOString().slice(0, 10);
    const fechado = fechados.has(iso);
    dias.append(
      el('button', { class: 'dia', type: 'button', 'aria-pressed': 'false', 'data-data': iso, disabled: fechado, title: fechado ? 'Fechado' : undefined, style: { '--atraso': `${Math.min(n++, 8) * 0.04}s` }, onclick: () => escolherDia(iso) },
        el('span', {}, i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : semana[d.getUTCDay()]),
        el('strong', {}, String(d.getUTCDate())),
        el('span', {}, fechado ? 'fechado' : meses[d.getUTCMonth()]))
    );
  }
}
$('.dias__seta--esq').onclick = () => $('#dias').scrollBy({ left: -300, behavior: 'smooth' });
$('.dias__seta--dir').onclick = () => $('#dias').scrollBy({ left: 300, behavior: 'smooth' });

function escolherDia(iso, rolar = true) {
  escolha.data = iso;
  escolha.hora = null;
  marcar($('#dias'), '.dia', iso, 'data');
  $('#passo-dados').hidden = true;
  atualizarEtapas();
  return carregarHorarios(rolar);
}

async function carregarHorarios(rolar) {
  const horas = $('#horas');
  $('#passo-hora').hidden = false;
  horas.replaceChildren(el('div', { class: 'carregando' }, ...Array.from({ length: 8 }, () => el('i'))));
  if (rolar) rolarAte($('#passo-hora'), 'center');
  const pedido = `${escolha.servico.id}|${escolha.data}`;
  const aindaValido = () => pedido === `${escolha.servico?.id}|${escolha.data}`;
  const avisoDemora = setTimeout(() => {
    if (aindaValido() && $('.carregando', horas)) horas.append(el('p', { class: 'aviso aviso--espera' }, 'Buscando os horários livres, só um instante…'));
  }, 2500);
  let horarios = [];
  try {
    ({ corpo: { horarios = [] } } = await buscarJson(`/api/horarios?data=${escolha.data}&servico=${escolha.servico.id}`, {}, { tentativas: 3, limite: 12000 }));
  } catch {
    clearTimeout(avisoDemora);
    if (!aindaValido()) return;
    horas.replaceChildren(
      el('div', { class: 'falha' },
        el('p', {}, 'Não conseguimos carregar os horários agora.'),
        el('button', { class: 'pilula', type: 'button', onclick: () => carregarHorarios(false) }, '↻ Tentar de novo'),
        el('a', { class: 'pilula pilula--whats', href: linkWhats(config.whatsapp, `Olá! Quero agendar ${escolha.servico.nome} para ${dataLonga(escolha.data)}. Quais horários você tem?`), target: '_blank', rel: 'noopener' }, 'Agendar pelo WhatsApp'))
    );
    return;
  }
  clearTimeout(avisoDemora);
  if (!aindaValido()) return;
  horas.replaceChildren();
  if (!horarios.length) return horas.append(el('p', { class: 'aviso' }, 'Sem horários livres nesse dia. Escolha outra data acima.'));
  const grupos = [['Manhã', (h) => h < '12:00'], ['Tarde', (h) => h >= '12:00' && h < '18:00'], ['Noite', (h) => h >= '18:00']];
  let i = 0;
  grupos.forEach(([titulo, filtro]) => {
    const lista = horarios.filter(filtro);
    if (!lista.length) return;
    horas.append(
      el('div', { class: 'horas-grupo' },
        el('h4', {}, titulo),
        el('div', { class: 'horas' },
          ...lista.map((h) => el('button', { class: 'hora', type: 'button', 'aria-pressed': 'false', 'data-hora': h, style: { '--atraso': `${Math.min(i++, 15) * 0.025}s` }, onclick: () => escolherHora(h) }, h))))
    );
  });
}

function escolherHora(h) {
  escolha.hora = h;
  marcar($('#horas'), '.hora', h, 'hora');
  const passo = $('#passo-dados');
  const estavaOculto = passo.hidden;
  passo.hidden = false;
  $('#resumo').replaceChildren(el('strong', {}, escolha.servico.nome), ` · ${brl(escolha.servico.preco)}`, el('br'), `${dataLonga(escolha.data)} às ${h}`);
  $('#erro').textContent = '';
  atualizarEtapas();
  if (estavaOculto) rolarAte(passo, 'center');
}

$('#form-agendamento').addEventListener('animationend', (e) => {
  if (e.animationName === 'subir' && e.target.matches('.opcao, .dia, .hora')) e.target.classList.add('pronto');
});

// máscara de telefone + ✓ quando o campo está certo
const campoNome = $('[name=nome]');
const campoTel = $('[name=telefone]');
campoTel.addEventListener('input', (e) => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 11);
  e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
});
const nomeOk = () => campoNome.value.trim().length >= 2;
const telOk = () => campoTel.value.replace(/\D/g, '').length >= 10;
campoNome.addEventListener('input', () => campoNome.closest('.campo').classList.toggle('valido', nomeOk()));
campoTel.addEventListener('input', () => campoTel.closest('.campo').classList.toggle('valido', telOk()));

function erroCampo(input, mensagem) {
  $('#erro').textContent = mensagem;
  const campo = input.closest('.campo');
  campo.classList.remove('tremer');
  void campo.offsetWidth;
  campo.classList.add('tremer');
  input.focus();
}

$('#form-agendamento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const botao = $('#botao-confirmar');
  $('#erro').textContent = '';
  const dados = {
    servicoId: escolha.servico?.id,
    data: escolha.data,
    inicio: escolha.hora,
    nome: campoNome.value.trim(),
    telefone: campoTel.value,
    observacoes: e.target.observacoes.value.trim(),
  };
  if (!nomeOk()) return erroCampo(campoNome, 'Informe seu nome.');
  if (!telOk()) return erroCampo(campoTel, 'Informe seu WhatsApp com DDD.');

  botao.disabled = true;
  $('span', botao).textContent = 'Reservando…';
  try {
    const { resp, corpo } = await buscarJson('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }, { tentativas: 1, limite: 25000 });
    if (!resp.ok) {
      $('#erro').textContent = corpo.erro || 'Não foi possível agendar.';
      if (resp.status === 409) carregarHorarios(true);
      return;
    }
    mostrarSucesso(corpo);
  } catch {
    $('#erro').textContent = 'Não foi possível confirmar agora. Verifique sua internet e toque em confirmar de novo.';
  } finally {
    botao.disabled = false;
    $('span', botao).textContent = 'Confirmar agendamento';
  }
});

function mostrarSucesso(ag) {
  const quando = `${dataLonga(ag.data)} às ${ag.inicio}`;
  $('#sucesso-texto').textContent = `${ag.nome}, seu horário de ${ag.servicoNome} está reservado para ${quando}. Salve no calendário para receber o lembrete. 💖`;
  $('#sucesso-whats').href = linkWhats(config.whatsapp, `Olá! Acabei de agendar pelo site:\n💅 ${ag.servicoNome}\n📅 ${quando}\n👤 ${ag.nome}`);
  $('#cal-google').href = ag.calendario?.google || '#';
  $('#cal-ics').href = ag.calendario?.ics || '#';
  $('#form-agendamento').hidden = true;
  $('#sucesso').hidden = false;
  rolarAte($('#sucesso'), 'center');
  setTimeout(() => confete($('#confete')), 200);
}

$('#novo-agendamento').addEventListener('click', () => {
  Object.assign(escolha, { servico: null, data: null, hora: null });
  $('#form-agendamento').reset();
  $$('.campo').forEach((c) => c.classList.remove('valido'));
  $$('[aria-pressed=true]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  ['#passo-data', '#passo-hora', '#passo-dados'].forEach((s) => ($(s).hidden = true));
  mostrarServicoEscolhido(false);
  $('#sucesso').hidden = true;
  $('#form-agendamento').hidden = false;
  atualizarEtapas();
  rolarAte($('#agendar'), 'start');
});

// Confete de comemoração
function confete(canvas) {
  if (menosMovimento) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cores = ['#ff3d8b', '#a45bff', '#f2f1f4', '#e8b4a2'];
  const pedacos = Array.from({ length: 110 }, () => ({
    x: w / 2, y: h * 0.25, vx: (Math.random() - 0.5) * 13, vy: Math.random() * -11 - 3,
    tam: Math.random() * 7 + 4, giro: Math.random() * Math.PI, vg: (Math.random() - 0.5) * 0.3,
    cor: cores[(Math.random() * cores.length) | 0], vida: 1,
  }));
  (function quadro() {
    ctx.clearRect(0, 0, w, h);
    let vivos = 0;
    pedacos.forEach((p) => {
      p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.giro += p.vg; p.vida -= 0.007;
      if (p.vida <= 0 || p.y > h + 20) return;
      vivos++;
      ctx.save();
      ctx.globalAlpha = Math.min(p.vida * 1.5, 1);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.fillStyle = p.cor;
      ctx.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
      ctx.restore();
    });
    if (vivos) requestAnimationFrame(quadro);
  })();
}
