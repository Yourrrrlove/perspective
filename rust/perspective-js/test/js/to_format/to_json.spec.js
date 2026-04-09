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
import perspective from "../perspective_client";
import { int_float_string_data } from "./_shared";

((perspective) => {
    test.describe("to_json", function () {
        test("should emit same number of column names as number of pivots", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
                split_by: ["float", "string"],
                sort: [["int", "asc"]],
            });
            let json = await view.to_json();
            // Get the first emitted column name that is not __ROW_PATH__
            let name = Object.keys(json[0])[1];
            // make sure that number of separators = num of split by
            expect((name.match(/\|/g) || []).length).toEqual(2);
            view.delete();
            table.delete();
        });

        test("should return dates in native form by default", async function () {
            let table = await perspective.table([
                { datetime: new Date("2016-06-13") },
                { datetime: new Date("2016-06-14") },
            ]);
            let view = await table.view();
            let json = await view.to_json();
            expect(json).toEqual([
                { datetime: 1465776000000 },
                { datetime: 1465862400000 },
            ]);
            view.delete();
            table.delete();
        });

        test.skip("OG - should return dates in readable format on passing string in options", async function () {
            let table = await perspective.table([
                { datetime: new Date("2016-06-13") },
                { datetime: new Date("2016-06-14") },
            ]);
            let view = await table.view();
            let json = await view.to_json({ formatted: true });
            expect(json).toEqual([
                { datetime: "2016-06-13" },
                { datetime: "2016-06-14" },
            ]);
            view.delete();
            table.delete();
        });

        test("should return dates in readable format on passing string in options", async function () {
            let table = await perspective.table({
                date: "date",
            });
            await table.update([
                { date: new Date("2016-06-13") },
                { date: new Date("2016-06-14") },
            ]);
            let view = await table.view();
            let json = await view.to_json({ formatted: true });
            expect(json).toEqual([
                { date: "2016-06-13" },
                { date: "2016-06-14" },
            ]);
            view.delete();
            table.delete();
        });

        test("should return datetimes in readable format on passing string in options", async function () {
            let table = await perspective.table([
                { datetime: new Date(2016, 0, 1, 0, 30) },
                { datetime: new Date(2016, 5, 15, 19, 20) },
            ]);
            let view = await table.view();
            let json = await view.to_json({ formatted: true });
            expect(json).toEqual([
                { datetime: "2016-01-01 00:30:00.000" },
                { datetime: "2016-06-15 19:20:00.000" },
            ]);
            view.delete();
            table.delete();
        });
    });
})(perspective);
