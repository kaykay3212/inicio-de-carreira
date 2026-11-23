// =====================================================================
//  CONFIGURAÇÕES DO STUDIO — edite aqui nome, contatos, horários e serviços
// =====================================================================
module.exports = {
  nome: 'Studio Bella Unhas',
  slogan: 'Unhas impecáveis, do jeitinho que você sonhou 💅',

  // WhatsApp com DDI + DDD, só números (ex.: 5511987654321)
  whatsapp: '5511999999999',
  instagram: 'seu.instagram',
  endereco: 'Rua Exemplo, 123 - Centro, Sua Cidade',

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
    { id: 'mao', nome: 'Manicure', descricao: 'Cutilagem, lixamento e esmaltação tradicional.', preco: 35, duracao: 45 },
    { id: 'pe', nome: 'Pedicure', descricao: 'Cuidado completo dos pés com esmaltação.', preco: 40, duracao: 60 },
    { id: 'pe-mao', nome: 'Pé + Mão', descricao: 'O combo completo pra você sair renovada.', preco: 70, duracao: 90 },
    { id: 'gel', nome: 'Esmaltação em Gel', descricao: 'Brilho intenso e durabilidade de até 3 semanas.', preco: 60, duracao: 60 },
    { id: 'alongamento', nome: 'Alongamento em Fibra/Gel', descricao: 'Unhas longas, resistentes e naturais.', preco: 150, duracao: 150 },
    { id: 'manutencao', nome: 'Manutenção de Alongamento', descricao: 'Manutenção do alongamento (até 21 dias).', preco: 90, duracao: 90 },
    { id: 'nail-art', nome: 'Nail Art (adicional)', descricao: 'Decoração personalizada: francesinha, desenhos, pedrarias.', preco: 20, duracao: 30 },
  ],
};
