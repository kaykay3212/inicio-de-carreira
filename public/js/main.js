const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const duracaoTexto = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);
const dataLonga = (iso) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
const linkWhats = (numero, texto) => `https://wa.me/${numero}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICONES = { mao: '💅', pe: '🦶', 'pe-mao': '✨', gel: '💎', alongamento: '🌸', manutencao: '🔁', 'nail-art': '🎨' };

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') Object.entries(v).forEach(([p, val]) => e.style.setProperty(p, val));
    else e.setAttribute(k, v);
  }
  e.append(...filhos);
  return e;
}

// Rola suavemente até um elemento, só na vertical
function rolarAte(elemento, bloco = 'nearest') {
  setTimeout(() => elemento.scrollIntoView({ behavior: menosMovimento ? 'auto' : 'smooth', block: bloco, inline: 'nearest' }), 120);
}

let config;
const escolha = { servico: null, data: null, hora: null };

// =============================================================== ABERTURA
const abertura = $('#abertura');
const inicioAbertura = performance.now();
function fecharAbertura() {
  const espera = Math.max(0, 1500 - (performance.now() - inicioAbertura));
  setTimeout(() => {
    abertura.classList.add('sair');
    animarTitulo();
    setTimeout(() => abertura.remove(), 700);
  }, menosMovimento ? 0 : espera);
}

// =============================================================== AVISOS (toasts)
function aviso(texto) {
  const t = el('div', { class: 'toast' }, texto);
  $('#toasts').append(t);
  setTimeout(() => {
    t.classList.add('sair');
    t.addEventListener('animationend', () => t.remove());
  }, 2800);
}

// =============================================================== EFEITO DE ONDA AO TOCAR
document.addEventListener('pointerdown', (e) => {
  const alvo = e.target.closest('.botao, .opcao, .dia, .hora, .servico, .escolhido__trocar');
  if (!alvo || menosMovimento) return;
  const r = alvo.getBoundingClientRect();
  const tam = Math.max(r.width, r.height);
  const onda = el('span', { class: 'onda', style: { width: tam + 'px', height: tam + 'px', left: e.clientX - r.left - tam / 2 + 'px', top: e.clientY - r.top - tam / 2 + 'px' } });
  if (getComputedStyle(alvo).position === 'static') alvo.style.position = 'relative';
  alvo.style.overflow = 'hidden';
  alvo.append(onda);
  onda.addEventListener('animationend', () => onda.remove());
});

// =============================================================== REVELAR AO ROLAR
const observadorRevelar = new IntersectionObserver(
  (entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visivel');
      observadorRevelar.unobserve(e.target);
    });
  },
  { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
);
const revelar = (elementos) => elementos.forEach((e) => observadorRevelar.observe(e));

// Títulos das seções: cada palavra sobe
function prepararTitulos() {
  $$('.titulo-secao').forEach((titulo) => {
    let i = 0;
    const quebrar = (no) => {
      [...no.childNodes].forEach((filho) => {
        if (filho.nodeType === 3) {
          const partes = filho.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          partes.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) return frag.append(' ');
            frag.append(el('span', { class: 'palavra' }, el('span', { style: { '--atraso': `${i++ * 0.08}s` } }, p)));
          });
          filho.replaceWith(frag);
        } else quebrar(filho);
      });
    };
    quebrar(titulo);
  });
  revelar($$('.titulo-secao'));
}

// =============================================================== TOPO, PROGRESSO E MENU
const topo = $('#topo');
const barraProgresso = $('#progresso-scroll');
const barraCelular = $('#barra-celular');
function aoRolar() {
  const y = scrollY;
  topo.classList.toggle('topo--rolado', y > 30);
  const total = document.documentElement.scrollHeight - innerHeight;
  barraProgresso.style.transform = `scaleX(${total > 0 ? y / total : 0})`;
  // barra do celular aparece depois do topo e some na área de agendamento
  const agendar = $('#agendar').getBoundingClientRect();
  const naAgenda = agendar.top < innerHeight * 0.6 && agendar.bottom > innerHeight * 0.3;
  barraCelular.classList.toggle('visivel', y > innerHeight * 0.7 && !naAgenda);
}
addEventListener('scroll', aoRolar, { passive: true });

const indicador = $('#menu-indicador');
const linksMenu = $$('#menu a');
function moverIndicador(link) {
  if (!link) return (indicador.style.opacity = 0);
  indicador.style.opacity = 1;
  indicador.style.width = link.offsetWidth + 'px';
  indicador.style.transform = `translateX(${link.offsetLeft}px)`;
}
const observadorSecoes = new IntersectionObserver(
  (entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      const link = linksMenu.find((a) => a.getAttribute('href') === '#' + e.target.id);
      linksMenu.forEach((a) => a.classList.toggle('ativo', a === link));
      moverIndicador(link);
    });
  },
  { rootMargin: '-45% 0px -50% 0px' }
);
$$('main > section').forEach((s) => observadorSecoes.observe(s));

// Menu do celular
const menuBotao = $('#menu-botao');
const menuMobile = $('#menu-mobile');
function alternarMenu(abrir) {
  menuBotao.setAttribute('aria-expanded', String(abrir));
  menuBotao.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
  document.body.style.overflow = abrir ? 'hidden' : '';
  if (abrir) {
    menuMobile.hidden = false;
    $$('nav a', menuMobile).forEach((a, i) => (a.style.transitionDelay = `${0.15 + i * 0.06}s`));
    requestAnimationFrame(() => requestAnimationFrame(() => menuMobile.classList.add('aberto')));
  } else {
    menuMobile.classList.remove('aberto');
    $$('nav a', menuMobile).forEach((a) => (a.style.transitionDelay = '0s'));
    setTimeout(() => !menuMobile.classList.contains('aberto') && (menuMobile.hidden = true), 600);
  }
}
menuBotao.addEventListener('click', () => alternarMenu(menuBotao.getAttribute('aria-expanded') !== 'true'));
$$('a', menuMobile).forEach((a) => a.addEventListener('click', () => alternarMenu(false)));

// =============================================================== HERO
function animarTitulo() {
  const palavras = $$('#titulo .linha > span, #titulo em > span');
  palavras.forEach((p, i) => (p.style.transitionDelay = `${0.1 + i * 0.09}s`));
  $('#titulo').classList.add('ativo');
  $$('.hero .revelar').forEach((e, i) => e.style.setProperty('--atraso', `${0.45 + i * 0.12}s`));
  revelar($$('.hero .revelar'));
}

// Números contando
function contar(elemento, fim) {
  if (menosMovimento) return (elemento.textContent = fim);
  const inicio = performance.now();
  const duracao = 1400;
  (function passo(t) {
    const p = Math.min((t - inicio) / duracao, 1);
    elemento.textContent = Math.round(fim * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(passo);
  })(inicio);
}
function prepararNumeros(valores) {
  const caixa = $('#numeros');
  const obs = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    setTimeout(() => $$('[data-contar]', caixa).forEach((d) => contar(d, valores[d.dataset.contar] || 0)), 900);
  });
  obs.observe(caixa);
}

// Brilhinhos subindo no fundo
function brilhos() {
  const canvas = $('#brilhos');
  if (menosMovimento) return;
  const ctx = canvas.getContext('2d');
  let w, h, pontos;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const novoPonto = (inicio) => ({ x: Math.random() * w, y: inicio ? Math.random() * h : h + 10, r: Math.random() * 1.6 + 0.4, v: Math.random() * 0.35 + 0.1, fase: Math.random() * Math.PI * 2, cor: Math.random() > 0.6 ? '241,201,122' : '255,140,200' });
  function ajustar() {
    w = canvas.offsetWidth; h = canvas.offsetHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pontos = Array.from({ length: Math.round((w * h) / 22000) }, () => novoPonto(true));
  }
  let visivel = true;
  new IntersectionObserver(([e]) => (visivel = e.isIntersecting)).observe(canvas);
  function desenhar(t) {
    if (visivel) {
      ctx.clearRect(0, 0, w, h);
      pontos.forEach((p, i) => {
        p.y -= p.v;
        if (p.y < -10) pontos[i] = novoPonto(false);
        const a = 0.35 + Math.sin(t / 500 + p.fase) * 0.35;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.cor},${Math.max(a, 0)})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${p.cor},1)`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    requestAnimationFrame(desenhar);
  }
  ajustar();
  let largura = innerWidth;
  addEventListener('resize', () => innerWidth !== largura && ((largura = innerWidth), ajustar()));
  requestAnimationFrame(desenhar);
}

// =============================================================== INICIALIZAÇÃO
(async function iniciar() {
  prepararTitulos();
  brilhos();
  revelar($$('main > section:not(.hero) .revelar'));
  revelar([$('#como')]);
  aoRolar();

  try {
    config = await fetch('/api/config').then((r) => r.json());
  } catch {
    fecharAbertura();
    return aviso('Não foi possível carregar o site. Atualize a página.');
  }
  document.title = `${config.nome} | Agende seu horário`;
  $$('[data-nome]').forEach((e) => (e.textContent = config.nome));
  $('[data-slogan]').textContent = config.slogan;
  $('[data-endereco]').textContent = config.endereco;
  $('#ano').textContent = new Date().getFullYear();
  const whats = linkWhats(config.whatsapp, `Olá! Vim pelo site do ${config.nome} 💅`);
  $$('[data-whats]').forEach((a) => (a.href = whats));
  $('#link-insta').href = `https://instagram.com/${config.instagram}`;

  montarServicos();
  await carregarGaleria();
  prepararNumeros({ servicos: config.servicos.length, fotos: fotos.length, preco: Math.min(...config.servicos.map((s) => s.preco)) });
  fecharAbertura();
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
  if (!fotos.length) {
    galeria.replaceWith(el('p', { class: 'galeria__vazia' }, 'Em breve, fotos dos nossos trabalhos por aqui!'));
    return;
  }
  fotos.forEach((f, i) => {
    const img = el('img', { src: f.url, alt: f.legenda, loading: 'lazy' });
    const marcarCarregada = () => img.classList.add('carregada');
    img.complete ? marcarCarregada() : img.addEventListener('load', marcarCarregada);
    galeria.append(
      el('button', { class: 'galeria__item', type: 'button', onclick: () => abrirLightbox(i), style: { '--atraso': `${(i % 3) * 0.12}s` } },
        img,
        el('span', { class: 'legenda' }, f.legenda, el('b', {}, 'Ver ⤢')))
    );
  });
  revelar($$('.galeria__item'));

  $$('.hero__foto').forEach((div, i) => (div.style.backgroundImage = `url("${fotos[i % fotos.length].url}")`));
  await new Promise((ok) => {
    const primeira = new Image();
    primeira.onload = primeira.onerror = ok;
    primeira.src = fotos[0].url;
    setTimeout(ok, 2500);
  });
  $('#hero-fotos').classList.add('ativo');
}

// Lightbox com setas, teclado e arrastar no celular
let fotoAtual = 0;
const lightbox = $('#lightbox');
const imgLightbox = $('img', lightbox);
function abrirLightbox(i, direcao) {
  fotoAtual = (i + fotos.length) % fotos.length;
  imgLightbox.classList.remove('trocando-esq', 'trocando-dir');
  void imgLightbox.offsetWidth;
  if (direcao) imgLightbox.classList.add(direcao < 0 ? 'trocando-esq' : 'trocando-dir');
  imgLightbox.src = fotos[fotoAtual].url;
  imgLightbox.alt = fotos[fotoAtual].legenda;
  $('.lightbox__legenda').textContent = fotos[fotoAtual].legenda;
  $('.lightbox__contador').textContent = `${fotoAtual + 1} / ${fotos.length}`;
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}
function fecharLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
}
const anterior = () => abrirLightbox(fotoAtual - 1, -1);
const proxima = () => abrirLightbox(fotoAtual + 1, 1);
$('.lightbox__fechar').onclick = fecharLightbox;
$('.lightbox__nav--ant').onclick = anterior;
$('.lightbox__nav--prox').onclick = proxima;
lightbox.addEventListener('click', (e) => (e.target === lightbox || e.target.tagName === 'FIGURE') && fecharLightbox());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menuBotao.getAttribute('aria-expanded') === 'true') alternarMenu(false);
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
  else if (dy > 90) fecharLightbox(); // arrastar para baixo fecha
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
  config.servicos.forEach((s, i) => {
    const cartao = el('article', { class: 'servico revelar', tabindex: '0', role: 'button', 'aria-label': `Agendar ${s.nome}`, style: { '--atraso': `${(i % 4) * 0.08}s` } },
      el('span', { class: 'servico__icone' }, ICONES[s.id] || '💅'),
      el('span', { class: 'servico__agendar' }, 'Agendar →'),
      el('h3', {}, s.nome),
      el('p', {}, s.descricao),
      el('div', { class: 'servico__rodape' },
        el('span', { class: 'servico__preco' }, brl(s.preco)),
        el('span', { class: 'servico__tempo' }, '⏱ ' + duracaoTexto(s.duracao))));
    const agendarEste = () => {
      escolherServico(s, false);
      rolarAte($('#agendar'), 'start');
    };
    cartao.addEventListener('click', agendarEste);
    cartao.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), agendarEste()));
    cartao.addEventListener('mousemove', (e) => {
      const r = cartao.getBoundingClientRect();
      cartao.style.setProperty('--x', `${e.clientX - r.left}px`);
      cartao.style.setProperty('--y', `${e.clientY - r.top}px`);
    });
    lista.append(cartao);

    opcoes.append(
      el('button', { class: 'opcao', type: 'button', 'aria-pressed': 'false', 'data-id': s.id, style: { '--atraso': `${i * 0.04}s` }, onclick: () => escolherServico(s) },
        el('strong', {}, `${ICONES[s.id] || '💅'} ${s.nome}`),
        el('small', {}, `${brl(s.preco)} • ${duracaoTexto(s.duracao)}`))
    );
  });
  revelar($$('.servico'));
}

// =============================================================== AGENDAMENTO
function marcar(container, seletor, valor, atributo) {
  $$(seletor, container).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[atributo] === valor)));
}

function atualizarEtapas() {
  const etapa = escolha.hora ? 4 : escolha.data ? 3 : escolha.servico ? 2 : 1;
  $$('#etapas li').forEach((li, i) => li.classList.toggle('ativa', i < etapa));
  $('#etapas-barra').style.transform = `scaleX(${(etapa - 1) / 3})`;
}

function mostrarServicoEscolhido(mostrar) {
  $('#servico-escolhido').hidden = !mostrar;
  $('#opcoes-servico').hidden = mostrar;
}

function escolherServico(s, rolar = true) {
  escolha.servico = s;
  escolha.hora = null;
  marcar($('#opcoes-servico'), '.opcao', s.id, 'id');
  $('#escolhido-icone').textContent = ICONES[s.id] || '💅';
  $('#escolhido-nome').textContent = s.nome;
  $('#escolhido-info').textContent = `${brl(s.preco)} • ${duracaoTexto(s.duracao)}`;
  // pequena pausa para ver a seleção antes de resumir
  setTimeout(() => mostrarServicoEscolhido(true), rolar ? 280 : 0);
  montarDias();
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

function montarDias() {
  const dias = $('#dias');
  if (dias.childElementCount) return;
  const semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const base = new Date(config.hoje + 'T12:00:00Z');
  let n = 0;
  for (let i = 0; i <= config.diasAntecedencia; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    if (!config.horarios[d.getUTCDay()]) continue;
    const iso = d.toISOString().slice(0, 10);
    dias.append(
      el('button', { class: 'dia', type: 'button', 'aria-pressed': 'false', 'data-data': iso, style: { '--atraso': `${Math.min(n++, 8) * 0.04}s` }, onclick: () => escolherDia(iso) },
        el('span', {}, i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : semana[d.getUTCDay()]),
        el('strong', {}, String(d.getUTCDate())),
        el('span', {}, meses[d.getUTCMonth()]))
    );
  }
}
$('.dias__seta--esq').onclick = () => $('#dias').scrollBy({ left: -300, behavior: 'smooth' });
$('.dias__seta--dir').onclick = () => $('#dias').scrollBy({ left: 300, behavior: 'smooth' });

function escolherDia(iso) {
  escolha.data = iso;
  escolha.hora = null;
  marcar($('#dias'), '.dia', iso, 'data');
  $('#passo-dados').hidden = true;
  atualizarEtapas();
  carregarHorarios(true);
}

async function carregarHorarios(rolar) {
  const horas = $('#horas');
  $('#passo-hora').hidden = false;
  horas.replaceChildren(el('div', { class: 'carregando' }, ...Array.from({ length: 8 }, () => el('i'))));
  if (rolar) rolarAte($('#passo-hora'), 'center');
  const pedido = `${escolha.servico.id}|${escolha.data}`;
  let horarios = [];
  try {
    ({ horarios = [] } = await fetch(`/api/horarios?data=${escolha.data}&servico=${escolha.servico.id}`).then((r) => r.json()));
  } catch {
    horas.replaceChildren(el('p', { class: 'aviso' }, 'Não foi possível carregar os horários. Tente novamente.'));
    return;
  }
  if (pedido !== `${escolha.servico.id}|${escolha.data}`) return; // a cliente mudou a escolha no meio
  horas.replaceChildren();
  if (!horarios.length) {
    horas.append(el('p', { class: 'aviso' }, 'Sem horários livres nesse dia 😢 Escolha outra data acima.'));
    return;
  }
  // agrupa por período do dia
  const grupos = [
    ['☀️ Manhã', (h) => h < '12:00'],
    ['🌤️ Tarde', (h) => h >= '12:00' && h < '18:00'],
    ['🌙 Noite', (h) => h >= '18:00'],
  ];
  let i = 0;
  grupos.forEach(([titulo, filtro]) => {
    const lista = horarios.filter(filtro);
    if (!lista.length) return;
    horas.append(
      el('div', { class: 'horas-grupo' },
        el('h4', {}, titulo),
        el('div', { class: 'horas' },
          ...lista.map((h) => el('button', { class: 'hora', type: 'button', 'aria-pressed': 'false', 'data-hora': h, style: { '--atraso': `${Math.min(i++, 15) * 0.03}s` }, onclick: () => escolherHora(h) }, h))))
    );
  });
}

function escolherHora(h) {
  escolha.hora = h;
  marcar($('#horas'), '.hora', h, 'hora');
  const passo = $('#passo-dados');
  const estavaOculto = passo.hidden;
  passo.hidden = false;
  $('#resumo').replaceChildren(
    el('strong', {}, `${ICONES[escolha.servico.id] || '💅'} ${escolha.servico.nome}`), ` • ${brl(escolha.servico.preco)}`, el('br'),
    `📅 ${dataLonga(escolha.data)} às ${h}`
  );
  $('#erro').textContent = '';
  atualizarEtapas();
  if (estavaOculto) rolarAte(passo, 'center');
}

// depois que a animação de entrada termina, ela não se repete ao trocar a escolha
$('#form-agendamento').addEventListener('animationend', (e) => {
  if (e.animationName === 'item-entrar') e.target.classList.add('pronto');
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
  const form = e.target;
  const botao = $('#botao-confirmar');
  $('#erro').textContent = '';

  const dados = {
    servicoId: escolha.servico?.id,
    data: escolha.data,
    inicio: escolha.hora,
    nome: campoNome.value.trim(),
    telefone: campoTel.value,
    observacoes: form.observacoes.value.trim(),
  };
  if (!nomeOk()) return erroCampo(campoNome, 'Informe seu nome.');
  if (!telOk()) return erroCampo(campoTel, 'Informe seu WhatsApp com DDD.');

  botao.disabled = true;
  botao.textContent = 'Reservando...';
  try {
    const resp = await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    const corpo = await resp.json();
    if (!resp.ok) {
      $('#erro').textContent = corpo.erro || 'Não foi possível agendar.';
      if (resp.status === 409) carregarHorarios(true);
      return;
    }
    mostrarSucesso(corpo);
  } catch {
    $('#erro').textContent = 'Sem conexão. Tente novamente.';
  } finally {
    botao.disabled = false;
    botao.textContent = 'Confirmar agendamento';
  }
});

function mostrarSucesso(ag) {
  const quando = `${dataLonga(ag.data)} às ${ag.inicio}`;
  $('#sucesso-texto').textContent = `${ag.nome}, seu horário de ${ag.servicoNome} está reservado para ${quando}. Te esperamos! 💖`;
  $('#sucesso-whats').href = linkWhats(config.whatsapp, `Olá! Acabei de agendar pelo site:\n💅 ${ag.servicoNome}\n📅 ${quando}\n👤 ${ag.nome}`);
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

// Confete de comemoração 🎉
function confete(canvas) {
  if (menosMovimento) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cores = ['#ff4d9d', '#a45bff', '#f1c97a', '#ffffff', '#ff8cc6'];
  const pedacos = Array.from({ length: 140 }, () => ({
    x: w / 2, y: h * 0.28,
    vx: (Math.random() - 0.5) * 14, vy: Math.random() * -12 - 3,
    tam: Math.random() * 7 + 4, giro: Math.random() * Math.PI, vg: (Math.random() - 0.5) * 0.3,
    cor: cores[(Math.random() * cores.length) | 0], vida: 1,
  }));
  (function quadro() {
    ctx.clearRect(0, 0, w, h);
    let vivos = 0;
    pedacos.forEach((p) => {
      p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.giro += p.vg; p.vida -= 0.006;
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
