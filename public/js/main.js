const $ = (s, el = document) => el.querySelector(s);
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const duracaoTexto = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);
const dataLonga = (iso) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
const linkWhats = (numero, texto) => `https://wa.me/${numero}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  e.append(...filhos);
  return e;
}

let config;
const escolha = { servico: null, data: null, hora: null };

// --------------------------------------------------------------- inicialização
(async function iniciar() {
  config = await fetch('/api/config').then((r) => r.json());

  document.title = `${config.nome} | Agende seu horário`;
  document.querySelectorAll('[data-nome]').forEach((e) => (e.textContent = config.nome));
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

// --------------------------------------------------------------- galeria
let fotos = [];
async function carregarGaleria() {
  fotos = await fetch('/api/galeria').then((r) => r.json());
  const galeria = $('#galeria');
  if (!fotos.length) {
    galeria.replaceWith(el('p', { class: 'galeria__vazia' }, 'Em breve, fotos dos nossos trabalhos por aqui!'));
    return;
  }
  fotos.forEach((f, i) => {
    galeria.append(
      el('button', { class: 'galeria__item', type: 'button', onclick: () => abrirLightbox(i) },
        el('img', { src: f.url, alt: f.legenda, loading: 'lazy' }),
        el('span', {}, f.legenda))
    );
  });
  const hero = $('#hero-fotos');
  fotos.slice(0, 2).forEach((f) => hero.append(el('img', { src: f.url, alt: '' })));
}

let fotoAtual = 0;
const lightbox = $('#lightbox');
function abrirLightbox(i) {
  fotoAtual = (i + fotos.length) % fotos.length;
  $('img', lightbox).src = fotos[fotoAtual].url;
  $('img', lightbox).alt = fotos[fotoAtual].legenda;
  $('figcaption', lightbox).textContent = fotos[fotoAtual].legenda;
  lightbox.hidden = false;
}
const fecharLightbox = () => (lightbox.hidden = true);
$('.lightbox__fechar').onclick = fecharLightbox;
$('.lightbox__nav--ant').onclick = () => abrirLightbox(fotoAtual - 1);
$('.lightbox__nav--prox').onclick = () => abrirLightbox(fotoAtual + 1);
lightbox.addEventListener('click', (e) => e.target === lightbox && fecharLightbox());
document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape') fecharLightbox();
  if (e.key === 'ArrowLeft') abrirLightbox(fotoAtual - 1);
  if (e.key === 'ArrowRight') abrirLightbox(fotoAtual + 1);
});

// --------------------------------------------------------------- serviços
function montarServicos() {
  const lista = $('#lista-servicos');
  const opcoes = $('#opcoes-servico');
  config.servicos.forEach((s) => {
    lista.append(
      el('article', { class: 'servico' },
        el('h3', {}, s.nome),
        el('p', {}, s.descricao),
        el('div', { class: 'servico__rodape' },
          el('span', { class: 'servico__preco' }, brl(s.preco)),
          el('span', { class: 'servico__tempo' }, '⏱ ' + duracaoTexto(s.duracao))))
    );
    opcoes.append(
      el('button', { class: 'opcao', type: 'button', 'aria-pressed': 'false', 'data-id': s.id, onclick: () => escolherServico(s) },
        el('strong', {}, s.nome),
        el('small', {}, `${brl(s.preco)} • ${duracaoTexto(s.duracao)}`))
    );
  });
}

function marcar(container, seletor, valor, atributo) {
  container.querySelectorAll(seletor).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[atributo] === valor)));
}

// --------------------------------------------------------------- fluxo de agendamento
function escolherServico(s) {
  escolha.servico = s;
  escolha.hora = null;
  marcar($('#opcoes-servico'), '.opcao', s.id, 'id');
  montarDias();
  $('#passo-data').hidden = false;
  $('#passo-dados').hidden = true;
  if (escolha.data) carregarHorarios();
  else $('#passo-data').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function montarDias() {
  const dias = $('#dias');
  if (dias.childElementCount) return;
  const semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const base = new Date(config.hoje + 'T12:00:00Z');
  for (let i = 0; i <= config.diasAntecedencia; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    if (!config.horarios[d.getUTCDay()]) continue;
    const iso = d.toISOString().slice(0, 10);
    dias.append(
      el('button', { class: 'dia', type: 'button', 'aria-pressed': 'false', 'data-data': iso, onclick: () => escolherDia(iso) },
        el('span', {}, i === 0 ? 'Hoje' : semana[d.getUTCDay()]),
        el('strong', {}, String(d.getUTCDate())),
        el('span', {}, meses[d.getUTCMonth()]))
    );
  }
}

function escolherDia(iso) {
  escolha.data = iso;
  escolha.hora = null;
  marcar($('#dias'), '.dia', iso, 'data');
  $('#passo-dados').hidden = true;
  carregarHorarios();
}

async function carregarHorarios() {
  const horas = $('#horas');
  $('#passo-hora').hidden = false;
  horas.replaceChildren(el('p', { class: 'aviso' }, 'Carregando horários...'));
  const pedido = `${escolha.servico.id}|${escolha.data}`;
  const { horarios = [] } = await fetch(`/api/horarios?data=${escolha.data}&servico=${escolha.servico.id}`).then((r) => r.json());
  if (pedido !== `${escolha.servico.id}|${escolha.data}`) return; // usuário mudou a escolha no meio
  horas.replaceChildren();
  if (!horarios.length) {
    horas.append(el('p', { class: 'aviso' }, 'Sem horários livres nesse dia 😢 Tente outra data.'));
    return;
  }
  horarios.forEach((h) =>
    horas.append(el('button', { class: 'hora', type: 'button', 'aria-pressed': 'false', 'data-hora': h, onclick: () => escolherHora(h) }, h))
  );
  $('#passo-hora').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escolherHora(h) {
  escolha.hora = h;
  marcar($('#horas'), '.hora', h, 'hora');
  $('#passo-dados').hidden = false;
  $('#resumo').innerHTML = '';
  $('#resumo').append(
    el('strong', {}, escolha.servico.nome), ` • ${brl(escolha.servico.preco)}`, el('br'),
    `📅 ${dataLonga(escolha.data)} às ${h}`
  );
  $('#erro').textContent = '';
  $('#passo-dados').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// máscara simples de telefone
$('[name=telefone]').addEventListener('input', (e) => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 11);
  e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
});

$('#form-agendamento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const erro = $('#erro');
  const botao = $('#botao-confirmar');
  erro.textContent = '';

  const dados = {
    servicoId: escolha.servico?.id,
    data: escolha.data,
    inicio: escolha.hora,
    nome: form.nome.value.trim(),
    telefone: form.telefone.value,
    observacoes: form.observacoes.value.trim(),
  };
  if (dados.nome.length < 2) return (erro.textContent = 'Informe seu nome.');
  if (dados.telefone.replace(/\D/g, '').length < 10) return (erro.textContent = 'Informe seu WhatsApp com DDD.');

  botao.disabled = true;
  botao.textContent = 'Reservando...';
  try {
    const resp = await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    const corpo = await resp.json();
    if (!resp.ok) {
      erro.textContent = corpo.erro || 'Não foi possível agendar.';
      if (resp.status === 409) carregarHorarios();
      return;
    }
    mostrarSucesso(corpo);
  } catch {
    erro.textContent = 'Sem conexão. Tente novamente.';
  } finally {
    botao.disabled = false;
    botao.textContent = 'Confirmar agendamento';
  }
});

function mostrarSucesso(ag) {
  const quando = `${dataLonga(ag.data)} às ${ag.inicio}`;
  $('#sucesso-texto').textContent = `${ag.nome}, seu horário de ${ag.servicoNome} está reservado para ${quando}. Te esperamos! 💖`;
  $('#sucesso-whats').href = linkWhats(
    config.whatsapp,
    `Olá! Acabei de agendar pelo site:\n💅 ${ag.servicoNome}\n📅 ${quando}\n👤 ${ag.nome}`
  );
  $('#form-agendamento').hidden = true;
  $('#sucesso').hidden = false;
  $('#sucesso').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('#novo-agendamento').addEventListener('click', () => {
  Object.assign(escolha, { servico: null, data: null, hora: null });
  $('#form-agendamento').reset();
  document.querySelectorAll('[aria-pressed=true]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  ['#passo-data', '#passo-hora', '#passo-dados'].forEach((s) => ($(s).hidden = true));
  $('#sucesso').hidden = true;
  $('#form-agendamento').hidden = false;
  $('#agendar').scrollIntoView({ behavior: 'smooth' });
});
