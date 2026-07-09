const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const store = require('./session-store');
const transcriptionService = require('./transcription.service');
const { buildMeetingIntelligence } = require('./meeting-intelligence.service');
const logger = require('../utils/logger');

const CAPTURE_DIR = path.resolve(process.cwd(), process.env.LOCAL_CAPTURE_DIR || './data/local-captures');
const MAX_CHUNK_BYTES = 50 * 1024 * 1024;

function makeSessionId() {
  return `local_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function assertSessionId(id) {
  if (!/^local_[a-z0-9_-]+$/i.test(String(id || ''))) {
    throw new Error('Invalid local capture session id');
  }
}

class LocalCaptureService {
  async start({ userId, title, sourceLabel, rawNotes, noteTemplate, folder, space, deleteAudioAfterTranscription, provider }) {
    const id = makeSessionId();
    await fs.mkdir(CAPTURE_DIR, { recursive: true });
    const recordingPath = path.join(CAPTURE_DIR, `${id}.webm`);
    await fs.writeFile(recordingPath, Buffer.alloc(0));

    return store.create({
      id,
      meetingId: id,
      mode: 'local_capture',
      userId: userId || 'local-user',
      title: title || 'Local meeting recording',
      sourceLabel: sourceLabel || null,
      rawNotes: rawNotes || '',
      noteTemplate: noteTemplate || 'general',
      folder: folder || 'My notes',
      space: space || 'Private',
      provider: provider || null,
      deleteAudioAfterTranscription: deleteAudioAfterTranscription !== false,
      recordingRetained: true,
      status: 'recording',
      recordingPath,
      recordingBytes: 0,
      chunkCount: 0,
      startedAt: new Date().toISOString()
    });
  }

  async appendChunk(id, chunk, sequence) {
    assertSessionId(id);
    if (!Buffer.isBuffer(chunk) || chunk.length === 0) {
      throw new Error('Chunk body is empty');
    }
    if (chunk.length > MAX_CHUNK_BYTES) {
      throw new Error(`Chunk is too large; max ${MAX_CHUNK_BYTES} bytes`);
    }

    const session = await store.get(id);
    if (!session || session.mode !== 'local_capture') throw new Error('Local capture session not found');
    if (session.status !== 'recording') throw new Error(`Session is not recording; current status is ${session.status}`);

    await fs.appendFile(session.recordingPath, chunk);
    const nextBytes = Number(session.recordingBytes || 0) + chunk.length;
    const nextCount = Number(session.chunkCount || 0) + 1;
    const updated = await store.update(id, {
      recordingBytes: nextBytes,
      chunkCount: nextCount,
      lastChunkAt: new Date().toISOString(),
      lastSequence: sequence || nextCount
    });
    return updated;
  }

  async finish(id, options = {}) {
    assertSessionId(id);
    const session = await store.get(id);
    if (!session || session.mode !== 'local_capture') throw new Error('Local capture session not found');

    await store.update(id, {
      status: 'transcribing',
      stoppedAt: new Date().toISOString()
    });

    try {
      const stats = await fs.stat(session.recordingPath);
      if (stats.size < 1024) throw new Error('Recording is too small to transcribe');

      const result = await transcriptionService.transcribe(session.recordingPath, {
        provider: options.provider || session.provider,
        apiKey: options.apiKey || options.api_key,
        prompt: session.rawNotes
      });
      const completedPatch = {
        status: 'completed',
        endedAt: new Date().toISOString(),
        provider: result.provider,
        transcript: result.transcript,
        transcriptHinglish: result.transcriptHinglish,
        utterances: result.utterances,
        diarizedTranscript: result.diarizedTranscript,
        diarizedTranscriptHinglish: result.diarizedTranscriptHinglish,
        durationSeconds: result.duration,
        transcriptionMeta: result.raw || null
      };
      completedPatch.meetingIntelligence = buildMeetingIntelligence({
        ...session,
        ...completedPatch
      });
      let updated = await store.update(id, completedPatch);
      if (session.deleteAudioAfterTranscription !== false) {
        updated = await this.deleteRecordingFile(id, updated);
      }
      return updated;
    } catch (error) {
      logger.error({ id, err: error.message }, 'Local capture transcription failed');
      let updated = await store.update(id, {
        status: 'failed',
        endedAt: new Date().toISOString(),
        error: error.message
      });
      if (session.deleteAudioAfterTranscription !== false) {
        updated = await this.deleteRecordingFile(id, updated);
      }
      throw error;
    }
  }

  async deleteRecordingFile(id, session) {
    if (!session?.recordingPath) return session;
    try {
      const resolved = path.resolve(session.recordingPath);
      if (resolved.startsWith(CAPTURE_DIR + path.sep)) {
        await fs.unlink(resolved);
        return store.update(id, {
          recordingPath: null,
          recordingDeletedAt: new Date().toISOString(),
          recordingRetained: false
        });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn({ id, err: error.message }, 'Could not delete local capture recording');
      }
    }
    return session;
  }

  async delete(id, { deleteRecording = true } = {}) {
    assertSessionId(id);
    const session = await store.get(id);
    if (!session || session.mode !== 'local_capture') throw new Error('Local capture session not found');

    if (deleteRecording) {
      await this.deleteRecordingFile(id, session);
    }

    return store.delete(id);
  }
}

module.exports = new LocalCaptureService();
