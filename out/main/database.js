"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getDb = getDb;
exports.closeDatabase = closeDatabase;
exports.snapshotDatabase = snapshotDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
let db = null;
function getDbPath() {
    const userData = electron_1.app.getPath('userData');
    const dbDir = path_1.default.join(userData, 'data');
    if (!fs_1.default.existsSync(dbDir)) {
        fs_1.default.mkdirSync(dbDir, { recursive: true });
    }
    return path_1.default.join(dbDir, 'tm.db');
}
function getBackupDir() {
    const userData = electron_1.app.getPath('userData');
    return path_1.default.join(userData, 'backups');
}
function initDatabase() {
    const dbPath = getDbPath();
    db = new better_sqlite3_1.default(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    createTables();
    ensureBackupDir();
}
function getDb() {
    if (!db)
        throw new Error('Database not initialized');
    return db;
}
function closeDatabase() {
    db?.close();
    db = null;
}
function createTables() {
    const db = getDb();
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
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
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
  `);
}
function ensureBackupDir() {
    const dir = getBackupDir();
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
function snapshotDatabase() {
    const db = getDb();
    const backupDir = getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path_1.default.join(backupDir, `tm-${timestamp}.db`);
    db.backup(backupPath).then(() => {
        cleanupOldBackups(backupDir);
    }).catch((err) => {
        console.error('Backup failed:', err);
    });
}
function cleanupOldBackups(backupDir) {
    const files = fs_1.default.readdirSync(backupDir)
        .filter(f => f.startsWith('tm-') && f.endsWith('.db'))
        .map(f => ({
        name: f,
        time: fs_1.default.statSync(path_1.default.join(backupDir, f)).mtimeMs,
    }))
        .sort((a, b) => b.time - a.time);
    // Keep 7 days worth
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const file of files) {
        if (file.time < cutoff) {
            fs_1.default.unlinkSync(path_1.default.join(backupDir, file.name));
        }
    }
}
