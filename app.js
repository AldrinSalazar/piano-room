(function () {
  "use strict";

  const STORAGE_KEY = "piano-room-state-v1";
  const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const NOTE_TO_PC = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
  const FORMULAS = [
    { suffix: "maj9", intervals: [0, 4, 7, 11, 14] },
    { suffix: "m(maj7)", intervals: [0, 3, 7, 11] },
    { suffix: "m7b5", intervals: [0, 3, 6, 10] },
    { suffix: "dim7", intervals: [0, 3, 6, 9] },
    { suffix: "7sus4", intervals: [0, 5, 7, 10] },
    { suffix: "7sus2", intervals: [0, 2, 7, 10] },
    { suffix: "add9", intervals: [0, 4, 7, 14] },
    { suffix: "madd9", intervals: [0, 3, 7, 14] },
    { suffix: "maj7", intervals: [0, 4, 7, 11] },
    { suffix: "sus4", intervals: [0, 5, 7] },
    { suffix: "sus2", intervals: [0, 2, 7] },
    { suffix: "dim", intervals: [0, 3, 6] },
    { suffix: "aug", intervals: [0, 4, 8] },
    { suffix: "m9", intervals: [0, 3, 7, 10, 14] },
    { suffix: "m7", intervals: [0, 3, 7, 10] },
    { suffix: "9", intervals: [0, 4, 7, 10, 14] },
    { suffix: "7", intervals: [0, 4, 7, 10] },
    { suffix: "6", intervals: [0, 4, 7, 9] },
    { suffix: "m6", intervals: [0, 3, 7, 9] },
    { suffix: "5", intervals: [0, 7] },
    { suffix: "m", intervals: [0, 3, 7] },
    { suffix: "", intervals: [0, 4, 7] }
  ];
  const QUALITY_SUFFIXES = ["", "m", "7", "maj7", "m7", "add9", "madd9", "sus4", "7sus4", "sus2", "6", "m6", "9", "maj9", "dim", "dim7", "m7b5", "aug"];
  const ROOTS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
  const CHORD_OPTIONS = ROOTS.flatMap((root) => QUALITY_SUFFIXES.map((quality) => root + quality));
  const DEFAULT_SHEET = "| Em(add9) | Cmaj7    | G/B      | A7sus4  A7 |\n| Em(add9) | Cmaj7/E  | Gmaj7/D  | B7sus4 B7  |";

  const ui = {
    titleInput: document.querySelector("#song-title"),
    sheetInput: document.querySelector("#sheet-input"),
    parseButton: document.querySelector("#parse-button"),
    sheetTitle: document.querySelector("#sheet-title"),
    barsGrid: document.querySelector("#bars-grid"),
    barsButtons: Array.from(document.querySelectorAll("[data-bars]")),
    chordSearch: document.querySelector("#chord-search"),
    suggestions: document.querySelector("#suggestions"),
    transposeLabel: document.querySelector("#transpose-value"),
    transposeDown: document.querySelector("#transpose-down"),
    transposeUp: document.querySelector("#transpose-up"),
    bpmInput: document.querySelector("#bpm-input"),
    bpmSlider: document.querySelector("#bpm-slider"),
    metroStart: document.querySelector("#metro-start"),
    metroSound: document.querySelector("#metro-sound"),
    beats: Array.from(document.querySelectorAll(".beat")),
    tapButton: document.querySelector("#tap-button"),
    toast: document.querySelector("#toast"),
    newButton: document.querySelector("#new-button")
  };

  const saved = readSavedState();
  const state = {
    title: saved.title || "Midnight Progression",
    source: saved.source || DEFAULT_SHEET,
    bars: [],
    barsPerRow: saved.barsPerRow || 4,
    transpose: saved.transpose || 0,
    voicings: saved.voicings || {},
    bpm: saved.bpm || 92,
    sound: saved.sound || "wood",
    playing: false,
    suggestionIndex: 0,
    tapTimes: []
  };

  function readSavedState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      title: state.title,
      source: state.source,
      barsPerRow: state.barsPerRow,
      transpose: state.transpose,
      voicings: state.voicings,
      bpm: state.bpm,
      sound: state.sound
    }));
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function mod(value, divisor) { return ((value % divisor) + divisor) % divisor; }

  function normalizeChordToken(token) {
    return token.trim().replace(/[(),]/g, (character) => character === "(" || character === ")" ? character : "");
  }

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
          bars.push({ chords: previous ? previous.chords.slice() : [], repeated: true });
          continue;
        }
        const chords = chunk.split(/\s+/).map(normalizeChordToken).filter(Boolean);
        if (chords.length) bars.push({ chords, repeated: false });
      }
    }
    return bars;
  }

  function parseChord(symbol) {
    const match = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/.exec(symbol);
    if (!match) return null;
    const rootText = match[1] + match[2];
    const rawQuality = match[3].replace(/[()]/g, "");
    const quality = rawQuality === "min" ? "m" : rawQuality === "major7" ? "maj7" : rawQuality;
    const formula = FORMULAS.find((item) => item.suffix === quality);
    if (!formula || NOTE_TO_PC[rootText] === undefined) return null;
    const bassText = match[4] ? match[4] + match[5] : null;
    if (bassText && NOTE_TO_PC[bassText] === undefined) return null;
    return { rootText, rootPc: NOTE_TO_PC[rootText], quality, intervals: formula.intervals, bassText, bassPc: bassText ? NOTE_TO_PC[bassText] : null };
  }

  function transposeSymbol(symbol, amount) {
    const chord = parseChord(symbol);
    if (!chord || amount === 0) return symbol;
    const root = NOTE_NAMES[mod(chord.rootPc + amount, 12)];
    const bass = chord.bassPc === null ? "" : "/" + NOTE_NAMES[mod(chord.bassPc + amount, 12)];
    let shownQuality = chord.quality;
    if (symbol.includes("(") && chord.quality === "add9") shownQuality = "(add9)";
    if (symbol.includes("(") && chord.quality === "madd9") shownQuality = "m(add9)";
    return root + shownQuality + bass;
  }

  function voicingFor(symbol, octaveShift, semitoneShift) {
    const chord = parseChord(symbol);
    if (!chord) return null;
    const rootPc = mod(chord.rootPc + semitoneShift, 12);
    let rootMidi = 48 + rootPc + (octaveShift * 12);
    if (rootPc >= 9) rootMidi -= 12;
    let notes = chord.intervals.map((interval) => rootMidi + interval);
    if (chord.bassPc !== null) {
      const bassPc = mod(chord.bassPc + semitoneShift, 12);
      let bassMidi = rootMidi - mod(rootPc - bassPc, 12);
      if (bassMidi >= notes[0]) bassMidi -= 12;
      notes = [bassMidi].concat(notes);
    }
    return Array.from(new Set(notes)).sort((a, b) => a - b);
  }

  function midiName(midi) {
    return NOTE_NAMES[mod(midi, 12)] + (Math.floor(midi / 12) - 1);
  }

  function icon(path, className) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", className || "icon");
    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("d", path);
    svg.append(pathElement);
    return svg;
  }

  function pianoElement(notes) {
    const wrap = document.createElement("div");
    wrap.className = "piano-wrap";
    const piano = document.createElement("div");
    piano.className = "piano";
    piano.setAttribute("aria-label", "Piano keys: " + notes.map(midiName).join(", "));

    const lowest = Math.min(...notes);
    const highest = Math.max(...notes);
    // Prefer a familiar C-to-C diagram. A slash bass can straddle that
    // boundary, so fall back to the lowest played white key when needed. This
    // keeps every note visible and moves the voicing toward the left edge.
    const preferredC = Math.floor(lowest / 12) * 12;
    let startMidi = preferredC;
    if (highest > preferredC + 24) {
      startMidi = lowest;
      while ([1, 3, 6, 8, 10].includes(mod(startMidi, 12))) startMidi -= 1;
    }
    const endMidi = Math.max(startMidi + 24, highest);
    const active = new Set(notes);
    const whiteMidis = [];
    for (let midi = startMidi; midi <= endMidi; midi += 1) {
      if (![1, 3, 6, 8, 10].includes(mod(midi, 12))) whiteMidis.push(midi);
    }
    whiteMidis.forEach((midi) => {
      const key = document.createElement("div");
      key.className = "white-key" + (active.has(midi) ? " active" : "");
      key.dataset.midi = String(midi);
      piano.append(key);
    });

    const whiteIndexByMidi = new Map(whiteMidis.map((midi, index) => [midi, index]));
    for (let midi = startMidi; midi < endMidi; midi += 1) {
      if (![1, 3, 6, 8, 10].includes(mod(midi, 12))) continue;
      let previousWhite = midi - 1;
      while (!whiteIndexByMidi.has(previousWhite)) previousWhite -= 1;
      const index = whiteIndexByMidi.get(previousWhite);
      const key = document.createElement("div");
      key.className = "black-key" + (active.has(midi) ? " active" : "");
      key.dataset.midi = String(midi);
      key.style.left = ((index + 1) / whiteMidis.length * 100) + "%";
      key.style.width = ((100 / whiteMidis.length) * 0.62) + "%";
      piano.append(key);
    }
    wrap.append(piano);
    const range = document.createElement("div");
    range.className = "piano-range";
    range.textContent = midiName(startMidi) + " to " + midiName(endMidi);
    wrap.append(range);
    return wrap;
  }

  function chordElement(symbol, id) {
    const view = document.createElement("section");
    view.className = "chord-view";
    const chord = parseChord(symbol);
    const shift = clamp(Number(state.voicings[id] || 0), -2, 2);
    const transposed = transposeSymbol(symbol, state.transpose);
    const heading = document.createElement("div");
    heading.className = "chord-heading";
    const name = document.createElement("h3");
    name.className = "chord-name";
    name.textContent = transposed;
    heading.append(name);

    const stepper = document.createElement("div");
    stepper.className = "stepper";
    stepper.setAttribute("aria-label", "Octave for " + transposed);
    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "−";
    down.setAttribute("aria-label", "Move " + transposed + " down one octave");
    down.disabled = shift <= -2;
    down.addEventListener("click", () => setVoicing(id, shift - 1));
    const value = document.createElement("span");
    value.className = "stepper-value";
    value.textContent = shift === 0 ? "ROOT" : (shift > 0 ? "+" + shift : String(shift)) + " OCT";
    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "+";
    up.setAttribute("aria-label", "Move " + transposed + " up one octave");
    up.disabled = shift >= 2;
    up.addEventListener("click", () => setVoicing(id, shift + 1));
    stepper.append(down, value, up);
    heading.append(stepper);
    view.append(heading);

    if (!chord) {
      const invalid = document.createElement("div");
      invalid.className = "invalid-chord";
      invalid.textContent = "This chord is not in the library yet";
      view.append(invalid);
      return view;
    }
    const notes = voicingFor(symbol, shift, state.transpose);
    const noteLine = document.createElement("p");
    noteLine.className = "notes";
    noteLine.textContent = notes.map(midiName).join(" · ");
    view.append(noteLine, pianoElement(notes));
    return view;
  }

  function setVoicing(id, value) {
    state.voicings[id] = clamp(value, -2, 2);
    saveState();
    renderBars();
  }

  function renderBars() {
    ui.barsGrid.replaceChildren();
    ui.barsGrid.style.setProperty("--bars-per-row", String(state.barsPerRow));
    if (!state.bars.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Paste a chord sheet, then choose Build sheet.";
      ui.barsGrid.append(empty);
      return;
    }
    state.bars.forEach((bar, barIndex) => {
      const card = document.createElement("article");
      card.className = "bar-card";
      const number = document.createElement("span");
      number.className = "bar-number";
      number.textContent = "Bar " + String(barIndex + 1).padStart(2, "0");
      card.append(number);
      if (bar.repeated) {
        const repeat = document.createElement("span");
        repeat.className = "repeat-chip";
        repeat.textContent = "% repeat";
        card.append(repeat);
      }
      const chords = document.createElement("div");
      chords.className = "chords-in-bar" + (bar.chords.length > 1 ? " multiple" : "");
      bar.chords.forEach((symbol, chordIndex) => chords.append(chordElement(symbol, barIndex + ":" + chordIndex)));
      card.append(chords);
      ui.barsGrid.append(card);
    });
  }

  function renderAll() {
    ui.titleInput.value = state.title;
    ui.sheetInput.value = state.source;
    ui.sheetTitle.textContent = state.title || "Untitled chart";
    ui.transposeLabel.textContent = state.transpose === 0 ? "Concert key" : (state.transpose > 0 ? "+" : "") + state.transpose + " semitones";
    ui.barsButtons.forEach((button) => button.classList.toggle("active", Number(button.dataset.bars) === state.barsPerRow));
    ui.bpmInput.value = String(state.bpm);
    ui.bpmSlider.value = String(state.bpm);
    ui.metroSound.value = state.sound;
    renderBars();
  }

  function buildSheet(showMessage) {
    state.title = ui.titleInput.value.trim() || "Untitled chart";
    state.source = ui.sheetInput.value;
    state.bars = parseSheet(state.source);
    saveState();
    renderAll();
    if (showMessage) toast("Chart rebuilt");
  }

  function appendChord(symbol) {
    const trimmed = ui.sheetInput.value.trimEnd();
    const addition = trimmed ? (trimmed.endsWith("|") ? " " + symbol + " |" : " | " + symbol + " |") : "| " + symbol + " |";
    ui.sheetInput.value = trimmed + addition;
    ui.chordSearch.value = "";
    closeSuggestions();
    buildSheet(false);
    toast(symbol + " added");
  }

  function matchingSuggestions(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return CHORD_OPTIONS.slice(0, 8);
    return CHORD_OPTIONS.filter((chord) => chord.toLowerCase().includes(normalized)).slice(0, 9);
  }

  function renderSuggestions() {
    const matches = matchingSuggestions(ui.chordSearch.value);
    state.suggestionIndex = clamp(state.suggestionIndex, 0, Math.max(0, matches.length - 1));
    ui.suggestions.replaceChildren();
    matches.forEach((chord, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion" + (index === state.suggestionIndex ? " active" : "");
      button.textContent = chord;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => appendChord(chord));
      ui.suggestions.append(button);
    });
    ui.suggestions.classList.toggle("open", matches.length > 0);
  }

  function closeSuggestions() { ui.suggestions.classList.remove("open"); }
  let toastTimer = null;
  function toast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 1800);
  }

  let audioContext = null;
  let schedulerTimer = null;
  let nextNoteTime = 0;
  let currentBeat = 0;

  function soundBeat(time, beat) {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const preset = state.sound;
    oscillator.type = preset === "digital" ? "square" : preset === "soft" ? "sine" : "triangle";
    oscillator.frequency.value = beat === 0 ? (preset === "wood" ? 1240 : 980) : (preset === "wood" ? 830 : 660);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(preset === "soft" ? 0.11 : 0.22, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (preset === "soft" ? 0.09 : 0.045));
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.11);
    const delay = Math.max(0, (time - audioContext.currentTime) * 1000);
    setTimeout(() => {
      ui.beats.forEach((dot, index) => dot.classList.toggle("active", index === beat));
    }, delay);
  }

  function schedule() {
    if (!audioContext) return;
    while (nextNoteTime < audioContext.currentTime + 0.1) {
      soundBeat(nextNoteTime, currentBeat);
      nextNoteTime += 60 / state.bpm;
      currentBeat = (currentBeat + 1) % 4;
    }
  }

  async function toggleMetronome() {
    if (state.playing) {
      state.playing = false;
      clearInterval(schedulerTimer);
      schedulerTimer = null;
      ui.metroStart.classList.remove("playing");
      ui.metroStart.setAttribute("aria-label", "Start metronome");
      ui.beats.forEach((dot) => dot.classList.remove("active"));
      return;
    }
    audioContext = audioContext || new AudioContext();
    await audioContext.resume();
    state.playing = true;
    currentBeat = 0;
    nextNoteTime = audioContext.currentTime + 0.05;
    schedulerTimer = setInterval(schedule, 25);
    ui.metroStart.classList.add("playing");
    ui.metroStart.setAttribute("aria-label", "Stop metronome");
  }

  function setBpm(raw) {
    state.bpm = clamp(Math.round(Number(raw) || 92), 35, 240);
    ui.bpmInput.value = String(state.bpm);
    ui.bpmSlider.value = String(state.bpm);
    saveState();
  }

  ui.parseButton.addEventListener("click", () => buildSheet(true));
  ui.titleInput.addEventListener("input", () => {
    state.title = ui.titleInput.value;
    ui.sheetTitle.textContent = state.title || "Untitled chart";
    saveState();
  });
  ui.barsButtons.forEach((button) => button.addEventListener("click", () => {
    state.barsPerRow = Number(button.dataset.bars);
    saveState();
    renderAll();
  }));
  ui.transposeDown.addEventListener("click", () => {
    state.transpose = clamp(state.transpose - 1, -11, 11);
    saveState();
    renderAll();
  });
  ui.transposeUp.addEventListener("click", () => {
    state.transpose = clamp(state.transpose + 1, -11, 11);
    saveState();
    renderAll();
  });
  ui.chordSearch.addEventListener("focus", renderSuggestions);
  ui.chordSearch.addEventListener("input", () => { state.suggestionIndex = 0; renderSuggestions(); });
  ui.chordSearch.addEventListener("blur", () => setTimeout(closeSuggestions, 80));
  ui.chordSearch.addEventListener("keydown", (event) => {
    const matches = matchingSuggestions(ui.chordSearch.value);
    if (event.key === "ArrowDown") { event.preventDefault(); state.suggestionIndex = clamp(state.suggestionIndex + 1, 0, matches.length - 1); renderSuggestions(); }
    if (event.key === "ArrowUp") { event.preventDefault(); state.suggestionIndex = clamp(state.suggestionIndex - 1, 0, matches.length - 1); renderSuggestions(); }
    if (event.key === "Enter" && matches.length) { event.preventDefault(); appendChord(matches[state.suggestionIndex]); }
    if (event.key === "Escape") closeSuggestions();
  });
  ui.metroStart.addEventListener("click", toggleMetronome);
  ui.bpmInput.addEventListener("change", () => setBpm(ui.bpmInput.value));
  ui.bpmSlider.addEventListener("input", () => setBpm(ui.bpmSlider.value));
  ui.metroSound.addEventListener("change", () => { state.sound = ui.metroSound.value; saveState(); });
  ui.tapButton.addEventListener("click", () => {
    const now = performance.now();
    state.tapTimes = state.tapTimes.filter((time) => now - time < 2500).concat(now).slice(-5);
    if (state.tapTimes.length >= 2) {
      const intervals = state.tapTimes.slice(1).map((time, index) => time - state.tapTimes[index]);
      setBpm(60000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length));
    }
  });
  ui.newButton.addEventListener("click", () => {
    state.title = "Untitled chart";
    state.source = "| C | Am | F | G |";
    state.transpose = 0;
    state.voicings = {};
    buildSheet(false);
    toast("New chart ready");
  });

  state.bars = parseSheet(state.source);
  renderAll();
})();
