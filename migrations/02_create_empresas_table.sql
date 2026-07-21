-- Script para criar tabela de empresas e associar com usuários
-- Execute este script no banco de dados 'railway'

USE railway;

-- Cria tabela empresas
CREATE TABLE IF NOT EXISTS empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  usuario_criador_id INT NOT NULL,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_nome (nome),
  FOREIGN KEY (usuario_criador_id) REFERENCES usuario(id) ON DELETE CASCADE,
  INDEX idx_nome (nome)
);

ALTER TABLE usuario 
ADD COLUMN empresa_id INT NULL;

ALTER TABLE usuario
ADD CONSTRAINT fk_usuario_empresa
FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL;

-- A migração dos dados de nomeEmpresa/fazParteEmpresa para a tabela empresas
-- foi movida para 14_migrate_empresa_data.sql, pois essas colunas só existem
-- a partir da migração 05_add_profissional_fields.sql (que roda depois desta).
