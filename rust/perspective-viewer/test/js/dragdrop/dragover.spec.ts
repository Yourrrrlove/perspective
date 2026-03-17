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

import { test, expect } from "@perspective-dev/test";
import { compareContentsToSnapshot } from "../helpers.ts";
import { PageView } from "@perspective-dev/test";
import {
    ACTIVE_DRAG,
    getSettingsPanelContents,
    INACTIVE_DRAG,
    localDrag,
    shadowDragOver,
} from "./dragdrop_test_utils";

test.beforeEach(async ({ page }) => {
    await page.goto(
        "/rust/perspective-viewer/test/html/column-settings-enabled.html",
    );
    await page.evaluate(async () => {
        while (!(window as any)["__TEST_PERSPECTIVE_READY__"]) {
            await new Promise((x) => setTimeout(x, 10));
        }
    });
});

test.describe("Drag and Drop", () => {
    // Drag over a target without releasing (no drop)
    // Tests the intermediate UI state — dragover highlights, etc.
    test.describe("dragover (without drop)", () => {
        test("inactive column dragged over Active Columns", async ({
            page,
        }) => {
            const view = new PageView(page);
            await view.restore({ settings: true, columns: ["Sales"] });
            await shadowDragOver(
                page,
                view.container.locator(INACTIVE_DRAG).first(),
                view.container
                    .locator("#active-columns .column-selector-column")
                    .nth(0),
            );

            const config = await view.save();
            expect(config.columns).toEqual(["Sales"]);
            expect(config.columns).toEqual(["Sales"]);
            const contents = await getSettingsPanelContents(page);
            await page.pause();
            await compareContentsToSnapshot(contents);
        });

        test("inactive column dragged over Group By", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({ settings: true, columns: ["Sales"] });
            await shadowDragOver(
                page,
                view.container.locator(INACTIVE_DRAG).first(),
                view.container.locator("#group_by"),
            );
            const config = await view.save();
            expect(config.group_by).toEqual([]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("inactive column dragged over Split By", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({ settings: true, columns: ["Sales"] });
            await shadowDragOver(
                page,
                view.container.locator(INACTIVE_DRAG).first(),
                view.container.locator("#split_by"),
            );
            const config = await view.save();
            expect(config.split_by).toEqual([]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("inactive column dragged over Sort", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({ settings: true, columns: ["Sales"] });
            await shadowDragOver(
                page,
                view.container.locator(INACTIVE_DRAG).first(),
                view.container.locator("#sort"),
            );
            const config = await view.save();
            expect(config.sort).toEqual([]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("inactive column dragged over Filter", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({ settings: true, columns: ["Sales"] });
            await shadowDragOver(
                page,
                view.container.locator(INACTIVE_DRAG).first(),
                view.container.locator("#filter"),
            );
            const config = await view.save();
            expect(config.filter).toEqual([]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("active column dragged over Group By", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({
                settings: true,
                columns: ["Sales", "Profit"],
            });

            await shadowDragOver(
                page,
                view.container.locator(ACTIVE_DRAG).first(),
                view.container.locator("#group_by"),
            );
            const config = await view.save();
            expect(config.group_by).toEqual([]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("active column dragged over Split By", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({
                settings: true,
                columns: ["Sales", "Profit"],
            });

            await shadowDragOver(
                page,
                view.container.locator(ACTIVE_DRAG).first(),
                view.container.locator("#split_by"),
            );
            const config = await view.save();
            expect(config.split_by).toEqual([]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("active column dragged over Sort", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({
                settings: true,
                columns: ["Sales", "Profit"],
            });

            await shadowDragOver(
                page,
                view.container.locator(ACTIVE_DRAG).first(),
                view.container.locator("#sort"),
            );
            const config = await view.save();
            expect(config.sort).toEqual([]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("active column dragged over Filter", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({
                settings: true,
                columns: ["Sales", "Profit"],
            });

            await shadowDragOver(
                page,
                view.container.locator(ACTIVE_DRAG).first(),
                view.container.locator("#filter"),
            );

            const config = await view.save();
            expect(config.filter).toEqual([]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });
    });
});
