const state = {
  activeView: 'recorder',
  sessionId: null,
  selectedSessionId: null,
  selectedSession: null,
  sessions: [],
  calendarDate: new Date(),
  transcriptMode: 'hinglish',
  detailTab: 'notes',
  recorder: null,
  displayStream: null,
  micStream: null,
  mixedStream: null,
  captureStream: null,
  audioContext: null,
  analyserNodes: {},
  chunkSequence: 0,
  bytesUploaded: 0,
  startedAt: null,
  timerId: null,
  noChunkWarningId: null,
  noteSaveTimer: null,
  uploadQueue: Promise.resolve(),
  pollingId: null,
  pendingDeleteId: null,
  chatAnswers: {},
  providerApiKeys: {},
  selectedProviderId: 'assemblyai',
  connection: {
    server: false,
    auth: false,
    providerKey: false
  }
};

const PROVIDER_META = {
  assemblyai: {
    label: 'AssemblyAI',
    keyLabel: 'AssemblyAI API key',
    placeholder: 'Paste your AssemblyAI API key',
    help: 'Fast cloud transcription with speaker labels and strong meeting-note support.',
    requiresApiKey: true
  },
  deepgram: {
    label: 'Deepgram',
    keyLabel: 'Deepgram API key',
    placeholder: 'Paste your Deepgram API key',
    help: 'Fast cloud transcription for teams that already use Deepgram.',
    requiresApiKey: true
  },
  openai: {
    label: 'OpenAI Whisper',
    keyLabel: 'OpenAI API key',
    placeholder: 'Paste your OpenAI API key',
    help: 'Simple cloud transcription. Speaker labels are limited.',
    requiresApiKey: true
  }
};

const viewCopy = {
  recorder: {
    title: 'Record',
    subtitle: 'Capture meeting audio from this computer and save notes locally.'
  },
  library: {
    title: 'Meetings',
    subtitle: 'Search transcripts, review notes, and manage saved recordings.'
  },
  calendar: {
    title: 'Calendar',
    subtitle: 'Review saved meetings by day and jump back into the transcript.'
  },
  settings: {
    title: 'Settings',
    subtitle: 'Choose the transcription provider this computer should use.'
  }
};

const els = {
  navItems: Array.from(document.querySelectorAll('.nav-item')),
  views: {
    recorder: document.getElementById('recorderView'),
    library: document.getElementById('libraryView'),
    calendar: document.getElementById('calendarView'),
    settings: document.getElementById('settingsView')
  },
  viewTitle: document.getElementById('viewTitle'),
  viewSubtitle: document.getElementById('viewSubtitle'),
  refreshAppButton: document.getElementById('refreshAppButton'),
  sidebarNewRecordingButton: document.getElementById('sidebarNewRecordingButton'),
  form: document.getElementById('settingsForm'),
  apiBaseUrl: document.getElementById('apiBaseUrl'),
  apiKey: document.getElementById('apiKey'),
  transcriptionProvider: document.getElementById('transcriptionProvider'),
  providerCardList: document.getElementById('providerCardList'),
  providerApiKey: document.getElementById('providerApiKey'),
  providerKeyLabel: document.getElementById('providerKeyLabel'),
  providerKeyHelp: document.getElementById('providerKeyHelp'),
  userId: document.getElementById('userId'),
  meetingTitle: document.getElementById('meetingTitle'),
  meetingTemplate: document.getElementById('meetingTemplate'),
  rawNotes: document.getElementById('rawNotes'),
  includeMic: document.getElementById('includeMic'),
  deleteAudioAfterTranscription: document.getElementById('deleteAudioAfterTranscription'),
  statusPill: document.getElementById('statusPill'),
  sidebarStatusDot: document.getElementById('sidebarStatusDot'),
  sidebarStatusTitle: document.getElementById('sidebarStatusTitle'),
  sidebarStatusText: document.getElementById('sidebarStatusText'),
  timer: document.getElementById('timer'),
  startButton: document.getElementById('startButton'),
  stopButton: document.getElementById('stopButton'),
  setupCard: document.getElementById('setupCard'),
  setupTitle: document.getElementById('setupTitle'),
  setupText: document.getElementById('setupText'),
  openSettingsButton: document.getElementById('openSettingsButton'),
  openCurrentButton: document.getElementById('openCurrentButton'),
  copyCurrentButton: document.getElementById('copyCurrentButton'),
  testConnectionButton: document.getElementById('testConnectionButton'),
  sessionId: document.getElementById('sessionId'),
  chunkCount: document.getElementById('chunkCount'),
  bytesUploaded: document.getElementById('bytesUploaded'),
  transcript: document.getElementById('transcript'),
  latestTranscriptTitle: document.getElementById('latestTranscriptTitle'),
  recordingTitle: document.getElementById('recordingTitle'),
  message: document.getElementById('message'),
  systemMeter: document.getElementById('systemMeter'),
  micMeter: document.getElementById('micMeter'),
  systemAudioText: document.getElementById('systemAudioText'),
  micAudioText: document.getElementById('micAudioText'),
  serverReadyRow: document.getElementById('serverReadyRow'),
  serverReadyText: document.getElementById('serverReadyText'),
  authReadyRow: document.getElementById('authReadyRow'),
  authReadyText: document.getElementById('authReadyText'),
  assemblyReadyRow: document.getElementById('assemblyReadyRow'),
  providerReadyTitle: document.getElementById('providerReadyTitle'),
  assemblyReadyText: document.getElementById('assemblyReadyText'),
  providerStepText: document.getElementById('providerStepText'),
  keyStepText: document.getElementById('keyStepText'),
  storageProviderText: document.getElementById('storageProviderText'),
  librarySearch: document.getElementById('librarySearch'),
  libraryStatusFilter: document.getElementById('libraryStatusFilter'),
  refreshLibraryButton: document.getElementById('refreshLibraryButton'),
  globalAskInput: document.getElementById('globalAskInput'),
  globalAskButton: document.getElementById('globalAskButton'),
  globalAskAnswer: document.getElementById('globalAskAnswer'),
  libraryCount: document.getElementById('libraryCount'),
  meetingList: document.getElementById('meetingList'),
  transcriptDetail: document.getElementById('transcriptDetail'),
  sidebarMeetingHeading: document.getElementById('sidebarMeetingHeading'),
  calendarMonthLabel: document.getElementById('calendarMonthLabel'),
  calendarRangeLabel: document.getElementById('calendarRangeLabel'),
  calendarWeekStrip: document.getElementById('calendarWeekStrip'),
  calendarHours: document.getElementById('calendarHours'),
  calendarDays: document.getElementById('calendarDays'),
  calendarTodayButton: document.getElementById('calendarTodayButton'),
  calendarPrevButton: document.getElementById('calendarPrevButton'),
  calendarNextButton: document.getElementById('calendarNextButton'),
  microphoneDevice: document.getElementById('microphoneDevice'),
  detectMeetingApps: document.getElementById('detectMeetingApps'),
  deleteDialog: document.getElementById('deleteDialog'),
  confirmDeleteButton: document.getElementById('confirmDeleteButton'),
  toastRegion: document.getElementById('toastRegion')
};

function icon(name) {
  return `<img class="icon" src="../../node_modules/lucide-static/icons/${name}.svg" alt="" />`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function selectedProvider() {
  return PROVIDER_META[els.transcriptionProvider.value] ? els.transcriptionProvider.value : 'assemblyai';
}

function selectedProviderMeta() {
  return PROVIDER_META[selectedProvider()];
}

function hasProviderKey() {
  if (selectedProviderMeta().requiresApiKey === false) return true;
  return Boolean(els.providerApiKey.value.trim());
}

function updateProviderCopy() {
  const meta = selectedProviderMeta();
  els.providerKeyLabel.textContent = meta.keyLabel;
  els.providerApiKey.placeholder = meta.placeholder;
  els.providerApiKey.disabled = meta.requiresApiKey === false;
  els.providerKeyHelp.textContent = meta.help;
  if (els.providerCardList) {
    for (const card of els.providerCardList.querySelectorAll('[data-provider-card]')) {
      card.classList.toggle('selected', card.dataset.providerCard === selectedProvider());
    }
  }
  els.providerReadyTitle.textContent = meta.requiresApiKey === false ? `${meta.label} setup` : `${meta.label} key`;
  els.providerStepText.textContent = `${meta.label} is selected.`;
  if (meta.requiresApiKey === false) {
    els.keyStepText.textContent = `${meta.label} runs locally. No API key needed.`;
  } else {
    els.keyStepText.textContent = hasProviderKey()
      ? `${meta.label} key saved on this computer.`
      : `Paste your ${meta.label} key in Settings.`;
  }
  els.storageProviderText.textContent = meta.label;
}

async function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('scribelyDesktopSettings') || localStorage.getItem('meetingBotDesktopSettings') || '{}');
  els.apiBaseUrl.value = saved.apiBaseUrl || 'http://127.0.0.1:3000';
  els.transcriptionProvider.value = PROVIDER_META[saved.transcriptionProvider] ? saved.transcriptionProvider : 'assemblyai';
  els.userId.value = saved.userId || 'local-user';
  els.meetingTitle.value = saved.meetingTitle || 'Untitled meeting';
  els.meetingTemplate.value = saved.meetingTemplate || 'general';
  els.rawNotes.value = saved.rawNotes || '';
  els.includeMic.checked = saved.includeMic !== false;
  els.deleteAudioAfterTranscription.checked = saved.deleteAudioAfterTranscription !== false;
  els.microphoneDevice.value = saved.microphoneDevice || 'default';
  els.detectMeetingApps.checked = saved.detectMeetingApps !== false;
  state.selectedProviderId = selectedProvider();

  let credentials = { apiKey: '', providerApiKeys: {} };
  try {
    credentials = await window.meetingBotDesktop.loadCredentials();
  } catch (error) {
    showToast('Could not load saved API keys from secure storage.', 'error');
  }

  state.providerApiKeys = credentials.providerApiKeys || {};
  els.apiKey.value = credentials.apiKey || saved.apiKey || '';
  els.providerApiKey.value = state.providerApiKeys[selectedProvider()] || saved.providerApiKey || '';

  // Move credentials from earlier app versions out of browser storage once.
  if (saved.apiKey || saved.providerApiKey) {
    rememberProviderKey();
    persistCredentials();
  }
  saveSettings();
  updateProviderCopy();
}

function saveSettings() {
  localStorage.setItem('scribelyDesktopSettings', JSON.stringify({
    apiBaseUrl: els.apiBaseUrl.value.trim(),
    transcriptionProvider: selectedProvider(),
    userId: els.userId.value.trim(),
    meetingTitle: els.meetingTitle.value.trim(),
    meetingTemplate: els.meetingTemplate.value,
    rawNotes: els.rawNotes.value,
    includeMic: els.includeMic.checked,
    deleteAudioAfterTranscription: els.deleteAudioAfterTranscription.checked,
    microphoneDevice: els.microphoneDevice.value,
    detectMeetingApps: els.detectMeetingApps.checked
  }));
}

function rememberProviderKey(provider = selectedProvider()) {
  const key = els.providerApiKey.value;
  if (key.trim()) state.providerApiKeys[provider] = key;
  else delete state.providerApiKeys[provider];
}

function persistCredentials() {
  const save = window.meetingBotDesktop?.saveCredentials;
  if (typeof save !== 'function') return;
  void save({
    apiKey: els.apiKey.value,
    providerApiKeys: state.providerApiKeys
  }).catch(() => showToast('Could not save the API key securely on this computer.', 'error'));
}

function setProvider(provider) {
  if (!PROVIDER_META[provider]) return;
  rememberProviderKey(state.selectedProviderId);
  els.transcriptionProvider.value = provider;
  state.selectedProviderId = provider;
  els.providerApiKey.value = state.providerApiKeys[provider] || '';
  saveSettings();
  persistCredentials();
  updateProviderCopy();
  updateConnectionUi();
  testConnection({ quiet: true }).catch(() => updateConnectionUi());
}

function apiUrl(path) {
  return `${els.apiBaseUrl.value.trim().replace(/\/$/, '')}${path}`;
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (els.apiKey.value) headers.authorization = `Bearer ${els.apiKey.value}`;
  return headers;
}

function friendlyError(error) {
  const message = String(error?.message || error || '');
  if (/Request failed with status code 401/i.test(message)) {
    return `${selectedProviderMeta().label} rejected the API key. Open Settings, paste a valid provider key, then try again.`;
  }
  if (/unauthorized/i.test(message) || /401/.test(message)) {
    return 'The local server access key is incorrect. Open Settings, then check the advanced server key.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Cannot reach the Scribely app server. Check that the local server is running.';
  }
  if (/No .* API key/i.test(message)) {
    return `Add your ${selectedProviderMeta().label} API key in Settings, then try again.`;
  }
  if (/No audio track/i.test(message)) {
    return 'No audio was captured. Enable microphone or share a window with audio.';
  }
  if (/Permission denied|NotAllowedError/i.test(message)) {
    return 'Recording permission was denied. Allow screen and microphone access to continue.';
  }
  return message || 'Something went wrong.';
}

async function requestJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: authHeaders({
      'content-type': 'application/json',
      ...(options.headers || {})
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function saveSessionNotes(id = state.sessionId, { quiet = true } = {}) {
  if (!id) return null;
  const data = await requestJson(`/meetings/${id}/notes`, {
    method: 'PATCH',
    body: JSON.stringify({
      raw_notes: els.rawNotes.value,
      note_template: els.meetingTemplate.value,
      folder: 'My notes',
      space: 'Private'
    })
  });
  if (!quiet) showToast('Notes saved.');
  if (state.selectedSessionId === id) {
    state.selectedSession = data.session;
    renderTranscriptDetail(state.selectedSession);
  }
  return data.session;
}

function scheduleNotesSave() {
  saveSettings();
  if (!state.sessionId || !state.recorder || state.recorder.state !== 'recording') return;
  if (state.noteSaveTimer) clearTimeout(state.noteSaveTimer);
  state.noteSaveTimer = setTimeout(() => {
    saveSessionNotes(state.sessionId).catch(error => showToast(friendlyError(error), 'error'));
  }, 900);
}

function setStatus(status, label) {
  els.statusPill.className = `status-pill ${status}`;
  els.statusPill.textContent = label;
}

function setMessage(text, type = 'neutral') {
  els.message.textContent = text || '';
  els.message.dataset.type = type;
}

function showToast(text, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = text;
  els.toastRegion.appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function recordingStorageLabel(session) {
  if (session?.recordingPath || session?.recordingRetained) {
    return formatBytes(session.recordingBytes);
  }
  return 'Audio deleted';
}

function formatTimer(ms) {
  const total = Math.floor(ms / 1000);
  const mins = Math.floor(total / 60).toString().padStart(2, '0');
  const secs = (total % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function startOfWeek(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isSameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatCalendarTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function meetingDate(session) {
  const date = new Date(session.startedAt || session.createdAt || session.updatedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function meetingDurationMinutes(session) {
  const started = new Date(session.startedAt || session.createdAt);
  const ended = new Date(session.endedAt || session.completedAt || session.updatedAt);
  if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime()) || ended <= started) {
    return 45;
  }
  return Math.max(20, Math.min(180, Math.round((ended - started) / 60000)));
}

function statusLabel(status) {
  return String(status || 'unknown')
    .replace(/_/g, ' ')
    .replace(/^\w/, char => char.toUpperCase());
}

function sessionTitle(session) {
  return session?.title || session?.meetingId || session?.id || 'Untitled meeting';
}

function templateLabel(value) {
  return {
    general: 'General meeting',
    product: 'Product review',
    sales: 'Sales call',
    interview: 'User interview',
    standup: 'Stand-up',
    one_on_one: '1:1',
    hiring: 'Hiring interview'
  }[value] || 'General meeting';
}

function providerDisplay(value) {
  const provider = value === 'whisper' ? 'openai' : String(value || '').toLowerCase();
  return PROVIDER_META[provider]?.label || value || 'Provider';
}

function compactDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'New';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function longDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function meetingApp(session) {
  return session?.app || session?.meetingApp || (session?.source === 'calendar' ? 'Calendar' : 'Zoom');
}

function durationLabel(session) {
  const started = new Date(session?.startedAt || session?.createdAt);
  const ended = new Date(session?.endedAt || session?.completedAt || session?.updatedAt);
  if (!Number.isNaN(started.getTime()) && !Number.isNaN(ended.getTime()) && ended > started) {
    return formatTimer(ended - started);
  }
  if (session?.duration) return session.duration;
  return session?.status === 'completed' ? 'Saved' : statusLabel(session?.status);
}

function speakerInitials(name = '') {
  const cleaned = String(name || 'Speaker').trim();
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'SP';
}

function transcriptSegments(session) {
  const utterances = session?.utterances || [];
  if (utterances.length) {
    return utterances.map((utterance, index) => ({
      time: utterance.start ? formatTimer(utterance.start * 1000) : formatTimer(index * 30000),
      speaker: utterance.speaker || `Speaker ${index + 1}`,
      initials: speakerInitials(utterance.speaker),
      text: utterance.textHinglish || utterance.text || ''
    })).filter(segment => segment.text);
  }

  const text = transcriptText(session, 'hinglish') || transcriptText(session, 'original') || session?.error || 'Transcript will appear after transcription finishes.';
  return [{
    time: '00:00',
    speaker: 'Transcript',
    initials: 'TR',
    text
  }];
}

function intelligence(session) {
  return session?.meetingIntelligence || {};
}

function bullets(items, empty = 'No items found.') {
  const list = (items || []).filter(Boolean);
  if (list.length === 0) return `- ${empty}`;
  return list.map(item => `- ${typeof item === 'string' ? item : item.text}`).join('\n');
}

function noteMarkdown(session) {
  const smart = intelligence(session);
  if (smart.enhancedMarkdown) return smart.enhancedMarkdown;
  return [
    `# ${sessionTitle(session)}`,
    '',
    '## Summary',
    bullets(smart.summary),
    '',
    '## Action items',
    bullets(smart.actionItems),
    '',
    '## Raw notes',
    session?.rawNotes || 'No raw notes.'
  ].join('\n');
}

function currentDetailText(session) {
  const smart = intelligence(session);
  if (state.detailTab === 'transcript') return transcriptText(session);
  if (state.detailTab === 'actions') {
    return [
      '## Action items',
      bullets(smart.actionItems),
      '',
      '## Follow-up email',
      smart.followUpEmail || '',
      '',
      '## Project plan',
      smart.projectPlan || ''
    ].join('\n');
  }
  if (state.detailTab === 'brief') {
    const brief = session?.brief || {};
    return [
      '## Brief',
      bullets(brief.context),
      '',
      '## Open threads',
      bullets(brief.openThreads),
      '',
      '## Suggested agenda',
      bullets(brief.suggestedAgenda)
    ].join('\n');
  }
  return noteMarkdown(session);
}

function transcriptText(session, mode = state.transcriptMode) {
  if (!session) return '';
  const useHinglish = mode !== 'original';
  if (useHinglish) {
    return session.diarizedTranscriptHinglish
      || session.transcriptHinglish
      || session.diarizedTranscript
      || session.transcript
      || '';
  }
  return session.diarizedTranscript
    || session.transcript
    || session.diarizedTranscriptHinglish
    || session.transcriptHinglish
    || '';
}

function hasTranscript(session) {
  return Boolean(transcriptText(session, 'hinglish') || transcriptText(session, 'original'));
}

function setView(name) {
  state.activeView = name;
  for (const [viewName, element] of Object.entries(els.views)) {
    element.classList.toggle('active', viewName === name);
  }
  for (const item of els.navItems) {
    const active = item.dataset.view === name;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
  els.viewTitle.textContent = viewCopy[name].title;
  els.viewSubtitle.textContent = viewCopy[name].subtitle;
  if (name === 'library') loadLibrary().catch(error => showToast(friendlyError(error), 'error'));
  if (name === 'calendar') {
    renderCalendar();
    loadLibrary().catch(error => showToast(friendlyError(error), 'error'));
  }
}

function updateDot(row, stateName) {
  const dot = row.querySelector('.status-dot');
  dot.className = `status-dot ${stateName}`;
}

function updateConnectionUi() {
  updateDot(els.serverReadyRow, state.connection.server ? 'good' : 'bad');
  updateDot(els.authReadyRow, state.connection.auth ? 'good' : 'bad');
  updateDot(els.assemblyReadyRow, state.connection.providerKey ? 'good' : 'bad');

  els.serverReadyText.textContent = state.connection.server ? 'Connected' : 'Not connected';
  els.authReadyText.textContent = state.connection.auth ? 'Ready' : 'Check advanced server key';
  els.assemblyReadyText.textContent = state.connection.providerKey
    ? (selectedProviderMeta().requiresApiKey === false ? 'Local provider selected' : 'Key ready')
    : (selectedProviderMeta().requiresApiKey === false ? 'Local setup missing' : 'Add key in Settings');
  updateProviderCopy();

  const ready = state.connection.server && state.connection.auth && state.connection.providerKey;
  els.sidebarStatusDot.className = `status-dot ${ready ? 'good' : 'bad'}`;
  els.sidebarStatusTitle.textContent = ready ? 'Ready to record' : 'Setup needed';
  els.sidebarStatusText.textContent = ready ? `${selectedProviderMeta().label} connected` : 'Open Settings';
  els.setupCard.classList.toggle('ready', ready);
  els.setupTitle.textContent = ready ? 'Ready to record' : 'Add your transcription key';
  els.setupText.textContent = ready
    ? `${selectedProviderMeta().label} is selected. Your next recording will be transcribed after you end it.`
    : `Choose a provider in Settings and paste the API key Scribely should use.`;
  if (!state.recorder || state.recorder.state !== 'recording') {
    els.startButton.disabled = !ready;
  }
  return ready;
}

function isRecorderReady() {
  return state.connection.server && state.connection.auth && state.connection.providerKey;
}

function recorderSetupMessage() {
  if (!state.connection.server) {
    return 'Cannot reach the Scribely app server. Check that the local server is running.';
  }
  if (!state.connection.auth) {
    return 'Local server access is not ready. Open Settings and check Advanced local server settings.';
  }
  if (!state.connection.providerKey) {
    if (selectedProviderMeta().requiresApiKey === false) {
      return `${selectedProviderMeta().label} local setup is not ready.`;
    }
    return `Add your ${selectedProviderMeta().label} API key in Settings.`;
  }
  return 'Recorder setup is not ready. Open Settings and check the connection.';
}

async function testConnection({ quiet = false } = {}) {
  state.connection = { server: false, auth: false, providerKey: hasProviderKey() };
  els.serverReadyText.textContent = 'Checking';
  els.authReadyText.textContent = 'Checking';
  els.assemblyReadyText.textContent = 'Checking';
  updateDot(els.serverReadyRow, 'warning');
  updateDot(els.authReadyRow, 'warning');
  updateDot(els.assemblyReadyRow, 'warning');

  try {
    const healthResponse = await fetch(apiUrl('/health'));
    if (!healthResponse.ok) throw new Error(`HTTP ${healthResponse.status}`);
    const health = await healthResponse.json();
    state.connection.server = Boolean(health.ok);
    state.connection.providerKey = hasProviderKey() || Boolean(health.providersConfigured?.[selectedProvider()]);

    await requestJson('/meetings?limit=1');
    state.connection.auth = true;

    const ready = updateConnectionUi();
    if (!quiet) showToast(ready ? 'Recorder is ready.' : recorderSetupMessage(), ready ? 'success' : 'error');
    return ready;
  } catch (error) {
    updateConnectionUi();
    if (!quiet) showToast(friendlyError(error), 'error');
    return false;
  }
}

function startTimer() {
  state.startedAt = Date.now();
  els.timer.textContent = '00:00';
  state.timerId = setInterval(() => {
    els.timer.textContent = formatTimer(Date.now() - state.startedAt);
  }, 500);
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function clearNoChunkWarning() {
  if (state.noChunkWarningId) clearTimeout(state.noChunkWarningId);
  state.noChunkWarningId = null;
}

function startNoChunkWarning() {
  clearNoChunkWarning();
  state.noChunkWarningId = setTimeout(() => {
    const isRecording = state.recorder && state.recorder.state === 'recording';
    if (isRecording && state.bytesUploaded === 0) {
      setMessage('No audio chunks have uploaded yet. Check the audio meters, then end and restart if they stay silent.', 'error');
    }
  }, 15000);
}

function createAnalyser(stream, key, meter) {
  if (!stream || stream.getAudioTracks().length === 0) {
    meter.value = 0;
    return null;
  }
  const source = state.audioContext.createMediaStreamSource(stream);
  const analyser = state.audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  state.analyserNodes[key] = { analyser, data: new Uint8Array(analyser.frequencyBinCount), meter };
  return source;
}

function tickMeters() {
  for (const [key, item] of Object.entries(state.analyserNodes)) {
    item.analyser.getByteFrequencyData(item.data);
    const avg = item.data.reduce((sum, value) => sum + value, 0) / item.data.length;
    const level = Math.min(avg / 100, 1);
    item.meter.value = level;
    const label = level > 0.04 ? 'Audio detected' : 'Listening';
    if (key === 'system') els.systemAudioText.textContent = label;
    if (key === 'mic') els.micAudioText.textContent = label;
  }
  if (state.recorder && state.recorder.state === 'recording') {
    requestAnimationFrame(tickMeters);
  }
}

async function captureStreams() {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: {
      width: 1280,
      height: 720,
      frameRate: 10
    }
  });

  let micStream = null;
  if (els.includeMic.checked) {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  }

  state.audioContext = new AudioContext();
  const destination = state.audioContext.createMediaStreamDestination();

  const displayAudioTracks = displayStream.getAudioTracks();
  if (displayAudioTracks.length > 0) {
    const systemSource = createAnalyser(new MediaStream(displayAudioTracks), 'system', els.systemMeter);
    if (systemSource) systemSource.connect(destination);
  } else {
    els.systemAudioText.textContent = 'Not captured';
  }

  if (micStream && micStream.getAudioTracks().length > 0) {
    const micSource = createAnalyser(micStream, 'mic', els.micMeter);
    if (micSource) micSource.connect(destination);
  } else {
    els.micAudioText.textContent = els.includeMic.checked ? 'Not captured' : 'Off';
  }

  if (destination.stream.getAudioTracks().length === 0) {
    throw new Error('No audio track was captured. Pick a screen/window with audio enabled, or enable microphone.');
  }

  const captureStream = new MediaStream([
    ...displayStream.getVideoTracks(),
    ...destination.stream.getAudioTracks()
  ]);

  return { displayStream, micStream, mixedStream: destination.stream, captureStream };
}

function stopStreams() {
  for (const stream of [state.displayStream, state.micStream, state.mixedStream, state.captureStream]) {
    if (stream) stream.getTracks().forEach(track => track.stop());
  }
  if (state.audioContext) state.audioContext.close().catch(() => {});
  state.displayStream = null;
  state.micStream = null;
  state.mixedStream = null;
  state.captureStream = null;
  state.audioContext = null;
  state.analyserNodes = {};
  els.systemMeter.value = 0;
  els.micMeter.value = 0;
  els.systemAudioText.textContent = 'Waiting';
  els.micAudioText.textContent = 'Waiting';
}

async function uploadChunk(blob) {
  if (!state.sessionId || !blob || blob.size === 0) return;
  const sequence = state.chunkSequence += 1;
  const buffer = await blob.arrayBuffer();
  state.uploadQueue = state.uploadQueue.then(async () => {
    const response = await fetch(apiUrl(`/local-capture/${state.sessionId}/chunk`), {
      method: 'POST',
      headers: authHeaders({
        'content-type': 'application/octet-stream',
        'x-chunk-sequence': String(sequence)
      }),
      body: buffer
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Chunk upload failed (${response.status})`);
    state.bytesUploaded = data.recordingBytes || state.bytesUploaded + buffer.byteLength;
    els.chunkCount.textContent = String(data.chunkCount || sequence);
    els.bytesUploaded.textContent = formatBytes(state.bytesUploaded);
  }).catch((error) => {
    setMessage(friendlyError(error), 'error');
    throw error;
  });
  return state.uploadQueue;
}

function recorderMimeType(stream) {
  const hasVideo = Boolean(stream?.getVideoTracks?.().length);
  const candidates = hasVideo
    ? [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=opus',
        'video/webm'
      ]
    : [
        'audio/webm;codecs=opus',
        'audio/webm',
        'video/webm;codecs=opus',
        'video/webm'
      ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function resetRecordingUi() {
  clearNoChunkWarning();
  state.chunkSequence = 0;
  state.bytesUploaded = 0;
  state.uploadQueue = Promise.resolve();
  els.chunkCount.textContent = '0';
  els.bytesUploaded.textContent = '0 KB';
  els.sessionId.textContent = 'None';
  els.timer.textContent = '00:00';
}

async function startRecording() {
  saveSettings();
  setMessage('Checking recorder setup...');
  els.startButton.disabled = true;
  els.stopButton.disabled = true;
  els.openCurrentButton.disabled = true;
  els.copyCurrentButton.disabled = true;
  resetRecordingUi();

  const ready = await testConnection({ quiet: true });
  if (!ready) {
    throw new Error(recorderSetupMessage());
  }

  setMessage('Choose the meeting window or screen from the system picker.');
  const streams = await captureStreams();
  state.displayStream = streams.displayStream;
  state.micStream = streams.micStream;
  state.mixedStream = streams.mixedStream;
  state.captureStream = streams.captureStream;

  const title = els.meetingTitle.value.trim() || 'Local meeting recording';
  const sessionResponse = await requestJson('/local-capture/start', {
    method: 'POST',
    body: JSON.stringify({
      user_id: els.userId.value.trim() || 'local-user',
      title,
      source_label: 'desktop',
      raw_notes: els.rawNotes.value,
      note_template: els.meetingTemplate.value,
      folder: 'My notes',
      space: 'Private',
      provider: selectedProvider(),
      delete_audio_after_transcription: els.deleteAudioAfterTranscription.checked
    })
  });

  state.sessionId = sessionResponse.session.id;
  els.sessionId.textContent = state.sessionId;
  els.recordingTitle.textContent = title;
  els.latestTranscriptTitle.textContent = title;
  els.transcript.textContent = 'Recording in progress. Click End recording to upload and transcribe.';

  const mimeType = recorderMimeType(state.captureStream);
  state.recorder = new MediaRecorder(state.captureStream, mimeType ? { mimeType } : undefined);
  state.recorder.ondataavailable = event => {
    if (event.data && event.data.size > 0) uploadChunk(event.data).catch(() => {});
  };
  state.recorder.onerror = event => setMessage(friendlyError(event.error), 'error');
  state.recorder.start(10000);

  setStatus('recording', 'Recording');
  setMessage('Recording meeting video and audio. Transcription starts after you click End recording.');
  els.stopButton.disabled = false;
  startTimer();
  startNoChunkWarning();
  tickMeters();
}

async function stopRecording() {
  els.stopButton.disabled = true;
  setStatus('transcribing', 'Transcribing');
  setMessage('Finishing upload...');
  clearNoChunkWarning();

  await new Promise(resolve => {
    if (!state.recorder || state.recorder.state === 'inactive') return resolve();
    state.recorder.onstop = resolve;
    if (state.recorder.state === 'recording' && typeof state.recorder.requestData === 'function') {
      state.recorder.requestData();
    }
    state.recorder.stop();
  });

  stopTimer();
  stopStreams();
  await state.uploadQueue;
  await saveSessionNotes(state.sessionId);

  if (state.bytesUploaded < 1024) {
    throw new Error('No audio chunks were uploaded. Start a new recording and make sure the meeting audio or microphone meter is moving.');
  }

  await requestJson(`/local-capture/${state.sessionId}/finish`, {
    method: 'POST',
    body: JSON.stringify({
      provider: selectedProvider(),
      api_key: els.providerApiKey.value.trim()
    })
  });
  setMessage(`Transcribing with ${selectedProviderMeta().label}...`);
  pollSession();
}

async function refreshSession(id = state.sessionId) {
  if (!id) return null;
  const data = await requestJson(`/meetings/${id}`);
  const session = data.session;

  if (session.recordingBytes) els.bytesUploaded.textContent = formatBytes(session.recordingBytes);
  if (session.chunkCount) els.chunkCount.textContent = String(session.chunkCount);

  if (session.status === 'completed') {
    setStatus('completed', 'Completed');
    const completedTranscript = transcriptText(session, 'hinglish');
    els.transcript.textContent = completedTranscript || 'Completed, but the transcript is empty.';
    els.latestTranscriptTitle.textContent = sessionTitle(session);
    setMessage('Meeting saved to Meetings.');
    els.startButton.disabled = false;
    els.stopButton.disabled = true;
    els.openCurrentButton.disabled = false;
    els.copyCurrentButton.disabled = !hasTranscript(session);
    if (state.pollingId) clearInterval(state.pollingId);
    state.pollingId = null;
    await loadLibrary({ quiet: true });
  } else if (session.status === 'failed') {
    setStatus('idle', 'Failed');
    els.transcript.textContent = session.error || 'Transcription failed.';
    els.latestTranscriptTitle.textContent = sessionTitle(session);
    setMessage(friendlyError(session.error || 'Transcription failed.'), 'error');
    els.startButton.disabled = false;
    els.stopButton.disabled = true;
    els.openCurrentButton.disabled = false;
    if (state.pollingId) clearInterval(state.pollingId);
    state.pollingId = null;
    await loadLibrary({ quiet: true });
  } else {
    setStatus(session.status === 'recording' ? 'recording' : 'transcribing', statusLabel(session.status));
  }
  return session;
}

function pollSession() {
  if (state.pollingId) clearInterval(state.pollingId);
  refreshSession().catch(error => setMessage(friendlyError(error), 'error'));
  state.pollingId = setInterval(() => {
    refreshSession().catch(error => setMessage(friendlyError(error), 'error'));
  }, 5000);
}

function filteredSessions() {
  const query = els.librarySearch.value.trim().toLowerCase();
  const status = els.libraryStatusFilter.value;
  return state.sessions.filter(session => {
    if (status !== 'all' && session.status !== status) return false;
    if (!query) return true;
    return [
      sessionTitle(session),
      session.status,
      session.rawNotes,
      session.noteTemplate,
      session.folder,
      session.space,
      ...(intelligence(session).summary || []),
      ...(intelligence(session).decisions || []),
      ...(intelligence(session).actionItems || []).map(item => item.text),
      session.transcript,
      session.transcriptHinglish,
      session.diarizedTranscript,
      session.diarizedTranscriptHinglish,
      ...(session.utterances || []).flatMap(utterance => [
        utterance.text,
        utterance.textHinglish,
        utterance.speaker
      ]),
      session.error,
      session.id
    ].some(value => String(value || '').toLowerCase().includes(query));
  });
}

function renderMeetingList() {
  const sessions = filteredSessions();
  els.libraryCount.textContent = String(sessions.length);
  if (els.sidebarMeetingHeading) {
    const query = els.librarySearch.value.trim();
    els.sidebarMeetingHeading.textContent = query ? `${sessions.length} ${sessions.length === 1 ? 'result' : 'results'}` : 'Meetings';
  }

  if (sessions.length === 0) {
    els.meetingList.innerHTML = `
      <div class="empty-state">
        <img class="empty-icon" src="../../node_modules/lucide-static/icons/inbox.svg" alt="" />
        <h3>No meetings found</h3>
        <p>Start a new recording or adjust the search.</p>
      </div>
    `;
    return;
  }

  els.meetingList.innerHTML = sessions.map(session => `
    <button class="meeting-item ${session.id === state.selectedSessionId ? 'active' : ''}" type="button" data-session-id="${escapeHtml(session.id)}">
      <div class="meeting-item-top">
        <span class="meeting-title">${escapeHtml(sessionTitle(session))}</span>
        <span class="meeting-date">${escapeHtml(compactDate(session.startedAt || session.createdAt))}</span>
      </div>
      <div class="meeting-meta">
        <span>${escapeHtml(meetingApp(session))}</span>
        <span class="meta-dot"></span>
        <span>${escapeHtml(durationLabel(session))}</span>
      </div>
    </button>
  `).join('');
}

function renderCalendar() {
  const weekStart = startOfWeek(state.calendarDate);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = addDays(weekStart, 6);
  const today = new Date();
  const hourStart = 8;
  const hourEnd = 20;
  const hourHeight = 64;
  const totalHeight = (hourEnd - hourStart + 1) * hourHeight;

  els.calendarMonthLabel.textContent = weekStart.toLocaleDateString([], {
    month: 'long',
    year: 'numeric'
  });
  els.calendarRangeLabel.textContent = `${weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

  els.calendarWeekStrip.innerHTML = days.map(day => `
    <div class="calendar-day-head ${isSameDay(day, today) ? 'today' : ''}">
      <span>${escapeHtml(day.toLocaleDateString([], { weekday: 'short' }))}</span>
      <strong>${escapeHtml(String(day.getDate()))}</strong>
    </div>
  `).join('');

  els.calendarHours.innerHTML = Array.from({ length: hourEnd - hourStart + 1 }, (_, index) => {
    const hour = hourStart + index;
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return `<span style="height: ${hourHeight}px">${escapeHtml(date.toLocaleTimeString([], { hour: 'numeric' }))}</span>`;
  }).join('');

  const meetingsByDay = days.map(day => state.sessions
    .map(session => ({ session, date: meetingDate(session) }))
    .filter(item => item.date && isSameDay(item.date, day))
    .sort((left, right) => left.date - right.date));

  els.calendarDays.style.setProperty('--calendar-height', `${totalHeight}px`);
  els.calendarDays.innerHTML = days.map((day, dayIndex) => {
    const events = meetingsByDay[dayIndex].map(({ session, date }) => {
      const minutes = date.getHours() * 60 + date.getMinutes();
      const top = Math.max(0, minutes - hourStart * 60) / 60 * hourHeight;
      const height = Math.max(42, meetingDurationMinutes(session) / 60 * hourHeight);
      return `
        <button class="calendar-event ${escapeHtml(session.status || 'unknown')}" type="button" data-calendar-session-id="${escapeHtml(session.id)}" style="top: ${top}px; height: ${height}px">
          <span>${escapeHtml(formatCalendarTime(date))}</span>
          <strong>${escapeHtml(sessionTitle(session))}</strong>
          <small>${escapeHtml(statusLabel(session.status))}</small>
        </button>
      `;
    }).join('');

    return `
      <div class="calendar-day-column ${isSameDay(day, today) ? 'today' : ''}" style="height: ${totalHeight}px">
        <div class="calendar-grid-lines" aria-hidden="true"></div>
        ${events || `
          <div class="calendar-empty-note">
            <span>No meetings</span>
          </div>
        `}
      </div>
    `;
  }).join('');
}

async function loadLibrary({ quiet = false } = {}) {
  try {
    const data = await requestJson('/meetings?limit=100');
    state.sessions = data.sessions || [];
    renderMeetingList();
    renderCalendar();
    if (!state.selectedSessionId && state.sessions[0]) {
      await selectSession(state.sessions[0].id);
    }
    if (!quiet) showToast('Library refreshed.');
  } catch (error) {
    state.sessions = [];
    els.libraryCount.textContent = '0';
    els.meetingList.innerHTML = `
      <div class="empty-state">
        <img class="empty-icon" src="../../node_modules/lucide-static/icons/lock-keyhole.svg" alt="" />
        <h3>Library unavailable</h3>
        <p>${escapeHtml(friendlyError(error))}</p>
      </div>
    `;
    renderCalendar();
    renderTranscriptDetail(null);
    if (!quiet) showToast(friendlyError(error), 'error');
  }
}

async function selectSession(id) {
  state.selectedSessionId = id;
  renderMeetingList();
  const data = await requestJson(`/meetings/${id}`);
  state.selectedSession = data.session;
  renderTranscriptDetail(state.selectedSession);
}

function renderTranscriptDetail(session) {
  if (!session) {
    els.transcriptDetail.className = 'transcript-detail empty-state';
    els.transcriptDetail.innerHTML = `
      <img class="empty-icon" src="../../node_modules/lucide-static/icons/file-search.svg" alt="" />
      <h3>No meeting selected</h3>
      <p>Pick a meeting from the left library or start a new recording.</p>
    `;
    return;
  }

  const smart = intelligence(session);
  const segments = transcriptSegments(session);
  const summary = (smart.summary || []).filter(Boolean);
  const actionItems = (smart.actionItems || []).filter(Boolean);
  const currentSpeaker = segments[0] || { speaker: 'Speaker', initials: 'SP' };
  const otherSpeakers = segments
    .filter(segment => segment.speaker !== currentSpeaker.speaker)
    .filter((segment, index, array) => array.findIndex(item => item.speaker === segment.speaker) === index)
    .slice(0, 3);
  const needsRecovery = window.scribelyRecovery?.needsRecovery(session, state.sessionId);

  els.transcriptDetail.className = 'transcript-detail';
  els.transcriptDetail.innerHTML = `
    <div class="detail-header">
      <h3>${escapeHtml(sessionTitle(session))}</h3>
      <div class="detail-meta">
        <span>${escapeHtml(longDate(session.startedAt || session.createdAt))}</span>
        <span class="mono">${escapeHtml(durationLabel(session))}</span>
        <span class="app-pill">${escapeHtml(meetingApp(session))}</span>
        <span class="provider-pill">${escapeHtml(providerDisplay(session.provider))}</span>
      </div>
    </div>

    <div class="meeting-detail-body">
      <section class="detail-transcript-column">
        <div class="panel-label">Transcript</div>
        <div class="segment-list">
          ${segments.map(segment => `
            <button class="segment-row" type="button" data-action="mode" data-mode="hinglish">
              <span class="segment-time">${escapeHtml(segment.time)}</span>
              <span class="speaker-avatar">${escapeHtml(segment.initials)}</span>
              <span class="segment-copy">
                <strong>${escapeHtml(segment.speaker)}</strong>
                <span>${escapeHtml(segment.text)}</span>
              </span>
            </button>
          `).join('')}
        </div>
      </section>

      <section class="detail-notes-column">
        ${needsRecovery ? `
          <section class="recovery-notice" role="status">
            <div>
              <strong>Recording recovered</strong>
              <p>Scribely saved the recording before the app closed. Transcribe it when you are ready.</p>
            </div>
            <button class="button primary" type="button" data-action="recover">${icon('sparkles')}<span>Transcribe saved recording</span></button>
          </section>
        ` : ''}
        <div class="video-tile">
          <div class="video-speaker">
            <div class="video-avatar">${escapeHtml(currentSpeaker.initials)}</div>
            <div>
              <strong>${escapeHtml(currentSpeaker.speaker)}</strong>
              <span>Camera off · audio recording</span>
            </div>
          </div>
          <div class="video-others">
            ${otherSpeakers.map(segment => `<span>${escapeHtml(segment.initials)}</span>`).join('')}
          </div>
          <div class="video-controls">
            <button class="play-button" type="button" data-action="copy">${icon('play')}<span>Copy transcript</span></button>
            <div class="play-clock">00:00 / ${escapeHtml(durationLabel(session))}</div>
          </div>
        </div>

        <div class="notes-section">
          <div class="panel-label">Notes</div>
          <div class="summary-list">
            ${(summary.length ? summary : ['Notes will appear after transcription finishes.']).map(text => `
              <p>${escapeHtml(typeof text === 'string' ? text : text.text)}</p>
            `).join('')}
          </div>
        </div>

        <div class="notes-section">
          <div class="panel-label">Action items</div>
          <div class="action-list">
            ${(actionItems.length ? actionItems : [{ text: 'No action items found.', done: false }]).map(item => `
              <label class="action-row">
                <span class="check-box ${item.done ? 'checked' : ''}">${item.done ? '✓' : ''}</span>
                <span>${escapeHtml(typeof item === 'string' ? item : item.text)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <label class="notes-section user-note">
          <span class="panel-label">Your notes</span>
          <textarea id="detailRawNotes" spellcheck="true" placeholder="Type anything...">${escapeHtml(session.rawNotes || '')}</textarea>
        </label>

        <div class="detail-actions-inline">
          <button class="button secondary" type="button" data-action="save-notes">${icon('save')}<span>Save changes</span></button>
          <button class="button secondary" type="button" data-action="export">${icon('download')}<span>Export</span></button>
          <button class="button danger" type="button" data-action="delete">${icon('trash-2')}<span>Delete</span></button>
        </div>
      </div>
    </div>
  `;
}

async function copyText(text) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  showToast('Transcript copied.');
}

function exportTranscript(session) {
  const text = currentDetailText(session);
  if (!text) return;
  const safeTitle = sessionTitle(session)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'meeting-transcript';
  const modeSuffix = state.detailTab === 'transcript'
    ? (state.transcriptMode === 'original' ? 'original' : 'hinglish')
    : state.detailTab;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeTitle}-${modeSuffix}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Transcript exported.');
}

async function updateSelectedNotes({ regenerate = false } = {}) {
  if (!state.selectedSession) return;
  const rawNotes = document.getElementById('detailRawNotes')?.value ?? state.selectedSession.rawNotes ?? '';
  const noteTemplate = document.getElementById('detailTemplate')?.value ?? state.selectedSession.noteTemplate ?? 'general';
  const path = regenerate
    ? `/meetings/${state.selectedSession.id}/regenerate-notes`
    : `/meetings/${state.selectedSession.id}/notes`;
  const data = await requestJson(path, {
    method: regenerate ? 'POST' : 'PATCH',
    body: JSON.stringify({
      raw_notes: rawNotes,
      note_template: noteTemplate,
      folder: state.selectedSession.folder || 'My notes',
      space: state.selectedSession.space || 'Private'
    })
  });
  state.selectedSession = data.session;
  state.sessions = state.sessions.map(session => session.id === data.session.id ? data.session : session);
  renderMeetingList();
  renderTranscriptDetail(state.selectedSession);
  showToast(regenerate ? 'Enhanced notes regenerated.' : 'Notes saved.');
}

async function recoverInterruptedRecording() {
  const session = state.selectedSession;
  if (!window.scribelyRecovery?.needsRecovery(session, state.sessionId)) return;

  const provider = session.provider || selectedProvider();
  const providerMeta = PROVIDER_META[provider] || selectedProviderMeta();
  const apiKey = state.providerApiKeys[provider] || (provider === selectedProvider() ? els.providerApiKey.value.trim() : '');
  if (providerMeta.requiresApiKey !== false && !apiKey) {
    setView('settings');
    throw new Error(`Add your ${providerMeta.label} API key in Settings, then transcribe this saved recording.`);
  }

  await requestJson(`/local-capture/${session.id}/finish`, {
    method: 'POST',
    body: JSON.stringify({ provider, api_key: apiKey })
  });

  state.sessionId = session.id;
  state.selectedSession = { ...session, status: 'transcribing' };
  state.sessions = state.sessions.map(item => item.id === session.id ? state.selectedSession : item);
  renderMeetingList();
  renderTranscriptDetail(state.selectedSession);
  showToast(`Transcribing saved recording with ${providerMeta.label}.`);
  pollSession();
}

async function askDetailQuestion() {
  if (!state.selectedSession) return;
  const input = document.getElementById('detailAskInput');
  const question = input?.value.trim();
  if (!question) return;
  const data = await requestJson(`/meetings/${state.selectedSession.id}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question })
  });
  state.chatAnswers[state.selectedSession.id] = data.answer || 'No answer found.';
  renderTranscriptDetail(state.selectedSession);
}

async function askAllMeetings() {
  const question = els.globalAskInput.value.trim();
  if (!question) return;
  const data = await requestJson('/meetings/ask', {
    method: 'POST',
    body: JSON.stringify({ question, user_id: els.userId.value.trim() || 'local-user' })
  });
  els.globalAskAnswer.hidden = false;
  els.globalAskAnswer.textContent = data.answer || 'No answer found.';
}

function openDeleteDialog(id) {
  state.pendingDeleteId = id;
  if (typeof els.deleteDialog.showModal === 'function') {
    els.deleteDialog.showModal();
  }
}

async function deleteSelectedSession() {
  const id = state.pendingDeleteId;
  if (!id) return;
  await requestJson(`/meetings/${id}`, { method: 'DELETE', body: '{}' });
  state.pendingDeleteId = null;
  state.selectedSessionId = null;
  state.selectedSession = null;
  renderTranscriptDetail(null);
  await loadLibrary({ quiet: true });
  showToast('Transcript deleted.');
}

els.navItems.forEach(item => {
  item.addEventListener('click', () => setView(item.dataset.view));
});

els.form.addEventListener('submit', event => {
  event.preventDefault();
  saveSettings();
  testConnection({ quiet: false }).catch(error => showToast(friendlyError(error), 'error'));
});

els.startButton.addEventListener('click', () => {
  startRecording().catch(error => {
    setStatus('idle', 'Idle');
    setMessage(friendlyError(error), 'error');
    els.startButton.disabled = !isRecorderReady();
    els.stopButton.disabled = true;
    stopTimer();
    stopStreams();
  });
});

els.stopButton.addEventListener('click', () => {
  stopRecording().catch(error => {
    setStatus('idle', 'Failed');
    setMessage(friendlyError(error), 'error');
    els.startButton.disabled = false;
    els.stopButton.disabled = true;
    stopTimer();
    stopStreams();
  });
});

els.openCurrentButton.addEventListener('click', () => {
  if (!state.sessionId) return;
  setView('library');
  selectSession(state.sessionId).catch(error => showToast(friendlyError(error), 'error'));
});

els.copyCurrentButton.addEventListener('click', async () => {
  if (!state.sessionId) return;
  const session = await refreshSession(state.sessionId);
  const text = transcriptText(session, 'hinglish');
  if (text) await copyText(text);
});

els.testConnectionButton.addEventListener('click', () => {
  saveSettings();
  testConnection({ quiet: false }).catch(error => showToast(friendlyError(error), 'error'));
});

els.openSettingsButton.addEventListener('click', () => setView('settings'));

els.sidebarNewRecordingButton.addEventListener('click', () => {
  setView('recorder');
  els.meetingTitle.focus();
});

els.refreshAppButton.addEventListener('click', () => {
  testConnection({ quiet: false }).catch(error => showToast(friendlyError(error), 'error'));
  if (state.activeView === 'library') loadLibrary().catch(error => showToast(friendlyError(error), 'error'));
  if (state.activeView === 'calendar') loadLibrary().catch(error => showToast(friendlyError(error), 'error'));
});

els.refreshLibraryButton.addEventListener('click', () => {
  loadLibrary().catch(error => showToast(friendlyError(error), 'error'));
});

els.rawNotes.addEventListener('input', scheduleNotesSave);
els.meetingTemplate.addEventListener('change', scheduleNotesSave);
els.deleteAudioAfterTranscription.addEventListener('change', saveSettings);
els.microphoneDevice.addEventListener('change', saveSettings);
els.detectMeetingApps.addEventListener('change', saveSettings);
els.transcriptionProvider.addEventListener('change', () => {
  setProvider(els.transcriptionProvider.value);
});

els.providerCardList?.addEventListener('click', event => {
  const card = event.target.closest('[data-provider-card]');
  if (!card) return;
  setProvider(card.dataset.providerCard);
});

els.providerApiKey.addEventListener('input', () => {
  rememberProviderKey();
  saveSettings();
  persistCredentials();
  state.connection.providerKey = hasProviderKey();
  updateConnectionUi();
});

els.apiKey.addEventListener('input', () => {
  persistCredentials();
});

els.globalAskButton.addEventListener('click', () => {
  askAllMeetings().catch(error => showToast(friendlyError(error), 'error'));
});

els.globalAskInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    askAllMeetings().catch(error => showToast(friendlyError(error), 'error'));
  }
});

els.librarySearch.addEventListener('input', renderMeetingList);
els.libraryStatusFilter.addEventListener('change', renderMeetingList);

els.calendarTodayButton.addEventListener('click', () => {
  state.calendarDate = new Date();
  renderCalendar();
});

els.calendarPrevButton.addEventListener('click', () => {
  state.calendarDate = addDays(state.calendarDate, -7);
  renderCalendar();
});

els.calendarNextButton.addEventListener('click', () => {
  state.calendarDate = addDays(state.calendarDate, 7);
  renderCalendar();
});

els.calendarDays.addEventListener('click', event => {
  const item = event.target.closest('[data-calendar-session-id]');
  if (!item) return;
  setView('library');
  selectSession(item.dataset.calendarSessionId).catch(error => showToast(friendlyError(error), 'error'));
});

els.meetingList.addEventListener('click', event => {
  const item = event.target.closest('.meeting-item');
  if (!item) return;
  selectSession(item.dataset.sessionId).catch(error => showToast(friendlyError(error), 'error'));
});

els.transcriptDetail.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || !state.selectedSession) return;
  const action = button.dataset.action;
  if (action === 'tab') {
    state.detailTab = button.dataset.tab || 'notes';
    renderTranscriptDetail(state.selectedSession);
    return;
  }
  if (action === 'mode') {
    state.transcriptMode = button.dataset.mode === 'original' ? 'original' : 'hinglish';
    renderTranscriptDetail(state.selectedSession);
    return;
  }
  if (action === 'copy') copyText(currentDetailText(state.selectedSession)).catch(error => showToast(friendlyError(error), 'error'));
  if (action === 'recover') recoverInterruptedRecording().catch(error => showToast(friendlyError(error), 'error'));
  if (action === 'export') exportTranscript(state.selectedSession);
  if (action === 'save-notes') updateSelectedNotes().catch(error => showToast(friendlyError(error), 'error'));
  if (action === 'regenerate') updateSelectedNotes({ regenerate: true }).catch(error => showToast(friendlyError(error), 'error'));
  if (action === 'ask-detail') askDetailQuestion().catch(error => showToast(friendlyError(error), 'error'));
  if (action === 'delete') openDeleteDialog(state.selectedSession.id);
});

els.transcriptDetail.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  const input = event.target.closest('#detailAskInput');
  if (!input) return;
  event.preventDefault();
  askDetailQuestion().catch(error => showToast(friendlyError(error), 'error'));
});

els.confirmDeleteButton.addEventListener('click', () => {
  els.deleteDialog.close();
  deleteSelectedSession().catch(error => showToast(friendlyError(error), 'error'));
});

async function initializeApp() {
  await loadSettings();
  setView('library');
  setStatus('idle', 'Idle');
  resetRecordingUi();
  testConnection({ quiet: true }).catch(() => updateConnectionUi());
  loadLibrary({ quiet: true }).catch(error => showToast(friendlyError(error), 'error'));
}

initializeApp();
