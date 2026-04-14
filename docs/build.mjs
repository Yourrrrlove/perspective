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

import puppeteer from "puppeteer";
import * as fs from "node:fs";
import * as cp from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import EXAMPLES from "./src/data/features.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// features.js uses CJS exports.default, import it dynamically
// const EXAMPLES = (await import("./src/data/features.ts")).default;

const perspective = import(
    "@perspective-dev/client/dist/esm/perspective.node.js"
);

const DEFAULT_VIEWPORT = {
    width: 400,
    height: 300,
};

async function run_with_theme(page, is_dark = false, order) {
    await page.goto("http://localhost:8080/");
    await page.setContent(template(is_dark));
    await page.setViewport(DEFAULT_VIEWPORT);
    await page.evaluate(async () => {
        while (!window.__TEST_PERSPECTIVE_READY__) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    });

    await page.evaluate(async function () {
        const viewer = document.querySelector("perspective-viewer");
        await viewer.flush();
        await viewer.toggleConfig();
    });

    for (const idx in EXAMPLES) {
        const { config, viewport } = EXAMPLES[idx];
        await page.setViewport(viewport || DEFAULT_VIEWPORT);
        const new_config = Object.assign(
            {
                plugin: "Datagrid",
                group_by: [],
                expressions: {},
                split_by: [],
                sort: [],
                aggregates: {},
            },
            config,
        );
        console.log(JSON.stringify(new_config));

        await page.evaluate(async (config) => {
            const viewer = document.querySelector("perspective-viewer");
            await viewer.reset();
            await viewer.restore(config);
        }, new_config);

        const screenshot = await page.screenshot({
            captureBeyondViewport: false,
            fullPage: true,
        });

        const name = `static/features/feature_${idx}${
            is_dark ? "_dark" : ""
        }.png`;

        fs.writeFileSync(name, screenshot);
        cp.execSync(`convert ${name} -resize 200x150 ${name}`);
    }

    const suffix = is_dark ? "_dark" : "";
    const montage_files = order.map(
        (idx) => `static/features/feature_${idx}${suffix}.png`,
    );

    cp.execSync(
        `montage -mode concatenate -background none -tile 5x ${montage_files.join(
            " ",
        )} static/features/montage${is_dark ? "_dark" : "_light"}.png`,
    );
}

async function run() {
    if (
        !fs.existsSync("static/features") ||
        fs.readdirSync("static/features").length === 0
    ) {
        console.log("Generating feature screenshots!");
        fs.mkdirSync(path.join(__dirname, "static/features"), {
            recursive: true,
        });

        const x = await perspective;
        const server = new x.WebSocketServer({
            assets: [
                path.join(__dirname, "."),
                path.join(__dirname, "../node_modules"),
            ],
        });

        const indices = Array.from({ length: EXAMPLES.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await run_with_theme(page, false, indices);
        await run_with_theme(page, true, indices);
        await page.close();
        await browser.close();
        await server.close();

        fs.writeFileSync(
            path.join(__dirname, "static/features/montage_map.json"),
            JSON.stringify({
                tile_width: 200,
                tile_height: 150,
                columns: 5,
                order: indices,
            }),
        );
    }

    if (!fs.existsSync("static/blocks")) {
        fs.mkdirSync("static/blocks");
    }

    const { dist_examples } = await import("../examples/blocks/index.mjs");
    await dist_examples(`${__dirname}/static/blocks`);
}

function template(is_dark) {
    return fs
        .readFileSync(path.join(__dirname, "template.html"))
        .toString()
        .replace("/css/pro.css", is_dark ? "/css/pro-dark.css" : "/css/pro.css")
        .trim();
}

run();
