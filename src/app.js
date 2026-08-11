const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');

const authView = require('./views/authView');
const uploadsView = require('./views/uploadsView');
const profissionaisView = require('./views/profissionaisView');
const empresasView = require('./views/empresasView');
const reservasView = require('./views/reservasView');
const formulariosView = require('./views/formulariosView');
const usuariosView = require('./views/usuariosView');
const vagasView = require('./views/vagasView');
const avaliacoesView = require('./views/avaliacoesView');

const createApp = () => {
  const app = express();

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

