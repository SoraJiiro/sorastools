import {
  applyActionsLabels,
  setupTextareaTabHandlers,
  initFaKit,
} from "./utils.js";

function highlightCode(root = document) {
  if (!window.hljs) return;

  root.querySelectorAll("pre code").forEach((code) => {
    code.removeAttribute("data-highlighted");
    window.hljs.highlightElement(code);
  });
}

function setupHighlightJs() {
  window.applyHighlightJs = highlightCode;

  document.addEventListener("soratools:content-updated", (event) => {
    highlightCode(event.detail?.root || document);
  });

  const hljsScript = document.querySelector("script[src*='highlight']");

  if (window.hljs) {
    highlightCode();
    return;
  }

  hljsScript?.addEventListener("load", () => highlightCode(), { once: true });
  window.addEventListener("load", () => highlightCode(), { once: true });
}

function injectResponsiveNavbarStyles() {
  if (document.querySelector("[data-responsive-navbar-style]")) return;

  const style = document.createElement("style");
  style.dataset.responsiveNavbarStyle = "";
  style.textContent = `
    .nav-toggle {
      display: none;
      width: 46px;
      height: 46px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      cursor: pointer;
      position: relative;
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
      border-radius: 999px;
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
      transform: translateY(7px) rotate(45deg);
    }

    body.nav-open .nav-toggle::after {
      transform: translateY(-7px) rotate(-45deg);
    }

    @media (max-width: 980px) {
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

      .nav-links {
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
        gap: 8px;
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
      }

      body.nav-open .nav-links {
        transform: translateX(0);
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

    @media (min-width: 721px) and (max-width: 980px) {
      .site-header,
      main,
      .tech-explanation,
      .site-footer {
        width: min(1120px, calc(100% - 48px));
      }
    }
  `;

  document.head.appendChild(style);
}

function ensureContactLink(navLinks) {
  if (!navLinks || navLinks.querySelector('a[href="/contact"]')) return;

  const contactLink = document.createElement("a");
  contactLink.href = "/contact";
  contactLink.dataset.label = "Aller à la page contact";
  contactLink.textContent = "Contact";

  const suggestLink = navLinks.querySelector('a[href="/suggest"]');

  if (suggestLink) {
    suggestLink.insertAdjacentElement("afterend", contactLink);
    return;
  }

  navLinks.appendChild(contactLink);
}

function setupResponsiveNavbar() {
  const navbar = document.querySelector(".navbar");
  const navLinks = document.querySelector(".nav-links");

  if (!navbar || !navLinks) return;

  injectResponsiveNavbarStyles();
  ensureContactLink(navLinks);

  if (navbar.querySelector("[data-nav-toggle]")) return;

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "nav-toggle";
  toggleButton.dataset.navToggle = "";
  toggleButton.dataset.label = "Ouvrir ou fermer le menu";
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.innerHTML = "<span></span>";

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
    const isOpen = document.body.classList.toggle("nav-open");
    toggleButton.setAttribute("aria-expanded", String(isOpen));
  }

  toggleButton.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", closeMenu);

  navLinks.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) closeMenu();
  });
}

initFaKit();
setupResponsiveNavbar();
setupTextareaTabHandlers("textarea:not([readonly])");
applyActionsLabels();
setupHighlightJs();
