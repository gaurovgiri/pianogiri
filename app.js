const WHITE_KEYS = [
  { code: "KeyA", label: "A", semitone: 0, note: "C" },
  { code: "KeyS", label: "S", semitone: 2, note: "D" },
  { code: "KeyD", label: "D", semitone: 4, note: "E" },
  { code: "KeyF", label: "F", semitone: 5, note: "F" },
  { code: "KeyG", label: "G", semitone: 7, note: "G" },
  { code: "KeyH", label: "H", semitone: 9, note: "A" },
  { code: "KeyJ", label: "J", semitone: 11, note: "B" },
  { code: "KeyK", label: "K", semitone: 12, note: "C" },
  { code: "KeyL", label: "L", semitone: 14, note: "D" },
  { code: "Semicolon", label: ";", semitone: 16, note: "E" },
  { code: "Quote", label: "'", semitone: 17, note: "F" },
];

const BLACK_KEYS = [
  { code: "KeyW", label: "W", semitone: 1, afterWhite: 0, note: "C#" },
  { code: "KeyE", label: "E", semitone: 3, afterWhite: 1, note: "D#" },
  { code: "KeyT", label: "T", semitone: 6, afterWhite: 3, note: "F#" },
  { code: "KeyY", label: "Y", semitone: 8, afterWhite: 4, note: "G#" },
  { code: "KeyU", label: "U", semitone: 10, afterWhite: 5, note: "A#" },
  { code: "KeyO", label: "O", semitone: 13, afterWhite: 7, note: "C#" },
  { code: "KeyP", label: "P", semitone: 15, afterWhite: 8, note: "D#" },
];

const SONG_MANIFEST_PATH = "./songs/index.json";

const KEY_CONFIG_BY_CODE = new Map([...WHITE_KEYS, ...BLACK_KEYS].map((key) => [key.code, key]));

const ACTIVE_KEYS = new Set();
const voicesByCode = new Map();
const sustainedCodes = new Set();

let initialized = false;
let toneReady = false;
let loadPromise = null;
let pianoSampler = null;

let baseOctave = 2;
let velocity = 98;
let sustainOn = false;

let songs = [];
let filteredSongs = [];
let selectedSong = null;
let currentStep = 0;
let lastExpectedCode = null;

const DISPLAY_TO_SOUND_OCTAVE_OFFSET = 3;
const MIN_MIDI = 21;
const MAX_MIDI = 108;

const keyElements = new Map();
const songButtons = new Map();

const keybed = document.getElementById("keybed");
const sustainButton = document.getElementById("sustainButton");
const octaveLabel = document.getElementById("octaveLabel");
const velocityLabel = document.getElementById("velocityLabel");
const octaveDownButton = document.getElementById("octaveDown");
const octaveUpButton = document.getElementById("octaveUp");
const velocityDownButton = document.getElementById("velocityDown");
const velocityUpButton = document.getElementById("velocityUp");
const songList = document.getElementById("songList");
const songSearchInput = document.getElementById("songSearchInput");
const songSearchButton = document.getElementById("songSearchButton");
const clearSongButton = document.getElementById("clearSong");
const restartSongButton = document.getElementById("restartSong");
const currentSongTitle = document.getElementById("currentSongTitle");
const targetNote = document.getElementById("targetNote");
const hintText = document.getElementById("hintText");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const feedbackMessage = document.getElementById("feedbackMessage");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function noteNameForOctave(octave) {
  return `C${octave}`;
}

function midiToNoteName(midi) {
  return Tone.Frequency(midi, "midi").toNote();
}

function velocityToGain(velocityValue) {
  return clamp(Math.pow(velocityValue / 127, 1.5), 0.08, 1);
}

function getMidiForKey(config) {
  const displayedRootC = (baseOctave + 1) * 12;
  const calibratedRootC = displayedRootC + DISPLAY_TO_SOUND_OCTAVE_OFFSET * 12;
  return clamp(calibratedRootC + config.semitone, MIN_MIDI, MAX_MIDI);
}

function updateLabels() {
  octaveLabel.textContent = noteNameForOctave(baseOctave);
  velocityLabel.textContent = String(velocity);
  sustainButton.setAttribute("aria-pressed", String(sustainOn));
}

function flashKey(code, className) {
  const el = keyElements.get(code);
  if (!el) {
    return;
  }

  el.classList.remove(className);
  // Restarting animation allows each input to pulse even for repeated notes.
  void el.offsetWidth;
  el.classList.add(className);

  window.setTimeout(() => {
    el.classList.remove(className);
  }, 260);
}

function clearExpectedHighlight() {
  if (!lastExpectedCode) {
    return;
  }

  const previous = keyElements.get(lastExpectedCode);
  if (previous) {
    previous.classList.remove("expected");
  }

  lastExpectedCode = null;
}

function highlightExpected(code) {
  clearExpectedHighlight();
  if (!code) {
    return;
  }

  const el = keyElements.get(code);
  if (el) {
    el.classList.add("expected");
    lastExpectedCode = code;
  }
}

function setFeedback(text, tone) {
  feedbackMessage.textContent = text;
  feedbackMessage.classList.remove("neutral", "correct", "wrong", "complete");
  feedbackMessage.classList.add(tone);
}

function noteDisplayByCode(code) {
  const key = KEY_CONFIG_BY_CODE.get(code);
  if (!key) {
    return "-";
  }

  return `${key.note} (${key.label})`;
}

function expectedCode() {
  if (!selectedSong || currentStep >= selectedSong.sequence.length) {
    return null;
  }

  return selectedSong.sequence[currentStep];
}

function updateProgress() {
  if (!selectedSong) {
    progressText.textContent = "0 / 0";
    progressFill.style.width = "0%";
    return;
  }

  const total = selectedSong.sequence.length;
  progressText.textContent = `${currentStep} / ${total}`;
  progressFill.style.width = `${(currentStep / total) * 100}%`;
}

function updateLessonUI() {
  restartSongButton.disabled = !selectedSong;
  clearSongButton.disabled = !selectedSong;

  if (!selectedSong) {
    currentSongTitle.textContent = "Select a song to begin";
    targetNote.textContent = "-";
    hintText.textContent = "Choose a song to see guided notes.";
    setFeedback("Play the highlighted note to continue.", "neutral");
    clearExpectedHighlight();
    updateProgress();
    return;
  }

  currentSongTitle.textContent = selectedSong.title;

  const nextCode = expectedCode();
  if (nextCode) {
    targetNote.textContent = noteDisplayByCode(nextCode);
    hintText.textContent = "Match this note on your keyboard or click the piano key.";
    highlightExpected(nextCode);
  } else {
    targetNote.textContent = "Done";
    hintText.textContent = "Great job. Restart or pick another song.";
    clearExpectedHighlight();
    setFeedback("Song complete. Nice rhythm and focus.", "complete");
  }

  updateProgress();
}

function renderSongList() {
  songButtons.clear();
  songList.innerHTML = "";

  if (filteredSongs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "song-empty";
    empty.textContent = "No songs found. Try another search.";
    songList.appendChild(empty);
    return;
  }

  filteredSongs.forEach((song) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "song-item";
    button.setAttribute("role", "option");
    button.textContent = song.title;

    const detail = document.createElement("small");
    detail.textContent = `${song.difficulty} · ${song.sequence.length} notes`;
    button.appendChild(detail);

    button.addEventListener("click", () => {
      selectSong(song.id);
    });

    songButtons.set(song.id, button);
    songList.appendChild(button);
  });
}

function selectSong(songId) {
  if (selectedSong && selectedSong.id === songId) {
    deselectSong();
    return;
  }

  selectedSong = songs.find((song) => song.id === songId) || null;
  currentStep = 0;

  songButtons.forEach((button, id) => {
    button.classList.toggle("active", id === songId);
  });

  setFeedback("Song loaded. Hit the target note.", "neutral");
  updateLessonUI();
}

function deselectSong() {
  selectedSong = null;
  currentStep = 0;
  clearExpectedHighlight();

  songButtons.forEach((button) => {
    button.classList.remove("active");
  });

  updateLessonUI();
  setFeedback("Free play mode. Piano guidance is paused.", "neutral");
}

async function loadSongs() {
  const manifestResponse = await fetch(SONG_MANIFEST_PATH);
  if (!manifestResponse.ok) {
    throw new Error("Could not load song manifest.");
  }

  const filenames = await manifestResponse.json();
  if (!Array.isArray(filenames)) {
    throw new Error("Song manifest format is invalid.");
  }

  const loadedSongs = await Promise.all(
    filenames.map(async (filename) => {
      const songResponse = await fetch(`./songs/${filename}`);
      if (!songResponse.ok) {
        throw new Error(`Could not load song file: ${filename}`);
      }

      const song = await songResponse.json();
      if (!song || typeof song.id !== "string" || !Array.isArray(song.sequence)) {
        throw new Error(`Invalid song format: ${filename}`);
      }

      return song;
    })
  );

  songs = loadedSongs;
  filteredSongs = [...songs];
}

function applySongSearch() {
  const query = songSearchInput.value.trim().toLowerCase();
  filteredSongs = songs.filter((song) => song.title.toLowerCase().includes(query));
  renderSongList();

  if (selectedSong && !filteredSongs.some((song) => song.id === selectedSong.id)) {
    selectedSong = null;
    currentStep = 0;
    updateLessonUI();
    setFeedback("Selected song is hidden by search. Pick another result.", "neutral");
  }
}

function restartSong() {
  if (!selectedSong) {
    return;
  }

  currentStep = 0;
  setFeedback("Restarted. Begin with the first note.", "neutral");
  updateLessonUI();
}

function buildKeyboard() {
  const whiteRow = document.createElement("div");
  whiteRow.className = "white-row";

  WHITE_KEYS.forEach((key) => {
    const el = document.createElement("button");
    el.className = "key white";
    el.type = "button";
    el.textContent = key.label;
    el.dataset.code = key.code;
    el.dataset.role = "white";
    whiteRow.appendChild(el);
    keyElements.set(key.code, el);

    bindPointerEvents(el, key.code);
  });

  const blackRow = document.createElement("div");
  blackRow.className = "black-row";

  BLACK_KEYS.forEach((key) => {
    const el = document.createElement("button");
    el.className = "key black";
    el.type = "button";
    el.textContent = key.label;
    el.dataset.code = key.code;
    el.dataset.role = "black";

    const unit = 100 / WHITE_KEYS.length;
    const center = (key.afterWhite + 1) * unit;
    el.style.left = `calc(${center}% - (100% / ${WHITE_KEYS.length}) * 0.4)`;

    blackRow.appendChild(el);
    keyElements.set(key.code, el);

    bindPointerEvents(el, key.code);
  });

  keybed.appendChild(whiteRow);
  keybed.appendChild(blackRow);
}

function initAudio() {
  if (initialized) {
    return loadPromise;
  }

  if (typeof Tone === "undefined") {
    initialized = true;
    loadPromise = Promise.resolve();
    return loadPromise;
  }

  initialized = true;

  loadPromise = new Promise((resolve) => {
    Tone.Destination.volume.value = -3;
    Tone.context.lookAhead = 0;
    Tone.context.updateInterval = 0.01;

    const limiter = new Tone.Limiter(-1).toDestination();
    const compressor = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.003, release: 0.2 });
    const eq = new Tone.EQ3({ low: -1.8, mid: 0.9, high: 1.8 });
    const reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.012, wet: 0.2 });

    eq.connect(compressor);
    compressor.connect(reverb);
    reverb.connect(limiter);

    pianoSampler = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        A6: "A6.mp3",
        C7: "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        A7: "A7.mp3",
        C8: "C8.mp3",
      },
      release: 1.4,
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => {
        toneReady = true;
        resolve();
      },
      onerror: () => {
        resolve();
      },
    }).connect(eq);
  });

  return loadPromise;
}

async function resumeAudioIfNeeded() {
  if (typeof Tone === "undefined") {
    return;
  }

  await initAudio();
  if (Tone.context.state !== "running") {
    await Tone.start();
  }
}

function setKeyVisual(code, active) {
  const el = keyElements.get(code);
  if (!el) {
    return;
  }
  el.classList.toggle("active", active);
}

function getConfigByCode(code) {
  return KEY_CONFIG_BY_CODE.get(code);
}

function evaluateGuidedInput(code) {
  if (!selectedSong) {
    return;
  }

  const wantedCode = expectedCode();
  if (!wantedCode) {
    setFeedback("Song complete. Pick another song to continue learning.", "complete");
    return;
  }

  if (code === wantedCode) {
    currentStep += 1;
    flashKey(code, "correct-flash");

    if (currentStep >= selectedSong.sequence.length) {
      setFeedback("Perfect finish. You played every note in order.", "complete");
    } else {
      setFeedback(`Great. Next note is ${noteDisplayByCode(expectedCode())}.`, "correct");
    }

    updateLessonUI();
    return;
  }

  flashKey(code, "wrong-flash");
  setFeedback(`Not this one. Try ${noteDisplayByCode(wantedCode)}.`, "wrong");
}

function noteOn(code) {
  const config = getConfigByCode(code);
  if (!config || ACTIVE_KEYS.has(code) || !toneReady || !pianoSampler) {
    return;
  }

  ACTIVE_KEYS.add(code);
  sustainedCodes.delete(code);
  setKeyVisual(code, true);

  const midi = getMidiForKey(config);
  const noteName = midiToNoteName(midi);
  const existingNote = voicesByCode.get(code);

  if (existingNote) {
    pianoSampler.triggerRelease(existingNote);
  }

  pianoSampler.triggerAttack(noteName, undefined, velocityToGain(velocity));
  voicesByCode.set(code, noteName);

  evaluateGuidedInput(code);
}

function releaseVoice(noteName) {
  if (!noteName || !pianoSampler) {
    return;
  }

  pianoSampler.triggerRelease(noteName);
}

function noteOff(code) {
  if (!ACTIVE_KEYS.has(code)) {
    return;
  }

  ACTIVE_KEYS.delete(code);
  setKeyVisual(code, false);

  if (sustainOn) {
    sustainedCodes.add(code);
    return;
  }

  const noteName = voicesByCode.get(code);
  if (noteName) {
    releaseVoice(noteName);
    voicesByCode.delete(code);
  }
}

function releaseSustainedVoices() {
  for (const code of sustainedCodes) {
    const noteName = voicesByCode.get(code);
    if (noteName) {
      releaseVoice(noteName);
      voicesByCode.delete(code);
    }
  }
  sustainedCodes.clear();
}

function panicAllNotes() {
  if (pianoSampler) {
    pianoSampler.releaseAll();
  }

  for (const [code] of voicesByCode) {
    voicesByCode.delete(code);
    setKeyVisual(code, false);
  }

  ACTIVE_KEYS.clear();
  sustainedCodes.clear();
}

function changeOctave(delta) {
  baseOctave = clamp(baseOctave + delta, 1, 6);
  updateLabels();
}

function changeVelocity(delta) {
  velocity = clamp(velocity + delta, 20, 127);
  updateLabels();
}

function toggleSustain() {
  sustainOn = !sustainOn;
  updateLabels();

  if (!sustainOn) {
    releaseSustainedVoices();
  }
}

function keydownHandler(event) {
  if (isTypingTarget(event.target)) {
    return;
  }

  if (event.repeat) {
    return;
  }

  if (event.code === "Tab") {
    event.preventDefault();
    toggleSustain();
    return;
  }

  if (event.code === "KeyZ") {
    changeOctave(-1);
    return;
  }

  if (event.code === "KeyX") {
    changeOctave(1);
    return;
  }

  if (event.code === "KeyC") {
    changeVelocity(-2);
    return;
  }

  if (event.code === "KeyV") {
    changeVelocity(2);
    return;
  }

  if (!keyElements.has(event.code)) {
    return;
  }

  resumeAudioIfNeeded().then(() => {
    noteOn(event.code);
  });
}

function keyupHandler(event) {
  if (isTypingTarget(event.target)) {
    return;
  }

  if (!keyElements.has(event.code)) {
    return;
  }

  noteOff(event.code);
}

function bindPointerEvents(el, code) {
  el.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    resumeAudioIfNeeded().then(() => {
      noteOn(code);
    });
  });

  el.addEventListener("pointerup", () => {
    noteOff(code);
  });

  el.addEventListener("pointerleave", (event) => {
    if (event.buttons === 1) {
      noteOff(code);
    }
  });
}

function bindUiControls() {
  sustainButton.addEventListener("click", () => {
    toggleSustain();
  });

  octaveDownButton.addEventListener("click", () => {
    changeOctave(-1);
  });

  octaveUpButton.addEventListener("click", () => {
    changeOctave(1);
  });

  velocityDownButton.addEventListener("click", () => {
    changeVelocity(-2);
  });

  velocityUpButton.addEventListener("click", () => {
    changeVelocity(2);
  });

  restartSongButton.addEventListener("click", () => {
    restartSong();
  });

  clearSongButton.addEventListener("click", () => {
    deselectSong();
  });

  songSearchButton.addEventListener("click", () => {
    applySongSearch();
  });

  songSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applySongSearch();
    }
  });

  songSearchInput.addEventListener("input", () => {
    if (songSearchInput.value.trim() === "") {
      applySongSearch();
    }
  });
}

async function startApp() {
  buildKeyboard();
  bindUiControls();
  updateLabels();
  updateLessonUI();
  initAudio();

  try {
    await loadSongs();
    renderSongList();
  } catch (_error) {
    filteredSongs = [];
    renderSongList();
    setFeedback("Could not load songs. Please check song files.", "wrong");
  }
}

startApp();

window.addEventListener("keydown", keydownHandler, { passive: false });
window.addEventListener("keyup", keyupHandler);
window.addEventListener("blur", () => {
  panicAllNotes();
});
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    panicAllNotes();
  }
});
