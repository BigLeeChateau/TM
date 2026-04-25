import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

export const DEFAULT_PROJECT_NAME = 'Other'

let db: Database.Database | null = null

function getDbPath(): string {
  const userData = app.getPath('userData')
  const dbDir = path.join(userData, 'data')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  return path.join(dbDir, 'tm.db')
}

function getBackupDir(): string {
  const userData = app.getPath('userData')
  return path.join(userData, 'backups')
}

export function initDatabase(): void {
  const dbPath = getDbPath()
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  migrateTasksForeignKey()
  ensureDefaultProject()
  ensureBackupDir()
}

function ensureDefaultProject(): void {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(DEFAULT_PROJECT_NAME) as { id: number } | undefined
  if (!existing) {
    db.prepare('INSERT INTO projects (name, description, color) VALUES (?, ?, ?)').run(DEFAULT_PROJECT_NAME, '', '#87867f')
  }
}

export function getDefaultProjectId(): number {
  const db = getDb()
  const row = db.prepare('SELECT id FROM projects WHERE name = ?').get(DEFAULT_PROJECT_NAME) as { id: number } | undefined
  if (!row) throw new Error(`Default '${DEFAULT_PROJECT_NAME}' project not found`)
  return row.id
}

function migrateTasksForeignKey(): void {
  const db = getDb()
  // Check if migration is needed: look for the old ON DELETE SET NULL constraint
  const fk = db.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type = 'table' AND name = 'tasks'
  `).get() as { sql: string } | undefined
  if (!fk || !fk.sql.includes('ON DELETE SET NULL')) return

  db.exec(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE tasks_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'inbox' CHECK(status IN ('inbox', 'next', 'waiting', 'done')),
      project_id INTEGER REFERENCES projects(id) ON DELETE RESTRICT,
      planned_start TEXT,
      planned_end TEXT,
      planned_duration REAL,
      actual_start TEXT,
      actual_end TEXT,
      actual_duration REAL,
      dependencies TEXT DEFAULT '[]',
      recurrence_rule TEXT,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO tasks_new SELECT * FROM tasks;
    DROP TABLE tasks;
    ALTER TABLE tasks_new RENAME TO tasks;
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
    PRAGMA foreign_keys = ON;
  `)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function closeDatabase(): void {
  db?.close()
  db = null
}

function createTables(): void {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#3b82f6',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'inbox' CHECK(status IN ('inbox', 'next', 'waiting', 'done')),
      project_id INTEGER REFERENCES projects(id) ON DELETE RESTRICT,
      planned_start TEXT,
      planned_end TEXT,
      planned_duration REAL,
      actual_start TEXT,
      actual_end TEXT,
      actual_duration REAL,
      dependencies TEXT DEFAULT '[]',
      recurrence_rule TEXT,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_mutations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS undo_stack (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      task_id INTEGER,
      previous_state TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_mutations_task ON task_mutations(task_id);
  `)
}

function ensureBackupDir(): void {
  const dir = getBackupDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function snapshotDatabase(): void {
  const db = getDb()
  const backupDir = getBackupDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDir, `tm-${timestamp}.db`)
  db.backup(backupPath).then(() => {
    cleanupOldBackups(backupDir)
  }).catch((err) => {
    console.error('Backup failed:', err)
  })
}

function cleanupOldBackups(backupDir: string): void {
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('tm-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      time: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.time - a.time)

  // Keep 7 days worth
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  for (const file of files) {
    if (file.time < cutoff) {
      fs.unlinkSync(path.join(backupDir, file.name))
    }
  }
}
