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

import { tableFromIPC, Float64, Int32, Utf8, Dictionary } from "apache-arrow";

export interface ColumnData {
    type: "float32" | "int32" | "string" | "list-string";
    values?: Float32Array | Int32Array;
    labels?: string[];
    listValues?: string[][];
    /** Per-row null bitmap: true = valid, false = null. */
    valid?: Uint8Array;
}

export type ColumnDataMap = Map<string, ColumnData>;

function buildValidBitmap(
    column: { nullCount: number; isValid(i: number): boolean },
    numRows: number,
): Uint8Array | undefined {
    if (column.nullCount === 0) return undefined;
    const valid = new Uint8Array(numRows);
    for (let i = 0; i < numRows; i++) {
        valid[i] = column.isValid(i) ? 1 : 0;
    }
    return valid;
}

export function arrowToTypedArrays(buffer: ArrayBuffer): ColumnDataMap {
    const table = tableFromIPC(buffer);
    const result: ColumnDataMap = new Map();

    for (const field of table.schema.fields) {
        const column = table.getChild(field.name);
        if (!column) continue;

        const numRows = column.length;

        if (
            field.type instanceof Float64 ||
            field.type.typeId === 3 /* Float */
        ) {
            // Use toArray() to get the underlying typed array directly,
            // then narrow Float64→Float32 for WebGL compatibility.
            const raw = column.toArray();
            const f32 =
                raw instanceof Float32Array ? raw : new Float32Array(raw);
            const valid = buildValidBitmap(column, numRows);
            result.set(field.name, { type: "float32", values: f32, valid });
        } else if (
            field.type instanceof Int32 ||
            field.type.typeId === 2 /* Int */
        ) {
            const raw = column.toArray();
            let i32: Int32Array;
            if (raw instanceof Int32Array) {
                i32 = raw;
            } else if (
                raw instanceof BigInt64Array ||
                raw instanceof BigUint64Array
            ) {
                i32 = new Int32Array(numRows);
                for (let j = 0; j < numRows; j++) {
                    i32[j] = Number(raw[j]);
                }
            } else {
                i32 = new Int32Array(raw);
            }
            const valid = buildValidBitmap(column, numRows);
            result.set(field.name, { type: "int32", values: i32, valid });
        } else if (
            field.type instanceof Utf8 ||
            field.type instanceof Dictionary ||
            field.type.typeId === 5 /* Utf8 */
        ) {
            const labels: string[] = new Array(numRows);
            for (let i = 0; i < numRows; i++) {
                labels[i] = String(column.get(i) ?? "");
            }
            result.set(field.name, { type: "string", labels });
        } else if (field.type.typeId === 12 /* List */) {
            const listValues: string[][] = new Array(numRows);
            for (let i = 0; i < numRows; i++) {
                const val = column.get(i);
                if (val == null) {
                    listValues[i] = [];
                } else {
                    const arr: string[] = [];
                    for (let j = 0; j < val.length; j++) {
                        arr.push(String(val[j] ?? ""));
                    }
                    listValues[i] = arr;
                }
            }
            result.set(field.name, { type: "list-string", listValues });
        } else {
            // For other types (bool, date, datetime), convert to float32
            const raw = column.toArray();
            const f32 = new Float32Array(numRows);
            for (let i = 0; i < numRows; i++) {
                const val = raw[i];
                f32[i] =
                    val instanceof Date
                        ? val.getTime()
                        : typeof val === "boolean"
                          ? val
                              ? 1
                              : 0
                          : Number(val) || 0;
            }
            result.set(field.name, { type: "float32", values: f32 });
        }
    }

    return result;
}
