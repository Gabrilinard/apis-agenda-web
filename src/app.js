const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { dbPromise } = require('./db');

const authView = require('./views/authView');
const uploadsView = require('./views/uploadsView');
const profissionaisView = require('./views/profissionaisView');
const empresasView = require('./views/empresasView');
const reservasView = require('./views/reservasView');
const formulariosView = require('./views/formulariosView');
const usuariosView = require('./views/usuariosView');
const vagasView = require('./views/vagasView');
const avaliacoesView = require('./views/avaliacoesView');

const gerarSlotsMeiaHora = (inicio, fim) => {
  const slots = [];
  let [h, m] = inicio.split(':').map(Number);
  const [hFim, mFim] = fim.split(':').map(Number);
  while (h < hFim || (h === hFim && m < mFim)) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += 30;
    if (m >= 60) { m -= 60; h += 1; }
  }
  return slots;
};

const HORARIO_DEMO_DIA = gerarSlotsMeiaHora('09:00', '17:00');

const PROFISSIONAL_DEMO = {
  nome: 'Fábio', sobrenome: 'Demonstração', email: 'fabio.demo@sistema.local', cpf: '00000000005',
  telefone: '(11) 90000-0005', tipoProfissional: 'medico', especialidadeMedica: 'Clínico Geral',
  genero: 'masculino', valorConsulta: '150',
  descricao: 'Médico clínico geral com experiência em atendimento de rotina e preventivo. Disponível para consultas presenciais e online.',
  publicoAtendido: 'Todas as idades',
  modalidade: 'presencial',
  valorPresencial: '150',
  valorOnline: '120',
  valorDomiciliar: '200',
  horariosAtendimento: JSON.stringify({
    Segunda: HORARIO_DEMO_DIA,
    Terça: HORARIO_DEMO_DIA,
    Quarta: HORARIO_DEMO_DIA,
    Quinta: HORARIO_DEMO_DIA,
    Sexta: HORARIO_DEMO_DIA,
  }),
  diasAtendimento: JSON.stringify(['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']),
  ufRegiao: 'SP',
  cidade: 'São Paulo',
};

// Garante que o Fábio Demo existe no banco com dados completos
const garantirFabioDemoExiste = async () => {
  try {
    const [rows] = await dbPromise.query(
      'SELECT id FROM usuario WHERE email = ? LIMIT 1',
      [PROFISSIONAL_DEMO.email]
    );

    if (rows.length > 0) {
      // Já existe, atualiza para garantir dados completos e aceitandoConsultas = 1
      await dbPromise.query(
        `UPDATE usuario SET 
          aceitandoConsultas = 1,
          descricao = ?,
          publicoAtendido = ?,
          modalidade = ?,
          valorPresencial = ?,
          valorOnline = ?,
          valorDomiciliar = ?,
          horariosAtendimento = ?,
          diasAtendimento = ?,
          ufRegiao = ?,
          cidade = ?
         WHERE id = ?`,
        [
          PROFISSIONAL_DEMO.descricao,
          PROFISSIONAL_DEMO.publicoAtendido,
          PROFISSIONAL_DEMO.modalidade,
          PROFISSIONAL_DEMO.valorPresencial,
          PROFISSIONAL_DEMO.valorOnline,
          PROFISSIONAL_DEMO.valorDomiciliar,
          PROFISSIONAL_DEMO.horariosAtendimento,
          PROFISSIONAL_DEMO.diasAtendimento,
          PROFISSIONAL_DEMO.ufRegiao,
          PROFISSIONAL_DEMO.cidade,
          rows[0].id
        ]
      );
      console.log('[app.js] Fábio Demo atualizado com dados completos');
      return;
    }

    // Não existe, cria
    const senhaAleatoria = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    await dbPromise.query(
      `INSERT INTO usuario
        (nome, sobrenome, telefone, email, senha, cpf, tipoUsuario, tipoProfissional, especialidadeMedica, genero,
         valorConsulta, valorPresencial, valorOnline, valorDomiciliar, modalidade, descricao, publicoAtendido,
         horariosAtendimento, diasAtendimento, ufRegiao, cidade, aceitandoConsultas)
       VALUES (?, ?, ?, ?, ?, ?, 'profissional', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        PROFISSIONAL_DEMO.nome, PROFISSIONAL_DEMO.sobrenome, PROFISSIONAL_DEMO.telefone, PROFISSIONAL_DEMO.email,
        senhaAleatoria, PROFISSIONAL_DEMO.cpf, PROFISSIONAL_DEMO.tipoProfissional, PROFISSIONAL_DEMO.especialidadeMedica,
        PROFISSIONAL_DEMO.genero, PROFISSIONAL_DEMO.valorConsulta, PROFISSIONAL_DEMO.valorPresencial,
        PROFISSIONAL_DEMO.valorOnline, PROFISSIONAL_DEMO.valorDomiciliar, PROFISSIONAL_DEMO.modalidade,
        PROFISSIONAL_DEMO.descricao, PROFISSIONAL_DEMO.publicoAtendido, PROFISSIONAL_DEMO.horariosAtendimento,
        PROFISSIONAL_DEMO.diasAtendimento, PROFISSIONAL_DEMO.ufRegiao, PROFISSIONAL_DEMO.cidade
      ]
    );
    console.log('[app.js] Fábio Demo criado com sucesso no banco de dados');
  } catch (err) {
    console.error('[app.js] Erro ao garantir que Fábio Demo existe:', err);
  }
};

const createApp = () => {
  const app = express();

  // Necessário atrás de proxies (Railway, etc.) para que express-rate-limit
  // e outros middlewares baseados em IP leiam o X-Forwarded-For corretamente.
  app.set('trust proxy', 1);

  // Garante que o Fábio Demo existe quando o app inicia
  garantirFabioDemoExiste();

  app.use(helmet());

  app.use(
    cors({
      origin: config.cors.origins,
      credentials: config.cors.credentials
    })
  );
  app.options('*', cors({ origin: config.cors.origins, credentials: config.cors.credentials }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(authView);
  // uploadsView, profissionaisView e empresasView são as únicas rotas públicas (sem
  // login) do sistema. Ficam montadas antes de qualquer roteador com `router.use(authenticate)`
  // global (reservasView, formulariosView, usuariosView, vagasView) porque, no Express,
  // um `router.use(middleware)` sem path bloqueia TODA requisição que passa por aquele
  // roteador — mesmo as que não têm rota correspondente nele. Se um roteador autenticado
  // for montado antes de um público, o público nunca é alcançado (era o caso de
  // GET /profissionais, que retornava 401 mesmo devendo ser público).
  app.use(uploadsView);
  app.use(profissionaisView);
  app.use(empresasView);
  app.use(reservasView);
  app.use(formulariosView);
  app.use(usuariosView);
  app.use(vagasView);
  app.use(avaliacoesView);

  return app;
};

module.exports = {
  createApp
};

