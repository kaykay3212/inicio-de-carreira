// Avisa a dona do studio no celular a cada novo agendamento, pelo app gratuito "ntfy".
// Basta instalar o ntfy (Android/iPhone) e assinar o tópico definido em NTFY_TOPICO.
const SERVIDOR = process.env.NTFY_SERVIDOR || 'https://ntfy.sh';

const ativo = () => Boolean(process.env.NTFY_TOPICO);

async function enviar({ titulo, mensagem, link, acoes = [], tags = ['nail_care'], prioridade = 4 }) {
  if (!ativo()) return false;
  const resp = await fetch(SERVIDOR, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: process.env.NTFY_TOPICO,
      title: titulo,
      message: mensagem,
      tags,
      priority: prioridade,
      click: link,
      actions: acoes,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`ntfy respondeu ${resp.status}`);
  return true;
}

const dataCurta = (iso) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const telefoneBonito = (t) => {
  const n = t.length > 11 && t.startsWith('55') ? t.slice(2) : t;
  return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}` : t;
};
const whatsDaCliente = (t) => `https://wa.me/${t.length <= 11 ? '55' + t : t}`;

function novoAgendamento(ag, siteUrl) {
  const linhas = [
    `${ag.nome} — ${ag.servicoNome}`,
    `📅 ${dataCurta(ag.data)} às ${ag.inicio}`,
    `📱 ${telefoneBonito(ag.telefone)}`,
  ];
  if (ag.observacoes) linhas.push(`📝 ${ag.observacoes}`);
  return enviar({
    titulo: '💅 Novo agendamento!',
    mensagem: linhas.join('\n'),
    link: siteUrl ? `${siteUrl}/admin` : undefined,
    acoes: [{ action: 'view', label: 'WhatsApp da cliente', url: whatsDaCliente(ag.telefone) }],
  });
}

function teste(siteUrl) {
  return enviar({
    titulo: '🔔 Teste de aviso',
    mensagem: 'Tudo certo! Você vai receber um aviso assim a cada novo agendamento.',
    link: siteUrl ? `${siteUrl}/admin` : undefined,
    tags: ['white_check_mark'],
    prioridade: 3,
  });
}

module.exports = { ativo, novoAgendamento, teste, topico: () => process.env.NTFY_TOPICO || '', servidor: SERVIDOR };
