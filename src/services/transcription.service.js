const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');
const { enrichTranscript } = require('../utils/hinglish');

const ASSEMBLY_AI_BASE = 'https://api.assemblyai.com';
const DEEPGRAM_BASE = 'https://api.deepgram.com';
const OPENAI_TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions';
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 360;
const DEFAULT_AAI_MODELS = 'universal-3-5-pro,universal-2';
const VIBEVOICE_ENABLED = process.env.VIBEVOICE_ENABLED === 'true';
const PROVIDER_ORDER = ['assemblyai', 'deepgram', 'openai', ...(VIBEVOICE_ENABLED ? ['vibevoice'] : [])];
const PROVIDER_LABELS = {
  assemblyai: 'AssemblyAI',
  deepgram: 'Deepgram',
  openai: 'OpenAI Whisper',
  vibevoice: 'VibeVoice ASR'
};
const PROVIDER_ENV_KEYS = {
  assemblyai: 'ASSEMBLYAI_API_KEY',
  deepgram: 'DEEPGRAM_API_KEY',
  openai: 'OPENAI_API_KEY'
};
const VIBEVOICE_SCRIPT = path.resolve(process.cwd(), process.env.VIBEVOICE_ASR_SCRIPT || './scripts/vibevoice-asr-transcribe.py');
const DEFAULT_MEETING_TERMS = [
  'OpenAI',
  'Anthropic',
  'AssemblyAI',
  'Deepgram',
  'Zoom',
  'Google Meet',
  'Microsoft Teams',
  'meeting bot',
  'meeting recorder',
  'Hinglish',
  'Hindi English',
  'code switching',
  'ERP',
  'CRM',
  'resource',
  'resources',
  'enterprise resource planning',
  'customer relationship management',
  'customer',
  'vendor',
  'frontend',
  'backend',
  'marketing',
  'expenses'
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  if (!provider) return null;
  if (provider === 'assembly' || provider === 'assembly_ai') return 'assemblyai';
  if (provider === 'whisper' || provider === 'openai_whisper') return 'openai';
  if (provider === 'vibevoice-asr' || provider === 'vibevoice_asr') return 'vibevoice';
  return PROVIDER_ORDER.includes(provider) ? provider : null;
}

function providerLabel(provider) {
  return PROVIDER_LABELS[provider] || provider || 'transcription provider';
}

function providerEnvKey(provider) {
  return PROVIDER_ENV_KEYS[provider] || '';
}

function providerApiKey(provider) {
  const envKey = providerEnvKey(provider);
  return envKey ? String(process.env[envKey] || '').trim() : '';
}

function providerRequiresApiKey(provider) {
  return Boolean(providerEnvKey(provider));
}

function isProviderConfigured(provider) {
  if (provider === 'vibevoice') return VIBEVOICE_ENABLED && fs.existsSync(VIBEVOICE_SCRIPT);
  return Boolean(providerApiKey(provider));
}

function secondsToMilliseconds(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Math.round(Number(value) * 1000);
}

function compactAssemblyUtterances(utterances = []) {
  return utterances.map(u => ({
    start: u.start,
    end: u.end,
    text: u.text,
    speaker: u.speaker,
    confidence: u.confidence
  }));
}

function compactDeepgramUtterances(utterances = []) {
  return utterances.map(u => ({
    start: secondsToMilliseconds(u.start),
    end: secondsToMilliseconds(u.end),
    text: u.transcript || u.text || '',
    speaker: u.speaker ?? null,
    confidence: u.confidence
  }));
}

function compactOpenAiSegments(segments = []) {
  return segments.map(segment => ({
    start: secondsToMilliseconds(segment.start || 0),
    end: secondsToMilliseconds(segment.end || 0),
    text: String(segment.text || '').trim(),
    speaker: 'Speaker'
  }));
}

function compactVibeVoiceUtterances(items = []) {
  return items.map(item => ({
    start: secondsToMilliseconds(item.Start ?? item.start ?? 0),
    end: secondsToMilliseconds(item.End ?? item.end ?? 0),
    text: String(item.Content ?? item.content ?? item.text ?? '').trim(),
    speaker: item.Speaker ?? item.speaker ?? null
  })).filter(item => item.text);
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseSpeakersExpected() {
  const value = Number(process.env.MEETING_SPEAKERS_EXPECTED);
  if (!Number.isInteger(value) || value < 1) return null;
  return Math.min(value, 20);
}

function parseModels() {
  const models = parseCsv(process.env.MEETING_AAI_MODELS || DEFAULT_AAI_MODELS);
  return models.length > 0 ? models : parseCsv(DEFAULT_AAI_MODELS);
}

function codeSwitchingConfidence() {
  const value = Number(process.env.MEETING_CODE_SWITCHING_CONFIDENCE || 0.5);
  return Number.isFinite(value) ? value : 0.5;
}

function applyLanguageConfig(submitBody) {
  const langCodes = parseCsv(process.env.MEETING_LANG_CODES);
  const langCode = String(process.env.MEETING_LANG_CODE || '').trim();
  if (langCodes.length > 0) submitBody.language_codes = langCodes;
  else if (langCode) submitBody.language_code = langCode;
  else submitBody.language_detection = true;
}

function applyModelSpecificHints(submitBody, models, terms) {
  const prompt = String(process.env.MEETING_AAI_PROMPT || '').trim();
  const usesUniversal35 = models.includes('universal-3-5-pro');

  if (prompt) {
    submitBody.prompt = prompt;
  } else if (usesUniversal35) {
    submitBody.keyterms_prompt = terms;
  } else {
    submitBody.word_boost = terms;
    submitBody.boost_param = process.env.MEETING_BOOST_PARAM || 'high';
  }

  if (!usesUniversal35 && submitBody.language_detection) {
    submitBody.language_detection_options = {
      code_switching: true,
      code_switching_confidence_threshold: codeSwitchingConfidence()
    };
  }
}

function buildSubmitBody(uploadUrl, models) {
  const wordBoost = uniqueValues([
    ...DEFAULT_MEETING_TERMS,
    ...parseCsv(process.env.MEETING_WORD_BOOST)
  ]);
  const submitBody = {
    audio_url: uploadUrl,
    speech_models: models,
    speaker_labels: true,
    punctuate: true,
    format_text: true,
    auto_chapters: true
  };

  const speakersExpected = parseSpeakersExpected();
  if (speakersExpected) submitBody.speakers_expected = speakersExpected;

  applyLanguageConfig(submitBody);
  applyModelSpecificHints(submitBody, models, wordBoost);
  return submitBody;
}

function runCommand(command, args, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`VibeVoice ASR timed out after ${Math.round(timeoutMs / 1000)} seconds`));
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error((stderr || `VibeVoice ASR exited with code ${code}`).trim()));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

class TranscriptionService {
  configuredProviders() {
    return Object.fromEntries(PROVIDER_ORDER.map(provider => [provider, isProviderConfigured(provider)]));
  }

  supportedProviders() {
    return PROVIDER_ORDER.map(provider => ({
      id: provider,
      label: providerLabel(provider),
      configured: isProviderConfigured(provider),
      requiresApiKey: providerRequiresApiKey(provider)
    }));
  }

  resolveProvider(options = {}) {
    const requested = normalizeProvider(options.provider);
    const envPreferred = normalizeProvider(process.env.TRANSCRIPTION_PROVIDER);
    const provider = requested || envPreferred || PROVIDER_ORDER.find(item => providerApiKey(item)) || 'assemblyai';
    const apiKey = String(options.apiKey || options.api_key || '').trim() || providerApiKey(provider);
    if (!providerRequiresApiKey(provider)) {
      return { provider, apiKey: '' };
    }
    if (!apiKey) {
      const envKey = providerEnvKey(provider);
      throw new Error(`No ${providerLabel(provider)} API key found. Add your key in Settings${envKey ? ` or set ${envKey}` : ''}.`);
    }
    return { provider, apiKey };
  }

  async transcribe(filePath, options = {}) {
    const { provider, apiKey } = this.resolveProvider(options);
    logger.info({ provider, filePath }, 'Transcribing local capture');
    if (provider === 'vibevoice') return this.transcribeWithVibeVoice(filePath, options);
    if (provider === 'deepgram') return this.transcribeWithDeepgram(filePath, apiKey);
    if (provider === 'openai') return this.transcribeWithOpenAI(filePath, apiKey);
    return this.transcribeWithAssemblyAI(filePath, apiKey);
  }

  async transcribeWithAssemblyAI(filePath, apiKey) {
    const fileData = fs.readFileSync(filePath);
    const uploadResponse = await axios.post(`${ASSEMBLY_AI_BASE}/v2/upload`, fileData, {
      headers: {
        authorization: apiKey,
        'content-type': 'application/octet-stream',
        'transfer-encoding': 'chunked'
      },
      maxContentLength: 500 * 1024 * 1024,
      timeout: 300000
    });

    const models = parseModels();
    const submitBody = buildSubmitBody(uploadResponse.data.upload_url, models);

    const submitResponse = await axios.post(`${ASSEMBLY_AI_BASE}/v2/transcript`, submitBody, {
      headers: {
        authorization: apiKey,
        'content-type': 'application/json'
      },
      timeout: 30000
    });

    const transcriptId = submitResponse.data.id;
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      await sleep(POLL_INTERVAL_MS);
      const pollResponse = await axios.get(`${ASSEMBLY_AI_BASE}/v2/transcript/${transcriptId}`, {
        headers: { authorization: apiKey },
        timeout: 30000
      });
      const data = pollResponse.data || {};
      if (data.status === 'completed') {
        const utterances = compactAssemblyUtterances(data.utterances || []);
        const enriched = enrichTranscript({
          transcript: data.text || '',
          utterances
        });
        return {
          provider: 'assemblyai',
          transcript: data.text || '',
          transcriptHinglish: enriched.transcriptHinglish,
          utterances: enriched.utterances,
          diarizedTranscript: enriched.diarizedTranscript,
          diarizedTranscriptHinglish: enriched.diarizedTranscriptHinglish,
          words: data.words || [],
          duration: data.audio_duration || null,
          raw: {
            id: data.id,
            status: data.status,
            chapters: data.chapters || [],
            languageCode: data.language_code || null,
            languageConfidence: data.language_confidence || null,
            speechModel: data.speech_model || data.speech_models || null
          }
        };
      }
      if (data.status === 'error') throw new Error(`AssemblyAI transcription failed: ${data.error}`);
    }
    throw new Error('AssemblyAI transcription timed out');
  }

  async transcribeWithDeepgram(filePath, apiKey) {
    const fileData = fs.readFileSync(filePath);
    const response = await axios.post(
      `${DEEPGRAM_BASE}/v1/listen?diarize=true&punctuate=true&utterances=true&smart_format=true`,
      fileData,
      {
        headers: {
          authorization: `Token ${apiKey}`,
          'content-type': 'audio/webm'
        },
        maxContentLength: 500 * 1024 * 1024,
        maxBodyLength: 500 * 1024 * 1024,
        timeout: 300000
      }
    );

    const data = response.data || {};
    const results = data.results || {};
    const firstChannel = (results.channels || [])[0] || {};
    const firstAlt = (firstChannel.alternatives || [])[0] || {};
    const transcript = firstAlt.transcript || '';
    const utterances = compactDeepgramUtterances(results.utterances || []);
    const enriched = enrichTranscript({ transcript, utterances });

    return {
      provider: 'deepgram',
      transcript,
      transcriptHinglish: enriched.transcriptHinglish,
      utterances: enriched.utterances,
      diarizedTranscript: enriched.diarizedTranscript,
      diarizedTranscriptHinglish: enriched.diarizedTranscriptHinglish,
      words: firstAlt.words || [],
      duration: data.metadata?.duration || null,
      raw: {
        requestId: data.metadata?.request_id || null,
        model: data.metadata?.model_info || null,
        channels: data.metadata?.channels || null
      }
    };
  }

  async transcribeWithOpenAI(filePath, apiKey) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', process.env.MEETING_OPENAI_MODEL || 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append(
      'prompt',
      process.env.MEETING_OPENAI_PROMPT || 'This is a business meeting with Hinglish, Hindi, English, action items, decisions, and product terms.'
    );

    const response = await axios.post(OPENAI_TRANSCRIPTION_URL, form, {
      headers: {
        ...form.getHeaders(),
        authorization: `Bearer ${apiKey}`
      },
      maxContentLength: 500 * 1024 * 1024,
      maxBodyLength: 500 * 1024 * 1024,
      timeout: 600000
    });

    const data = response.data || {};
    const transcript = data.text || '';
    const utterances = compactOpenAiSegments(Array.isArray(data.segments) ? data.segments : []);
    const enriched = enrichTranscript({ transcript, utterances });

    return {
      provider: 'openai',
      transcript,
      transcriptHinglish: enriched.transcriptHinglish,
      utterances: enriched.utterances,
      diarizedTranscript: enriched.diarizedTranscript,
      diarizedTranscriptHinglish: enriched.diarizedTranscriptHinglish,
      words: [],
      duration: data.duration || null,
      raw: {
        model: process.env.MEETING_OPENAI_MODEL || 'whisper-1',
        language: data.language || null,
        duration: data.duration || null
      }
    };
  }

  async transcribeWithVibeVoice(filePath, options = {}) {
    if (!fs.existsSync(VIBEVOICE_SCRIPT)) {
      throw new Error(`VibeVoice ASR runner was not found at ${VIBEVOICE_SCRIPT}`);
    }

    const python = process.env.VIBEVOICE_PYTHON || process.env.PYTHON || 'python';
    const modelId = process.env.VIBEVOICE_ASR_MODEL || 'microsoft/VibeVoice-ASR-HF';
    const timeoutMs = Number(process.env.VIBEVOICE_ASR_TIMEOUT_MS || 7200000);
    const args = [
      VIBEVOICE_SCRIPT,
      '--audio',
      filePath,
      '--model-id',
      modelId
    ];
    const prompt = String(options.prompt || process.env.VIBEVOICE_ASR_PROMPT || '').trim();
    if (prompt) args.push('--prompt', prompt);
    if (process.env.VIBEVOICE_ASR_MAX_NEW_TOKENS) {
      args.push('--max-new-tokens', process.env.VIBEVOICE_ASR_MAX_NEW_TOKENS);
    }

    const { stdout } = await runCommand(python, args, { timeoutMs });
    let data;
    try {
      data = JSON.parse(stdout);
    } catch (_error) {
      throw new Error(`VibeVoice ASR returned invalid JSON: ${stdout.slice(0, 300)}`);
    }

    const utterances = compactVibeVoiceUtterances(Array.isArray(data.utterances) ? data.utterances : []);
    const transcript = data.transcript || utterances.map(item => item.text).join(' ');
    const enriched = enrichTranscript({ transcript, utterances });
    return {
      provider: 'vibevoice',
      transcript,
      transcriptHinglish: enriched.transcriptHinglish,
      utterances: enriched.utterances,
      diarizedTranscript: enriched.diarizedTranscript,
      diarizedTranscriptHinglish: enriched.diarizedTranscriptHinglish,
      words: [],
      duration: null,
      raw: {
        model: modelId,
        runner: 'transformers',
        rawOutput: data.rawOutput || null
      }
    };
  }
}

module.exports = new TranscriptionService();
