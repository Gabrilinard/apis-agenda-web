-- Script para adicionar campos de localização na tabela usuario
-- Execute este script no banco de dados 'agendamento'

USE agendamento;

-- Adiciona coluna latitude
ALTER TABLE usuario 
ADD COLUMN latitude DECIMAL(10, 8) NULL;

-- Adiciona coluna longitude
ALTER TABLE usuario 
ADD COLUMN longitude DECIMAL(11, 8) NULL;

-- Adiciona coluna cidade
ALTER TABLE usuario 
ADD COLUMN cidade VARCHAR(100) NULL;

SELECT 'Campos de localização adicionados com sucesso!' AS message;

