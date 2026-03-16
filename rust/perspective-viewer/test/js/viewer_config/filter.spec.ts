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

import {
    test,
    expect,
    DEFAULT_CONFIG,
    compareContentsToSnapshot,
    getShadowContents,
} from "../helpers.ts";

const get_contents = getShadowContents;

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

test.describe("Filter Config", () => {
    test("not_in > renders filtered results correctly", async ({ page }) => {
        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer");
            await viewer.restore({
                group_by: ["State"],
                columns: ["Sales"],
                settings: true,
                filter: [
                    ["State", "not in", ["California", "Texas", "New York"]],
                ],
            });
        });

        const contents = await get_contents(page);

        await compareContentsToSnapshot(contents);
    });

    test("in > generates correct config from dropdown selection", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer");
            await viewer.restore({
                group_by: ["State"],
                columns: ["Sales"],
                settings: true,
                filter: [["State", "in", []]],
            });

            const filter = viewer.shadowRoot.querySelector(
                ".pivot-column input[type=search]",
            );
            filter.value = "C";
            const event = new Event("input", {
                bubbles: true,
                cancelable: true,
            });

            filter.dispatchEvent(event);
        });

        const elem = await page.waitForSelector("perspective-dropdown");
        await page.evaluate((elem) => {
            let node = elem.shadowRoot.querySelector("span:first-of-type");
            var clickEvent = document.createEvent("MouseEvents");
            clickEvent.initEvent("mousedown", true, true);
            node.dispatchEvent(clickEvent);
        }, elem);

        const config = await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer");
            await viewer.flush();
            return await viewer.save();
        });

        expect(config).toEqual({
            ...DEFAULT_CONFIG,
            columns: ["Sales"],
            filter: [["State", "in", ["California"]]],
            group_by: ["State"],
            plugin: "Debug",
            settings: true,
        });

        const contents = await get_contents(page);
        await compareContentsToSnapshot(contents);
    });

    test("numeric input > appends digits without re-rendering on trailing zeroes", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer");
            await viewer.restore({
                filter: [["Sales", ">", 1.1]],
                settings: true,
            });
        });

        const numFilter = page.locator("perspective-viewer input.num-filter");
        await numFilter.focus();
        await numFilter.pressSequentially("0001");
        await numFilter.blur();

        const value = await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer");
            await viewer.flush();
            return viewer.shadowRoot.querySelector("input.num-filter").value;
        });

        expect(value).toEqual("1.10001");
        const contents = await get_contents(page);
        await compareContentsToSnapshot(contents);
    });
});
