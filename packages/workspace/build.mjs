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
import { WasmPlugin } from "@perspective-dev/esbuild-plugin/wasm.js";
import { WorkerPlugin } from "@perspective-dev/esbuild-plugin/worker.js";
import { ResolvePlugin } from "@perspective-dev/esbuild-plugin/resolve.js";
import { build } from "@perspective-dev/esbuild-plugin/build.js";
import {
    bundle as bundleCss,
    bundleAsync as bundleCssAsync,
} from "lightningcss";
import * as fs from "node:fs";
// import { createRequire } from "node:module";
import {
    inlineUrlVisitor,
    resolveNPM,
} from "@perspective-dev/viewer/tools.mjs";

import "zx/globals";

// const _require = createRequire(import.meta.url);

const BUILD = [
    {
        entryPoints: ["src/ts/perspective-workspace.ts"],
        define: {
            global: "window",
        },
        format: "esm",
        plugins: [
            // Inlining `lumino` and importing the `.ts` source saves _50kb_
            NodeModulesExternal("@lumino"),
        ],
        loader: {
            ".html": "text",
            ".css": "text",
        },
        external: ["*.wasm"],
        outfile: "dist/esm/perspective-workspace.js",
    },
    {
        entryPoints: ["src/ts/perspective-workspace.ts"],
        define: {
            global: "window",
        },
        plugins: [
            ResolvePlugin({
                "@perspective-dev/client":
                    "@perspective-dev/client/dist/esm/perspective.js",
                "@perspective-dev/viewer":
                    "@perspective-dev/viewer/dist/esm/perspective-viewer.js",
            }),
            WasmPlugin(false),
            WorkerPlugin({ inline: false }),
        ],
        format: "esm",
        splitting: true,
        loader: {
            ".css": "text",
            ".html": "text",
        },
        outdir: "dist/cdn",
    },
];

async function build_all() {
    fs.mkdirSync("dist/css", { recursive: true });
    const { code: wsCode } = await bundleCssAsync({
        filename: "./src/css/workspace.css",
        resolver: resolveNPM(import.meta.url),
        minify: true,
        errorRecovery: true,
        visitor: inlineUrlVisitor("./src/css/workspace.css"),
    });

    fs.writeFileSync("dist/css/workspace.css", wsCode);
    const { code: injCode } = await bundleCssAsync({
        filename: "./src/css/injected.css",
        resolver: resolveNPM(import.meta.url),
        minify: true,
        errorRecovery: true,
        visitor: inlineUrlVisitor("./src/css/workspace.css"),
    });

    // Workspace themes — bundle with lightningcss (resolves @imports)
    fs.writeFileSync("dist/css/injected.css", injCode);
    const { code: proCode } = bundleCss({
        filename: "./src/themes/pro.css",
        minify: true,
        visitor: inlineUrlVisitor("./src/themes/pro.css"),
    });

    fs.writeFileSync("dist/css/pro.css", proCode);
    const { code: proDarkCode } = bundleCss({
        filename: "./src/themes/pro-dark.css",
        minify: true,
        visitor: inlineUrlVisitor("./src/themes/pro-dark.css"),
    });

    fs.writeFileSync("dist/css/pro-dark.css", proDarkCode);
    await Promise.all(BUILD.map(build)).catch(() => process.exit(1));
    try {
        await $`tsc --project ./tsconfig.json`.stdio(
            "inherit",
            "inherit",
            "inherit",
        );
    } catch (e) {
        console.error(e.stdout);
        process.exit(1);
    }
}

build_all();
