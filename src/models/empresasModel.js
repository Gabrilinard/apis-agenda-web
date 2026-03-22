const { pool } = require('../db');

const listEmpresas = (cb) => {
  const query = `
    SELECT 
      e.id,
      e.nome as nomeEmpresa,
      COUNT(DISTINCT u.id) as quantidadeProfissionais,
      GROUP_CONCAT(DISTINCT CONCAT(u.nome, ' ', u.sobrenome) SEPARATOR ', ') as nomesProfissionais,
      GROUP_CONCAT(DISTINCT u.tipoProfissional) as tiposProfissionais
    FROM empresas e
    LEFT JOIN usuario u ON u.empresa_id = e.id
    GROUP BY e.id, e.nome
    ORDER BY e.nome ASC
  `;
  pool.query(query, cb);
};

const listEmpresasFallback = (cb) => {
  const fallbackQuery = `
    SELECT DISTINCT nomeEmpresa, 
           COUNT(*) as quantidadeProfissionais,
           GROUP_CONCAT(DISTINCT tipoProfissional) as tiposProfissionais
    FROM usuario 
    WHERE fazParteEmpresa = 1 AND nomeEmpresa IS NOT NULL AND nomeEmpresa != ''
    GROUP BY nomeEmpresa
    ORDER BY nomeEmpresa ASC
  `;
  pool.query(fallbackQuery, cb);
};

module.exports = {
  listEmpresas,
  listEmpresasFallback
};

