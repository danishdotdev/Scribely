'use strict';

/**
 * Speaker attribution — turn anonymous diarization labels into real names.
 *
 * ASR diarization (AssemblyAI/Deepgram) tells us *that* the speaker changed and
 * groups speech into anonymous labels (A, B, C…). The extraction pipeline's
 * speaker timeline tells us *who* was speaking and *when* (real participant names
 * from the WebRTC/RTMS/DOM layer). This module fuses the two: it maps each
 * diarization label to the participant name it overlaps with most, then relabels
 * the utterances. This is the "speaker-timeline diarization" technique — names
 * come from the meeting platform, precise word boundaries from the ASR.
 *
 * The mapping is computed per-label by total temporal overlap (not per-utterance),
 * so it's stable: a few seconds of clock skew or one mis-cut utterance can't flip
 * a whole speaker's identity. Labels with no timeline overlap are left unmapped —
 * the caller keeps the anonymous "Speaker A" for those rather than guessing.
 */

/**
 * Convert a step-function timeline ([{ t, name }] where each entry marks when a
 * new speaker started) into explicit active intervals.
 * @param {Array<{t:number,name:string}>} timeline
 * @returns {Array<{start:number,end:number,name:string}>}
 */
function toIntervals(timeline) {
  const sorted = (timeline || [])
    .filter(e => e && typeof e.t === 'number' && e.name)
    .sort((a, b) => a.t - b.t);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    out.push({
      start: sorted[i].t,
      end: i + 1 < sorted.length ? sorted[i + 1].t : Infinity,
      name: sorted[i].name,
    });
  }
  return out;
}

/**
 * Total temporal overlap between the utterances and the timeline at a given
 * offset, counting only each utterance's single best-covering name. Higher means
 * the two clocks line up better — the objective `estimateOffset` maximizes.
 */
function alignmentScore(utterances, intervals, offsetMs) {
  let score = 0;
  for (const u of utterances) {
    if (u.start == null || u.end == null) continue;
    const s = u.start + offsetMs;
    const e = u.end + offsetMs;
    if (e <= s) continue;
    const byName = new Map();
    for (const iv of intervals) {
      const overlap = Math.min(e, iv.end) - Math.max(s, iv.start);
      if (overlap > 0) byName.set(iv.name, (byName.get(iv.name) || 0) + overlap);
    }
    let best = 0;
    for (const v of byName.values()) if (v > best) best = v;
    score += best;
  }
  return score;
}

/**
 * Estimate the audio↔meeting clock offset by sweeping a range and picking the one
 * that best aligns utterances to the timeline. Cheap (a few dozen passes) and
 * robust because it optimizes a global objective, not any single utterance.
 * @returns {number} offset in ms
 */
function estimateOffset({ utterances = [], speakerTimeline = [], minMs = -4000, maxMs = 4000, stepMs = 250 } = {}) {
  const intervals = toIntervals(speakerTimeline);
  if (!intervals.length || !utterances.length) return 0;
  let bestOff = 0;
  let bestScore = -1;
  for (let off = minMs; off <= maxMs; off += stepMs) {
    const sc = alignmentScore(utterances, intervals, off);
    if (sc > bestScore) { bestScore = sc; bestOff = off; }
  }
  return bestOff;
}

/**
 * @param {object} input
 * @param {Array<{start:number,end:number,text:string,speaker:*}>} input.utterances
 * @param {Array<{t:number,name:string}>} input.speakerTimeline
 * @param {number|'auto'} [input.offsetMs=0]  Add to utterance times to align the
 *   ASR audio clock with the timeline's meeting clock (audio usually starts a
 *   little after the meeting-join origin). `'auto'` estimates it. Default 0.
 * @returns {{ utterances: Array, speakerMap: Object<string,string>,
 *             confidence: Object<string,number>, unresolved: string[], offsetMs: number }}
 */
function attributeUtterances({ utterances = [], speakerTimeline = [], offsetMs = 0 } = {}) {
  const intervals = toIntervals(speakerTimeline);
  if (!intervals.length || !utterances.length) {
    return { utterances: utterances.map(u => ({ ...u })), speakerMap: {}, confidence: {}, unresolved: [], offsetMs: 0 };
  }
  const off = offsetMs === 'auto' ? estimateOffset({ utterances, speakerTimeline }) : (Number(offsetMs) || 0);
  offsetMs = off;

  // votes[label] -> Map(name -> overlapMs)
  const votes = new Map();
  for (const u of utterances) {
    if (u.start == null || u.end == null) continue;
    const label = u.speaker == null ? '?' : String(u.speaker);
    const s = u.start + offsetMs;
    const e = u.end + offsetMs;
    if (e <= s) continue;
    for (const iv of intervals) {
      const overlap = Math.min(e, iv.end) - Math.max(s, iv.start);
      if (overlap > 0) {
        if (!votes.has(label)) votes.set(label, new Map());
        const m = votes.get(label);
        m.set(iv.name, (m.get(iv.name) || 0) + overlap);
      }
    }
  }

  const speakerMap = {};
  const confidence = {};
  for (const [label, m] of votes) {
    let best = null;
    let bestV = 0;
    let total = 0;
    for (const [name, v] of m) {
      total += v;
      if (v > bestV) { bestV = v; best = name; }
    }
    if (best && total > 0) {
      speakerMap[label] = best;
      confidence[label] = bestV / total;
    }
  }

  const seenLabels = new Set();
  const named = utterances.map(u => {
    const label = u.speaker == null ? '?' : String(u.speaker);
    seenLabels.add(label);
    const name = speakerMap[label];
    return name ? { ...u, speakerName: name } : { ...u };
  });
  const unresolved = Array.from(seenLabels).filter(l => !speakerMap[l]);

  return { utterances: named, speakerMap, confidence, unresolved, offsetMs };
}

module.exports = { attributeUtterances, estimateOffset, toIntervals };
