# Scribely

Local-first meeting recorder + notes. A desktop app records audio on the user's
machine and a small local API transcribes it and generates notes. No meeting bot
joins the call.

## Commands

- `npm install` - install API server dependencies
- `npm start` - run the API server
- `npm run dev` - run the API with nodemon
- `npm run check` - syntax-check all JavaScript files
- `npm test` - run unit tests
- `npm run desktop:install` - install the Electron desktop client
- `npm run desktop:dev` - run the desktop recorder

## Architecture

- `desktop/` is the Electron recorder app; it streams audio chunks to the API.
- `src/index.js` starts the Express API.
- `src/routes/app.routes.js` exposes local-capture and notes/library endpoints.
- `src/services/local-capture.service.js` receives chunks, transcribes, and builds
  notes.
- `src/services/transcription.service.js` is the pluggable ASR layer.
- `src/services/meeting-intelligence.service.js` produces notes, templates,
  briefs, and Q&A.
- `src/services/session-store.js` persists sessions to a local JSON file.

Keep it local-first: recordings stay on the user's machine; audio is only sent to
a transcription provider the user configured.

## Release safety

Before publishing, run:

```bash
npm run check && npm test
rg -n "api_key|secret|password|token|gho_|sk-|AKIA|BEGIN .*PRIVATE KEY" .
```
