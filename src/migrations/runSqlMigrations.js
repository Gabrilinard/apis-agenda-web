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

const IGNORABLE_ERRNO = new Set([1060, 1061, 1091]);

const runFile = async (fullPath) => {
  const raw = fs.readFileSync(fullPath, 'utf8');

  // Strip single-line comments and USE statements at the line level so they
  // don't interfere with execution, then split by semicolons to obtain
  // individual statements. Each statement is executed separately so that
  // multi-statement files (e.g. multiple ALTER TABLE calls) work correctly
  // without relying on multipleStatements mode, which is unreliable with
  // mysql2 in this context.
  const filtered = raw
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('--') && !trimmed.toUpperCase().startsWith('USE ');
    })
    .join('\n');

  const statements = filtered
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await dbPromise.query(statement);
    } catch (e) {
      if (IGNORABLE_ERRNO.has(e.errno)) continue;
      throw e;
    }
  }
};

const runSqlMigrations = async () => {
  await ensureMigrationsTable();

  // Run base schema files first (CREATE TABLE statements) so that tables
  // exist before any ALTER TABLE migrations are applied.
  const baseMigrationsDir = path.join(__dirname, '../../migrations');
  const baseFiles = await listMigrationFiles(baseMigrationsDir);

  for (const file of baseFiles) {
    if (await alreadyRan(file)) continue;
    await runFile(path.join(baseMigrationsDir, file));
    await markRan(file);
  }

  // Run incremental SQL migrations (ALTER TABLE, new columns, etc.) second.
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

