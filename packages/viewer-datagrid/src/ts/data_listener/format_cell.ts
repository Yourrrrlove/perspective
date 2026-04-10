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

import { FormatterCache, Formatter } from "./formatter_cache.js";
import type { DatagridModel, ColumnsConfig, ColumnConfig } from "../types.js";
import { ColumnType } from "@perspective-dev/client";

const FORMAT_CACHE = new FormatterCache();
const MAX_BAR_WIDTH_PCT = 1;

export function format_raw(
    type: ColumnType,
    value: ColumnConfig,
): Formatter | false | undefined {
    return FORMAT_CACHE.get(type, value);
}

/**
 * Format a single cell's text content as the content of a `<td>` or `<th>`.
 */
export function format_cell(
    this: DatagridModel,
    title: string,
    val: unknown,
    plugins: ColumnsConfig = {},
    use_table_schema = false,
): string | HTMLElement | null {
    if (val === null) {
        return null;
    }

    const type: ColumnType = ((use_table_schema && this._table_schema[title]) ||
        this._schema[title] ||
        "string") as ColumnType;
    const plugin: ColumnConfig = plugins[title] || {};
    const is_numeric = type === "integer" || type === "float";

    if (
        is_numeric &&
        (plugin?.number_fg_mode === "bar" ||
            plugin?.number_fg_mode === "label-bar")
    ) {
        const a = Math.max(
            0,
            Math.min(
                MAX_BAR_WIDTH_PCT,
                Math.abs((val as number) / plugin.fg_gradient!) *
                    MAX_BAR_WIDTH_PCT,
            ),
        );

        const anchor = (val as number) >= 0 ? "left" : "right";
        const pct = (a * 100).toFixed(2);

        if (plugin.number_fg_mode === "bar") {
            const div = this._div_factory.get();
            div.className = "psp-bar";
            div.setAttribute(
                "style",
                `width:calc(${pct}% - 4px);position:absolute;${anchor}:2px;height:80%;top:10%;pointer-events:none;`,
            );

            return div;
        } else {
            const wrapper = this._div_factory.get();
            wrapper.setAttribute("style", "");
            wrapper.className = "psp-label-bar";
            while (wrapper.firstChild) {
                wrapper.removeChild(wrapper.firstChild);
            }
            const bar = document.createElement("div");
            bar.className = "psp-label-bar-fill";
            bar.setAttribute(
                "style",
                `width:calc(${pct}% - 4px);${anchor}:2px;`,
            );
            const label = document.createElement("span");
            label.className = "psp-label-bar-text";
            const formatter = FORMAT_CACHE.get(type, plugin);
            label.textContent = formatter
                ? formatter.format(val)
                : (val as string);
            wrapper.appendChild(bar);
            wrapper.appendChild(label);
            return wrapper;
        }
    } else if (plugin?.format === "link" && type === "string") {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", val as string);
        anchor.setAttribute("target", "_blank");
        anchor.textContent = val as string;
        return anchor;
    } else if (plugin?.format === "bold" && type === "string") {
        const bold = document.createElement("b");
        bold.textContent = val as string;
        return bold;
    } else if (plugin?.format === "italics" && type === "string") {
        const italic = document.createElement("i");
        italic.textContent = val as string;
        return italic;
    } else {
        const formatter = FORMAT_CACHE.get(type, plugin);
        return formatter ? formatter.format(val) : (val as string);
    }
}
