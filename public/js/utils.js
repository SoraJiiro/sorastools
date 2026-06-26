export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function applyActionsLabels(selector = "[data-label]") {
  const elements = document.querySelectorAll(selector);
  let appliedCount = 0;

  elements.forEach((element) => {
    const label = element.dataset.label?.trim();

    if (!label) return;

    element.setAttribute("aria-label", label);
    element.setAttribute("title", label);
    appliedCount += 1;
  });

  return appliedCount;
}

export function clampNumber(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

export function hexToRgb(hex) {
  const cleanHex = hex.replace("#", "");
  const value = parseInt(cleanHex, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => clampNumber(value, 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function rgbToHsl(r, g, b) {
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

export function hslToRgb(h, s, l) {
  h = ((Number(h) % 360) + 360) % 360;
  s = clampNumber(s, 0, 100) / 100;
  l = clampNumber(l, 0, 100) / 100;

  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = chroma;
    g = x;
  } else if (h < 120) {
    r = x;
    g = chroma;
  } else if (h < 180) {
    g = chroma;
    b = x;
  } else if (h < 240) {
    g = x;
    b = chroma;
  } else if (h < 300) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

export function downloadTextFile(content, filename, mimeType = "text/plain") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export function temporarilyChangeText(element, text, delay = 1000) {
  if (!element) return;

  const oldText = element.textContent;
  element.textContent = text;

  setTimeout(() => {
    element.textContent = oldText;
  }, delay);
}

export function setStatus(element, message, type = "default") {
  if (!element) return;

  element.textContent = message;
  element.dataset.type = type;
}

function emitTextareaInput(textarea) {
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function getSelectedTextRange(textarea) {
  const { selectionStart, selectionEnd, value } = textarea;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  let lineEnd = selectionEnd;

  if (selectionStart !== selectionEnd && value[selectionEnd - 1] === "\n") {
    lineEnd = selectionEnd - 1;
  }

  const nextLineBreak = value.indexOf("\n", lineEnd);
  lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;

  return { lineStart, lineEnd, selectionStart, selectionEnd };
}

export function textAreaTabHandler(event, textarea = event.currentTarget) {
  if (
    event.key !== "Tab" ||
    !textarea ||
    textarea.readOnly ||
    textarea.disabled
  ) {
    return;
  }

  event.preventDefault();

  const tab = "\t";
  const { value, selectionStart, selectionEnd } = textarea;

  if (selectionStart === selectionEnd) {
    if (event.shiftKey) {
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const lineBeforeCursor = value.slice(lineStart, selectionStart);
      const indentationMatch = lineBeforeCursor.match(/^(\t| {1,2})/);

      if (!indentationMatch) return;

      const removeLength = indentationMatch[0].length;
      textarea.value =
        value.slice(0, lineStart) + value.slice(lineStart + removeLength);
      textarea.selectionStart = textarea.selectionEnd = Math.max(
        lineStart,
        selectionStart - removeLength,
      );
      emitTextareaInput(textarea);
      return;
    }

    textarea.value =
      value.slice(0, selectionStart) + tab + value.slice(selectionEnd);
    textarea.selectionStart = textarea.selectionEnd =
      selectionStart + tab.length;
    emitTextareaInput(textarea);
    return;
  }

  const { lineStart, lineEnd } = getSelectedTextRange(textarea);
  const before = value.slice(0, lineStart);
  const selectedBlock = value.slice(lineStart, lineEnd);
  const after = value.slice(lineEnd);
  const lines = selectedBlock.split("\n");

  if (event.shiftKey) {
    let removedBeforeSelection = 0;
    let totalRemoved = 0;
    let currentIndex = lineStart;

    const updatedLines = lines.map((line) => {
      const match = line.match(/^(\t| {1,2})/);
      const removeLength = match ? match[0].length : 0;

      if (removeLength && currentIndex < selectionStart) {
        removedBeforeSelection += Math.min(
          removeLength,
          selectionStart - currentIndex,
        );
      }

      currentIndex += line.length + 1;
      totalRemoved += removeLength;
      return removeLength ? line.slice(removeLength) : line;
    });

    textarea.value = before + updatedLines.join("\n") + after;
    textarea.selectionStart = Math.max(
      lineStart,
      selectionStart - removedBeforeSelection,
    );
    textarea.selectionEnd = Math.max(
      textarea.selectionStart,
      selectionEnd - totalRemoved,
    );
    emitTextareaInput(textarea);
    return;
  }

  const updatedBlock = lines.map((line) => tab + line).join("\n");
  textarea.value = before + updatedBlock + after;
  textarea.selectionStart = selectionStart + tab.length;
  textarea.selectionEnd = selectionEnd + lines.length * tab.length;
  emitTextareaInput(textarea);
}

export function setupTextareaTabHandlers(selector = "textarea") {
  document.querySelectorAll(selector).forEach((textarea) => {
    textarea.addEventListener("keydown", (event) =>
      textAreaTabHandler(event, textarea),
    );
  });
}
