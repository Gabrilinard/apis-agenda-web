const { dbPromise } = require('../db');

// Registra eventos sensíveis (login, cadastro, redefinição de senha, exclusão de
// conta) para permitir reconstruir "quem fez o quê, quando" em caso de incidente —
// rastreabilidade exigida pela LGPD para acesso a dado pessoal. usuario_id tem
// ON DELETE SET NULL: se a conta for excluída depois, o registro do evento
// permanece (só perde o vínculo com o id, que deixou de existir).
const registrar = async ({ usuarioId = null, evento, sucesso = true, ip = null, detalhe = null }) => {
  try {
    await dbPromise.query(
      'INSERT INTO log_acesso (usuario_id, evento, sucesso, ip, detalhe) VALUES (?, ?, ?, ?, ?)',
      [usuarioId, evento, sucesso ? 1 : 0, ip, detalhe]
    );
  } catch (e) {
    // Uma falha ao gravar o log não pode derrubar a requisição original (ex.: login
    // continua funcionando mesmo se a tabela de auditoria estiver indisponível).
    console.error('[auditModel.registrar]', e.message);
  }
};

module.exports = { registrar };
