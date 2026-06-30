import { copyToClipboard, setStatus, temporarilyChangeText } from "../utils.js";

const svg = document.querySelector("[data-clip-editor]");
const polygon = document.querySelector("[data-clip-polygon]");
const handles = document.querySelector("[data-clip-points]");
const preview = document.querySelector("[data-clip-preview]");
const presetSelect = document.querySelector("[data-clip-preset]");
const roundInput = document.querySelector("[data-clip-round]");
const colorInput = document.querySelector("[data-clip-color]");
const output = document.querySelector("[data-clip-output]");
const status = document.querySelector("[data-clip-status]");
const copyButton = document.querySelector("[data-clip-copy]");
const resetButton = document.querySelector("[data-clip-reset]");
const addButton = document.querySelector("[data-clip-add-point]");
const removeButton = document.querySelector("[data-clip-remove-point]");

const MIN_POINTS = 3;
let points = [];
let activeDrag = null;

const presets = {
  triangle: [[50, 0], [100, 100], [0, 100]],
  diamond: [[50, 0], [100, 50], [50, 100], [0, 50]],
  pentagon: [[50, 0], [100, 38], [82, 100], [18, 100], [0, 38]],
  hexagon: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]],
  octagon: [[30, 0], [70, 0], [100, 30], [100, 70], [70, 100], [30, 100], [0, 70], [0, 30]],
  star: [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]],
  arrow: [[0, 35], [60, 35], [60, 10], [100, 50], [60, 90], [60, 65], [0, 65]],
  chevron: [[0, 0], [70, 0], [100, 50], [70, 100], [0, 100], [30, 50]],
  parallelogram: [[20, 0], [100, 0], [80, 100], [0, 100]],
  trapezoid: [[20, 0], [80, 0], [100, 100], [0, 100]],
};

function setClipStatus(message, type = "default") {
  setStatus(status, message, type);
}

function clonePreset(name) {
  return presets[name].map(([x, y]) => ({ x, y }));
}

function clonePoints(sourcePoints = points) {
  return sourcePoints.map((point) => ({ ...point }));
}

function clamp(value) {
  return Math.min(Math.max(value, 0), 100);
}

function clampMove(delta, min, max) {
  return Math.min(Math.max(delta, -min), 100 - max);
}

function getPointsBounds(sourcePoints = points) {
  const xValues = sourcePoints.map((point) => point.x);
  const yValues = sourcePoints.map((point) => point.y);

  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
    minY: Math.min(...yValues),
    maxY: Math.max(...yValues),
  };
}

function formatCoord(value) {
  const precision = Number(roundInput.value) || 0;
  return Number(value.toFixed(precision)).toString();
}

function getClipPath() {
  return `polygon(${points.map((point) => `${formatCoord(point.x)}% ${formatCoord(point.y)}%`).join(", ")})`;
}

function getCss() {
  return `.element {\n  clip-path: ${getClipPath()};\n}`;
}

function startDrag(event, dragData) {
  event.preventDefault();
  event.stopPropagation();

  activeDrag = {
    pointerId: event.pointerId,
    ...dragData,
  };

  svg.setPointerCapture?.(event.pointerId);
}

function stopDrag() {
  if (!activeDrag) return;

  if (svg.hasPointerCapture?.(activeDrag.pointerId)) {
    svg.releasePointerCapture(activeDrag.pointerId);
  }

  activeDrag = null;
}

function drawHandles() {
  handles.innerHTML = "";

  points.forEach((point, index) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");

    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", "2.8");
    circle.classList.add("clip-point");
    circle.dataset.index = index;

    circle.addEventListener("pointerdown", (event) => {
      startDrag(event, {
        type: "point",
        index,
      });
    });

    circle.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      removePoint(index);
    });

    handles.appendChild(circle);
  });
}

function updateTool() {
  const clipPath = getClipPath();

  polygon.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
  preview.style.clipPath = clipPath;
  preview.style.background = colorInput.value;
  output.value = getCss();
  drawHandles();
}

function eventToPoint(event) {
  const box = svg.getBoundingClientRect();

  return {
    x: clamp(((event.clientX - box.left) / box.width) * 100),
    y: clamp(((event.clientY - box.top) / box.height) * 100),
  };
}

function addPoint(point = { x: 50, y: 50 }) {
  points.push(point);
  presetSelect.value = "custom";
  updateTool();
  setClipStatus("Point ajouté.", "success");
}

function removePoint(index = points.length - 1) {
  if (points.length <= MIN_POINTS) {
    setClipStatus("Un polygon doit garder au moins 3 points.", "warning");
    return;
  }

  points.splice(index, 1);
  presetSelect.value = "custom";
  updateTool();
  setClipStatus("Point supprimé.", "success");
}

function loadPreset(name) {
  if (!presets[name]) return;

  points = clonePreset(name);
  updateTool();
  setClipStatus("Preset appliqué.", "success");
}

function resetTool() {
  presetSelect.value = "hexagon";
  roundInput.value = "0";
  colorInput.value = "#ff7a00";
  points = clonePreset("hexagon");
  updateTool();
  setClipStatus("Générateur réinitialisé.", "success");
}

function movePointDrag(event) {
  points[activeDrag.index] = eventToPoint(event);
}

function movePolygonDrag(event) {
  const currentPoint = eventToPoint(event);
  const rawDx = currentPoint.x - activeDrag.startPoint.x;
  const rawDy = currentPoint.y - activeDrag.startPoint.y;
  const dx = clampMove(rawDx, activeDrag.bounds.minX, activeDrag.bounds.maxX);
  const dy = clampMove(rawDy, activeDrag.bounds.minY, activeDrag.bounds.maxY);

  points = activeDrag.startPoints.map((point) => ({
    x: point.x + dx,
    y: point.y + dy,
  }));
}

function handlePointerMove(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;

  if (activeDrag.type === "point") {
    movePointDrag(event);
  } else if (activeDrag.type === "polygon") {
    movePolygonDrag(event);
  }

  presetSelect.value = "custom";
  updateTool();
}

function setupClipPathGenerator() {
  if (!svg || !polygon || !handles || !preview || !output) return;

  points = clonePreset("hexagon");
  updateTool();

  presetSelect?.addEventListener("change", () => {
    if (presetSelect.value !== "custom") loadPreset(presetSelect.value);
  });

  roundInput?.addEventListener("input", updateTool);
  colorInput?.addEventListener("input", updateTool);
  resetButton?.addEventListener("click", resetTool);
  addButton?.addEventListener("click", () => addPoint());
  removeButton?.addEventListener("click", () => removePoint());

  copyButton?.addEventListener("click", async () => {
    if (!output.value.trim()) {
      setClipStatus("Aucun CSS à copier.", "warning");
      return;
    }

    await copyToClipboard(output.value);
    temporarilyChangeText(copyButton, "Copié");
    setClipStatus("CSS copié dans le presse-papiers.", "success");
  });

  polygon.addEventListener("pointerdown", (event) => {
    startDrag(event, {
      type: "polygon",
      startPoint: eventToPoint(event),
      startPoints: clonePoints(),
      bounds: getPointsBounds(),
    });
  });

  svg.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".clip-point") || event.target === polygon) return;
    addPoint(eventToPoint(event));
  });

  svg.addEventListener("pointermove", handlePointerMove);
  svg.addEventListener("pointerup", stopDrag);
  svg.addEventListener("pointercancel", stopDrag);
  window.addEventListener("pointerup", stopDrag);
}

setupClipPathGenerator();