ALTER TABLE reservas ADD COLUMN presenca_confirmada TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE reservas ADD COLUMN confirmacao_presenca_enviada TINYINT(1) NOT NULL DEFAULT 0;
