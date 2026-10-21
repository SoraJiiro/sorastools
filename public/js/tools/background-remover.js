import { clampNumber } from "../utils.js";

const fileInput = document.querySelector("[data-background-file]");
const colorInput = document.querySelector("[data-background-color]");
const toleranceInput = document.querySelector("[data-background-tolerance]");
const toleranceValue = document.querySelector("[data-tolerance-value]");
const zoneToleranceInput = document.querySelector("[data-zone-tolerance]");
const zoneToleranceValue = document.querySelector(
  "[data-zone-tolerance-value]",
);
const colorToleranceControl = document.querySelector(
  "[data-color-tolerance-control]",
);
const zoneToleranceControl = document.querySelector(
  "[data-zone-tolerance-control]",
);
const zoomInput = document.querySelector("[data-background-zoom]");
const zoomValue = document.querySelector("[data-background-zoom-value]");
const canvas = document.querySelector("[data-background-canvas]");
const emptyMessage = document.querySelector("[data-background-empty]");
const status = document.querySelector("[data-background-status]");
const download = document.querySelector("[data-background-download]");
const modeButtons = document.querySelectorAll("[data-background-mode]");
const undoButton = document.querySelector("[data-background-undo]");
const redoButton = document.querySelector("[data-background-redo]");
const context = canvas?.getContext("2d", { willReadFrequently: true });
const MAX_HISTORY = 10;

let image = null;
let sourcePixels = null;
let removedPixels = null;
let mode = "color";
let colorRemovalActive = true;
let undoStack = [];
let redoStack = [];
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let dragPoint = null;
let didDrag = false;
let pinchDistance = null;
const touchPoints = new Map();

function setStatus(message, type = "") {
  status.textContent = message;
  status.dataset.type = type;
}

function isNearColor(pixel, red, green, blue, tolerance) {
  const offset = pixel * 4;
  return (
    (Math.abs(sourcePixels.data[offset] - red) +
      Math.abs(sourcePixels.data[offset + 1] - green) +
      Math.abs(sourcePixels.data[offset + 2] - blue)) /
      3 <=
    tolerance
  );
}

function renderImage() {
  if (!sourcePixels || !context) return;

  const removeByColor = mode === "color" && colorRemovalActive;
  const [red, green, blue] = colorInput.value
    .match(/[\da-f]{2}/gi)
    .map((value) => parseInt(value, 16));
  const tolerance = Number(toleranceInput.value);
  const pixels = new ImageData(
    new Uint8ClampedArray(sourcePixels.data),
    canvas.width,
    canvas.height,
  );

  for (let index = 0; index < pixels.data.length; index += 4) {
    if (removeByColor) {
      const distance =
        (Math.abs(pixels.data[index] - red) +
          Math.abs(pixels.data[index + 1] - green) +
          Math.abs(pixels.data[index + 2] - blue)) /
        3;
      pixels.data[index + 3] = Math.round(
        pixels.data[index + 3] *
          Math.max(0, Math.min(1, (distance - tolerance) / 36)),
      );
    }
    if (mode === "zone" && removedPixels[index / 4]) {
      pixels.data[index + 3] = 0;
    }
  }

  context.putImageData(pixels, 0, 0);
}

function createFullResolutionExport() {
  const output = document.createElement("canvas");
  output.width = image.width;
  output.height = image.height;
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  if (!outputContext) throw new Error("Canvas indisponible");

  outputContext.drawImage(image, 0, 0);
  const [red, green, blue] = colorInput.value
    .match(/[\da-f]{2}/gi)
    .map((value) => parseInt(value, 16));
  const tolerance = Number(toleranceInput.value);
  const removeByColor = mode === "color" && colorRemovalActive;
  const previewScaleX = canvas.width / image.width;
  const previewScaleY = canvas.height / image.height;

  for (let top = 0; top < image.height; top += 128) {
    const height = Math.min(128, image.height - top);
    const pixels = outputContext.getImageData(0, top, image.width, height);
    for (let y = 0; y < height; y++) {
      const previewY = Math.min(
        canvas.height - 1,
        Math.floor((top + y + 0.5) * previewScaleY),
      );
      for (let x = 0; x < image.width; x++) {
        const offset = (y * image.width + x) * 4;
        if (removeByColor) {
          const distance =
            (Math.abs(pixels.data[offset] - red) +
              Math.abs(pixels.data[offset + 1] - green) +
              Math.abs(pixels.data[offset + 2] - blue)) /
            3;
          pixels.data[offset + 3] = Math.round(
            pixels.data[offset + 3] *
              Math.max(0, Math.min(1, (distance - tolerance) / 36)),
          );
        }
        const previewX = Math.min(
          canvas.width - 1,
          Math.floor((x + 0.5) * previewScaleX),
        );
        if (
          mode === "zone" &&
          removedPixels[previewY * canvas.width + previewX]
        ) {
          pixels.data[offset + 3] = 0;
        }
      }
    }
    outputContext.putImageData(pixels, 0, top);
  }

  return output;
}

function renderCanvasTransform() {
  canvas.style.setProperty("--background-zoom", zoom);
  canvas.style.setProperty("--background-offset-x", `${offsetX}px`);
  canvas.style.setProperty("--background-offset-y", `${offsetY}px`);
  zoomValue.textContent = `${zoom.toFixed(1)}×`;
}

function setZoom(nextZoom, clientX, clientY) {
  const bounds = canvas.getBoundingClientRect();
  const next = clampNumber(
    nextZoom,
    Number(zoomInput.min),
    Number(zoomInput.max),
  );
  offsetX += (clientX - bounds.left) * (1 - next / zoom);
  offsetY += (clientY - bounds.top) * (1 - next / zoom);
  zoom = next;
  zoomInput.value = zoom;
  renderCanvasTransform();
}

function moveCanvas(clientX, clientY) {
  if (!dragPoint) return;
  const deltaX = clientX - dragPoint.clientX;
  const deltaY = clientY - dragPoint.clientY;
  if (deltaX || deltaY) {
    offsetX += deltaX;
    offsetY += deltaY;
    didDrag = true;
    renderCanvasTransform();
  }
  dragPoint = { ...dragPoint, clientX, clientY };
}

function updateHistoryButtons() {
  undoButton.disabled = undoStack.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

function removeZone(startX, startY) {
  const width = canvas.width;
  const height = canvas.height;
  const start = startY * width + startX;
  const startOffset = start * 4;
  if (!sourcePixels.data[startOffset + 3]) return;

  const red = sourcePixels.data[startOffset];
  const green = sourcePixels.data[startOffset + 1];
  const blue = sourcePixels.data[startOffset + 2];
  const tolerance = Number(zoneToleranceInput.value);
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let readIndex = 0;
  let writeIndex = 0;

  // ponytail: 4-connected color fill cannot separate touching similar colors; use segmentation for those edges.
  function addPixel(pixel) {
    if (visited[pixel]) return;
    visited[pixel] = 1;
    const offset = pixel * 4;
    if (
      sourcePixels.data[offset + 3] &&
      isNearColor(pixel, red, green, blue, tolerance)
    ) {
      queue[writeIndex++] = pixel;
    }
  }

  addPixel(start);
  while (readIndex < writeIndex) {
    const pixel = queue[readIndex++];
    const x = pixel % width;
    if (x > 0) addPixel(pixel - 1);
    if (x + 1 < width) addPixel(pixel + 1);
    if (pixel >= width) addPixel(pixel - width);
    if (pixel + width < width * height) addPixel(pixel + width);
  }

  let changedCount = 0;
  for (let index = 0; index < writeIndex; index++) {
    const pixel = queue[index];
    if (removedPixels[pixel]) continue;
    removedPixels[pixel] = 1;
    queue[changedCount++] = pixel;
  }
  if (!changedCount) {
    setStatus("Cette zone est déjà supprimée.");
    return;
  }

  undoStack.push(queue.slice(0, changedCount));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
  renderImage();
  setStatus(
    `${changedCount.toLocaleString("fr-FR")} px supprimés. Clique sur une autre zone si besoin.`,
  );
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Choisis un fichier image valide.", "error");
    return;
  }

  try {
    image?.close?.();
    image = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    zoomInput.value = "1";
    zoom = 1;
    offsetX = 0;
    offsetY = 0;
    renderCanvasTransform();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    sourcePixels = context.getImageData(0, 0, canvas.width, canvas.height);
    removedPixels = new Uint8Array(canvas.width * canvas.height);
    undoStack = [];
    redoStack = [];
    updateHistoryButtons();
    canvas.hidden = false;
    emptyMessage.hidden = true;
    colorInput.disabled = false;
    toleranceInput.disabled = false;
    zoneToleranceInput.disabled = true;
    zoomInput.disabled = false;
    mode = "color";
    colorRemovalActive = true;
    colorToleranceControl.hidden = false;
    zoneToleranceControl.hidden = true;
    modeButtons.forEach((button) => {
      button.disabled = false;
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.backgroundMode === mode),
      );
    });
    canvas.classList.remove("is-zone-mode");
    canvas.title = "Clique sur une couleur à retirer";
    download.setAttribute("aria-disabled", "false");
    colorInput.value = "#ffffff";
    toleranceInput.value = "48";
    toleranceValue.value = "48";
    zoneToleranceInput.value = "48";
    zoneToleranceValue.value = "48";
    download.href = "#";
    renderImage();
    setStatus(
      `${canvas.width} × ${canvas.height} px · clique sur une autre couleur pour l’échantillonner.`,
    );
  } catch {
    setStatus("Impossible d’ouvrir cette image.", "error");
  }
});

canvas.addEventListener("click", (event) => {
  if (!sourcePixels) return;
  if (didDrag) {
    didDrag = false;
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(
    0,
    Math.min(
      canvas.width - 1,
      Math.floor(((event.clientX - bounds.left) * canvas.width) / bounds.width),
    ),
  );
  const y = Math.max(
    0,
    Math.min(
      canvas.height - 1,
      Math.floor(
        ((event.clientY - bounds.top) * canvas.height) / bounds.height,
      ),
    ),
  );
  if (mode === "zone") {
    removeZone(x, y);
    return;
  }

  const offset = (y * canvas.width + x) * 4;
  const [red, green, blue] = sourcePixels.data.slice(offset, offset + 3);
  colorInput.value = `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  colorRemovalActive = true;
  renderImage();
  setStatus(
    "Couleur échantillonnée. Clique sur une autre teinte ou passe en mode zone.",
  );
});

zoomInput.addEventListener("input", () => {
  const bounds = canvas.getBoundingClientRect();
  setZoom(
    Number(zoomInput.value),
    bounds.left + bounds.width / 2,
    bounds.top + bounds.height / 2,
  );
});

canvas.addEventListener(
  "wheel",
  (event) => {
    if (!sourcePixels) return;
    event.preventDefault();
    setZoom(
      Number(zoomInput.value) * Math.exp(-event.deltaY * 0.002),
      event.clientX,
      event.clientY,
    );
  },
  { passive: false },
);

canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  didDrag = false;
  if (event.pointerType === "touch") {
    touchPoints.set(event.pointerId, event);
    if (touchPoints.size === 2) {
      dragPoint = null;
      return;
    }
  }
  dragPoint = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
  };
  canvas.classList.add("is-panning");
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") {
    if (!touchPoints.has(event.pointerId)) return;
    touchPoints.set(event.pointerId, event);
    if (touchPoints.size === 2) {
      event.preventDefault();
      const [firstTouch, secondTouch] = touchPoints.values();
      const centerX = (firstTouch.clientX + secondTouch.clientX) / 2;
      const centerY = (firstTouch.clientY + secondTouch.clientY) / 2;
      const distance = Math.hypot(
        firstTouch.clientX - secondTouch.clientX,
        firstTouch.clientY - secondTouch.clientY,
      );
      if (pinchDistance) {
        setZoom(
          Number(zoomInput.value) * (distance / pinchDistance),
          centerX,
          centerY,
        );
        didDrag = true;
      }
      pinchDistance = distance;
      return;
    }
  }
  moveCanvas(event.clientX, event.clientY);
});

function stopCanvasGesture(event) {
  touchPoints.delete(event.pointerId);
  pinchDistance = null;
  if (dragPoint?.pointerId === event.pointerId) dragPoint = null;
  canvas.classList.remove("is-panning");
}

canvas.addEventListener("pointerup", stopCanvasGesture);
canvas.addEventListener("pointercancel", stopCanvasGesture);

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextMode = button.dataset.backgroundMode;
    if (nextMode === mode) return;
    mode = nextMode;
    colorRemovalActive = false;
    removedPixels?.fill(0);
    undoStack = [];
    redoStack = [];
    colorInput.value = "#ffffff";
    colorInput.disabled = mode !== "color";
    toleranceInput.disabled = mode !== "color";
    zoneToleranceInput.disabled = mode !== "zone";
    colorToleranceControl.hidden = mode !== "color";
    zoneToleranceControl.hidden = mode !== "zone";
    updateHistoryButtons();
    modeButtons.forEach((option) =>
      option.setAttribute("aria-pressed", String(option === button)),
    );
    canvas.classList.toggle("is-zone-mode", mode === "zone");
    canvas.title =
      mode === "zone"
        ? "Clique sur une zone connectée à supprimer"
        : "Clique sur une couleur à retirer";
    renderImage();
    setStatus("Méthode changée : les modifications précédentes sont annulées.");
  });
});

undoButton.addEventListener("click", () => {
  const action = undoStack.pop();
  if (!action) return;
  for (const pixel of action) removedPixels[pixel] = 0;
  redoStack.push(action);
  renderImage();
  updateHistoryButtons();
  setStatus("Dernière suppression annulée.");
});

redoButton.addEventListener("click", () => {
  const action = redoStack.pop();
  if (!action) return;
  for (const pixel of action) removedPixels[pixel] = 1;
  undoStack.push(action);
  renderImage();
  updateHistoryButtons();
  setStatus("Suppression rétablie.");
});

colorInput.addEventListener("input", () => {
  if (mode === "color") colorRemovalActive = true;
  renderImage();
});
toleranceInput.addEventListener("input", () => {
  toleranceValue.value = toleranceInput.value;
  if (mode === "color") colorRemovalActive = true;
  renderImage();
});
zoneToleranceInput.addEventListener("input", () => {
  zoneToleranceValue.value = zoneToleranceInput.value;
  setStatus("Cette tolérance s’applique aux prochaines zones sélectionnées.");
});

download.addEventListener("click", (event) => {
  if (!image) {
    event.preventDefault();
    return;
  }
  try {
    const output = createFullResolutionExport();
    const dataUrl = output.toDataURL("image/png");
    if (!dataUrl.startsWith("data:image/png"))
      throw new Error("Export PNG impossible");
    download.href = dataUrl;
    setStatus(`Image exportée en ${image.width} × ${image.height} px.`);
  } catch {
    event.preventDefault();
    setStatus(
      "Impossible d’exporter l’image à sa résolution d’origine.",
      "error",
    );
  }
});
