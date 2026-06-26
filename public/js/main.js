const toolsGrid = document.querySelector("[data-tools-grid]");
const colorInput = document.querySelector("[data-color-input]");
const colorPreview = document.querySelector("[data-color-preview]");
const hexOutput = document.querySelector("[data-hex-output]");
const rgbOutput = document.querySelector("[data-rgb-output]");
const hslOutput = document.querySelector("[data-hsl-output]");

function hexToRgb(hex) {
  const cleanHex = hex.replace("#", "");
  const value = parseInt(cleanHex, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const diff = max - min;
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

    switch (max) {
      case r:
        h = (g - b) / diff + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / diff + 2;
        break;
      default:
        h = (r - g) / diff + 4;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function updateColorValues(hex) {
  if (!colorPreview || !hexOutput || !rgbOutput || !hslOutput) return;

  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);

  colorPreview.style.background = hex;
  hexOutput.value = hex.toUpperCase();
  rgbOutput.value = `rgb(${r}, ${g}, ${b})`;
  hslOutput.value = `hsl(${h}, ${s}%, ${l}%)`;
}

async function loadTools() {
  if (!toolsGrid) return;

  try {
    const response = await fetch("/api/tools");
    const data = await response.json();

    toolsGrid.innerHTML = data.tools
      .map((tool) => {
        const isReady = tool.status === "ready";
        const statusText = isReady ? "Disponible" : "Bientôt";
        const href = isReady ? tool.url : "#tools";

        return `
          <article class="tool-card ${isReady ? "" : "tool-card--soon"}">
            <span class="tool-card__category">${tool.category}</span>
            <h3>${tool.name}</h3>
            <p>${tool.description}</p>
            <span class="tool-card__status">${statusText}</span>
            <a class="tool-card__link" href="${href}">${isReady ? "Ouvrir" : "À venir"}</a>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    toolsGrid.innerHTML = "<p>Impossible de charger les tools.</p>";
  }
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

      await navigator.clipboard.writeText(output.value);
      const oldText = button.textContent;
      button.textContent = "Copié";

      setTimeout(() => {
        button.textContent = oldText;
      }, 1000);
    });
  });
}

loadTools();
setupColorPicker();
