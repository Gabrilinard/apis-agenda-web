const { pool } = require('../db');

const upsertByReservaIds = (rows, cb) => {
  const sql = `
    INSERT INTO formularios
      (reserva_id, tipo_formulario, tipo_atendimento, usuario_id, profissional_id, conteudo)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      tipo_formulario = VALUES(tipo_formulario),
      tipo_atendimento = VALUES(tipo_atendimento),
      usuario_id = VALUES(usuario_id),
      profissional_id = VALUES(profissional_id),
      conteudo = VALUES(conteudo)
  `;

  pool.query(sql, [rows], cb);
};

const findByReservaId = (reservaId, cb) => {
  pool.query('SELECT * FROM formularios WHERE reserva_id = ? LIMIT 1', [reservaId], cb);
};

module.exports = {
  upsertByReservaIds,
  findByReservaId
};

