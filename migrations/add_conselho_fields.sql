-- Script para adicionar campos de número do conselho e UF/Região na tabela usuario
-- Execute este script no banco de dados 'agendamento'
-- Nota: Se as colunas já existirem, você receberá um erro. Nesse caso, ignore o erro.

USE agendamento;

-- Adiciona coluna numeroConselho
ALTER TABLE usuario 
ADD COLUMN numeroConselho VARCHAR(20) NULL 
AFTER profissaoCustomizada;

-- Adiciona coluna ufRegiao
ALTER TABLE usuario 
ADD COLUMN ufRegiao VARCHAR(2) NULL 
AFTER numeroConselho;

SELECT 'Campos numeroConselho e ufRegiao adicionados com sucesso!' AS message;

