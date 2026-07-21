-- Permite que uma conta profissional (que fez upgrade de paciente) continue
-- podendo acessar o modo paciente, sem duplicar cadastro.
ALTER TABLE usuario
ADD COLUMN temAcessoPaciente TINYINT(1) NOT NULL DEFAULT 0;

SELECT 'Coluna temAcessoPaciente adicionada!' AS message;
