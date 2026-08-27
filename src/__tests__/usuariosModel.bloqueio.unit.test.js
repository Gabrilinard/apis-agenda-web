// Teste UNITÁRIO da regra de negócio de bloqueio temporário por ausência pós-confirmação
// (backend/src/models/usuariosModel.js). O banco é substituído por um mock controlado —
// isolando apenas a lógica de decisão (bloqueado_ate no passado x no futuro).
jest.mock('../db', () => {
  const { createQueryRouter } = require('./helpers/mockDb');
  const router = createQueryRouter();
  return {
    dbPromise: { query: (...args) => router.dbPromiseQuery(...args) },
    pool: { query: (...args) => router.poolQuery(...args) },
    __router: router,
  };
});

const usuariosModel = require('../models/usuariosModel');
const router = require('../db').__router;

describe('usuariosModel.getBloqueio (unitário)', () => {
  afterEach(() => router.reset());

  test('retorna null quando o usuário nunca foi bloqueado (bloqueado_ate nulo)', async () => {
    router.on(/SELECT bloqueado_ate/, () => [{ bloqueado_ate: null, motivo_bloqueio: null }]);

    const resultado = await usuariosModel.getBloqueio(1);

    expect(resultado).toBeNull();
  });

  test('retorna null quando o bloqueio já expirou (bloqueado_ate no passado)', async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    router.on(/SELECT bloqueado_ate/, () => [{ bloqueado_ate: ontem, motivo_bloqueio: 'Ausência' }]);

    const resultado = await usuariosModel.getBloqueio(1);

    expect(resultado).toBeNull();
  });

  test('retorna o registro de bloqueio quando ainda está vigente (bloqueado_ate no futuro)', async () => {
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    router.on(/SELECT bloqueado_ate/, () => [{ bloqueado_ate: amanha, motivo_bloqueio: 'Ausência em consulta confirmada' }]);

    const resultado = await usuariosModel.getBloqueio(1);

    expect(resultado).not.toBeNull();
    expect(resultado.motivo_bloqueio).toBe('Ausência em consulta confirmada');
  });
});

describe('usuariosModel.bloquearTemporariamente (unitário)', () => {
  afterEach(() => router.reset());

  test('usa a janela de 60 dias definida como BLOQUEIO_DIAS', async () => {
    expect(usuariosModel.BLOQUEIO_DIAS).toBe(60);

    let diasUsados = null;
    router.on(/UPDATE usuario SET bloqueado_ate/, (params) => {
      diasUsados = params[0];
      return { affectedRows: 1 };
    });
    router.on(/SELECT bloqueado_ate, cpf FROM usuario WHERE id/, () => [{ bloqueado_ate: '2099-01-01', cpf: '12345678900' }]);
    router.on(/INSERT INTO bloqueios_cpf/, () => ({ affectedRows: 1 }));

    await usuariosModel.bloquearTemporariamente(5, 'motivo teste');

    expect(diasUsados).toBe(60);
  });
});
