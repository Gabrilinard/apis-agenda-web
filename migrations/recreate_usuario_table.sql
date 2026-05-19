-- Script para excluir e recriar a tabela usuario
-- ATENÇÃO: Este script irá APAGAR TODOS OS DADOS da tabela usuario
-- Execute este script no banco de dados 'agendamento'

USE agendamento;

-- Remove foreign keys que dependem da tabela usuario
SET FOREIGN_KEY_CHECKS = 0;

-- Remove foreign key de empresas para usuario (se existir)
ALTER TABLE empresas DROP FOREIGN KEY IF EXISTS empresas_ibfk_1;

-- Remove foreign key de usuario para empresas (se existir)
ALTER TABLE usuario DROP FOREIGN KEY IF EXISTS fk_usuario_empresa;

-- Remove foreign key de reservas para usuario (se existir)
ALTER TABLE reservas DROP FOREIGN KEY IF EXISTS reservas_ibfk_1;

-- Exclui a tabela usuario
DROP TABLE IF EXISTS usuario;

-- Recria a tabela usuario com todos os campos necessários
CREATE TABLE usuario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  sobrenome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  tipoUsuario VARCHAR(20) DEFAULT 'cliente',
  fazParteEmpresa TINYINT(1) DEFAULT 0,
  nomeEmpresa VARCHAR(255) NULL,
  tipoProfissional VARCHAR(50) NULL,
  profissaoCustomizada VARCHAR(255) NULL,
  empresa_id INT NULL,
  INDEX idx_email (email),
  INDEX idx_tipoUsuario (tipoUsuario),
  INDEX idx_empresa_id (empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recria foreign key de usuario para empresas (se a tabela empresas existir)
-- Tenta criar a foreign key, se a tabela não existir, o erro será ignorado
ALTER TABLE usuario ADD CONSTRAINT fk_usuario_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL;

-- Recria foreign key de empresas para usuario (se a tabela empresas existir)
-- Tenta criar a foreign key, se a tabela não existir, o erro será ignorado
ALTER TABLE empresas ADD CONSTRAINT empresas_ibfk_1 FOREIGN KEY (usuario_criador_id) REFERENCES usuario(id) ON DELETE CASCADE;

-- Recria foreign key de reservas para usuario (se a tabela reservas existir)
-- Tenta criar a foreign key, se a tabela não existir, o erro será ignorado
ALTER TABLE reservas ADD CONSTRAINT reservas_ibfk_1 FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE;

-- Reabilita foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Tabela usuario recriada com sucesso!' AS message;

