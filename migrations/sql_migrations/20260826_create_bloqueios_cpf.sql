-- Guarda o bloqueio por faltas vinculado ao CPF, não só ao id do usuário.
-- Isso evita que alguém escape do bloqueio de 60 dias excluindo a conta e se
-- cadastrando de novo com o mesmo CPF.
CREATE TABLE IF NOT EXISTS bloqueios_cpf (
  cpf VARCHAR(11) NOT NULL PRIMARY KEY,
  bloqueado_ate DATETIME NOT NULL,
  motivo_bloqueio VARCHAR(255) NULL,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
