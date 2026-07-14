'use strict';

const assert = require('node:assert');
const { needsRecovery } = require('./recovery');

(function identifiesSavedInterruptedLocalCaptures() {
  assert.strictEqual(needsRecovery({ id: 'local_1', mode: 'local_capture', status: 'recording' }, null), true);
  assert.strictEqual(needsRecovery({ id: 'local_1', mode: 'local_capture', status: 'recording' }, 'local_1'), false);
  assert.strictEqual(needsRecovery({ id: 'local_1', mode: 'local_capture', status: 'transcribing' }, null), false);
  assert.strictEqual(needsRecovery({ id: 'meeting_1', mode: 'bot', status: 'recording' }, null), false);
  console.log('interrupted capture detection: ok');
})();
