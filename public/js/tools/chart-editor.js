const q = (selector) => document.querySelector(selector);
const canvas = q("[data-chart-canvas]");
const context = canvas.getContext("2d");
const player = q("[data-chart-player]");
const timeline = q("[data-chart-timeline]");
const metaModal = q("[data-chart-meta-modal]");
const metaForm = q("[data-chart-meta-form]");
const STORAGE_KEY = "sorastools.chart-editor.save.v1";
const state = {
  notes: [],
  selected: [],
  tool: "note",
  modifier: "normal",
  view: 0,
  zoom: 2,
  audioUrl: "",
  audioFile: null,
  undo: [],
  clipboard: [],
  playing: false,
  dirty: false,
};
const laneColors = [
  "#39d353",
  "#ff4b55",
  "#ffd43b",
  "#3297ff",
  "#ff7a00",
  "#fff0d9",
];
let sustain = null;
let drag = null;
let playbackFrame = 0;
let lastPlaybackDraw = 0;

const isSelected = (note) => state.selected.includes(note);
const noteColor = (note) =>
  note.modifier === "forced" || note.modifier === "forced-open"
    ? "#fff"
    : note.lane === 7
      ? "#b55cff"
      : laneColors[noteLane(note)];

const bpm = () =>
  Math.min(1000, Math.max(1, Number(q("[data-chart-bpm]").value) || 120));
const resolution = () => Number(q("[data-chart-resolution]").value) || 192;
const secondsToTick = (seconds) =>
  Math.round(((seconds * bpm()) / 60) * resolution());
const tickToSeconds = (tick) => ((tick / resolution()) * 60) / bpm();
const snapTick = (tick) => {
  const step = (resolution() * 4) / Number(q("[data-chart-snap]").value);
  return Math.round(tick / step) * step;
};
const noteLane = (note) => (note.lane === 7 ? 5 : note.lane);
const timeLabel = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${(seconds % 60).toFixed(3).padStart(6, "0")}`;
const chartDuration = () =>
  Math.max(
    player.duration || 0,
    ...state.notes.map((note) => tickToSeconds(note.tick + note.length)),
    1,
  );

function readLocalSave() {
  try {
    const save = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return save?.version === 1 && Array.isArray(save.notes) ? save : null;
  } catch (_) {
    return null;
  }
}

function saveLocal() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        notes: state.notes,
        chart: buildChart(),
        songIni: buildSongIni(),
        title: q("[data-chart-title]").value,
        artist: q("[data-chart-artist]").value,
        charter: q("[data-chart-charter]").value,
        album: q("[data-chart-meta-album]").value,
        year: q("[data-chart-meta-year]").value,
        diffGuitar: q("[data-chart-meta-diff-guitar]").value,
        loadingPhrase: q("[data-chart-meta-loading]").value,
        genre: q("[data-chart-meta-genre]").value,
        bpm: q("[data-chart-bpm]").value,
        resolution: q("[data-chart-resolution]").value,
        difficulty: q("[data-chart-difficulty]").value,
      }),
    );
  } catch (_) {}
}

function markDirty() {
  state.dirty = true;
  saveLocal();
}

function restoreLocal(save) {
  state.notes = save.notes.map((note) => ({ ...note }));
  state.selected = [];
  state.view = 0;
  state.undo = [];
  state.clipboard = [];
  q("[data-chart-title]").value = save.title || "Untitled";
  q("[data-chart-artist]").value = save.artist || "";
  q("[data-chart-charter]").value = save.charter || "SoraTools";
  q("[data-chart-meta-album]").value = save.album || "";
  q("[data-chart-meta-year]").value = save.year || "";
  q("[data-chart-meta-diff-guitar]").value = save.diffGuitar ?? "0";
  q("[data-chart-meta-loading]").value = save.loadingPhrase || "";
  q("[data-chart-meta-genre]").value = save.genre || "";
  q("[data-chart-bpm]").value = save.bpm || "120";
  q("[data-chart-resolution]").value = save.resolution || "192";
  q("[data-chart-difficulty]").value = save.difficulty || "ExpertSingle";
  state.dirty = false;
  draw();
  message("Dernière chart locale chargée");
}

function saveUndo() {
  state.undo.push(JSON.stringify(state.notes));
  if (state.undo.length > 50) state.undo.shift();
}

function dimensions() {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const trackWidth = Math.min(width - 100, 660);
  const laneWidth = trackWidth / 5;
  return {
    width,
    height,
    left: (width - trackWidth) / 2,
    laneWidth,
    top: 42,
    hit: height - 88,
  };
}

function yAt(tick, board) {
  return board.hit - (tickToSeconds(tick) - state.view) * 150 * state.zoom;
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(rect.width * dpr);
  const pixelHeight = Math.round(rect.height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const board = dimensions();
  timeline.value = Math.min(1000, (state.view / chartDuration()) * 1000);
  context.clearRect(0, 0, board.width, board.height);
  const background = context.createLinearGradient(0, 0, 0, board.height);
  background.addColorStop(0, "#20252d");
  background.addColorStop(1, "#111419");
  context.fillStyle = background;
  context.fillRect(0, 0, board.width, board.height);

  const snap = (resolution() * 4) / Number(q("[data-chart-snap]").value);
  const firstTick = Math.max(
    0,
    secondsToTick(state.view - (board.hit - board.top) / (150 * state.zoom)),
  );
  const lastTick =
    secondsToTick(state.view) +
    Math.ceil(
      ((((board.hit - board.top) / (150 * state.zoom)) * bpm()) / 60) *
        resolution(),
    );
  for (
    let tick = Math.floor(firstTick / snap) * snap;
    tick <= lastTick;
    tick += snap
  ) {
    const y = yAt(tick, board);
    if (y < board.top || y > board.hit + 2) continue;
    const bar = tick % (resolution() * 4) === 0;
    const beat = tick % resolution() === 0;
    context.strokeStyle = bar
      ? "rgba(255,122,0,.42)"
      : beat
        ? "rgba(255,255,255,.19)"
        : "rgba(255,255,255,.075)";
    context.lineWidth = bar ? 1.5 : 1;
    context.beginPath();
    context.moveTo(board.left - 38, y);
    context.lineTo(board.left + board.laneWidth * 5 + 10, y);
    context.stroke();
    if (bar) {
      context.fillStyle = "#ffb86b";
      context.font = '12px "Intel One Mono", monospace';
      context.textAlign = "right";
      context.fillText(
        String(Math.round(tick / (resolution() * 4)) + 1),
        board.left - 8,
        y - 4,
      );
    }
  }

  for (let lane = 0; lane <= 5; lane++) {
    const x = board.left + lane * board.laneWidth;
    context.fillStyle =
      lane % 2 ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.045)";
    if (lane < 5)
      context.fillRect(x, board.top, board.laneWidth, board.hit - board.top);
    context.strokeStyle =
      lane === 0 || lane === 5
        ? "rgba(255,255,255,.32)"
        : "rgba(255,255,255,.12)";
    context.beginPath();
    context.moveTo(x, board.top);
    context.lineTo(x, board.hit + 38);
    context.stroke();
  }

  state.notes.forEach((note) => {
    const lane = noteLane(note);
    const x = board.left + lane * board.laneWidth + board.laneWidth / 2;
    const y = yAt(note.tick, board);
    if (y < board.top - 50 || y > board.hit + 60) return;
    if (state.playing && y >= board.hit + 2) return;
    const hitProgress = state.playing
      ? Math.max(0, Math.min(1, (y - (board.hit - 34)) / 36))
      : 0;
    const noteAlpha = 1 - hitProgress;
    const noteScale = 1 + hitProgress * 0.45;
    if (note.length > 0) {
      const endY = yAt(note.tick + note.length, board);
      context.globalAlpha = (note.modifier === "tap" ? 0.2 : 0.55) * noteAlpha;
      context.fillStyle = noteColor(note);
      context.fillRect(
        note.lane === 7 ? board.left : x - 7,
        Math.min(y, endY),
        note.lane === 7 ? board.laneWidth * 5 : 14,
        Math.abs(y - endY),
      );
      context.globalAlpha = 1;
    }
    context.beginPath();
    if (note.lane === 7) {
      context.roundRect(
        board.left,
        y - 8 * noteScale,
        board.laneWidth * 5,
        16 * noteScale,
        8 * noteScale,
      );
    } else {
      context.arc(
        x,
        y,
        Math.min(board.laneWidth * 0.28, 15) * noteScale,
        0,
        Math.PI * 2,
      );
    }
    const color = noteColor(note);
    const selected = isSelected(note);
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = selected ? 20 : state.playing ? 0 : 8;
    context.globalAlpha = (note.modifier === "tap" ? 0.2 : 1) * noteAlpha;
    context.fill();
    context.globalAlpha = 1;
    context.shadowBlur = 0;
    context.lineWidth = selected ? 3 : note.modifier === "tap" ? 2.5 : 1.5;
    context.strokeStyle = selected ? "#fff" : color;
    context.globalAlpha = noteAlpha;
    context.stroke();
    context.globalAlpha = 1;
    if (note.modifier === "hopo") {
      context.beginPath();
      context.arc(
        x,
        y,
        Math.min(board.laneWidth * 0.18, 8) * noteScale,
        0,
        Math.PI * 2,
      );
      context.fillStyle = "#fff";
      context.shadowColor = "#fff";
      context.shadowBlur = state.playing ? 0 : 6;
      context.globalAlpha = noteAlpha;
      context.fill();
      context.globalAlpha = 1;
      context.shadowBlur = 0;
    }
  });

  context.fillStyle = "rgba(255,122,0,.92)";
  context.fillRect(board.left - 8, board.hit - 2, board.laneWidth * 5 + 16, 4);
  context.fillStyle = "#fff7ed";
  context.font = '700 12px "Roboto Condensed", sans-serif';
  context.textAlign = "center";
  ["G", "R", "Y", "B", "O"].forEach((label, lane) =>
    context.fillText(
      label,
      board.left + lane * board.laneWidth + board.laneWidth / 2,
      board.hit + 28,
    ),
  );
  q("[data-chart-note-count]").textContent = state.notes.length;
  q("[data-chart-tick]").textContent =
    state.selected[0]?.tick ?? secondsToTick(state.view);
  q('[data-chart-action="delete"]').disabled = !state.selected.length;
}

function tickAt(event) {
  const rect = canvas.getBoundingClientRect();
  const board = dimensions();
  return Math.max(
    0,
    snapTick(
      secondsToTick(
        state.view +
          (board.hit - (event.clientY - rect.top)) / (150 * state.zoom),
      ),
    ),
  );
}

function laneAt(event) {
  const rect = canvas.getBoundingClientRect();
  const board = dimensions();
  return Math.max(
    0,
    Math.min(
      4,
      Math.floor((event.clientX - rect.left - board.left) / board.laneWidth),
    ),
  );
}

function hitNote(event) {
  const tick = tickAt(event);
  const lane = laneAt(event);
  const rect = canvas.getBoundingClientRect();
  const board = dimensions();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return [...state.notes].reverse().find((note) => {
    const noteX =
      board.left + noteLane(note) * board.laneWidth + board.laneWidth / 2;
    const inOpen =
      note.lane === 7 &&
      x >= board.left &&
      x <= board.left + board.laneWidth * 5;
    return (
      (inOpen || noteLane(note) === lane) &&
      Math.abs(note.tick - tick) <= resolution() / 2 &&
      (inOpen || Math.abs(noteX - x) <= board.laneWidth * 0.65) &&
      Math.abs(yAt(note.tick, board) - y) <= 30
    );
  });
}

function addNote(event, length = 0) {
  const lane = state.modifier.includes("open") ? 7 : laneAt(event);
  const note = { tick: tickAt(event), lane, length, modifier: state.modifier };
  if (
    state.notes.some(
      (item) => item.tick === note.tick && item.lane === note.lane,
    )
  )
    return;
  saveUndo();
  state.notes.push(note);
  state.notes.sort((a, b) => a.tick - b.tick);
  state.selected = [note];
  markDirty();
  draw();
}

function markImplicitHopos(notes) {
  const grouped = new Map();
  notes.forEach((note) => {
    if (!grouped.has(note.tick)) grouped.set(note.tick, []);
    grouped.get(note.tick).push(note);
  });
  const groups = [...grouped.values()].sort((a, b) => a[0].tick - b[0].tick);
  groups.forEach((group, index) => {
    const previous = groups[index - 1];
    if (!previous || group.length !== 1) return;
    const note = group[0];
    if (
      note.modifier === "normal" &&
      note.lane !== 7 &&
      !previous.some((item) => item.lane === 7 || item.lane === note.lane) &&
      note.tick - previous[0].tick <= resolution() / 2
    )
      note.modifier = "hopo";
  });
}

function message(text) {
  q("[data-chart-message]").textContent = text;
}
function safeText(value) {
  return String(value || "")
    .replaceAll('"', '\\"')
    .replace(/[\r\n]/g, " ");
}
function openMetaModal(startup = false) {
  q("[data-chart-meta-title]").value = q("[data-chart-title]").value;
  q("[data-chart-meta-artist]").value = q("[data-chart-artist]").value;
  q("[data-chart-meta-charter]").value = q("[data-chart-charter]").value;
  const hasSave = startup && readLocalSave();
  q("[data-chart-save-choice]").hidden = !startup;
  q("[data-chart-save-status]").textContent = hasSave
    ? "Une dernière sauvegarde locale a été trouvée."
    : "Aucune sauvegarde locale disponible.";
  q("[data-chart-restore]").disabled = !hasSave;
  q("[data-chart-meta-fields]").hidden = Boolean(hasSave);
  if (typeof metaModal.showModal === "function") {
    document.body.classList.add("chart-modal-open");
    metaModal.showModal();
  }
}

function applyMetaModal() {
  q("[data-chart-title]").value =
    q("[data-chart-meta-title]").value.trim() || "Untitled";
  q("[data-chart-artist]").value = q("[data-chart-meta-artist]").value.trim();
  q("[data-chart-charter]").value =
    q("[data-chart-meta-charter]").value.trim() || "SoraTools";
}

function buildChart() {
  const title = q("[data-chart-title]").value.trim() || "Untitled";
  const difficulty = q("[data-chart-difficulty]").value;
  const noteLines = [];
  const ticks = new Map();
  state.notes
    .slice()
    .sort((a, b) => a.tick - b.tick)
    .forEach((note) => {
      const flags = ticks.get(note.tick) || { forced: false, tap: false };
      if (note.modifier === "forced" || note.modifier === "forced-open")
        flags.forced = true;
      if (note.modifier === "tap") flags.tap = true;
      ticks.set(note.tick, flags);
    });
  state.notes
    .slice()
    .sort((a, b) => a.tick - b.tick)
    .forEach((note) =>
      noteLines.push(`  ${note.tick} = N ${note.lane} ${note.length}`),
    );
  ticks.forEach((flags, tick) => {
    if (flags.forced) noteLines.push(`  ${tick} = N 5 0`);
    if (flags.tap) noteLines.push(`  ${tick} = N 6 0`);
  });
  const notes = noteLines
    .sort((a, b) => Number(a.trim()) - Number(b.trim()))
    .join("\n");
  return [
    "[Song]",
    "{",
    `  Name = "${safeText(title)}"`,
    `  Artist = "${safeText(q("[data-chart-artist]").value)}"`,
    `  Charter = "${safeText(q("[data-chart-charter]").value)}"`,
    "  Offset = 0",
    `  Resolution = ${resolution()}`,
    "}",
    "",
    "[SyncTrack]",
    "{",
    `  0 = B ${Math.round(bpm() * 1000)}`,
    "}",
    "",
    `[${difficulty}]`,
    "{",
    notes,
    "}",
    "",
  ].join("\n");
}

function buildSongIni() {
  const title = q("[data-chart-title]").value.trim() || "Untitled";
  const artist = q("[data-chart-artist]").value.trim();
  const charter = q("[data-chart-charter]").value.trim() || "SoraTools";
  const album = q("[data-chart-meta-album]").value.trim();
  const year = q("[data-chart-meta-year]").value.trim();
  const diffGuitar = q("[data-chart-meta-diff-guitar]").value || "0";
  const loadingPhrase = q("[data-chart-meta-loading]").value.trim();
  const genre = q("[data-chart-meta-genre]").value.trim();
  return [
    "[song]",
    `name = ${title}`,
    `artist = ${artist}`,
    `charter = ${charter}`,
    `album = ${album}`,
    `year = ${year}`,
    `genre = ${genre}`,
    `song_length = ${Math.round(chartDuration() * 1000)}`,
    `diff_guitar = ${diffGuitar}`,
    "preview_start_time = 0",
    "icon = sora",
    `loading_phrase = ${loadingPhrase}`,
    "playlist_track = 1",
    "modchart = 0",
    "",
  ].join("\n");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const local = [];
  const central = [];
  let offset = 0;
  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const data =
      file.data instanceof Uint8Array ? file.data : encoder.encode(file.data);
    const crc = crc32(data);
    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x800, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    local.push(header, name, data);
    const directory = new Uint8Array(46);
    const directoryView = new DataView(directory.buffer);
    directoryView.setUint32(0, 0x02014b50, true);
    directoryView.setUint16(4, 20, true);
    directoryView.setUint16(6, 20, true);
    directoryView.setUint16(8, 0x800, true);
    directoryView.setUint32(16, crc, true);
    directoryView.setUint32(20, data.length, true);
    directoryView.setUint32(24, data.length, true);
    directoryView.setUint16(28, name.length, true);
    directoryView.setUint32(42, offset, true);
    central.push(directory, name);
    offset += header.length + name.length + data.length;
  });
  const output = new Uint8Array(
    [...local, ...central].reduce((total, chunk) => total + chunk.length, 22),
  );
  let cursor = 0;
  [...local, ...central].forEach((chunk) => {
    output.set(chunk, cursor);
    cursor += chunk.length;
  });
  const directorySize = central.reduce(
    (total, chunk) => total + chunk.length,
    0,
  );
  const end = new DataView(output.buffer, cursor, 22);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return output;
}

function safeFileName(value) {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/^[-. ]+|[-. ]+$/g, "") || "Untitled"
  );
}
async function exportChart() {
  const title = q("[data-chart-title]").value.trim() || "Untitled";
  const artist = q("[data-chart-artist]").value.trim() || "Unknown";
  const charter = q("[data-chart-charter]").value.trim() || "SoraTools";
  const files = [
    { name: "notes.chart", data: buildChart() },
    { name: "song.ini", data: buildSongIni() },
  ];
  if (state.audioFile)
    files.push({
      name: state.audioFile.name,
      data: new Uint8Array(await state.audioFile.arrayBuffer()),
    });
  const zip = zipStore(files);
  const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(artist)} - ${safeFileName(title)} (${safeFileName(charter)}).zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  state.dirty = false;
  saveLocal();
  message("Archive ZIP exportée");
}

function importChart(text) {
  const section = (name) =>
    text.match(new RegExp(`\\[${name}\\]\\s*\\{([\\s\\S]*?)\\}`, "i"))?.[1] ||
    "";
  const song = section("Song");
  const sync = section("SyncTrack");
  const track = section(q("[data-chart-difficulty]").value);
  const readField = (name) =>
    song
      .match(
        new RegExp(`^\\s*${name}\\s*=\\s*"((?:\\\\.|[^"\\\\])*)"`, "mi"),
      )?.[1]
      ?.replaceAll('\\"', '"') || "";
  const resolutionValue =
    Number(song.match(/^\s*Resolution\s*=\s*(\d+)/im)?.[1]) || 192;
  const tempoValue =
    Number(sync.match(/^\s*\d+\s*=\s*B\s+(\d+)/im)?.[1]) || 120000;
  const entries = [
    ...track.matchAll(/^\s*(\d+)\s*=\s*N\s+([0-7])\s+(\d+)/gm),
  ].map((match) => ({
    tick: Number(match[1]),
    lane: Number(match[2]),
    length: Number(match[3]),
  }));
  const forcedTicks = new Set(
    entries.filter((note) => note.lane === 5).map((note) => note.tick),
  );
  const tapTicks = new Set(
    entries.filter((note) => note.lane === 6).map((note) => note.tick),
  );
  const parsed = entries
    .filter((note) => note.lane <= 4 || note.lane === 7)
    .map((note) => ({
      ...note,
      modifier:
        note.lane === 7
          ? forcedTicks.has(note.tick)
            ? "forced-open"
            : "open"
          : tapTicks.has(note.tick)
            ? "tap"
            : forcedTicks.has(note.tick)
              ? "forced"
              : "normal",
    }));
  if (!song || !track)
    throw new Error("Section Song ou difficulté introuvable.");
  q("[data-chart-title]").value = readField("Name") || "Untitled";
  q("[data-chart-artist]").value = readField("Artist");
  q("[data-chart-charter]").value = readField("Charter");
  q("[data-chart-meta-album]").value = readField("Album");
  q("[data-chart-meta-year]").value = readField("Year");
  q("[data-chart-meta-loading]").value = readField("LoadingPhrase");
  q("[data-chart-meta-genre]").value = readField("Genre");
  q("[data-chart-resolution]").value = String(resolutionValue);
  q("[data-chart-bpm]").value = String(tempoValue / 1000);
  markImplicitHopos(parsed);
  state.notes = parsed;
  state.selected = [];
  state.dirty = false;
  saveLocal();
  draw();
  message(`${parsed.length} notes importées`);
}

function reset() {
  state.notes = [];
  state.selected = [];
  state.modifier = "normal";
  state.view = 0;
  state.undo = [];
  state.clipboard = [];
  state.audioFile = null;
  document
    .querySelectorAll("[data-chart-mod]")
    .forEach((item) =>
      item.classList.toggle("is-active", item.dataset.chartMod === "normal"),
    );
  q("[data-chart-title]").value = "Untitled";
  q("[data-chart-artist]").value = "";
  q("[data-chart-charter]").value = "SorasTools";
  q("[data-chart-bpm]").value = "120";
  q("[data-chart-difficulty]").value = "ExpertSingle";
  q("[data-chart-resolution]").value = "192";
  q("[data-chart-zoom]").value = "2";
  state.zoom = 2;
  player.pause();
  player.removeAttribute("src");
  player.load();
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = "";
  state.dirty = false;
  saveLocal();
  message("Chart vierge");
  draw();
}

function resize() {
  draw();
}
function playbackLoop(timestamp) {
  if (player.paused) {
    playbackFrame = 0;
    state.playing = false;
    return;
  }
  if (timestamp - lastPlaybackDraw >= 16) {
    state.view = player.currentTime;
    q("[data-chart-time]").textContent = timeLabel(player.currentTime);
    draw();
    lastPlaybackDraw = timestamp;
  }
  playbackFrame = requestAnimationFrame(playbackLoop);
}
function startPlaybackLoop() {
  state.playing = true;
  if (!playbackFrame) {
    lastPlaybackDraw = 0;
    playbackFrame = requestAnimationFrame(playbackLoop);
  }
}
function playPause() {
  if (player.paused)
    player
      .play()
      .then(startPlaybackLoop)
      .catch(() => message("Importe un fichier audio pour lancer la lecture."));
  else player.pause();
}

q('[data-chart-action="new"]').addEventListener("click", () => {
  reset();
  openMetaModal();
});
q('[data-chart-action="export"]').addEventListener("click", exportChart);
q('[data-chart-action="import"]').addEventListener("click", () =>
  q("[data-chart-file]").click(),
);
q("[data-chart-file]").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    importChart(await file.text());
    openMetaModal();
  } catch (error) {
    message(error.message);
  }
  event.target.value = "";
});
q("[data-chart-audio]").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  state.audioFile = file;
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(file);
  player.src = state.audioUrl;
  markDirty();
  message(`Audio chargé : ${file.name}`);
});
q('[data-chart-action="play"]').addEventListener("click", playPause);
q('[data-chart-action="stop"]').addEventListener("click", () => {
  player.pause();
  state.view = player.currentTime;
  draw();
});
q('[data-chart-action="delete"]').addEventListener("click", () => {
  if (!state.selected.length) return;
  saveUndo();
  state.notes = state.notes.filter((note) => !state.selected.includes(note));
  state.selected = [];
  markDirty();
  draw();
});
metaForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "confirm") {
    applyMetaModal();
    markDirty();
    message("Métadonnées mises à jour");
    draw();
  }
});
metaModal.addEventListener("close", () =>
  document.body.classList.remove("chart-modal-open"),
);
q("[data-chart-new]").addEventListener("click", () => {
  q("[data-chart-save-choice]").hidden = true;
  q("[data-chart-meta-fields]").hidden = false;
  q("[data-chart-meta-title]").value = "Untitled";
  q("[data-chart-meta-artist]").value = "";
  q("[data-chart-meta-charter]").value = "SoraTools";
  q("[data-chart-meta-album]").value = "";
  q("[data-chart-meta-year]").value = "";
  q("[data-chart-meta-diff-guitar]").value = "0";
  q("[data-chart-meta-loading]").value = "";
  q("[data-chart-meta-genre]").value = "";
});
q("[data-chart-restore]").addEventListener("click", () => {
  const save = readLocalSave();
  if (!save) return;
  restoreLocal(save);
  metaModal.close();
});
document.querySelectorAll("[data-chart-tool]").forEach((button) =>
  button.addEventListener("click", () => {
    state.tool = button.dataset.chartTool;
    document
      .querySelectorAll("[data-chart-tool]")
      .forEach((item) => item.classList.toggle("is-active", item === button));
  }),
);
document.querySelectorAll("[data-chart-mod]").forEach((button) =>
  button.addEventListener("click", () => {
    state.modifier = button.dataset.chartMod;
    document
      .querySelectorAll("[data-chart-mod]")
      .forEach((item) => item.classList.toggle("is-active", item === button));
  }),
);
["[data-chart-bpm]", "[data-chart-resolution]", "[data-chart-snap]"].forEach(
  (selector) =>
    q(selector).addEventListener("input", () => {
      markDirty();
      draw();
    }),
);
["[data-chart-title]", "[data-chart-artist]", "[data-chart-charter]"].forEach(
  (selector) => q(selector).addEventListener("input", markDirty),
);
q("[data-chart-zoom]").addEventListener("input", (event) => {
  state.zoom = Number(event.target.value);
  draw();
});
timeline.addEventListener("input", (event) => {
  state.view = (Number(event.target.value) / 1000) * chartDuration();
  draw();
});
player.addEventListener("play", startPlaybackLoop);
player.addEventListener("pause", () => {
  state.playing = false;
  state.view = player.currentTime;
  q("[data-chart-time]").textContent = timeLabel(player.currentTime);
  draw();
});
player.addEventListener("timeupdate", () => {
  q("[data-chart-time]").textContent = timeLabel(player.currentTime);
});
canvas.addEventListener("click", (event) => {
  if (state.tool === "mouse") return;
  const note = hitNote(event);
  if (state.tool === "erase") {
    const target = note || state.selected[0];
    if (target) {
      saveUndo();
      state.notes = state.notes.filter((item) => item !== target);
      state.selected = [];
      markDirty();
      draw();
    }
  } else addNote(event);
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("pointerdown", (event) => {
  const note = hitNote(event);
  if (event.button === 2) {
    if (!note) return;
    state.selected = [note];
    sustain = { note, tick: note.tick };
    saveUndo();
    markDirty();
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (event.button === 0 && state.tool === "mouse" && note) {
    if (event.ctrlKey || event.metaKey || event.shiftKey)
      state.selected = state.selected.includes(note)
        ? state.selected
        : [...state.selected, note];
    else if (!state.selected.includes(note)) state.selected = [note];
    drag = {
      startTick: tickAt(event),
      startLane: laneAt(event),
      notes: state.selected.map((item) => ({
        item,
        tick: item.tick,
        lane: item.lane,
      })),
      moved: false,
    };
    saveUndo();
    markDirty();
    canvas.setPointerCapture(event.pointerId);
    draw();
  }
});
canvas.addEventListener("pointermove", (event) => {
  if (sustain) {
    sustain.note.length = Math.max(0, tickAt(event) - sustain.tick);
    draw();
    return;
  }
  if (!drag) return;
  const deltaTick = tickAt(event) - drag.startTick;
  const deltaLane = laneAt(event) - drag.startLane;
  if (deltaTick || deltaLane) drag.moved = true;
  drag.notes.forEach(({ item, tick, lane }) => {
    item.tick = Math.max(0, tick + deltaTick);
    if (lane !== 7) item.lane = Math.max(0, Math.min(4, lane + deltaLane));
  });
  state.notes.sort((a, b) => a.tick - b.tick);
  draw();
});
canvas.addEventListener("pointerup", () => {
  sustain = null;
  drag = null;
});
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    state.view = Math.max(
      0,
      Math.min(chartDuration(), state.view + event.deltaY / (150 * state.zoom)),
    );
    draw();
  },
  { passive: false },
);
document.addEventListener("keydown", (event) => {
  if (event.target.matches("input,select,textarea")) return;
  if (
    (event.key === "Delete" || event.key === "Backspace") &&
    state.selected.length
  )
    q('[data-chart-action="delete"]').click();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    state.clipboard = state.selected.map((note) => ({ ...note }));
    event.preventDefault();
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "v" &&
    state.clipboard.length
  ) {
    saveUndo();
    const step = (resolution() * 4) / Number(q("[data-chart-snap]").value);
    const sourceStart = Math.min(...state.clipboard.map((note) => note.tick));
    const chartEnd = state.notes.length
      ? Math.max(...state.notes.map((note) => note.tick + note.length))
      : sourceStart - step;
    const offset = chartEnd + step - sourceStart;
    state.selected = state.clipboard.map((note) => ({
      ...note,
      tick: note.tick + offset,
    }));
    state.notes.push(...state.selected);
    state.notes.sort((a, b) => a.tick - b.tick);
    markDirty();
    event.preventDefault();
    draw();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    const last = state.undo.pop();
    if (last) {
      state.notes = JSON.parse(last);
      state.selected = [];
      markDirty();
      draw();
    }
  }
  if (event.code === "Space") {
    event.preventDefault();
    playPause();
  }
});
window.addEventListener("resize", resize);
window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
draw();
openMetaModal(true);
