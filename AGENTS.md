# Piano Room maintenance guide

## Scope

This directory is the complete published Piano Room Agent Page. It is a static frontend app. Do not add a backend, build step, package manager dependency, remote runtime dependency, secret, or authenticated request.

The published URL is `https://page-content.astronauta.dev/p/piano-room/`.

## Files

- `index.html` contains the Vue templates for the shell, sidebars, chord grid, dock, and settings.
- `styles.css` contains all layout, piano, interaction, and responsive styles.
- `vue-app.js` contains chord parsing, voicing, state, components, drag and drop, audio, metronome, and sheet-library code.
- `vendor/vue.global.prod.js` is the local Vue runtime. Keep it local so the page has no CDN dependency.
- `assets/piano/` contains the sampled acoustic grand piano zones and their attribution.
- `agent-page.json` contains dashboard metadata.

The app runs directly in the browser. There is no compilation step.

## Component and state structure

`PianoDiagram` renders two octaves of HTML keys. It emits `note-on` on pointer-down or keyboard-down and `note-off` on release. It does not create audio nodes.

`ChordDiagram` owns the display for one chord occurrence. It derives notes from the chord symbol, inversion, and octave, then adds the occurrence ID to audio events.

The root Vue app owns durable state, audio nodes, the metronome, sheet storage, drag reordering, and both sidebars.

Local storage keys:

- `piano-room-state-v2` stores the current app state and global settings.
- `piano-room-sheets-v1` stores the sheet library.
- `piano-room-state-v1` is read only for migration.

Global appearance settings are stored with the current app state, not inside sheet snapshots. A selected accent and background therefore remain consistent when switching sheets.

## Theme architecture

`ACCENT_PRESETS` is the accent registry. Each preset has a stable ID, label, and six-digit hex color. `activeAccentHex` resolves the selected preset or custom color. `themeStyle` derives every accent-dependent CSS variable, including focus rings, key highlights, text contrast, and the much darker ambient palette. Add presets to the registry instead of adding color-specific CSS selectors.

`BACKGROUND_PRESETS` is the background registry. Each entry maps to a `background-<id>` CSS composition. The ambient layer and every settings preview use the same five child layers: `light-a`, `light-b`, `ambient-shadow`, `ambient-vignette`, and `ambient-grain`. A composition may hide unused layers. Backgrounds consume the derived `--ambient-*` and `--accent-rgb` variables, so every preset follows both built-in and custom accents.

To add a background:

1. Add a stable ID and label to `BACKGROUND_PRESETS`.
2. Define `.background-<id>` and only the layer rules that composition needs.
3. Keep the base extremely dark and decorative layers behind all content.
4. Test the full-page composition and its small preview at several accent colors.

Gradients and procedural SVG turbulence are reserved for ambient backgrounds and their previews. Panels, cards, controls, and the dock stay flat and opaque.

Inversions and octaves use occurrence IDs in the form `barIndex:chordIndex`. When bars move, `moveBar` must remap both objects.

## Chords and voicings

`FORMULAS` maps quality suffixes to semitone intervals. Add a chord quality there and in `QUALITY_SUFFIXES` so parsing and search stay in sync.

`parseChord` accepts roots, accidentals, qualities, optional parentheses, and slash bass notes. `chordVoicing` creates the root position and rotates the lowest note upward for inversions. Slash bass notes are inserted below the chord.

`PianoDiagram.keyboard` chooses the leftmost practical two-octave window and marks active MIDI note numbers.

## Audio lifecycle

`INSTRUMENTS` is the instrument registry. Each entry has an ID, label, type, and sample zones. The current renderer supports `sample-zones` instruments.

Pointer-down calls `startChordNotes`. It resumes the shared `AudioContext`, loads and decodes the selected instrument once, chooses the nearest sample zone for each MIDI note, and starts all voices.

Pointer-up calls `stopChordNotes`.

- With sustain off, `releaseChord` applies a short gain release and stops the sample sources.
- With sustain on, the samples continue through their recorded natural decay.
- Pressing the same chord again releases its previous voice before starting another one.

`activeChordVoices`, `heldChordIds`, and `chordRequestTokens` are runtime-only maps. Keep them outside Vue state. The request token prevents a slow first decode from starting a chord after the pointer was released.

The metronome shares the `AudioContext` but uses its own short oscillator voices.

## Adding an instrument

1. Add locally hosted audio samples under `assets/<instrument-name>/`.
2. Add attribution and license text beside the samples.
3. Add an entry to `INSTRUMENTS` with a stable ID, a user-facing label, `type: "sample-zones"`, and zones containing MIDI roots and relative URLs.
4. Do not add special cases to `startChordNotes`. Extend the instrument renderer by type if a future instrument needs a different playback model.
5. Test first load, repeat playback, note-off, sustain, octave extremes, and switching instruments.

Keep sample zones sparse enough for a small static page and dense enough that playback-rate transposition stays believable.

## Sheet library

The current sheet saves automatically. `newChart` saves the outgoing sheet before creating a new ID. `openSheet` restores notation, bars per row, inversions, octaves, tempo, and metronome sound.

The saved-sheets panel lists every sheet except the current one. Do not insert sheet titles with `innerHTML`; Vue text bindings keep stored text safe.

## Layout rules

The left and right panels occupy separate animated grid columns. The bottom dock shifts and narrows so it does not cover an open panel. At mobile widths, the settings panel becomes a fixed overlay above the dock.

Keep interface surfaces flat. Piano diagrams must keep a capped width instead of stretching with their cards. Hover effects must not change layout measurements.

Honor `prefers-reduced-motion` for every new transition or animation.

## Validation and publishing

For updates, prepare files outside the published directory. Validate that Vue mounts, then copy assets and other support files first. Replace `index.html` last.

Published files live at:

`/home/aldrin/pastelito/agent-pages/data/pages/piano-room/`

Use Browserless against the live URL to test:

- page and request errors;
- chord parsing and key counts;
- per-occurrence inversion and octave persistence;
- pointer-down audio start and pointer-up release;
- sustain on and off;
- instrument sample requests and buffer-source creation;
- sheet creation and reopening;
- drag reordering and notation updates;
- both sidebar transitions;
- every accent preset, custom hex normalization, and persistence;
- every ambient background, preview selection, and persistence;
- desktop and mobile overflow.

Capture a desktop screenshot after interaction tests and inspect it before finishing.
