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
    test.describe("Outer joins", function () {
        test("outer joins two tables on a shared key", async function () {
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
                join_type: "outer",
            });
            const view = await joined.view();
            const json = await view.to_json();

            // Outer join: all left + matched right + unmatched right
            expect(json).toHaveLength(4);
            expect(json).toEqual([
                { id: 1, x: 10, y: "a" },
                { id: 2, x: 20, y: "b" },
                { id: 3, x: 30, y: null },
                { id: 4, x: null, y: "d" },
            ]);

            await view.delete();
            await joined.delete();
            await right.delete();
            await left.delete();
        });

        test("outer join includes all rows when no keys match", async function () {
            const left = await perspective.table([
                { id: 1, x: 10 },
                { id: 2, x: 20 },
            ]);

            const right = await perspective.table([
                { id: 3, y: "c" },
                { id: 4, y: "d" },
            ]);

            const joined = await perspective.join(left, right, "id", {
                join_type: "outer",
            });
            const view = await joined.view();
            const json = await view.to_json();

            expect(json).toHaveLength(4);
            expect(json).toEqual([
                { id: 1, x: 10, y: null },
                { id: 2, x: 20, y: null },
                { id: 3, x: null, y: "c" },
                { id: 4, x: null, y: "d" },
            ]);

            await view.delete();
            await joined.delete();
            await right.delete();
            await left.delete();
        });

        test("outer join with all keys matching is same as inner", async function () {
            const left = await perspective.table([
                { id: 1, x: 10 },
                { id: 2, x: 20 },
            ]);

            const right = await perspective.table([
                { id: 1, y: "a" },
                { id: 2, y: "b" },
            ]);

            const joined = await perspective.join(left, right, "id", {
                join_type: "outer",
            });
            const view = await joined.view();
            const json = await view.to_json();

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

        test("outer join reacts to left table updates", async function () {
            const left = await perspective.table([{ id: 1, x: 10 }]);

            const right = await perspective.table([
                { id: 1, y: "a" },
                { id: 2, y: "b" },
            ]);

            const joined = await perspective.join(left, right, "id", {
                join_type: "outer",
            });
            const view = await joined.view();

            let json = await view.to_json();
            expect(json).toHaveLength(2);
            expect(json).toEqual([
                { id: 1, x: 10, y: "a" },
                { id: 2, x: null, y: "b" },
            ]);

            // Add matching row for id=2
            await left.update([{ id: 2, x: 20 }]);
            json = await view.to_json();

            // Both left rows now match right rows
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

        test("outer join reacts to right table updates", async function () {
            const left = await perspective.table([
                { id: 1, x: 10 },
                { id: 2, x: 20 },
            ]);

            const right = await perspective.table([{ id: 1, y: "a" }]);

            const joined = await perspective.join(left, right, "id", {
                join_type: "outer",
            });
            const view = await joined.view();

            let json = await view.to_json();
            expect(json).toHaveLength(2);
            expect(json).toEqual([
                { id: 1, x: 10, y: "a" },
                { id: 2, x: 20, y: null },
            ]);

            await right.update([{ id: 2, y: "b" }]);
            json = await view.to_json();

            // Now both match, but non-indexed tables append
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

        test("outer join has correct schema", async function () {
            const left = await perspective.table({ id: "integer", x: "float" });
            const right = await perspective.table({
                id: "integer",
                y: "string",
            });

            const joined = await perspective.join(left, right, "id", {
                join_type: "outer",
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
