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

import { test, expect, DEFAULT_CONFIG, API_VERSION } from "../helpers.ts";

test.beforeEach(async ({ page }) => {
    await page.goto(
        "/node_modules/@perspective-dev/viewer/test/html/plugin-priority-order.html",
    );
    await page.evaluate(async () => {
        while (!window["__TEST_PERSPECTIVE_READY__"]) {
            await new Promise((x) => setTimeout(x, 10));
        }
    });
});

test.describe("Close button", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/rust/perspective-viewer/test/html/superstore.html");
        await page.evaluate(async () => {
            while (!window["__TEST_PERSPECTIVE_READY__"]) {
                await new Promise((x) => setTimeout(x, 10));
            }
        });

        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer");
            await viewer.restore({ plugin: "Debug" });
            await viewer.getTable();
            await viewer.restore({ settings: true });
        });
    });

    test("close button hides the settings panel", async ({ page }) => {
        const shadowRoot = page.locator("perspective-viewer");
        await shadowRoot.locator("#settings_close_button").first().click();

        const saved = await page.evaluate(async () =>
            document.querySelector("perspective-viewer").save(),
        );

        expect(saved.settings).toBe(false);
    });

    test("settings panel round-trips open/close via save()", async ({
        page,
    }) => {
        // Open → close via API → open again.  save() must reflect each state.
        const saved1 = await page.evaluate(async () =>
            document.querySelector("perspective-viewer").save(),
        );
        expect(saved1.settings).toBe(true);

        await page.evaluate(async () =>
            document.querySelector("perspective-viewer").restore({
                settings: false,
            }),
        );

        const saved2 = await page.evaluate(async () =>
            document.querySelector("perspective-viewer").save(),
        );

        expect(saved2.settings).toBe(false);

        await page.evaluate(async () =>
            document.querySelector("perspective-viewer").restore({
                settings: true,
            }),
        );

        const saved3 = await page.evaluate(async () =>
            document.querySelector("perspective-viewer").save(),
        );

        expect(saved3.settings).toBe(true);
    });
});
