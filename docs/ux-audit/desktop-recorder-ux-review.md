# Desktop Recorder UX Review

## Audit Scope

Surface reviewed: Electron desktop recorder MVP.

Evidence:

- `docs/ux-audit/01-desktop-idle.png`
- `desktop/src/renderer/index.html`
- `desktop/src/renderer/renderer.js`
- `desktop/src/renderer/styles.css`
- `src/services/local-capture.service.js`
- `src/services/session-store.js`

Limits:

- The OS screen picker and a full real transcription were not audited in this pass.
- Accessibility notes are based on visible UI and source structure, not a full keyboard/screen-reader run.

## Current User Goal

A user should be able to open the app, record a meeting from their computer, stop recording, and find the transcript later without understanding backend API details.

## What Works

- The core action is present: `Start recording` and `Stop`.
- The app separates system audio and microphone meters, which can help users confirm capture is working.
- The backend keeps transcript state in `data/meetings.json` and audio files in `data/local-captures/`.
- AssemblyAI credentials stay server-side, not in the desktop UI.

## Main UX Risks

1. First launch feels like a developer tool.
   The first screen asks for API URL, API key, user ID, and meeting title before the user understands the app. Most users just want to record a meeting.

2. `API key` is ambiguous.
   Users may think this is the AssemblyAI key. In reality it is the backend `API_KEY`. This can cause secret exposure or failed setup.

3. `Unauthorized` has no recovery path.
   The app shows a raw backend error but does not explain which field is wrong or how to fix it.

4. Debug stats are too prominent.
   Session ID, chunks, uploaded bytes, and provider are useful for developers, but they distract normal users from recording and transcript access.

5. The transcript area is not a real library.
   It only shows the current session. There is no meeting history, search, reopen, export, rename, or delete flow.

6. `Save` is unclear.
   The settings form has a Save button, but it is not obvious what gets saved, whether connection was tested, or whether the app is ready.

7. The app title says `Meeting Bot Recorder`.
   In desktop mode, no bot joins. The label can confuse users and make them think other meeting participants will see a bot.

8. Capture permissions are underexplained.
   Users need to know they must pick a screen/window with audio enabled and verify meters move before trusting the recording.

## Recommended Information Architecture

Use three main areas:

1. Recorder
   The default first screen. Focus only on starting/stopping a recording and showing readiness.

2. Library
   Saved transcripts and recordings. This should be where users return after meetings.

3. Settings
   Backend connection, server access key, storage location, retention, and advanced diagnostics.

## Recommended First Screen

Replace the current split developer layout with a task-first layout:

- Header: `Siela Recorder`
- Status row:
  - `Connected to Siela API`
  - `AssemblyAI ready`
  - `Microphone allowed`
  - `System audio ready`
- Meeting title input, optional and lightweight.
- Include microphone toggle.
- Primary button: `Start recording`
- Secondary link/button: `Open Library`
- Collapsible `Advanced` section for API URL, server access key, chunks, provider, session ID.

## Recording Flow

Recommended flow:

1. App opens and checks backend health automatically.
2. If backend auth fails, show `Server key is incorrect` with an `Open Settings` button.
3. User enters optional meeting title.
4. User clicks `Start recording`.
5. App opens the OS picker and says `Choose the meeting window and turn on audio sharing`.
6. After capture starts, app shows:
   - recording timer
   - audio detected indicators
   - `End recording`
   - `Pause` only if implemented
7. User clicks `End recording`.
8. App shows a progress state:
   - `Uploading final audio`
   - `Transcribing with AssemblyAI`
   - `Saving transcript`
9. App opens the transcript detail screen automatically.

## Where Transcriptions Should Be Saved

For the MVP:

- Keep transcript metadata in `data/meetings.json`.
- Keep raw audio in `data/local-captures/`.
- Add a `Library` screen that reads `GET /meetings` and shows saved transcripts.

For a more polished desktop app:

- Use local SQLite for desktop storage instead of one JSON file.
- Save transcripts as records with:
  - title
  - meeting date
  - duration
  - status
  - provider
  - transcript text
  - utterances/speakers
  - audio file path
  - export paths
- Keep audio retention configurable: keep forever, delete after transcription, or delete after N days.

For hosted Siela later:

- Save transcripts to the user's Siela workspace through the hosted API.
- Store audio in object storage with retention rules.
- Let the desktop app sync to the hosted transcript library.

## Library Screen

The library should show:

- Recent meetings list
- Status: recording, transcribing, completed, failed
- Title and date
- Duration
- Source: desktop or bot
- Search transcript text
- Filters: completed, failed, desktop, bot
- Actions:
  - Open
  - Rename
  - Export TXT
  - Export DOCX/PDF later
  - Copy transcript
  - Delete local audio
  - Delete transcript

Transcript detail should show:

- Transcript text
- Speaker blocks when available
- Meeting metadata
- Export/copy actions
- Raw audio file status
- Error recovery if transcription failed

## Label Improvements

Current label -> Better label:

- `Meeting Bot Recorder` -> `Siela Recorder`
- `API key` -> `Server access key`
- `Save` -> `Save settings`
- `User ID` -> hide in Advanced or replace with account/workspace later
- `Provider` -> hide in Advanced
- `Chunks` -> hide in Advanced
- `Uploaded` -> show only during upload
- `Stop` -> `End recording`
- `Refresh` -> remove; polling should be automatic
- `Transcript` empty state -> `Your transcript will appear here after recording`

## Error Handling

Replace raw messages with user-actionable messages:

- `Unauthorized` -> `The server access key is incorrect. Open Settings and check API_KEY.`
- `Failed to fetch` -> `Cannot reach the Siela API at this URL. Check that the server is running.`
- `No audio track was captured` -> `No meeting audio was detected. Share a screen/window with audio enabled or turn on microphone.`
- AssemblyAI missing key -> `AssemblyAI is not configured on the server. Add ASSEMBLYAI_API_KEY to .env.`

## Accessibility Risks

- `body` has a fixed `min-width`, so smaller windows may clip content.
- Buttons do not currently have a visible custom focus state.
- Status and error messages should use an `aria-live` region.
- The audio meters need text equivalents like `System audio detected` or `No system audio`.
- The transcript region should have clear headings and actions for keyboard users.
- Settings and advanced/debug controls should have predictable tab order.

## Best Improvement Plan

1. Convert the app into a three-tab layout: `Recorder`, `Library`, `Settings`.
2. Move API URL, server access key, session ID, chunks, provider, and uploaded bytes out of the default view.
3. Add automatic backend health/auth checks and a clear readiness banner.
4. Add a transcript library backed by `GET /meetings`.
5. Add transcript detail view with export/copy/delete actions.
6. Improve recording progress states and error recovery.
7. Rename the desktop product surface from `Meeting Bot Recorder` to `Siela Recorder`.

