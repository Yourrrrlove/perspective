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

import { NodeModulesExternal } from "@perspective-dev/esbuild-plugin/external.js";
import { build } from "@perspective-dev/esbuild-plugin/build.js";
import { bundleAsync as bundleCssAsync } from "lightningcss";
import * as fs from "node:fs";
import {
    resolveNPM,
    inlineUrlVisitor,
} from "@perspective-dev/viewer/tools.mjs";

const BUILD = [
    {
        entryPoints: ["src/js/plugin/plugin.js"],
        plugins: [NodeModulesExternal()],
        format: "esm",
        outfile: "dist/esm/perspective-viewer-openlayers.js",
        loader: {
            ".css": "text",
        },
    },
    {
        entryPoints: ["src/js/plugin/plugin.js"],
        plugins: [],
        format: "esm",
        outfile: "dist/cdn/perspective-viewer-openlayers.js",
        loader: {
            ".css": "text",
        },
    },
];

async function compile_css() {
    fs.mkdirSync("dist/css", { recursive: true });
    const filename = "./src/css/perspective-viewer-openlayers.css";
    const { code } = await bundleCssAsync({
        filename,
        minify: true,
        resolver: resolveNPM(import.meta.url),
        visitor: inlineUrlVisitor(filename),
    });
    fs.writeFileSync("dist/css/perspective-viewer-openlayers.css", code);
}

async function build_all() {
    await compile_css();
    await Promise.all(BUILD.map(build)).catch(() => process.exit(1));
}

build_all();
