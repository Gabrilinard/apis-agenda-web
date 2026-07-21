const { pool } = require('../db');

const DIACRITICOS_REGEX = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
const normalizar = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(DIACRITICOS_REGEX, '')
    .toLowerCase()
    .trim();

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

const ESPECIALIDADES_MEDICAS = [
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
const ESPECIALIDADES_MEDICAS_NORM = new Set(ESPECIALIDADES_MEDICAS.map(normalizar));

// tipoProfissional guarda, para médicos, a especialidade específica (ex: "Cardiologista")
// e, para as demais categorias, o slug da categoria (ex: "fisioterapeuta"). A comparação é
// feita normalizando acentos/caixa para tolerar variações vindas de telas antigas de edição.
const listPorCategoria = (categoria, cb) => {
  const categoriaNorm = normalizar(categoria);

  const query = `
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
      AND (u.empresa_id IS NULL OR u.empresa_id = 0)
    GROUP BY u.id
    ORDER BY u.nome ASC
  `;

  pool.query(query, (err, rows) => {
    if (err) return cb(err);

    const filtrados = rows.filter((row) => {
      const tipoNorm = normalizar(row.tipoProfissional);
      if (categoriaNorm === 'medico') return ESPECIALIDADES_MEDICAS_NORM.has(tipoNorm);
      return tipoNorm === categoriaNorm;
    });

    cb(null, filtrados);
  });
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

