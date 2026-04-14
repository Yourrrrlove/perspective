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

import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "module";
import { bundleAsync as bundleCssAsync, composeVisitors } from "lightningcss";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist");

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const child of fs.readdirSync(src)) {
            copyRecursive(path.join(src, child), path.join(dest, child));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Inline url() asset references as data URIs.
export function inlineUrlVisitor(fromFile) {
    const dir = path.dirname(fromFile);
    return composeVisitors([
        {
            Url(url) {
                const ext = path.extname(url.url).toLowerCase();
                if (![".svg", ".png", ".gif"].includes(ext)) {
                    return;
                }

                const resolved = path.resolve(dir, url.url);
                if (!fs.existsSync(resolved)) {
                    throw new Error(`File not found ${url.url}`);
                    // return;
                }

                const content = fs.readFileSync(resolved);
                const mime =
                    ext === ".svg"
                        ? "image/svg+xml"
                        : ext === ".png"
                          ? "image/png"
                          : "image/gif";

                const new_content = content
                    .toString("base64")
                    .split("\n")
                    .map((x) => x.trim())
                    .join("");

                return {
                    url: `data:${mime};base64,${new_content}`,
                    loc: url.loc,
                };
            },
        },
    ]);
}

export const resolveNPM = (url) => ({
    read(filePath) {
        if (filePath.startsWith("http")) {
            return `@import url("${filePath}");`;
        }

        return fs.readFileSync(filePath, "utf8");
    },
    resolve(specifier, from) {
        if (specifier.startsWith("http")) {
            return { external: specifier };
        }

        const _require = createRequire(url);

        if (specifier.startsWith(".") || specifier.startsWith("/")) {
            return path.resolve(path.dirname(from), specifier);
        }

        return _require.resolve(specifier);
    },
});

async function build() {
    // Clean and create dist
    fs.mkdirSync(DIST, { recursive: true });

    // Bundle CSS
    const { code: cssCode } = await bundleCssAsync({
        filename: path.join(__dirname, "./src/css/style.css"),
        minify: true,
        resolver: resolveNPM(import.meta.url),
        visitor: inlineUrlVisitor("./src/css/style.css"),
    });

    fs.mkdirSync(path.join(DIST, "css"), { recursive: true });
    fs.writeFileSync(path.join(DIST, "style.css"), cssCode);

    // Bundle JS entry points
    await esbuild.build({
        entryPoints: [
            path.join(__dirname, "src/index.ts"),
            path.join(__dirname, "src/examples.ts"),
            path.join(__dirname, "src/block.ts"),
        ],
        bundle: true,
        splitting: true,
        format: "esm",
        outdir: DIST,
        minify: true,
        sourcemap: true,
        target: ["es2022"],
        define: {
            global: "window",
        },
        loader: {
            ".wasm": "file",
            ".arrow": "file",
        },
    });

    // Copy HTML files
    for (const html of ["index.html", "examples.html", "block.html"]) {
        fs.copyFileSync(
            path.join(__dirname, "src", html),
            path.join(DIST, html),
        );
    }

    // Copy static assets
    copyRecursive(path.join(__dirname, "static"), DIST);

    // Generate blocks manifest
    const blocksDir = path.join(DIST, "blocks");
    if (fs.existsSync(blocksDir)) {
        const manifest = {};
        for (const example of fs.readdirSync(blocksDir)) {
            const exDir = path.join(blocksDir, example);
            if (!fs.statSync(exDir).isDirectory()) continue;
            manifest[example] = fs
                .readdirSync(exDir)
                .filter(
                    (f) =>
                        !f.startsWith(".") &&
                        !f.endsWith(".png") &&
                        !f.endsWith(".arrow"),
                );
        }
        fs.writeFileSync(
            path.join(blocksDir, "manifest.json"),
            JSON.stringify(manifest),
        );
    }

    console.log("Build complete: dist/");
}

build().catch((e) => {
    console.error(e);
    process.exit(1);
});
