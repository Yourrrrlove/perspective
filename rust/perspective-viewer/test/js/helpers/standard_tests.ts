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

import type { ViewerConfigUpdate } from "@perspective-dev/viewer";
import { test, compareContentsToSnapshot } from "../helpers.ts";

export type ContentExtractor = (page: any) => Promise<string>;

async function restoreViewer(page: any, viewerConfig: ViewerConfigUpdate) {
    return await page.evaluate(async (viewerConfig: ViewerConfigUpdate) => {
        const viewer = document.querySelector("perspective-viewer")!;
        await viewer.restore(viewerConfig);
    }, viewerConfig);
}

function runSimpleCompareTest(
    viewerConfig: ViewerConfigUpdate,
    extractContent: ContentExtractor,
    snapshotPath: string[],
) {
    return async ({ page }: { page: any }) => {
        await restoreViewer(page, viewerConfig);
        const content = await extractContent(page);
        await compareContentsToSnapshot(content);
    };
}

export function run_standard_tests(
    context: string,
    extractContent: ContentExtractor,
) {
    test("grid > renders without settings panel", async ({ page }) => {
        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer")!;
            await viewer.getTable();
            await viewer.restore({ settings: true });
        });

        const content = await extractContent(page);
        await compareContentsToSnapshot(content);
    });

    test("columns > displays only visible columns", async ({ page }) => {
        await restoreViewer(page, {
            columns: ["Discount", "Profit", "Sales", "Quantity"],
        });

        const visibleColumnContent = await extractContent(page);
        await compareContentsToSnapshot(visibleColumnContent);
    });

    test.describe("Pivot tests", () => {
        test(
            "group_by > pivots by a single row",
            runSimpleCompareTest(
                { group_by: ["State"], settings: true },
                extractContent,
                [context, `pivot-by-row.txt`],
            ),
        );

        test(
            "group_by > pivots by two rows",
            runSimpleCompareTest(
                {
                    group_by: ["Category", "Sub-Category"],
                    settings: true,
                },
                extractContent,
                [context, `pivot-by-two-rows.txt`],
            ),
        );

        test(
            "split_by > pivots by a single column",
            runSimpleCompareTest(
                { split_by: ["Category"], settings: true },
                extractContent,
                [context, `pivot-by-column.txt`],
            ),
        );

        test(
            "pivot > pivots by a row and a column",
            runSimpleCompareTest(
                {
                    group_by: ["State"],
                    split_by: ["Category"],
                    settings: true,
                },
                extractContent,
                [context, `pivot-by-row-and-column.txt`],
            ),
        );

        test(
            "pivot > pivots by two rows and two columns",
            runSimpleCompareTest(
                {
                    group_by: ["Region", "State"],
                    split_by: ["Category", "Sub-Category"],
                    settings: true,
                },
                extractContent,
                [context, `pivot-by-two-rows-and-two-columns.txt`],
            ),
        );
    });

    test.describe("Sort tests", () => {
        test(
            "sort > sorts by a hidden column",
            runSimpleCompareTest(
                {
                    columns: ["Row ID", "Quantity"],
                    sort: [["Sales", "asc"]],
                    settings: true,
                },
                extractContent,
                [context, `sort-by-hidden-column.txt`],
            ),
        );

        test(
            "sort > sorts by a numeric column",
            runSimpleCompareTest(
                {
                    columns: ["Row ID", "Sales"],
                    sort: [["Quantity", "asc"]],
                    settings: true,
                },
                extractContent,
                [context, `sort-by-numeric-column.txt`],
            ),
        );

        test(
            "sort > sorts by an alpha column",
            runSimpleCompareTest(
                {
                    columns: ["Row ID", "State", "Sales"],
                    sort: [["State", "asc"]],
                    settings: true,
                },
                extractContent,
                [context, `sort-by-alpha-column.txt`],
            ),
        );
    });

    test.describe("Filter tests", () => {
        test(
            "filter > filters by a numeric column",
            runSimpleCompareTest(
                {
                    columns: ["Row ID", "State", "Sales"],
                    filter: [["Sales", ">", 500]],
                    settings: true,
                },
                extractContent,
                [context, `filter-by-numeric-column.txt`],
            ),
        );

        test(
            "filter > filters by an alpha column",
            runSimpleCompareTest(
                {
                    columns: ["Row ID", "State", "Sales"],
                    filter: [["State", "==", "Texas"]],
                    settings: true,
                },
                extractContent,
                [context, `filter-by-alpha-column.txt`],
            ),
        );

        test(
            "filter > filters with 'in' comparator",
            runSimpleCompareTest(
                {
                    columns: ["Row ID", "State", "Sales"],
                    filter: [["State", "in", ["Texas", "California"]]],
                    settings: true,
                },
                extractContent,
                [context, `filter-with-in-comparator.txt`],
            ),
        );
    });
}
