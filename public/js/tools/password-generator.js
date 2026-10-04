import { copyToClipboard, setStatus } from "../utils.js";

const lengthInput = document.querySelector("[data-password-length]");
const lengthValue = document.querySelector("[data-password-length-value]");
const groupInputs = [...document.querySelectorAll("[data-password-group]")];
const passwordOutput = document.querySelector("[data-password-output]");
const copyButton = document.querySelector("[data-password-copy]");
const status = document.querySelector("[data-password-status]");
const characterSets = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
};
const randomBuffer = new Uint32Array(1);

function randomIndex(maximum) {
  const range = 0x100000000;
  const limit = Math.floor(range / maximum) * maximum;
  do {
    window.crypto.getRandomValues(randomBuffer);
  } while (randomBuffer[0] >= limit);
  return randomBuffer[0] % maximum;
}

function clearPassword() {
  passwordOutput.value = "";
  copyButton.disabled = true;
}

function generatePassword() {
  const pools = groupInputs
    .filter((input) => input.checked)
    .map((input) => characterSets[input.dataset.passwordGroup]);
  const length = Number(lengthInput.value);

  if (!pools.length) {
    clearPassword();
    setStatus(status, "Sélectionne au moins un type de caractère.", "warning");
    return;
  }

  try {
    if (!window.crypto?.getRandomValues) {
      throw new Error("Web Crypto n'est pas disponible dans ce navigateur.");
    }
    if (length < pools.length) {
      throw new Error("La longueur doit couvrir chaque type sélectionné.");
    }

    const allCharacters = pools.join("");
    const characters = pools.map((pool) => pool[randomIndex(pool.length)]);
    while (characters.length < length) {
      characters.push(allCharacters[randomIndex(allCharacters.length)]);
    }
    for (let index = characters.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [characters[index], characters[swapIndex]] = [
        characters[swapIndex],
        characters[index],
      ];
    }

    passwordOutput.value = characters.join("");
    copyButton.disabled = false;
    setStatus(status, "Mot de passe généré.", "success");
  } catch (error) {
    clearPassword();
    setStatus(
      status,
      error.message || "Impossible de générer le mot de passe.",
      "error",
    );
  }
}

function setupPasswordGenerator() {
  if (
    !lengthInput ||
    !lengthValue ||
    !groupInputs.length ||
    !passwordOutput ||
    !copyButton ||
    !status
  )
    return;

  const invalidatePassword = () => {
    clearPassword();
    lengthValue.textContent = lengthInput.value;
    setStatus(status, "Options modifiées. Génère un nouveau mot de passe.");
  };

  lengthInput.addEventListener("input", invalidatePassword);
  groupInputs.forEach((input) =>
    input.addEventListener("change", invalidatePassword),
  );
  document
    .querySelector("[data-password-generate]")
    ?.addEventListener("click", generatePassword);
  copyButton.addEventListener("click", async () => {
    try {
      await copyToClipboard(passwordOutput.value);
      setStatus(status, "Mot de passe copié.", "success");
    } catch (error) {
      setStatus(status, "Impossible d'accéder au presse-papiers.", "error");
    }
  });

  generatePassword();
}

setupPasswordGenerator();
