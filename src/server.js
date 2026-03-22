const config = require('./config');
const { createApp } = require('./app');
const { runSqlMigrations } = require('./migrations/runSqlMigrations');

const start = async () => {
  await runSqlMigrations();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Servidor rodando na porta ${config.port}`);
  });
};

module.exports = {
  start
};

