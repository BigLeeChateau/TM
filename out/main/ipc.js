"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const database_1 = require("./database");
function registerIpcHandlers() {
    // Projects
    electron_1.ipcMain.handle('createProject', (_event, data) => {
        const db = (0, database_1.getDb)();
        const stmt = db.prepare('INSERT INTO projects (name, description, color) VALUES (?, ?, ?)');
        const result = stmt.run(data.name, data.description || '', data.color || '#3b82f6');
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
        (0, database_1.snapshotDatabase)();
        return project;
    });
    electron_1.ipcMain.handle('updateProject', (_event, id, data) => {
        const db = (0, database_1.getDb)();
        const sets = [];
        const values = [];
        if (data.name !== undefined) {
            sets.push('name = ?');
            values.push(data.name);
        }
        if (data.description !== undefined) {
            sets.push('description = ?');
            values.push(data.description);
        }
        if (data.color !== undefined) {
            sets.push('color = ?');
            values.push(data.color);
        }
        values.push(id);
        const stmt = db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`);
        stmt.run(...values);
        return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    });
    electron_1.ipcMain.handle('deleteProject', (_event, id) => {
        const db = (0, database_1.getDb)();
        db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        db.prepare('UPDATE tasks SET project_id = NULL WHERE project_id = ?').run(id);
        (0, database_1.snapshotDatabase)();
    });
    electron_1.ipcMain.handle('listProjects', () => {
        const db = (0, database_1.getDb)();
        return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    });
    // Tasks
    electron_1.ipcMain.handle('createTask', (_event, data) => {
        const db = (0, database_1.getDb)();
        const stmt = db.prepare(`
      INSERT INTO tasks
      (title, description, status, project_id, planned_start, planned_end, planned_duration, dependencies, recurrence_rule)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(data.title, data.description || '', data.status || 'inbox', data.project_id ?? null, data.planned_start ?? null, data.planned_end ?? null, data.planned_duration ?? null, data.dependencies || '[]', data.recurrence_rule ?? null);
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
        logMutation(task.id, 'created', null, JSON.stringify(task));
        (0, database_1.snapshotDatabase)();
        return task;
    });
    electron_1.ipcMain.handle('updateTask', (_event, id, data) => {
        const db = (0, database_1.getDb)();
        const oldTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        if (!oldTask)
            throw new Error(`Task ${id} not found`);
        const sets = [];
        const values = [];
        const fields = [
            'title', 'description', 'status', 'project_id',
            'planned_start', 'planned_end', 'planned_duration',
            'actual_start', 'actual_end', 'actual_duration',
            'dependencies', 'recurrence_rule',
        ];
        // Auto-compute duration if dates are provided but duration is not
        const computeDuration = (start, end) => {
            if (!start || !end)
                return null;
            const s = new Date(start);
            const e = new Date(end);
            const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
            return days * 8;
        };
        const effectiveData = { ...data };
        if (effectiveData.planned_start !== undefined && effectiveData.planned_end !== undefined && effectiveData.planned_duration === undefined) {
            effectiveData.planned_duration = computeDuration(effectiveData.planned_start, effectiveData.planned_end);
        }
        if (effectiveData.actual_start !== undefined && effectiveData.actual_end !== undefined && effectiveData.actual_duration === undefined) {
            effectiveData.actual_duration = computeDuration(effectiveData.actual_start, effectiveData.actual_end);
        }
        for (const field of fields) {
            if (effectiveData[field] !== undefined) {
                sets.push(`${field} = ?`);
                values.push(effectiveData[field] ?? null);
                logMutation(id, field, oldTask[field], effectiveData[field]);
            }
        }
        values.push(id);
        const stmt = db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`);
        stmt.run(...values);
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        // Push to undo stack
        pushUndo('updateTask', id, JSON.stringify(oldTask));
        (0, database_1.snapshotDatabase)();
        return task;
    });
    electron_1.ipcMain.handle('deleteTask', (_event, id) => {
        const db = (0, database_1.getDb)();
        const oldTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        if (oldTask) {
            pushUndo('deleteTask', id, JSON.stringify(oldTask));
        }
        db.prepare('UPDATE tasks SET deleted_at = datetime("now") WHERE id = ?').run(id);
        (0, database_1.snapshotDatabase)();
    });
    electron_1.ipcMain.handle('listTasks', (_event, projectId, status) => {
        const db = (0, database_1.getDb)();
        let sql = 'SELECT * FROM tasks WHERE deleted_at IS NULL';
        const params = [];
        if (projectId !== undefined) {
            sql += ' AND project_id = ?';
            params.push(projectId);
        }
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        sql += ' ORDER BY created_at DESC';
        return db.prepare(sql).all(...params);
    });
    // Undo / Redo
    electron_1.ipcMain.handle('undo', () => {
        const db = (0, database_1.getDb)();
        const entry = db.prepare('SELECT * FROM undo_stack ORDER BY id DESC LIMIT 1').get();
        if (!entry || !entry.task_id)
            return { success: false };
        const oldTask = JSON.parse(entry.previous_state);
        const stmt = db.prepare(`
      UPDATE tasks SET
        title = ?, description = ?, status = ?, project_id = ?,
        planned_start = ?, planned_end = ?, planned_duration = ?,
        actual_start = ?, actual_end = ?, actual_duration = ?,
        dependencies = ?, recurrence_rule = ?
      WHERE id = ?
    `);
        stmt.run(oldTask.title, oldTask.description, oldTask.status, oldTask.project_id, oldTask.planned_start, oldTask.planned_end, oldTask.planned_duration, oldTask.actual_start, oldTask.actual_end, oldTask.actual_duration, oldTask.dependencies, oldTask.recurrence_rule, entry.task_id);
        // Restore soft-deleted task
        db.prepare('UPDATE tasks SET deleted_at = NULL WHERE id = ?').run(entry.task_id);
        db.prepare('DELETE FROM undo_stack WHERE id = ?').run(entry.id);
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(entry.task_id);
        return { success: true, task };
    });
    electron_1.ipcMain.handle('redo', () => {
        // Redo not implemented in v1 — undo stack is linear
        return { success: false };
    });
    // Export
    electron_1.ipcMain.handle('exportData', () => {
        const db = (0, database_1.getDb)();
        const projects = db.prepare('SELECT * FROM projects').all();
        const tasks = db.prepare('SELECT * FROM tasks WHERE deleted_at IS NULL').all();
        return { projects, tasks };
    });
}
function logMutation(taskId, field, oldValue, newValue) {
    const db = (0, database_1.getDb)();
    db.prepare('INSERT INTO task_mutations (task_id, field, old_value, new_value) VALUES (?, ?, ?, ?)')
        .run(taskId, field, oldValue, newValue);
}
function pushUndo(actionType, taskId, previousState) {
    const db = (0, database_1.getDb)();
    db.prepare('INSERT INTO undo_stack (action_type, task_id, previous_state) VALUES (?, ?, ?)')
        .run(actionType, taskId, previousState);
    // Keep only last 50
    db.prepare('DELETE FROM undo_stack WHERE id <= (SELECT id FROM undo_stack ORDER BY id DESC LIMIT 1 OFFSET 50)').run();
}
