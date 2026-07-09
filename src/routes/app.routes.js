const express = require('express');
const localCapture = require('../services/local-capture.service');
const store = require('../services/session-store');
const transcriptionService = require('../services/transcription.service');
const logger = require('../utils/logger');
const { enrichSession } = require('../utils/hinglish');
const {
  answerQuestion,
  buildBrief,
  buildMeetingIntelligence,
  enrichMeetingSession,
  templates
} = require('../services/meeting-intelligence.service');
const { timingSafeEqualString } = require('../utils/security');

const router = express.Router();

function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) return next();

  const auth = req.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
  const provided = req.get('x-api-key') || bearer;
  if (!timingSafeEqualString(provided, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function decorateSession(session, allSessions = []) {
  const enriched = enrichMeetingSession(enrichSession(session));
  return {
    ...enriched,
    brief: buildBrief(enriched, allSessions)
  };
}

function cleanString(value, limit = 5000) {
  return String(value || '').slice(0, limit);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

router.get('/health', async (_req, res) => {
  const providersConfigured = transcriptionService.configuredProviders();
  res.json({
    ok: true,
    service: 'scribely',
    providersConfigured,
    supportedProviders: transcriptionService.supportedProviders()
  });
});

router.get('/meetings', requireApiKey, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const sessions = await store.list({ userId: req.query.user_id, limit });
    res.json({ ok: true, sessions: sessions.map(session => decorateSession(session, sessions)) });
  } catch (error) {
    next(error);
  }
});

router.get('/meetings/templates', requireApiKey, (_req, res) => {
  res.json({ ok: true, templates: templates() });
});

router.get('/meetings/export.csv', requireApiKey, async (req, res, next) => {
  try {
    const sessions = await store.list({ userId: req.query.user_id, limit: 200 });
    const rows = [
      ['id', 'title', 'status', 'date', 'template', 'folder', 'space', 'summary', 'transcript']
    ];
    for (const session of sessions.map(item => decorateSession(item, sessions))) {
      rows.push([
        session.id,
        session.title || '',
        session.status || '',
        session.startedAt || session.createdAt || '',
        session.noteTemplate || '',
        session.folder || '',
        session.space || '',
        (session.meetingIntelligence?.summary || []).join(' | '),
        session.transcriptHinglish || session.transcript || ''
      ]);
    }
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="scribely-notes.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.post('/meetings/ask', requireApiKey, async (req, res, next) => {
  try {
    const sessions = (await store.list({ userId: req.body?.user_id, limit: 200 })).map(enrichSession);
    const result = answerQuestion(cleanString(req.body?.question, 1000), sessions);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.get('/meetings/:id', requireApiKey, async (req, res, next) => {
  try {
    const session = await store.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Meeting session not found' });
    const sessions = (await store.list({ limit: 200 })).map(enrichSession);
    res.json({ ok: true, session: decorateSession(session, sessions) });
  } catch (error) {
    next(error);
  }
});

router.patch('/meetings/:id/notes', requireApiKey, async (req, res, next) => {
  try {
    const session = await store.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Meeting session not found' });
    const hasRawNotes = req.body?.raw_notes !== undefined || req.body?.rawNotes !== undefined;
    const patch = {
      rawNotes: hasRawNotes ? cleanString(req.body?.raw_notes ?? req.body?.rawNotes, 20000) : session.rawNotes,
      noteTemplate: cleanString(req.body?.note_template ?? req.body?.noteTemplate, 80) || session.noteTemplate || 'general',
      folder: cleanString(req.body?.folder, 120) || session.folder || 'My notes',
      space: cleanString(req.body?.space, 80) || session.space || 'Private'
    };
    patch.meetingIntelligence = buildMeetingIntelligence({ ...session, ...patch });
    const updated = await store.update(req.params.id, patch);
    const sessions = (await store.list({ limit: 200 })).map(enrichSession);
    res.json({ ok: true, session: decorateSession(updated, sessions) });
  } catch (error) {
    next(error);
  }
});

router.post('/meetings/:id/regenerate-notes', requireApiKey, async (req, res, next) => {
  try {
    const session = await store.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Meeting session not found' });
    const patch = {
      rawNotes: req.body?.raw_notes !== undefined ? cleanString(req.body.raw_notes, 20000) : session.rawNotes,
      noteTemplate: cleanString(req.body?.note_template ?? req.body?.noteTemplate, 80) || session.noteTemplate || 'general'
    };
    patch.meetingIntelligence = buildMeetingIntelligence({ ...session, ...patch });
    const updated = await store.update(req.params.id, patch);
    const sessions = (await store.list({ limit: 200 })).map(enrichSession);
    res.json({ ok: true, session: decorateSession(updated, sessions) });
  } catch (error) {
    next(error);
  }
});

router.post('/meetings/:id/ask', requireApiKey, async (req, res, next) => {
  try {
    const session = await store.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Meeting session not found' });
    const sessions = (await store.list({ limit: 200 })).map(enrichSession);
    const result = answerQuestion(cleanString(req.body?.question, 1000), sessions, { sessionId: req.params.id });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.delete('/meetings/:id', requireApiKey, async (req, res, next) => {
  try {
    const session = await store.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Meeting session not found' });

    let removed;
    if (session.mode === 'local_capture') {
      removed = await localCapture.delete(req.params.id, {
        deleteRecording: req.query.delete_recording !== 'false'
      });
    } else {
      removed = await store.delete(req.params.id);
    }

    res.json({ ok: true, session: removed });
  } catch (error) {
    next(error);
  }
});

router.post('/local-capture/start', requireApiKey, async (req, res, next) => {
  try {
    const session = await localCapture.start({
      userId: String(req.body?.user_id || 'local-user').slice(0, 100),
      title: String(req.body?.title || 'Local meeting recording').slice(0, 200),
      sourceLabel: req.body?.source_label ? String(req.body.source_label).slice(0, 200) : null,
      rawNotes: cleanString(req.body?.raw_notes ?? req.body?.rawNotes, 20000),
      noteTemplate: cleanString(req.body?.note_template ?? req.body?.noteTemplate, 80) || 'general',
      folder: cleanString(req.body?.folder, 120) || 'My notes',
      space: cleanString(req.body?.space, 80) || 'Private',
      provider: cleanString(req.body?.provider, 40) || null,
      deleteAudioAfterTranscription: req.body?.delete_audio_after_transcription !== false
    });
    res.status(201).json({ ok: true, session });
  } catch (error) {
    next(error);
  }
});

router.post('/local-capture/:id/chunk', requireApiKey, express.raw({ type: '*/*', limit: '50mb' }), async (req, res, next) => {
  try {
    const session = await localCapture.appendChunk(req.params.id, req.body, req.get('x-chunk-sequence'));
    res.json({
      ok: true,
      sessionId: session.id,
      chunkCount: session.chunkCount,
      recordingBytes: session.recordingBytes
    });
  } catch (error) {
    next(error);
  }
});

router.post('/local-capture/:id/finish', requireApiKey, async (req, res, next) => {
  try {
    const finishOptions = {
      provider: cleanString(req.body?.provider, 40) || null,
      apiKey: cleanString(req.body?.api_key ?? req.body?.provider_api_key ?? req.body?.apiKey, 2000)
    };
    res.status(202).json({ ok: true, sessionId: req.params.id, status: 'transcribing' });
    localCapture.finish(req.params.id, finishOptions).catch(error => {
      logger.error({ err: error.message, sessionId: req.params.id }, 'Local capture finish failed');
    });
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  logger.error({ err: error.message, stack: error.stack }, 'Request failed');
  res.status(500).json({ ok: false, error: error.message });
});

module.exports = router;
