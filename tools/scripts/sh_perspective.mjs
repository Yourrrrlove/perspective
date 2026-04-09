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

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

import "zx/globals";

dotenv.config({ path: "./.perspectiverc", quiet: true });
process.env.FORCE_COLOR = true;

/**
 * Calls `path.resolve` on each of the input path arguments, then removes the
 * path if it exists.
 *
 * @param {string} dirs paths to clean.
 * @example
 * clean("a/b/c"); // Cleans this dir
 * clean("a/b/c", "d/e/f"); // Cleans both dirs
 */
export function clean(...dirs) {
    for (const dir of dirs) {
        const resolved = path.resolve(dir);
        if (fs.existsSync(resolved)) {
            fs.rmSync(resolved, { recursive: true, force: true });
        }
    }
}

/**
 * Returns the value after this command-line flag, or `true` if it is the last
 * arg.  This makes it easy to null-pun for boolean flags, and capture the
 * argument for argument-providing flags, and respect quotes and parens, in
 * one function.  Can be used as a template literal - not sure why, 2 less
 * characters?
 *
 * @param {string} flag The command line flag name.  Returns all arguments if
 *     this param is `undefined`.
 * @returns {string} The next argument after this flag in the command args, or
 *     `true.
 * @example
 * console.assert(getarg`--debug`);
 */
export function getarg(flag, ...args) {
    if (Array.isArray(flag)) {
        flag = flag.map((x, i) => x + (args[i] || "")).join("");
    }
    const argv = process.argv.slice(2);
    if (flag) {
        const index = argv.indexOf(flag);
        if (index > -1) {
            const next = argv[index + 1];
            if (next) {
                return next;
            } else {
                return true;
            }
        }
    } else {
        return argv
            .map(function (arg) {
                return "'" + arg.replace(/'/g, "'\\''") + "'";
            })
            .join(" ");
    }
}

export function get_scope() {
    const package_venn = (process.env.PACKAGE || "").split(",").reduce(
        (acc, x) => {
            if (x.startsWith("!")) {
                acc.exclude.push(x);
            } else if (x != "") {
                acc.include.push(x);
            }

            return acc;
        },
        { include: [], exclude: [] },
    );

    let packages;
    if (package_venn.include.length === 0) {
        packages = JSON.parse($.sync`pnpm m ls --json --depth=-1`.toString())
            .filter((x) => x.name !== undefined)
            .map((x) => x.name.replace("@perspective-dev/", ""))
            .filter((x) => package_venn.exclude.indexOf(`!${x}`) === -1);
    } else {
        packages = package_venn.include.filter(
            (x) => package_venn.exclude.indexOf(`!${x}`) === -1,
        );
    }

    return packages;
}

export const run_with_scope = async function run_recursive(strings, ...args) {
    let scope = get_scope();
    const cmd = strings[0].split(" ")[0];
    const filters = scope.map((x) => `--filter ${x} --if-present`).join(" ");
    execSync(`pnpm run --sequential --recursive ${filters} ${cmd}`, {
        stdio: "inherit",
    });
};
