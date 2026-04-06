import { WHITE_KEYS, BLACK_KEYS, SONG_MANIFEST_PATH, KEY_CONFIG_BY_CODE } from "./js/config.js";
import { getDomElements } from "./js/dom.js";
import { isTypingTarget } from "./js/utils.js";
import { createSongService } from "./js/songService.js";
import { createLessonEngine } from "./js/lessonEngine.js";
import { createKeyboardView } from "./js/keyboardView.js";
import { createAudioEngine } from "./js/audioEngine.js";

const dom = getDomElements();

const songService = createSongService({ manifestPath: SONG_MANIFEST_PATH });
const lesson = createLessonEngine();

const keyboard = createKeyboardView({
  keybed: dom.keybed,
  whiteKeys: WHITE_KEYS,
  blackKeys: BLACK_KEYS,
  onPressStart: handlePointerNoteOn,
  onPressEnd: handlePointerNoteOff,
});

const audio = createAudioEngine({
  keyConfigByCode: KEY_CONFIG_BY_CODE,
  onKeyVisualChange: keyboard.setKeyVisual,
});

const songButtons = new Map();

function noteNameForOctave(octave) {
  return `C${octave}`;
}

function setFeedback(text, tone) {
  dom.feedbackMessage.textContent = text;
  dom.feedbackMessage.classList.remove("neutral", "correct", "wrong", "complete");
  dom.feedbackMessage.classList.add(tone);
}

function noteDisplayByCode(code) {
  const key = KEY_CONFIG_BY_CODE.get(code);
  if (!key) {
    return "-";
  }

  return `${key.note} (${key.label})`;
}

function updateLabels() {
  dom.octaveLabel.textContent = noteNameForOctave(audio.getBaseOctave());
  dom.velocityLabel.textContent = String(audio.getVelocity());
  dom.sustainButton.setAttribute("aria-pressed", String(audio.isSustainOn()));
}

function updateProgress() {
  const state = lesson.getState();
  if (!state.selectedSong) {
    dom.progressText.textContent = "0 / 0";
    dom.progressFill.style.width = "0%";
    return;
  }

  dom.progressText.textContent = `${state.currentStep} / ${state.totalSteps}`;
  dom.progressFill.style.width = `${(state.currentStep / state.totalSteps) * 100}%`;
}

function updateLessonUI() {
  const state = lesson.getState();

  dom.restartSongButton.disabled = !state.selectedSong;
  dom.clearSongButton.disabled = !state.selectedSong;

  if (!state.selectedSong) {
    dom.currentSongTitle.textContent = "Select a song to begin";
    dom.targetNote.textContent = "-";
    dom.hintText.textContent = "Choose a song to see guided notes.";
    setFeedback("Play the highlighted note to continue.", "neutral");
    keyboard.clearExpectedHighlight();
    updateProgress();
    return;
  }

  dom.currentSongTitle.textContent = state.selectedSong.title;

  if (state.expectedCode) {
    dom.targetNote.textContent = noteDisplayByCode(state.expectedCode);
    dom.hintText.textContent = "Match this note on your keyboard or click the piano key.";
    keyboard.highlightExpected(state.expectedCode);
  } else {
    dom.targetNote.textContent = "Done";
    dom.hintText.textContent = "Great job. Restart or pick another song.";
    keyboard.clearExpectedHighlight();
    setFeedback("Song complete. Nice rhythm and focus.", "complete");
  }

  updateProgress();
}

function renderSongList() {
  const filteredSongs = songService.getFilteredSongs();
  const selectedSong = lesson.getState().selectedSong;

  songButtons.clear();
  dom.songList.innerHTML = "";

  if (filteredSongs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "song-empty";
    empty.textContent = "No songs found. Try another search.";
    dom.songList.appendChild(empty);
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

    if (selectedSong && selectedSong.id === song.id) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      toggleSongSelection(song.id);
    });

    songButtons.set(song.id, button);
    dom.songList.appendChild(button);
  });
}

function toggleSongSelection(songId) {
  const state = lesson.getState();

  if (state.selectedSong && state.selectedSong.id === songId) {
    deselectSong();
    return;
  }

  const song = songService.getSongById(songId);
  if (!song) {
    return;
  }

  lesson.selectSong(song);
  setFeedback("Song loaded. Hit the target note.", "neutral");
  renderSongList();
  updateLessonUI();
}

function deselectSong() {
  lesson.deselectSong();
  keyboard.clearExpectedHighlight();
  renderSongList();
  updateLessonUI();
  setFeedback("Free play mode. Piano guidance is paused.", "neutral");
}

function applySongSearch() {
  songService.applySearch(dom.songSearchInput.value);
  renderSongList();

  const selectedSong = lesson.getState().selectedSong;
  if (selectedSong && !songService.getFilteredSongs().some((song) => song.id === selectedSong.id)) {
    lesson.deselectSong();
    updateLessonUI();
    setFeedback("Selected song is hidden by search. Pick another result.", "neutral");
  }
}

function evaluateGuidedInput(code) {
  const result = lesson.evaluateInput(code);

  if (result.status === "idle") {
    return;
  }

  if (result.status === "complete") {
    keyboard.flashKey(code, "correct-flash");
    setFeedback("Perfect finish. You played every note in order.", "complete");
    updateLessonUI();
    return;
  }

  if (result.status === "correct") {
    keyboard.flashKey(code, "correct-flash");
    setFeedback(`Great. Next note is ${noteDisplayByCode(result.nextCode)}.`, "correct");
    updateLessonUI();
    return;
  }

  if (result.status === "wrong") {
    keyboard.flashKey(code, "wrong-flash");
    setFeedback(`Not this one. Try ${noteDisplayByCode(result.wantedCode)}.`, "wrong");
  }
}

function handlePointerNoteOn(code) {
  audio.resumeAudioIfNeeded().then(() => {
    audio.noteOn(code);
    evaluateGuidedInput(code);
  });
}

function handlePointerNoteOff(code) {
  audio.noteOff(code);
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
    audio.toggleSustain();
    updateLabels();
    return;
  }

  if (event.code === "KeyZ") {
    audio.changeOctave(-1);
    updateLabels();
    return;
  }

  if (event.code === "KeyX") {
    audio.changeOctave(1);
    updateLabels();
    return;
  }

  if (event.code === "KeyC") {
    audio.changeVelocity(-2);
    updateLabels();
    return;
  }

  if (event.code === "KeyV") {
    audio.changeVelocity(2);
    updateLabels();
    return;
  }

  if (!keyboard.hasCode(event.code)) {
    return;
  }

  audio.resumeAudioIfNeeded().then(() => {
    audio.noteOn(event.code);
    evaluateGuidedInput(event.code);
  });
}

function keyupHandler(event) {
  if (isTypingTarget(event.target)) {
    return;
  }

  if (!keyboard.hasCode(event.code)) {
    return;
  }

  audio.noteOff(event.code);
}

function bindUiControls() {
  dom.sustainButton.addEventListener("click", () => {
    audio.toggleSustain();
    updateLabels();
  });

  dom.octaveDownButton.addEventListener("click", () => {
    audio.changeOctave(-1);
    updateLabels();
  });

  dom.octaveUpButton.addEventListener("click", () => {
    audio.changeOctave(1);
    updateLabels();
  });

  dom.velocityDownButton.addEventListener("click", () => {
    audio.changeVelocity(-2);
    updateLabels();
  });

  dom.velocityUpButton.addEventListener("click", () => {
    audio.changeVelocity(2);
    updateLabels();
  });

  dom.restartSongButton.addEventListener("click", () => {
    lesson.restartSong();
    setFeedback("Restarted. Begin with the first note.", "neutral");
    updateLessonUI();
  });

  dom.clearSongButton.addEventListener("click", () => {
    deselectSong();
  });

  dom.songSearchButton.addEventListener("click", () => {
    applySongSearch();
  });

  dom.songSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applySongSearch();
    }
  });

  dom.songSearchInput.addEventListener("input", () => {
    if (dom.songSearchInput.value.trim() === "") {
      applySongSearch();
    }
  });
}

async function startApp() {
  keyboard.build();
  bindUiControls();
  updateLabels();
  updateLessonUI();
  audio.initAudio();

  try {
    await songService.loadSongs();
    renderSongList();
  } catch (_error) {
    songService.applySearch("__no_results__");
    renderSongList();
    setFeedback("Could not load songs. Please check song files.", "wrong");
  }
}

startApp();

window.addEventListener("keydown", keydownHandler, { passive: false });
window.addEventListener("keyup", keyupHandler);
window.addEventListener("blur", () => {
  audio.panicAllNotes();
});
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    audio.panicAllNotes();
  }
});
