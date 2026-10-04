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
    !pickerStatus
  )
    return;

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
