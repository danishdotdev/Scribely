const Sanscript = require('@indic-transliteration/sanscript');
const { attributeUtterances } = require('./speaker-attribution');

const DEVANAGARI_RE = /[\u0900-\u097F]/;

const ITRANS_OPTIONS = {
  syncope: true,
  preferred_alternates: {
    itrans: {
      A: 'aa',
      I: 'ee',
      U: 'oo',
      R: 'ri',
      RR: 'ri'
    }
  }
};

const DOMAIN_REPLACEMENTS = [
  [/\brisors?mtlba\b/gi, 'resource matlab'],
  [/\brisorsa\b/gi, 'resource'],
  [/\brisorseja\b/gi, 'resources'],
  [/\brisorsesa\b/gi, 'resources'],
  [/\brisoorsa\b/gi, 'resource'],
  [/\bhyoomana\b/gi, 'human'],
  [/\beksapenseja\b/gi, 'expenses'],
  [/\beksapens\b/gi, 'expense'],
  [/\bmaarketing\b/gi, 'marketing'],
  [/\benterapraaija\b/gi, 'enterprise'],
  [/\benterapraaij\b/gi, 'enterprise'],
  [/\bkastamara\b/gi, 'customer'],
  [/\bvenDara\b/gi, 'vendor'],
  [/\bvenDar\b/gi, 'vendor'],
  [/\bphraNTeNDa\b/gi, 'frontend'],
  [/\bbaik\b/gi, 'back'],
  [/\blebalsa\b/gi, 'labels'],
  [/\bbokeTsa\b/gi, 'buckets'],
  [/\bsI Ara ema\b/g, 'CRM'],
  [/\bsee aara ema\b/gi, 'CRM'],
  [/\bseeaaraema\b/gi, 'CRM'],
  [/\bI Ara pee\b/g, 'ERP'],
  [/\bee aara pee\b/gi, 'ERP'],
  [/\beeaaraapee\b/gi, 'ERP']
];

const COMMON_WORD_REPLACEMENTS = [
  [/\bsabase\b/gi, 'sabse'],
  [/\bsaba\b/gi, 'sab'],
  [/\bmatalaba\b/gi, 'matlab'],
  [/\bsaboota\b/gi, 'saboot'],
  [/\byanee\b/gi, 'yaani'],
  [/\byaanee\b/gi, 'yaani'],
  [/\bvaapasa\b/gi, 'wapas'],
  [/\baataa\b/gi, 'aata'],
  [/\bjaataa\b/gi, 'jata'],
  [/\bhotaa\b/gi, 'hota'],
  [/\bkaregaa\b/gi, 'karega'],
  [/\bkaregee\b/gi, 'karegi'],
  [/\bcheeja\b/gi, 'cheez'],
  [/\bpharaka\b/gi, 'farak'],
  [/\baura\b/gi, 'aur'],
  [/\bnahin\b/gi, 'nahi'],
  [/\bkeessaa\b/gi, 'kaisa'],
  [/\bkese\b/gi, 'kaise'],
  [/\bkee\b/gi, 'ki'],
  [/\bkoee\b/gi, 'koi']
];

function cleanupTransliteration(value) {
  let output = value;
  output = output
    .replace(/\bmeM\b/g, 'mein')
    .replace(/\bhaiM\b/g, 'hain')
    .replace(/\bhooM\b/g, 'hoon')
    .replace(/\bhuuM\b/g, 'hoon')
    .replace(/\byanee\b/gi, 'yaani')
    .replace(/\bkyA\b/g, 'kya')
    .replace(/\bkyon\b/gi, 'kyun')
    .replace(/M/g, 'n')
    .replace(/\.N/g, 'n')
    .replace(/~N/g, 'n')
    .replace(/~n/g, 'n')
    .replace(/Sh/g, 'sh')
    .replace(/Ch/g, 'chh')
    .replace(/Th/g, 'th')
    .replace(/Dh/g, 'dh')
    .replace(/N/g, 'n')
    .replace(/R/g, 'r');

  for (const [pattern, replacement] of DOMAIN_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of COMMON_WORD_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }

  return output
    .replace(/\s*\|\s*/g, '. ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function toHinglish(text) {
  const source = String(text || '');
  if (!source) return '';
  if (!DEVANAGARI_RE.test(source)) return source;
  return cleanupTransliteration(Sanscript.t(source, 'devanagari', 'itrans', ITRANS_OPTIONS));
}

function enrichUtterances(utterances = []) {
  return utterances.map(utterance => ({
    ...utterance,
    textHinglish: toHinglish(utterance.text)
  }));
}

function speakerLabel(utterance) {
  // Prefer the real participant name (from speaker-timeline attribution); fall
  // back to the anonymous diarization label when no name could be resolved.
  if (utterance.speakerName) return utterance.speakerName;
  return `Speaker ${utterance.speaker || '?'}`;
}

function formatDiarizedTranscript(utterances = [], field = 'text') {
  return utterances
    .filter(utterance => utterance && utterance[field])
    .map(utterance => `${speakerLabel(utterance)}: ${utterance[field]}`)
    .join('\n\n');
}

/**
 * @param {object} input
 * @param {string} [input.transcript]
 * @param {Array}  [input.utterances]
 * @param {Array<{t:number,name:string}>} [input.speakerTimeline] When provided,
 *   diarization labels are mapped to real participant names before formatting.
 * @param {number} [input.offsetMs] Audio↔meeting clock offset for attribution.
 */
function enrichTranscript({ transcript = '', utterances = [], speakerTimeline = [], offsetMs = 0 } = {}) {
  // Attribute real names first (no-op when no timeline is supplied), then enrich.
  const { utterances: named, speakerMap } = attributeUtterances({ utterances, speakerTimeline, offsetMs });
  const enrichedUtterances = enrichUtterances(named);
  const transcriptHinglish = toHinglish(transcript);
  return {
    transcriptHinglish,
    utterances: enrichedUtterances,
    speakerMap,
    diarizedTranscript: formatDiarizedTranscript(enrichedUtterances, 'text'),
    diarizedTranscriptHinglish: formatDiarizedTranscript(enrichedUtterances, 'textHinglish')
  };
}

/**
 * Convert platform captions (speaker-attributed) into the utterance shape, for
 * use as a transcript fallback when audio/ASR produced nothing. The speaker name
 * is already known, so `speakerName` is set directly.
 * @param {Array<{tMs?:number, name?:string, text:string}>} captions
 * @returns {Array<{start:number,end:number,text:string,speaker:string,speakerName?:string}>}
 */
function captionsToUtterances(captions = []) {
  return (captions || [])
    .filter(c => c && c.text)
    .map(c => ({
      start: typeof c.tMs === 'number' ? c.tMs : 0,
      end: typeof c.tMs === 'number' ? c.tMs : 0,
      text: c.text,
      speaker: c.name || '?',
      speakerName: c.name || undefined,
    }));
}

function enrichSession(session) {
  if (!session) return session;
  const enriched = enrichTranscript({
    transcript: session.transcript,
    utterances: session.utterances || []
  });
  return {
    ...session,
    transcriptHinglish: session.transcriptHinglish || enriched.transcriptHinglish,
    utterances: enriched.utterances,
    diarizedTranscript: session.diarizedTranscript || enriched.diarizedTranscript,
    diarizedTranscriptHinglish: session.diarizedTranscriptHinglish || enriched.diarizedTranscriptHinglish
  };
}

module.exports = {
  toHinglish,
  enrichTranscript,
  enrichSession,
  formatDiarizedTranscript,
  captionsToUtterances
};
