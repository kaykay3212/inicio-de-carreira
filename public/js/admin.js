const $ = (s) => document.querySelector(s);
let senha = sessionStorage.getItem('senha-admin') || '';
let agendamentos = [];

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  e.append(...filhos);
  return e;
}

const api = (url, opcoes = {}) =>
  fetch(url, { ...opcoes, headers: { 'x-admin-senha': senha, ...(opcoes.headers || {}) } });

const dataLonga = (iso) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
function telefoneBonito(t) {
  const n = t.length > 11 && t.startsWith('55') ? t.slice(2) : t; // tira o DDI do Brasil
  return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}` : t;
}
const whatsDaCliente = (t) => `https://wa.me/${t.length <= 11 ? '55' + t : t}`;

async function carregar() {
  const resp = await api('/api/admin/agendamentos');
  if (resp.status === 401) {
    sessionStorage.removeItem('senha-admin');
    $('#login').hidden = false;
    $('#painel').hidden = true;
    if (senha) $('#erro-login').textContent = 'Senha incorreta.';
    return;
  }
  agendamentos = await resp.json();
  sessionStorage.setItem('senha-admin', senha);
  $('#login').hidden = true;
  $('#painel').hidden = false;
  desenhar();
}

function desenhar() {
  const lista = $('#lista');
  const mostrarCancelados = $('#mostrar-cancelados').checked;
  const visiveis = agendamentos.filter((a) => mostrarCancelados || a.status !== 'cancelado');
  lista.replaceChildren();
  if (!visiveis.length) {
    lista.append(el('p', { class: 'secao__sub' }, 'Nenhum agendamento por enquanto.'));
    return;
  }
  const porDia = {};
  visiveis.forEach((a) => (porDia[a.data] ||= []).push(a));
  for (const [data, itens] of Object.entries(porDia)) {
    const ativos = itens.filter((a) => a.status !== 'cancelado').length;
    const bloco = el('div', { class: 'admin__dia' }, el('h3', {}, `${dataLonga(data)} — ${ativos} ${ativos === 1 ? 'cliente' : 'clientes'}`));
    itens.forEach((a) => {
      const acoes = el('div', { class: 'ag__acoes' });
      if (a.status !== 'cancelado') {
        acoes.append(
          el('a', { class: 'botao botao--pequeno botao--whats', href: whatsDaCliente(a.telefone), target: '_blank', rel: 'noopener' }, 'WhatsApp'),
          el('button', { class: 'botao botao--pequeno botao--contorno', type: 'button', onclick: () => cancelar(a) }, 'Cancelar')
        );
      } else {
        acoes.append(el('small', {}, 'Cancelado'));
      }
      bloco.append(
        el('div', { class: 'ag' + (a.status === 'cancelado' ? ' ag--cancelado' : '') },
          el('div', { class: 'ag__hora' }, `${a.inicio} – ${a.fim}`),
          el('div', { class: 'ag__info' },
            el('strong', {}, a.nome),
            el('small', {}, `${a.servicoNome} • ${telefoneBonito(a.telefone)}`),
            ...(a.observacoes ? [el('small', {}, `📝 ${a.observacoes}`)] : [])),
          acoes)
      );
    });
    lista.append(bloco);
  }
}

async function cancelar(a) {
  if (!confirm(`Cancelar o horário de ${a.nome} (${a.inicio})? O horário volta a ficar livre no site.`)) return;
  const resp = await api(`/api/admin/agendamentos/${a.id}/cancelar`, { method: 'POST' });
  if (!resp.ok) return alert('Não foi possível cancelar.');
  carregar();
}

$('#login').addEventListener('submit', (e) => {
  e.preventDefault();
  senha = e.target.senha.value;
  $('#erro-login').textContent = '';
  carregar();
});
$('#atualizar').onclick = carregar;
$('#mostrar-cancelados').onchange = desenhar;
$('#sair').onclick = () => {
  sessionStorage.removeItem('senha-admin');
  location.reload();
};

if (senha) carregar();
