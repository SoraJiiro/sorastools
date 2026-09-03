import {
  applyActionsLabels,
  setupTextareaTabHandlers,
  initFaKit,
} from "./utils.js";
import { setupMostUsedTools, setupToolSubmitTracking } from "./toolUsage.js";

const HIGHLIGHT_STYLE_HREF = "/vendor/highlight.js/styles/github-dark.min.css";
const HIGHLIGHT_SCRIPT_SRC = "/vendor/highlight.js/highlight.min.js";
const NAVBAR_MOBILE_QUERY = "(max-width: 720px)";
const MOST_USED_SELECTOR = "[data-tools-most-used]";
const BASIC_LOCATIONS = {
  "/": "Home",
  "/contact": "Contact",
  "/suggest": "Suggest",
};

let highlightJsPromise = null;

function hasHighlightableCode(root = document) {
  return Boolean(
    root.querySelector(
      "pre code, code[class*='language-'], code[data-highlight]",
    ),
  );
}

function ensureHighlightStyle() {
  if (document.querySelector(`link[href='${HIGHLIGHT_STYLE_HREF}']`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = HIGHLIGHT_STYLE_HREF;
  document.head.appendChild(link);
}

function setFooterLocation() {
  const locationEl = document.querySelector(".location");
  const path = window.location.pathname;
  if (!locationEl) return;

  if (path in BASIC_LOCATIONS) {
    locationEl.textContent = BASIC_LOCATIONS[path];
  } else {
    const name =
      document.querySelector(".section-heading h1")?.textContent?.trim() ||
      "Unknown Location";
    locationEl.textContent = name;
  }

  locationEl.setAttribute(
    "title",
    `Vous êtes sur la page "${locationEl.textContent}"`,
  );
  locationEl.setAttribute(
    "aria-label",
    `Vous êtes sur la page "${locationEl.textContent}"`,
  );
  locationEl.textContent = "~/" + locationEl.textContent;
  locationEl.style.cursor = "help";
}

function updateFooterDate() {
  const dateEl = document.querySelector("footer .date");
  if (dateEl) {
    dateEl.textContent = "2025 - " + new Date().getFullYear();
  }
}

function loadHighlightJs() {
  if (window.hljs) return Promise.resolve(window.hljs);
  if (highlightJsPromise) return highlightJsPromise;

  ensureHighlightStyle();

  const existingScript = document.querySelector("script[src*='highlight']");

  highlightJsPromise = new Promise((resolve, reject) => {
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.hljs), {
        once: true,
      });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = HIGHLIGHT_SCRIPT_SRC;
    script.defer = true;
    script.addEventListener("load", () => resolve(window.hljs), { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });

  return highlightJsPromise;
}

function highlightCode(root = document) {
  if (!window.hljs) return;

  root
    .querySelectorAll(
      "pre code, code[class*='language-'], code[data-highlight]",
    )
    .forEach((code) => {
      code.removeAttribute("data-highlighted");
      window.hljs.highlightElement(code);
    });
}

function setupHighlightJs() {
  window.applyHighlightJs = highlightCode;

  function applyHighlighting(root = document) {
    if (!hasHighlightableCode(root)) return;

    loadHighlightJs()
      .then(() => highlightCode(root))
      .catch(() => {});
  }

  document.addEventListener("soratools:content-updated", (event) => {
    applyHighlighting(event.detail?.root || document);
  });

  applyHighlighting();
}

function setupScrollUpButton() {
  if (document.querySelector("[data-scroll-up-btn]")) return;

  const SCROLL_UP_THRESHOLD = 380;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.dataset.scrollUpBtn = "";
  button.dataset.noActionIcon = "";
  button.dataset.label = "Remonter en haut";
  button.setAttribute("aria-label", "Remonter en haut");
  button.setAttribute("title", "Remonter en haut");
  button.innerHTML =
    '<div></div><i class="fa-solid fa-arrow-up" aria-hidden="true"></i>';

  document.body.appendChild(button);

  function toggleVisibility() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    button.classList.toggle("is-visible", scrollTop > SCROLL_UP_THRESHOLD);
  }

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", toggleVisibility, { passive: true });
  toggleVisibility();
}

function normalizeActionText(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getActionIcon(element) {
  const text = normalizeActionText(
    `${element.textContent || ""} ${element.dataset.label || ""}`,
  );
  const href = element.getAttribute("href") || "";

  if (/envoyer|submit/.test(text)) return "fa-paper-plane";
  if (/copier|copy/.test(text)) return "fa-copy";
  if (/hasher|hash/.test(text)) return "fa-key";
  if (/formatter|format|formater/.test(text)) return "fa-align-left";
  if (/charger|load/.test(text)) return "fa-upload";
  if (/telecharger|download|exporter|export/.test(text)) return "fa-download";
  if (/generer|generate/.test(text)) return "fa-gears";
  if (/convertir|convert|encoder|decoder|inverser|traduire/.test(text))
    return "fa-right-left";
  if (/reinitialiser|reset/.test(text)) return "fa-rotate-left";
  if (/effacer|vider|clear|supprimer|delete/.test(text)) return "fa-trash";
  if (/ajouter|add/.test(text)) return "fa-plus";
  if (/rechercher|search/.test(text)) return "fa-magnifying-glass";
  if (/retour|back/.test(text)) return "fa-arrow-left";
  if (href === "/") return "fa-house";
  if (/contact/.test(text) || href === "/contact") return "fa-envelope";
  if (/suggest|suggestion/.test(text) || href === "/suggest")
    return "fa-lightbulb";
  if (/valider|confirm|ok/.test(text)) return "fa-check";
  if (/annuler|cancel/.test(text)) return "fa-xmark";
  if (/precedent|previous/.test(text)) return "fa-chevron-left";
  if (/suivant|next/.test(text)) return "fa-chevron-right";
  if (/haut|top/.test(text)) return "fa-angles-up";
  if (/bas|bottom/.test(text)) return "fa-angles-down";
  if (/remplacer|replace/.test(text)) return "fa-right-left";
  if (/ouvrir|open/.test(text)) return "fa-folder-open";
  if (/fermer|close/.test(text)) return "fa-xmark";
  if (/imprimer|print/.test(text)) return "fa-print";
  if (/favoris|favori|bookmark/.test(text)) return "fa-bookmark";
  if (/partager|share/.test(text)) return "fa-share-nodes";
  if (/actualiser|refresh|reload/.test(text)) return "fa-rotate";
  if (/parametres|settings/.test(text)) return "fa-gear";
  if (/aide|help/.test(text)) return "fa-circle-question";
  if (/quitter|exit/.test(text)) return "fa-right-from-bracket";
  if (/formatter|format/.test(text)) return "fa-align-left";
  if (/minifier/.test(text)) return "fa-compress";
  if (/lancer|run/.test(text)) return "fa-play";

  return "";
}

function applyActionIcons(selector = "button, .btn, .nav-links a") {
  document.querySelectorAll(selector).forEach((element) => {
    if (element.dataset.noActionIcon !== undefined) return;

    const icon = getActionIcon(element);

    if (!icon) return;

    element.dataset.actionIcon = icon;

    const existingActionIcon = element.querySelector(
      ":scope > [data-action-icon-el]",
    );
    const iconElement = existingActionIcon || document.createElement("i");

    iconElement.dataset.actionIconEl = "";
    iconElement.setAttribute("aria-hidden", "true");
    iconElement.className = `fa-solid ${icon}`;

    if (!existingActionIcon) {
      element.prepend(iconElement);
    }
  });
}

function ensureMostUsedNavbarSection(navbar) {
  if (navbar.querySelector(MOST_USED_SELECTOR)) return;

  const category = document.createElement("h3");
  category.className = "nav-category";
  category.textContent = "Les plus utilisés";

  const links = document.createElement("div");
  links.className = "nav-links";
  links.dataset.toolsMostUsed = "";

  navbar.append(category, links);
}

function buildNavbarMenu(navbar) {
  let navMenu = navbar.querySelector("[data-nav-menu]");

  if (navMenu) return navMenu;

  const navItems = [...navbar.children].filter((child) =>
    child.matches(".nav-category, .nav-links"),
  );

  if (!navItems.length) return null;

  navMenu = document.createElement("div");
  navMenu.className = "nav-menu";
  navMenu.dataset.navMenu = "";

  navbar.insertBefore(navMenu, navItems[0]);
  navItems.forEach((item) => navMenu.appendChild(item));

  return navMenu;
}

function setupResponsiveNavbar() {
  const navbar = document.querySelector(".navbar");

  if (!navbar) return;

  ensureMostUsedNavbarSection(navbar);

  const navMenu = buildNavbarMenu(navbar);

  if (!navMenu) return;

  if (navbar.querySelector("[data-nav-toggle]")) return;

  const mobileMedia = window.matchMedia(NAVBAR_MOBILE_QUERY);
  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "nav-toggle";
  toggleButton.dataset.navToggle = "";
  toggleButton.dataset.label = "Ouvrir ou fermer le menu";
  toggleButton.setAttribute("aria-controls", "nav-menu");
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.innerHTML = "<span></span>";

  navMenu.id = navMenu.id || "nav-menu";

  const overlay = document.createElement("div");
  overlay.className = "navbar-overlay";
  overlay.dataset.navOverlay = "";

  navbar.appendChild(toggleButton);
  document.body.appendChild(overlay);

  function closeMenu() {
    document.body.classList.remove("nav-open");
    toggleButton.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    if (!mobileMedia.matches) return;

    const isOpen = document.body.classList.toggle("nav-open");
    toggleButton.setAttribute("aria-expanded", String(isOpen));
  }

  toggleButton.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", closeMenu);

  navMenu.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  mobileMedia.addEventListener("change", (event) => {
    if (!event.matches) closeMenu();
  });
}

function setupNumberInputButtons() {
  const inputsContainers = document.querySelectorAll("label.form-field");
  const numberInputsContainers = Array.from(inputsContainers).filter(
    (container) => {
      const input = container.querySelector("input[type='number']");
      return input !== null;
    },
  );
  numberInputsContainers.forEach((container) => {
    const input = container.querySelector("input[type='number']"); // grab the actual input
    const wrapper = document.createElement("div");
    wrapper.className = "inc-dec-btns-wrapper";
    const addButton = document.createElement("button");
    const subButton = document.createElement("button");
    let buttons = [addButton, subButton];
    buttons.forEach((button, idx) => {
      button.type = "button";
      button.className = "number-input-btn";
      button.setAttribute("aria-hidden", "true");
      if (idx === 0) {
        button.classList.add("add");
        button.innerHTML = '<i class="fa-solid fa-caret-up"></i>';
        button.addEventListener("click", () => {
          input.value = Number(input.value || 0) + 1;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      } else {
        button.classList.add("sub");
        button.innerHTML = '<i class="fa-solid fa-caret-down"></i>';
        button.addEventListener("click", () => {
          input.value = Number(input.value || 0) - 1;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }

      wrapper.appendChild(button);
    });
    container.appendChild(wrapper);
  });
}

initFaKit();
setFooterLocation();
updateFooterDate();
setInterval(updateFooterDate, 30000 * 3);
setupResponsiveNavbar();
setupMostUsedTools();
setupToolSubmitTracking();
setupTextareaTabHandlers("textarea:not([readonly])");
setupScrollUpButton();
applyActionsLabels();
applyActionIcons("button:not([data-nav-toggle]), .btn:not(.nav-links a)");
setupHighlightJs();
setupNumberInputButtons();
