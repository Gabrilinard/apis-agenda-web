const { dbPromise } = require('../db');

const criar = async ({ usuario_id, reserva_id, mensagem }) => {
  await dbPromise.query(
    'INSERT INTO notificacoes_paciente (usuario_id, reserva_id, mensagem) VALUES (?, ?, ?)',
    [usuario_id, reserva_id || null, mensagem]
  );
};

const listarPorUsuario = async (usuario_id) => {
  const [rows] = await dbPromise.query(
    'SELECT * FROM notificacoes_paciente WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 20',
    [usuario_id]
  );
  return rows;
};

const marcarLidas = async (usuario_id) => {
  await dbPromise.query(
    'UPDATE notificacoes_paciente SET lida = 1 WHERE usuario_id = ? AND lida = 0',
    [usuario_id]
  );
};

module.exports = { criar, listarPorUsuario, marcarLidas };
