// Helper para controlar as respostas do mysql2 (dbPromise.query / pool.query) nos
// testes sem precisar de um banco real. Cada teste registra rotas por regex do SQL.
const createQueryRouter = () => {
  const routes = [];

  const on = (sqlPattern, handler) => {
    routes.push({ sqlPattern, handler });
    return router;
  };

  const normalizar = (sql) => String(sql).replace(/\s+/g, ' ').trim();

  const defaultRoutes = [{ sqlPattern: /INSERT INTO log_acesso/, handler: () => ({ insertId: 1, affectedRows: 1 }) }];

  const resolveFor = (sql, params) => {
    const sqlNormalizado = normalizar(sql);
    const match = routes.find((r) => r.sqlPattern.test(sqlNormalizado)) || defaultRoutes.find((r) => r.sqlPattern.test(sqlNormalizado));
    if (!match) {
      throw new Error(`[mockDb] Nenhuma rota configurada para a query: ${sqlNormalizado}`);
    }
    return match.handler(params, sql);
  };

  const dbPromiseQuery = jest.fn(async (sql, params) => {
    const result = resolveFor(sql, params);
    return [result, undefined];
  });

  const poolQuery = jest.fn((sql, params, cb) => {
    const callback = typeof params === 'function' ? params : cb;
    const boundParams = typeof params === 'function' ? [] : params;
    try {
      const result = resolveFor(sql, boundParams);
      callback(null, result);
    } catch (e) {
      callback(e);
    }
  });

  const reset = () => {
    routes.length = 0;
    dbPromiseQuery.mockClear();
    poolQuery.mockClear();
  };

  const router = { on, reset, dbPromiseQuery, poolQuery };
  return router;
};

module.exports = { createQueryRouter };
