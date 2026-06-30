import { downloadTextFile, setStatus } from "../utils.js";

const titleInput = document.querySelector("[data-ce-title]");
const artistInput = document.querySelector("[data-ce-artist]");
const charterInput = document.querySelector("[data-ce-charter]");
const bpmInput = document.querySelector("[data-ce-bpm]");
const resolutionInput = document.querySelector("[data-ce-resolution]");
const difficultySelect = document.querySelector("[data-ce-difficulty]");
const audioInput = document.querySelector("[data-ce-audio]");
const audioName = document.querySelector("[data-ce-audio-name]");
const player = document.querySelector("[data-ce-player]");
const playButton = document.querySelector("[data-ce-play]");
const stopButton = document.querySelector("[data-ce-stop]");
const undoButton = document.querySelector("[data-ce-undo]");
const clearButton = document.querySelector("[data-ce-clear]");
const exportButton = document.querySelector("[data-ce-export]");
const snapSelect = document.querySelector("[data-ce-snap]");
const modifierSelect = document.querySelector("[data-ce-modifier]");
const zoomInput = document.querySelector("[data-ce-zoom]");
const timelineWrap = document.querySelector("[data-ce-timeline-wrap]");
const canvas = document.querySelector("[data-ce-canvas]");
const statusElement = document.querySelector("[data-ce-status]");
const noteCount = document.querySelector("[data-ce-note-count]");
const timeElement = document.querySelector("[data-ce-time]");
const noteButtons = document.querySelectorAll("[data-ce-note]");

const ctx = canvas?.getContext("2d");
const HIGHWAY = {
  width: 760,
  height: 720,
  top: 54,
  bottom: 650,
  laneStart: 160,
  laneWidth: 82,
  noteRadius: 15,
};
const LANES = [
  { id: 0, label: "G", name: "Vert", color: "#39d353" },
  { id: 1, label: "R", name: "Rouge", color: "#ff5d5d" },
  { id: 2, label: "Y", name: "Jaune", color: "#ffd45a" },
  { id: 3, label: "B", name: "Bleu", color: "#58a6ff" },
  { id: 4, label: "O", name: "Orange", color: "#ff9b3d" },
  { id: 5, label: "SP", name: "Star Power", color: "#9b7bff" },
];
const MODIFIER_LABELS = {
  normal: "",
  "force-hopo": "HOPO",
  "force-strum": "STRUM",
  tap: "TAP",
};

const state = {
  notes: [],
  undoStack: [],
  selectedId: null,
  selectedNote: 0,
  pixelsPerSecond: 130,
  audioUrl: "",
  animationFrame: null,
};

function getBpm() {
  return Math.max(30, Math.min(300, Number(bpmInput?.value) || 120));
}

function getResolution() {
  return Math.max(96, Math.min(960, Number(resolutionInput?.value) || 192));
}

function getDuration() {
  return Math.max(player?.duration || 0, 30);
}

function getCurrentTime() {
  return player?.currentTime || 0;
}

function getSnapSeconds() {
  const snap = Number(snapSelect?.value) || 16;
  return (60 / getBpm()) * (4 / snap);
}

function secondsToTick(seconds) {
  return Math.round(seconds * (getBpm() / 60) * getResolution());
}

function tickToSeconds(tick) {
  return tick / getResolution() / (getBpm() / 60);
}

function secondsToY(seconds) {
  return HIGHWAY.bottom - (seconds - getCurrentTime()) * state.pixelsPerSecond;
}

function yToSeconds(y) {
  return Math.max(0, getCurrentTime() + (HIGHWAY.bottom - y) / state.pixelsPerSecond);
}

function getLaneX(noteType) {
  return HIGHWAY.laneStart + noteType * HIGHWAY.laneWidth + HIGHWAY.laneWidth / 2;
}

function getLaneFromX(x) {
  const lane = Math.floor((x - HIGHWAY.laneStart) / HIGHWAY.laneWidth);
  return Math.max(0, Math.min(4, lane));
}

function formatTime(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds - minutes * 60;
  return `${minutes}:${remaining.toFixed(3).padStart(6, "0")}`;
}

function setCeStatus(message, type = "default") {
  setStatus(statusElement, message, type);
}

function getModifier() {
  return modifierSelect?.value || "normal";
}

function saveUndo() {
  state.undoStack.push(JSON.stringify(state.notes));
  if (state.undoStack.length > 80) state.undoStack.shift();
}

function updateStats() {
  if (noteCount) noteCount.textContent = String(state.notes.length);
  if (timeElement) timeElement.textContent = formatTime(getCurrentTime());
}

function resizeCanvas() {
  if (!canvas) return;

  canvas.width = HIGHWAY.width;
  canvas.height = HIGHWAY.height;
}

function getNoteAt(x, y) {
  return [...state.notes]
    .reverse()
    .find((note) => {
      const isStarPower = note.type === 5;
      const noteX = isStarPower ? HIGHWAY.laneStart + HIGHWAY.laneWidth * 5 + 52 : getLaneX(note.type);
      const noteY = secondsToY(tickToSeconds(note.tick));
      return Math.abs(noteX - x) <= 20 && Math.abs(noteY - y) <= 20;
    });
}

function drawBackground() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, HIGHWAY.top, 0, HIGHWAY.bottom);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.02)");
  gradient.addColorStop(0.7, "rgba(255, 122, 0, 0.08)");
  gradient.addColorStop(1, "rgba(255, 122, 0, 0.18)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawHighwayFrame() {
  if (!ctx || !canvas) return;

  const laneTotalWidth = HIGHWAY.laneWidth * 5;
  const left = HIGHWAY.laneStart;
  const right = left + laneTotalWidth;

  ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
  ctx.fillRect(left, HIGHWAY.top, laneTotalWidth, HIGHWAY.bottom - HIGHWAY.top + 28);

  for (let laneIndex = 0; laneIndex <= 5; laneIndex += 1) {
    const x = left + laneIndex * HIGHWAY.laneWidth;
    ctx.strokeStyle = laneIndex === 0 || laneIndex === 5 ? "rgba(255, 122, 0, 0.28)" : "rgba(255, 255, 255, 0.11)";
    ctx.lineWidth = laneIndex === 0 || laneIndex === 5 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, HIGHWAY.top);
    ctx.lineTo(x, HIGHWAY.bottom + 28);
    ctx.stroke();
  }

  LANES.slice(0, 5).forEach((lane) => {
    const x = getLaneX(lane.id);
    ctx.fillStyle = lane.color;
    ctx.font = "bold 18px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText(lane.label, x, 30);
  });

  ctx.textAlign = "start";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(left, HIGHWAY.top, laneTotalWidth, HIGHWAY.bottom - HIGHWAY.top + 28);

  ctx.fillStyle = "rgba(255, 122, 0, 0.15)";
  ctx.fillRect(left, HIGHWAY.bottom, laneTotalWidth, 7);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left - 16, HIGHWAY.bottom);
  ctx.lineTo(right + 16, HIGHWAY.bottom);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
  ctx.font = "bold 12px Consolas, monospace";
  ctx.fillText("HIT LINE", right + 16, HIGHWAY.bottom + 1);

  ctx.fillStyle = "rgba(155, 123, 255, 0.18)";
  ctx.fillRect(right + 28, HIGHWAY.top, 48, HIGHWAY.bottom - HIGHWAY.top + 28);
  ctx.fillStyle = "#9b7bff";
  ctx.font = "bold 13px Consolas, monospace";
  ctx.fillText("SP", right + 42, 30);
}

function drawGrid() {
  if (!ctx || !canvas) return;

  const currentTime = getCurrentTime();
  const visibleBefore = (HIGHWAY.height - HIGHWAY.bottom) / state.pixelsPerSecond;
  const visibleAfter = (HIGHWAY.bottom - HIGHWAY.top) / state.pixelsPerSecond;
  const startTime = Math.max(0, currentTime - visibleBefore - 1);
  const endTime = Math.min(getDuration() + 2, currentTime + visibleAfter + 1);
  const beatSeconds = 60 / getBpm();
  const snapSeconds = getSnapSeconds();
  const firstSnap = Math.floor(startTime / snapSeconds) * snapSeconds;
  const left = HIGHWAY.laneStart;
  const right = HIGHWAY.laneStart + HIGHWAY.laneWidth * 5;

  ctx.font = "12px Consolas, monospace";
  ctx.textBaseline = "middle";

  for (let seconds = firstSnap; seconds <= endTime; seconds += snapSeconds) {
    if (seconds < 0) continue;

    const y = Math.round(secondsToY(seconds));
    const isBeat = Math.abs((seconds / beatSeconds) - Math.round(seconds / beatSeconds)) < 0.001;

    ctx.strokeStyle = isBeat ? "rgba(255, 122, 0, 0.36)" : "rgba(255, 255, 255, 0.07)";
    ctx.lineWidth = isBeat ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    if (isBeat) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
      ctx.fillText(formatTime(seconds), 34, y);
    }
  }
}

function drawNoteModifier(note, x, y) {
  const label = MODIFIER_LABELS[note.modifier || "normal"];
  if (!label) return;

  ctx.fillStyle = note.modifier === "tap" ? "#9b7bff" : "#ffffff";
  ctx.font = "bold 10px Consolas, monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 28);
  ctx.textAlign = "start";
}

function drawNotes() {
  if (!ctx) return;

  state.notes.forEach((note) => {
    const y = secondsToY(tickToSeconds(note.tick));
    if (y < HIGHWAY.top - 60 || y > HIGHWAY.height + 60) return;

    const lane = LANES[note.type] || LANES[0];
    const isStarPower = note.type === 5;
    const x = isStarPower ? HIGHWAY.laneStart + HIGHWAY.laneWidth * 5 + 52 : getLaneX(note.type);
    const isSelected = note.id === state.selectedId;

    if (note.length > 0 && !isStarPower) {
      const sustainHeight = Math.max(4, tickToSeconds(note.length) * state.pixelsPerSecond);
      ctx.strokeStyle = lane.color;
      ctx.lineWidth = 8;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - sustainHeight);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(x, y, isStarPower ? 13 : HIGHWAY.noteRadius, 0, Math.PI * 2);
    ctx.fillStyle = note.modifier === "tap" ? "#9b7bff" : lane.color;
    ctx.fill();
    ctx.lineWidth = isSelected ? 4 : note.modifier === "force-hopo" ? 3 : 2;
    ctx.strokeStyle = isSelected ? "#fff" : note.modifier === "force-strum" ? "#ffcc66" : "rgba(0, 0, 0, 0.72)";
    ctx.stroke();

    if (isStarPower) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillText("SP", x, y + 1);
      ctx.textAlign = "start";
    } else {
      drawNoteModifier(note, x, y);
    }
  });
}

function drawPlayhead() {
  if (!ctx || !canvas) return;
  const left = HIGHWAY.laneStart - 24;
  const right = HIGHWAY.laneStart + HIGHWAY.laneWidth * 5 + 24;

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left, HIGHWAY.bottom);
  ctx.lineTo(right, HIGHWAY.bottom);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(left - 12, HIGHWAY.bottom);
  ctx.lineTo(left, HIGHWAY.bottom - 8);
  ctx.lineTo(left, HIGHWAY.bottom + 8);
  ctx.closePath();
  ctx.fill();
}

function render() {
  resizeCanvas();
  drawBackground();
  drawHighwayFrame();
  drawGrid();
  drawNotes();
  drawPlayhead();
  updateStats();
}

function renderLoop() {
  render();
  state.animationFrame = requestAnimationFrame(renderLoop);
}

function startLoop() {
  if (state.animationFrame) return;
  renderLoop();
}

function stopLoop() {
  if (!state.animationFrame) return;
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = null;
}

function setSelectedNote(noteType) {
  state.selectedNote = Number(noteType);
  noteButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.ceNote) === state.selectedNote);
  });
}

function addNoteAt(seconds, forcedLane = null) {
  const snapSeconds = getSnapSeconds();
  const snappedSeconds = Math.max(0, Math.round(seconds / snapSeconds) * snapSeconds);
  const tick = secondsToTick(snappedSeconds);
  const type = state.selectedNote === 5 ? 5 : forcedLane ?? state.selectedNote;
  const modifier = type === 5 ? "normal" : getModifier();
  const existing = state.notes.find((note) => note.tick === tick && note.type === type);

  saveUndo();

  if (existing) {
    state.notes = state.notes.filter((note) => note.id !== existing.id);
    state.selectedId = null;
    setCeStatus("Note supprimée.");
  } else {
    const note = {
      id: crypto.randomUUID(),
      tick,
      type,
      modifier,
      length: 0,
    };
    state.notes.push(note);
    state.notes.sort((a, b) => a.tick - b.tick || a.type - b.type);
    state.selectedId = note.id;
    setCeStatus(`${LANES[type]?.name || "Note"} ajoutée${modifier !== "normal" ? ` (${MODIFIER_LABELS[modifier]})` : ""}.`, "success");
  }

  render();
}

function deleteSelectedNote() {
  if (!state.selectedId) return;
  saveUndo();
  state.notes = state.notes.filter((note) => note.id !== state.selectedId);
  state.selectedId = null;
  setCeStatus("Note supprimée.");
  render();
}

function undo() {
  const previous = state.undoStack.pop();
  if (!previous) return;
  state.notes = JSON.parse(previous);
  state.selectedId = null;
  setCeStatus("Undo effectué.");
  render();
}

function clearNotes() {
  if (!state.notes.length) return;
  saveUndo();
  state.notes = [];
  state.selectedId = null;
  setCeStatus("Toutes les notes ont été supprimées.");
  render();
}

function getAudioStreamName() {
  const file = audioInput?.files?.[0];
  return file?.name || "song.ogg";
}

function escapeChartString(value = "") {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', "'");
}

function buildChart() {
  const resolution = getResolution();
  const bpmValue = Math.round(getBpm() * 1000);
  const difficulty = difficultySelect?.value || "ExpertSingle";
  const regularNotes = state.notes.filter((note) => note.type < 5);
  const spNotes = state.notes.filter((note) => note.type === 5);
  const lastTick = Math.max(0, ...state.notes.map((note) => note.tick));
  const endTick = Math.max(lastTick + resolution * 4, secondsToTick(getDuration()));

  const lines = [
    "[Song]",
    "{",
    `  Name = \"${escapeChartString(titleInput?.value || "SoraTools Chart")}\"`,
    `  Artist = \"${escapeChartString(artistInput?.value || "Unknown Artist")}\"`,
    `  Charter = \"${escapeChartString(charterInput?.value || "SoraTools")}\"`,
    "  Offset = 0",
    `  Resolution = ${resolution}`,
    "  Player2 = bass",
    "  Difficulty = 0",
    "  PreviewStart = 0",
    "  PreviewEnd = 0",
    "  Genre = \"rock\"",
    "  MediaType = \"cd\"",
    `  MusicStream = \"${escapeChartString(getAudioStreamName())}\"`,
    "}",
    "[SyncTrack]",
    "{",
    "  0 = TS 4",
    `  0 = B ${bpmValue}`,
    "}",
    "[Events]",
    "{",
    "  0 = E \"section Intro\"",
    `  ${endTick} = E \"end\"`,
    "}",
    `[${difficulty}]`,
    "{",
  ];

  regularNotes.forEach((note) => {
    lines.push(`  ${note.tick} = N ${note.type} ${note.length || 0}`);
    if (["force-hopo", "force-strum"].includes(note.modifier)) {
      lines.push(`  ${note.tick} = N 5 0`);
    }
    if (note.modifier === "tap") {
      lines.push(`  ${note.tick} = N 6 0`);
    }
  });

  spNotes.forEach((note) => {
    lines.push(`  ${note.tick} = S 2 ${Math.max(resolution, note.length || resolution * 2)}`);
  });

  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function exportChart() {
  const chart = buildChart();
  const filename = `${(titleInput?.value || "sorastools-chart")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sorastools-chart"}.chart`;

  downloadTextFile(chart, filename, "text/plain");
  setCeStatus("Fichier .chart exporté.", "success");
}

function setupAudio() {
  const file = audioInput?.files?.[0];
  if (!file || !player) return;

  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(file);
  player.src = state.audioUrl;
  if (audioName) audioName.textContent = file.name;
  setCeStatus("Audio chargé.", "success");
}

function setupCanvasClick(event) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const clickedNote = getNoteAt(x, y);

  if (clickedNote) {
    state.selectedId = clickedNote.id;
    setSelectedNote(clickedNote.type);
    if (modifierSelect && clickedNote.modifier) modifierSelect.value = clickedNote.modifier;
    setCeStatus("Note sélectionnée.");
    render();
    return;
  }

  const isInsideLane = x >= HIGHWAY.laneStart && x <= HIGHWAY.laneStart + HIGHWAY.laneWidth * 5;
  const isStarPowerColumn = x > HIGHWAY.laneStart + HIGHWAY.laneWidth * 5;
  const isFutureArea = y <= HIGHWAY.bottom + 20;

  if ((!isInsideLane && !isStarPowerColumn) || !isFutureArea) return;

  const lane = isStarPowerColumn ? 5 : getLaneFromX(x);
  if (lane === 5) setSelectedNote(5);
  addNoteAt(yToSeconds(y), lane);
}

function setupKeyboard(event) {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;

  if (/^[1-5]$/.test(event.key)) {
    setSelectedNote(Number(event.key) - 1);
    event.preventDefault();
  }

  if (event.key.toLowerCase() === "s") {
    setSelectedNote(5);
    event.preventDefault();
  }

  if (event.key.toLowerCase() === "h" && modifierSelect) {
    modifierSelect.value = modifierSelect.value === "force-hopo" ? "normal" : "force-hopo";
    setCeStatus(`Modifier : ${modifierSelect.options[modifierSelect.selectedIndex].textContent}.`);
    event.preventDefault();
  }

  if (event.key.toLowerCase() === "t" && modifierSelect) {
    modifierSelect.value = modifierSelect.value === "tap" ? "normal" : "tap";
    setCeStatus(`Modifier : ${modifierSelect.options[modifierSelect.selectedIndex].textContent}.`);
    event.preventDefault();
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelectedNote();
    event.preventDefault();
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    undo();
    event.preventDefault();
  }

  if (event.code === "Space") {
    player?.paused ? player?.play() : player?.pause();
    event.preventDefault();
  }
}

if (canvas && ctx) {
  audioInput?.addEventListener("change", setupAudio);
  canvas.addEventListener("click", setupCanvasClick);
  noteButtons.forEach((button) => button.addEventListener("click", () => setSelectedNote(button.dataset.ceNote)));
  playButton?.addEventListener("click", () => (player?.paused ? player.play() : player.pause()));
  stopButton?.addEventListener("click", () => {
    if (!player) return;
    player.pause();
    player.currentTime = 0;
    render();
  });
  undoButton?.addEventListener("click", undo);
  clearButton?.addEventListener("click", clearNotes);
  exportButton?.addEventListener("click", exportChart);
  zoomInput?.addEventListener("input", () => {
    state.pixelsPerSecond = Number(zoomInput.value) || 130;
    render();
  });
  [bpmInput, resolutionInput, snapSelect, modifierSelect].forEach((input) => input?.addEventListener("input", render));
  player?.addEventListener("play", startLoop);
  player?.addEventListener("pause", () => {
    stopLoop();
    render();
  });
  player?.addEventListener("timeupdate", render);
  player?.addEventListener("loadedmetadata", render);
  document.addEventListener("keydown", setupKeyboard);

  if (timelineWrap) timelineWrap.scrollTop = 0;
  render();
}
