// =====================================================================
//  CONFIGURAÇÕES DO STUDIO — edite aqui nome, contatos, horários e serviços
// =====================================================================
module.exports = {
  nome: 'Maya Souza Nails',
  slogan: 'Unhas impecáveis, do jeitinho que você sonhou 💅',

  // WhatsApp com DDI + DDD, só números (ex.: 5511987654321)
  whatsapp: '5549988299621',
  instagram: 'Maya_souza__',
  // Endereço que aparece no rodapé (deixe vazio '' para não mostrar)
  endereco: '',

  // Fuso horário usado para saber "que horas são agora" no studio
  fusoHorario: 'America/Sao_Paulo',

  // De quantos em quantos minutos começam os horários (30 = 09:00, 09:30, ...)
  intervaloMinutos: 30,

  // Até quantos dias pra frente a cliente pode agendar
  diasAntecedencia: 30,

  // Antecedência mínima (em minutos) para agendar no mesmo dia
  antecedenciaMinima: 60,

  // Horário de atendimento por dia da semana (0 = domingo ... 6 = sábado)
  // null = fechado
  horarios: {
    0: null,
    1: { inicio: '09:00', fim: '19:00' },
    2: { inicio: '09:00', fim: '19:00' },
    3: { inicio: '09:00', fim: '19:00' },
    4: { inicio: '09:00', fim: '19:00' },
    5: { inicio: '09:00', fim: '19:00' },
    6: { inicio: '08:00', fim: '16:00' },
  },

  // Pausa (almoço). Coloque null para não ter pausa.
  pausa: { inicio: '12:00', fim: '13:00' },

  // Serviços: duração em minutos, preço em reais
  servicos: [
    { id: 'alongamento', nome: 'Alongamento Soft Gel', descricao: 'Unhas longas, leves e resistentes com acabamento natural.', preco: 130, duracao: 120 },
    { id: 'gel', nome: 'Esmaltação em Gel', descricao: 'Brilho intenso que dura muito mais que o esmalte comum.', preco: 80, duracao: 60 },
    { id: 'manutencao-retorno', nome: 'Manutenção “Retorno”', descricao: 'Retorno para manutenção do seu alongamento.', preco: 65, duracao: 60 },
    { id: 'manutencao', nome: 'Manutenção', descricao: 'Manutenção completa do alongamento.', preco: 95, duracao: 90 },
  ],
};
