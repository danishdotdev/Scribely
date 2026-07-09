# Scribely

> **Note:** the name *Scribely* is a working title and may change.

An app that **records your meetings locally** — no bot joins the call — then
transcribes them and turns them into structured, editable notes. Your audio never
leaves your machine unless you choose a cloud transcription provider.

- 🎙️ Records system audio + microphone from your own device (Electron desktop app)
- 🔒 Local-first — no bot in the meeting, recordings stored on your machine
- 🗣️ Speaker-attributed transcripts (AssemblyAI, Deepgram, OpenAI, or local VibeVoice)
- 📝 Granola-style notes: templates, enhanced notes, action items, follow-up
  drafts, and ask-your-meetings search
- 🌐 Hinglish / code-switched transcript support

> **Status:** early MVP and evolving. Contributions welcome.

## How it works

```
Electron desktop app  ──records chunks──▶  local API (this repo)
   (screen/system audio + mic)                │
                                       transcription provider (AssemblyAI/Deepgram/OpenAI/VibeVoice)
                                              │
                                       structured notes + searchable library
```

The desktop app captures audio and streams it to a small local API server, which
transcribes the recording and generates notes. Both live in this repo.

## Quick start

You need two processes: the API server and the desktop app.

```bash
# 1. install + start the API server
npm install
npm start                 # http://localhost:3000

# 2. in another terminal, install + run the desktop app
npm run desktop:install
npm run desktop:dev
```

In the desktop app's **Settings**, choose a transcription provider and (for cloud
providers) paste your API key — it's stored locally and only sent to the API when
a recording is ready to transcribe. Then in **Recorder**, click **Start
recording** and pick the meeting window/screen with audio enabled. Transcription
runs after you click **End recording**.

## Transcription providers

- **AssemblyAI / Deepgram / OpenAI** — cloud, need an API key, return diarized
  transcripts (OpenAI Whisper has no diarization).
- **VibeVoice** — runs locally, no API key, but needs a Python environment with
  `torch`, `accelerate`, and `transformers`.

## Features

- **Recorder** — start/stop local recordings, pick a note template, jot notes.
- **Library** — search, open, copy, export, and delete saved notes and transcripts.
- **Notes** — built-in templates (general, product review, sales call, user
  interview, stand-up, 1:1, hiring) plus "ask your meetings" Q&A.

See [`docs/DESKTOP_CAPTURE.md`](docs/DESKTOP_CAPTURE.md) for platform notes.

## Project layout

```
desktop/                 Electron app (recorder UI)
src/
  index.js               Express API entry
  routes/app.routes.js   Local-capture + notes/library endpoints
  services/
    local-capture.service.js   Receives audio chunks, transcribes, makes notes
    transcription.service.js    Pluggable ASR providers
    meeting-intelligence.service.js   Notes, templates, briefs, Q&A
    session-store.js
  utils/                 logger, security, hinglish, speaker-attribution
scripts/vibevoice-asr-transcribe.py   Optional local ASR
```

## API (local)

`GET /health`, `POST /local-capture/start` · `/:id/chunk` · `/:id/finish`,
`GET /meetings` · `/:id`, `PATCH /meetings/:id/notes`,
`POST /meetings/:id/regenerate-notes` · `/meetings/ask` · `/meetings/:id/ask`,
`GET /meetings/templates` · `/meetings/export.csv`, `DELETE /meetings/:id`.

## Testing

```bash
npm run check   # syntax-check all files
npm test        # unit tests
```

## Contributing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
