/* eslint-env node */
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const fs = require('fs');
    const dir = 'uploads/';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, Date.now() + '-' + cleanFileName)
  }
})

const upload = multer({ storage: storage });

module.exports = db;

const dbCallback = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const dbPromise = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'REDACTED',
  database: 'agendamento',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

module.exports = { dbCallback, dbPromise };

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

db.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
    console.log('Servidor continuará rodando, mas operações de banco podem falhar.');
  } else {
    console.log('Banco conectado!');
  }
});

app.post('/register', async (req, res) => {
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

    // Verifica se CPF já existe
    const [cpfExists] = await dbPromise.query('SELECT id FROM usuario WHERE cpf = ?', [cpfLimpo]);
    if (cpfExists.length > 0) {
      return res.status(400).json({ error: 'CPF já cadastrado.' });
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
      let values = [nome, sobrenome, telefone, email, hashedPassword, cpfLimpo];
      let placeholders = '?, ?, ?, ?, ?, ?';

      query += ', tipoUsuario';
      placeholders += ', ?';
      values.push(tipoUsuario || 'paciente');

      if (tipoUsuario === 'profissional') {
        query += ', tipoProfissional';
        placeholders += ', ?';

        const tipoProfissionalFinal = tipoProfissional === 'medico' 
          ? especialidadeMedica 
          : (tipoProfissional === 'outros' ? profissaoCustomizada : tipoProfissional);
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
          // Se for array, converte para string/JSON
          values.push(typeof diasAtendimento === 'object' ? JSON.stringify(diasAtendimento) : diasAtendimento);
        }

        if (horariosAtendimento) {
          query += ', horariosAtendimento';
          placeholders += ', ?';
          // Se for objeto, converte para string/JSON
          values.push(typeof horariosAtendimento === 'object' ? JSON.stringify(horariosAtendimento) : horariosAtendimento);
        }
      }

      query += `) VALUES (${placeholders})`;

      console.log('=== EXECUTANDO QUERY ===');
      console.log('Query:', query);
      console.log('Values:', values);

      db.query(query, values, async (err, results) => {
        if (err) {
          console.error('=== ERRO AO REGISTRAR ===');
          console.error('Erro completo:', err);
          console.error('Código do erro:', err.code);
          console.error('Mensagem do erro:', err.sqlMessage);
          if (err.code === 'ER_BAD_FIELD_ERROR') {
            console.log('Colunas de profissional não existem, inserindo apenas campos básicos...');
            db.query(
              'INSERT INTO usuario (nome, sobrenome, telefone, email, senha) VALUES (?, ?, ?, ?, ?)',
              [nome, sobrenome, telefone, email, hashedPassword],
              (err2, results2) => {
                if (err2) {
                  console.error('Erro ao registrar (fallback):', err2);
                  return res.status(400).json({ error: `Erro ao registrar: ${err2.sqlMessage}` });
                }
                console.log('Usuário registrado com sucesso (sem campos profissionais)', results2);
                console.log('ID inserido:', results2.insertId);
                res.json({ message: 'Usuário registrado com sucesso!', id: results2.insertId });
              }
            );
          } else {
            return res.status(400).json({ error: `Erro ao registrar: ${err.sqlMessage}` });
          }
        } else {
          const userId = results.insertId;
          console.log('=== USUÁRIO CRIADO COM SUCESSO ===');
          console.log('ID do usuário criado:', userId);
          console.log('Resultados:', results);
          
          res.json({ message: 'Usuário registrado com sucesso!', id: userId });
        }
      });
    } catch (error) {
      console.error('Erro no servidor:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });


app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  db.query('SELECT * FROM usuario WHERE email = ?', [email], async (err, results) => {
    if (err || results.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });

    const user = results[0];
    const senhaCorreta = await bcrypt.compare(senha, user.senha);

    if (!senhaCorreta) return res.status(401).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id }, 'secreto', { expiresIn: '1h' });

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        nome: user.nome, 
        sobrenome: user.sobrenome, 
        telefone: user.telefone,
        email: user.email,
        tipoUsuario: user.tipoUsuario || 'paciente'
      } 
    });
  });
})

app.get('/user/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT id, nome, email, tipoUsuario FROM usuario WHERE id = ?', [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(results[0]);
  });
});

app.post('/reservas', upload.single('arquivo_urgencia'), async (req, res) => {
    console.log('Body:', req.body); 
    if (req.file) {
      console.log('Arquivo recebido:', req.file);
    }
  
    const { nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id, nomeProfissional, profissional_id, status, is_urgente, descricao_urgencia } = req.body;

    const arquivo_urgencia = req.file ? `/uploads/${req.file.filename}` : null;
    const isUrgenteBoolean = is_urgente === 'true' || is_urgente === true;

    let profissionalIdFinal = profissional_id || null;
    
    if (!profissionalIdFinal && nomeProfissional) {
      try {
        const partes = nomeProfissional.trim().split(' ');
        const nomeProf = partes[0] || '';
        const sobrenomeProf = partes.slice(1).join(' ') || '';
        
        console.log('Buscando profissional:', { nomeProfissional, nomeProf, sobrenomeProf });
        
        const profissionalQuery = 'SELECT id FROM usuario WHERE nome = ? AND sobrenome = ? AND tipoUsuario = ? LIMIT 1';
        const profResults = await new Promise((resolve, reject) => {
          db.query(profissionalQuery, [nomeProf, sobrenomeProf, 'profissional'], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
        
        if (profResults.length > 0) {
          profissionalIdFinal = profResults[0].id;
          console.log('Profissional encontrado com ID:', profissionalIdFinal);
        } else {
          console.log('Profissional não encontrado no banco de dados');
        }
      } catch (err) {
        console.error('Erro ao buscar profissional:', err);
      }
    }
    
    console.log('Criando reserva com profissional_id:', profissionalIdFinal);
    const statusFinal = status || 'pendente'; // Se não vier status, usa 'pendente' como padrão
    
    const sql = 'INSERT INTO reservas (nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id, profissional_id, status, is_urgente, descricao_urgencia, arquivo_urgencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [nome, sobrenome, telefone, email, dia, horario, horarioFinal, qntd_pessoa, usuario_id, profissionalIdFinal, statusFinal, isUrgenteBoolean, descricao_urgencia, arquivo_urgencia], (err, result) => {
        if (err) {
            console.error('Erro ao inserir no banco de dados:', err);
            return res.status(500).json({ error: 'Erro ao processar a reserva.' });
        }
        console.log('Reserva criada com sucesso, ID:', result.insertId, 'profissional_id:', profissionalIdFinal);
        res.json({ success: true, id: result.insertId });
    });
});

  
  app.get('/reservas/:id', (req, res) => {
    const userId = req.params.id;
    db.query('SELECT * FROM reservas WHERE usuario_id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});
  
  app.delete('/reservas', (req, res) => {
    const { usuario, horario, dia } = req.body;  

    console.error('Usuário:', usuario, 'Horário:', horario, 'Dia:', dia);

    if (!usuario || !horario || !dia) {
        return res.status(400).json({ error: 'Usuário, horário e dia são obrigatórios.' });
    }

    const query = 'DELETE FROM reservas WHERE usuario_id = ? AND horario = ? AND dia = ?';

    db.query(query, [usuario, horario, dia], (err, result) => {
        if (err) {
            console.error('Erro ao remover a reserva:', err);
            return res.status(500).json({ error: 'Erro ao remover a reserva.' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Nenhuma reserva encontrada para este usuário, horário e dia.' });
        }

        res.status(200).json({ message: 'Reserva removida com sucesso.' });
    });
});

app.get('/reservas', (req, res) => {
    const { profissional_id, usuario_id } = req.query;
    
    let query = 'SELECT * FROM reservas';
    let queryParams = [];
    let whereConditions = [];
    
    if (usuario_id) {
      whereConditions.push('usuario_id = ?');
      queryParams.push(usuario_id);
    }
    
    if (profissional_id) {
      whereConditions.push('profissional_id = ?');
      queryParams.push(profissional_id);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    if (usuario_id && profissional_id) {
      console.log(`Filtrando reservas por usuario_id: ${usuario_id} e profissional_id: ${profissional_id}`);
    } else if (profissional_id) {
      console.log('Filtrando reservas por profissional_id:', profissional_id);
    } else if (usuario_id) {
      console.log('Filtrando reservas por usuario_id:', usuario_id);
    } else {
      console.log('Buscando todas as reservas (sem filtro)');
    }
    
    db.query(query, queryParams, (err, results) => {
      if (err) {
        console.error('Erro ao buscar reservas:', err);
        return res.status(500).json(err);
      }
      console.log(`Retornando ${results.length} reservas`);
      res.json(results);
    });
  });
  

  app.patch('/reservas/:id', (req, res) => {
    const agendamentoId = req.params.id;
    const { status, dia, horario, horarioFinal } = req.body; 
    
    const updates = [];
    const values = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (dia !== undefined) {
      updates.push('dia = ?');
      values.push(dia);
    }

    if (horario !== undefined) {
      updates.push('horario = ?');
      values.push(horario);
    }

    if (horarioFinal !== undefined) {
      updates.push('horarioFinal = ?');
      values.push(horarioFinal);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }
  
    values.push(agendamentoId);
    const query = `UPDATE reservas SET ${updates.join(', ')} WHERE id = ?`;
  
    db.query(query, values, (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao atualizar a reserva', details: err });
      }
  
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: 'Reserva não encontrada' });
      }
  
      res.status(200).json({ message: 'Reserva atualizada com sucesso' });
    });
  });
  
  app.put('/reservas/:id', async (req, res) => {
    const { id } = req.params; 
    const { dia, horario, qntd_pessoa } = req.body; 
  
    try {
      const [reservas] = await dbPromise.query('SELECT * FROM reservas WHERE id = ?', [id]);
  
      if (reservas.length === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }
  
      const [result] = await dbPromise.query(
        'UPDATE reservas SET dia = ?, horario = ?, qntd_pessoa = ? WHERE id = ?',
        [dia, horario, qntd_pessoa, id]
      );
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada ou nenhum dado alterado' });
      }
  
      res.status(200).json({ message: 'Reserva atualizada com sucesso!' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar a reserva' });
    }
  });
  

  app.delete('/reservas/:id', (req, res) => {
    const { id } = req.params;
  
    const sql = 'DELETE FROM reservas WHERE id = ?';
    db.query(sql, [id], (err, result) => {
      if (err) {
        console.error('Erro ao excluir reserva:', err);
        return res.status(500).json({ error: 'Erro ao excluir reserva' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Reserva não encontrada ou não pertence a este usuário' });
      }
      res.json({ message: 'Reserva removida com sucesso!' });
    });
  });

  app.put('/reservas/solicitar/:id', (req, res) => {
    const reservaId = req.params.id;
    const { motivoFalta } = req.body; 
    const novoStatus = 'ausente';

    const sql = 'UPDATE reservas SET status = ?, motivoFalta = ? WHERE id = ?';
    db.query(sql, [novoStatus, motivoFalta, reservaId], (err, result) => {
        if (err) {
            console.error('Erro ao atualizar status:', err);
            return res.status(500).json({ success: false, message: 'Erro ao atualizar status' });
        }

        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Status atualizado para ausente e motivo registrado' });
        } else {
            res.status(404).json({ success: false, message: 'Reserva não encontrada' });
        }
    });
});

  

app.get('/reservas/extra', (req, res) => {
    const query = `
        SELECT 
            reservas.id, 
            reservas.dia, 
            reservas.horario, 
            usuario.nome, 
            usuario.sobrenome, 
            usuario.email 
        FROM reservas
        JOIN usuario ON reservas.usuario_id = usuario.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Erro ao buscar reservas:', err);
            return res.status(500).json({ error: 'Erro interno do servidor' });
        }
        res.json(results);
    });
});

app.patch('/reservas/negado/:id', async (req, res) => {
    const { status, motivoNegacao } = req.body;
    const reservaId = req.params.id;
    console.log(req.body, req.params.id);

    let sql = `UPDATE reservas SET status = ? ${status === 'negado' ? ', motivoNegacao = ?' : ', motivoNegacao = NULL'} WHERE id = ?`;
    let params = status === 'negado' ? [status, motivoNegacao, reservaId] : [status, reservaId];

    db.query(sql, params, (err) => {
        if (err) {
            console.error("Erro ao atualizar reserva:", err);
            return res.status(500).json({ error: "Erro ao atualizar reserva" });
        }
        res.json({ message: "Reserva atualizada com sucesso!" });
    });
});

app.patch('/reservas/editar/:id', async (req, res) => {
    const { id } = req.params;
    const { dia, horario, horarioFinal, qntd_pessoa } = req.body;

    try {
        await dbPromise.query(
            'UPDATE reservas SET dia = ?, horario = ?, horarioFinal = ?, qntd_pessoa = ?, status = ? WHERE id = ?',
            [dia, horario, horarioFinal, qntd_pessoa, 'pendente', id]
        );
        res.status(200).json({ message: 'Reserva editada e aguardando confirmação do professor!' });
    } catch (error) {
        console.error('Erro ao atualizar reserva:', error);
        res.status(500).json({ error: 'Erro ao atualizar reserva' });
    }
});

app.get('/usuarios/logados', (req, res) => {
  const query = `
    SELECT DISTINCT 
      u.id, 
      u.nome, 
      u.sobrenome, 
      u.telefone, 
      u.email 
    FROM usuario u
    INNER JOIN reservas r ON u.id = r.usuario_id
    ORDER BY u.nome ASC;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao buscar usuários logados');
    }

    res.json(results);
  });
});

app.get('/usuarios/solicitarDados/:id', (req, res) => {
  const userId = req.params.id; 
  console.log('ID do usuário recebido:', userId); 

  const query = 'SELECT id, nome, sobrenome, email, telefone, latitude, longitude, cidade, ufRegiao, descricao, publicoAtendido, modalidade, valorConsulta, diasAtendimento, horariosAtendimento FROM usuario WHERE id = ?';
  
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar usuário logado pelo ID:', err);
      return res.status(500).send('Erro ao buscar dados do usuário logado');
    }

    if (results.length === 0) {
      return res.status(404).send('Usuário não encontrado ou não está logado');
    }

    res.json(results[0]); 
  });
});

app.get('/usuarios/buscarPorCPF/:cpf', (req, res) => {
  const cpf = req.params.cpf.replace(/\D/g, '');
  console.log('CPF recebido para busca:', cpf);

  if (cpf.length !== 11) {
    return res.status(400).json({ error: 'CPF deve conter 11 dígitos.' });
  }

  const query = 'SELECT id, nome, sobrenome, email, telefone, cpf FROM usuario WHERE cpf = ?';
  
  db.query(query, [cpf], (err, results) => {
    if (err) {
      console.error('Erro ao buscar usuário por CPF:', err);
      return res.status(500).json({ error: 'Erro ao buscar usuário por CPF' });
    }

    if (results.length === 0) {
      console.log('Nenhum usuário encontrado com CPF:', cpf);
      return res.status(404).json({ error: 'Usuário não encontrado com este CPF.' });
    }

    console.log('Usuário encontrado:', results[0]);
    res.json(results[0]);
  });
});

app.get('/profissionais', (req, res) => {
  const query = `
    SELECT 
      u.id,
      u.nome,
      u.sobrenome,
      CONCAT(u.nome, ' ', u.sobrenome) as nomeCompleto,
      u.tipoProfissional,
      u.email,
      u.telefone
    FROM usuario u
    WHERE u.tipoUsuario = 'profissional' 
      AND (u.empresa_id IS NULL OR u.empresa_id = 0)
    ORDER BY u.nome ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erro ao buscar profissionais:', err);
      return res.status(500).json({ error: 'Erro ao buscar profissionais' });
    }
    res.json(results);
  });
});

app.get('/profissionais/:categoria', (req, res) => {
  const { categoria } = req.params;
  const categoriasValidas = ['medico', 'dentista', 'nutricionista', 'fisioterapeuta', 'fonoaudiologo'];
  
  if (!categoriasValidas.includes(categoria)) {
    return res.status(400).json({ error: 'Categoria inválida' });
  }

  let query;
  let queryParams;
  
  if (categoria === 'medico') {
    const especialidadesMedicas = [
      'Clínico Geral', 'Oftalmologista', 'Cardiologista', 'Dermatologista', 
      'Pediatra', 'Ginecologista', 'Ortopedista', 'Neurologista', 'Psiquiatra',
      'Endocrinologista', 'Gastroenterologista', 'Urologista', 'Otorrinolaringologista',
      'Pneumologista', 'Reumatologista', 'Oncologista', 'Hematologista', 'Nefrologista',
      'Anestesiologista', 'Radiologista', 'Patologista', 'Medicina do Trabalho',
      'Medicina Esportiva', 'Geriatra', 'Mastologista', 'Proctologista', 'Angiologista',
      'Cirurgião Geral', 'Cirurgião Plástico', 'Cirurgião Cardiovascular', 'Neurocirurgião',
      'Cirurgião Pediátrico'
    ];
    
    const placeholders = especialidadesMedicas.map(() => '?').join(', ');
    
    query = `
      SELECT 
        u.id,
        CONCAT(u.nome, ' ', u.sobrenome) as nomeCompleto,
        u.tipoProfissional,
        u.email,
        u.telefone,
        u.ufRegiao,
        u.cidade
      FROM usuario u
      WHERE u.tipoUsuario = 'profissional' 
        AND u.tipoProfissional IN (${placeholders})
        AND (u.empresa_id IS NULL OR u.empresa_id = 0)
      ORDER BY u.nome ASC
    `;
    queryParams = especialidadesMedicas;
  } else {
    query = `
      SELECT 
        u.id,
        CONCAT(u.nome, ' ', u.sobrenome) as nomeCompleto,
        u.tipoProfissional,
        u.email,
        u.telefone,
        u.ufRegiao,
        u.cidade
      FROM usuario u
      WHERE u.tipoUsuario = 'profissional' 
        AND LOWER(u.tipoProfissional) = ?
        AND (u.empresa_id IS NULL OR u.empresa_id = 0)
      ORDER BY u.nome ASC
    `;
    queryParams = [categoria];
  }
  
  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error(`Erro ao buscar ${categoria}:`, err);
      return res.status(500).json({ error: `Erro ao buscar ${categoria}` });
    }
    res.json(results);
  });
});

app.get('/empresas', (req, res) => {
  const query = `
    SELECT 
      e.id,
      e.nome as nomeEmpresa,
      COUNT(DISTINCT u.id) as quantidadeProfissionais,
      GROUP_CONCAT(DISTINCT CONCAT(u.nome, ' ', u.sobrenome) SEPARATOR ', ') as nomesProfissionais,
      GROUP_CONCAT(DISTINCT u.tipoProfissional) as tiposProfissionais
    FROM empresas e
    LEFT JOIN usuario u ON u.empresa_id = e.id
    GROUP BY e.id, e.nome
    ORDER BY e.nome ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erro ao buscar empresas:', err);
      const fallbackQuery = `
        SELECT DISTINCT nomeEmpresa, 
               COUNT(*) as quantidadeProfissionais,
               GROUP_CONCAT(DISTINCT tipoProfissional) as tiposProfissionais
        FROM usuario 
        WHERE fazParteEmpresa = 1 AND nomeEmpresa IS NOT NULL AND nomeEmpresa != ''
        GROUP BY nomeEmpresa
        ORDER BY nomeEmpresa ASC
      `;
      
      db.query(fallbackQuery, (err2, results2) => {
        if (err2) {
          return res.status(500).json({ error: 'Erro ao buscar empresas' });
        }
        res.json(results2);
      });
    } else {
      res.json(results);
    }
  });
});

app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;

  db.query('SELECT id FROM usuario WHERE email = ?', [email], (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ error: 'Usuário não encontrado.' });
    }

    const userId = results[0].id; 
    res.json({ userId }); 
  });
});

app.patch('/api/reset-password/:id', async (req, res) => {
  const { id } = req.params; 
  const { senha } = req.body; 

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);

    const query = 'UPDATE usuario SET senha = ? WHERE id = ?';

    db.query(query, [hashedPassword, id], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Erro ao atualizar a senha.' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      return res.status(200).json({ message: 'Senha redefinida com sucesso.' });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao processar a senha.' });
  }
});

app.patch('/usuarios/:id/localizacao', (req, res) => {
  const { id } = req.params;
  const { latitude, longitude, cidade, ufRegiao } = req.body;

  const query = 'UPDATE usuario SET latitude = ?, longitude = ?, cidade = ?, ufRegiao = ? WHERE id = ?';
  
  db.query(query, [latitude, longitude, cidade, ufRegiao, id], (err, result) => {
    if (err) {
      console.error('Erro ao atualizar localização:', err);
      return res.status(500).json({ error: 'Erro ao atualizar localização.' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({ message: 'Localização atualizada com sucesso.' });
  });
});

app.patch('/usuarios/:id/informacoes', (req, res) => {
  const { id } = req.params;
  const { descricao, publicoAtendido, modalidade, valorConsulta, diasAtendimento, horariosAtendimento } = req.body;

  const updates = [];
  const values = [];

  if (descricao !== undefined) {
    updates.push('descricao = ?');
    values.push(descricao);
  }

  if (publicoAtendido !== undefined) {
    updates.push('publicoAtendido = ?');
    values.push(publicoAtendido);
  }

  if (modalidade !== undefined) {
    updates.push('modalidade = ?');
    values.push(modalidade);
  }

  if (valorConsulta !== undefined) {
    updates.push('valorConsulta = ?');
    values.push(valorConsulta);
  }

  if (diasAtendimento !== undefined) {
    updates.push('diasAtendimento = ?');
    values.push(typeof diasAtendimento === 'object' ? JSON.stringify(diasAtendimento) : diasAtendimento);
  }

  if (horariosAtendimento !== undefined) {
    updates.push('horariosAtendimento = ?');
    values.push(typeof horariosAtendimento === 'object' ? JSON.stringify(horariosAtendimento) : horariosAtendimento);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
  }

  values.push(id);
  const query = `UPDATE usuario SET ${updates.join(', ')} WHERE id = ?`;
  
  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Erro ao atualizar informações:', err);
      return res.status(500).json({ error: 'Erro ao atualizar informações.' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({ message: 'Informações atualizadas com sucesso.' });
  });
});

