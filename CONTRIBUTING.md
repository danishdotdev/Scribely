# Contributing

Thanks for helping improve Scribely. This project is MIT licensed and aims to be
easy to run, understand, and extend.

## Getting set up

```bash
npm install
npm start                 # API server on http://localhost:3000

npm run desktop:install   # in another terminal
npm run desktop:dev       # Electron app
```

Checks:

```bash
npm run check   # syntax-check every JS file
npm test        # run *.test.js
```

No test framework or build step — tests are plain Node scripts using `assert`,
run in isolated processes by `scripts/run-tests.js`. Add one by dropping a
`*.test.js` file anywhere under `src/`.

## Where things live

- `desktop/` — the Electron app (recorder UI). `desktop/src/renderer` is the UI;
  `desktop/src/main.js` is the Electron main process.
- `src/services/local-capture.service.js` — receives audio chunks, drives
  transcription, generates notes.
- `src/services/transcription.service.js` — pluggable ASR providers. Add a
  provider here.
- `src/services/meeting-intelligence.service.js` — note templates, enhanced
  notes, briefs, and Q&A. Add or improve templates here.

## Privacy expectations

Scribely is local-first and records people. Keep it that way: recordings and
transcripts stay on the user's machine by default, audio is only sent to a
transcription provider the user explicitly configured, and the "delete audio
after transcription" behavior should remain the default. Don't add telemetry or
silent cloud uploads.

## Security

Do not commit `.env`, API keys, recordings, or transcripts from real calls. If you
find a security issue, contact the maintainer privately before filing a public
issue.

## Pull requests

Keep changes focused and match the surrounding style (CommonJS, `'use strict'`
where present). `npm run check` and `npm test` must pass. For UI changes, note
what you tested (recorder, library, settings).
