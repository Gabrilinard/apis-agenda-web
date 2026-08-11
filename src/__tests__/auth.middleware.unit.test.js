// Teste UNITÁRIO do middleware de autenticação (backend/src/middlewares/auth.js).
// Não depende de banco, rede ou Express: chama a função diretamente com req/res/next
// simulados, isolando exclusivamente a lógica de validação do JWT.
const jwt = require('jsonwebtoken');
const config = require('../config');
const { authenticate } = require('../middlewares/auth');

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('middlewares/auth.authenticate (unitário)', () => {
  test('rejeita requisição sem header Authorization', () => {
    const req = { headers: {} };
    const res = buildRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Não autenticado.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejeita header Authorization sem prefixo Bearer', () => {
    const req = { headers: { authorization: 'Token abc123' } };
    const res = buildRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejeita token com assinatura inválida', () => {
    const tokenForjado = jwt.sign({ id: 42 }, 'segredo-errado');
    const req = { headers: { authorization: `Bearer ${tokenForjado}` } };
    const res = buildRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Sessão expirada. Faça login novamente.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejeita token expirado', () => {
    const tokenExpirado = jwt.sign({ id: 42 }, config.jwtSecret, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${tokenExpirado}` } };
    const res = buildRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('aceita token válido, popula req.userId e chama next()', () => {
    const tokenValido = jwt.sign({ id: 77 }, config.jwtSecret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${tokenValido}` } };
    const res = buildRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(req.userId).toBe(77);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
