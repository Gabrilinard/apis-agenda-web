-- Script para corrigir o DEFAULT de tipoUsuario de 'cliente' para 'paciente'
-- Execute este script no banco de dados 'agendamento'

USE agendamento;

-- Altera o DEFAULT da coluna tipoUsuario de 'cliente' para 'paciente'
ALTER TABLE usuario 
MODIFY COLUMN tipoUsuario VARCHAR(20) DEFAULT 'paciente';

-- Atualiza todos os registros que estão como 'cliente' para 'paciente'
UPDATE usuario 
SET tipoUsuario = 'paciente' 
WHERE tipoUsuario = 'cliente' AND tipoProfissional IS NULL AND numeroConselho IS NULL AND ufRegiao IS NULL;

SELECT 'DEFAULT de tipoUsuario corrigido para "paciente"!' AS message;

