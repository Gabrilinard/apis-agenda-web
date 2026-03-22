const fs = require('fs');
const path = require('path');
const { dbPromise } = require('../db');

const ensureMigrationsTable = async () => {
  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const listMigrationFiles = async (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
};

const alreadyRan = async (name) => {
  const [rows] = await dbPromise.query('SELECT name FROM schema_migrations WHERE name = ? LIMIT 1', [name]);
  return Array.isArray(rows) && rows.length > 0;
};

const markRan = async (name) => {
  await dbPromise.query('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
};

const runFile = async (fullPath) => {
  const sql = fs.readFileSync(fullPath, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !s.startsWith('--'))
    .filter((s) => !s.toUpperCase().startsWith('USE '));

  for (const statement of statements) {
    await dbPromise.query(statement);
  }
};

const runSqlMigrations = async () => {
  await ensureMigrationsTable();

  const migrationsDir = path.join(__dirname, '../../migrations/sql_migrations');
  const files = await listMigrationFiles(migrationsDir);

  for (const file of files) {
    if (await alreadyRan(file)) continue;
    await runFile(path.join(migrationsDir, file));
    await markRan(file);
  }
};

module.exports = {
  runSqlMigrations
};

