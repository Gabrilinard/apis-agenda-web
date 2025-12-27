-- Script para adicionar campos de profissional na tabela usuario
-- Execute este script no banco de dados 'agendamento'
-- Nota: Se as colunas já existirem, você receberá um erro. Nesse caso, ignore o erro.

USE agendamento;

-- Adiciona coluna tipoUsuario (cliente ou profissional)
-- Se a coluna já existir, você receberá um erro que pode ser ignorado
ALTER TABLE usuario 
ADD COLUMN tipoUsuario VARCHAR(20) DEFAULT 'cliente' 
AFTER senha;

-- Adiciona coluna fazParteEmpresa (boolean)
ALTER TABLE usuario 
ADD COLUMN fazParteEmpresa TINYINT(1) DEFAULT 0 
AFTER tipoUsuario;

-- Adiciona coluna nomeEmpresa (nome da academia/pilates)
ALTER TABLE usuario 
ADD COLUMN nomeEmpresa VARCHAR(255) NULL 
AFTER fazParteEmpresa;

-- Adiciona coluna tipoProfissional (personal, instrutor_pilates, fisioterapeuta)
ALTER TABLE usuario 
ADD COLUMN tipoProfissional VARCHAR(50) NULL 
AFTER nomeEmpresa;

-- Adiciona coluna profissaoCustomizada (para quando tipoProfissional for "outros")
ALTER TABLE usuario 
ADD COLUMN profissaoCustomizada VARCHAR(255) NULL 
AFTER tipoProfissional;

-- Adiciona coluna horarioTreino (horário do treino)
ALTER TABLE usuario 
ADD COLUMN horarioTreino TIME NULL 
AFTER profissaoCustomizada;

