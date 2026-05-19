CREATE TABLE IF NOT EXISTS notificacoes_vaga (
  id INT AUTO_INCREMENT PRIMARY KEY,
  profissional_id INT NOT NULL,
  reserva_liberada_id INT,
  dia VARCHAR(20) NOT NULL,
  horario VARCHAR(10) NOT NULL,
  horarioFinal VARCHAR(10),
  usuario_notificado_id INT NOT NULL,
  reserva_candidato_id INT,
  status VARCHAR(20) DEFAULT 'pendente',
  token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
