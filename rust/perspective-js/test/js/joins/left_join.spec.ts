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
import perspective from "../perspective_client.ts";

((perspective) => {
    test.describe("Left joins", function () {
        test("left joins two tables on a shared key", async function () {
            const left = await perspective.table([
                { id: 1, x: 10 },
                { id: 2, x: 20 },
                { id: 3, x: 30 },
            ]);

            const right = await perspective.table([
                { id: 1, y: "a" },
                { id: 2, y: "b" },
                { id: 4, y: "d" },
            ]);

            const joined = await perspective.join(left, right, "id", {
                join_type: "left",
            });
            const view = await joined.view();
            const json = await view.to_json();

            // Left join: all left rows, matched right rows, id=3 has null y
            expect(json).toHaveLength(3);
            expect(json).toEqual([
                { id: 1, x: 10, y: "a" },
                { id: 2, x: 20, y: "b" },
                { id: 3, x: 30, y: null },
            ]);

            await view.delete();
            await joined.delete();
            await right.delete();
            await left.delete();
        });

        test("left join includes unmatched left rows with nulls", async function () {
            const left = await perspective.table([
                { id: 1, x: 10 },
                { id: 2, x: 20 },
            ]);

            const right = await perspective.table([{ id: 1, y: "a" }]);

            const joined = await perspective.join(left, right, "id", {
                join_type: "left",
            });
            const view = await joined.view();
            const json = await view.to_json();

            expect(json).toHaveLength(2);
            expect(json).toEqual([
                { id: 1, x: 10, y: "a" },
                { id: 2, x: 20, y: null },
            ]);

            await view.delete();
            await joined.delete();
            await right.delete();
            await left.delete();
        });

        test("left join does not include unmatched right rows", async function () {
            const left = await perspective.table([{ id: 1, x: 10 }]);

            const right = await perspective.table([
                { id: 1, y: "a" },
                { id: 2, y: "b" },
            ]);

            const joined = await perspective.join(left, right, "id", {
                join_type: "left",
            });
            const view = await joined.view();
            const json = await view.to_json();

            expect(json).toHaveLength(1);
            expect(json).toEqual([{ id: 1, x: 10, y: "a" }]);

            await view.delete();
            await joined.delete();
            await right.delete();
            await left.delete();
        });

        test("left join reacts to right table updates", async function () {
            const left = await perspective.table([
                { id: 1, x: 10 },
                { id: 2, x: 20 },
            ]);

            const right = await perspective.table([{ id: 1, y: "a" }]);

            const joined = await perspective.join(left, right, "id", {
                join_type: "left",
            });
            const view = await joined.view();

            // Add matching row for id=2
            await right.update([{ id: 2, y: "b" }]);
            const json = await view.to_json();

            // Now both rows match
            expect(json).toHaveLength(2);
            expect(json).toEqual([
                { id: 1, x: 10, y: "a" },
                { id: 2, x: 20, y: "b" },
            ]);

            await view.delete();
            await joined.delete();
            await right.delete();
            await left.delete();
        });

        test("left join with no matching rows", async function () {
            const left = await perspective.table([
                { id: 1, x: 10 },
                { id: 2, x: 20 },
            ]);

            const right = await perspective.table([
                { id: 3, y: "c" },
                { id: 4, y: "d" },
            ]);

            const joined = await perspective.join(left, right, "id", {
                join_type: "left",
            });
            const view = await joined.view();
            const json = await view.to_json();

            // All left rows present with null right columns
            expect(json).toHaveLength(2);
            expect(json).toEqual([
                { id: 1, x: 10, y: null },
                { id: 2, x: 20, y: null },
            ]);

            await view.delete();
            await joined.delete();
            await right.delete();
            await left.delete();
        });

        test("left join has correct schema", async function () {
            const left = await perspective.table({ id: "integer", x: "float" });
            const right = await perspective.table({
                id: "integer",
                y: "string",
            });

            const joined = await perspective.join(left, right, "id", {
                join_type: "left",
            });
            const schema = await joined.schema();

            expect(schema).toEqual({
                id: "integer",
                x: "float",
                y: "string",
            });

            await joined.delete();
            await right.delete();
            await left.delete();
        });
    });
})(perspective);
