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

import type { DatagridPluginElement, EditMode } from "../types.js";

export const EDIT_MODES: readonly EditMode[] = [
    "READ_ONLY",
    "EDIT",
    "SELECT_ROW",
    "SELECT_COLUMN",
    "SELECT_REGION",
] as const;

export function toggle_edit_mode(
    this: DatagridPluginElement,
    mode?: EditMode,
): void {
    if (typeof mode === "undefined") {
        mode =
            EDIT_MODES[
                (EDIT_MODES.indexOf(this._edit_mode) + 1) % EDIT_MODES.length
            ];
    }

    (this.parentElement as any)?.setSelection?.();
    this._edit_mode = mode;
    if (this.model) {
        this.model._edit_mode = mode;
        this.model._selection_state = {
            selected_areas: [],
            dirty: true,
        };
    }

    if (this._edit_button !== undefined) {
        this._edit_button.dataset.editMode = mode;
    }
}

export function toggle_scroll_lock(
    this: DatagridPluginElement,
    force?: boolean,
): void {
    if (typeof force === "undefined") {
        force = !this._is_scroll_lock;
    }

    this._is_scroll_lock = force;
    this.classList.toggle("sub-cell-scroll-disabled", force);
    if (this._scroll_lock !== undefined) {
        this._scroll_lock.classList.toggle("lock-scroll", force);
    }
}
