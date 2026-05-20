const { pool } = require('../db');

const listProfissionais = (cb) => {
  const query = `
    SELECT 
      u.id,
      u.nome,
      u.sobrenome,
      CONCAT(u.nome, ' ', u.sobrenome) as nomeCompleto,
      u.tipoProfissional,
      u.email,
      u.telefone
    FROM usuario u
    WHERE u.tipoUsuario = 'profissional' 
      AND (u.empresa_id IS NULL OR u.empresa_id = 0)
    ORDER BY u.nome ASC
  `;
  pool.query(query, cb);
};

const listPorCategoria = (categoria, cb) => {
  let query;
  let queryParams;

  if (categoria === 'medico') {
    const especialidadesMedicas = [
      'Clínico Geral',
      'Oftalmologista',
      'Cardiologista',
      'Dermatologista',
      'Pediatra',
      'Ginecologista',
      'Ortopedista',
      'Neurologista',
      'Psiquiatra',
      'Endocrinologista',
      'Gastroenterologista',
      'Urologista',
      'Otorrinolaringologista',
      'Pneumologista',
      'Reumatologista',
      'Oncologista',
      'Hematologista',
      'Nefrologista',
      'Anestesiologista',
      'Radiologista',
      'Patologista',
      'Medicina do Trabalho',
      'Medicina Esportiva',
      'Geriatra',
      'Mastologista',
      'Proctologista',
      'Angiologista',
      'Cirurgião Geral',
      'Cirurgião Plástico',
      'Cirurgião Cardiovascular',
      'Neurocirurgião',
      'Cirurgião Pediátrico'
    ];

    const placeholders = especialidadesMedicas.map(() => '?').join(', ');

    query = `
      SELECT
        u.id,
        CONCAT(u.nome, ' ', u.sobrenome) as nomeCompleto,
        u.tipoProfissional,
        u.email,
        u.telefone,
        u.ufRegiao,
        u.cidade,
        u.modalidade,
        u.publicoAtendido,
        u.valorConsulta,
        u.horariosAtendimento,
        u.diasAtendimento,
        u.descricao,
        ROUND(AVG(a.nota), 1) AS mediaAvaliacao,
        COUNT(a.id) AS totalAvaliacoes
      FROM usuario u
      LEFT JOIN avaliacoes a ON a.profissional_id = u.id
      WHERE u.tipoUsuario = 'profissional'
        AND u.tipoProfissional IN (${placeholders})
        AND (u.empresa_id IS NULL OR u.empresa_id = 0)
      GROUP BY u.id
      ORDER BY u.nome ASC
    `;
    queryParams = especialidadesMedicas;
  } else {
    query = `
      SELECT
        u.id,
        CONCAT(u.nome, ' ', u.sobrenome) as nomeCompleto,
        u.tipoProfissional,
        u.email,
        u.telefone,
        u.ufRegiao,
        u.cidade,
        u.modalidade,
        u.publicoAtendido,
        u.valorConsulta,
        u.horariosAtendimento,
        u.diasAtendimento,
        u.descricao,
        ROUND(AVG(a.nota), 1) AS mediaAvaliacao,
        COUNT(a.id) AS totalAvaliacoes
      FROM usuario u
      LEFT JOIN avaliacoes a ON a.profissional_id = u.id
      WHERE u.tipoUsuario = 'profissional'
        AND LOWER(u.tipoProfissional) = ?
        AND (u.empresa_id IS NULL OR u.empresa_id = 0)
      GROUP BY u.id
      ORDER BY u.nome ASC
    `;
    queryParams = [categoria];
  }

  pool.query(query, queryParams, cb);
};

const findIdByNomeSobrenome = async (dbPromise, nome, sobrenome) => {
  const query = 'SELECT id FROM usuario WHERE nome = ? AND sobrenome = ? AND tipoUsuario = ? LIMIT 1';
  const [rows] = await dbPromise.query(query, [nome, sobrenome, 'profissional']);
  return rows && rows[0] ? rows[0].id : null;
};

module.exports = {
  listProfissionais,
  listPorCategoria,
  findIdByNomeSobrenome
};

