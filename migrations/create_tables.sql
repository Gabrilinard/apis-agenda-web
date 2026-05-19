-- Criar banco de dados
CREATE DATABASE IF NOT EXISTS agendamento;
USE agendamento;

-- Remover tabelas existentes se necessário
DROP TABLE IF EXISTS reset_tokens;
DROP TABLE IF EXISTS reservas;
DROP TABLE IF EXISTS usuario;

-- Criar tabela usuario
CREATE TABLE usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    sobrenome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE,
    tipoUsuario ENUM('paciente', 'profissional') DEFAULT 'paciente',
    tipoProfissional VARCHAR(255),
    especialidadeMedica VARCHAR(255),
    profissaoCustomizada VARCHAR(255),
    numeroConselho VARCHAR(50),
    ufRegiao VARCHAR(2),
    cidade VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    descricao TEXT,
    publicoAtendido VARCHAR(100),
    modalidade VARCHAR(100),
    empresa_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Criar tabela reservas
CREATE TABLE reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255),
    sobrenome VARCHAR(255),
    email VARCHAR(255),
    telefone VARCHAR(20),
    dia VARCHAR(255),
    horario VARCHAR(10),
    horarioFinal VARCHAR(10),
    qntd_pessoa INT NOT NULL,
    usuario_id INT NOT NULL,
    profissional_id INT,
    status ENUM('pendente', 'confirmado', 'negado', 'ausente') DEFAULT 'pendente',
    motivoNegacao TEXT,
    motivoFalta TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (profissional_id) REFERENCES usuario(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE INDEX idx_usuario_email ON usuario(email);
CREATE INDEX idx_usuario_cpf ON usuario(cpf);
CREATE INDEX idx_usuario_tipoUsuario ON usuario(tipoUsuario);
CREATE INDEX idx_reservas_usuario_id ON reservas(usuario_id);
CREATE INDEX idx_reservas_profissional_id ON reservas(profissional_id);
CREATE INDEX idx_reservas_status ON reservas(status);
CREATE INDEX idx_reservas_dia ON reservas(dia);

