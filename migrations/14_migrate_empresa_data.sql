-- Migra dados existentes: cria empresas a partir de nomeEmpresa e associa usuários.
-- Precisa rodar depois de 02_create_empresas_table.sql (cria tabela empresas /
-- coluna empresa_id) e 05_add_profissional_fields.sql (cria nomeEmpresa / fazParteEmpresa).

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

UPDATE usuario u
INNER JOIN empresas e ON u.nomeEmpresa = e.nome
SET u.empresa_id = e.id
WHERE u.fazParteEmpresa = 1
  AND u.nomeEmpresa IS NOT NULL
  AND u.nomeEmpresa != '';
