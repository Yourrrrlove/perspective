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
    test.describe("to_ndjson", function () {
        test("should work with context 0", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({});
            let json = await view.to_ndjson();
            expect(json)
                .toEqual(`{"int":1,"float":2.25,"string":"a","datetime":${+STD_DATE}}
{"int":2,"float":3.5,"string":"b","datetime":${+STD_DATE}}
{"int":3,"float":4.75,"string":"c","datetime":${+STD_DATE}}
{"int":4,"float":5.25,"string":"d","datetime":${+STD_DATE}}`);
            view.delete();
            table.delete();
        });

        test("should work with context 1", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({ group_by: ["string"] });
            let json = await view.to_ndjson();
            expect(json)
                .toEqual(`{"__ROW_PATH__":[],"int":10,"float":15.75,"string":4,"datetime":4}
{"__ROW_PATH__":["a"],"int":1,"float":2.25,"string":1,"datetime":1}
{"__ROW_PATH__":["b"],"int":2,"float":3.5,"string":1,"datetime":1}
{"__ROW_PATH__":["c"],"int":3,"float":4.75,"string":1,"datetime":1}
{"__ROW_PATH__":["d"],"int":4,"float":5.25,"string":1,"datetime":1}`);
            view.delete();
            table.delete();
        });

        test("should work with context 2", async function () {
            let table = await perspective.table(int_float_string_data);
            let view = await table.view({
                group_by: ["string"],
                split_by: ["int"],
            });
            let json = await view.to_ndjson();
            expect(json)
                .toEqual(`{"__ROW_PATH__":[],"1|int":1,"1|float":2.25,"1|string":1,"1|datetime":1,"2|int":2,"2|float":3.5,"2|string":1,"2|datetime":1,"3|int":3,"3|float":4.75,"3|string":1,"3|datetime":1,"4|int":4,"4|float":5.25,"4|string":1,"4|datetime":1}
{"__ROW_PATH__":["a"],"1|int":1,"1|float":2.25,"1|string":1,"1|datetime":1,"2|int":null,"2|float":null,"2|string":null,"2|datetime":null,"3|int":null,"3|float":null,"3|string":null,"3|datetime":null,"4|int":null,"4|float":null,"4|string":null,"4|datetime":null}
{"__ROW_PATH__":["b"],"1|int":null,"1|float":null,"1|string":null,"1|datetime":null,"2|int":2,"2|float":3.5,"2|string":1,"2|datetime":1,"3|int":null,"3|float":null,"3|string":null,"3|datetime":null,"4|int":null,"4|float":null,"4|string":null,"4|datetime":null}
{"__ROW_PATH__":["c"],"1|int":null,"1|float":null,"1|string":null,"1|datetime":null,"2|int":null,"2|float":null,"2|string":null,"2|datetime":null,"3|int":3,"3|float":4.75,"3|string":1,"3|datetime":1,"4|int":null,"4|float":null,"4|string":null,"4|datetime":null}
{"__ROW_PATH__":["d"],"1|int":null,"1|float":null,"1|string":null,"1|datetime":null,"2|int":null,"2|float":null,"2|string":null,"2|datetime":null,"3|int":null,"3|float":null,"3|string":null,"3|datetime":null,"4|int":4,"4|float":5.25,"4|string":1,"4|datetime":1}`);
            view.delete();
            table.delete();
        });
    });
})(perspective);
