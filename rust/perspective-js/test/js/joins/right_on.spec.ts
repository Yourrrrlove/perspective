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

test.describe("right_on option", function () {
    test("joins on differently-named columns", async function () {
        const left = await perspective.table([
            { id: 1, x: 10 },
            { id: 2, x: 20 },
            { id: 3, x: 30 },
        ]);

        const right = await perspective.table([
            { user_id: 1, y: "a" },
            { user_id: 2, y: "b" },
            { user_id: 4, y: "d" },
        ]);

        const joined = await perspective.join(left, right, "id", {
            right_on: "user_id",
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

    test("output schema uses left key column name", async function () {
        const left = await perspective.table({ id: "integer", x: "float" });
        const right = await perspective.table({
            user_id: "integer",
            y: "string",
        });

        const joined = await perspective.join(left, right, "id", {
            right_on: "user_id",
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

    test("errors on type mismatch between on and right_on", async function () {
        const left = await perspective.table({ id: "integer", x: "float" });
        const right = await perspective.table({
            user_id: "string",
            y: "float",
        });

        let error;
        try {
            await perspective.join(left, right, "id", {
                right_on: "user_id",
            });
        } catch (e) {
            error = e;
        }

        expect(error).toBeDefined();
        await right.delete();
        await left.delete();
    });

    test("errors when right_on column not found", async function () {
        const left = await perspective.table({ id: "integer", x: "float" });
        const right = await perspective.table({
            user_id: "integer",
            y: "string",
        });

        let error;
        try {
            await perspective.join(left, right, "id", {
                right_on: "nonexistent",
            });
        } catch (e) {
            error = e;
        }

        expect(error).toBeDefined();
        await right.delete();
        await left.delete();
    });

    test("right_on same as on behaves identically to omitting it", async function () {
        const left = await perspective.table([
            { id: 1, x: 10 },
            { id: 2, x: 20 },
        ]);

        const right = await perspective.table([
            { id: 1, y: "a" },
            { id: 2, y: "b" },
        ]);

        const joined = await perspective.join(left, right, "id", {
            right_on: "id",
        });
        const view = await joined.view();
        const json = await view.to_json();

        expect(json).toEqual([
            { id: 1, x: 10, y: "a" },
            { id: 2, x: 20, y: "b" },
        ]);

        await view.delete();
        await joined.delete();
        await right.delete();
        await left.delete();
    });

    test("reacts to right table updates with right_on", async function () {
        const left = await perspective.table([
            { id: 1, x: 10 },
            { id: 2, x: 20 },
        ]);

        const right = await perspective.table([
            { user_id: 1, y: "a" },
            { user_id: 2, y: "b" },
        ]);

        const joined = await perspective.join(left, right, "id", {
            right_on: "user_id",
        });
        const view = await joined.view();

        await right.update([{ user_id: 1, y: "c" }]);
        const json = await view.to_json();

        expect(json).toHaveLength(3);
        expect(json).toEqual([
            { id: 1, x: 10, y: "a" },
            { id: 1, x: 10, y: "c" },
            { id: 2, x: 20, y: "b" },
        ]);

        await view.delete();
        await joined.delete();
        await right.delete();
        await left.delete();
    });

    test("left join with right_on", async function () {
        const left = await perspective.table([
            { id: 1, x: 10 },
            { id: 2, x: 20 },
            { id: 3, x: 30 },
        ]);

        const right = await perspective.table([
            { user_id: 1, y: "a" },
            { user_id: 2, y: "b" },
        ]);

        const joined = await perspective.join(left, right, "id", {
            join_type: "left",
            right_on: "user_id",
        });
        const view = await joined.view();
        const json = await view.to_json();

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

    test("outer join with right_on", async function () {
        const left = await perspective.table([
            { id: 1, x: 10 },
            { id: 2, x: 20 },
        ]);

        const right = await perspective.table([
            { user_id: 2, y: "b" },
            { user_id: 3, y: "c" },
        ]);

        const joined = await perspective.join(left, right, "id", {
            join_type: "outer",
            right_on: "user_id",
        });
        const view = await joined.view();
        const json = await view.to_json();

        expect(json).toHaveLength(3);
        expect(json).toEqual([
            { id: 1, x: 10, y: null },
            { id: 2, x: 20, y: "b" },
            { id: 3, x: null, y: "c" },
        ]);

        await view.delete();
        await joined.delete();
        await right.delete();
        await left.delete();
    });
});
