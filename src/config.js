const parseCorsOrigins = (value) => {
  if (!value) return null;
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'secreto',
  cors: {
    origins:
      parseCorsOrigins(process.env.CORS_ORIGINS) || [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000'
      ],
    credentials: true
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'agendamento'
  }
};

module.exports = config;
