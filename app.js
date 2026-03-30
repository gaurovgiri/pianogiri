const WHITE_KEYS = [
  { code: "KeyA", label: "A", semitone: 0 },
  { code: "KeyS", label: "S", semitone: 2 },
  { code: "KeyD", label: "D", semitone: 4 },
  { code: "KeyF", label: "F", semitone: 5 },
  { code: "KeyG", label: "G", semitone: 7 },
  { code: "KeyH", label: "H", semitone: 9 },
  { code: "KeyJ", label: "J", semitone: 11 },
  { code: "KeyK", label: "K", semitone: 12 },
  { code: "KeyL", label: "L", semitone: 14 },
  { code: "Semicolon", label: ";", semitone: 16 },
  { code: "Quote", label: "'", semitone: 17 },
];

const BLACK_KEYS = [
  { code: "KeyW", label: "W", semitone: 1, afterWhite: 0 },
  { code: "KeyE", label: "E", semitone: 3, afterWhite: 1 },
  { code: "KeyT", label: "T", semitone: 6, afterWhite: 3 },
  { code: "KeyY", label: "Y", semitone: 8, afterWhite: 4 },
  { code: "KeyU", label: "U", semitone: 10, afterWhite: 5 },
  { code: "KeyO", label: "O", semitone: 13, afterWhite: 7 },
  { code: "KeyP", label: "P", semitone: 15, afterWhite: 8 },
];

const KEY_CONFIG_BY_CODE = new Map([...WHITE_KEYS, ...BLACK_KEYS].map((k) => [k.code, k]));

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

const DISPLAY_TO_SOUND_OCTAVE_OFFSET = 3;
const MIN_MIDI = 21;
const MAX_MIDI = 108;

const keyElements = new Map();

const keybed = document.getElementById("keybed");
const sustainButton = document.getElementById("sustainButton");
const octaveLabel = document.getElementById("octaveLabel");
const velocityLabel = document.getElementById("velocityLabel");
const octaveDownButton = document.getElementById("octaveDown");
const octaveUpButton = document.getElementById("octaveUp");
const velocityDownButton = document.getElementById("velocityDown");
const velocityUpButton = document.getElementById("velocityUp");
const topAdStrip = document.getElementById("topAdStrip");
const bottomAdStrip = document.getElementById("bottomAdStrip");
const topAd = document.getElementById("topAd");
const bottomAd = document.getElementById("bottomAd");

const appConfig = {
  gaMeasurementId: (window.PIANOGIRI_CONFIG && window.PIANOGIRI_CONFIG.gaMeasurementId) || "",
  adsenseClient: (window.PIANOGIRI_CONFIG && window.PIANOGIRI_CONFIG.adsenseClient) || "",
  topAdSlot: (window.PIANOGIRI_CONFIG && window.PIANOGIRI_CONFIG.topAdSlot) || "",
  bottomAdSlot: (window.PIANOGIRI_CONFIG && window.PIANOGIRI_CONFIG.bottomAdSlot) || "",
};

let analyticsReady = false;
let hasSentPlayStart = false;
let hasSentFirstNote = false;
let hasSentSession30s = false;
let notePlayCount = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function loadExternalScript(src, { async = true } = {}) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = async;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function initAnalytics() {
  if (!appConfig.gaMeasurementId) {
    return;
  }

  try {
    await loadExternalScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(appConfig.gaMeasurementId)}`);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", appConfig.gaMeasurementId, { send_page_view: true });
    analyticsReady = true;
  } catch (_err) {
    analyticsReady = false;
  }
}

function trackEvent(name, params = {}) {
  if (!analyticsReady || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", name, {
    app_name: "PianoGiri",
    ...params,
  });
}

function ensureSessionTimers() {
  if (hasSentPlayStart) {
    return;
  }

  hasSentPlayStart = true;
  trackEvent("play_start", {
    start_octave: baseOctave,
    start_velocity: velocity,
  });

  window.setTimeout(() => {
    if (!hasSentSession30s) {
      hasSentSession30s = true;
      trackEvent("session_30s", { note_count: notePlayCount });
    }
  }, 30000);
}

async function initAdsense() {
  const hasClient = Boolean(appConfig.adsenseClient);
  const hasTopSlot = Boolean(appConfig.topAdSlot);
  const hasBottomSlot = Boolean(appConfig.bottomAdSlot);

  if (!hasClient || (!hasTopSlot && !hasBottomSlot)) {
    return;
  }

  if (hasTopSlot) {
    topAd.setAttribute("data-ad-client", appConfig.adsenseClient);
    topAd.setAttribute("data-ad-slot", appConfig.topAdSlot);
  }

  if (hasBottomSlot) {
    bottomAd.setAttribute("data-ad-client", appConfig.adsenseClient);
    bottomAd.setAttribute("data-ad-slot", appConfig.bottomAdSlot);
  }

  try {
    await loadExternalScript(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(appConfig.adsenseClient)}`,
      { async: true }
    );

    if (hasTopSlot) {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      topAdStrip.classList.add("active");
    }

    if (hasBottomSlot) {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      bottomAdStrip.classList.add("active");
    }
  } catch (_err) {
    if (hasTopSlot) {
      topAdStrip.classList.remove("active");
    }

    if (hasBottomSlot) {
      bottomAdStrip.classList.remove("active");
    }
  }
}

function updateLabels() {
  octaveLabel.textContent = noteNameForOctave(baseOctave);
  velocityLabel.textContent = String(velocity);
  sustainButton.setAttribute("aria-pressed", String(sustainOn));
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

function noteOn(code) {
  const config = getConfigByCode(code);
  if (!config || ACTIVE_KEYS.has(code) || !toneReady || !pianoSampler) {
    return;
  }

  ensureSessionTimers();

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

  notePlayCount += 1;

  if (!hasSentFirstNote) {
    hasSentFirstNote = true;
    trackEvent("first_note", {
      note: noteName,
      octave_display: baseOctave,
      velocity,
    });
  }

  if (notePlayCount % 24 === 0) {
    trackEvent("notes_progress", {
      note_count: notePlayCount,
      octave_display: baseOctave,
      velocity,
    });
  }
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
  trackEvent("octave_change", { octave_display: baseOctave });
}

function changeVelocity(delta) {
  velocity = clamp(velocity + delta, 20, 127);
  updateLabels();
  trackEvent("velocity_change", { velocity });
}

function toggleSustain() {
  sustainOn = !sustainOn;
  updateLabels();
  trackEvent("sustain_toggle", { sustain_on: sustainOn });

  if (!sustainOn) {
    releaseSustainedVoices();
  }
}

function keydownHandler(event) {
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
}

buildKeyboard();
bindUiControls();
updateLabels();
initAudio();
initAnalytics();
initAdsense();

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
