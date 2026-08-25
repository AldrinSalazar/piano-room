(function () {
  "use strict";

  const { createApp } = Vue;
  const STORAGE_KEY = "piano-room-state-v2";
  const LEGACY_STORAGE_KEY = "piano-room-state-v1";
  const SHEET_LIBRARY_KEY = "piano-room-sheets-v1";
  const INSTRUMENTS = {
    piano: {
      id: "piano",
      label: "Acoustic grand piano",
      type: "sample-zones",
      zones: [
        { midi: 36, url: "assets/piano/C2.mp3" },
        { midi: 48, url: "assets/piano/C3.mp3" },
        { midi: 60, url: "assets/piano/C4.mp3" },
        { midi: 72, url: "assets/piano/C5.mp3" },
        { midi: 84, url: "assets/piano/C6.mp3" }
      ]
    }
  };
  const ACCENT_PRESETS = [
    { id: "ember", label: "Ember", hex: "#EE754F" },
    { id: "cyan", label: "Cyan", hex: "#43B9D2" },
    { id: "mint", label: "Mint", hex: "#62B98A" },
    { id: "gold", label: "Gold", hex: "#D7A54A" },
    { id: "rose", label: "Rose", hex: "#D96F82" },
    { id: "blue", label: "Blue", hex: "#719EE6" }
  ];
  const BACKGROUND_PRESETS = [
    { id: "still", label: "Still" },
    { id: "halo", label: "Halo" },
    { id: "sweep", label: "Sweep" },
    { id: "fold", label: "Fold" },
    { id: "grain", label: "Grain" }
  ];
  const METRONOME_SOUNDS = [
    { value: "wood", label: "Woodblock" },
    { value: "digital", label: "Digital" },
    { value: "soft", label: "Soft tick" }
  ];
  const DAMPER_RELEASE_SECONDS = 0.6;
  const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const BLACK_PITCHES = new Set([1, 3, 6, 8, 10]);
  const NOTE_TO_PC = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
  const FORMULAS = [
    { suffix: "maj9", intervals: [0, 4, 7, 11, 14] },
    { suffix: "mmaj7", intervals: [0, 3, 7, 11] },
    { suffix: "m7b5", intervals: [0, 3, 6, 10] },
    { suffix: "dim7", intervals: [0, 3, 6, 9] },
    { suffix: "7sus4", intervals: [0, 5, 7, 10] },
    { suffix: "7sus2", intervals: [0, 2, 7, 10] },
    { suffix: "madd9", intervals: [0, 3, 7, 14] },
    { suffix: "add9", intervals: [0, 4, 7, 14] },
    { suffix: "maj7", intervals: [0, 4, 7, 11] },
    { suffix: "sus4", intervals: [0, 5, 7] },
    { suffix: "sus2", intervals: [0, 2, 7] },
    { suffix: "dim", intervals: [0, 3, 6] },
    { suffix: "aug", intervals: [0, 4, 8] },
    { suffix: "m9", intervals: [0, 3, 7, 10, 14] },
    { suffix: "m7", intervals: [0, 3, 7, 10] },
    { suffix: "m6", intervals: [0, 3, 7, 9] },
    { suffix: "maj6", intervals: [0, 4, 7, 9] },
    { suffix: "9", intervals: [0, 4, 7, 10, 14] },
    { suffix: "7", intervals: [0, 4, 7, 10] },
    { suffix: "6", intervals: [0, 4, 7, 9] },
    { suffix: "5", intervals: [0, 7] },
    { suffix: "m", intervals: [0, 3, 7] },
    { suffix: "", intervals: [0, 4, 7] }
  ];
  const QUALITY_SUFFIXES = ["", "m", "5", "7", "7sus2", "7sus4", "maj7", "mmaj7", "m7", "m7b5", "add9", "madd9", "sus4", "sus2", "6", "maj6", "m6", "9", "maj9", "m9", "dim", "dim7", "aug"];
  const ROOTS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
  const CHORD_OPTIONS = ROOTS.flatMap((root) => QUALITY_SUFFIXES.map((quality) => root + quality));
  const DEFAULT_SHEET = "| Em(add9) | Cmaj7    | G/B      | A7sus4  A7 |\n| Em(add9) | Cmaj7/E  | Gmaj7/D  | B7sus4 B7  |";

  function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeHex(value, fallback = "#EE754F") {
    const raw = String(value || "").trim();
    const short = /^#?([0-9a-f]{3})$/i.exec(raw);
    if (short) return "#" + short[1].split("").map((character) => character + character).join("").toUpperCase();
    const full = /^#?([0-9a-f]{6})$/i.exec(raw);
    return full ? "#" + full[1].toUpperCase() : fallback;
  }

  function hexToRgb(hex) {
    const normalized = normalizeHex(hex);
    return [1, 3, 5].map((index) => parseInt(normalized.slice(index, index + 2), 16));
  }

  function mixHex(hex, target, amount) {
    const sourceRgb = hexToRgb(hex);
    const targetRgb = hexToRgb(target);
    const mixed = sourceRgb.map((channel, index) => Math.round(channel + (targetRgb[index] - channel) * amount));
    return "#" + mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function sheetId() {
    return "sheet-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function midiName(midi) {
    return NOTE_NAMES[mod(midi, 12)] + (Math.floor(midi / 12) - 1);
  }

  function parseChord(symbol) {
    const match = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/.exec(symbol);
    if (!match) return null;
    const rootText = match[1] + match[2];
    const rawQuality = match[3].replace(/[()]/g, "");
    const aliases = { min: "m", major7: "maj7", "mmaj7": "mmaj7" };
    const quality = aliases[rawQuality] || rawQuality;
    const formula = FORMULAS.find((item) => item.suffix === quality);
    if (!formula || NOTE_TO_PC[rootText] === undefined) return null;
    const bassText = match[4] ? match[4] + match[5] : null;
    if (bassText && NOTE_TO_PC[bassText] === undefined) return null;
    return {
      rootPc: NOTE_TO_PC[rootText],
      intervals: formula.intervals,
      bassPc: bassText ? NOTE_TO_PC[bassText] : null
    };
  }

  let barIdSequence = 0;

  function parseSheet(source) {
    const bars = [];
    const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const chunks = line.includes("|")
        ? line.split("|").map((part) => part.trim()).filter(Boolean)
        : [line];
      for (const chunk of chunks) {
        if (chunk === "%") {
          const previous = bars[bars.length - 1];
          bars.push({ id: ++barIdSequence, chords: previous ? previous.chords.slice() : [], repeated: true });
          continue;
        }
        const chords = chunk.split(/\s+/).map((token) => token.trim().replace(/,/g, "")).filter(Boolean);
        if (chords.length) bars.push({ id: ++barIdSequence, chords, repeated: false });
      }
    }
    return bars;
  }

  const dragState = {
    active: false, pending: false, pointerId: null,
    card: null, ghost: null, rect: null,
    startX: 0, startY: 0, lastX: 0, lastY: 0,
    currentIndex: 0, scrollRaf: 0,
    onMove: null, onUp: null, onCancel: null
  };
  const REDUCED_MOTION = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function captureBarRects(grid) {
    const rects = new Map();
    grid.querySelectorAll(".bar-card").forEach((card) => rects.set(card, card.getBoundingClientRect()));
    return { rects, scrollY: window.scrollY };
  }

  function playBarFlip(grid, before) {
    if (REDUCED_MOTION && REDUCED_MOTION.matches) return;
    const scrollDelta = window.scrollY - before.scrollY;
    grid.querySelectorAll(".bar-card").forEach((card) => {
      const first = before.rects.get(card);
      if (!first) return;
      const last = card.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = (first.top - scrollDelta) - last.top;
      if (!dx && !dy) return;
      card.animate(
        [{ transform: "translate(" + dx + "px, " + dy + "px)" }, { transform: "translate(0, 0)" }],
        { duration: 280, easing: "cubic-bezier(.22, .72, .24, 1)" }
      );
    });
  }

  function dragScrollStep(app) {
    if (!dragState.active) return;
    const margin = 72;
    let delta = 0;
    if (dragState.lastY < margin) delta = -Math.ceil((margin - dragState.lastY) / 5);
    else if (dragState.lastY > window.innerHeight - margin) delta = Math.ceil((dragState.lastY - (window.innerHeight - margin)) / 5);
    if (delta) {
      window.scrollBy(0, delta);
      positionDragGhost();
      app.hitTestDragTarget();
    }
    dragState.scrollRaf = requestAnimationFrame(() => dragScrollStep(app));
  }

  function positionDragGhost() {
    if (!dragState.ghost) return;
    const dx = dragState.lastX - dragState.startX;
    const dy = dragState.lastY - dragState.startY;
    dragState.ghost.style.transform = "translate(" + dx + "px, " + dy + "px) scale(1.035) rotate(.5deg)";
  }

  function chordVoicing(symbol, inversion) {
    const chord = parseChord(symbol);
    if (!chord) return null;
    const rootMidi = 48 + chord.rootPc;
    const notes = chord.intervals.map((interval) => rootMidi + interval).sort((a, b) => a - b);
    const turns = mod(inversion, notes.length);
    for (let index = 0; index < turns; index += 1) {
      const lowest = notes.shift();
      notes.push(lowest + 12);
      notes.sort((a, b) => a - b);
    }
    if (chord.bassPc !== null) {
      let bassMidi = notes[0] - mod(notes[0] - chord.bassPc, 12);
      if (bassMidi >= notes[0]) bassMidi -= 12;
      notes.unshift(bassMidi);
    }
    return Array.from(new Set(notes)).sort((a, b) => a - b);
  }

  function inversionName(index) {
    if (index === 0) return "Root";
    if (index === 1) return "1st";
    if (index === 2) return "2nd";
    if (index === 3) return "3rd";
    return index + "th";
  }

  function loadState() {
    let stored = {};
    let legacy = {};
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_error) { stored = {}; }
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "{}"); } catch (_error) { legacy = {}; }
    const source = typeof stored.source === "string" ? stored.source : typeof legacy.source === "string" ? legacy.source : DEFAULT_SHEET;
    return {
      title: typeof stored.title === "string" ? stored.title : typeof legacy.title === "string" ? legacy.title : "Midnight Progression",
      source,
      barsPerRow: [1, 2, 3, 4].includes(stored.barsPerRow) ? stored.barsPerRow : [1, 2, 3, 4].includes(legacy.barsPerRow) ? legacy.barsPerRow : 4,
      bars: parseSheet(source),
      sidebarOpen: stored.sidebarOpen !== false,
      settingsOpen: stored.settingsOpen === true,
      inversions: stored.inversions && typeof stored.inversions === "object" ? stored.inversions : {},
      octaves: stored.octaves && typeof stored.octaves === "object" ? stored.octaves : {},
      currentSheetId: typeof stored.currentSheetId === "string" ? stored.currentSheetId : sheetId(),
      sustain: stored.sustain === true,
      instrument: INSTRUMENTS[stored.instrument] ? stored.instrument : "piano",
      accentPreset: ACCENT_PRESETS.some((preset) => preset.id === stored.accentPreset) || stored.accentPreset === "custom" ? stored.accentPreset : "ember",
      customAccent: normalizeHex(stored.customAccent, "#35C6A3"),
      backgroundPreset: BACKGROUND_PRESETS.some((preset) => preset.id === stored.backgroundPreset) ? stored.backgroundPreset : "still",
      bpm: clamp(Number(stored.bpm || legacy.bpm || 92), 35, 240),
      sound: ["wood", "digital", "soft"].includes(stored.sound || legacy.sound) ? stored.sound || legacy.sound : "wood"
    };
  }

  function loadSheetLibrary(state) {
    let sheets = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(SHEET_LIBRARY_KEY) || "[]");
      if (Array.isArray(parsed)) sheets = parsed.filter((sheet) => sheet && typeof sheet.id === "string" && typeof sheet.source === "string");
    } catch (_error) {
      sheets = [];
    }
    if (!sheets.some((sheet) => sheet.id === state.currentSheetId)) {
      sheets.push({
        id: state.currentSheetId,
        title: state.title,
        source: state.source,
        barsPerRow: state.barsPerRow,
        inversions: state.inversions,
        octaves: state.octaves,
        bpm: state.bpm,
        sound: state.sound,
        updatedAt: Date.now()
      });
    }
    return sheets;
  }

  const PianoDiagram = {
    props: {
      notes: { type: Array, required: true }
    },
    emits: ["note-on", "note-off"],
    data() {
      return { voicingChanging: false, sounding: false };
    },
    computed: {
      keyboard() {
        const lowest = Math.min(...this.notes);
        const highest = Math.max(...this.notes);
        const preferredC = Math.floor(lowest / 12) * 12;
        let start = preferredC;
        if (highest > preferredC + 24) {
          start = lowest;
          while (BLACK_PITCHES.has(mod(start, 12))) start -= 1;
        }
        const end = Math.max(start + 24, highest);
        const active = new Set(this.notes);
        const whites = [];
        for (let midi = start; midi <= end; midi += 1) {
          if (!BLACK_PITCHES.has(mod(midi, 12))) whites.push({ midi, active: active.has(midi) });
        }
        const whiteIndexes = new Map(whites.map((key, index) => [key.midi, index]));
        const blacks = [];
        for (let midi = start; midi < end; midi += 1) {
          if (!BLACK_PITCHES.has(mod(midi, 12))) continue;
          let previousWhite = midi - 1;
          while (!whiteIndexes.has(previousWhite)) previousWhite -= 1;
          const index = whiteIndexes.get(previousWhite);
          blacks.push({
            midi,
            active: active.has(midi),
            left: ((index + 1) / whites.length * 100) + "%",
            width: ((100 / whites.length) * 0.62) + "%"
          });
        }
        return { start, end, whites, blacks };
      },
      ariaLabel() {
        return "Play chord: " + this.notes.map(midiName).join(", ");
      }
    },
    watch: {
      notes: {
        deep: true,
        handler() {
          this.voicingChanging = false;
          window.requestAnimationFrame(() => {
            this.voicingChanging = true;
            clearTimeout(this.voicingTimer);
            this.voicingTimer = window.setTimeout(() => { this.voicingChanging = false; }, 360);
          });
        }
      }
    },
    beforeUnmount() {
      clearTimeout(this.voicingTimer);
      if (this.sounding) this.$emit("note-off");
    },
    methods: {
      midiName,
      startPlaying(event) {
        if (this.sounding) return;
        this.sounding = true;
        if (event && event.pointerId !== undefined && event.currentTarget.setPointerCapture) {
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_error) { /* Pointer capture is optional. */ }
        }
        this.$emit("note-on", this.notes);
      },
      stopPlaying() {
        if (!this.sounding) return;
        this.sounding = false;
        this.$emit("note-off");
      }
    },
    template: `
      <div class="piano-wrap">
        <div class="piano" :class="{ 'voicing-changing': voicingChanging, sounding }" role="button" tabindex="0" :aria-label="ariaLabel" @pointerdown.prevent="startPlaying" @pointerup.prevent="stopPlaying" @pointercancel="stopPlaying" @keydown.enter.prevent="startPlaying" @keydown.space.prevent="startPlaying" @keyup.enter.prevent="stopPlaying" @keyup.space.prevent="stopPlaying" @blur="stopPlaying">
          <div v-for="(key, index) in keyboard.whites" :key="key.midi" class="white-key" :class="{ active: key.active }" :data-midi="key.midi">
            <span v-if="key.active" class="key-marker"></span>
            <span v-if="index === 0 || index === keyboard.whites.length - 1" class="key-range-label">{{ midiName(key.midi) }}</span>
          </div>
          <div v-for="key in keyboard.blacks" :key="key.midi" class="black-key" :class="{ active: key.active }" :data-midi="key.midi" :style="{ left: key.left, width: key.width }">
            <span v-if="key.active" class="key-marker"></span>
          </div>
        </div>
      </div>`
  };

  const ChordDiagram = {
    components: { PianoDiagram },
    props: {
      symbol: { type: String, required: true },
      occurrenceId: { type: String, required: true },
      inversion: { type: Number, required: true },
      octave: { type: Number, required: true },
      barNumber: { type: Number, default: null },
      repeated: { type: Boolean, default: false }
    },
    emits: ["set-inversion", "set-octave", "note-on", "note-off"],
    computed: {
      chord() { return parseChord(this.symbol); },
      notes() { return this.chord ? chordVoicing(this.symbol, this.inversion).map((note) => note + this.octave * 12) : []; },
      noteNames() { return this.notes.map((note) => NOTE_NAMES[mod(note, 12)]).join(" · "); },
      inversionCount() { return this.chord ? this.chord.intervals.length : 1; },
      safeInversion() { return mod(this.inversion, this.inversionCount); },
      inversionLabel() { return inversionName(this.safeInversion); },
      octaveLabel() { return "Oct " + (this.octave > 0 ? "+" : "") + this.octave; }
    },
    template: `
      <section class="chord-view">
        <div class="chord-heading">
          <div class="chord-identity">
            <span v-if="barNumber !== null" class="bar-number">#{{ barNumber }}<span v-if="repeated" class="repeat-mark">%</span></span>
            <h3 class="chord-name">{{ symbol }}</h3>
          </div>
          <div v-if="chord" class="voicing-controls">
            <button class="inversion-cycle" type="button" :aria-label="'Next inversion for ' + symbol" @click="changeInversion(1)">
              <span>{{ inversionLabel }}</span>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg>
            </button>
            <div class="octave-stepper" role="group" :aria-label="'Octave for ' + symbol">
              <button type="button" :disabled="octave <= -2" :aria-label="'Lower ' + symbol + ' one octave'" @click="changeOctave(-1)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5"/></svg></button>
              <span>{{ octaveLabel }}</span>
              <button type="button" :disabled="octave >= 2" :aria-label="'Raise ' + symbol + ' one octave'" @click="changeOctave(1)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg></button>
            </div>
          </div>
        </div>
        <template v-if="chord">
          <p class="notes">{{ noteNames }}</p>
          <piano-diagram :notes="notes" @note-on="$emit('note-on', { id: occurrenceId, notes: $event })" @note-off="$emit('note-off', occurrenceId)"></piano-diagram>
        </template>
        <div v-else class="invalid-chord">This chord is not in the library yet</div>
      </section>`,
    methods: {
      changeInversion(direction) {
        this.$emit("set-inversion", this.occurrenceId, mod(this.safeInversion + direction, this.inversionCount));
      },
      changeOctave(direction) {
        this.$emit("set-octave", this.occurrenceId, clamp(this.octave + direction, -2, 2));
      }
    }
  };

  let selectMenuCount = 0;

  const SelectMenu = {
    props: {
      modelValue: { type: String, required: true },
      options: { type: Array, required: true },
      ariaLabel: { type: String, required: true }
    },
    emits: ["update:modelValue"],
    data() {
      return { open: false, highlightIndex: 0, uid: ++selectMenuCount };
    },
    computed: {
      listId() { return "select-menu-" + this.uid + "-list"; },
      selectedLabel() {
        const selected = this.options.find((option) => option.value === this.modelValue);
        return selected ? selected.label : "";
      }
    },
    mounted() {
      document.addEventListener("pointerdown", this.onDocumentPointerdown);
    },
    beforeUnmount() {
      document.removeEventListener("pointerdown", this.onDocumentPointerdown);
    },
    methods: {
      optionId(index) { return this.listId + "-option-" + index; },
      toggle() { this.open ? this.close() : this.show(); },
      show() {
        const selected = this.options.findIndex((option) => option.value === this.modelValue);
        this.highlightIndex = selected >= 0 ? selected : 0;
        this.open = true;
        this.$nextTick(() => {
          this.$refs.list.focus();
          this.scrollToActive();
        });
      },
      close(refocus = true) {
        if (!this.open) return;
        this.open = false;
        if (refocus) this.$nextTick(() => this.$refs.trigger.focus());
      },
      choose(value) {
        this.$emit("update:modelValue", value);
        this.close();
      },
      moveHighlight(delta) {
        const count = this.options.length;
        this.highlightIndex = mod(this.highlightIndex + delta, count);
        this.scrollToActive();
      },
      scrollToActive() {
        const active = this.$refs.list && this.$refs.list.querySelector(".select-option.active");
        if (active) active.scrollIntoView({ block: "nearest" });
      },
      onKeydown(event) {
        if (!this.open) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.show();
          }
          return;
        }
        if (event.key === "ArrowDown") { event.preventDefault(); this.moveHighlight(1); }
        else if (event.key === "ArrowUp") { event.preventDefault(); this.moveHighlight(-1); }
        else if (event.key === "Home") { event.preventDefault(); this.highlightIndex = 0; this.scrollToActive(); }
        else if (event.key === "End") { event.preventDefault(); this.highlightIndex = this.options.length - 1; this.scrollToActive(); }
        else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.choose(this.options[this.highlightIndex].value); }
        else if (event.key === "Escape") { event.preventDefault(); this.close(); }
        else if (event.key === "Tab") { this.close(false); }
      },
      onDocumentPointerdown(event) {
        if (this.open && this.$refs.root && !this.$refs.root.contains(event.target)) this.close(false);
      }
    },
    template: `
      <div class="select-menu" ref="root" @keydown="onKeydown">
        <button ref="trigger" class="select-trigger" type="button" :aria-label="ariaLabel" aria-haspopup="listbox" :aria-expanded="open ? 'true' : 'false'" :aria-controls="listId" @click="toggle">
          <span class="select-value">{{ selectedLabel }}</span>
          <svg class="select-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>
        </button>
        <transition name="select-pop">
          <ul v-show="open" ref="list" :id="listId" class="select-list" role="listbox" tabindex="-1" :aria-label="ariaLabel" :aria-activedescendant="optionId(highlightIndex)">
            <li v-for="(option, index) in options" :key="option.value" :id="optionId(index)" class="select-option" :class="{ active: index === highlightIndex, selected: option.value === modelValue }" role="option" :aria-selected="option.value === modelValue ? 'true' : 'false'" @click="choose(option.value)" @mouseenter="highlightIndex = index">{{ option.label }}</li>
          </ul>
        </transition>
      </div>`
  };

  const app = createApp({
    components: { ChordDiagram, SelectMenu },
    data() {
      const state = loadState();
      return {
        ...state,
        sheets: loadSheetLibrary(state),
        chordSearch: "",
        suggestionIndex: 0,
        suggestionsOpen: false,
        toastMessage: "",
        toastVisible: false,
        playing: false,
        currentBeat: -1,
        tapTimes: [],
        draggedBarId: null,
        armedDeleteId: null
      };
    },
    computed: {
      matchingSuggestions() {
        const query = this.chordSearch.trim().toLowerCase();
        if (!query) return CHORD_OPTIONS.slice(0, 9);
        const rank = (chord) => {
          const lower = chord.toLowerCase();
          if (lower === query) return 0;
          if (lower.startsWith(query)) return 1;
          return 2;
        };
        const choices = CHORD_OPTIONS
          .filter((chord) => chord.toLowerCase().includes(query))
          .sort((left, right) => rank(left) - rank(right) || left.length - right.length || left.localeCompare(right));
        return choices.slice(0, 9);
      },
      otherSheets() {
        return this.sheets
          .filter((sheet) => sheet.id !== this.currentSheetId)
          .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
      },
      savedSheetRows() {
        const current = this.sheets.find((sheet) => sheet.id === this.currentSheetId);
        const rest = this.otherSheets;
        return current ? [current, ...rest] : rest;
      },
      instrumentOptions() {
        return Object.values(INSTRUMENTS);
      },
      instrumentSelectOptions() {
        return this.instrumentOptions.map((instrument) => ({ value: instrument.id, label: instrument.label }));
      },
      soundOptions() {
        return METRONOME_SOUNDS;
      },
      accentOptions() {
        return ACCENT_PRESETS;
      },
      backgroundOptions() {
        return BACKGROUND_PRESETS;
      },
      activeAccentHex() {
        if (this.accentPreset === "custom") return normalizeHex(this.customAccent, "#35C6A3");
        return ACCENT_PRESETS.find((preset) => preset.id === this.accentPreset)?.hex || ACCENT_PRESETS[0].hex;
      },
      themeStyle() {
        const accent = this.activeAccentHex;
        const rgb = hexToRgb(accent);
        return {
          "--accent": accent,
          "--accent-rgb": rgb.join(", "),
          "--accent-strong": mixHex(accent, "#FFFFFF", .16),
          "--accent-soft": `rgba(${rgb.join(", ")}, .12)`,
          "--accent-ink": mixHex(accent, "#000000", .78),
          "--key-active": mixHex(accent, "#FFFFFF", .43),
          "--key-black-active": mixHex(accent, "#000000", .12),
          "--key-label": mixHex(accent, "#000000", .65),
          "--ambient-base": mixHex(accent, "#000000", .955),
          "--ambient-mid": mixHex(accent, "#000000", .89),
          "--ambient-deep": mixHex(accent, "#000000", .975),
          "--ambient-glow": `rgba(${rgb.join(", ")}, .16)`,
          "--ambient-glow-strong": `rgba(${rgb.join(", ")}, .29)`
        };
      },
      backgroundClass() {
        return "background-" + this.backgroundPreset;
      },
      storageState() {
        return {
          title: this.title,
          source: this.source,
          barsPerRow: this.barsPerRow,
          sidebarOpen: this.sidebarOpen,
          settingsOpen: this.settingsOpen,
          inversions: this.inversions,
          octaves: this.octaves,
          currentSheetId: this.currentSheetId,
          sustain: this.sustain,
          instrument: this.instrument,
          accentPreset: this.accentPreset,
          customAccent: this.customAccent,
          backgroundPreset: this.backgroundPreset,
          bpm: this.bpm,
          sound: this.sound
        };
      }
    },
    watch: {
      storageState: {
        deep: true,
        handler(value) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
          this.saveCurrentSheet();
        }
      }
    },
    mounted() {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioEngine();
      this.schedulerTimer = null;
      this.nextNoteTime = 0;
      this.scheduledBeat = 0;
      this.instrumentSampleData = new Map();
      this.instrumentBuffers = new Map();
      this.activeChordVoices = new Map();
      this.heldChordIds = new Set();
      this.chordRequestTokens = new Map();
      this.preloadInstrument(this.instrument);
      this.loadInstrumentBuffers(this.instrument).catch(() => []);
      this.saveCurrentSheet();
    },
    beforeUnmount() {
      if (this.schedulerTimer) clearInterval(this.schedulerTimer);
      clearTimeout(this.deleteArmTimer);
      if (this.activeChordVoices) {
        for (const id of this.activeChordVoices.keys()) this.releaseChord(id, 0.02);
      }
    },
    methods: {
      inversionName,
      toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; },
      toggleSettings() { this.settingsOpen = !this.settingsOpen; },
      hideSidebars() {
        this.sidebarOpen = false;
        this.settingsOpen = false;
      },
      setSustain(value) {
        this.sustain = Boolean(value);
        if (!this.sustain && this.activeChordVoices) {
          for (const id of this.activeChordVoices.keys()) {
            if (!this.heldChordIds.has(id)) this.releaseChord(id, DAMPER_RELEASE_SECONDS);
          }
        }
      },
      setInstrument(id) {
        if (!INSTRUMENTS[id] || id === this.instrument) return;
        for (const voiceId of this.activeChordVoices.keys()) this.releaseChord(voiceId, 0.03);
        this.instrument = id;
        this.preloadInstrument(id);
        this.loadInstrumentBuffers(id).catch(() => []);
      },
      setAccentPreset(id) {
        if (id === "custom" || ACCENT_PRESETS.some((preset) => preset.id === id)) this.accentPreset = id;
      },
      setCustomAccent(value) {
        const normalized = normalizeHex(value, this.customAccent);
        this.customAccent = normalized;
        this.accentPreset = "custom";
        return normalized;
      },
      setBackgroundPreset(id) {
        if (BACKGROUND_PRESETS.some((preset) => preset.id === id)) this.backgroundPreset = id;
      },
      buildSheet(showToast) {
        this.title = this.title.trim() || "Untitled chart";
        this.bars = parseSheet(this.source);
        if (showToast) this.showToast("Chart rebuilt");
      },
      setBarsPerRow(count) { this.barsPerRow = count; },
      inversionFor(id, symbol) {
        const chord = parseChord(symbol);
        const count = chord ? chord.intervals.length : 1;
        return mod(Number(this.inversions[id] || 0), count);
      },
      setInversion(id, value) {
        this.inversions = { ...this.inversions, [id]: value };
      },
      octaveFor(id) {
        return clamp(Number(this.octaves[id] || 0), -2, 2);
      },
      setOctave(id, value) {
        this.octaves = { ...this.octaves, [id]: clamp(Number(value || 0), -2, 2) };
      },
      saveCurrentSheet() {
        if (!this.currentSheetId) return;
        const snapshot = {
          id: this.currentSheetId,
          title: this.title.trim() || "Untitled chart",
          source: this.source,
          barsPerRow: this.barsPerRow,
          inversions: { ...this.inversions },
          octaves: { ...this.octaves },
          bpm: this.bpm,
          sound: this.sound,
          updatedAt: Date.now()
        };
        const index = this.sheets.findIndex((sheet) => sheet.id === snapshot.id);
        this.sheets = index === -1
          ? [...this.sheets, snapshot]
          : this.sheets.map((sheet, sheetIndex) => sheetIndex === index ? snapshot : sheet);
        localStorage.setItem(SHEET_LIBRARY_KEY, JSON.stringify(this.sheets));
      },
      openSheet(sheet) {
        if (!sheet || sheet.id === this.currentSheetId) return;
        this.saveCurrentSheet();
        this.currentSheetId = sheet.id;
        this.title = sheet.title || "Untitled chart";
        this.source = sheet.source;
        this.barsPerRow = [1, 2, 3, 4].includes(sheet.barsPerRow) ? sheet.barsPerRow : 4;
        this.inversions = sheet.inversions && typeof sheet.inversions === "object" ? { ...sheet.inversions } : {};
        this.octaves = sheet.octaves && typeof sheet.octaves === "object" ? { ...sheet.octaves } : {};
        this.bpm = clamp(Number(sheet.bpm || 92), 35, 240);
        this.sound = ["wood", "digital", "soft"].includes(sheet.sound) ? sheet.sound : "wood";
        this.bars = parseSheet(this.source);
        this.showToast(this.title + " opened");
      },
      deleteSheet(id) {
        if (!this.sheets.some((sheet) => sheet.id === id)) return;
        if (this.armedDeleteId !== id) {
          this.armedDeleteId = id;
          clearTimeout(this.deleteArmTimer);
          this.deleteArmTimer = setTimeout(() => { this.armedDeleteId = null; }, 2600);
          return;
        }
        clearTimeout(this.deleteArmTimer);
        this.armedDeleteId = null;
        this.sheets = this.sheets.filter((sheet) => sheet.id !== id);
        localStorage.setItem(SHEET_LIBRARY_KEY, JSON.stringify(this.sheets));
        if (id === this.currentSheetId) {
          this.currentSheetId = sheetId();
          this.title = "";
          this.source = "";
          this.bars = [];
          this.inversions = {};
          this.octaves = {};
        }
        this.showToast("Sheet deleted");
      },
      barsToSource(bars) {
        const tokens = bars.map((bar, index) => {
          const previous = bars[index - 1];
          const repeatsPrevious = previous && bar.chords.length === previous.chords.length && bar.chords.every((chord, chordIndex) => chord === previous.chords[chordIndex]);
          return bar.repeated && repeatsPrevious ? "%" : bar.chords.join(" ");
        });
        const lines = [];
        for (let index = 0; index < tokens.length; index += this.barsPerRow) {
          lines.push("| " + tokens.slice(index, index + this.barsPerRow).join(" | ") + " |");
        }
        return lines.join("\n");
      },
      moveBar(fromIndex, toIndex, silent) {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= this.bars.length || toIndex >= this.bars.length) return;
        const reordered = this.bars.map((bar, oldIndex) => ({
          oldIndex,
          bar: { ...bar, chords: bar.chords.slice() }
        }));
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        const nextInversions = {};
        const nextOctaves = {};
        reordered.forEach((entry, newIndex) => {
          entry.bar.chords.forEach((_chord, chordIndex) => {
            const oldKey = entry.oldIndex + ":" + chordIndex;
            if (this.inversions[oldKey] !== undefined) nextInversions[newIndex + ":" + chordIndex] = this.inversions[oldKey];
            if (this.octaves[oldKey] !== undefined) nextOctaves[newIndex + ":" + chordIndex] = this.octaves[oldKey];
          });
          const previous = reordered[newIndex - 1]?.bar;
          const stillRepeats = previous && entry.bar.chords.length === previous.chords.length && entry.bar.chords.every((chord, chordIndex) => chord === previous.chords[chordIndex]);
          if (entry.bar.repeated && !stillRepeats) entry.bar.repeated = false;
        });
        this.bars = reordered.map((entry) => entry.bar);
        this.inversions = nextInversions;
        this.octaves = nextOctaves;
        this.source = this.barsToSource(this.bars);
        if (!silent) this.showToast("Moved chord #" + (fromIndex + 1) + " to #" + (toIndex + 1));
      },
      onHandlePointerdown(event, index) {
        if (event.button !== undefined && event.button !== 0) return;
        if (dragState.active || dragState.pending) return;
        const card = event.currentTarget.closest(".bar-card");
        if (!card) return;
        dragState.pending = true;
        dragState.pointerId = event.pointerId;
        dragState.card = card;
        dragState.rect = card.getBoundingClientRect();
        dragState.startX = event.clientX;
        dragState.startY = event.clientY;
        dragState.lastX = event.clientX;
        dragState.lastY = event.clientY;
        dragState.currentIndex = index;
        dragState.onMove = (pointerEvent) => this.onDragPointermove(pointerEvent);
        dragState.onUp = (pointerEvent) => this.onDragPointerup(pointerEvent, false);
        dragState.onCancel = (pointerEvent) => this.onDragPointerup(pointerEvent, true);
        window.addEventListener("pointermove", dragState.onMove);
        window.addEventListener("pointerup", dragState.onUp);
        window.addEventListener("pointercancel", dragState.onCancel);
      },
      onDragPointermove(event) {
        if ((!dragState.pending && !dragState.active) || event.pointerId !== dragState.pointerId) return;
        dragState.lastX = event.clientX;
        dragState.lastY = event.clientY;
        if (dragState.pending) {
          const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
          if (distance < 5) return;
          this.beginDragGhost();
        }
        positionDragGhost();
        this.hitTestDragTarget();
      },
      beginDragGhost() {
        const ghost = dragState.card.cloneNode(true);
        ghost.classList.add("drag-ghost");
        ghost.classList.remove("dragging");
        ghost.style.left = dragState.rect.left + "px";
        ghost.style.top = dragState.rect.top + "px";
        ghost.style.width = dragState.rect.width + "px";
        ghost.style.height = dragState.rect.height + "px";
        document.body.appendChild(ghost);
        dragState.ghost = ghost;
        dragState.active = true;
        dragState.pending = false;
        this.draggedBarId = this.bars[dragState.currentIndex].id;
        document.body.classList.add("drag-in-progress");
        positionDragGhost();
        dragState.scrollRaf = requestAnimationFrame(() => dragScrollStep(this));
      },
      hitTestDragTarget() {
        if (!dragState.active || !this.$refs.barsGrid) return;
        const grid = this.$refs.barsGrid;
        const cards = Array.from(grid.children);
        if (!cards.length) return;
        const base = cards[0].offsetParent.getBoundingClientRect();
        const px = dragState.lastX - base.left;
        const py = dragState.lastY - base.top;
        let index = -1;
        for (let i = 0; i < cards.length; i += 1) {
          const card = cards[i];
          if (px >= card.offsetLeft && px < card.offsetLeft + card.offsetWidth && py >= card.offsetTop && py < card.offsetTop + card.offsetHeight) {
            index = i;
            break;
          }
        }
        if (index === -1 || index === dragState.currentIndex) return;
        const before = captureBarRects(grid);
        this.moveBar(dragState.currentIndex, index, true);
        dragState.currentIndex = index;
        this.$nextTick(() => playBarFlip(this.$refs.barsGrid, before));
      },
      onDragPointerup(event, cancelled) {
        if (event.pointerId !== undefined && event.pointerId !== dragState.pointerId) return;
        window.removeEventListener("pointermove", dragState.onMove);
        window.removeEventListener("pointerup", dragState.onUp);
        window.removeEventListener("pointercancel", dragState.onCancel);
        cancelAnimationFrame(dragState.scrollRaf);
        document.body.classList.remove("drag-in-progress");
        if (dragState.active) {
          const ghost = dragState.ghost;
          const placeholder = dragState.card;
          const dx = cancelled ? 0 : placeholder.getBoundingClientRect().left - dragState.rect.left;
          const dy = cancelled ? 0 : placeholder.getBoundingClientRect().top - dragState.rect.top;
          ghost.style.transition = "transform .18s ease, opacity .18s ease";
          ghost.style.transform = "translate(" + dx + "px, " + dy + "px) scale(1)";
          ghost.style.opacity = "0";
          setTimeout(() => {
            ghost.remove();
            placeholder.classList.remove("dragging");
          }, 190);
        }
        dragState.active = false;
        dragState.pending = false;
        dragState.ghost = null;
        dragState.card = null;
        dragState.pointerId = null;
        this.draggedBarId = null;
      },
      moveBarWithKey(index, direction) {
        const target = clamp(index + direction, 0, this.bars.length - 1);
        if (target === index || !this.$refs.barsGrid) return;
        const before = captureBarRects(this.$refs.barsGrid);
        this.moveBar(index, target);
        this.$nextTick(() => playBarFlip(this.$refs.barsGrid, before));
      },
      appendChord(symbol) {
        const trimmed = this.source.trimEnd();
        const addition = trimmed
          ? trimmed.endsWith("|") ? " " + symbol + " |" : " | " + symbol + " |"
          : "| " + symbol + " |";
        this.source = trimmed + addition;
        this.chordSearch = "";
        this.suggestionsOpen = false;
        this.buildSheet(false);
        this.showToast(symbol + " added");
      },
      openSuggestions() { this.suggestionsOpen = true; },
      closeSuggestions() { window.setTimeout(() => { this.suggestionsOpen = false; }, 80); },
      onSearchInput() { this.suggestionIndex = 0; this.suggestionsOpen = true; },
      onSearchKeydown(event) {
        const last = Math.max(0, this.matchingSuggestions.length - 1);
        if (event.key === "ArrowDown") { event.preventDefault(); this.suggestionIndex = clamp(this.suggestionIndex + 1, 0, last); }
        if (event.key === "ArrowUp") { event.preventDefault(); this.suggestionIndex = clamp(this.suggestionIndex - 1, 0, last); }
        if (event.key === "Enter" && this.matchingSuggestions.length) { event.preventDefault(); this.appendChord(this.matchingSuggestions[this.suggestionIndex]); }
        if (event.key === "Escape") this.suggestionsOpen = false;
      },
      newChart() {
        this.saveCurrentSheet();
        this.currentSheetId = sheetId();
        this.title = "Untitled chart";
        this.source = "| C | Am | F | G |";
        this.inversions = {};
        this.octaves = {};
        this.buildSheet(false);
        this.saveCurrentSheet();
        this.showToast("New chart ready");
      },
      showToast(message) {
        this.toastMessage = message;
        this.toastVisible = true;
        clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => { this.toastVisible = false; }, 1800);
      },
      setBpm(value) { this.bpm = clamp(Math.round(Number(value) || 92), 35, 240); },
      tapTempo() {
        const now = performance.now();
        this.tapTimes = this.tapTimes.filter((time) => now - time < 2500).concat(now).slice(-5);
        if (this.tapTimes.length < 2) return;
        const intervals = this.tapTimes.slice(1).map((time, index) => time - this.tapTimes[index]);
        this.setBpm(60000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length));
      },
      playBeat(time, beat) {
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        oscillator.type = this.sound === "digital" ? "square" : this.sound === "soft" ? "sine" : "triangle";
        oscillator.frequency.value = beat === 0 ? this.sound === "wood" ? 1240 : 980 : this.sound === "wood" ? 830 : 660;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(this.sound === "soft" ? 0.11 : 0.22, time + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + (this.sound === "soft" ? 0.09 : 0.045));
        oscillator.connect(gain);
        gain.connect(this.audioContext.destination);
        oscillator.start(time);
        oscillator.stop(time + 0.11);
        window.setTimeout(() => { this.currentBeat = beat; }, Math.max(0, (time - this.audioContext.currentTime) * 1000));
      },
      preloadInstrument(id) {
        if (this.instrumentSampleData.has(id)) return this.instrumentSampleData.get(id);
        const instrument = INSTRUMENTS[id];
        const promise = instrument && instrument.type === "sample-zones"
          ? Promise.all(instrument.zones.map(async (zone) => {
              const response = await fetch(zone.url);
              if (!response.ok) throw new Error("Could not load instrument sample " + zone.url);
              return { midi: zone.midi, data: await response.arrayBuffer() };
            })).catch(() => [])
          : Promise.resolve([]);
        this.instrumentSampleData.set(id, promise);
        return promise;
      },
      loadInstrumentBuffers(id) {
        if (this.instrumentBuffers.has(id)) return this.instrumentBuffers.get(id);
        const promise = this.preloadInstrument(id).then((zones) => Promise.all(zones.map(async (zone) => ({
          midi: zone.midi,
          buffer: await this.audioContext.decodeAudioData(zone.data.slice(0))
        }))));
        this.instrumentBuffers.set(id, promise);
        return promise;
      },
      async startChordNotes(payload) {
        const { id, notes } = payload;
        this.heldChordIds.add(id);
        this.releaseChord(id, 0.025);
        const requestToken = Symbol(id);
        this.chordRequestTokens.set(id, requestToken);
        this.audioContext = this.audioContext || new AudioContext();
        await this.audioContext.resume();
        try {
          const samples = await this.loadInstrumentBuffers(this.instrument);
          if (!samples.length) throw new Error("No piano samples loaded");
          if (this.chordRequestTokens.get(id) !== requestToken) return;
          if (!this.heldChordIds.has(id) && !this.sustain) return;
          const now = this.audioContext.currentTime;
          const master = this.audioContext.createGain();
          master.gain.setValueAtTime(1 / Math.max(3, notes.length), now);
          master.connect(this.audioContext.destination);
          const voice = { master, sources: [], remaining: notes.length };
          this.activeChordVoices.set(id, voice);
          notes.forEach((midi, index) => {
            const sample = samples.reduce((nearest, candidate) => Math.abs(candidate.midi - midi) < Math.abs(nearest.midi - midi) ? candidate : nearest, samples[0]);
            const source = this.audioContext.createBufferSource();
            source.buffer = sample.buffer;
            source.playbackRate.value = Math.pow(2, (midi - sample.midi) / 12);
            source.connect(master);
            source.onended = () => {
              voice.remaining -= 1;
              if (voice.remaining <= 0 && this.activeChordVoices.get(id) === voice) {
                this.activeChordVoices.delete(id);
                master.disconnect();
              }
            };
            voice.sources.push(source);
            source.start(now + index * 0.008);
          });
        } catch (_error) {
          this.showToast("Instrument samples unavailable");
        }
      },
      stopChordNotes(id) {
        this.heldChordIds.delete(id);
        if (!this.sustain) this.releaseChord(id, DAMPER_RELEASE_SECONDS);
      },
      releaseChord(id, releaseSeconds = 0.11) {
        if (!this.audioContext || !this.activeChordVoices) return;
        const voice = this.activeChordVoices.get(id);
        if (!voice) return;
        this.activeChordVoices.delete(id);
        const now = this.audioContext.currentTime;
        voice.master.gain.cancelScheduledValues(now);
        voice.master.gain.setValueAtTime(Math.max(0.0001, voice.master.gain.value), now);
        voice.master.gain.exponentialRampToValueAtTime(0.0001, now + releaseSeconds);
        voice.sources.forEach((source) => {
          try { source.stop(now + releaseSeconds + 0.02); } catch (_error) { /* The sample already ended. */ }
        });
      },
      scheduleMetronome() {
        while (this.nextNoteTime < this.audioContext.currentTime + 0.1) {
          this.playBeat(this.nextNoteTime, this.scheduledBeat);
          this.nextNoteTime += 60 / this.bpm;
          this.scheduledBeat = (this.scheduledBeat + 1) % 4;
        }
      },
      async toggleMetronome() {
        if (this.playing) {
          this.playing = false;
          clearInterval(this.schedulerTimer);
          this.schedulerTimer = null;
          this.currentBeat = -1;
          return;
        }
        this.audioContext = this.audioContext || new AudioContext();
        await this.audioContext.resume();
        this.playing = true;
        this.scheduledBeat = 0;
        this.nextNoteTime = this.audioContext.currentTime + 0.05;
        this.schedulerTimer = window.setInterval(() => this.scheduleMetronome(), 25);
      }
    }
  });

  app.mount("#app");
})();
