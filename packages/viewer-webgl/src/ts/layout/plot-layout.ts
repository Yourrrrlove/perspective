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

export interface PlotMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface PlotRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface PlotLayoutOptions {
    hasXLabel: boolean;
    hasYLabel: boolean;
    hasLegend: boolean;
}

/**
 * Coordinates margins and coordinate transforms between WebGL and Canvas2D.
 * All measurements are in CSS pixels (not physical/DPR-scaled pixels).
 */
export class PlotLayout {
    readonly margins: PlotMargins;
    readonly plotRect: PlotRect;
    readonly cssWidth: number;
    readonly cssHeight: number;

    // Padded domain set by buildProjectionMatrix, used by dataToPixel
    // and pixelToData for tooltip hit-testing.
    paddedXMin = 0;
    paddedXMax = 1;
    paddedYMin = 0;
    paddedYMax = 1;

    constructor(
        cssWidth: number,
        cssHeight: number,
        options: PlotLayoutOptions,
    ) {
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;

        const left = 55 + (options.hasYLabel ? 16 : 0);
        const bottom = 24 + (options.hasXLabel ? 18 : 0);
        const top = 12;
        const right = options.hasLegend ? 80 : 16;

        this.margins = { top, right, bottom, left };
        this.plotRect = {
            x: left,
            y: top,
            width: Math.max(1, cssWidth - left - right),
            height: Math.max(1, cssHeight - top - bottom),
        };
    }

    /**
     * Build an orthographic projection matrix that maps data coordinates
     * [xMin..xMax, yMin..yMax] to the plot area sub-region of clip space [-1, 1].
     *
     * The matrix bakes margin offsets into the transform so that gl.viewport
     * remains full-canvas and no scissor/sub-viewport is needed.
     */
    buildProjectionMatrix(
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number,
    ): Float32Array {
        // Add 5% padding to data range
        let xRange = xMax - xMin;
        let yRange = yMax - yMin;
        if (xRange === 0) xRange = 1;
        if (yRange === 0) yRange = 1;
        const xPad = xRange * 0.02;
        const yPad = yRange * 0.02;
        xMin -= xPad;
        xMax += xPad;
        yMin -= yPad;
        yMax += yPad;

        // Store padded domain for dataToPixel
        this.paddedXMin = xMin;
        this.paddedXMax = xMax;
        this.paddedYMin = yMin;
        this.paddedYMax = yMax;

        // Clip-space bounds for the plot area
        const clipLeft = (2 * this.margins.left) / this.cssWidth - 1;
        const clipRight = 1 - (2 * this.margins.right) / this.cssWidth;
        const clipBottom = (2 * this.margins.bottom) / this.cssHeight - 1;
        const clipTop = 1 - (2 * this.margins.top) / this.cssHeight;

        // Scale and translate: data [min,max] → clip [clipMin, clipMax]
        const sx = (clipRight - clipLeft) / (xMax - xMin);
        const sy = (clipTop - clipBottom) / (yMax - yMin);
        const tx = clipLeft - sx * xMin;
        const ty = clipBottom - sy * yMin;

        // Column-major 4x4 matrix
        // prettier-ignore
        return new Float32Array([
            sx,  0,   0, 0,
            0,   sy,  0, 0,
            0,   0,  -1, 0,
            tx,  ty,  0, 1,
        ]);
    }

    /**
     * Convert data coordinates to CSS pixel coordinates on the overlay canvas.
     * Uses the padded domain from the last `buildProjectionMatrix` call so
     * that pixel positions align exactly with the WebGL projection.
     */
    dataToPixel(dataX: number, dataY: number): { px: number; py: number } {
        const { x, y, width, height } = this.plotRect;
        const tx =
            (dataX - this.paddedXMin) / (this.paddedXMax - this.paddedXMin);
        const ty =
            (dataY - this.paddedYMin) / (this.paddedYMax - this.paddedYMin);
        return {
            px: x + tx * width,
            py: y + (1 - ty) * height, // Y is flipped (CSS Y goes down)
        };
    }
}
