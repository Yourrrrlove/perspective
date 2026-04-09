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
    test.describe("data slice", function () {
        test("should filter out invalid start rows", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_json({
                start_row: 5,
            });
            expect(json).toEqual([]);
            view.delete();
            table.delete();
        });

        test("should filter out invalid start columns", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_json({
                start_col: 5,
            });
            expect(json).toEqual([]);
            view.delete();
            table.delete();
        });

        test("should filter out invalid start rows & columns", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_json({
                start_row: 5,
                start_col: 5,
            });
            expect(json).toEqual([]);
            view.delete();
            table.delete();
        });

        test("should filter out invalid start rows based on view", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                filter: [["float", ">", 3.5]],
            });

            // valid on view() but not this filtered view
            let json = await view.to_json({
                start_row: 3,
            });

            expect(json).toEqual([]);

            view.delete();
            table.delete();
        });

        test("should filter out invalid start columns based on view", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                columns: ["float", "int"],
            });

            let json = await view.to_json({
                start_col: 2,
            });

            expect(json).toEqual([]);
            view.delete();
            table.delete();
        });

        test("should filter out invalid start rows & columns based on view", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                columns: ["float", "int"],
                filter: [["float", ">", 3.5]],
            });
            let json = await view.to_json({
                start_row: 5,
                start_col: 5,
            });
            expect(json).toEqual([]);
            view.delete();
            table.delete();
        });

        test("should respect start/end rows", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_json({
                start_row: 2,
                end_row: 3,
            });
            let comparator = int_float_string_data[2];
            comparator.datetime = +comparator.datetime;
            expect(json[0]).toEqual(comparator);
            view.delete();
            table.delete();
        });

        test("should respect end rows when larger than data size", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_json({
                start_row: 2,
                end_row: 6,
            });
            expect(json).toEqual(
                int_float_string_data.slice(2).map((x) => {
                    x.datetime = +x.datetime;
                    return x;
                }),
            );
            view.delete();
            table.delete();
        });

        test("should respect start/end columns", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_columns({
                start_col: 2,
                end_col: 3,
            });
            let comparator = {
                string: int_float_string_data.map((d) => d.string),
            };
            expect(json).toEqual(comparator);
            view.delete();
            table.delete();
        });

        test("should floor float start rows", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_json({
                start_row: 1.5,
            });
            expect(json).toEqual(
                int_float_string_data.slice(1).map((x) => {
                    x.datetime = +x.datetime;
                    return x;
                }),
            );
            view.delete();
            table.delete();
        });

        test("should ceil float end rows", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_json({
                end_row: 1.5,
            });
            expect(json).toEqual(
                // deep copy
                JSON.parse(JSON.stringify(int_float_string_data))
                    .slice(0, 2)
                    .map((x) => {
                        x.datetime = +new Date(x.datetime);
                        return x;
                    }),
            );
            view.delete();
            table.delete();
        });

        test("should floor/ceil float start/end rows", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_json({
                start_row: 2.9,
                end_row: 2.4,
            });
            let comparator = int_float_string_data[2];
            comparator.datetime = +comparator.datetime;
            expect(json[0]).toEqual(comparator);
            view.delete();
            table.delete();
        });

        test("should ceil float end rows when larger than data size", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_json({
                start_row: 2,
                end_row: 5.5,
            });
            expect(json).toEqual(
                int_float_string_data.slice(2).map((x) => {
                    x.datetime = +x.datetime;
                    return x;
                }),
            );
            view.delete();
            table.delete();
        });

        test("should floor/ceil float start/end columns", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view();
            let json = await view.to_columns({
                start_col: 2.6,
                end_col: 2.4,
            });
            let comparator = {
                string: int_float_string_data.map((d) => d.string),
            };
            expect(json).toEqual(comparator);
            view.delete();
            table.delete();
        });

        test("one-sided views should have row paths", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
            });
            let json = await view.to_json();
            for (let d of json) {
                expect(d.__ROW_PATH__).toBeDefined();
            }
            view.delete();
            table.delete();
        });

        test("one-sided views with start_col > 0 should have row paths", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
            });
            let json = await view.to_json({ start_col: 1 });
            for (let d of json) {
                expect(d.__ROW_PATH__).toBeDefined();
            }
            view.delete();
            table.delete();
        });

        test("one-sided column-only views should not have row paths", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                split_by: ["int"],
            });
            let json = await view.to_json();
            for (let d of json) {
                expect(d.__ROW_PATH__).toBeUndefined();
            }
            view.delete();
            table.delete();
        });

        test("column-only views should not have header rows", async function () {
            let table = await perspective.table([
                { x: 1, y: "a" },
                { x: 2, y: "b" },
            ]);
            let view = await table.view({
                split_by: ["x"],
            });
            let json = await view.to_json();
            expect(json).toEqual([
                { "1|x": 1, "1|y": "a", "2|x": null, "2|y": null },
                { "1|x": null, "1|y": null, "2|x": 2, "2|y": "b" },
            ]);
            view.delete();
            table.delete();
        });

        test("column-only views should return correct windows of data", async function () {
            let table = await perspective.table([
                { x: 1, y: "a" },
                { x: 2, y: "b" },
            ]);
            let view = await table.view({
                split_by: ["x"],
            });
            let json = await view.to_json({
                start_row: 1,
            });
            expect(json).toEqual([
                { "1|x": null, "1|y": null, "2|x": 2, "2|y": "b" },
            ]);
            view.delete();
            table.delete();
        });

        test("two-sided views should have row paths", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
                split_by: ["string"],
            });
            let json = await view.to_json();
            for (let d of json) {
                expect(d.__ROW_PATH__).toBeDefined();
            }
            view.delete();
            table.delete();
        });

        test("two-sided views with start_col > 0 should have row paths", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
                split_by: ["string"],
            });
            let json = await view.to_json({ start_col: 1 });
            for (let d of json) {
                expect(d.__ROW_PATH__).toBeDefined();
            }
            view.delete();
            table.delete();
        });

        test("two-sided sorted views with start_col > 0 should have row paths", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["int"],
                split_by: ["string"],
                sort: [["string", "desc"]],
            });
            let json = await view.to_json({ start_col: 1 });
            for (let d of json) {
                expect(d.__ROW_PATH__).toBeDefined();
            }
            view.delete();
            table.delete();
        });
    });
})(perspective);
