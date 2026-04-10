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

import type { View } from "@perspective-dev/client";

export interface ChunkResult {
    arrow: ArrayBuffer;
    start: number;
    end: number;
}

export class ChunkIterator {
    private _view: View;
    private _totalRows: number;
    private _chunkSize: number;

    set chunkSize(size: number) {
        this._chunkSize = size;
    }
    private _endCol: number | undefined;
    private _cursor: number;

    constructor(
        view: View,
        totalRows: number,
        chunkSize: number,
        endCol?: number,
    ) {
        this._view = view;
        this._totalRows = totalRows;
        this._chunkSize = chunkSize;
        this._endCol = endCol;
        this._cursor = 0;
    }

    async nextChunk(): Promise<ChunkResult | null> {
        if (this._cursor >= this._totalRows) {
            return null;
        }

        const start = this._cursor;
        const end = Math.min(start + this._chunkSize, this._totalRows);

        const window: Record<string, number> = {
            start_row: start,
            end_row: end,
        };

        if (this._endCol !== undefined) {
            window.end_col = this._endCol;
        }

        const arrow = await this._view.to_arrow(window);
        this._cursor = end;

        return { arrow, start, end };
    }
}
