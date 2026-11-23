// Armazenamento dos agendamentos.
// - Se existir a variável DATABASE_URL, usa PostgreSQL (recomendado em produção).
// - Senão, salva em data/agendamentos.json (bom para testar localmente).
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
      return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    } catch {
      return [];
    }
  };
  const gravar = (lista) => {
    const tmp = arquivo + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(lista, null, 2));
    fs.renameSync(tmp, arquivo);
  };

  return {
    tipo: 'arquivo JSON',
    async ativosNaData(data) {
      return ler().filter((a) => a.data === data && a.status === 'confirmado');
    },
    async listar(aPartirDe) {
      return ler()
        .filter((a) => !aPartirDe || a.data >= aPartirDe)
        .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
    },
    criar(ag) {
      return exclusivo(() => {
        const lista = ler();
        const conflito = lista.some((a) => a.data === ag.data && a.status === 'confirmado' && sobrepoe(a, ag));
        if (conflito) throw new ConflitoHorario();
        const novo = { id: crypto.randomUUID(), status: 'confirmado', criadoEm: new Date().toISOString(), ...ag };
        lista.push(novo);
        gravar(lista);
        return novo;
      });
    },
    cancelar(id) {
      return exclusivo(() => {
        const lista = ler();
        const ag = lista.find((a) => a.id === id);
        if (!ag) return null;
        ag.status = 'cancelado';
        gravar(lista);
        return ag;
      });
    },
  };
}

// ---------------------------------------------------------------- Postgres
function criarStorePg(url) {
  const { Pool } = require('pg');
  const ssl = /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: url, ssl });

  const pronto = pool.query(`
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
  `);

  const paraObjeto = (r) => ({
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

  return {
    tipo: 'PostgreSQL',
    async ativosNaData(data) {
      await pronto;
      const { rows } = await pool.query(
        "SELECT * FROM agendamentos WHERE data = $1 AND status = 'confirmado'",
        [data]
      );
      return rows.map(paraObjeto);
    },
    async listar(aPartirDe) {
      await pronto;
      const { rows } = await pool.query(
        'SELECT * FROM agendamentos WHERE ($1::text IS NULL OR data >= $1) ORDER BY data, inicio',
        [aPartirDe || null]
      );
      return rows.map(paraObjeto);
    },
    async criar(ag) {
      await pronto;
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
        return paraObjeto(rows[0]);
      } catch (e) {
        await cliente.query('ROLLBACK');
        throw e;
      } finally {
        cliente.release();
      }
    },
    async cancelar(id) {
      await pronto;
      const { rows } = await pool.query(
        "UPDATE agendamentos SET status = 'cancelado' WHERE id = $1 RETURNING *",
        [id]
      );
      return rows[0] ? paraObjeto(rows[0]) : null;
    },
  };
}

module.exports = {
  criarStore() {
    if (process.env.DATABASE_URL) return criarStorePg(process.env.DATABASE_URL);
    return criarStoreJson(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'agendamentos.json'));
  },
};
