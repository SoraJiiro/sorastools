import { copyToClipboard, hexToRgb, rgbToHsl, temporarilyChangeText } from "../utils.js";

const colorInput = document.querySelector("[data-color-input]");
const colorPreview = document.querySelector("[data-color-preview]");
const hexOutput = document.querySelector("[data-hex-output]");
const rgbOutput = document.querySelector("[data-rgb-output]");
const hslOutput = document.querySelector("[data-hsl-output]");

function updateColorValues(hex) {
  if (!colorPreview || !hexOutput || !rgbOutput || !hslOutput) return;

  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);

  colorPreview.style.background = hex;
  hexOutput.value = hex.toUpperCase();
  rgbOutput.value = `rgb(${r}, ${g}, ${b})`;
  hslOutput.value = `hsl(${h}, ${s}%, ${l}%)`;
}

function setupColorPicker() {
  if (!colorInput) return;

  updateColorValues(colorInput.value);

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
