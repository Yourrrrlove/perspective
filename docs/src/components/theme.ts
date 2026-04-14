// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃ ██████ ██████ ██████       █      █      █      █      █ █▄  ▀███ █       ┃
// ┃ ▄▄▄▄▄█ █▄▄▄▄▄ ▄▄▄▄▄█  ▀▀▀▀▀█▀▀▀▀▀ █ ▀▀▀▀▀█ ████████▌▐███ ███▄  ▀█ █ ▀▀▀▀▀ ┃
// ┃ █▀▀▀▀▀ █▀▀▀▀▀ █▀██▀▀ ▄▄▄▄▄ █ ▄▄▄▄▄█ ▄▄▄▄▄█ ████████▌▐███ █████▄   █ ▄▄▄▄▄ ┃
// ┃ █      ██████ █  ▀█▄       █ ██████      █      ███▌▐███ ███████▄ █       ┃
// ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
// ┃ Copyright (c) 2017, the Perspective Authors.                              ┃
// ┃ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ┃
// ┃ This file is part of the Perspective library, distributed under the terms ┃
// ┃ of the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

import type { HTMLPerspectiveViewerElement } from "@perspective-dev/viewer";

const SUN_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM11 1h2v3h-2V1zm0 19h2v3h-2v-3zM3.515 4.929l1.414-1.414L7.05 5.636 5.636 7.05 3.515 4.93zM16.95 18.364l1.414-1.414 2.121 2.121-1.414 1.414-2.121-2.121zm2.121-14.85l1.414 1.415-2.121 2.121-1.414-1.414 2.121-2.121zM5.636 16.95l1.414 1.414-2.121 2.121-1.414-1.414 2.121-2.121zM23 11v2h-3v-2h3zM4 11v2H1v-2h3z"/></svg>`;
const MOON_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 7a7 7 0 0 0 12 4.9v.1c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2h.1A6.979 6.979 0 0 0 10 7zm-6 5a8 8 0 0 0 15.062 3.762A9 9 0 0 1 8.238 4.938 7.999 7.999 0 0 0 4 12z"/></svg>`;

export function getColorMode(): "dark" | "light" {
    const stored = localStorage.getItem("perspective-theme");
    if (stored === "dark" || stored === "light") {
        return stored;
    }

    return "dark";
}

export function applyTheme(mode?: "dark" | "light") {
    const theme = mode ?? getColorMode();
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("perspective-theme", theme);

    const viewer = document.querySelector(
        ".demo perspective-viewer",
    ) as HTMLPerspectiveViewerElement;
    viewer?.restore?.({ theme: theme === "dark" ? "Pro Dark" : "Pro Light" });

    // Swap navbar logo
    const navLogo = document.querySelector(
        ".navbar__logo img",
    ) as HTMLImageElement | null;
    if (navLogo) {
        navLogo.src =
            theme === "dark"
                ? "/svg/perspective-logo-dark.svg"
                : "/svg/perspective-logo-light.svg";
    }

    // Swap footer logo
    const footerLogo = document.getElementById("footer-logo") as
        | HTMLImageElement
        | undefined;
    if (footerLogo) {
        footerLogo.src =
            theme === "dark"
                ? "/img/openjs_foundation-logo-horizontal-white.png"
                : "/img/openjs_foundation-logo-horizontal-black.png";
    }

    // Swap gallery montage
    const galleryImg = document.querySelector(
        ".gallery img",
    ) as HTMLImageElement | null;
    if (galleryImg) {
        galleryImg.src =
            theme === "dark"
                ? "/features/montage_dark.png"
                : "/features/montage_light.png";
    }

    // Update toggle button icon
    const toggleBtn = document.getElementById("theme-toggle-btn");
    if (toggleBtn) {
        toggleBtn.innerHTML = theme === "dark" ? SUN_SVG : MOON_SVG;
        toggleBtn.setAttribute(
            "aria-label",
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        );
    }
}

export function initTheme() {
    applyTheme();
}

export function createThemeToggle(): HTMLElement {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.id = "theme-toggle-btn";
    btn.className = "theme-toggle";
    btn.type = "button";
    const current = getColorMode();
    btn.innerHTML = current === "dark" ? SUN_SVG : MOON_SVG;
    btn.setAttribute(
        "aria-label",
        current === "dark" ? "Switch to light mode" : "Switch to dark mode",
    );
    btn.addEventListener("click", () => {
        const next = getColorMode() === "dark" ? "light" : "dark";
        applyTheme(next);
    });
    li.appendChild(btn);
    return li;
}

export function getPerspectiveTheme(): string {
    return getColorMode() === "dark" ? "Pro Dark" : "Pro Light";
}
