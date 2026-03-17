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
    test.describe("drop", () => {
        test("inactive to first active columns", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({
                settings: true,
                columns: ["Sales", "Profit"],
            });

            const configUpdated = await view.getEventListener(
                "perspective-config-update",
            );

            const source = view.container.locator(INACTIVE_DRAG).first();
            const target = view.container
                .locator("#active-columns .column-selector-column")
                .nth(0);

            await localDrag(page, source, target);
            await configUpdated();
            const config = await view.save();
            expect(config.columns).toEqual(["Category", "Sales", "Profit"]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("inactive to second active columns", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({
                settings: true,
                columns: ["Sales", "Profit"],
            });

            const configUpdated = await view.getEventListener(
                "perspective-config-update",
            );

            const source = view.container.locator(INACTIVE_DRAG).first();
            const target = view.container
                .locator("#active-columns .column-selector-column")
                .nth(1);

            await localDrag(page, source, target);
            await configUpdated();
            const config = await view.save();
            expect(config.columns).toEqual(["Sales", "Category", "Profit"]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("active to active (reorder)", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({
                settings: true,
                columns: ["Sales", "Profit", "Quantity"],
            });

            const configUpdated = await view.getEventListener(
                "perspective-config-update",
            );

            const source = view.container.locator(ACTIVE_DRAG).first();

            // Drop the first active column onto the third position.
            const target = view.container
                .locator("#active-columns .column-selector-column")
                .nth(2);

            await localDrag(page, source, target);
            await configUpdated();
            const config = await view.save();
            expect(config.columns).toEqual(["Profit", "Quantity", "Sales"]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("inactive to Group By", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({ settings: true, columns: ["Sales"] });
            const configUpdated = await view.getEventListener(
                "perspective-config-update",
            );

            const source = view.container.locator(INACTIVE_DRAG).first();
            const target = view.container.locator("#group_by");
            await localDrag(page, source, target);
            await configUpdated();
            const config = await view.save();
            expect(config.group_by).toEqual(["Category"]);
            expect(config.columns).toEqual(["Sales"]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("inactive to Split By", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({ settings: true, columns: ["Sales"] });
            const configUpdated = await view.getEventListener(
                "perspective-config-update",
            );

            const source = view.container.locator(INACTIVE_DRAG).first();
            const target = view.container.locator("#split_by");
            await localDrag(page, source, target);
            await configUpdated();
            const config = await view.save();
            expect(config.split_by).toEqual(["Category"]);
            expect(config.columns).toEqual(["Sales"]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("inactive to Sort", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({ settings: true, columns: ["Sales"] });
            const configUpdated = await view.getEventListener(
                "perspective-config-update",
            );

            const source = view.container.locator(INACTIVE_DRAG).first();
            const target = view.container.locator("#sort");
            await localDrag(page, source, target);
            await configUpdated();
            const config = await view.save();
            expect(config.columns).toEqual(["Sales"]);
            expect(config.sort).toEqual([["Category", "asc"]]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });

        test("inactive to Filter", async ({ page }) => {
            const view = new PageView(page);
            await view.restore({ settings: true, columns: ["Sales"] });
            const configUpdated = await view.getEventListener(
                "perspective-config-update",
            );

            const source = view.container.locator(INACTIVE_DRAG).first();
            const target = view.container.locator("#filter");
            await localDrag(page, source, target);
            await configUpdated();
            const config = await view.save();
            expect(config.filter).toEqual([["Category", "==", null]]);
            expect(config.columns).toEqual(["Sales"]);
            const contents = await getSettingsPanelContents(page);
            await compareContentsToSnapshot(contents);
        });
    });
});
