const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { dbPromise, pool } = require('../db');
const usuariosModel = require('../models/usuariosModel');
const { serializeLogin } = require('../serializers/authSerializer');

const router = express.Router();

router.post('/register', async (req, res) => {
  const {
    nome,
    sobrenome,
    telefone,
    email,
    senha,
    cpf,
    tipoUsuario,
    tipoProfissional,
    especialidadeMedica,
    profissaoCustomizada,
    numeroConselho,
    ufRegiao,
    cidade,
    latitude,
    longitude,
    descricao,
    publicoAtendido,
    modalidade,
    valorConsulta,
    diasAtendimento,
    horariosAtendimento
  } = req.body;

  if (!nome || !sobrenome || !email || !senha || !cpf) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
  }

  const cpfLimpo = cpf.replace(/\D/g, '');
  if (cpfLimpo.length !== 11) {
    return res.status(400).json({ error: 'CPF deve conter 11 dígitos.' });
  }

  if (/^(\d)\1{10}$/.test(cpfLimpo)) {
    return res.status(400).json({ error: 'CPF inválido.' });
  }
  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.substring(9, 10))) {
    return res.status(400).json({ error: 'CPF inválido.' });
  }

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.substring(10, 11))) {
    return res.status(400).json({ error: 'CPF inválido.' });
  }

  const cpfJaExiste = await usuariosModel.cpfExists(cpfLimpo);
  if (cpfJaExiste) {
    return res.status(409).json({ error: 'Já existe um usuário cadastrado com esses dados.' });
  }

  const emailJaExiste = await usuariosModel.emailExists(email);
  if (emailJaExiste) {
    return res.status(409).json({ error: 'Este e-mail já está cadastrado.', field: 'email' });
  }

  if (tipoUsuario === 'profissional') {
    if (!tipoProfissional) {
      return res.status(400).json({ error: 'Tipo de profissional é obrigatório.' });
    }
    const tiposValidos = ['medico', 'dentista', 'nutricionista', 'fisioterapeuta', 'fonoaudiologo', 'outros'];
    if (!tiposValidos.includes(tipoProfissional)) {
      return res.status(400).json({ error: 'Tipo de profissional inválido.' });
    }
    if (tipoProfissional === 'medico' && (!especialidadeMedica || !especialidadeMedica.trim())) {
      return res.status(400).json({ error: 'Especialidade médica é obrigatória para médicos.' });
    }
    if (tipoProfissional === 'outros' && (!profissaoCustomizada || !profissaoCustomizada.trim())) {
      return res.status(400).json({ error: 'Profissão customizada é obrigatória quando selecionar "Outros".' });
    }
    if (!numeroConselho || !numeroConselho.trim()) {
      return res.status(400).json({ error: 'Número do conselho é obrigatório para profissionais.' });
    }

    const apenasNumeros = numeroConselho.replace(/\D/g, '');
    let regexConselho;
    let mensagemErro;

    switch (tipoProfissional) {
      case 'medico':
        regexConselho = /^CRM\s?\d{4,6}$/i;
        mensagemErro = 'Número do conselho inválido. Formato esperado: CRM 123456 (4 a 6 dígitos)';
        break;
      case 'dentista':
        regexConselho = /^CRO\s?\d{4,6}$/i;
        mensagemErro = 'Número do conselho inválido. Formato esperado: CRO 123456 (4 a 6 dígitos)';
        break;
      case 'nutricionista':
        regexConselho = /^CRN\s?\d{4,5}$/i;
        mensagemErro = 'Número do conselho inválido. Formato esperado: CRN 12345 (4 a 5 dígitos)';
        break;
      case 'fisioterapeuta':
        regexConselho = /^CREFITO\s?\d{4,6}$/i;
        mensagemErro = 'Número do conselho inválido. Formato esperado: CREFITO 123456 (4 a 6 dígitos)';
        break;
      case 'fonoaudiologo':
        regexConselho = /^CRFa\s?\d{4,5}$/i;
        mensagemErro = 'Número do conselho inválido. Formato esperado: CRFa 12345 (4 a 5 dígitos)';
        break;
      default:
        regexConselho = /^[A-Za-z0-9\s]{3,15}$/;
        mensagemErro = 'Número do conselho inválido. Deve conter entre 3 e 10 dígitos';
    }

    if (!regexConselho.test(numeroConselho.trim())) {
      return res.status(400).json({ error: mensagemErro });
    }

    if (tipoProfissional === 'medico' && (apenasNumeros.length < 4 || apenasNumeros.length > 6)) {
      return res.status(400).json({ error: 'CRM deve conter entre 4 e 6 dígitos' });
    }
    if (tipoProfissional === 'dentista' && (apenasNumeros.length < 4 || apenasNumeros.length > 6)) {
      return res.status(400).json({ error: 'CRO deve conter entre 4 e 6 dígitos' });
    }
    if (tipoProfissional === 'nutricionista' && (apenasNumeros.length < 4 || apenasNumeros.length > 5)) {
      return res.status(400).json({ error: 'CRN deve conter entre 4 e 5 dígitos' });
    }
    if (tipoProfissional === 'fisioterapeuta' && (apenasNumeros.length < 4 || apenasNumeros.length > 6)) {
      return res.status(400).json({ error: 'CREFITO deve conter entre 4 e 6 dígitos' });
    }
    if (tipoProfissional === 'fonoaudiologo' && (apenasNumeros.length < 4 || apenasNumeros.length > 5)) {
      return res.status(400).json({ error: 'CRFa deve conter entre 4 e 5 dígitos' });
    }
    if (!ufRegiao || !ufRegiao.trim()) {
      return res.status(400).json({ error: 'UF/Região é obrigatória para profissionais.' });
    }
  }

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);

    let query = 'INSERT INTO usuario (nome, sobrenome, telefone, email, senha, cpf';
    const values = [nome, sobrenome, telefone, email, hashedPassword, cpfLimpo];
    let placeholders = '?, ?, ?, ?, ?, ?';

    query += ', tipoUsuario';
    placeholders += ', ?';
    values.push(tipoUsuario || 'paciente');

    if (tipoUsuario === 'profissional') {
      query += ', tipoProfissional';
      placeholders += ', ?';

      const tipoProfissionalFinal =
        tipoProfissional === 'medico' ? especialidadeMedica : tipoProfissional === 'outros' ? profissaoCustomizada : tipoProfissional;
      values.push(tipoProfissionalFinal);

      query += ', numeroConselho';
      placeholders += ', ?';
      values.push(numeroConselho.trim());

      query += ', ufRegiao';
      placeholders += ', ?';
      values.push(ufRegiao.trim());

      if (cidade) {
        query += ', cidade';
        placeholders += ', ?';
        values.push(cidade.trim());
      }

      if (latitude) {
        query += ', latitude';
        placeholders += ', ?';
        values.push(latitude);
      }

      if (longitude) {
        query += ', longitude';
        placeholders += ', ?';
        values.push(longitude);
      }

      if (descricao) {
        query += ', descricao';
        placeholders += ', ?';
        values.push(descricao.trim());
      }

      if (publicoAtendido) {
        query += ', publicoAtendido';
        placeholders += ', ?';
        values.push(publicoAtendido.trim());
      }

      if (modalidade) {
        query += ', modalidade';
        placeholders += ', ?';
        values.push(modalidade.trim());
      }

      if (valorConsulta) {
        query += ', valorConsulta';
        placeholders += ', ?';
        values.push(valorConsulta);
      }

      if (diasAtendimento) {
        query += ', diasAtendimento';
        placeholders += ', ?';
        values.push(typeof diasAtendimento === 'object' ? JSON.stringify(diasAtendimento) : diasAtendimento);
      }

      if (horariosAtendimento) {
        query += ', horariosAtendimento';
        placeholders += ', ?';
        values.push(typeof horariosAtendimento === 'object' ? JSON.stringify(horariosAtendimento) : horariosAtendimento);
      }
    }

    query += ') VALUES (' + placeholders + ')';

    pool.query(query, values, (err, results) => {
      if (err) {
        if (tipoUsuario === 'profissional') {
          const query2 = 'INSERT INTO usuario (nome, sobrenome, telefone, email, senha, cpf, tipoUsuario) VALUES (?, ?, ?, ?, ?, ?, ?)';
          const values2 = [nome, sobrenome, telefone, email, hashedPassword, cpfLimpo, tipoUsuario || 'paciente'];
          pool.query(query2, values2, (err2, results2) => {
            if (err2) {
              return res.status(400).json({ error: `Erro ao registrar: ${err2.sqlMessage}` });
            }
            res.json({ message: 'Usuário registrado com sucesso!', id: results2.insertId });
          });
        } else {
          return res.status(400).json({ error: `Erro ao registrar: ${err.sqlMessage}` });
        }
      } else {
        const userId = results.insertId;
        res.json({ message: 'Usuário registrado com sucesso!', id: userId });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/login', (req, res) => {
  const { email, senha } = req.body;
  pool.query('SELECT * FROM usuario WHERE email = ?', [email], async (err, results) => {
    if (err || !results || results.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });

    const user = results[0];
    const senhaCorreta = await bcrypt.compare(senha, user.senha);
    if (!senhaCorreta) return res.status(401).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: '1h' });
    res.json(serializeLogin(user, token));
  });
});

router.get('/user/:id', (req, res) => {
  usuariosModel.findBasicById(req.params.id, (err, userRow) => {
    if (err || !userRow) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(userRow);
  });
});

router.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  usuariosModel.findIdByEmail(email, (err, row) => {
    if (err || !row) {
      return res.status(400).json({ error: 'Usuário não encontrado.' });
    }
    res.json({ userId: row.id });
  });
});

router.patch('/api/reset-password/:id', async (req, res) => {
  const { id } = req.params;
  const { senha } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    usuariosModel.updatePassword(id, hashedPassword, (err, result) => {
      if (err) return res.status(500).json({ message: 'Erro ao atualizar a senha.' });
      if (!result || result.affectedRows === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });
      return res.status(200).json({ message: 'Senha redefinida com sucesso.' });
    });
  } catch {
    return res.status(500).json({ message: 'Erro ao processar a senha.' });
  }
});

module.exports = router;

