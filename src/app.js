const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const authView = require('./views/authView');
const reservasView = require('./views/reservasView');
const formulariosView = require('./views/formulariosView');
const usuariosView = require('./views/usuariosView');
const profissionaisView = require('./views/profissionaisView');
const empresasView = require('./views/empresasView');
const vagasView = require('./views/vagasView');
const avaliacoesView = require('./views/avaliacoesView');

const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: config.cors.origins,
      credentials: config.cors.credentials
    })
  );

  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  app.use(authView);
  app.use(reservasView);
  app.use(formulariosView);
  app.use(usuariosView);
  app.use(profissionaisView);
  app.use(empresasView);
  app.use(vagasView);
  app.use(avaliacoesView);

  return app;
};

module.exports = {
  createApp
};

