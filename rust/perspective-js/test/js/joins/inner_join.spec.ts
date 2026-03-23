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
    test.describe("Inner joins", function () {
        test("inner joins two tables on a shared key", async function () {
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

            const joined = await perspective.join(left, right, "id");
            const view = await joined.view();
            const json = await view.to_json();

            expect(json).toHaveLength(2);

            view.delete();
            joined.delete();
            right.delete();
            left.delete();
        });

        test("joined table has correct schema", async function () {
            const left = await perspective.table({ id: "integer", x: "float" });

            const right = await perspective.table({
                id: "integer",
                y: "string",
            });

            const joined = await perspective.join(left, right, "id");
            const schema = await joined.schema();

            expect(schema).toEqual({
                id: "integer",
                x: "float",
                y: "string",
            });

            joined.delete();
            right.delete();
            left.delete();
        });

        test("joined table reacts to left table updates", async function () {
            const left = await perspective.table([
                { id: 1, x: 10 },
                { id: 2, x: 20 },
            ]);

            const right = await perspective.table([
                { id: 1, y: "a" },
                { id: 2, y: "b" },
            ]);

            const joined = await perspective.join(left, right, "id");
            const view = await joined.view();

            let json = await view.to_json();
            expect(json).toHaveLength(2);

            await left.update([{ id: 1, x: 99 }]);
            json = await view.to_json();

            expect(json).toEqual([
                { id: 1, x: 10, y: "a" },
                { id: 2, x: 20, y: "b" },
                { id: 1, x: 99, y: "a" },
            ]);

            view.delete();
            joined.delete();
            right.delete();
            left.delete();
        });

        test("joined table reacts to right table updates", async function () {
            const left = await perspective.table([
                { id: 1, x: 10 },
                { id: 2, x: 20 },
            ]);

            const right = await perspective.table([
                { id: 1, y: "a" },
                { id: 2, y: "b" },
            ]);

            const joined = await perspective.join(left, right, "id");
            const view = await joined.view();

            await right.update([{ id: 1, y: "c" }]);
            const json = await view.to_json();

            // id=3 only exists in right, so inner join should not include it
            expect(json).toHaveLength(3);

            expect(json).toEqual([
                { id: 1, x: 10, y: "a" },
                { id: 1, x: 10, y: "c" },
                { id: 2, x: 20, y: "b" },
            ]);

            view.delete();
            joined.delete();
            right.delete();
            left.delete();
        });

        test("joined table reacts to new matching rows", async function () {
            const left = await perspective.table([{ id: 1, x: 10 }]);

            const right = await perspective.table([{ id: 2, y: "b" }]);

            const joined = await perspective.join(left, right, "id");
            const view = await joined.view();

            let json = await view.to_json();
            expect(json).toHaveLength(0);

            // Add matching row to right
            await right.update([{ id: 1, y: "a" }]);
            json = await view.to_json();
            expect(json).toHaveLength(1);
            expect(json).toEqual([{ id: 1, x: 10, y: "a" }]);

            view.delete();
            joined.delete();
            right.delete();
            left.delete();
        });

        test("joined table supports views with group_by", async function () {
            const left = await perspective.table([
                { id: 1, category: "A", x: 10 },
                { id: 2, category: "A", x: 20 },
                { id: 3, category: "B", x: 30 },
            ]);

            const right = await perspective.table([
                { id: 1, y: 100 },
                { id: 2, y: 200 },
                { id: 3, y: 300 },
            ]);

            const joined = await perspective.join(left, right, "id");
            const view = await joined.view({
                group_by: ["category"],
                columns: ["x", "y"],
            });

            const json = await view.to_columns();
            expect(json["x"]).toEqual([60, 30, 30]);
            expect(json["y"]).toEqual([600, 300, 300]);

            view.delete();
            joined.delete();
            right.delete();
            left.delete();
        });

        test("rejects column name conflicts", async function () {
            const left = await perspective.table([{ id: 1, value: 10 }]);
            const right = await perspective.table([{ id: 1, value: 20 }]);

            let error;
            try {
                await perspective.join(left, right, "id");
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            right.delete();
            left.delete();
        });

        test("rejects updates on joined table", async function () {
            const left = await perspective.table([{ id: 1, x: 10 }]);
            const right = await perspective.table([{ id: 1, y: "a" }]);

            const joined = await perspective.join(left, right, "id");

            let error;
            try {
                await joined.update([{ id: 1, x: 99, y: "z" }]);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();

            joined.delete();
            right.delete();
            left.delete();
        });
    });
})(perspective);
