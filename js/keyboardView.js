export function createKeyboardView({ keybed, whiteKeys, blackKeys, onPressStart, onPressEnd }) {
  const keyElements = new Map();
  let lastExpectedCode = null;

  function bindPointerEvents(el, code) {
    el.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      onPressStart(code);
    });

    el.addEventListener("pointerup", () => {
      onPressEnd(code);
    });

    el.addEventListener("pointerleave", (event) => {
      if (event.buttons === 1) {
        onPressEnd(code);
      }
    });
  }

  function build() {
    const whiteRow = document.createElement("div");
    whiteRow.className = "white-row";

    whiteKeys.forEach((key) => {
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

    blackKeys.forEach((key) => {
      const el = document.createElement("button");
      el.className = "key black";
      el.type = "button";
      el.textContent = key.label;
      el.dataset.code = key.code;
      el.dataset.role = "black";

      const unit = 100 / whiteKeys.length;
      const center = (key.afterWhite + 1) * unit;
      el.style.left = `calc(${center}% - (100% / ${whiteKeys.length}) * 0.4)`;

      blackRow.appendChild(el);
      keyElements.set(key.code, el);
      bindPointerEvents(el, key.code);
    });

    keybed.appendChild(whiteRow);
    keybed.appendChild(blackRow);
  }

  function hasCode(code) {
    return keyElements.has(code);
  }

  function setKeyVisual(code, active) {
    const el = keyElements.get(code);
    if (!el) {
      return;
    }
    el.classList.toggle("active", active);
  }

  function flashKey(code, className) {
    const el = keyElements.get(code);
    if (!el) {
      return;
    }

    el.classList.remove(className);
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

  return {
    build,
    hasCode,
    setKeyVisual,
    flashKey,
    clearExpectedHighlight,
    highlightExpected,
  };
}
