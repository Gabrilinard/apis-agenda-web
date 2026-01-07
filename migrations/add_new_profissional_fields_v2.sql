-- Script para adicionar novos campos de profissional na tabela usuario
USE agendamento;

-- Adiciona coluna valorConsulta
ALTER TABLE usuario 
ADD COLUMN valorConsulta DECIMAL(10, 2) NULL;

-- Adiciona coluna diasAtendimento (armazenará array como string/JSON)
ALTER TABLE usuario 
ADD COLUMN diasAtendimento TEXT NULL;

-- Adiciona coluna horariosAtendimento (armazenará objeto como string/JSON)
ALTER TABLE usuario 
ADD COLUMN horariosAtendimento TEXT NULL;

SELECT 'Novos campos adicionados com sucesso!' AS message;
