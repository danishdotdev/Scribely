'use strict';

/**
 * Tests for speaker-timeline → name attribution and its integration into
 * enrichTranscript (the diarized transcript should show real names).
 */

const assert = require('assert');
const { attributeUtterances, estimateOffset, toIntervals } = require('./speaker-attribution');
const { enrichTranscript, captionsToUtterances } = require('./hinglish');

const timeline = [
  { t: 0, name: 'Alice' },
  { t: 5000, name: 'Bob' },
  { t: 10000, name: 'Alice' },
];

// ---------------------------------------------------------------------------
// 1) toIntervals turns the step function into spans (last one open-ended)
// ---------------------------------------------------------------------------
(function testIntervals() {
  const iv = toIntervals(timeline);
  assert.deepStrictEqual(iv, [
    { start: 0, end: 5000, name: 'Alice' },
    { start: 5000, end: 10000, name: 'Bob' },
    { start: 10000, end: Infinity, name: 'Alice' },
  ]);
  console.log('toIntervals: ok');
})();

// ---------------------------------------------------------------------------
// 2) Per-label majority mapping (A→Alice, B→Bob, C→Bob)
// ---------------------------------------------------------------------------
(function testMapping() {
  const utterances = [
    { start: 500, end: 3000, text: 'hi', speaker: 'A' },     // Alice
    { start: 6000, end: 9000, text: 'yes', speaker: 'B' },   // Bob
    { start: 11000, end: 12000, text: 'again', speaker: 'A' }, // Alice
    { start: 5200, end: 5800, text: 'sure', speaker: 'C' },  // Bob (short)
  ];
  const { speakerMap, confidence, utterances: named } = attributeUtterances({ utterances, speakerTimeline: timeline });
  assert.deepStrictEqual(speakerMap, { A: 'Alice', B: 'Bob', C: 'Bob' });
  assert.strictEqual(confidence.A, 1);
  assert.strictEqual(named[0].speakerName, 'Alice');
  assert.strictEqual(named[3].speakerName, 'Bob');
  console.log('label mapping + confidence: ok');
})();

// ---------------------------------------------------------------------------
// 3) Clock offset is applied consistently
// ---------------------------------------------------------------------------
(function testOffset() {
  // Same utterances shifted earlier by 1000ms; offsetMs=1000 realigns them.
  const shifted = [
    { start: -500, end: 2000, text: 'hi', speaker: 'A' },
    { start: 5000, end: 8000, text: 'yes', speaker: 'B' },
  ];
  const { speakerMap } = attributeUtterances({ utterances: shifted, speakerTimeline: timeline, offsetMs: 1000 });
  assert.deepStrictEqual(speakerMap, { A: 'Alice', B: 'Bob' });
  console.log('offset alignment: ok');
})();

// ---------------------------------------------------------------------------
// 4) No timeline → passthrough, no speakerName invented
// ---------------------------------------------------------------------------
(function testPassthrough() {
  const utterances = [{ start: 0, end: 1000, text: 'hi', speaker: 'A' }];
  const { utterances: out, speakerMap } = attributeUtterances({ utterances, speakerTimeline: [] });
  assert.strictEqual(out[0].speakerName, undefined);
  assert.deepStrictEqual(speakerMap, {});
  console.log('no-timeline passthrough: ok');
})();

// ---------------------------------------------------------------------------
// 4b) Auto offset estimation recovers a known clock skew
// ---------------------------------------------------------------------------
(function testAutoOffset() {
  // Utterances captured 1500ms EARLIER than the meeting clock → correct offset +1500.
  const utterances = [
    { start: 500 - 1500, end: 3000 - 1500, text: 'hi', speaker: 'A' },   // Alice window [0,5000]
    { start: 6000 - 1500, end: 9000 - 1500, text: 'yes', speaker: 'B' }, // Bob window [5000,10000]
    { start: 11000 - 1500, end: 12000 - 1500, text: 'again', speaker: 'A' },
  ];
  // These utterances sit comfortably inside their intervals, so any offset in the
  // aligning plateau (~[1000,2500]) is equally valid — the estimator should return
  // one of them, not necessarily the exact 1500.
  const est = estimateOffset({ utterances, speakerTimeline: timeline });
  assert.ok(est >= 1000 && est <= 2500, `estimated offset should align (plateau ~1000..2500); got ${est}`);

  // 'auto' inside attributeUtterances should map correctly despite the skew and
  // report the offset it used.
  const { speakerMap, offsetMs } = attributeUtterances({ utterances, speakerTimeline: timeline, offsetMs: 'auto' });
  assert.deepStrictEqual(speakerMap, { A: 'Alice', B: 'Bob' });
  assert.strictEqual(offsetMs, est, 'auto uses the estimated offset');
  console.log('auto offset estimation: ok');
})();

// ---------------------------------------------------------------------------
// 5) enrichTranscript renders real names when a timeline is supplied,
//    and falls back to "Speaker X" when it isn't.
// ---------------------------------------------------------------------------
(function testEnrichIntegration() {
  const utterances = [
    { start: 500, end: 3000, text: 'hello team', speaker: 'A' },
    { start: 6000, end: 9000, text: 'sounds good', speaker: 'B' },
  ];
  const withNames = enrichTranscript({ transcript: 'hello team sounds good', utterances, speakerTimeline: timeline });
  assert.ok(withNames.diarizedTranscript.includes('Alice: hello team'), 'diarized transcript uses real name');
  assert.ok(withNames.diarizedTranscript.includes('Bob: sounds good'));
  assert.deepStrictEqual(withNames.speakerMap, { A: 'Alice', B: 'Bob' });

  const noTimeline = enrichTranscript({ transcript: 'x', utterances });
  assert.ok(noTimeline.diarizedTranscript.includes('Speaker A: hello team'), 'falls back to anonymous label');
  console.log('enrichTranscript integration: ok');
})();

// ---------------------------------------------------------------------------
// 6) Caption fallback: captions → a named diarized transcript
// ---------------------------------------------------------------------------
(function testCaptionFallback() {
  const captions = [
    { tMs: 1000, name: 'Alice', text: 'good morning' },
    { tMs: 4000, name: 'Bob', text: 'morning all' },
    { tMs: 6000, name: '', text: 'unattributed line' },
  ];
  const utterances = captionsToUtterances(captions);
  assert.strictEqual(utterances.length, 3);
  assert.strictEqual(utterances[0].speakerName, 'Alice');
  assert.strictEqual(utterances[2].speakerName, undefined, 'blank caption name → no speakerName');

  const enriched = enrichTranscript({ transcript: '', utterances });
  assert.ok(enriched.diarizedTranscript.includes('Alice: good morning'), 'captions produce a named diarized transcript');
  assert.ok(enriched.diarizedTranscript.includes('Bob: morning all'));
  assert.ok(enriched.diarizedTranscript.includes('Speaker ?: unattributed line'), 'unnamed caption falls back to anonymous label');
  console.log('caption → named transcript fallback: ok');
})();

console.log('speaker-attribution.test.js — all cases passed');
