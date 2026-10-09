import {
  clampNumber,
  copyToClipboard,
  hexToRgb,
  hslToRgb,
  rgbToHex,
  rgbToHsl,
  temporarilyChangeText,
} from "../utils.js";

const colorInput = document.querySelector("[data-color-input]");
const hexOutput = document.querySelector("[data-hex-output]");
const rgbOutput = document.querySelector("[data-rgb-output]");
const hslOutput = document.querySelector("[data-hsl-output]");
const imageInput = document.querySelector("[data-image-input]");
const imageCanvas = document.querySelector("[data-image-canvas]");
const pickerEmpty = document.querySelector("[data-picker-empty]");
const pickerStatus = document.querySelector("[data-picker-status]");
const pickerZoom = document.querySelector("[data-picker-zoom]");
const imageContext = imageCanvas?.getContext("2d", {
  willReadFrequently: true,
});

let isUpdating = false;
let imageUrl = null;

function normalizeHex(value) {
  const cleanValue = value.trim().replace(/^#/, "");

  if (/^[0-9a-fA-F]{3}$/.test(cleanValue)) {
    return `#${cleanValue
      .split("")
      .map((char) => char + char)
      .join("")}`.toLowerCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(cleanValue)) {
    return `#${cleanValue}`.toLowerCase();
  }

  return null;
}

function parseRgb(value) {
  const match =
    value
      .trim()
      .match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i) ||
    value.trim().match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);

  if (!match) return null;

  const rgb = {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };

  const isValid = Object.values(rgb).every(
    (number) => number >= 0 && number <= 255,
  );

  return isValid ? rgb : null;
}

function parseHsl(value) {
  const match =
    value
      .trim()
      .match(
        /^hsl\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)$/i,
      ) ||
    value
      .trim()
      .match(
        /^(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%?\s*,\s*(\d+(?:\.\d+)?)%?$/,
      );

  if (!match) return null;

  return {
    h: Number(match[1]),
    s: clampNumber(match[2], 0, 100),
    l: clampNumber(match[3], 0, 100),
  };
}

function setInputState(input, isValid) {
  input.dataset.invalid = isValid ? "false" : "true";
}

function updateColorValues(hex, sourceInput = null) {
  if (!hexOutput || !rgbOutput || !hslOutput || !colorInput) return;

  const normalizedHex = normalizeHex(hex);
  if (!normalizedHex) return;

  const { r, g, b } = hexToRgb(normalizedHex);
  const { h, s, l } = rgbToHsl(r, g, b);

  isUpdating = true;

  colorInput.value = normalizedHex;

  if (sourceInput !== hexOutput) hexOutput.value = normalizedHex.toUpperCase();
  if (sourceInput !== rgbOutput) rgbOutput.value = `rgb(${r}, ${g}, ${b})`;
  if (sourceInput !== hslOutput) hslOutput.value = `hsl(${h}, ${s}%, ${l}%)`;

  [hexOutput, rgbOutput, hslOutput].forEach((input) =>
    setInputState(input, true),
  );

  isUpdating = false;
}

function setupEditableColorInputs() {
  hexOutput.addEventListener("input", () => {
    if (isUpdating) return;

    const hex = normalizeHex(hexOutput.value);
    setInputState(hexOutput, Boolean(hex));

    if (hex) updateColorValues(hex, hexOutput);
  });

  rgbOutput.addEventListener("input", () => {
    if (isUpdating) return;

    const rgb = parseRgb(rgbOutput.value);
    setInputState(rgbOutput, Boolean(rgb));

    if (rgb) updateColorValues(rgbToHex(rgb.r, rgb.g, rgb.b), rgbOutput);
  });

  hslOutput.addEventListener("input", () => {
    if (isUpdating) return;

    const hsl = parseHsl(hslOutput.value);
    setInputState(hslOutput, Boolean(hsl));

    if (hsl) {
      const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      updateColorValues(rgbToHex(rgb.r, rgb.g, rgb.b), hslOutput);
    }
  });
}

function setupImagePicker() {
  if (
    !imageInput ||
    !imageCanvas ||
    !imageContext ||
    !pickerEmpty ||
    !pickerStatus ||
    !pickerZoom
  )
    return;

  const touchPoints = new Map();
  let pinchDistance = null;
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dragPoint = null;
  let didDrag = false;

  function renderImage() {
    imageCanvas.style.setProperty("--picker-zoom", zoom);
    imageCanvas.style.setProperty("--picker-offset-x", `${offsetX}px`);
    imageCanvas.style.setProperty("--picker-offset-y", `${offsetY}px`);
  }

  function setZoom(nextZoom, clientX, clientY) {
    const bounds = imageCanvas.getBoundingClientRect();
    const clampedZoom = clampNumber(
      nextZoom,
      Number(pickerZoom.min),
      Number(pickerZoom.max),
    );

    offsetX += (clientX - bounds.left) * (1 - clampedZoom / zoom);
    offsetY += (clientY - bounds.top) * (1 - clampedZoom / zoom);
    zoom = clampedZoom;
    pickerZoom.value = zoom;
    renderImage();
  }

  function moveImage(clientX, clientY) {
    if (!dragPoint) return;

    const deltaX = clientX - dragPoint.clientX;
    const deltaY = clientY - dragPoint.clientY;
    if (deltaX || deltaY) {
      offsetX += deltaX;
      offsetY += deltaY;
      didDrag = true;
      renderImage();
    }

    dragPoint = { ...dragPoint, clientX, clientY };
  }

  pickerZoom.addEventListener("input", () => {
    const bounds = imageCanvas.getBoundingClientRect();
    setZoom(
      Number(pickerZoom.value),
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    );
  });

  imageCanvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      setZoom(
        Number(pickerZoom.value) * Math.exp(-event.deltaY * 0.002),
        event.clientX,
        event.clientY,
      );
    },
    { passive: false },
  );

  imageCanvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    imageCanvas.setPointerCapture(event.pointerId);
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
    imageCanvas.classList.add("is-panning");
  });

  imageCanvas.addEventListener("pointermove", (event) => {
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
            Number(pickerZoom.value) * (distance / pinchDistance),
            centerX,
            centerY,
          );
          didDrag = true;
        }

        pinchDistance = distance;
        return;
      }
    }

    moveImage(event.clientX, event.clientY);
  });

  function stopPinch(event) {
    touchPoints.delete(event.pointerId);
    pinchDistance = null;
    if (dragPoint && dragPoint.pointerId === event.pointerId) {
      dragPoint = null;
    }
    imageCanvas.classList.remove("is-panning");
  }

  imageCanvas.addEventListener("pointerup", stopPinch);
  imageCanvas.addEventListener("pointercancel", stopPinch);

  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      pickerStatus.textContent = "Ce fichier n’est pas une image.";
      imageInput.value = "";
      return;
    }

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (image.src !== imageUrl) return;

      imageCanvas.width = image.naturalWidth;
      imageCanvas.height = image.naturalHeight;
      imageContext.drawImage(image, 0, 0);
      pickerZoom.value = "1";
      pickerZoom.disabled = false;
      zoom = 1;
      offsetX = 0;
      offsetY = 0;
      renderImage();
      imageCanvas.hidden = false;
      pickerEmpty.hidden = true;
      pickerStatus.textContent = file.name;
    };
    image.onerror = () => {
      pickerStatus.textContent = "Impossible de lire cette image.";
    };
    image.src = imageUrl;
  });

  imageCanvas.addEventListener("click", (event) => {
    if (didDrag) {
      didDrag = false;
      return;
    }

    const bounds = imageCanvas.getBoundingClientRect();
    const x = Math.min(
      imageCanvas.width - 1,
      Math.floor(
        ((event.clientX - bounds.left) * imageCanvas.width) / bounds.width,
      ),
    );
    const y = Math.min(
      imageCanvas.height - 1,
      Math.floor(
        ((event.clientY - bounds.top) * imageCanvas.height) / bounds.height,
      ),
    );
    const [red, green, blue] = imageContext.getImageData(x, y, 1, 1).data;

    updateColorValues(rgbToHex(red, green, blue));
  });
}

function setupColorPicker() {
  if (!colorInput || !hexOutput || !rgbOutput || !hslOutput) return;

  updateColorValues(colorInput.value);
  setupEditableColorInputs();
  setupImagePicker();

  colorInput.addEventListener("input", () => {
    updateColorValues(colorInput.value);
  });

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.copy;
      const output = document.querySelector(`[data-${type}-output]`);

      if (!output) return;

      await copyToClipboard(output.value);
      temporarilyChangeText(button, "Copié");
    });
  });
}

setupColorPicker();
