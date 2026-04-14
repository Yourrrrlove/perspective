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

initTheme();
document.getElementById("theme-toggle")!.replaceWith(createThemeToggle());

const LOCAL_EXAMPLES = [
    "editable",
    "file",
    "duckdb",
    "fractal",
    "market",
    "raycasting",
    "evictions",
    "nypd",
    "streaming",
    "covid",
    "webcam",
    "movies",
    "superstore",
    "olympics",
    "dataset",
];

function partition<T>(input: T[], spacing: number): T[][] {
    const output: T[][] = [];
    for (let i = 0; i < input.length; i += spacing) {
        output.push(input.slice(i, i + spacing));
    }
    return output;
}

const grid = document.getElementById("examples-grid")!;

const table = document.createElement("table");
const tbody = document.createElement("tbody");

for (const group of partition(LOCAL_EXAMPLES, 2)) {
    const tr = document.createElement("tr");
    for (const name of group) {
        const td = document.createElement("td");
        const a = document.createElement("a");
        a.href = `/block.html?example=${name}`;

        const br = document.createElement("br");
        a.appendChild(br);

        const h4 = document.createElement("h4");
        h4.textContent = name;
        a.appendChild(h4);

        const img = document.createElement("img");
        img.width = 400;
        img.src = `/blocks/${name}/preview.png`;
        a.appendChild(img);

        td.appendChild(a);
        tr.appendChild(td);
    }
    tbody.appendChild(tr);
}

table.appendChild(tbody);
grid.appendChild(table);
