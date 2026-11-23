const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const duracaoTexto = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);
const dataLonga = (iso) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
const linkWhats = (numero, texto) => `https://wa.me/${numero}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const temMouse = matchMedia('(hover: hover) and (pointer: fine)').matches;

const ICONES = { mao: '💅', pe: '🦶', 'pe-mao': '✨', gel: '💎', alongamento: '🌸', manutencao: '🔁', 'nail-art': '🎨' };

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') Object.assign(e.style, v);
    else e.setAttribute(k, v);
  }
  e.append(...filhos);
  return e;
}

let config;
const escolha = { servico: null, data: null, hora: null };

// =============================================================== ANIMAÇÕES GERAIS
// Revela elementos quando entram na tela
const observadorRevelar = new IntersectionObserver(
  (entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visivel');
      observadorRevelar.unobserve(e.target);
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);
const revelar = (elementos) => elementos.forEach((e) => observadorRevelar.observe(e));

// Topo que muda ao rolar + barra de progresso
const topo = $('#topo');
const barraProgresso = $('#progresso-scroll');
function aoRolar() {
  const y = scrollY;
  topo.classList.toggle('topo--rolado', y > 30);
  const total = document.documentElement.scrollHeight - innerHeight;
  barraProgresso.style.transform = `scaleX(${total > 0 ? y / total : 0})`;
}
addEventListener('scroll', aoRolar, { passive: true });
aoRolar();

// Indicador deslizante no menu, seguindo a seção visível
const indicador = $('#menu-indicador');
function moverIndicador(link) {
  if (!link) return (indicador.style.opacity = 0);
  indicador.style.opacity = 1;
  indicador.style.width = link.offsetWidth + 'px';
  indicador.style.transform = `translateX(${link.offsetLeft}px)`;
}
const linksMenu = $$('#menu a');
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
['inicio', 'trabalhos', 'servicos', 'agendar'].forEach((id) => observadorSecoes.observe(document.getElementById(id)));

// Título do hero: palavras sobem uma a uma
function animarTitulo() {
  const palavras = $$('#titulo .linha > span, #titulo em > span');
  palavras.forEach((p, i) => (p.style.transitionDelay = `${0.15 + i * 0.09}s`));
  requestAnimationFrame(() => $('#titulo').classList.add('ativo'));
  $$('.hero .revelar').forEach((e, i) => e.style.setProperty('--atraso', `${0.5 + i * 0.12}s`));
  revelar($$('.hero .revelar'));
}

// Fotos do hero inclinam com o mouse (efeito 3D)
function parallaxHero() {
  const fotos = $('#hero-fotos');
  if (!temMouse || menosMovimento) return;
  let alvoX = 0, alvoY = 0, x = 0, y = 0;
  $('.hero').addEventListener('mousemove', (e) => {
    alvoX = (e.clientX / innerWidth - 0.5) * 2;
    alvoY = (e.clientY / innerHeight - 0.5) * 2;
  });
  (function loop() {
    x += (alvoX - x) * 0.06;
    y += (alvoY - y) * 0.06;
    fotos.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 6}deg)`;
    requestAnimationFrame(loop);
  })();
}

// Brilhinhos flutuando no fundo do hero
function brilhos() {
  const canvas = $('#brilhos');
  if (menosMovimento) return;
  const ctx = canvas.getContext('2d');
  let w, h, pontos;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  function ajustar() {
    w = canvas.offsetWidth; h = canvas.offsetHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pontos = Array.from({ length: Math.round((w * h) / 22000) }, () => novoPonto(true));
  }
  function novoPonto(inicio) {
    return { x: Math.random() * w, y: inicio ? Math.random() * h : h + 10, r: Math.random() * 1.6 + 0.4, v: Math.random() * 0.35 + 0.1, fase: Math.random() * Math.PI * 2, cor: Math.random() > 0.6 ? '241,201,122' : '255,140,200' };
  }
  let visivel = true;
  new IntersectionObserver(([e]) => (visivel = e.isIntersecting)).observe(canvas);
  function desenhar(t) {
    if (visivel) {
      ctx.clearRect(0, 0, w, h);
      pontos.forEach((p, i) => {
        p.y -= p.v;
        p.x += Math.sin(t / 2000 + p.fase) * 0.2;
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
  addEventListener('resize', ajustar);
  requestAnimationFrame(desenhar);
}

// Faixa com palavras passando
function montarFaixa() {
  const palavras = ['Esmaltação em gel', '✦', 'Alongamento', '✦', 'Nail art', '✦', 'Francesinha', '✦', 'Pé e mão', '✦', 'Olho de gato', '✦'];
  const faixa = $('#faixa');
  [...palavras, ...palavras].forEach((p) => faixa.append(el('span', {}, p)));
}

// =============================================================== INICIALIZAÇÃO
(async function iniciar() {
  animarTitulo();
  montarFaixa();
  brilhos();
  parallaxHero();
  revelar($$('main > section:not(.hero) .revelar'));

  config = await fetch('/api/config').then((r) => r.json());
  document.title = `${config.nome} | Agende seu horário`;
  $$('[data-nome]').forEach((e) => (e.textContent = config.nome));
  $('[data-slogan]').textContent = config.slogan;
  $('[data-endereco]').textContent = config.endereco;
  $('#ano').textContent = new Date().getFullYear();
  const whats = linkWhats(config.whatsapp, `Olá! Vim pelo site do ${config.nome} 💅`);
  $('#link-whats').href = whats;
  $('#whats-flutuante').href = whats;
  $('#link-insta').href = `https://instagram.com/${config.instagram}`;

  montarServicos();
  carregarGaleria();
})();

// =============================================================== GALERIA
let fotos = [];
async function carregarGaleria() {
  fotos = await fetch('/api/galeria').then((r) => r.json());
  const galeria = $('#galeria');
  if (!fotos.length) {
    galeria.replaceWith(el('p', { class: 'galeria__vazia' }, 'Em breve, fotos dos nossos trabalhos por aqui!'));
    return;
  }
  fotos.forEach((f, i) => {
    const item = el('button', { class: 'galeria__item', type: 'button', onclick: () => abrirLightbox(i), style: { '--atraso': `${(i % 3) * 0.12}s` } },
      el('img', { src: f.url, alt: f.legenda, loading: 'lazy' }),
      el('span', { class: 'legenda' }, f.legenda, el('i', {}, '⤢')));
    galeria.append(item);
  });
  revelar($$('.galeria__item'));

  // as 3 primeiras fotos aparecem no topo do site
  $$('.hero__foto').forEach((div, i) => {
    const f = fotos[i % fotos.length];
    div.style.backgroundImage = `url("${f.url}")`;
  });
  const primeira = new Image();
  primeira.onload = () => $('#hero-fotos').classList.add('ativo');
  primeira.src = fotos[0].url;
}

// Lightbox com setas, teclado e arrastar no celular
let fotoAtual = 0;
const lightbox = $('#lightbox');
const imgLightbox = $('img', lightbox);
function abrirLightbox(i, direcao) {
  fotoAtual = (i + fotos.length) % fotos.length;
  imgLightbox.classList.remove('trocando-esq', 'trocando-dir');
  void imgLightbox.offsetWidth; // reinicia a animação
  if (direcao) imgLightbox.classList.add(direcao < 0 ? 'trocando-esq' : 'trocando-dir');
  imgLightbox.src = fotos[fotoAtual].url;
  imgLightbox.alt = fotos[fotoAtual].legenda;
  $('figcaption', lightbox).textContent = fotos[fotoAtual].legenda;
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
  if (lightbox.hidden) return;
  if (e.key === 'Escape') fecharLightbox();
  if (e.key === 'ArrowLeft') anterior();
  if (e.key === 'ArrowRight') proxima();
});
let toqueX = null;
lightbox.addEventListener('touchstart', (e) => (toqueX = e.touches[0].clientX), { passive: true });
lightbox.addEventListener('touchend', (e) => {
  if (toqueX === null) return;
  const dx = e.changedTouches[0].clientX - toqueX;
  if (Math.abs(dx) > 50) (dx > 0 ? anterior : proxima)();
  toqueX = null;
});

// =============================================================== SERVIÇOS
function montarServicos() {
  const lista = $('#lista-servicos');
  const opcoes = $('#opcoes-servico');
  config.servicos.forEach((s, i) => {
    const cartao = el('article', { class: 'servico revelar', style: { '--atraso': `${(i % 4) * 0.08}s` }, onclick: () => { escolherServico(s); $('#agendar').scrollIntoView({ behavior: 'smooth' }); } },
      el('span', { class: 'servico__icone' }, ICONES[s.id] || '💅'),
      el('span', { class: 'servico__agendar' }, 'Agendar →'),
      el('h3', {}, s.nome),
      el('p', {}, s.descricao),
      el('div', { class: 'servico__rodape' },
        el('span', { class: 'servico__preco' }, brl(s.preco)),
        el('span', { class: 'servico__tempo' }, '⏱ ' + duracaoTexto(s.duracao))));
    cartao.style.cursor = 'pointer';
    if (temMouse && !menosMovimento) efeitoCartao(cartao);
    lista.append(cartao);

    opcoes.append(
      el('button', { class: 'opcao', type: 'button', 'aria-pressed': 'false', 'data-id': s.id, style: { '--atraso': `${i * 0.04}s` }, onclick: () => escolherServico(s) },
        el('strong', {}, `${ICONES[s.id] || '💅'} ${s.nome}`),
        el('small', {}, `${brl(s.preco)} • ${duracaoTexto(s.duracao)}`))
    );
  });
  revelar($$('.servico'));
}

// luz seguindo o mouse + leve inclinação 3D
function efeitoCartao(cartao) {
  cartao.addEventListener('mousemove', (e) => {
    const r = cartao.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    cartao.style.setProperty('--x', `${px * 100}%`);
    cartao.style.setProperty('--y', `${py * 100}%`);
    cartao.style.transform = `perspective(800px) rotateX(${(0.5 - py) * 8}deg) rotateY(${(px - 0.5) * 10}deg) translateY(-4px)`;
  });
  cartao.addEventListener('mouseleave', () => (cartao.style.transform = ''));
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

function rolarAte(elemento) {
  setTimeout(() => elemento.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
}

function escolherServico(s) {
  escolha.servico = s;
  escolha.hora = null;
  marcar($('#opcoes-servico'), '.opcao', s.id, 'id');
  montarDias();
  $('#passo-data').hidden = false;
  $('#passo-dados').hidden = true;
  atualizarEtapas();
  if (escolha.data) carregarHorarios();
  else rolarAte($('#passo-data'));
}

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
$('.dias__seta--esq').onclick = () => $('#dias').scrollBy({ left: -300 });
$('.dias__seta--dir').onclick = () => $('#dias').scrollBy({ left: 300 });

function escolherDia(iso) {
  escolha.data = iso;
  escolha.hora = null;
  marcar($('#dias'), '.dia', iso, 'data');
  $('#passo-dados').hidden = true;
  atualizarEtapas();
  carregarHorarios();
}

async function carregarHorarios() {
  const horas = $('#horas');
  $('#passo-hora').hidden = false;
  horas.replaceChildren(el('div', { class: 'carregando' }, ...Array.from({ length: 8 }, () => el('i'))));
  rolarAte($('#passo-hora'));
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
    horas.append(el('p', { class: 'aviso' }, 'Sem horários livres nesse dia 😢 Tente outra data.'));
    return;
  }
  horarios.forEach((h, i) =>
    horas.append(el('button', { class: 'hora', type: 'button', 'aria-pressed': 'false', 'data-hora': h, style: { '--atraso': `${Math.min(i, 15) * 0.03}s` }, onclick: () => escolherHora(h) }, h))
  );
}

function escolherHora(h) {
  escolha.hora = h;
  marcar($('#horas'), '.hora', h, 'hora');
  const passo = $('#passo-dados');
  const estavaOculto = passo.hidden;
  passo.hidden = false;
  $('#resumo').replaceChildren(
    el('strong', {}, escolha.servico.nome), ` • ${brl(escolha.servico.preco)}`, el('br'),
    `📅 ${dataLonga(escolha.data)} às ${h}`
  );
  $('#erro').textContent = '';
  atualizarEtapas();
  if (estavaOculto) rolarAte(passo);
}

// depois que a animação de entrada termina, ela não se repete ao trocar a escolha
$('#form-agendamento').addEventListener('animationend', (e) => {
  if (e.animationName === 'item-entrar') e.target.classList.add('pronto');
});

// máscara de telefone
$('[name=telefone]').addEventListener('input', (e) => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 11);
  e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
});

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
    nome: form.nome.value.trim(),
    telefone: form.telefone.value,
    observacoes: form.observacoes.value.trim(),
  };
  if (dados.nome.length < 2) return erroCampo(form.nome, 'Informe seu nome.');
  if (dados.telefone.replace(/\D/g, '').length < 10) return erroCampo(form.telefone, 'Informe seu WhatsApp com DDD.');

  botao.disabled = true;
  botao.textContent = 'Reservando...';
  try {
    const resp = await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    const corpo = await resp.json();
    if (!resp.ok) {
      $('#erro').textContent = corpo.erro || 'Não foi possível agendar.';
      if (resp.status === 409) carregarHorarios();
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
  $('#sucesso').scrollIntoView({ behavior: 'smooth', block: 'center' });
  confete($('#confete'));
}

$('#novo-agendamento').addEventListener('click', () => {
  Object.assign(escolha, { servico: null, data: null, hora: null });
  $('#form-agendamento').reset();
  $$('[aria-pressed=true]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  ['#passo-data', '#passo-hora', '#passo-dados'].forEach((s) => ($(s).hidden = true));
  $('#sucesso').hidden = true;
  $('#form-agendamento').hidden = false;
  atualizarEtapas();
  $('#agendar').scrollIntoView({ behavior: 'smooth' });
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
