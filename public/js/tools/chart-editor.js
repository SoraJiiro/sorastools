import { unzip } from "/vendor/fflate.browser.js";

const q = (selector) => document.querySelector(selector);
const canvas = q("[data-chart-canvas]");
const context = canvas.getContext("2d");
const player = q("[data-chart-player]");
const timeline = q("[data-chart-timeline]");
const metaModal = q("[data-chart-meta-modal]");
const metaForm = q("[data-chart-meta-form]");
const STORAGE_KEY = "sorastools.chart-editor.save.v1";
const AUDIO_CACHE_PREFIX = "chart-editor-audio-v1-";
const AUDIO_ORIGIN = location.origin;
const state = {
  notes: [],
  selected: [],
  tool: "note",
  modifier: "normal",
  view: 0,
  zoom: 2,
  audioUrl: "",
  audioFile: null,
  audioTracks: [],
  undo: [],
  redo: [],
  clipboard: [],
  playing: false,
  dirty: false,
  selectionBox: null,
  importedChartText: "",
  importedMidiBuffer: null,
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

function createCacheId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

async function saveAudioCache() {
  const tracks = state.audioTracks.length
    ? state.audioTracks
    : state.audioFile
      ? [{ file: state.audioFile }]
      : [];

  let saved = readLocalSave();
  if (!saved) saved = {};
  if (!tracks.length) {
    if (saved.audioCacheName) {
      try {
        await caches.delete(saved.audioCacheName);
      } catch (_) {}
    }
    return;
  }

  const cacheName =
    saved.audioCacheName || `${AUDIO_CACHE_PREFIX}${createCacheId()}`;
  try {
    const cache = await caches.open(cacheName);
    const metadata = [];
    for (const [index, track] of tracks.entries()) {
      const file = track.file;
      const url = `${AUDIO_ORIGIN}/__chart-editor-audio__/${encodeURIComponent(cacheName)}/${index}`;
      await cache.put(
        url,
        new Response(file, {
          headers: { "content-type": file.type || "application/octet-stream" },
        }),
      );
      metadata.push({
        name: file.name,
        type: file.type || "application/octet-stream",
        index,
      });
    }

    saved.audioCacheName = cacheName;
    saved.audioTracks = metadata;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    for (const name of await caches.keys()) {
      if (name.startsWith(AUDIO_CACHE_PREFIX) && name !== cacheName)
        await caches.delete(name);
    }
  } catch (_) {}
}

async function restoreAudioCache(save) {
  if (
    !save?.audioCacheName ||
    !Array.isArray(save.audioTracks) ||
    !save.audioTracks.length
  )
    return;
  try {
    const cache = await caches.open(save.audioCacheName);
    const files = [];
    for (const track of save.audioTracks) {
      const url = `${AUDIO_ORIGIN}/__chart-editor-audio__/${encodeURIComponent(save.audioCacheName)}/${track.index}`;
      const response = await cache.match(url);
      if (!response) throw new Error("Piste audio locale introuvable.");
      files.push(
        new File([await response.blob()], track.name, { type: track.type }),
      );
    }
    setupAudioTracks(files);
  } catch (_) {
    message("Les pistes audio locales sont introuvables.");
  }
}

function saveLocal() {
  try {
    const previous = readLocalSave() || {};
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        ...previous,
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

async function restoreLocal(save) {
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
  await restoreAudioCache(save);
  draw();
  message("Dernière chart locale chargée");
}

function saveUndo() {
  state.undo.push(JSON.stringify(state.notes));
  state.redo = [];
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
    if (state.playing && y >= board.hit + 2 && note.length === 0) return;
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
  q('[data-chart-action="delete"]').disabled = !state.selected.length;
  updateInspector();

  if (state.selectionBox) {
    const x = Math.min(state.selectionBox.startX, state.selectionBox.endX);
    const y = Math.min(state.selectionBox.startY, state.selectionBox.endY);
    const width = Math.abs(state.selectionBox.endX - state.selectionBox.startX);
    const height = Math.abs(
      state.selectionBox.endY - state.selectionBox.startY,
    );
    context.save();
    context.fillStyle = "rgba(255,122,0,.12)";
    context.strokeStyle = "#ff7a00";
    context.lineWidth = 1.5;
    context.setLineDash([6, 4]);
    context.fillRect(x, y, width, height);
    context.strokeRect(x, y, width, height);
    context.restore();
  }
}

let inspectorTickUpdate = 0;

function updateInspector(force = false) {
  const now = performance.now();
  if (!force && now - inspectorTickUpdate < 100) return;
  inspectorTickUpdate = now;

  const note = state.selected[0];
  const info = q("[data-chart-note-info]");
  const tickInput = q("[data-chart-tick-jump]");
  if (!note) {
    info.innerHTML = "<p>Aucune note sélectionnée</p>";
    if (document.activeElement !== tickInput)
      tickInput.value = String(secondsToTick(state.view));
    return;
  }

  const laneLabel =
    note.lane === 7 ? "Open" : ["G", "R", "Y", "B", "O"][note.lane] || "—";
  const typeLabels = {
    normal: "Normale",
    hopo: "HOPO",
    forced: "Forced",
    tap: "Tap",
    open: "Open",
    "forced-open": "Forced Open",
  };
  info.innerHTML = [
    `<p>Type <strong>${typeLabels[note.modifier] || note.modifier}</strong></p>`,
    `<p>Lane <strong>${laneLabel}</strong></p>`,
    `<p>Tick <strong>${note.tick}</strong></p>`,
    `<p>Durée <strong>${note.length}</strong></p>`,
    `<p>Temps <strong>${timeLabel(tickToSeconds(note.tick))}</strong></p>`,
  ].join("");
  tickInput.value = String(note.tick);
}

function jumpToTick(tick) {
  const safeTick = Math.max(0, Math.round(Number(tick) || 0));
  const seconds = tickToSeconds(safeTick);
  state.view = seconds;
  if (Number.isFinite(player.duration))
    player.currentTime = Math.min(seconds, player.duration);
  seekAudioTracks(seconds);
  q("[data-chart-tick-jump]").value = String(safeTick);
  q("[data-chart-time]").textContent = timeLabel(seconds);
  timeline.value = Math.min(1000, (seconds / chartDuration()) * 1000);
  draw();
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
  const exportTracks = state.audioTracks.length
    ? state.audioTracks
    : state.audioFile
      ? [{ file: state.audioFile }]
      : [];
  for (const { file } of exportTracks)
    files.push({
      name: file.name,
      data: new Uint8Array(await file.arrayBuffer()),
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

const audioExtensions = new Set([
  "aac",
  "flac",
  "m4a",
  "mp3",
  "ogg",
  "opus",
  "wav",
]);

function extension(name) {
  return name.split(".").pop().toLowerCase();
}

function setupAudioTracks(files) {
  state.audioTracks.forEach(({ element, url }) => {
    element.pause();
    if (element !== player) element.remove();
    URL.revokeObjectURL(url);
  });
  state.audioTracks = [];
  if (state.audioUrl) {
    URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = "";
  }

  const tracks = files
    .filter((file) => audioExtensions.has(extension(file.name)))
    .map((file) => ({ file, name: file.name.replace(/\.[^.]+$/, "") }));
  if (!tracks.length) {
    q("[data-chart-audio]").hidden = false;
    state.audioFile = null;
    return;
  }

  const isSong = ({ name }) => /^song(?:$|[\s_.-])/i.test(name);
  const solo = tracks.find(isSong);
  const playingTracks = solo ? [solo] : tracks;

  playingTracks.forEach(({ file, name }, index) => {
    const url = URL.createObjectURL(file);
    const element = index === 0 ? player : new Audio();
    element.src = url;
    element.preload = "metadata";
    if (index > 0) {
      element.hidden = true;
      player.after(element);
    }
    state.audioTracks.push({ name, file, element, url });
  });

  state.audioFile = solo?.file || tracks[0].file;
  state.audioUrl = state.audioTracks[0].url;
  player.load();
  q("[data-chart-audio]").hidden = true;
  message(
    solo
      ? `Piste solo chargée : ${solo.file.name}`
      : `${tracks.length} pistes audio superposées`,
  );
}

function parseIni(content) {
  const section = (name) =>
    content.match(
      new RegExp(`\\[${name}\\][\\s\\S]*?(?=\\n\\s*\\[|$)`, "i"),
    )?.[0] || "";
  const song = section("song");
  const value = (name) => {
    const match = song.match(
      new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`, "im"),
    );
    return match?.[1]?.trim() || "";
  };
  return {
    title: value("name"),
    artist: value("artist"),
    charter: value("charter"),
    album: value("album"),
    year: value("year"),
    genre: value("genre"),
    diffGuitar: value("diff_guitar"),
    loadingPhrase: value("loading_phrase"),
  };
}

function applyIni(ini) {
  if (!ini) return;
  if (ini.title) q("[data-chart-title]").value = ini.title;
  if (ini.artist) q("[data-chart-artist]").value = ini.artist;
  if (ini.charter) q("[data-chart-charter]").value = ini.charter;
  if (ini.album) q("[data-chart-meta-album]").value = ini.album;
  if (ini.year) q("[data-chart-meta-year]").value = ini.year;
  if (ini.genre) q("[data-chart-meta-genre]").value = ini.genre;
  if (ini.diffGuitar) q("[data-chart-meta-diff-guitar]").value = ini.diffGuitar;
  if (ini.loadingPhrase)
    q("[data-chart-meta-loading]").value = ini.loadingPhrase;
}

function importMidi(buffer) {
  const bytes = new Uint8Array(buffer);
  const text = (offset, length) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  const uint32 = (offset) =>
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3];

  if (text(0, 4) !== "MThd" || uint32(4) < 6)
    throw new Error("En-tête MIDI invalide.");
  const headerLength = uint32(4);
  const format = (bytes[8] << 8) | bytes[9];
  const trackCount = (bytes[10] << 8) | bytes[11];
  const division = (bytes[12] << 8) | bytes[13];
  if (format > 1 || !trackCount || division & 0x8000 || !division)
    throw new Error("Format MIDI non pris en charge (format 0/1 attendu).");

  let offset = 8 + headerLength;
  const tempos = [];
  const tracks = [];
  for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
    if (offset + 8 > bytes.length || text(offset, 4) !== "MTrk")
      throw new Error("Piste MIDI invalide.");
    const end = offset + 8 + uint32(offset + 4);
    if (end > bytes.length) throw new Error("Piste MIDI tronquée.");
    offset += 8;
    let tick = 0;
    let runningStatus = 0;
    let name = "";
    const starts = new Map();
    const notes = [];

    const readVlq = () => {
      let value = 0;
      for (let count = 0; count < 4; count++) {
        if (offset >= end) throw new Error("Événement MIDI tronqué.");
        const byte = bytes[offset++];
        value = (value << 7) | (byte & 0x7f);
        if (!(byte & 0x80)) return value;
      }
      throw new Error("Valeur MIDI invalide.");
    };

    while (offset < end) {
      tick += readVlq();
      let status = bytes[offset++];
      if (status === 0xff) {
        const type = bytes[offset++];
        const length = readVlq();
        if (offset + length > end) throw new Error("Méta-événement tronqué.");
        if (type === 0x03) name = text(offset, length);
        if (type === 0x51 && length === 3) {
          const microseconds =
            (bytes[offset] << 16) |
            (bytes[offset + 1] << 8) |
            bytes[offset + 2];
          if (microseconds) tempos.push({ tick, microseconds });
        }
        offset += length;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const length = readVlq();
        offset += length;
        runningStatus = 0;
        continue;
      }
      if (status < 0x80) {
        offset--;
        status = runningStatus;
      } else if (status < 0xf0) runningStatus = status;
      const command = status & 0xf0;
      const channel = status & 0x0f;
      const dataLength = command === 0xc0 || command === 0xd0 ? 1 : 2;
      if (offset + dataLength > end) throw new Error("Événement MIDI tronqué.");
      const pitch = bytes[offset++];
      const velocity = dataLength === 2 ? bytes[offset++] : 0;
      if (command !== 0x80 && command !== 0x90) continue;
      const key = `${channel}:${pitch}`;
      if (command === 0x90 && velocity > 0) {
        const pending = starts.get(key) || [];
        pending.push(tick);
        starts.set(key, pending);
      } else {
        const pending = starts.get(key);
        if (!pending?.length) continue;
        notes.push({ pitch, start: pending.shift(), end: tick });
      }
    }
    tracks.push({ name, notes });
    offset = end;
  }

  tempos.sort((a, b) => a.tick - b.tick);
  if (!tempos.length) tempos.push({ tick: 0, microseconds: 500000 });
  if (tempos[0].tick > 0) tempos.unshift({ tick: 0, microseconds: 500000 });
  const bases = [96, 84, 72, 60];
  const instrument = tracks
    .filter(({ notes }) =>
      bases.some((base) =>
        notes.some(({ pitch }) => pitch >= base && pitch <= base + 4),
      ),
    )
    .sort(
      (a, b) =>
        Number(!/PART GUITAR/i.test(a.name)) -
        Number(!/PART GUITAR/i.test(b.name)),
    )[0];
  if (!instrument)
    throw new Error(
      "Aucune piste Guitar Hero à cinq lanes trouvée dans le MIDI.",
    );

  const difficulty = q("[data-chart-difficulty]").value;
  const baseByDifficulty = {
    ExpertSingle: 96,
    HardSingle: 84,
    MediumSingle: 72,
    EasySingle: 60,
  };
  let base = baseByDifficulty[difficulty] || 96;
  if (
    !instrument.notes.some(({ pitch }) => pitch >= base && pitch <= base + 4)
  ) {
    base =
      bases.find((candidate) =>
        instrument.notes.some(
          ({ pitch }) => pitch >= candidate && pitch <= candidate + 4,
        ),
      ) || base;
  }

  const taps = instrument.notes.filter(({ pitch }) => pitch === 104);
  const forced = instrument.notes.filter(({ pitch }) => pitch === base + 6);
  const hopos = instrument.notes.filter(({ pitch }) => pitch === base + 5);
  const contains = (markers, tick) =>
    markers.some((marker) => tick >= marker.start && tick < marker.end);
  const parsed = instrument.notes
    .filter(({ pitch }) => pitch >= base && pitch <= base + 4)
    .map((note) => ({
      tick: note.start,
      lane: note.pitch - base,
      length:
        note.end - note.start > division / 3
          ? Math.max(0, note.end - note.start)
          : 0,
      modifier: contains(taps, note.start)
        ? "tap"
        : contains(hopos, note.start)
          ? "forced"
          : contains(forced, note.start)
            ? "forced"
            : "normal",
    }))
    .sort((a, b) => a.tick - b.tick || a.lane - b.lane);

  markImplicitHopos(parsed);
  return {
    notes: parsed,
    resolution: division,
    bpm: tempos[0].microseconds ? 60_000_000 / tempos[0].microseconds : 120,
  };
}

function listChartDifficulties(text) {
  const names = new Set();
  for (const match of text.matchAll(
    /^\s*\[(Easy|Medium|Hard|Expert)(?:Single)?\]\s*$/gim,
  )) {
    const name = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
    names.add(`${name}Single`);
  }
  return [...names];
}

function setAvailableDifficulties(difficulties, preferred) {
  const select = q("[data-chart-difficulty]");
  if (!difficulties.length) return;
  select.innerHTML = difficulties
    .map((value) => {
      const label = value.replace("Single", "");
      return `<option value="${value}">${label}</option>`;
    })
    .join("");
  if (difficulties.includes(preferred)) select.value = preferred;
}

function loadImportedDifficulty() {
  if (state.importedChartText) {
    importChart(state.importedChartText);
  } else if (state.importedMidiBuffer) {
    const midi = importMidi(state.importedMidiBuffer);
    q("[data-chart-resolution]").value = String(midi.resolution);
    q("[data-chart-bpm]").value = String(Math.round(midi.bpm * 1000) / 1000);
    state.notes = midi.notes;
    state.selected = [];
    draw();
  }
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
  state.redo = [];
  state.clipboard = [];
  state.audioFile = null;
  state.importedChartText = "";
  state.importedMidiBuffer = null;
  setAvailableDifficulties(
    ["ExpertSingle", "HardSingle", "MediumSingle", "EasySingle"],
    "ExpertSingle",
  );
  setupAudioTracks([]);
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
function playbackLoop() {
  if (player.paused) {
    playbackFrame = 0;
    state.playing = false;
    return;
  }
  state.view = player.currentTime;
  q("[data-chart-time]").textContent = timeLabel(player.currentTime);
  draw();
  playbackFrame = requestAnimationFrame(playbackLoop);
}
function updatePlayButton() {
  const button = q('[data-chart-action="play"]');
  const icon = button.querySelector("i");
  const playing = !player.paused && !player.ended;
  icon.className = playing ? "fa-solid fa-pause" : "fa-solid fa-play";
  button.lastChild.textContent = playing ? "Pause" : "Lecture";
  button.setAttribute("aria-label", playing ? "Mettre en pause" : "Lire");
}

function startPlaybackLoop() {
  state.playing = true;
  updatePlayButton();
  if (!playbackFrame) playbackFrame = requestAnimationFrame(playbackLoop);
}
function playPause() {
  if (player.paused)
    player
      .play()
      .then(() => {
        state.audioTracks.slice(1).forEach(({ element }) => {
          element.currentTime = player.currentTime;
          element.play().catch(() => {});
        });
        startPlaybackLoop();
      })
      .catch(() => message("Importe un fichier audio pour lancer la lecture."));
  else {
    player.pause();
    state.audioTracks.slice(1).forEach(({ element }) => element.pause());
    updatePlayButton();
  }
}
function seekAudioTracks(seconds) {
  state.audioTracks.forEach(({ element }) => {
    if (Number.isFinite(element.duration))
      element.currentTime = Math.min(seconds, element.duration);
  });
}

q('[data-chart-action="new"]').addEventListener("click", () => {
  reset();
  openMetaModal();
});
q('[data-chart-action="export"]').addEventListener("click", exportChart);
q('[data-chart-action="import"]').addEventListener("click", () =>
  q("[data-chart-file]").click(),
);
q('[data-chart-action="import-folder"]').addEventListener("click", () =>
  q("[data-chart-folder]").click(),
);
q("[data-chart-import-folder]").addEventListener("click", () =>
  q("[data-chart-folder]").click(),
);
q("[data-chart-file]").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (
      file.name.toLowerCase().endsWith(".zip") ||
      file.type === "application/zip"
    ) {
      const archive = new Uint8Array(await file.arrayBuffer());
      const files = await new Promise((resolve, reject) => {
        unzip(archive, (error, entries) =>
          error ? reject(error) : resolve(entries),
        );
      });
      const paths = Object.keys(files);
      const chartPath = paths.find((path) =>
        /(^|\/)(notes\.(chart)|[^/]+\.chart)$/i.test(path),
      );
      if (!chartPath) throw new Error("Archive sans fichier .chart.");
      const chartText = new TextDecoder().decode(files[chartPath]);
      importChart(chartText);
      const iniPath = paths.find((path) => /(^|\/)(song\.ini)$/i.test(path));
      if (iniPath) applyIni(parseIni(new TextDecoder().decode(files[iniPath])));
      const audioFiles = paths
        .filter((path) => /\.(aac|flac|m4a|mp3|ogg|opus|wav)$/i.test(path))
        .map((path) => new File([files[path]], path.split("/").pop()));
      if (audioFiles.length) {
        setupAudioTracks(audioFiles);
        saveAudioCache();
      }
      const difficulties = listChartDifficulties(chartText);
      setAvailableDifficulties(
        difficulties,
        q("[data-chart-difficulty]").value,
      );
      state.importedChartText = chartText;
      state.importedMidiBuffer = null;
    } else if (/\.(mid|midi)$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      state.importedMidiBuffer = buffer.slice(0);
      state.importedChartText = "";
      setAvailableDifficulties(
        ["ExpertSingle", "HardSingle", "MediumSingle", "EasySingle"],
        q("[data-chart-difficulty]").value,
      );
      const midi = importMidi(buffer);
      q("[data-chart-resolution]").value = String(midi.resolution);
      q("[data-chart-bpm]").value = String(Math.round(midi.bpm * 1000) / 1000);
      state.notes = midi.notes;
      state.selected = [];
      state.dirty = false;
      saveLocal();
      draw();
      message(`${midi.notes.length} notes MIDI importées`);
    } else {
      const text = await file.text();
      state.importedChartText = text;
      state.importedMidiBuffer = null;
      const difficulties = listChartDifficulties(text);
      setAvailableDifficulties(
        difficulties,
        q("[data-chart-difficulty]").value,
      );
      importChart(text);
    }
    openMetaModal();
  } catch (error) {
    message(error.message);
  }
  event.target.value = "";
});
q("[data-chart-folder]").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  try {
    const chartFiles = files.filter((file) =>
      /\.(chart|mid|midi)$/i.test(file.name),
    );
    const namedCharts = chartFiles.filter((file) =>
      /^notes\.(chart|mid|midi)$/i.test(file.name),
    );
    const candidates = namedCharts.length ? namedCharts : chartFiles;
    if (!candidates.length)
      throw new Error(
        "Le dossier ne contient aucun fichier notes.chart ou notes.mid.",
      );
    const relative = (file) => file.webkitRelativePath || file.name;
    const directory = (file) =>
      relative(file).includes("/")
        ? relative(file).slice(0, relative(file).lastIndexOf("/"))
        : "";
    const chartDirectories = new Set(candidates.map(directory));
    if (chartDirectories.size !== 1)
      throw new Error("Choisissez le dossier d’une seule chart.");
    const chartFile =
      candidates.find((file) => /\.chart$/i.test(file.name)) || candidates[0];
    const chartDirectory = directory(chartFile);
    const siblings = files.filter((file) => directory(file) === chartDirectory);

    if (/\.chart$/i.test(chartFile.name)) {
      const text = await chartFile.text();
      state.importedChartText = text;
      state.importedMidiBuffer = null;
      const difficulties = listChartDifficulties(text);
      setAvailableDifficulties(
        difficulties,
        q("[data-chart-difficulty]").value,
      );
      importChart(text);
    } else {
      const buffer = await chartFile.arrayBuffer();
      state.importedMidiBuffer = buffer.slice(0);
      state.importedChartText = "";
      setAvailableDifficulties(
        ["ExpertSingle", "HardSingle", "MediumSingle", "EasySingle"],
        q("[data-chart-difficulty]").value,
      );
      const midi = importMidi(buffer);
      q("[data-chart-resolution]").value = String(midi.resolution);
      q("[data-chart-bpm]").value = String(Math.round(midi.bpm * 1000) / 1000);
      state.notes = midi.notes;
      state.selected = [];
      state.dirty = false;
      draw();
      message(`${midi.notes.length} notes MIDI importées`);
    }

    const iniFile = siblings.find((file) =>
      /(^|\/)song\.ini$/i.test(relative(file)),
    );
    if (iniFile) applyIni(parseIni(await iniFile.text()));
    const audioFiles = siblings.filter((file) =>
      audioExtensions.has(extension(file.name)),
    );
    setupAudioTracks(audioFiles);
    markDirty();
    saveAudioCache();
    openMetaModal();
  } catch (error) {
    message(error.message);
  }
  event.target.value = "";
});
q("[data-chart-audio]").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  setupAudioTracks([file]);
  markDirty();
  saveAudioCache();
});
q('[data-chart-action="play"]').addEventListener("click", playPause);
q('[data-chart-action="stop"]').addEventListener("click", () => {
  player.pause();
  state.audioTracks.slice(1).forEach(({ element }) => element.pause());
  if (playbackFrame) cancelAnimationFrame(playbackFrame);
  playbackFrame = 0;
  player.currentTime = 0;
  seekAudioTracks(0);
  state.view = 0;
  q("[data-chart-time]").textContent = timeLabel(0);
  updatePlayButton();
  draw();
});
q('[data-chart-action="undo"]').addEventListener("click", () => {
  const last = state.undo.pop();
  if (!last) return;
  state.redo.push(JSON.stringify(state.notes));
  state.notes = JSON.parse(last);
  state.selected = [];
  markDirty();
  draw();
});
q('[data-chart-action="redo"]').addEventListener("click", () => {
  const next = state.redo.pop();
  if (!next) return;
  state.undo.push(JSON.stringify(state.notes));
  state.notes = JSON.parse(next);
  state.selected = [];
  markDirty();
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
q("[data-chart-difficulty]").addEventListener("change", () => {
  markDirty();
  loadImportedDifficulty();
});

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
q("[data-chart-tick-jump]").addEventListener("change", (event) =>
  jumpToTick(event.target.value),
);
q("[data-chart-tick-jump]").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    jumpToTick(event.target.value);
  }
});

timeline.addEventListener("input", (event) => {
  const seconds = (Number(event.target.value) / 1000) * chartDuration();
  state.view = seconds;
  if (Number.isFinite(player.duration))
    player.currentTime = Math.min(seconds, player.duration);
  seekAudioTracks(seconds);
  q("[data-chart-time]").textContent = timeLabel(seconds);
  draw();
});
player.addEventListener("play", () => {
  updatePlayButton();
  startPlaybackLoop();
});
player.addEventListener("pause", () => {
  updatePlayButton();
  if (playbackFrame) cancelAnimationFrame(playbackFrame);
  playbackFrame = 0;
  state.playing = false;
  state.view = player.currentTime;
  q("[data-chart-time]").textContent = timeLabel(player.currentTime);
  draw();
});
player.addEventListener("timeupdate", () => {
  q("[data-chart-time]").textContent = timeLabel(player.currentTime);
});
player.addEventListener("ended", () => {
  updatePlayButton();
  if (playbackFrame) cancelAnimationFrame(playbackFrame);
  playbackFrame = 0;
  state.playing = false;
  state.view = player.duration || 0;
  draw();
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
  const rect = canvas.getBoundingClientRect();
  const note = hitNote(event);
  if (event.button === 2) {
    if (note) {
      state.selected = [note];
      sustain = { note, tick: note.tick };
      saveUndo();
      markDirty();
    } else {
      state.selectionBox = {
        startX: event.clientX - rect.left,
        startY: event.clientY - rect.top,
        endX: event.clientX - rect.left,
        endY: event.clientY - rect.top,
        additive: event.ctrlKey || event.metaKey || event.shiftKey,
        initial: [...state.selected],
      };
    }
    canvas.setPointerCapture(event.pointerId);
    draw();
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
  if (state.selectionBox) {
    const rect = canvas.getBoundingClientRect();
    state.selectionBox.endX = event.clientX - rect.left;
    state.selectionBox.endY = event.clientY - rect.top;

    const board = dimensions();
    const left = Math.min(state.selectionBox.startX, state.selectionBox.endX);
    const right = Math.max(state.selectionBox.startX, state.selectionBox.endX);
    const top = Math.min(state.selectionBox.startY, state.selectionBox.endY);
    const bottom = Math.max(state.selectionBox.startY, state.selectionBox.endY);
    const inside = state.notes.filter((item) => {
      const lane = noteLane(item);
      const x = board.left + lane * board.laneWidth + board.laneWidth / 2;
      const y = yAt(item.tick, board);
      return x >= left && x <= right && y >= top && y <= bottom;
    });
    state.selected = state.selectionBox.additive
      ? [...new Set([...state.selectionBox.initial, ...inside])]
      : inside;
    draw();
    return;
  }
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
  state.selectionBox = null;
  draw();
});
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    state.view = Math.max(
      0,
      Math.min(chartDuration(), state.view - event.deltaY / (150 * state.zoom)),
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
    q('[data-chart-action="undo"]').click();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    q('[data-chart-action="redo"]').click();
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
