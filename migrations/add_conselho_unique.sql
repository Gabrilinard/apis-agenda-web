-- Aumenta o limite do campo e adiciona constraint de unicidade para numeroConselho
-- Execute no banco 'agendamento'. Se a constraint já existir, ignore o erro.

USE agendamento;

ALTER TABLE usuario
  MODIFY COLUMN numeroConselho VARCHAR(30) NULL;

ALTER TABLE usuario
  ADD CONSTRAINT uq_numero_conselho UNIQUE (numeroConselho);

SELECT 'Constraint de unicidade e VARCHAR(30) aplicados com sucesso!' AS message;
