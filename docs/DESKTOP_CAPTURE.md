# Desktop Capture Mode

Desktop capture mode records from the user's own machine, so no meeting bot joins
the call. The first implementation is an Electron client because it can be built
and run with the existing Node toolchain in this repo.

## Flow

```text
Desktop app
  getDisplayMedia(system/window audio)
  getUserMedia(microphone)
  mix audio tracks in Web Audio
  MediaRecorder chunks every 10 seconds
        |
        v
API server
  POST /local-capture/start
  POST /local-capture/:id/chunk
  POST /local-capture/:id/finish
        |
        v
Transcription provider
  AssemblyAI, Deepgram, OpenAI Whisper, or VibeVoice ASR
  Hinglish/Romanized transcript enrichment
  Local enhanced notes and optional helper tools
```

## Running locally

Terminal 1:

```bash
cp .env.example .env
npm install
npm start
```

Terminal 2:

```bash
npm run desktop:install
npm run desktop:dev
```

In `Settings`, choose `AssemblyAI`, `Deepgram`, `OpenAI Whisper`, or
`VibeVoice ASR`. Paid providers need that provider's API key. VibeVoice ASR runs
locally through `scripts/vibevoice-asr-transcribe.py` and does not use an API
key, but it requires a Python environment with `torch`, `accelerate`, and
`transformers>=5.3.0`. The desktop app keeps paid-provider keys in local app
storage and sends them to the local API only when a recording is ready to
transcribe. The default API URL is `http://127.0.0.1:3000`; the advanced
`Server access key` is only needed when the API server has `API_KEY` set.

The API stores:

- the original provider transcript
- a Hinglish/Romanized transcript for Hindi-English meetings
- speaker-labeled transcript text when the provider returns utterances
- raw notes taken during the meeting
- generated meeting notes, action items, follow-up email drafts, project plans,
  and a brief built from related previous meetings

AssemblyAI, Deepgram, and VibeVoice ASR can return diarized utterances. OpenAI
Whisper is available as a simpler fallback, but it does not provide reliable
speaker labels.

## Desktop screens

- `Recorder`: start/end recordings, verify readiness, and watch upload and
  transcript status. Transcription begins after `End recording`. Use the notes
  editor to jot names, agenda items, decisions, or terms while the call is
  happening. Microphone, note style, privacy, and audio meters are under
  `Recording options`.
- `Library`: search saved meetings, open transcript details, copy transcript
  text, switch between `Notes` and `Transcript`, export `.txt`, or delete the
  local session. Optional ask/action/follow-up tools live inside the selected
  meeting helper. `Ask across saved notes` searches the local transcript library.
- `Settings`: choose the transcription provider, paste the provider API key, and
  optionally edit advanced local server settings.

## Platform notes

- Windows: Electron/Chromium can capture system audio through loopback when the
  user shares a screen or window with audio.
- macOS 13+: Electron can use Chromium's macOS desktop-audio path. macOS 14.2+
  packaged builds need `NSAudioCaptureUsageDescription` in the app plist.
- macOS 12 and older: system audio capture requires a virtual audio device such
  as BlackHole or a native signed audio component.
- Browser extension remains useful later for Chrome-only tab capture, but it
  will not cover native Zoom/Teams apps.

## Current MVP boundaries

- Manual start/stop only.
- User must pick a screen or window in the system picker.
- Audio chunks are saved on the API server under `data/local-captures/`.
- Transcript metadata is saved in `data/meetings.json`.
- Hinglish transcript fields are saved in `data/meetings.json` and are also
  generated on read for older sessions when possible.
- The app uploads audio only; it does not store screen video.
- Audio files are deleted after transcription by default. Disable the privacy
  toggle in Recorder only when you need to inspect a local recording.
- Desktop transcription requires a provider API key in Settings, an env key on
  the API server, or a working local VibeVoice ASR Python setup.
- Calendar sync, public share links, Slack/Notion/Jira/Linear posting, team
  spaces, and mobile capture are not included in this local MVP because they
  require external account integrations.
