export const WHITE_KEYS = [
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

export const BLACK_KEYS = [
  { code: "KeyW", label: "W", semitone: 1, afterWhite: 0, note: "C#" },
  { code: "KeyE", label: "E", semitone: 3, afterWhite: 1, note: "D#" },
  { code: "KeyT", label: "T", semitone: 6, afterWhite: 3, note: "F#" },
  { code: "KeyY", label: "Y", semitone: 8, afterWhite: 4, note: "G#" },
  { code: "KeyU", label: "U", semitone: 10, afterWhite: 5, note: "A#" },
  { code: "KeyO", label: "O", semitone: 13, afterWhite: 7, note: "C#" },
  { code: "KeyP", label: "P", semitone: 15, afterWhite: 8, note: "D#" },
];

export const SONG_MANIFEST_PATH = "./songs/index.json";

export const KEY_CONFIG_BY_CODE = new Map([...WHITE_KEYS, ...BLACK_KEYS].map((key) => [key.code, key]));

export const DISPLAY_TO_SOUND_OCTAVE_OFFSET = 3;
export const MIN_MIDI = 21;
export const MAX_MIDI = 108;
