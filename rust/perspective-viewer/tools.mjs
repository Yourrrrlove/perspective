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

import { execSync } from "child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { bundle as bundleCss, composeVisitors } from "lightningcss";

import { createRequire } from "node:module";

const INHERIT = {
    stdio: "inherit",
    stderr: "inherit",
};

export function get_host() {
    return /host\: (.+?)$/gm.exec(execSync(`rustc -vV`).toString())[1];
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
                    return;
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
