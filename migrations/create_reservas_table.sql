-- Script para criar a tabela reservas
-- Execute este script no banco de dados 'agendamento'

USE agendamento;

-- Cria tabela reservas
CREATE TABLE IF NOT EXISTS reservas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  sobrenome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  dia DATE NOT NULL,
  horario TIME NOT NULL,
  horarioFinal TIME NOT NULL,
  qntd_pessoa INT DEFAULT 1,
  usuario_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'pendente',
  motivoNegacao TEXT NULL,
  motivoFalta TEXT NULL,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_dia (dia),
  INDEX idx_status (status),
  FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Tabela reservas criada com sucesso!' AS message;

