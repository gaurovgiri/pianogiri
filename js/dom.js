export function getDomElements() {
  return {
    keybed: document.getElementById("keybed"),
    sustainButton: document.getElementById("sustainButton"),
    octaveLabel: document.getElementById("octaveLabel"),
    velocityLabel: document.getElementById("velocityLabel"),
    octaveDownButton: document.getElementById("octaveDown"),
    octaveUpButton: document.getElementById("octaveUp"),
    velocityDownButton: document.getElementById("velocityDown"),
    velocityUpButton: document.getElementById("velocityUp"),
    songList: document.getElementById("songList"),
    songSearchInput: document.getElementById("songSearchInput"),
    songSearchButton: document.getElementById("songSearchButton"),
    clearSongButton: document.getElementById("clearSong"),
    restartSongButton: document.getElementById("restartSong"),
    currentSongTitle: document.getElementById("currentSongTitle"),
    targetNote: document.getElementById("targetNote"),
    hintText: document.getElementById("hintText"),
    progressText: document.getElementById("progressText"),
    progressFill: document.getElementById("progressFill"),
    feedbackMessage: document.getElementById("feedbackMessage"),
  };
}
