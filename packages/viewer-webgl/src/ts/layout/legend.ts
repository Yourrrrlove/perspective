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

import type { PlotLayout } from "./plot-layout";
import { formatTickValue } from "./ticks";

/**
 * Render a vertical color gradient legend on the Canvas2D overlay.
 * Only call when a color column is active.
 */
export function renderLegend(
    canvas: HTMLCanvasElement,
    layout: PlotLayout,
    colorDomain: { min: number; max: number; label: string },
    colorStart: [number, number, number],
    colorEnd: [number, number, number],
): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const style = getComputedStyle(canvas);
    const textColor =
        style.getPropertyValue("--psp-webgl--legend--color").trim() ||
        "rgba(180, 180, 180, 0.9)";
    const borderColor =
        style.getPropertyValue("--psp-webgl--legend-border--color").trim() ||
        "rgba(128,128,128,0.3)";
    const fontFamily =
        style.getPropertyValue("--psp-webgl--font-family").trim() ||
        "monospace";

    const barWidth = 16;
    const barHeight = Math.min(120, layout.plotRect.height * 0.4);
    const x = layout.plotRect.x + layout.plotRect.width + 12;
    const y = layout.margins.top + 20;

    // Column label
    ctx.fillStyle = textColor;
    ctx.font = `11px ${fontFamily}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(colorDomain.label, x, y - 4);

    // Gradient bar (top = max, bottom = min)
    const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
    gradient.addColorStop(
        0,
        `rgb(${colorEnd[0] * 255},${colorEnd[1] * 255},${colorEnd[2] * 255})`,
    );
    gradient.addColorStop(
        1,
        `rgb(${colorStart[0] * 255},${colorStart[1] * 255},${colorStart[2] * 255})`,
    );
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    // Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Tick labels alongside the bar
    ctx.fillStyle = textColor;
    ctx.font = `10px ${fontFamily}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const labelX = x + barWidth + 5;
    ctx.fillText(formatTickValue(colorDomain.max), labelX, y + 2);
    ctx.fillText(
        formatTickValue((colorDomain.min + colorDomain.max) / 2),
        labelX,
        y + barHeight / 2,
    );
    ctx.fillText(formatTickValue(colorDomain.min), labelX, y + barHeight - 2);
}

/**
 * Render a categorical legend with discrete colored swatches.
 * Used when split_by or string color columns produce distinct categories.
 */
export function renderCategoricalLegend(
    canvas: HTMLCanvasElement,
    layout: PlotLayout,
    labels: Map<string, number>,
    colorStart: [number, number, number],
    colorEnd: [number, number, number],
): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (labels.size === 0) return;

    const style = getComputedStyle(canvas);
    const textColor =
        style.getPropertyValue("--psp-webgl--legend--color").trim() ||
        "rgba(180, 180, 180, 0.9)";
    const fontFamily =
        style.getPropertyValue("--psp-webgl--font-family").trim() ||
        "monospace";

    const swatchSize = 10;
    const lineHeight = 18;
    const x = layout.plotRect.x + layout.plotRect.width + 12;
    let y = layout.margins.top + 10;
    const maxIdx = labels.size - 1;

    ctx.font = `11px ${fontFamily}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    for (const [label, idx] of labels) {
        const t = maxIdx > 0 ? idx / maxIdx : 0;
        const r = Math.round(
            (colorStart[0] + t * (colorEnd[0] - colorStart[0])) * 255,
        );
        const g = Math.round(
            (colorStart[1] + t * (colorEnd[1] - colorStart[1])) * 255,
        );
        const b = Math.round(
            (colorStart[2] + t * (colorEnd[2] - colorStart[2])) * 255,
        );

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y - swatchSize / 2, swatchSize, swatchSize);

        ctx.fillStyle = textColor;
        ctx.fillText(label, x + swatchSize + 6, y);

        y += lineHeight;
    }
}
