export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function applyActionsLabels(selector = "[data-label]") {
  if (!selector) return;

  document.querySelectorAll(selector).forEach((element) => {
    const label = element.dataset.label?.trim();
    if (!label) return;
    element.title = label;
    element.setAttribute("aria-label", label);
  });
}

export function clampNumber(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
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
  if (!textarea || textarea.disabled) return;

  if (event.key === "Escape") {
    textarea.blur();
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (event.key !== "Tab" || textarea.readOnly) {
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

export function getFaKit() {
  const faKitLink = "https://kit.fontawesome.com/9a6b0f1631.js";

  const kitScript = document.createElement("script");
  kitScript.src = faKitLink;
  kitScript.crossOrigin = "anonymous";
  document.head.appendChild(kitScript);

  return kitScript;
}
