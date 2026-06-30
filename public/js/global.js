import {
  applyActionsLabels,
  setupTextareaTabHandlers,
  initFaKit,
} from "./utils.js";
import { setupMostUsedTools, setupToolSubmitTracking } from "./toolUsage.js";

const HIGHLIGHT_STYLE_HREF = "/vendor/highlight.js/styles/github-dark.min.css";
const HIGHLIGHT_SCRIPT_SRC = "/vendor/highlight.js/highlight.min.js";
const NAVBAR_MOBILE_QUERY = "(max-width: 832px)";
const MOST_USED_SELECTOR = "[data-tools-most-used]";
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

function injectResponsiveNavbarStyles() {
  if (document.querySelector("[data-responsive-navbar-style]")) return;

  const style = document.createElement("style");
  style.dataset.responsiveNavbarStyle = "";
  style.textContent = `
    .nav-menu {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .nav-toggle {
      display: none;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      cursor: pointer;
      position: relative;
      padding: 6px;
      z-index: 1201;
    }

    .nav-toggle span,
    .nav-toggle::before,
    .nav-toggle::after {
      content: "";
      display: block;
      width: 20px;
      height: 2px;
      margin: 5px auto;
      border-radius: 65px;
      background: currentColor;
      transition:
        transform var(--transition),
        opacity var(--transition),
        background var(--transition);
    }

    .nav-toggle:hover {
      color: var(--primary-light);
      border-color: var(--border-orange);
    }

    .navbar-overlay {
      position: fixed;
      inset: 0;
      z-index: 1190;
      display: none;
      background: rgba(0, 0, 0, 0.52);
      backdrop-filter: blur(3px);
    }

    body.nav-open {
      overflow: hidden;
    }

    body.nav-open .navbar-overlay {
      display: block;
    }

    body.nav-open .nav-toggle span {
      opacity: 0;
    }

    body.nav-open .nav-toggle::before {
      transform: translateY(5px) translateX(2px) rotate(45deg);
      width: 20px;
    }

    body.nav-open .nav-toggle::after {
      transform: translateY(-5px) translateX(2px) rotate(-45deg);
      width: 20px;
    }

    @media (min-width: 833px) {
      .nav-menu {
        position: static;
        width: auto;
        height: auto;
        padding: 0;
        background: transparent;
        border: 0;
        box-shadow: none;
        transform: none;
      }

      .nav-category {
        display: none !important;
      }
    }

    @media (max-width: 832px) {
      .navbar {
        position: relative;
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .nav-toggle {
        display: inline-grid;
        place-items: center;
        flex: 0 0 auto;
      }

      .nav-menu {
        position: fixed;
        top: 0;
        right: 0;
        z-index: 1200;
        width: min(360px, 86vw);
        height: 100vh;
        display: flex !important;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: 10px;
        padding: 92px 22px 22px;
        background: linear-gradient(
          180deg,
          rgba(29, 35, 44, 0.98),
          rgba(12, 14, 18, 0.98)
        );
        border-left: 1px solid var(--border);
        box-shadow: -24px 0 70px rgba(0, 0, 0, 0.5);
        transform: translateX(105%);
        transition: transform var(--transition);
        overflow-y: auto;
      }

      body.nav-open .nav-menu {
        transform: translateX(0);
      }

      .nav-category {
        display: block;
        margin: 16px 0 2px;
      }

      .nav-category:first-child {
        margin-top: 0;
      }

      .nav-links {
        display: flex !important;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }

      .nav-links a {
        display: flex;
        align-items: center;
        min-height: 46px;
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.035);
        font-size: 1.04rem;
      }

      .nav-links a:hover {
        background: rgba(255, 122, 0, 0.08);
      }

      .nav-links a::before,
      .nav-links a::after {
        display: none;
      }
    }
  `;

  document.head.appendChild(style);
}

function injectActionIconStyles() {
  if (document.querySelector("[data-action-icon-style]")) return;

  const style = document.createElement("style");
  style.dataset.actionIconStyle = "";
  style.textContent = `
    [data-action-icon] {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5em;
    }

    [data-action-icon]::before,
    .nav-links a[data-action-icon]::before {
      content: attr(data-action-icon);
      position: static;
      display: inline-block;
      flex: 0 0 auto;
      width: auto;
      height: auto;
      margin: 0;
      opacity: 1;
      transform: none;
      color: currentColor;
      background: transparent;
      font-family: "Font Awesome 6 Free";
      font-size: 0.95em;
      font-style: normal;
      font-variant: normal;
      font-weight: 900;
      line-height: 1;
      text-rendering: auto;
      -webkit-font-smoothing: antialiased;
    }

    .nav-links a[data-action-icon]::after {
      display: none;
    }
  `;

  document.head.appendChild(style);
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

  if (/envoyer|submit/.test(text)) return "\uf1d8";
  if (/copier|copy/.test(text)) return "\uf0c5";
  if (/telecharger|download|exporter|export/.test(text)) return "\uf019";
  if (/generer|generate/.test(text)) return "\ue2ca";
  if (/convertir|convert|encoder|decoder|inverser|traduire/.test(text))
    return "\uf362";
  if (/reinitialiser|reset/.test(text)) return "\uf2ea";
  if (/effacer|vider|clear|supprimer|delete/.test(text)) return "\uf1f8";
  if (/ajouter|add/.test(text)) return "\u002b";
  if (/rechercher|search/.test(text)) return "\uf002";
  if (/retour|back/.test(text) || href === "/") return "\uf060";
  if (/contact/.test(text) || href === "/contact") return "\uf0e0";
  if (/suggest|suggestion/.test(text) || href === "/suggest") return "\uf0eb";

  return "";
}

function applyActionIcons(selector = "button, .btn, .nav-links a") {
  injectActionIconStyles();

  document.querySelectorAll(selector).forEach((element) => {
    if (element.dataset.noActionIcon !== undefined) return;

    const icon = getActionIcon(element);

    if (!icon) return;

    element.dataset.actionIcon = icon;
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

  injectResponsiveNavbarStyles();

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

initFaKit();
setupResponsiveNavbar();
setupMostUsedTools();
setupToolSubmitTracking();
setupTextareaTabHandlers("textarea:not([readonly])");
applyActionsLabels();
applyActionIcons("button, .btn:not(.nav-links a)");
setupHighlightJs();
