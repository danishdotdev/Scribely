# Scribely App Icon Design

## Objective

Replace every visible Electron logo in Scribely with the approved Scribely logo, option B from the logo exploration board.

## Approved Mark

The master mark is a rounded Scribely-blue square containing a white waveform shaped into the letter `S`. It has no wordmark, border, shadow, or secondary symbol. The mark must remain recognizable at Windows taskbar and shortcut sizes.

The production asset will be recreated as a clean vector rather than cropped from the concept board. This provides sharp, consistent output at every required size while preserving the approved visual direction.

## Asset Set

The repository will contain one source-of-truth SVG plus generated platform assets:

- Master SVG for the in-app brand mark and future exports
- Multi-resolution Windows ICO containing 16, 24, 32, 48, 64, 128, and 256 pixel variants
- PNG exports at 32, 64, 128, 256, 512, and 1024 pixels
- macOS ICNS when packaging support is configured

All raster variants use the same geometry, color, safe area, and opaque rounded-square background.

## Application Surfaces

The approved mark replaces Electron branding in:

- Electron `BrowserWindow` icon
- Windows taskbar and Alt+Tab identity
- Windows App User Model identity
- Development window icon when running `electron .`
- Packaged executable, shortcut, and installer metadata
- macOS dock icon when running or packaging on macOS
- Desktop capture/source picker where the operating system uses the application window icon
- Scribely sidebar brand mark
- Any future notifications emitted by the desktop process

The application name and product metadata will use `Scribely`, not the desktop package's older `meeting-bot-desktop` name.

## Implementation

1. Add the vector master and generated icon assets under `desktop/assets/`.
2. Configure Electron's app name and Windows App User Model ID before creating windows.
3. Pass the platform-appropriate icon to each `BrowserWindow`.
4. Update desktop package metadata and packaging configuration to reference the generated assets.
5. Replace the CSS-only sidebar placeholder with the same SVG mark.
6. Keep all current Scribely colors, typography, layout, and behavior unchanged.

## Verification

- Confirm the master SVG matches approved option B.
- Validate all generated icon files exist and decode successfully.
- Launch Scribely on Windows and inspect the window frame, taskbar, Alt+Tab view, and screen-source picker.
- Verify the sidebar mark matches the operating-system icon.
- Run existing tests and syntax checks.
- Confirm no Electron logo asset or Electron product name remains in user-visible desktop configuration.

## Out Of Scope

- Changing the Scribely wordmark or product name
- Redesigning any application screen
- Changing the approved blue and white palette
- Adding animation or alternate logo variants
