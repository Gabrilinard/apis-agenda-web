-- Script para corrigir tipoUsuario de profissionais que foram cadastrados como cliente/paciente
-- Execute este script no banco de dados 'agendamento'

USE agendamento;

-- Atualiza todos os usuários que têm tipoProfissional, numeroConselho ou ufRegiao para 'profissional'
UPDATE usuario 
SET tipoUsuario = 'profissional' 
WHERE (tipoProfissional IS NOT NULL OR numeroConselho IS NOT NULL OR ufRegiao IS NOT NULL)
  AND tipoUsuario != 'profissional';

-- Ou atualizar um usuário específico por email:
-- UPDATE usuario SET tipoUsuario = 'profissional' WHERE email = 'louro@gmail.com';

SELECT 'tipoUsuario corrigido para profissionais!' AS message;

