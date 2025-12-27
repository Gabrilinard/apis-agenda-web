-- Script para adicionar campo profissional_id na tabela reservas
-- Execute este script no banco de dados 'agendamento'

USE agendamento;

-- Adiciona coluna profissional_id
ALTER TABLE reservas 
ADD COLUMN profissional_id INT NULL 
AFTER usuario_id;

-- Adiciona índice para melhor performance
ALTER TABLE reservas 
ADD INDEX idx_profissional_id (profissional_id);

-- Adiciona foreign key (opcional, pode comentar se houver problemas)
-- ALTER TABLE reservas 
-- ADD CONSTRAINT fk_reservas_profissional 
-- FOREIGN KEY (profissional_id) REFERENCES usuario(id) ON DELETE SET NULL;

SELECT 'Campo profissional_id adicionado com sucesso!' AS message;

