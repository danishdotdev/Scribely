const fs = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

const ACTIVE_STATUSES = new Set(['launching', 'joining', 'active', 'transcribing', 'stop_requested']);

class SessionStore {
  constructor() {
    this.filePath = path.resolve(process.cwd(), process.env.MEETING_STORE_PATH || './data/meetings.json');
    this.writeQueue = Promise.resolve();
  }

  async _read() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.sessions) ? parsed.sessions : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      logger.warn({ err: error.message }, 'Could not read meeting store, starting empty');
      return [];
    }
  }

  async _write(sessions) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const payload = JSON.stringify({ sessions }, null, 2);
    this.writeQueue = this.writeQueue.then(() => fs.writeFile(this.filePath, payload));
    return this.writeQueue;
  }

  async create(session) {
    const sessions = await this._read();
    const now = new Date().toISOString();
    const next = {
      createdAt: now,
      updatedAt: now,
      status: 'launching',
      ...session
    };
    const index = sessions.findIndex(item => item.id === next.id);
    if (index >= 0) sessions[index] = { ...sessions[index], ...next, updatedAt: now };
    else sessions.push(next);
    await this._write(sessions);
    return next;
  }

  async update(id, patch) {
    const sessions = await this._read();
    const index = sessions.findIndex(item => item.id === id);
    if (index < 0) return null;
    sessions[index] = {
      ...sessions[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };
    await this._write(sessions);
    return sessions[index];
  }

  async upsert(id, patch) {
    const current = await this.get(id);
    if (current) return this.update(id, patch);
    return this.create({ id, ...patch });
  }

  async get(id) {
    const sessions = await this._read();
    return sessions.find(item => item.id === id) || null;
  }

  async delete(id) {
    const sessions = await this._read();
    const index = sessions.findIndex(item => item.id === id);
    if (index < 0) return null;
    const [removed] = sessions.splice(index, 1);
    await this._write(sessions);
    return removed;
  }

  async findByMeetingId(meetingId) {
    const sessions = await this._read();
    return sessions.find(item => item.meetingId === meetingId) || null;
  }

  async getActiveByUser(userId) {
    const sessions = await this._read();
    return sessions.find(item => item.userId === userId && ACTIVE_STATUSES.has(item.status)) || null;
  }

  async list({ userId, limit = 50 } = {}) {
    const sessions = await this._read();
    return sessions
      .filter(item => !userId || item.userId === userId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, limit);
  }
}

module.exports = new SessionStore();
module.exports.ACTIVE_STATUSES = ACTIVE_STATUSES;
