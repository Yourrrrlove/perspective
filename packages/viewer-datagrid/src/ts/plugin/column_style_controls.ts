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

import type { ColumnType } from "@perspective-dev/client";
import type { DatagridPluginElement } from "../types.js";

interface NumberStyleOpts {
    datagrid_number_style: {
        fg_gradient: number;
        pos_fg_color: string;
        neg_fg_color: string;
        number_fg_mode: string;
        bg_gradient: number;
        pos_bg_color: string;
        neg_bg_color: string;
        number_bg_mode: string;
    };
    number_string_format: boolean;
}

interface DatetimeStyleOpts {
    datagrid_datetime_style?: {
        color: string;
        bg_color: string;
    };
    datagrid_string_style?: {
        color: string;
        bg_color: string;
    };
}

export type ColumnStyleOpts = NumberStyleOpts | DatetimeStyleOpts | null;

export default function column_style_opts(
    this: DatagridPluginElement,
    type: ColumnType,
    _group: string,
): ColumnStyleOpts {
    if (type === "integer" || type === "float") {
        return {
            datagrid_number_style: {
                fg_gradient: 0,
                pos_fg_color: this.model!._pos_fg_color[0],
                neg_fg_color: this.model!._neg_fg_color[0],
                number_fg_mode: "color",
                bg_gradient: 0,
                pos_bg_color: this.model!._pos_bg_color[0],
                neg_bg_color: this.model!._neg_bg_color[0],
                number_bg_mode: "disabled",
            },
            number_string_format: true,
        };
    } else if (type === "date" || type === "datetime" || type === "string") {
        const control =
            type === "date" || type === "datetime"
                ? "datagrid_datetime_style"
                : `datagrid_string_style`;
        return {
            [control]: {
                color: this.model!._color[0],
                bg_color: this.model!._color[0],
            },
        } as DatetimeStyleOpts;
    } else {
        return null;
    }
}
