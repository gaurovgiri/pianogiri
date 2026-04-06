export function createSongService({ manifestPath }) {
  let songs = [];
  let filteredSongs = [];

  async function loadSongs() {
    const manifestResponse = await fetch(manifestPath);
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

  function applySearch(query) {
    const normalized = query.trim().toLowerCase();
    filteredSongs = songs.filter((song) => song.title.toLowerCase().includes(normalized));
    return [...filteredSongs];
  }

  function getSongById(songId) {
    return songs.find((song) => song.id === songId) || null;
  }

  function getSongs() {
    return [...songs];
  }

  function getFilteredSongs() {
    return [...filteredSongs];
  }

  return {
    loadSongs,
    applySearch,
    getSongById,
    getSongs,
    getFilteredSongs,
  };
}
