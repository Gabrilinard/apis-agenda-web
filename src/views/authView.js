const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { dbPromise, pool } = require('../db');
const usuariosModel = require('../models/usuariosModel');
const { serializeLogin } = require('../serializers/authSerializer');
const { emailRedefinicaoSenha } = require('../email');
const { GENEROS_VALIDOS } = require('../utils/titulo');

const router = express.Router();

router.post('/register', async (req, res) => {
  const {
    nome,
    sobrenome,
    telefone,
    email,
    senha,
    cpf,
    genero,
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
    valorPresencial,
    valorOnline,
    valorDomiciliar,
    diasAtendimento,
    horariosAtendimento
  } = req.body;

  if (!nome || !sobrenome || !email || !senha || !cpf) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
  }

  if (genero && !GENEROS_VALIDOS.includes(genero)) {
    return res.status(400).json({ error: 'Gênero inválido.' });
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

  const existingUserByCpf = await usuariosModel.findFullByCpf(cpfLimpo);
  let upgradeUserId = null;

  if (existingUserByCpf) {
    const mesmoEmail = existingUserByCpf.email.toLowerCase() === String(email).toLowerCase();
    const senhaConfere = mesmoEmail && (await bcrypt.compare(senha, existingUserByCpf.senha));
    const podeVirarProfissional =
      tipoUsuario === 'profissional' && existingUserByCpf.tipoUsuario === 'paciente' && mesmoEmail && senhaConfere;

    if (!podeVirarProfissional) {
      return res.status(409).json({ error: 'Já existe um usuário cadastrado com esses dados.' });
    }
    upgradeUserId = existingUserByCpf.id;
  }

  if (!upgradeUserId) {
    const emailJaExiste = await usuariosModel.emailExists(email);
    if (emailJaExiste) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.', field: 'email' });
    }
  }

  if (tipoUsuario === 'profissional') {
    if (!tipoProfissional) {
      return res.status(400).json({ error: 'Tipo de profissional é obrigatório.' });
    }
    const tiposValidos = ['medico', 'dentista', 'nutricionista', 'fisioterapeuta', 'fonoaudiologo', 'psicologo', 'outros'];
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

    const conselhoTrimmed = numeroConselho.trim();

    const formatosConselho = {
      medico:        { regex: /^CRM\/[A-Z]{2} \d{4,6}$/i,          exemplo: 'CRM/PI 425041' },
      dentista:      { regex: /^CRO\/[A-Z]{2} \d{4,6}$/i,          exemplo: 'CRO/SP 12345' },
      nutricionista: { regex: /^CRN-[1-9] \d{4,5}$/,               exemplo: 'CRN-3 12345' },
      fisioterapeuta:{ regex: /^CREFITO-\d{1,2}\/\d{4,6}-[FT]$/i,  exemplo: 'CREFITO-8/123456-F' },
      fonoaudiologo: { regex: /^CRFa\/[A-Z]{2} \d{4,5}$/i,         exemplo: 'CRFa/SP 12345' },
      psicologo:     { regex: /^CRP \d{2}\/\d{4,6}$/,              exemplo: 'CRP 06/12345' },
    };

    const formato = formatosConselho[tipoProfissional];
    if (formato) {
      if (!formato.regex.test(conselhoTrimmed)) {
        return res.status(400).json({
          error: `Número do conselho inválido. Formato esperado: ${formato.exemplo}`,
        });
      }
    } else if (!/^[A-Za-z0-9 \\/\-]{3,20}$/.test(conselhoTrimmed)) {
      return res.status(400).json({ error: 'Número do conselho inválido.' });
    }

    const conselhoJaExiste = await usuariosModel.numeroConselhoExists(conselhoTrimmed);
    if (conselhoJaExiste) {
      return res.status(409).json({ error: 'Este número de conselho já está cadastrado.', field: 'numeroConselho' });
    }
    if (!ufRegiao || !ufRegiao.trim()) {
      return res.status(400).json({ error: 'UF/Região é obrigatória para profissionais.' });
    }
  }

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);

    if (upgradeUserId) {
      const fields = ['nome = ?', 'sobrenome = ?', 'telefone = ?', 'senha = ?', 'tipoUsuario = ?'];
      const values = [nome, sobrenome, telefone, hashedPassword, 'profissional'];

      if (genero) { fields.push('genero = ?'); values.push(genero); }

      const tipoProfissionalFinal =
        tipoProfissional === 'medico' ? especialidadeMedica : tipoProfissional === 'outros' ? profissaoCustomizada : tipoProfissional;
      fields.push('tipoProfissional = ?'); values.push(tipoProfissionalFinal);
      fields.push('numeroConselho = ?'); values.push(numeroConselho.trim());
      fields.push('ufRegiao = ?'); values.push(ufRegiao.trim());
      if (cidade) { fields.push('cidade = ?'); values.push(cidade.trim()); }
      if (latitude) { fields.push('latitude = ?'); values.push(latitude); }
      if (longitude) { fields.push('longitude = ?'); values.push(longitude); }
      if (descricao) { fields.push('descricao = ?'); values.push(descricao.trim()); }
      if (publicoAtendido) { fields.push('publicoAtendido = ?'); values.push(publicoAtendido.trim()); }
      if (modalidade) { fields.push('modalidade = ?'); values.push(modalidade.trim()); }
      if (valorConsulta) { fields.push('valorConsulta = ?'); values.push(valorConsulta); }
      if (valorPresencial) { fields.push('valorPresencial = ?'); values.push(valorPresencial); }
      if (valorOnline) { fields.push('valorOnline = ?'); values.push(valorOnline); }
      if (valorDomiciliar) { fields.push('valorDomiciliar = ?'); values.push(valorDomiciliar); }
      if (diasAtendimento) {
        fields.push('diasAtendimento = ?');
        values.push(typeof diasAtendimento === 'object' ? JSON.stringify(diasAtendimento) : diasAtendimento);
      }
      if (horariosAtendimento) {
        fields.push('horariosAtendimento = ?');
        values.push(typeof horariosAtendimento === 'object' ? JSON.stringify(horariosAtendimento) : horariosAtendimento);
      }

      values.push(upgradeUserId);
      pool.query(`UPDATE usuario SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
        if (err) return res.status(400).json({ error: `Erro ao atualizar conta: ${err.sqlMessage}` });
        res.json({ message: 'Conta atualizada para profissional com sucesso!', id: upgradeUserId });
      });
      return;
    }

    let query = 'INSERT INTO usuario (nome, sobrenome, telefone, email, senha, cpf';
    const values = [nome, sobrenome, telefone, email, hashedPassword, cpfLimpo];
    let placeholders = '?, ?, ?, ?, ?, ?';

    query += ', tipoUsuario';
    placeholders += ', ?';
    values.push(tipoUsuario || 'paciente');

    if (genero) {
      query += ', genero';
      placeholders += ', ?';
      values.push(genero);
    }

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

      if (valorPresencial) {
        query += ', valorPresencial';
        placeholders += ', ?';
        values.push(valorPresencial);
      }

      if (valorOnline) {
        query += ', valorOnline';
        placeholders += ', ?';
        values.push(valorOnline);
      }

      if (valorDomiciliar) {
        query += ', valorDomiciliar';
        placeholders += ', ?';
        values.push(valorDomiciliar);
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

router.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await usuariosModel.findByEmail(email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await usuariosModel.createResetToken(user.id, token);
      await emailRedefinicaoSenha({ userEmail: user.email, userName: user.nome, token });
    }
    // Sempre retorna sucesso para não revelar se o e-mail existe
    return res.json({ message: 'Se o e-mail estiver cadastrado, você receberá o link em breve.' });
  } catch (err) {
    console.error('[forgot-password]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

router.patch('/api/reset-password', async (req, res) => {
  const { token, senha } = req.body;
  if (!token || !senha) return res.status(400).json({ error: 'Dados inválidos.' });
  try {
    const tokenRow = await usuariosModel.findResetToken(token);
    if (!tokenRow) return res.status(400).json({ error: 'Link inválido ou expirado.' });
    const hashedPassword = await bcrypt.hash(senha, 10);
    await usuariosModel.updatePasswordAsync(tokenRow.user_id, hashedPassword);
    await usuariosModel.deleteResetToken(token);
    return res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    console.error('[reset-password]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;

