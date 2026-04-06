export function createLessonEngine() {
  let selectedSong = null;
  let currentStep = 0;

  function expectedCode() {
    if (!selectedSong || currentStep >= selectedSong.sequence.length) {
      return null;
    }

    return selectedSong.sequence[currentStep];
  }

  function selectSong(song) {
    selectedSong = song;
    currentStep = 0;
  }

  function deselectSong() {
    selectedSong = null;
    currentStep = 0;
  }

  function restartSong() {
    if (!selectedSong) {
      return;
    }

    currentStep = 0;
  }

  function evaluateInput(code) {
    if (!selectedSong) {
      return { status: "idle" };
    }

    const wantedCode = expectedCode();
    if (!wantedCode) {
      return { status: "complete" };
    }

    if (code === wantedCode) {
      currentStep += 1;
      if (currentStep >= selectedSong.sequence.length) {
        return { status: "complete" };
      }

      return {
        status: "correct",
        nextCode: expectedCode(),
      };
    }

    return {
      status: "wrong",
      wantedCode,
    };
  }

  function getState() {
    return {
      selectedSong,
      currentStep,
      expectedCode: expectedCode(),
      totalSteps: selectedSong ? selectedSong.sequence.length : 0,
    };
  }

  return {
    selectSong,
    deselectSong,
    restartSong,
    evaluateInput,
    getState,
  };
}
