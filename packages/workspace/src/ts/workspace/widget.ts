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

import { Widget } from "@lumino/widgets";
import { Message } from "@lumino/messaging";

import type * as psp_viewer from "@perspective-dev/viewer";
import type * as psp from "@perspective-dev/client";
import { PerspectiveTabBar } from "./tabbar";

interface IPerspectiveViewerWidgetOptions {
    node: HTMLElement;
    viewer: psp_viewer.HTMLPerspectiveViewerElement;
    onAttach?: () => void;
}

export class PerspectiveViewerWidget extends Widget {
    viewer: psp_viewer.HTMLPerspectiveViewerElement;
    _title: string;
    _is_pivoted: boolean;
    _restore_config?: () => Promise<void>;
    _onAttach?: () => void;
    _titlebar?: PerspectiveTabBar;
    _deleted: boolean;
    _titlebar_callback?: (event: MouseEvent) => {};

    constructor({ viewer, node, onAttach }: IPerspectiveViewerWidgetOptions) {
        super({ node });
        this.viewer = viewer;
        this._title = "";
        this._is_pivoted = false;
        this._onAttach = onAttach;
        this._deleted = false;
    }

    get name(): string {
        return this._title;
    }

    toggleConfig(): Promise<void> {
        return this.viewer.toggleConfig();
    }

    async load(table: psp.Table | Promise<psp.Table>) {
        let promises = [this.viewer.load(table)];
        if (this._restore_config) {
            promises.push(this._restore_config());
        }

        await Promise.all(promises);
    }

    restore(config: psp_viewer.ViewerConfigUpdate) {
        this._title = config.title as string;
        this.title.label = config.title as string;
        this._is_pivoted = (config.group_by?.length || 0) > 0;
        return this.viewer.restore({ ...config });
    }

    async save() {
        let config = await this.viewer.save();
        config["settings"] = false;
        return config;
    }

    addClass(name: string) {
        super.addClass(name);
        this.viewer?.classList?.add?.(name);
    }

    removeClass(name: string) {
        super.removeClass(name);
        this.viewer?.classList?.remove?.(name);
    }

    setCallback(callback?: (event: MouseEvent) => {}) {
        this._titlebar_callback = callback;
    }

    protected onAfterAttach(msg: Message) {
        super.onAfterAttach(msg);
        this._onAttach?.();
    }

    onCloseRequest(msg: Message) {
        super.onCloseRequest(msg);
        return (async () => {
            if (this.viewer.parentElement) {
                this.viewer.parentElement.removeChild(this.viewer);
            }

            if (!this._deleted) {
                await this.viewer.delete();
                this._deleted = true;
            }
        })();
    }
}
