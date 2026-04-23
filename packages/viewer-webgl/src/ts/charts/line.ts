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

import type { ColumnDataMap } from "../data/arrow-reader";
import type { WebGLContextManager } from "../webgl/context-manager";
import type { ChartImplementation } from "./chart";
import type { ZoomController } from "../interaction/zoom-controller";
import { SpatialGrid } from "../interaction/spatial-grid";
import { parseCSSColorToVec3, getCSSVar } from "../utils/css";
import { PlotLayout } from "../layout/plot-layout";
import {
    computeTicks,
    renderGridlines,
    renderAxesChrome,
    type AxisDomain,
} from "../layout/axes";
import { renderCategoricalLegend } from "../layout/legend";
import { formatTickValue, formatDateTickValue } from "../layout/ticks";
import lineVert from "../shaders/line.vert.glsl";
import lineFrag from "../shaders/line.frag.glsl";

const TOOLTIP_RADIUS_PX = 24;
const LINE_WIDTH_PX = 2.0;

// ── Types ──────────────────────────────────────────────────────────────────────

interface SplitGroup {
    prefix: string;
    xColName: string;
    yColName: string;
}

interface CachedLocations {
    u_projection: WebGLUniformLocation | null;
    u_color: WebGLUniformLocation | null;
    u_resolution: WebGLUniformLocation | null;
    u_line_width: WebGLUniformLocation | null;
    a_start: number;
    a_end: number;
    a_corner: number;
}

// ── LineChart ──────────────────────────────────────────────────────────────────

export class LineChart implements ChartImplementation {
    private _program: WebGLProgram | null = null;
    private _locations: CachedLocations | null = null;
    private _cornerBuffer: WebGLBuffer | null = null;
    private _gridlineCanvas: HTMLCanvasElement | null = null;
    private _chromeCanvas: HTMLCanvasElement | null = null;
    private _zoomController: ZoomController | null = null;
    private _glManager: WebGLContextManager | null = null;

    // Column config
    private _columnSlots: (string | null)[] = [];
    private _groupBy: string[] = [];
    private _splitBy: string[] = [];
    private _columnTypes: Record<string, string> = {};
    private _xName = "";
    private _yName = "";
    private _xLabel = "";
    private _yLabel = "";
    private _xIsRowIndex = false;
    private _splitGroups: SplitGroup[] = [];

    // Series-first VBO: series i at [i*cap .. (i+1)*cap), raw data points
    private _seriesCapacity = 0;
    private _seriesUploadedCounts: number[] = [];

    // Data domain
    private _xMin = Infinity;
    private _xMax = -Infinity;
    private _yMin = Infinity;
    private _yMax = -Infinity;

    // CPU hit-test data (flat: series i at [i*cap .. i*cap+count))
    private _xData: Float32Array | null = null;
    private _yData: Float32Array | null = null;

    // Reusable staging buffer (one series at a time)
    private _stagingPositions: Float32Array | null = null;
    private _stagingSize = 0;

    // Spatial index
    private _spatialGrid: SpatialGrid | null = null;
    private _spatialGridDirty = true;

    // Categorical colors (split prefix → index)
    private _uniqueColorLabels: Map<string, number> = new Map();

    // Tooltip state
    private _lastLayout: PlotLayout | null = null;
    private _hoveredIndex = -1;
    private _pinnedIndex = -1;
    private _pinnedTooltip: HTMLDivElement | null = null;
    private _glCanvas: HTMLCanvasElement | null = null;
    private _mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
    private _mouseLeaveHandler: (() => void) | null = null;
    private _clickHandler: ((e: MouseEvent) => void) | null = null;
    private _hoverRAFId = 0;

    // Render batching
    private _renderScheduled = false;
    private _renderRAFId = 0;

    // Cached chrome state
    private _lastXDomain: AxisDomain | null = null;
    private _lastYDomain: AxisDomain | null = null;
    private _lastXTicks: number[] | null = null;
    private _lastYTicks: number[] | null = null;
    private _lastColorStart: [number, number, number] = [0.13, 0.4, 0.84];
    private _lastColorEnd: [number, number, number] = [1.0, 0.5, 0.06];

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    setGridlineCanvas(canvas: HTMLCanvasElement): void {
        this._gridlineCanvas = canvas;
    }

    setChromeCanvas(canvas: HTMLCanvasElement): void {
        this._chromeCanvas = canvas;
    }

    setZoomController(zc: ZoomController): void {
        this._zoomController = zc;
    }

    setColumnSlots(slots: (string | null)[]): void {
        this._columnSlots = slots;
    }

    setViewPivots(groupBy: string[], splitBy: string[]): void {
        this._groupBy = groupBy;
        this._splitBy = splitBy;
    }

    setColumnTypes(schema: Record<string, string>): void {
        this._columnTypes = schema;
    }

    attachTooltip(glCanvas: HTMLCanvasElement): void {
        this._glCanvas = glCanvas;

        this._mouseMoveHandler = (e: MouseEvent) => {
            if (this._pinnedIndex >= 0) return;
            if (this._hoverRAFId) return;
            const rect = glCanvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            this._hoverRAFId = requestAnimationFrame(() => {
                this._hoverRAFId = 0;
                this._handleHover(mx, my);
            });
        };

        this._mouseLeaveHandler = () => {
            if (this._pinnedIndex >= 0) return;
            if (this._hoveredIndex !== -1) {
                this._hoveredIndex = -1;
                this._renderChromeOverlay();
            }
        };

        this._clickHandler = () => {
            if (this._pinnedIndex >= 0) {
                this._dismissPinnedTooltip();
                return;
            }
            if (this._hoveredIndex >= 0) {
                this._showPinnedTooltip(this._hoveredIndex);
            }
        };

        glCanvas.addEventListener("mousemove", this._mouseMoveHandler);
        glCanvas.addEventListener("mouseleave", this._mouseLeaveHandler);
        glCanvas.addEventListener("click", this._clickHandler);
    }

    private _detachTooltip(): void {
        if (this._glCanvas) {
            if (this._mouseMoveHandler) {
                this._glCanvas.removeEventListener(
                    "mousemove",
                    this._mouseMoveHandler,
                );
            }
            if (this._mouseLeaveHandler) {
                this._glCanvas.removeEventListener(
                    "mouseleave",
                    this._mouseLeaveHandler,
                );
            }
            if (this._clickHandler) {
                this._glCanvas.removeEventListener("click", this._clickHandler);
            }
        }
        this._mouseMoveHandler = null;
        this._mouseLeaveHandler = null;
        this._clickHandler = null;
    }

    // ── Split groups ───────────────────────────────────────────────────────────

    private _buildSplitGroups(
        columns: ColumnDataMap,
        xBase: string,
        yBase: string,
    ): SplitGroup[] {
        const grouped = new Map<string, Set<string>>();
        for (const key of columns.keys()) {
            if (key.startsWith("__")) continue;
            const pipeIdx = key.lastIndexOf("|");
            if (pipeIdx === -1) continue;
            const prefix = key.substring(0, pipeIdx);
            if (!grouped.has(prefix)) grouped.set(prefix, new Set());
            grouped.get(prefix)!.add(key);
        }

        const groups: SplitGroup[] = [];
        for (const [prefix, colNames] of grouped) {
            const yColName = `${prefix}|${yBase}`;
            if (!colNames.has(yColName)) continue;
            const yCol = columns.get(yColName);
            if (!yCol?.values) continue;

            if (xBase) {
                const xColName = `${prefix}|${xBase}`;
                if (!colNames.has(xColName)) continue;
                const xCol = columns.get(xColName);
                if (!xCol?.values) continue;
                groups.push({ prefix, xColName, yColName });
            } else {
                groups.push({ prefix, xColName: "", yColName });
            }
        }
        return groups;
    }

    // ── Upload ─────────────────────────────────────────────────────────────────

    uploadAndRender(
        glManager: WebGLContextManager,
        columns: ColumnDataMap,
        startRow: number,
        endRow: number,
    ): void {
        const chunkLength = endRow - startRow;
        this._glManager = glManager;
        const gl = glManager.gl;

        // ── First chunk: init ──────────────────────────────────────────────────
        if (startRow === 0) {
            // Cancel any pending RAF from the previous stream.
            if (this._renderRAFId) {
                cancelAnimationFrame(this._renderRAFId);
                this._renderRAFId = 0;
                this._renderScheduled = false;
            }

            if (!this._program) {
                this._program = glManager.shaders.getOrCreate(
                    "line",
                    lineVert,
                    lineFrag,
                );
                const p = this._program;
                this._locations = {
                    u_projection: gl.getUniformLocation(p, "u_projection"),
                    u_color: gl.getUniformLocation(p, "u_color"),
                    u_resolution: gl.getUniformLocation(p, "u_resolution"),
                    u_line_width: gl.getUniformLocation(p, "u_line_width"),
                    a_start: gl.getAttribLocation(p, "a_start"),
                    a_end: gl.getAttribLocation(p, "a_end"),
                    a_corner: gl.getAttribLocation(p, "a_corner"),
                };

                // Static corner buffer: [0, 1, 2, 3]
                this._cornerBuffer = gl.createBuffer()!;
                gl.bindBuffer(gl.ARRAY_BUFFER, this._cornerBuffer);
                gl.bufferData(
                    gl.ARRAY_BUFFER,
                    new Float32Array([0, 1, 2, 3]),
                    gl.STATIC_DRAW,
                );
            }

            this._xMin = Infinity;
            this._xMax = -Infinity;
            this._yMin = Infinity;
            this._yMax = -Infinity;
            this._spatialGrid = null;
            this._spatialGridDirty = true;
            this._uniqueColorLabels = new Map();

            const slots = this._columnSlots;
            const xBase = slots[0] || "";
            const yBase = slots[1] || "";
            this._xLabel = xBase;
            this._yLabel = yBase;
            this._xIsRowIndex = !xBase;

            if (this._splitBy.length > 0) {
                this._splitGroups = this._buildSplitGroups(
                    columns,
                    xBase,
                    yBase,
                );
                if (this._splitGroups.length === 0) return;
                for (const sg of this._splitGroups) {
                    if (!this._uniqueColorLabels.has(sg.prefix)) {
                        this._uniqueColorLabels.set(
                            sg.prefix,
                            this._uniqueColorLabels.size,
                        );
                    }
                }
                this._xName = this._splitGroups[0].xColName;
                this._yName = this._splitGroups[0].yColName;
            } else {
                this._splitGroups = [];
                this._xName = xBase;
                this._yName = yBase;
            }

            const numSeries = Math.max(1, this._splitGroups.length);
            const rowsPerSeries = glManager.bufferPool.totalCapacity || endRow;
            this._seriesCapacity = rowsPerSeries;
            this._seriesUploadedCounts = new Array(numSeries).fill(0);

            // Raw position buffer — no expansion needed
            glManager.ensureBufferCapacity(numSeries * rowsPerSeries);

            const cpuCap = numSeries * rowsPerSeries;
            this._xData = new Float32Array(cpuCap);
            this._yData = new Float32Array(cpuCap);
        }

        if (!this._locations) return;

        const numSeries = Math.max(1, this._splitGroups.length);

        // ── Leaf filter ────────────────────────────────────────────────────────
        let rowIndices: number[] | null = null;
        if (this._groupBy.length > 0) {
            const rowPathCol = columns.get("__ROW_PATH__");
            if (rowPathCol?.type === "list-string" && rowPathCol.listValues) {
                rowIndices = [];
                for (let i = 0; i < chunkLength; i++) {
                    if (
                        rowPathCol.listValues[i].length === this._groupBy.length
                    ) {
                        rowIndices.push(i);
                    }
                }
            }
        }

        const sourceLength = rowIndices ? rowIndices.length : chunkLength;
        if (sourceLength === 0) return;

        // Ensure staging buffer
        if (this._stagingSize < sourceLength) {
            this._stagingPositions = new Float32Array(sourceLength * 2);
            this._stagingSize = sourceLength;
        }
        const positions = this._stagingPositions!;

        const hasSplits = this._splitGroups.length > 0;

        // ── Process each series ────────────────────────────────────────────────
        for (let s = 0; s < numSeries; s++) {
            let xValues: Float32Array | Int32Array | null = null;
            let yValues: Float32Array | Int32Array | null = null;
            let xValid: Uint8Array | undefined;
            let yValid: Uint8Array | undefined;

            if (hasSplits) {
                const sg = this._splitGroups[s];
                if (sg.xColName) {
                    const xc = columns.get(sg.xColName);
                    if (!xc?.values) continue;
                    xValues = xc.values;
                    xValid = xc.valid;
                }
                const yc = columns.get(sg.yColName);
                if (!yc?.values) continue;
                yValues = yc.values;
                yValid = yc.valid;
            } else {
                if (!this._xIsRowIndex && this._xName) {
                    const xc = columns.get(this._xName);
                    if (!xc?.values) continue;
                    xValues = xc.values;
                    xValid = xc.valid;
                }
                if (this._yName) {
                    const yc = columns.get(this._yName);
                    if (!yc?.values) continue;
                    yValues = yc.values;
                    yValid = yc.valid;
                }
            }

            if (!yValues) continue;

            let writeIdx = 0;
            const prevCount = this._seriesUploadedCounts[s];
            const cpuBase = s * this._seriesCapacity + prevCount;

            for (let j = 0; j < sourceLength; j++) {
                const i = rowIndices ? rowIndices[j] : j;
                if (yValid && !yValid[i]) continue;
                if (xValid && !xValid[i]) continue;

                const y = yValues[i] as number;
                const x = xValues ? (xValues[i] as number) : startRow + i;
                if (isNaN(x) || isNaN(y)) continue;

                if (x < this._xMin) this._xMin = x;
                if (x > this._xMax) this._xMax = x;
                if (y < this._yMin) this._yMin = y;
                if (y > this._yMax) this._yMax = y;

                this._xData![cpuBase + writeIdx] = x;
                this._yData![cpuBase + writeIdx] = y;

                positions[writeIdx * 2] = x;
                positions[writeIdx * 2 + 1] = y;
                writeIdx++;
            }

            if (writeIdx === 0) continue;

            const byteOffset =
                (s * this._seriesCapacity + prevCount) *
                2 *
                Float32Array.BYTES_PER_ELEMENT;
            glManager.bufferPool.upload(
                "a_position",
                positions.subarray(0, writeIdx * 2),
                byteOffset,
                2,
            );

            this._seriesUploadedCounts[s] += writeIdx;
        }

        glManager.uploadedCount = this._seriesUploadedCounts.reduce(
            (a, c) => a + c,
            0,
        );
        this._spatialGridDirty = true;

        if (this._zoomController && isFinite(this._xMin)) {
            this._zoomController.setBaseDomain(
                this._xMin,
                this._xMax,
                this._yMin,
                this._yMax,
            );
        }

        this._scheduleRender(glManager);
    }

    private _scheduleRender(glManager: WebGLContextManager): void {
        if (this._renderScheduled) return;
        this._renderScheduled = true;
        this._renderRAFId = requestAnimationFrame(() => {
            this._renderScheduled = false;
            this._renderRAFId = 0;
            this._fullRender(glManager);
        });
    }

    redraw(glManager: WebGLContextManager): void {
        if (!this._program || glManager.uploadedCount === 0) return;
        this._glManager = glManager;
        this._fullRender(glManager);
    }

    // ── Full render ────────────────────────────────────────────────────────────

    private _fullRender(glManager: WebGLContextManager): void {
        const gl = glManager.gl;
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = gl.canvas.width / dpr;
        const cssHeight = gl.canvas.height / dpr;
        if (cssWidth <= 0 || cssHeight <= 0) return;

        const numSeries = Math.max(1, this._splitGroups.length);
        const hasSplits = this._splitGroups.length > 0;

        let domain: { xMin: number; xMax: number; yMin: number; yMax: number };
        if (this._zoomController) {
            domain = this._zoomController.getVisibleDomain();
        } else {
            domain = {
                xMin: this._xMin,
                xMax: this._xMax,
                yMin: this._yMin,
                yMax: this._yMax,
            };
        }
        if (!isFinite(domain.xMin) || !isFinite(domain.yMin)) return;

        const layout = new PlotLayout(cssWidth, cssHeight, {
            hasXLabel: !!this._xLabel,
            hasYLabel: !!this._yLabel,
            hasLegend: hasSplits,
        });
        this._lastLayout = layout;

        if (this._zoomController) {
            this._zoomController.updateLayout(layout);
        }

        const projection = layout.buildProjectionMatrix(
            domain.xMin,
            domain.xMax,
            domain.yMin,
            domain.yMax,
        );

        const themeEl = this._gridlineCanvas!;
        const colorStart = parseCSSColorToVec3(
            getCSSVar(themeEl, "--psp-webgl--gradient-start--color", "#0366d6"),
        );
        const colorEnd = parseCSSColorToVec3(
            getCSSVar(themeEl, "--psp-webgl--gradient-end--color", "#ff7f0e"),
        );

        const xType = this._columnTypes[this._xLabel] || "";
        const yType = this._columnTypes[this._yLabel] || "";
        const xIsDate = xType === "date" || xType === "datetime";
        const yIsDate = yType === "date" || yType === "datetime";

        const xDomain: AxisDomain = {
            min: domain.xMin,
            max: domain.xMax,
            label: this._xLabel || (this._xIsRowIndex ? "Row" : ""),
            isDate: xIsDate,
        };
        const yDomain: AxisDomain = {
            min: domain.yMin,
            max: domain.yMax,
            label: this._yLabel,
            isDate: yIsDate,
        };
        const { xTicks, yTicks } = computeTicks(xDomain, yDomain, layout);

        // Layer 1 — gridlines
        if (this._gridlineCanvas) {
            renderGridlines(
                this._gridlineCanvas,
                layout,
                xTicks,
                yTicks,
                this._gridlineCanvas,
            );
        }

        // Layer 2 — WebGL instanced line segments
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(
            Math.round(layout.margins.left * dpr),
            Math.round(layout.margins.bottom * dpr),
            Math.round(layout.plotRect.width * dpr),
            Math.round(layout.plotRect.height * dpr),
        );

        gl.useProgram(this._program!);
        const loc = this._locations!;
        gl.uniformMatrix4fv(loc.u_projection, false, projection);
        gl.uniform2f(loc.u_resolution, gl.canvas.width, gl.canvas.height);
        gl.uniform1f(loc.u_line_width, LINE_WIDTH_PX * dpr);

        const posBuf = glManager.bufferPool.getOrCreate(
            "a_position",
            2,
            Float32Array.BYTES_PER_ELEMENT,
        );

        // Instancing support (WebGL2 native or ANGLE extension)
        const gl2 = glManager.isWebGL2 ? (gl as WebGL2RenderingContext) : null;
        const ext = !gl2
            ? (gl.getExtension(
                  "ANGLE_instanced_arrays",
              ) as ANGLE_instanced_arrays | null)
            : null;

        const setDivisor = (location: number, divisor: number) => {
            if (gl2) gl2.vertexAttribDivisor(location, divisor);
            else if (ext) ext.vertexAttribDivisorANGLE(location, divisor);
        };

        const drawInstanced = (
            mode: number,
            first: number,
            count: number,
            instances: number,
        ) => {
            if (gl2) gl2.drawArraysInstanced(mode, first, count, instances);
            else if (ext)
                ext.drawArraysInstancedANGLE(mode, first, count, instances);
        };

        // Corner buffer (per-vertex, divisor=0)
        gl.bindBuffer(gl.ARRAY_BUFFER, this._cornerBuffer!);
        gl.enableVertexAttribArray(loc.a_corner);
        gl.vertexAttribPointer(loc.a_corner, 1, gl.FLOAT, false, 0, 0);
        setDivisor(loc.a_corner, 0);

        // Draw each series
        for (let s = 0; s < numSeries; s++) {
            const count = this._seriesUploadedCounts[s] ?? 0;
            if (count < 2) continue;

            const t = numSeries === 1 ? 0.5 : s / (numSeries - 1);
            const r = colorStart[0] + t * (colorEnd[0] - colorStart[0]);
            const g = colorStart[1] + t * (colorEnd[1] - colorStart[1]);
            const b = colorStart[2] + t * (colorEnd[2] - colorStart[2]);
            gl.uniform4f(loc.u_color, r, g, b, 1.0);

            const seriesStart = s * this._seriesCapacity;
            const startBytes = seriesStart * 2 * Float32Array.BYTES_PER_ELEMENT;
            const stride = 2 * Float32Array.BYTES_PER_ELEMENT;

            // a_start: position[seriesStart + instance]
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuf.buffer);
            gl.enableVertexAttribArray(loc.a_start);
            gl.vertexAttribPointer(
                loc.a_start,
                2,
                gl.FLOAT,
                false,
                stride,
                startBytes,
            );
            setDivisor(loc.a_start, 1);

            // a_end: position[seriesStart + 1 + instance]
            gl.enableVertexAttribArray(loc.a_end);
            gl.vertexAttribPointer(
                loc.a_end,
                2,
                gl.FLOAT,
                false,
                stride,
                startBytes + stride,
            );
            setDivisor(loc.a_end, 1);

            drawInstanced(gl.TRIANGLE_STRIP, 0, 4, count - 1);
        }

        // Reset divisors so other draw calls aren't affected
        setDivisor(loc.a_start, 0);
        setDivisor(loc.a_end, 0);

        gl.disable(gl.SCISSOR_TEST);

        this._lastXDomain = xDomain;
        this._lastYDomain = yDomain;
        this._lastXTicks = xTicks;
        this._lastYTicks = yTicks;
        this._lastColorStart = colorStart;
        this._lastColorEnd = colorEnd;

        // Layer 3 — chrome overlay
        this._renderChromeOverlay();
    }

    private _renderChromeOverlay(): void {
        if (
            !this._chromeCanvas ||
            !this._lastLayout ||
            !this._lastXDomain ||
            !this._lastYDomain
        )
            return;

        const layout = this._lastLayout;

        renderAxesChrome(
            this._chromeCanvas,
            this._lastXDomain,
            this._lastYDomain,
            layout,
            this._lastXTicks!,
            this._lastYTicks!,
        );

        if (this._uniqueColorLabels.size > 0) {
            renderCategoricalLegend(
                this._chromeCanvas,
                layout,
                this._uniqueColorLabels,
                this._lastColorStart,
                this._lastColorEnd,
            );
        }

        if (this._hoveredIndex >= 0 && this._xData) {
            this._renderTooltip(this._chromeCanvas, layout);
        }
    }

    // ── Tooltip ────────────────────────────────────────────────────────────────

    private _ensureSpatialGrid(): void {
        if (!this._spatialGridDirty || !this._xData || !this._yData) return;

        const xRange = this._xMax - this._xMin || 1;
        const yRange = this._yMax - this._yMin || 1;
        const avgRange = (xRange + yRange) / 2;
        const totalUploaded = this._seriesUploadedCounts.reduce(
            (a, c) => a + c,
            0,
        );
        const cellSize = avgRange / Math.max(1, Math.sqrt(totalUploaded));

        const grid = new SpatialGrid(
            this._xMin,
            this._xMax,
            this._yMin,
            this._yMax,
            cellSize,
        );

        const totalSeries = this._splitGroups.length || 1;
        for (let s = 0; s < totalSeries; s++) {
            const count = this._seriesUploadedCounts[s] ?? 0;
            const base = s * this._seriesCapacity;
            for (let j = 0; j < count; j++) {
                grid.insert(
                    base + j,
                    this._xData[base + j],
                    this._yData[base + j],
                );
            }
        }

        this._spatialGrid = grid;
        this._spatialGridDirty = false;
    }

    private _handleHover(mx: number, my: number): void {
        if (!this._xData || !this._yData || !this._lastLayout) return;

        const layout = this._lastLayout;
        const plot = layout.plotRect;

        if (
            mx < plot.x ||
            mx > plot.x + plot.width ||
            my < plot.y ||
            my > plot.y + plot.height
        ) {
            if (this._hoveredIndex !== -1) {
                this._hoveredIndex = -1;
                this._renderChromeOverlay();
            }
            return;
        }

        const xMin = layout.paddedXMin;
        const xMax = layout.paddedXMax;
        const yMin = layout.paddedYMin;
        const yMax = layout.paddedYMax;
        const dataX = xMin + ((mx - plot.x) / plot.width) * (xMax - xMin);
        const dataY = yMax - ((my - plot.y) / plot.height) * (yMax - yMin);
        const pxPerDataX = plot.width / (xMax - xMin);
        const pxPerDataY = plot.height / (yMax - yMin);

        this._ensureSpatialGrid();
        let bestIdx: number;
        if (this._spatialGrid) {
            bestIdx = this._spatialGrid.query(
                dataX,
                dataY,
                TOOLTIP_RADIUS_PX,
                pxPerDataX,
                pxPerDataY,
                this._xData,
                this._yData,
            );
        } else {
            bestIdx = -1;
            let bestDistSq = TOOLTIP_RADIUS_PX * TOOLTIP_RADIUS_PX;
            const totalSeries = this._splitGroups.length || 1;
            for (let s = 0; s < totalSeries; s++) {
                const count = this._seriesUploadedCounts[s] ?? 0;
                const base = s * this._seriesCapacity;
                for (let j = 0; j < count; j++) {
                    const idx = base + j;
                    const dx = (this._xData[idx] - dataX) * pxPerDataX;
                    const dy = (this._yData[idx] - dataY) * pxPerDataY;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < bestDistSq) {
                        bestDistSq = distSq;
                        bestIdx = idx;
                    }
                }
            }
        }

        if (bestIdx !== this._hoveredIndex) {
            this._hoveredIndex = bestIdx;
            this._renderChromeOverlay();
        }
    }

    private _renderTooltip(
        canvas: HTMLCanvasElement,
        layout: PlotLayout,
    ): void {
        const idx = this._hoveredIndex;
        if (idx < 0 || !this._xData || !this._yData) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.scale(dpr, dpr);

        const xVal = this._xData[idx];
        const yVal = this._yData[idx];
        const pos = layout.dataToPixel(xVal, yVal);
        const lines = this._buildTooltipLines(idx, xVal, yVal);

        const fontFamily = getCSSVar(
            canvas,
            "--psp-webgl--font-family",
            "monospace",
        );
        const tickColor = getCSSVar(
            canvas,
            "--psp-webgl--axis-ticks--color",
            "rgba(128,128,128,0.8)",
        );
        const tooltipBg = getCSSVar(
            canvas,
            "--psp-webgl--tooltip--background",
            "rgba(155,155,155,0.8)",
        );
        const tooltipBorder = getCSSVar(
            canvas,
            "--psp-webgl--tooltip--border-color",
            "#fff",
        );
        const tooltipText = getCSSVar(
            canvas,
            "--psp-webgl--tooltip--color",
            "#161616",
        );

        ctx.font = `11px ${fontFamily}`;
        const lineHeight = 16;
        const padding = 8;
        let maxWidth = 0;
        for (const line of lines) {
            const w = ctx.measureText(line).width;
            if (w > maxWidth) maxWidth = w;
        }
        const boxW = maxWidth + padding * 2;
        const boxH = lines.length * lineHeight + padding * 2 - 4;

        let tx = pos.px + 12;
        let ty = pos.py - boxH - 8;
        if (tx + boxW > layout.cssWidth) tx = pos.px - boxW - 12;
        if (ty < 0) ty = pos.py + 12;
        if (ty + boxH > layout.cssHeight) ty = layout.cssHeight - boxH - 4;

        // Crosshair
        ctx.strokeStyle = tickColor;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pos.px, layout.plotRect.y);
        ctx.lineTo(pos.px, layout.plotRect.y + layout.plotRect.height);
        ctx.moveTo(layout.plotRect.x, pos.py);
        ctx.lineTo(layout.plotRect.x + layout.plotRect.width, pos.py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;

        // Highlight dot
        ctx.strokeStyle = tickColor;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Box
        ctx.fillStyle = tooltipBg;
        ctx.strokeStyle = tooltipBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, boxW, boxH, 4);
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = tooltipText;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], tx + padding, ty + padding + i * lineHeight);
        }

        ctx.restore();
    }

    private _buildTooltipLines(
        flatIdx: number,
        xVal: number,
        yVal: number,
    ): string[] {
        const lines: string[] = [];

        if (this._splitGroups.length > 0 && this._seriesCapacity > 0) {
            const seriesIdx = Math.floor(flatIdx / this._seriesCapacity);
            const sg = this._splitGroups[seriesIdx];
            if (sg) lines.push(sg.prefix);
        }

        const xType = this._columnTypes[this._xLabel] || "";
        const xIsDate = xType === "date" || xType === "datetime";
        const xFormatted = xIsDate
            ? formatDateTickValue(xVal)
            : formatTickValue(xVal);
        lines.push(`${this._xLabel || "Row"}: ${xFormatted}`);

        const yType = this._columnTypes[this._yLabel] || "";
        const yIsDate = yType === "date" || yType === "datetime";
        const yFormatted = yIsDate
            ? formatDateTickValue(yVal)
            : formatTickValue(yVal);
        lines.push(`${this._yLabel}: ${yFormatted}`);

        return lines;
    }

    private _showPinnedTooltip(pointIdx: number): void {
        this._dismissPinnedTooltip();
        this._pinnedIndex = pointIdx;

        if (pointIdx < 0 || !this._xData || !this._yData || !this._lastLayout)
            return;

        const layout = this._lastLayout;
        const xVal = this._xData[pointIdx];
        const yVal = this._yData[pointIdx];
        const pos = layout.dataToPixel(xVal, yVal);
        const lines = this._buildTooltipLines(pointIdx, xVal, yVal);
        if (lines.length === 0) return;

        const themeEl = this._gridlineCanvas || this._chromeCanvas;
        const tooltipBg = themeEl
            ? getCSSVar(
                  themeEl,
                  "--psp-webgl--tooltip--background",
                  "rgba(155,155,155,0.8)",
              )
            : "rgba(155,155,155,0.8)";
        const tooltipText = themeEl
            ? getCSSVar(themeEl, "--psp-webgl--tooltip--color", "#161616")
            : "#161616";
        const tooltipBorder = themeEl
            ? getCSSVar(themeEl, "--psp-webgl--tooltip--border-color", "#fff")
            : "#fff";
        const fontFamily = themeEl
            ? getCSSVar(themeEl, "--psp-webgl--font-family", "monospace")
            : "monospace";

        const div = document.createElement("div");
        div.style.cssText = [
            "position:absolute",
            "pointer-events:auto",
            `font:11px ${fontFamily}`,
            `background:${tooltipBg}`,
            `color:${tooltipText}`,
            `border:1px solid ${tooltipBorder}`,
            "border-radius:4px",
            "padding:8px",
            "overflow-y:auto",
            `max-height:${Math.round(layout.cssHeight * 0.6)}px`,
            "white-space:pre",
            "z-index:10",
            "line-height:16px",
        ].join(";");

        div.textContent = lines.join("\n");

        const parent = this._glCanvas?.parentElement;
        if (!parent) return;
        parent.style.position = "relative";
        div.style.left = "-9999px";
        div.style.top = "0px";
        parent.appendChild(div);
        this._pinnedTooltip = div;

        const divW = div.getBoundingClientRect().width;
        const divH = div.getBoundingClientRect().height;
        let tx = pos.px + 12;
        let ty = pos.py - divH - 8;
        if (tx + divW > layout.cssWidth) tx = pos.px - divW - 12;
        if (tx < 0) tx = 4;
        if (ty < 0) ty = pos.py + 12;
        if (ty + divH > layout.cssHeight) ty = layout.cssHeight - divH - 4;

        div.style.left = `${tx}px`;
        div.style.top = `${ty}px`;

        this._hoveredIndex = -1;
        this._renderChromeOverlay();
    }

    private _dismissPinnedTooltip(): void {
        if (this._pinnedTooltip) {
            this._pinnedTooltip.remove();
            this._pinnedTooltip = null;
        }
        this._pinnedIndex = -1;
    }

    // ── Cleanup ────────────────────────────────────────────────────────────────

    destroy(): void {
        this._detachTooltip();
        this._dismissPinnedTooltip();
        if (this._renderRAFId) {
            cancelAnimationFrame(this._renderRAFId);
            this._renderRAFId = 0;
            this._renderScheduled = false;
        }
        if (this._hoverRAFId) {
            cancelAnimationFrame(this._hoverRAFId);
            this._hoverRAFId = 0;
        }
        if (this._cornerBuffer && this._glManager) {
            this._glManager.gl.deleteBuffer(this._cornerBuffer);
        }
        this._program = null;
        this._locations = null;
        this._cornerBuffer = null;
        this._spatialGrid = null;
        this._xData = null;
        this._yData = null;
        this._stagingPositions = null;
        this._uniqueColorLabels = new Map();
        this._splitGroups = [];
        this._seriesUploadedCounts = [];
    }
}
