// Ajustes que a dona do studio edita pelo painel (serviços, preços, horários...).
// Os valores salvos no banco substituem os padrões de src/config.js.
const padrao = require('./config');

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const EDITAVEIS = ['slogan', 'endereco', 'servicos', 'horarios', 'pausa'];

class ErroValidacao extends Error {
  constructor(msg) {
    super(msg);
    this.status = 400;
  }
}

const texto = (v, max) => String(v ?? '').trim().slice(0, max);
const idDe = (nome) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'servico';

function validarIntervalo(v, rotulo) {
  if (!v) return null;
  const inicio = texto(v.inicio, 5);
  const fim = texto(v.fim, 5);
  if (!HHMM.test(inicio) || !HHMM.test(fim)) throw new ErroValidacao(`${rotulo}: use horários no formato 09:00.`);
  if (inicio >= fim) throw new ErroValidacao(`${rotulo}: o horário de início precisa ser antes do fim.`);
  return { inicio, fim };
}

// Confere e limpa o que veio do painel
function validar(entrada) {
  const saida = {};
  if ('slogan' in entrada) saida.slogan = texto(entrada.slogan, 120);
  if ('endereco' in entrada) saida.endereco = texto(entrada.endereco, 160);

  if ('servicos' in entrada) {
    if (!Array.isArray(entrada.servicos) || !entrada.servicos.length) throw new ErroValidacao('Cadastre pelo menos um serviço.');
    if (entrada.servicos.length > 30) throw new ErroValidacao('No máximo 30 serviços.');
    const usados = new Set();
    saida.servicos = entrada.servicos.map((s, i) => {
      const nome = texto(s.nome, 60);
      if (nome.length < 2) throw new ErroValidacao(`Serviço ${i + 1}: informe o nome.`);
      const preco = Math.round(Number(String(s.preco).replace(',', '.')) * 100) / 100;
      if (!Number.isFinite(preco) || preco < 0 || preco > 100000) throw new ErroValidacao(`${nome}: preço inválido.`);
      const duracao = Math.round(Number(s.duracao));
      if (!Number.isFinite(duracao) || duracao < 10 || duracao > 600) throw new ErroValidacao(`${nome}: duração entre 10 e 600 minutos.`);
      // mantém o id existente (agendamentos antigos apontam para ele); cria um novo se for serviço novo
      let id = texto(s.id, 60) || idDe(nome);
      while (usados.has(id)) id += '-2';
      usados.add(id);
      return { id, nome, descricao: texto(s.descricao, 160), preco, duracao };
    });
  }

  if ('horarios' in entrada) {
    saida.horarios = {};
    for (let d = 0; d <= 6; d++) saida.horarios[d] = validarIntervalo(entrada.horarios?.[d], ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d]);
    if (!Object.values(saida.horarios).some(Boolean)) throw new ErroValidacao('Deixe pelo menos um dia aberto.');
  }

  if ('pausa' in entrada) saida.pausa = validarIntervalo(entrada.pausa, 'Pausa');
  return saida;
}

function criarAjustes(store) {
  let cache = null;
  return {
    // configuração final = padrões do config.js + o que foi salvo pelo painel
    async obter() {
      if (!cache) {
        const salvos = await store.lerAjustes().catch((e) => {
          console.warn('Não foi possível ler os ajustes salvos, usando os padrões:', e.message);
          return null;
        });
        const final = { ...padrao };
        for (const k of EDITAVEIS) if (salvos && k in salvos) final[k] = salvos[k];
        if (!salvos) return final; // não guarda em cache um resultado de falha
        cache = final;
      }
      return cache;
    },
    async salvar(entrada) {
      const novos = validar(entrada || {});
      const atuais = await store.lerAjustes();
      await store.salvarAjustes({ ...atuais, ...novos });
      cache = null;
      return this.obter();
    },
  };
}

module.exports = { criarAjustes, ErroValidacao };
