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
import { STD_DATE, int_float_string_data } from "./_shared";

((perspective) => {
    test.describe("leaves_only flag", function () {
        test("only emits leaves when leaves_only is set", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
                group_rollup_mode: "flat",
            });
            let json = await view.to_json();
            expect(json).toEqual([
                {
                    __ROW_PATH__: [1],
                    datetime: 1,
                    float: 2.25,
                    int: 1,
                    string: 1,
                },
                {
                    __ROW_PATH__: [2],
                    datetime: 1,
                    float: 3.5,
                    int: 2,
                    string: 1,
                },
                {
                    __ROW_PATH__: [3],
                    datetime: 1,
                    float: 4.75,
                    int: 3,
                    string: 1,
                },
                {
                    __ROW_PATH__: [4],
                    datetime: 1,
                    float: 5.25,
                    int: 4,
                    string: 1,
                },
            ]);
            view.delete();
            table.delete();
        });

        test("num_rows returns correct leaf count", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
                group_rollup_mode: "flat",
            });
            let num_rows = await view.num_rows();
            expect(num_rows).toEqual(4);
            view.delete();
            table.delete();
        });

        test("viewport pagination returns exact page sizes", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
                group_rollup_mode: "flat",
            });
            let json = await view.to_json({
                start_row: 0,
                end_row: 2,
            });
            expect(json.length).toEqual(2);
            expect(json[0].__ROW_PATH__).toEqual([1]);
            expect(json[1].__ROW_PATH__).toEqual([2]);
            view.delete();
            table.delete();
        });

        test("to_columns works with leaves_only", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
                group_rollup_mode: "flat",
            });
            let cols = await view.to_columns();
            expect(cols["__ROW_PATH__"]).toEqual([[1], [2], [3], [4]]);
            expect(cols["int"]).toEqual([1, 2, 3, 4]);
            view.delete();
            table.delete();
        });

        test("leaves_only with multi-level group_by", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["string", "int"],
                group_rollup_mode: "flat",
            });
            let num_rows = await view.num_rows();
            expect(num_rows).toEqual(4);
            let json = await view.to_json();
            for (let row of json) {
                expect(row.__ROW_PATH__.length).toEqual(2);
            }
            view.delete();
            table.delete();
        });

        test("leaves_only updates after table.update()", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
                group_rollup_mode: "flat",
            });
            let num_rows = await view.num_rows();
            expect(num_rows).toEqual(4);
            table.update([
                { int: 5, float: 6.0, string: "e", datetime: STD_DATE },
            ]);
            let num_rows2 = await view.num_rows();
            expect(num_rows2).toEqual(5);
            view.delete();
            table.delete();
        });
    });
})(perspective);
