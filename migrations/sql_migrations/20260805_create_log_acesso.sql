CREATE TABLE IF NOT EXISTS log_acesso (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  evento VARCHAR(50) NOT NULL,
  sucesso TINYINT(1) NOT NULL DEFAULT 1,
  ip VARCHAR(45) NULL,
  detalhe VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_log_acesso_usuario_id ON log_acesso(usuario_id);
CREATE INDEX idx_log_acesso_evento ON log_acesso(evento);
CREATE INDEX idx_log_acesso_created_at ON log_acesso(created_at);
