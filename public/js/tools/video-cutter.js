import { setStatus } from "../utils.js";

const form = document.querySelector("[data-vc-form]");
const fileInput = document.querySelector("[data-vc-file]");
const preview = document.querySelector("[data-vc-preview]");
const player = document.querySelector("[data-vc-player]");
const timeline = document.querySelector("[data-vc-timeline]");
const selection = document.querySelector("[data-vc-selection]");
const playhead = document.querySelector("[data-vc-playhead]");
const playButton = document.querySelector("[data-vc-play]");
const currentTime = document.querySelector("[data-vc-current]");
const volumeInput = document.querySelector("[data-vc-volume]");
const volumeValue = document.querySelector("[data-vc-volume-value]");
const startInput = document.querySelector("[data-vc-start]");
const endInput = document.querySelector("[data-vc-end]");
const adjustButtons = document.querySelectorAll("[data-vc-adjust]");
const timeFormatLabels = document.querySelectorAll("[data-vc-time-format]");
const stepLabels = document.querySelectorAll("[data-vc-step]");
const markers = [...document.querySelectorAll("[data-vc-marker]")];
const submitButton = document.querySelector("[data-vc-submit]");
const status = document.querySelector("[data-vc-status]");
const progress = document.querySelector("[data-vc-progress]");
const progressBar = document.querySelector("[data-vc-progress-bar]");
const progressStage = document.querySelector("[data-vc-progress-stage]");
const downloadLink = document.querySelector("[data-vc-download]");
const resetButton = document.querySelector("[data-vc-reset]");
const activeSegments = new WeakMap();
let selectedMarker = "start";
let previewUrl;
let durationMs = 0;
let startMs = 0;
let endMs = 0;
let showHours = false;
let adjustTimer;

function parseTime(value) {
  const parts = value.trim().split(":");
  const match =
    parts.length === 4
      ? /^(\d+):([0-5]\d):([0-5]\d):(\d{2})$/.exec(value.trim())
      : parts.length === 3
        ? /^(\d+):([0-5]\d):(\d{2})$/.exec(value.trim())
        : null;
  if (!match) return null;
  return parts.length === 4
    ? ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) *
        1000 +
        Number(match[4]) * 10
    : (Number(match[1]) * 60 + Number(match[2])) * 1000 + Number(match[3]) * 10;
}

function formatTime(milliseconds) {
  const hours = Math.floor(milliseconds / 3600000);
  const totalMinutes = Math.floor(milliseconds / 60000);
  const minutes = showHours ? totalMinutes % 60 : totalMinutes;
  const seconds = Math.floor(milliseconds / 1000) % 60;
  const fraction = String(Math.floor(milliseconds / 10) % 100).padStart(2, "0");
  const time = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${fraction}`;
  return showHours ? `${String(hours).padStart(2, "0")}:${time}` : time;
}

function setTimeFormat(useHours) {
  showHours = useHours;
  const format = showHours ? "HH:MM:SS:MS" : "MM:SS:MS";
  timeFormatLabels.forEach((label) => {
    label.textContent = format;
    label.closest("label").dataset.label =
      `${label.parentElement.textContent.split(" (")[0]} au format ${format}`;
  });
  startInput.placeholder = showHours ? "00:00:00:00" : "00:00:00";
  endInput.placeholder = startInput.placeholder;
}

function updateTimeline() {
  if (!durationMs) return;
  const startPercent = (startMs / durationMs) * 100;
  const endPercent = (endMs / durationMs) * 100;
  selection.style.left = `${startPercent}%`;
  selection.style.width = `${endPercent - startPercent}%`;
  playhead.style.left = `${((preview.currentTime * 1000) / durationMs) * 100}%`;
  currentTime.value = formatTime(Math.floor(preview.currentTime * 1000));
  markers.forEach((marker) => {
    const value = marker.dataset.vcMarker === "start" ? startMs : endMs;
    marker.style.left = `${(value / durationMs) * 100}%`;
    marker.setAttribute("aria-valuemax", String(durationMs));
    marker.setAttribute("aria-valuenow", String(value));
    marker.setAttribute("aria-valuetext", formatTime(value));
  });
}

function updatePlayback() {
  if (!preview.paused && preview.currentTime * 1000 >= endMs) {
    preview.pause();
    preview.currentTime = endMs / 1000;
  }
  updateTimeline();
}

function setMarker(name, value) {
  value = Math.round(value / 10) * 10;
  if (name === "start") {
    startMs = Math.max(0, Math.min(Math.round(value), endMs - 1));
    startInput.value = formatTime(startMs);
    if (preview.readyState > 0) preview.currentTime = startMs / 1000;
  } else {
    endMs = Math.min(durationMs, Math.max(Math.round(value), startMs + 1));
    endInput.value = formatTime(endMs);
  }
  updateTimeline();
}

function timeFromPointer(event) {
  const bounds = timeline.getBoundingClientRect();
  return Math.round(
    Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) *
      durationMs,
  );
}

function seekFromPointer(event) {
  preview.currentTime = timeFromPointer(event) / 1000;
}

function segmentAt(input) {
  const separators = [...input.value.matchAll(/:/g)].map(
    (match) => match.index,
  );
  const cursor = input.selectionStart ?? input.value.length;
  if (separators.length === 3) {
    return cursor <= separators[0]
      ? "hours"
      : cursor <= separators[1]
        ? "minutes"
        : cursor <= separators[2]
          ? "seconds"
          : "milliseconds";
  }
  return cursor <= separators[0]
    ? "minutes"
    : cursor <= separators[1]
      ? "seconds"
      : "milliseconds";
}

function stepAmount(segment, heldFor = 0) {
  const baseStep =
    segment === "hours"
      ? 3600000
      : segment === "minutes"
        ? 60000
        : segment === "seconds"
          ? 1000
          : 10;
  return baseStep * 10 ** Math.floor(heldFor / 700);
}

function describeStep(amount) {
  if (amount >= 3600000 && amount % 3600000 === 0)
    return `${amount / 3600000} h`;
  if (amount >= 60000 && amount % 60000 === 0) return `${amount / 60000} min`;
  if (amount >= 1000 && amount % 1000 === 0) return `${amount / 1000} s`;
  return `${amount} ms`;
}

function updateStepDisplay(input, name, heldFor = 0) {
  const description = describeStep(
    stepAmount(activeSegments.get(input) || "milliseconds", heldFor),
  );
  stepLabels.forEach((label) => {
    if (label.dataset.vcStep === name)
      label.textContent = `Pas : ${description}`;
  });
  adjustButtons.forEach((button) => {
    if (button.dataset.vcAdjust !== name) return;
    const direction = Number(button.dataset.step) < 0 ? "Reculer" : "Avancer";
    const target = name === "start" ? "le début" : "la fin";
    button.setAttribute(
      "aria-label",
      `${direction} ${target} de ${description}`,
    );
  });
}

function adjust(button, segment, heldFor = 0) {
  const name = button.dataset.vcAdjust;
  const input = button.parentElement.querySelector("input");
  const amount = stepAmount(segment, heldFor);
  updateStepDisplay(input, name, heldFor);
  const value = name === "start" ? startMs : endMs;
  setMarker(name, value + Number(button.dataset.step) * amount);
}

function stopAdjusting() {
  clearInterval(adjustTimer);
  adjustTimer = undefined;
}

function clearDownload() {
  if (downloadLink.href.startsWith("blob:"))
    URL.revokeObjectURL(downloadLink.href);
  downloadLink.hidden = true;
  downloadLink.removeAttribute("href");
}

function setProgress(stage, fraction = null) {
  progress.hidden = false;
  progressStage.value =
    fraction === null ? stage : `${stage} : ${Math.round(fraction * 100)} %`;
  if (fraction === null) progressBar.removeAttribute("value");
  else progressBar.value = fraction * 100;
}

function selectMarker(name) {
  selectedMarker = name;
  markers.forEach((marker) => {
    marker.classList.toggle("is-selected", marker.dataset.vcMarker === name);
  });
}

function nudgeMarker(direction, step = 100) {
  if (!durationMs) return;
  const value = selectedMarker === "start" ? startMs : endMs;
  setMarker(selectedMarker, value + direction * step);
}

function resetTool() {
  preview.pause();
  clearDownload();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  preview.removeAttribute("src");
  preview.load();
  preview.hidden = true;
  player.hidden = true;
  fileInput.value = "";
  durationMs = 0;
  startMs = 0;
  endMs = 0;
  showHours = false;
  progress.hidden = true;
  setTimeFormat(false);
  startInput.value = "00:00:00";
  endInput.value = "00:00:00";
  volumeInput.value = "1";
  preview.volume = 1;
  volumeValue.value = "100 %";
  selectMarker("start");
  setStatus(status, "En attente d'une vidéo.", "default");
}

fileInput.addEventListener("change", () => {
  clearDownload();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = fileInput.files[0];
  if (!file) {
    preview.hidden = true;
    player.hidden = true;
    durationMs = 0;
    setTimeFormat(false);
    return;
  }
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.hidden = false;
  preview.onloadedmetadata = () => {
    durationMs = Math.floor(preview.duration * 100) * 10;
    setTimeFormat(durationMs > (59 * 60 + 59) * 1000 + 590);
    startMs = 0;
    endMs = durationMs;
    startInput.value = formatTime(startMs);
    endInput.value = formatTime(endMs);
    activeSegments.set(startInput, "milliseconds");
    activeSegments.set(endInput, "milliseconds");
    updateStepDisplay(startInput, "start");
    updateStepDisplay(endInput, "end");
    player.hidden = false;
    updateTimeline();
  };
  setStatus(status, file.name, "default");
});

playButton.addEventListener("click", () => {
  if (!preview.paused) {
    preview.pause();
    return;
  }
  const time = preview.currentTime * 1000;
  if (time < startMs || time >= endMs) preview.currentTime = startMs / 1000;
  preview.play();
});

volumeInput.addEventListener("input", () => {
  preview.volume = Number(volumeInput.value);
  volumeValue.value = `${Math.round(preview.volume * 100)} %`;
});

preview.addEventListener("play", () => {
  playButton.textContent = "Pause";
  playButton.setAttribute("aria-label", "Mettre en pause");
});
preview.addEventListener("pause", () => {
  playButton.textContent = "Lire";
  playButton.setAttribute("aria-label", "Lire la vidéo");
});
preview.addEventListener("timeupdate", updatePlayback);
preview.addEventListener("ended", updateTimeline);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) preview.pause();
});

timeline.addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-vc-marker]") || !durationMs) return;
  seekFromPointer(event);
});

markers.forEach((marker) => {
  marker.addEventListener("pointerdown", (event) => {
    selectMarker(marker.dataset.vcMarker);
    event.preventDefault();
    marker.setPointerCapture(event.pointerId);
    setMarker(marker.dataset.vcMarker, timeFromPointer(event));
  });
  marker.addEventListener("pointermove", (event) => {
    if (marker.hasPointerCapture(event.pointerId))
      setMarker(marker.dataset.vcMarker, timeFromPointer(event));
  });
  marker.addEventListener("focus", () => selectMarker(marker.dataset.vcMarker));
  marker.addEventListener("keydown", (event) => {
    const name = marker.dataset.vcMarker;
    const value = name === "start" ? startMs : endMs;
    const step = event.shiftKey ? 1000 : 100;
    const next =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? value - step
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? value + step
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? durationMs
              : null;
    if (next !== null) {
      event.preventDefault();
      setMarker(name, next);
    }
  });
});

resetButton.addEventListener("click", resetTool);

document.addEventListener("keydown", (event) => {
  if (
    event.target.closest(
      "input, textarea, select, [contenteditable='true'], [data-vc-marker]",
    )
  )
    return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    nudgeMarker(
      event.key === "ArrowRight" ? 1 : -1,
      event.shiftKey ? 1000 : 100,
    );
  }
});

[
  [startInput, "start"],
  [endInput, "end"],
].forEach(([input, name]) => {
  input.addEventListener("focus", () => {
    activeSegments.set(input, "milliseconds");
    updateStepDisplay(input, name);
  });
  input.addEventListener("click", () => {
    activeSegments.set(input, segmentAt(input));
    updateStepDisplay(input, name);
  });
  input.addEventListener("keyup", () => {
    activeSegments.set(input, segmentAt(input));
    updateStepDisplay(input, name);
  });
  input.addEventListener("beforeinput", (event) => {
    const separators = [...input.value].flatMap((character, index) =>
      character === ":" ? [index] : [],
    );
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const deletesSeparator = separators.some((index) =>
      start === end
        ? (event.inputType === "deleteContentBackward" &&
            start === index + 1) ||
          (event.inputType === "deleteContentForward" && start === index)
        : start <= index && end > index,
    );
    if (!deletesSeparator) return;
    const replacement =
      event.data || event.dataTransfer?.getData("text/plain") || "";
    if (!/^(?:\d+:[0-5]\d:\d{2}|\d+:[0-5]\d:[0-5]\d:\d{2})$/.test(replacement))
      event.preventDefault();
  });
  input.addEventListener("change", () => {
    const value = parseTime(input.value);
    if (value === null || value > durationMs) {
      input.setCustomValidity(
        showHours
          ? "Utilisez HH:MM:SS:MS, par exemple 01:23:45:67."
          : "Utilisez MM:SS:MS, par exemple 01:23:45.",
      );
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    setMarker(name, value);
  });
});

adjustButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    stopAdjusting();
    const input = button.parentElement.querySelector("input");
    const segment = activeSegments.get(input) || "milliseconds";
    const startedAt = Date.now();
    adjust(button, segment);
    adjustTimer = setInterval(
      () => adjust(button, segment, Date.now() - startedAt),
      120,
    );
  });
  button.addEventListener("click", (event) => {
    if (event.detail !== 0) return;
    const input = button.parentElement.querySelector("input");
    adjust(button, activeSegments.get(input) || "milliseconds");
  });
});

window.addEventListener("pointerup", stopAdjusting);
window.addEventListener("pointercancel", stopAdjusting);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearDownload();
  const start = parseTime(startInput.value);
  const end = parseTime(endInput.value);
  if (start === null || end === null || start >= end || end > durationMs) {
    const format = showHours ? "HH:MM:SS:MS" : "MM:SS:MS";
    setStatus(
      status,
      `Vérifiez le format ${format} et l'ordre des repères.`,
      "error",
    );
    return;
  }

  submitButton.disabled = true;
  fileInput.disabled = true;
  resetButton.disabled = true;
  setProgress("Préparation de l'envoi");
  setStatus(status, "Préparation de l'envoi...", "default");
  try {
    const data = new FormData();
    data.append("file", fileInput.files[0]);
    data.append("start", String(start / 1000));
    data.append("end", String(end / 1000));
    const result = await new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", "/api/video-cutter/cut");
      request.responseType = "blob";
      request.upload.addEventListener("progress", (progressEvent) => {
        if (!progressEvent.lengthComputable) return;
        setProgress(
          "Envoi de la vidéo",
          progressEvent.loaded / progressEvent.total,
        );
        setStatus(status, "Envoi de la vidéo au serveur...", "default");
      });
      request.upload.addEventListener("load", () => {
        setProgress("Découpage sur le serveur");
        setStatus(status, "Découpage sur le serveur...", "default");
      });
      request.addEventListener("progress", (progressEvent) => {
        if (request.readyState < XMLHttpRequest.HEADERS_RECEIVED) return;
        if (progressEvent.lengthComputable) {
          setProgress(
            "Réception du résultat",
            progressEvent.loaded / progressEvent.total,
          );
        } else {
          setProgress("Réception du résultat");
        }
        setStatus(status, "Réception du résultat...", "default");
      });
      request.addEventListener("load", async () => {
        if (request.status < 200 || request.status >= 300) {
          let message = "Découpe impossible.";
          try {
            message =
              JSON.parse(await request.response.text()).message || message;
          } catch {}
          reject(new Error(message));
          return;
        }
        resolve({
          blob: request.response,
          disposition: request.getResponseHeader("Content-Disposition"),
        });
      });
      request.addEventListener("error", () =>
        reject(new Error("Erreur réseau.")),
      );
      request.send(data);
    });
    const filename =
      result.disposition?.match(/filename="?([^";]+)"?/i)?.[1] ||
      "video-cut.mp4";
    downloadLink.href = URL.createObjectURL(result.blob);
    downloadLink.download = filename;
    downloadLink.hidden = false;
    setProgress("Découpage terminé", 1);
    setStatus(status, "Prêt à télécharger.", "success");
  } catch (error) {
    progress.hidden = true;
    setStatus(status, error.message || "Découpe impossible.", "error");
  } finally {
    submitButton.disabled = false;
    fileInput.disabled = false;
    resetButton.disabled = false;
  }
});
