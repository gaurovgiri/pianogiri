import { DISPLAY_TO_SOUND_OCTAVE_OFFSET, MIN_MIDI, MAX_MIDI } from "./config.js";
import { clamp } from "./utils.js";

export function createAudioEngine({ keyConfigByCode, onKeyVisualChange }) {
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

  function getConfigByCode(code) {
    return keyConfigByCode.get(code);
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

  function releaseVoice(noteName) {
    if (!noteName || !pianoSampler) {
      return;
    }

    pianoSampler.triggerRelease(noteName);
  }

  function noteOn(code) {
    const config = getConfigByCode(code);
    if (!config || ACTIVE_KEYS.has(code) || !toneReady || !pianoSampler) {
      return;
    }

    ACTIVE_KEYS.add(code);
    sustainedCodes.delete(code);
    onKeyVisualChange(code, true);

    const midi = getMidiForKey(config);
    const noteName = midiToNoteName(midi);
    const existingNote = voicesByCode.get(code);

    if (existingNote) {
      pianoSampler.triggerRelease(existingNote);
    }

    pianoSampler.triggerAttack(noteName, undefined, velocityToGain(velocity));
    voicesByCode.set(code, noteName);
  }

  function noteOff(code) {
    if (!ACTIVE_KEYS.has(code)) {
      return;
    }

    ACTIVE_KEYS.delete(code);
    onKeyVisualChange(code, false);

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
      onKeyVisualChange(code, false);
    }

    ACTIVE_KEYS.clear();
    sustainedCodes.clear();
  }

  function changeOctave(delta) {
    baseOctave = clamp(baseOctave + delta, 1, 6);
  }

  function changeVelocity(delta) {
    velocity = clamp(velocity + delta, 20, 127);
  }

  function toggleSustain() {
    sustainOn = !sustainOn;
    if (!sustainOn) {
      releaseSustainedVoices();
    }
  }

  function getBaseOctave() {
    return baseOctave;
  }

  function getVelocity() {
    return velocity;
  }

  function isSustainOn() {
    return sustainOn;
  }

  return {
    initAudio,
    resumeAudioIfNeeded,
    noteOn,
    noteOff,
    panicAllNotes,
    changeOctave,
    changeVelocity,
    toggleSustain,
    getBaseOctave,
    getVelocity,
    isSustainOn,
  };
}
