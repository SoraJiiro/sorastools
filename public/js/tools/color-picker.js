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
const colorPreview = document.querySelector("[data-color-preview]");
const hexOutput = document.querySelector("[data-hex-output]");
const rgbOutput = document.querySelector("[data-rgb-output]");
const hslOutput = document.querySelector("[data-hsl-output]");

let isUpdating = false;

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
  const match = value
    .trim()
    .match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
    || value.trim().match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);

  if (!match) return null;

  const rgb = {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };

  const isValid = Object.values(rgb).every((number) => number >= 0 && number <= 255);

  return isValid ? rgb : null;
}

function parseHsl(value) {
  const match = value
    .trim()
    .match(/^hsl\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)$/i)
    || value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%?\s*,\s*(\d+(?:\.\d+)?)%?$/);

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
  if (!colorPreview || !hexOutput || !rgbOutput || !hslOutput || !colorInput) return;

  const normalizedHex = normalizeHex(hex);
  if (!normalizedHex) return;

  const { r, g, b } = hexToRgb(normalizedHex);
  const { h, s, l } = rgbToHsl(r, g, b);

  isUpdating = true;

  colorPreview.style.background = normalizedHex;
  colorInput.value = normalizedHex;

  if (sourceInput !== hexOutput) hexOutput.value = normalizedHex.toUpperCase();
  if (sourceInput !== rgbOutput) rgbOutput.value = `rgb(${r}, ${g}, ${b})`;
  if (sourceInput !== hslOutput) hslOutput.value = `hsl(${h}, ${s}%, ${l}%)`;

  [hexOutput, rgbOutput, hslOutput].forEach((input) => setInputState(input, true));

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

function setupColorPicker() {
  if (!colorInput || !hexOutput || !rgbOutput || !hslOutput) return;

  updateColorValues(colorInput.value);
  setupEditableColorInputs();

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
