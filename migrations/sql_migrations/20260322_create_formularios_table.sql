CREATE TABLE IF NOT EXISTS formularios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reserva_id INT NOT NULL,
  tipo_formulario VARCHAR(50) NOT NULL,
  tipo_atendimento VARCHAR(50) NULL,
  usuario_id INT NULL,
  profissional_id INT NULL,
  conteudo LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_reserva (reserva_id),
  CONSTRAINT fk_formularios_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

