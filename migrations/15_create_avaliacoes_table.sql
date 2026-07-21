-- Cria a tabela avaliacoes, usada pelas rotas /avaliacoes e pelo JOIN em
-- listPorCategoria (profissionaisModel.js) para calcular media/total de avaliacoes.
-- Essa tabela existia em producao mas nunca tinha sido versionada como migration.

CREATE TABLE IF NOT EXISTS avaliacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id INT NOT NULL,
  usuario_id INT NOT NULL,
  profissional_id INT NOT NULL,
  nota INT NOT NULL,
  comentario TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_reserva (reserva_id),
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE,
  FOREIGN KEY (profissional_id) REFERENCES usuario(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
