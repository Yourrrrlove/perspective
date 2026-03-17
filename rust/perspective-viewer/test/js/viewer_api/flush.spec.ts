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

import { test, expect } from "../helpers.ts";

test.beforeEach(async ({ page }) => {
    await page.goto("/rust/perspective-viewer/test/html/superstore.html");
    await page.evaluate(async () => {
        while (!window["__TEST_PERSPECTIVE_READY__"]) {
            await new Promise((x) => setTimeout(x, 10));
        }
    });

    await page.evaluate(async () => {
        await document.querySelector("perspective-viewer").restore({
            plugin: "Debug",
        });
    });
});

test.describe("Flush method", async () => {
    test("flush > awaits settings field update", async ({ page }) => {
        const old_config = await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer");
            return await viewer.save();
        });

        expect(old_config.settings).toBeFalsy();
        const config = await page.evaluate(async (columns) => {
            const viewer = document.querySelector("perspective-viewer");
            await viewer.getTable();
            viewer.restore({
                settings: true,
            });

            await viewer.flush();
            return await viewer.save();
        });

        expect(config).toEqual({
            ...old_config,
            settings: true,
        });
    });

    test("flush > awaits view query field updates", async ({ page }) => {
        const old_config = await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer");
            return await viewer.save();
        });

        expect(old_config.settings).toBeFalsy();
        const config = await page.evaluate(async (columns) => {
            const viewer = document.querySelector("perspective-viewer");
            await viewer.getTable();
            viewer.restore({
                settings: true,
                group_by: ["State", "City"],
                split_by: ["Category"],
            });

            await viewer.flush();
            return await viewer.save();
        });

        expect(config).toEqual({
            ...old_config,
            group_by: ["State", "City"],
            split_by: ["Category"],
            settings: true,
        });
    });

    test("flush > awaits config-update event triggered by restore", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer");
            await viewer.getTable();
            let count = 0;
            viewer.addEventListener("perspective-config-update", () => {
                count++;
            });

            viewer.restore({
                settings: true,
                group_by: ["State", "City"],
                split_by: ["Category"],
            });

            const first = count;
            await viewer.flush();
            const second = count;
            return [first, second];
        });

        expect(result).toEqual([0, 1]);
    });

    test("flush > awaits config-update event on load and does not repeat on DOM connect", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer");
            const table = await viewer.getTable();
            await viewer.delete();
            viewer.parentElement.removeChild(viewer);

            const new_viewer = document.createElement("perspective-viewer");
            let count = 0;

            new_viewer.addEventListener("perspective-config-update", () => {
                count++;
            });

            new_viewer.load(table);
            const first = count;
            await new_viewer.flush();
            const second = count;
            document.body.appendChild(new_viewer);
            await new_viewer.flush();
            const third = count;
            return [first, second, third];
        });

        expect(result).toEqual([0, 1, 1]);
    });
});
