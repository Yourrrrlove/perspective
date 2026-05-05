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

// Concrete use cases from issue #1527 ("Better string functions in
// expressions"). The original issue body sketched these in a hypothetical
// dialect; the tests below port them to the dialect Perspective actually
// implements. Differences from the issue's pseudocode:
//
//   - `find(str, substr) -> int` does not exist. The closest function is
//     `indexof(col, regex, out_vec) -> bool`, which performs a *regex* search,
//     writes [start, end] of the first capturing group into `out_vec`, and
//     requires the regex to have at least one capturing group (else it
//     returns STATUS_CLEAR). The tests therefore wrap the literal char in a
//     capturing group: `' '` -> `'( )'`, `','` -> `'(,)'`, `$` -> `'([$])'`.
//   - `null()` is not a function call; `null` is a literal.
//   - `strlen(s)` -> `length(s)`.
//   - `substring(s, start, count)` takes a *count*, not an end index, and
//     returns null if `start + count > length(s)`.
//   - String literals pass through ExprTK's `cleanup_escapes`, which drops
//     unrecognized escape characters (`\s` -> `s`, `\.` -> `.`).

((perspective) => {
    test.describe("Issue 1527 use cases", function () {
        test("contains literal substring", async function () {
            const table = await perspective.table({
                a: ["abcdef", "xyz", "abXabY", null, "abc"],
            });

            const view = await table.view({
                expressions: {
                    has_ab: "contains(\"a\", 'ab')",
                },
            });

            const result = await view.to_columns();
            const schema = await view.expression_schema();
            expect(schema["has_ab"]).toEqual("boolean");
            expect(result["has_ab"]).toEqual([true, false, true, null, true]);
            view.delete();
            table.delete();
        });

        // Parse "USD $1000"-style strings into Currency (string) and Value
        // (float) columns, tolerant of malformed rows.
        test("split currency/value string column", async function () {
            const table = await perspective.table({
                "Bad Column": [
                    "USD $1000",
                    "EUR $250",
                    "malformed",
                    null,
                    "GBP $42",
                ],
            });
            const view = await table.view({
                expressions: {
                    Currency: `var v[2];
if (indexof("Bad Column", '( )', v)) { substring("Bad Column", 0, v[0]) } else { null }`,
                    Value: `var v[2];
if (indexof("Bad Column", '([$])', v)) { float(substring("Bad Column", v[0] + 1)) } else { null }`,
                },
            });
            const result = await view.to_columns();
            const schema = await view.expression_schema();
            expect(schema["Currency"]).toEqual("string");
            expect(schema["Value"]).toEqual("float");
            expect(result["Currency"]).toEqual([
                "USD",
                "EUR",
                null,
                null,
                "GBP",
            ]);
            expect(result["Value"]).toEqual([1000, 250, null, null, 42]);
            view.delete();
            table.delete();
        });

        // Parse "(123, 456)"-style strings into Longitude and Latitude
        // float columns.
        test("split longitude/latitude string column", async function () {
            const table = await perspective.table({
                Coords: [
                    "(123, 456)",
                    "(1.5, -2.25)",
                    "broken",
                    null,
                    "(0, 0)",
                ],
            });
            const view = await table.view({
                expressions: {
                    Longitude: `var v[2];
if (indexof("Coords", '(,)', v)) { float(substring("Coords", 1, v[0] - 1)) } else { null }`,
                    Latitude: `var v[2];
if (indexof("Coords", '(,)', v)) { float(substring("Coords", v[0] + 1, length("Coords") - v[0] - 2)) } else { null }`,
                },
            });
            const result = await view.to_columns();
            const schema = await view.expression_schema();
            expect(schema["Longitude"]).toEqual("float");
            expect(schema["Latitude"]).toEqual("float");
            expect(result["Longitude"]).toEqual([123, 1.5, null, null, 0]);
            expect(result["Latitude"]).toEqual([456, -2.25, null, null, 0]);
            view.delete();
            table.delete();
        });

        // Normalize spelling variants by stripping dots and whitespace.
        test("replace_all regex strips dots/whitespace", async function () {
            const table = await perspective.table({
                State: ["NC", "N.C.", "N. C.", "N .C.", "VA"],
            });
            const view = await table.view({
                expressions: {
                    Normalized: `replace_all("State", '[. ]', '')`,
                },
            });
            const result = await view.to_columns();
            expect(result["Normalized"]).toEqual([
                "NC",
                "NC",
                "NC",
                "NC",
                "VA",
            ]);
            view.delete();
            table.delete();
        });
    });
})(perspective);
