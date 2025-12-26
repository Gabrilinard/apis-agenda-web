-- Script para criar tabela de empresas e associar com usuários
-- Execute este script no banco de dados 'agendamento'

USE agendamento;

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

-- Migra dados existentes: cria empresas a partir de nomeEmpresa e associa usuários
-- Primeiro verifica se a coluna nomeEmpresa existe antes de migrar
-- Se a coluna existir, migra os dados
INSERT INTO empresas (nome, usuario_criador_id)
SELECT DISTINCT nomeEmpresa, MIN(id) as primeiro_usuario_id
FROM usuario 
WHERE fazParteEmpresa = 1 
  AND nomeEmpresa IS NOT NULL 
  AND nomeEmpresa != ''
  AND NOT EXISTS (
    SELECT 1 FROM empresas WHERE empresas.nome = usuario.nomeEmpresa
  )
GROUP BY nomeEmpresa
HAVING COUNT(*) > 0;

-- Atualiza empresa_id nos usuários baseado no nomeEmpresa (se a coluna existir)
UPDATE usuario u
INNER JOIN empresas e ON u.nomeEmpresa = e.nome
SET u.empresa_id = e.id
WHERE u.fazParteEmpresa = 1 
  AND u.nomeEmpresa IS NOT NULL 
  AND u.nomeEmpresa != '';

