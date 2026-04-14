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

import { initTheme, createThemeToggle } from "./components/theme.js";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-css";

initTheme();
document.getElementById("theme-toggle")!.replaceWith(createThemeToggle());

const EXT_TO_LANG: Record<string, string> = {
    js: "javascript",
    mjs: "javascript",
    ts: "javascript",
    html: "markup",
    css: "css",
    json: "json",
    md: "markdown",
};

const container = document.getElementById("block-detail")!;
const params = new URL(document.location.href).searchParams;
const example = params.get("example");

if (!example) {
    container.innerHTML = "<p>No example specified.</p>";
} else {
    document.title = `Perspective - ${example}`;

    const h1 = document.createElement("h1");
    h1.textContent = example;
    container.appendChild(h1);

    const iframe = document.createElement("iframe");
    iframe.width = "960";
    iframe.height = "640";
    iframe.src = `/blocks/${example}/index.html`;
    container.appendChild(iframe);

    const br = document.createElement("br");
    container.appendChild(br);

    const link = document.createElement("a");
    link.href = `/blocks/${example}/index.html`;
    link.className = "block-detail__link";
    link.textContent = "Open in New Tab";
    link.target = "_blank";
    container.appendChild(link);

    const br2 = document.createElement("br");
    container.appendChild(br2);

    // Fetch manifest and display all source files
    fetch("/blocks/manifest.json")
        .then((res) => res.json())
        .then(async (manifest: Record<string, string[]>) => {
            const files = manifest[example] || [];
            for (const filename of files) {
                const res = await fetch(`/blocks/${example}/${filename}`);
                if (!res.ok) continue;
                const contents = await res.text();

                const title = document.createElement("div");
                title.className = "block-detail__file-title";
                title.textContent = filename;
                container.appendChild(title);

                const pre = document.createElement("pre");
                const code = document.createElement("code");
                const ext = filename.split(".").pop() || "";
                const lang = EXT_TO_LANG[ext] || "plain";
                const grammar = Prism.languages[lang];
                if (grammar) {
                    code.innerHTML = Prism.highlight(contents, grammar, lang);
                } else {
                    code.textContent = contents;
                }
                pre.appendChild(code);
                container.appendChild(pre);
            }
        });
}
