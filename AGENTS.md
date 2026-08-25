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

## Where new things go

The page extends through registries, not special cases. Every user-facing variation is a row in a registry at the top of `vue-app.js`: a chord quality is a row in `FORMULAS`, an accent in `ACCENT_PRESETS`, a background in `BACKGROUND_PRESETS` (plus one `.background-<id>` composition in `styles.css`), a metronome sound in `METRONOME_SOUNDS` (including its oscillator parameters), an instrument in `INSTRUMENTS`. Menus, validation, storage, and rendering all derive from these rows.

Derive, don't duplicate. Adding a variation must never require a second hand-synced edit — parser lookup, autocomplete, validation, and playback read the registry directly (`FORMULA_BY_SUFFIX`, `QUALITY_SUFFIXES`, and `METRONOME_BY_VALUE` are the pattern). Desync between hand-maintained lists is the class of bug this rule exists to prevent. If a registry row is genuinely not enough, the renderer needs a new type — extend by type, like instruments do, rather than branching on names.

File seams: `index.html` owns templates, `styles.css` owns presentation, `vue-app.js` owns registries and behavior. If `vue-app.js` ever needs splitting, split along the component boundaries (`PianoDiagram`, `ChordDiagram`, `SelectMenu`) with plain script tags; there is no build step. These conventions are the enforcement mechanism — the page has no linter or build gate by design.

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

`FORMULAS` is the single registry for chord qualities, mapping suffixes to semitone intervals. `FORMULA_BY_SUFFIX` (the parser lookup) and `QUALITY_SUFFIXES` (the autocomplete list) both derive from it, so a new chord quality is one new row in `FORMULAS` and nothing else. Row order is cosmetic — the lookup is exact-match — but keep it simple-first; that is also the order of the default suggestion list.

`parseChord` accepts roots, accidentals, qualities, optional parentheses, and slash bass notes. `chordVoicing` creates the root position and rotates the lowest note upward for inversions. Slash bass notes are inserted below the chord.

`PianoDiagram.keyboard` chooses the leftmost practical two-octave window and marks active MIDI note numbers.

## Audio lifecycle

`INSTRUMENTS` is the instrument registry. Each entry has an ID, label, type, and sample zones. The current renderer supports `sample-zones` instruments.

Pointer-down calls `startChordNotes`. It resumes the shared `AudioContext`, loads and decodes the selected instrument once, chooses the nearest sample zone for each MIDI note, and starts all voices.

Pointer-up calls `stopChordNotes`.

- With sustain off, `releaseChord` applies a damper-style gain release (`DAMPER_RELEASE_SECONDS`, about 0.6s of natural decay) and stops the sample sources. Retriggers and instrument switches use much faster releases.
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
