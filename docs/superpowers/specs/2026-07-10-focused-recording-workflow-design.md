# Focused Recording Workflow Design

## Objective

Improve only Scribely's recorder workflow. Add a dedicated Screen Record action and replace the busy in-session interface with a focused recording state, while preserving the application's current typography, colors, icons, navigation, meeting library, transcription pipeline, and settings.

## Approved Direction

The recorder setup keeps the existing meeting title, optional notes, and collapsed recording options. Its actions become two equal choices:

- **Start Recording**, with the existing Lucide `mic` icon, captures meeting audio and the user's microphone for transcription.
- **Screen Record**, with the Lucide `monitor-up` icon, captures screen video, meeting audio, and the user's microphone.

Both paths use the selected provider, saved API key, local chunk storage, stop/finalization endpoint, transcription polling, interrupted-recording recovery, and saved meeting library already present in Scribely.

## Alternatives Considered

1. **Two direct actions with one focused active state (selected).** The recording type is clear before capture begins, there is no additional selection step, and both modes share the same simple in-session interface.
2. **Mode selector followed by one Start button.** This reduces the number of primary buttons but adds a choice followed by a second action and makes the selected mode easier to miss.
3. **Separate recorder pages.** This gives each mode more room but duplicates setup, increases navigation, and exceeds the requested scope.

## Setup State

The setup state retains:

- Meeting title
- Optional notes
- Collapsed Recording options
- Provider readiness handling
- Existing validation and errors

The readiness sidebar remains available before recording. The current **Start Recording** action and the new **Screen Record** action appear together and use existing button styling, spacing, colors, typography, and Lucide icons.

## Active Recording State

After either action starts successfully, only the recorder content changes. The sidebar and the rest of Scribely remain unchanged.

The active state shows:

- Meeting title
- Recording mode label: `Audio recording` or `Screen recording`
- Elapsed timer
- A short source summary
- One **Stop & transcribe** button with the Lucide `square` icon
- A quiet message confirming the recording is being saved locally

The active state hides:

- Setup/readiness cards
- Title and notes fields
- Recording options
- Audio meters
- Provider check actions
- Latest-notes preview
- Start and Screen Record actions
- Technical session details

There is no pause button or additional in-session menu in this scope.

## Recording Behavior

The renderer stores a recording mode for each new session:

- `audio`: request the selected display/window for system audio, mix it with the optional microphone, and write an audio-only WebM stream.
- `screen`: use the same mixed audio and include the selected display video track in the WebM stream.

The selected mode is passed into the existing session metadata so saved sessions and status copy can identify the capture type. Ending either mode uploads the final chunk, saves notes, starts transcription, and polls the same meeting endpoint.

## State Transitions

1. **Ready:** both recording actions are enabled only when the local server, local access, and provider key are ready.
2. **Requesting capture:** both actions disable while Scribely opens the system source picker.
3. **Recording:** the focused active state appears after capture and session creation succeed.
4. **Transcribing:** Stop & transcribe disables, the timer stops, and the focused state reports processing.
5. **Completed or failed:** streams are stopped, setup state is restored, and the existing result or error flow remains available.

If source selection is cancelled or setup fails, Scribely restores the setup state and displays the existing friendly error message. An accidental close remains handled by the interrupted-recording recovery flow.

## Accessibility And Responsive Behavior

- Buttons retain visible focus styles and at least the current minimum control height.
- Icon images remain decorative with empty alt text; the full action is conveyed by the visible label.
- Recording mode is communicated by text and not color alone.
- At narrower desktop widths, the two setup actions stack without clipping.
- The focused active state remains vertically centered and scroll-safe at the app's minimum supported window size.

## Testing

- Unit-test mode configuration so audio mode excludes video and screen mode includes it.
- Unit-test recorder-state presentation rules for ready, requesting, recording, and transcribing states.
- Run all existing tests and syntax checks.
- Verify both actions open the capture picker, create a session, upload chunks, stop, and enter transcription.
- Verify cancellation and provider/setup failures restore the setup interface.
- Verify the active state at the minimum app size and at a standard desktop size.

## Out Of Scope

- Redesigning navigation, meetings, calendar, settings, or transcript views
- Adding pause/resume, annotations, camera overlays, editing, or live streaming
- Changing transcription providers or transcription output
- Changing the existing Scribely visual identity
