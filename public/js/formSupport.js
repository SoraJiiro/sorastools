const COOLDOWN_MS = 30 * 60 * 1000;

function formatRemainingTime(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function createCooldown({
  storageKey,
  submitButton,
  cooldownElement,
  waitingMessage,
  readyMessage,
}) {
  let timer = null;

  function getRemaining() {
    const lastSubmit = Number(localStorage.getItem(storageKey)) || 0;
    return Math.max(COOLDOWN_MS - (Date.now() - lastSubmit), 0);
  }

  function update() {
    const remaining = getRemaining();
    if (remaining > 0) {
      submitButton.disabled = true;
      cooldownElement.textContent = `${waitingMessage} ${formatRemainingTime(remaining)}.`;
      return;
    }

    submitButton.disabled = false;
    cooldownElement.textContent = readyMessage;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    update();
    if (timer) clearInterval(timer);
    timer = setInterval(update, 1000);
  }

  return { getRemaining, update, start };
}

export function createAdditionCaptcha(questionElement, inputElement) {
  let answer = 0;

  function reset() {
    const first = Math.floor(Math.random() * 9) + 1;
    const second = Math.floor(Math.random() * 9) + 1;
    answer = first + second;
    questionElement.textContent = `${first} + ${second} = ?`;
    inputElement.value = "";
  }

  function isCorrect(value) {
    return Number(value) === answer;
  }

  return { reset, isCorrect };
}
