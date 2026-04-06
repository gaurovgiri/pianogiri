# PianoGiri

A reactive, browser-based piano learning website where users choose a song and play guided notes step by step.

![PianoGiri Screenshot](./screenshot.png)

## Features

- Song list with selectable lessons
- Search button to quickly filter songs by title
- Guided next-note coaching for each song
- Correct and wrong-note reactive feedback
- Progress tracking with live completion bar
- Real-time play from your computer keyboard and mouse/touch
- Grand-piano sampled sound engine (Tone.js + Salamander samples)
- Sustain toggle (Tab), octave control (Z/X), velocity control (C/V)
- Responsive layout for desktop and mobile

## Keyboard Mapping

### White keys

- A S D F G H J K L ; '

### Black keys

- W E T Y U O P

### Controls

- Sustain: Tab
- Octave down: Z
- Octave up: X
- Velocity down: C
- Velocity up: V

## Octave Behavior

The displayed octave labels are calibrated so `C1` on the UI sounds as concert-style `C4`, matching your intended reference.

## Guided Learning Flow

1. Pick any song from the "Available Songs" list.
2. Follow the "Next Note" prompt.
3. Play matching keys in order to advance.
4. Complete the sequence to finish the song.

## Song Files

Songs are loaded from the `songs` folder.

- `songs/index.json` contains the list of song filenames.
- Each song is stored in its own JSON file, for example `songs/twinkle-intro.json`.

Song JSON format:

```json
{
	"id": "twinkle",
	"title": "Twinkle Intro",
	"difficulty": "Beginner",
	"sequence": ["KeyA", "KeyA", "KeyG"]
}
```

To add a new song:

1. Create a new file in `songs/` with the same JSON shape.
2. Add that filename to `songs/index.json`.

## Tech Stack

- HTML, CSS, JavaScript
- Web Audio via Tone.js
- Sample set: Salamander piano samples loaded from CDN

## Notes

- Internet connection is required for CDN-loaded Tone.js and piano samples.
