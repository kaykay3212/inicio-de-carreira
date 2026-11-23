// Armazenamento: agendamentos, bloqueios (folgas/feriados) e ajustes editáveis pelo painel.
// - Se existir a variável DATABASE_URL, usa PostgreSQL (produção).
// - Senão, salva em data/dados.json (bom para testar localmente).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sobrepoe = (a, b) => a.inicio < b.fim && b.inicio < a.fim;

class ConflitoHorario extends Error {
  constructor() {
    super('Esse horário acabou de ser reservado. Escolha outro, por favor.');
    this.status = 409;
  }
}

// ---------------------------------------------------------------- JSON
function criarStoreJson(arquivo) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  let fila = Promise.resolve();
  const exclusivo = (fn) => (fila = fila.then(fn, fn));

  const ler = () => {
    try {
      const d = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      if (Array.isArray(d)) return { agendamentos: d, bloqueios: [], ajustes: {} }; // formato antigo
      return { agendamentos: [], bloqueios: [], ajustes: {}, ...d };
    } catch {
      return { agendamentos: [], bloqueios: [], ajustes: {} };
    }
  };
  const gravar = (dados) => {
    const tmp = arquivo + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(dados, null, 2));
    fs.renameSync(tmp, arquivo);
  };
  const porDataHora = (a, b) => (a.data + (a.inicio || '')).localeCompare(b.data + (b.inicio || ''));

  return {
    tipo: 'arquivo JSON',
    async aquecer() {},

    async ativosNaData(data) {
      return ler().agendamentos.filter((a) => a.data === data && a.status === 'confirmado');
    },
    async listar(aPartirDe) {
      return ler().agendamentos.filter((a) => !aPartirDe || a.data >= aPartirDe).sort(porDataHora);
    },
    criar(ag) {
      return exclusivo(() => {
        const dados = ler();
        if (dados.agendamentos.some((a) => a.data === ag.data && a.status === 'confirmado' && sobrepoe(a, ag))) throw new ConflitoHorario();
        const novo = { id: crypto.randomUUID(), status: 'confirmado', criadoEm: new Date().toISOString(), ...ag };
        dados.agendamentos.push(novo);
        gravar(dados);
        return novo;
      });
    },
    cancelar(id) {
      return exclusivo(() => {
        const dados = ler();
        const ag = dados.agendamentos.find((a) => a.id === id);
        if (!ag) return null;
        ag.status = 'cancelado';
        gravar(dados);
        return ag;
      });
    },

    async bloqueiosNaData(data) {
      return ler().bloqueios.filter((b) => b.data === data);
    },
    async listarBloqueios(aPartirDe) {
      return ler().bloqueios.filter((b) => !aPartirDe || b.data >= aPartirDe).sort(porDataHora);
    },
    criarBloqueio(b) {
      return exclusivo(() => {
        const dados = ler();
        const novo = { id: crypto.randomUUID(), ...b };
        dados.bloqueios.push(novo);
        gravar(dados);
        return novo;
      });
    },
    removerBloqueio(id) {
      return exclusivo(() => {
        const dados = ler();
        const antes = dados.bloqueios.length;
        dados.bloqueios = dados.bloqueios.filter((b) => b.id !== id);
        gravar(dados);
        return dados.bloqueios.length < antes;
      });
    },

    async lerAjustes() {
      return ler().ajustes || {};
    },
    salvarAjustes(ajustes) {
      return exclusivo(() => {
        const dados = ler();
        dados.ajustes = ajustes;
        gravar(dados);
        return ajustes;
      });
    },
  };
}

// ---------------------------------------------------------------- Postgres
function criarStorePg(url) {
  const { Pool } = require('pg');
  const local = /localhost|127\.0\.0\.1/.test(url);
  // o SSL é configurado aqui; tiramos os parâmetros da URL para não conflitar
  const u = new URL(url);
  ['sslmode', 'channel_binding'].forEach((p) => u.searchParams.delete(p));
  const pool = new Pool({
    connectionString: u.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000, // fecha conexões paradas antes do banco grátis "dormir"
    connectionTimeoutMillis: 15000, // nunca esperar para sempre por uma conexão
    query_timeout: 20000, // nem por uma consulta
    keepAlive: true,
  });
  // uma conexão que cai (ex.: banco dormiu) não pode derrubar o servidor
  pool.on('error', (e) => console.error('Conexão com o banco caiu, será refeita:', e.message));

  const SQL_TABELAS = `
    CREATE TABLE IF NOT EXISTS agendamentos (
      id UUID PRIMARY KEY,
      servico_id TEXT NOT NULL,
      servico_nome TEXT NOT NULL,
      data TEXT NOT NULL,
      inicio TEXT NOT NULL,
      fim TEXT NOT NULL,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      observacoes TEXT,
      status TEXT NOT NULL DEFAULT 'confirmado',
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS agendamentos_data_idx ON agendamentos (data);
    CREATE TABLE IF NOT EXISTS bloqueios (
      id UUID PRIMARY KEY,
      data TEXT NOT NULL,
      inicio TEXT,
      fim TEXT,
      motivo TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS bloqueios_data_idx ON bloqueios (data);
    CREATE TABLE IF NOT EXISTS ajustes (
      chave TEXT PRIMARY KEY,
      valor JSONB NOT NULL,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  // cria as tabelas uma vez; se falhar (banco acordando), tenta de novo na próxima chamada
  let pronto = null;
  const garantirTabelas = () => (pronto ??= pool.query(SQL_TABELAS).catch((e) => { pronto = null; throw e; }));

  const erroDeConexao = (e) =>
    /timeout|terminat|ECONNRESET|ECONNREFUSED|EPIPE|Connection|closed|ended/i.test(`${e.code || ''} ${e.message || ''}`);

  // consulta com 1 nova tentativa automática se a conexão falhar
  async function consultar(sql, params) {
    await garantirTabelas().catch(() => garantirTabelas());
    try {
      return await pool.query(sql, params);
    } catch (e) {
      if (!erroDeConexao(e)) throw e;
      console.warn('Nova tentativa após falha de conexão:', e.message);
      return pool.query(sql, params);
    }
  }

  const agendamento = (r) => ({
    id: r.id,
    servicoId: r.servico_id,
    servicoNome: r.servico_nome,
    data: r.data,
    inicio: r.inicio,
    fim: r.fim,
    nome: r.nome,
    telefone: r.telefone,
    observacoes: r.observacoes,
    status: r.status,
    criadoEm: r.criado_em,
  });
  const bloqueio = (r) => ({ id: r.id, data: r.data, inicio: r.inicio, fim: r.fim, motivo: r.motivo });

  return {
    tipo: 'PostgreSQL',
    // acorda o banco (o plano grátis "dorme" quando fica sem uso)
    async aquecer() {
      await consultar('SELECT 1');
    },

    async ativosNaData(data) {
      const { rows } = await consultar("SELECT * FROM agendamentos WHERE data = $1 AND status = 'confirmado'", [data]);
      return rows.map(agendamento);
    },
    async listar(aPartirDe) {
      const { rows } = await consultar(
        'SELECT * FROM agendamentos WHERE ($1::text IS NULL OR data >= $1) ORDER BY data, inicio',
        [aPartirDe || null]
      );
      return rows.map(agendamento);
    },
    async criar(ag) {
      await consultar('SELECT 1'); // garante o banco acordado e as tabelas criadas antes da transação
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        // trava por data para evitar duas reservas simultâneas no mesmo horário
        await cliente.query('SELECT pg_advisory_xact_lock(hashtext($1))', [ag.data]);
        const { rows: conflito } = await cliente.query(
          "SELECT 1 FROM agendamentos WHERE data = $1 AND status = 'confirmado' AND inicio < $3 AND $2 < fim",
          [ag.data, ag.inicio, ag.fim]
        );
        if (conflito.length) throw new ConflitoHorario();
        const { rows } = await cliente.query(
          `INSERT INTO agendamentos (id, servico_id, servico_nome, data, inicio, fim, nome, telefone, observacoes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [crypto.randomUUID(), ag.servicoId, ag.servicoNome, ag.data, ag.inicio, ag.fim, ag.nome, ag.telefone, ag.observacoes]
        );
        await cliente.query('COMMIT');
        return agendamento(rows[0]);
      } catch (e) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        cliente.release();
      }
    },
    async cancelar(id) {
      const { rows } = await consultar("UPDATE agendamentos SET status = 'cancelado' WHERE id = $1 RETURNING *", [id]);
      return rows[0] ? agendamento(rows[0]) : null;
    },

    async bloqueiosNaData(data) {
      const { rows } = await consultar('SELECT * FROM bloqueios WHERE data = $1', [data]);
      return rows.map(bloqueio);
    },
    async listarBloqueios(aPartirDe) {
      const { rows } = await consultar(
        "SELECT * FROM bloqueios WHERE ($1::text IS NULL OR data >= $1) ORDER BY data, COALESCE(inicio, '')",
        [aPartirDe || null]
      );
      return rows.map(bloqueio);
    },
    async criarBloqueio(b) {
      const { rows } = await consultar(
        'INSERT INTO bloqueios (id, data, inicio, fim, motivo) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [crypto.randomUUID(), b.data, b.inicio, b.fim, b.motivo]
      );
      return bloqueio(rows[0]);
    },
    async removerBloqueio(id) {
      const { rowCount } = await consultar('DELETE FROM bloqueios WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async lerAjustes() {
      const { rows } = await consultar("SELECT valor FROM ajustes WHERE chave = 'studio'");
      return rows[0]?.valor || {};
    },
    async salvarAjustes(ajustes) {
      await consultar(
        `INSERT INTO ajustes (chave, valor, atualizado_em) VALUES ('studio', $1, now())
         ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`,
        [JSON.stringify(ajustes)]
      );
      return ajustes;
    },
  };
}

module.exports = {
  criarStore() {
    if (process.env.DATABASE_URL) return criarStorePg(process.env.DATABASE_URL);
    return criarStoreJson(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'dados.json'));
  },
};
