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

import CHARTS from "./plugin/charts";
import { HTMLPerspectiveViewerWebGLPluginElement } from "./plugin/plugin";
import { ScatterChart } from "./charts/scatter";
import { LineChart } from "./charts/line";
import { TreemapChart } from "./charts/treemap";

const CHART_IMPLS: Record<(typeof CHARTS)[number]["tag"], new () => any> = {
    scatter: ScatterChart,
    line: LineChart,
    treemap: TreemapChart,
};

export function register(...plugin_names: string[]) {
    const plugins = new Set(
        plugin_names.length > 0
            ? plugin_names
            : CHARTS.map((chart) => chart.name),
    );

    CHARTS.forEach((chart) => {
        if (plugins.has(chart.name)) {
            const tagName = `perspective-viewer-webgl-${chart.tag}`;
            const ImplClass = CHART_IMPLS[chart.tag];

            customElements.define(
                tagName,
                class extends HTMLPerspectiveViewerWebGLPluginElement {
                    _chartType = chart;
                    static _chartType = chart;

                    constructor() {
                        super();
                        (this as any)._chartImpl = new ImplClass();
                    }
                },
            );

            customElements.whenDefined("perspective-viewer").then(async () => {
                const Viewer = customElements.get("perspective-viewer") as any;
                await Viewer.registerPlugin(tagName);
            });
        }
    });
}

register();
