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
import { renderLegend, renderCategoricalLegend } from "../layout/legend";
import { formatTickValue, formatDateTickValue } from "../layout/ticks";
import scatterVert from "../shaders/scatter.vert.glsl";
import scatterFrag from "../shaders/scatter.frag.glsl";

const TOOLTIP_RADIUS_PX = 24;

interface CachedLocations {
    u_projection: WebGLUniformLocation | null;
    u_point_size: WebGLUniformLocation | null;
    u_color_range: WebGLUniformLocation | null;
    u_color_start: WebGLUniformLocation | null;
    u_color_end: WebGLUniformLocation | null;
    u_size_range: WebGLUniformLocation | null;
    u_point_size_range: WebGLUniformLocation | null;
    a_position: number;
    a_color_value: number;
    a_size_value: number;
}

interface SplitGroup {
    prefix: string;
    xColName: string;
    yColName: string;
    colorColName: string;
    sizeColName: string;
}

export class ScatterChart implements ChartImplementation {
    private _program: WebGLProgram | null = null;
    private _locations: CachedLocations | null = null;
    private _vao: WebGLVertexArrayObject | null = null;
    private _vaoSetup = false;
    private _gridlineCanvas: HTMLCanvasElement | null = null;
    private _chromeCanvas: HTMLCanvasElement | null = null;
    private _zoomController: ZoomController | null = null;
    private _glManager: WebGLContextManager | null = null;

    // Column slots from viewer config (with nulls for empty slots)
    // Slots: [X Axis, Y Axis, Color, Size, Tooltip]
    private _columnSlots: (string | null)[] = [];
    private _groupBy: string[] = [];
    private _splitBy: string[] = [];
    private _allColumns: string[] = [];
    private _xName = "";
    private _yName = "";
    private _xLabel = "";
    private _yLabel = "";
    private _colorName = "";
    private _sizeName = "";
    private _colorIsString = false;
    private _columnTypes: Record<string, string> = {};
    private _uniqueColorLabels: Map<string, number> = new Map();
    private _tooltipColumns: string[] = [];
    private _writeCursor = 0;
    private _splitGroups: SplitGroup[] = [];

    // Data domain (raw, un-zoomed)
    private _xMin = Infinity;
    private _xMax = -Infinity;
    private _yMin = Infinity;
    private _yMax = -Infinity;
    private _colorMin = Infinity;
    private _colorMax = -Infinity;
    private _sizeMin = Infinity;
    private _sizeMax = -Infinity;

    // CPU-side data for hit testing and tooltips
    private _xData: Float32Array | null = null;
    private _yData: Float32Array | null = null;
    private _colorData: Float32Array | null = null;
    // Typed arrays for numeric columns, regular arrays only for strings
    private _numericRowData: Map<string, Float32Array> = new Map();
    private _stringRowData: Map<string, string[]> = new Map();
    private _dataCount = 0;

    // Render batching: coalesce multiple chunk uploads into one frame
    private _renderScheduled = false;
    private _renderRAFId = 0;

    // Reusable staging buffers (avoids per-chunk allocations)
    private _stagingPositions: Float32Array | null = null;
    private _stagingColors: Float32Array | null = null;
    private _stagingSizes: Float32Array | null = null;
    private _stagingChunkSize = 0;

    // Spatial index for fast tooltip hit testing
    private _spatialGrid: SpatialGrid | null = null;
    private _spatialGridDirty = true;

    // Tooltip state
    private _lastLayout: PlotLayout | null = null;
    private _mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
    private _mouseLeaveHandler: (() => void) | null = null;
    private _clickHandler: ((e: MouseEvent) => void) | null = null;
    private _hoverRAFId = 0;
    private _hoveredIndex = -1;
    private _pinnedIndex = -1;
    private _pinnedTooltip: HTMLDivElement | null = null;
    private _glCanvas: HTMLCanvasElement | null = null;

    // Cached chrome render state (avoids full re-render on hover)
    private _lastXDomain: AxisDomain | null = null;
    private _lastYDomain: AxisDomain | null = null;
    private _lastXTicks: ReturnType<typeof computeTicks>["xTicks"] | null =
        null;
    private _lastYTicks: ReturnType<typeof computeTicks>["yTicks"] | null =
        null;
    private _lastColorStart: [number, number, number] = [0, 0, 0];
    private _lastColorEnd: [number, number, number] = [0, 0, 0];
    private _lastHasColorCol = false;

    setGridlineCanvas(canvas: HTMLCanvasElement): void {
        this._gridlineCanvas = canvas;
    }

    setChromeCanvas(canvas: HTMLCanvasElement): void {
        this._chromeCanvas = canvas;
    }

    /**
     * Attach tooltip mouse handlers to the WebGL canvas (not overlay).
     * Call after setGridlineCanvas.
     */
    attachTooltip(glCanvas: HTMLCanvasElement): void {
        this._detachTooltip();
        this._glCanvas = glCanvas;

        this._mouseMoveHandler = (e: MouseEvent) => {
            if (this._pinnedIndex >= 0) return; // Don't hover while pinned
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

    private _ensureSpatialGrid(): void {
        if (!this._spatialGridDirty || !this._xData || !this._yData) return;
        if (this._dataCount === 0) return;

        // Cell size in data units: aim for ~sqrt(n) cells for good distribution
        const xRange = this._xMax - this._xMin || 1;
        const yRange = this._yMax - this._yMin || 1;
        const avgRange = (xRange + yRange) / 2;
        const cellSize = avgRange / Math.max(1, Math.sqrt(this._dataCount));

        const grid = new SpatialGrid(
            this._xMin,
            this._xMax,
            this._yMin,
            this._yMax,
            cellSize,
        );
        for (let i = 0; i < this._dataCount; i++) {
            grid.insert(i, this._xData[i], this._yData[i]);
        }
        this._spatialGrid = grid;
        this._spatialGridDirty = false;
    }

    private _handleHover(mx: number, my: number): void {
        if (
            !this._xData ||
            !this._yData ||
            !this._lastLayout ||
            !this._glManager
        )
            return;

        const layout = this._lastLayout;
        const plot = layout.plotRect;

        // Only respond in plot area
        if (
            mx < plot.x ||
            mx > plot.x + plot.width ||
            my < plot.y ||
            my > plot.y + plot.height
        ) {
            if (this._hoveredIndex !== -1) {
                this._hoveredIndex = -1;
                this._fullRender(this._glManager);
            }
            return;
        }

        // Use the padded domain (matches the WebGL projection exactly)
        const xMin = layout.paddedXMin;
        const xMax = layout.paddedXMax;
        const yMin = layout.paddedYMin;
        const yMax = layout.paddedYMax;

        // Convert mouse to data coords
        const dataX = xMin + ((mx - plot.x) / plot.width) * (xMax - xMin);
        const dataY = yMax - ((my - plot.y) / plot.height) * (yMax - yMin);

        const pxPerDataX = plot.width / (xMax - xMin);
        const pxPerDataY = plot.height / (yMax - yMin);

        // Use spatial grid for O(1) lookup when available
        let bestIdx: number;
        this._ensureSpatialGrid();
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
            // Fallback: linear scan (only before grid is built)
            bestIdx = -1;
            let bestDistSq = TOOLTIP_RADIUS_PX * TOOLTIP_RADIUS_PX;
            for (let i = 0; i < this._dataCount; i++) {
                const dx = (this._xData[i] - dataX) * pxPerDataX;
                const dy = (this._yData[i] - dataY) * pxPerDataY;
                const distSq = dx * dx + dy * dy;
                if (distSq < bestDistSq) {
                    bestDistSq = distSq;
                    bestIdx = i;
                }
            }
        }

        if (bestIdx !== this._hoveredIndex) {
            this._hoveredIndex = bestIdx;
            this._renderChromeOverlay();
        }
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

    /**
     * Build split groups from composite Arrow column names.
     * Groups columns by their split prefix (everything before the last "|").
     */
    private _buildSplitGroups(
        columns: ColumnDataMap,
        xBase: string,
        yBase: string,
        colorBase: string,
        sizeBase: string,
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
            const xColName = `${prefix}|${xBase}`;
            const yColName = `${prefix}|${yBase}`;
            if (!colNames.has(xColName) || !colNames.has(yColName)) continue;
            const xCol = columns.get(xColName);
            const yCol = columns.get(yColName);
            if (!xCol?.values || !yCol?.values) continue;
            groups.push({
                prefix,
                xColName,
                yColName,
                colorColName: colorBase ? `${prefix}|${colorBase}` : "",
                sizeColName: sizeBase ? `${prefix}|${sizeBase}` : "",
            });
        }
        return groups;
    }

    setZoomController(zc: ZoomController): void {
        this._zoomController = zc;
    }

    uploadAndRender(
        glManager: WebGLContextManager,
        columns: ColumnDataMap,
        startRow: number,
        endRow: number,
    ): void {
        const chunkLength = endRow - startRow;
        this._glManager = glManager;

        if (!this._program) {
            this._program = glManager.shaders.getOrCreate(
                "scatter",
                scatterVert,
                scatterFrag,
            );
            const gl = glManager.gl;
            const p = this._program;
            this._locations = {
                u_projection: gl.getUniformLocation(p, "u_projection"),
                u_point_size: gl.getUniformLocation(p, "u_point_size"),
                u_color_range: gl.getUniformLocation(p, "u_color_range"),
                u_color_start: gl.getUniformLocation(p, "u_color_start"),
                u_color_end: gl.getUniformLocation(p, "u_color_end"),
                u_size_range: gl.getUniformLocation(p, "u_size_range"),
                u_point_size_range: gl.getUniformLocation(
                    p,
                    "u_point_size_range",
                ),
                a_position: gl.getAttribLocation(p, "a_position"),
                a_color_value: gl.getAttribLocation(p, "a_color_value"),
                a_size_value: gl.getAttribLocation(p, "a_size_value"),
            };
        }

        // Reset domain tracking on first chunk
        if (startRow === 0) {
            // Cancel any pending RAF from the previous stream.
            if (this._renderRAFId) {
                cancelAnimationFrame(this._renderRAFId);
                this._renderRAFId = 0;
                this._renderScheduled = false;
            }

            this._allColumns = Array.from(columns.keys()).filter(
                (k) => !k.startsWith("__"),
            );
            this._xMin = Infinity;
            this._xMax = -Infinity;
            this._yMin = Infinity;
            this._yMax = -Infinity;
            this._colorMin = Infinity;
            this._colorMax = -Infinity;
            this._sizeMin = Infinity;
            this._sizeMax = -Infinity;
            this._dataCount = 0;
            this._writeCursor = 0;
            this._numericRowData = new Map();
            this._stringRowData = new Map();
            this._uniqueColorLabels = new Map();
            this._spatialGrid = null;
            this._spatialGridDirty = true;
            this._vaoSetup = false;

            const slots = this._columnSlots;
            const xBase = slots[0] || this._allColumns[0] || "";
            const yBase = slots[1] || this._allColumns[1] || "";
            const colorBase = slots[2] || "";
            const sizeBase = slots[3] || "";
            this._xLabel = xBase;
            this._yLabel = yBase;

            if (this._splitBy.length > 0) {
                // Build split groups from composite column names
                this._splitGroups = this._buildSplitGroups(
                    columns,
                    xBase,
                    yBase,
                    colorBase,
                    sizeBase,
                );
                if (this._splitGroups.length === 0) return;
                // Use split prefix as string color
                this._colorIsString = true;
                this._xName = this._splitGroups[0].xColName;
                this._yName = this._splitGroups[0].yColName;
                this._colorName = "";
                this._sizeName = "";
                // Grow buffer capacity to hold rows × splits
                const baseCap = glManager.bufferPool.totalCapacity || endRow;
                glManager.ensureBufferCapacity(
                    baseCap * this._splitGroups.length,
                );
                // Extract unique base column names for tooltips
                const baseNames = new Set<string>();
                for (const key of this._allColumns) {
                    const pipeIdx = key.lastIndexOf("|");
                    baseNames.add(
                        pipeIdx === -1 ? key : key.substring(pipeIdx + 1),
                    );
                }
                this._tooltipColumns = ["Split", ...baseNames];
            } else {
                this._splitGroups = [];
                this._xName = xBase;
                this._yName = yBase;
                this._colorName = colorBase;
                this._sizeName = sizeBase;
                this._colorIsString = false;

                if (this._colorName) {
                    const colorCol = columns.get(this._colorName);
                    this._colorIsString = colorCol?.type === "string";
                }
            }

            if (this._splitBy.length === 0) {
                this._tooltipColumns = this._allColumns.slice(0);
            }
        }

        if (!this._xName || !this._yName) return;

        // Filter to leaf rows when group_by is active
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

        // Determine series to iterate: split groups or a single series
        const hasSplits = this._splitGroups.length > 0;
        const series: {
            xCol: Float32Array | Int32Array;
            yCol: Float32Array | Int32Array;
            xValid: Uint8Array | undefined;
            yValid: Uint8Array | undefined;
            colorLabel: string;
            sizeCol: (Float32Array | Int32Array) | null;
        }[] = [];

        if (hasSplits) {
            for (const sg of this._splitGroups) {
                const xc = columns.get(sg.xColName);
                const yc = columns.get(sg.yColName);
                if (!xc?.values || !yc?.values) continue;
                const sc = sg.sizeColName ? columns.get(sg.sizeColName) : null;
                series.push({
                    xCol: xc.values,
                    yCol: yc.values,
                    xValid: xc.valid,
                    yValid: yc.valid,
                    colorLabel: sg.prefix,
                    sizeCol: sc?.values ?? null,
                });
            }
        } else {
            const xc = columns.get(this._xName);
            const yc = columns.get(this._yName);
            if (!xc?.values || !yc?.values) return;
            series.push({
                xCol: xc.values,
                yCol: yc.values,
                xValid: xc.valid,
                yValid: yc.valid,
                colorLabel: "",
                sizeCol: null,
            });
        }

        if (series.length === 0) return;

        const totalPoints = sourceLength * series.length;

        // Allocate CPU arrays
        const totalCapacity = glManager.bufferPool.totalCapacity || endRow;
        if (!this._xData || this._xData.length < totalCapacity) {
            this._xData = new Float32Array(totalCapacity);
            this._yData = new Float32Array(totalCapacity);
            this._colorData = new Float32Array(totalCapacity);
        }

        const destStart = this._writeCursor;
        const maxWrite = totalCapacity - destStart;
        if (maxWrite <= 0) return;

        // Ensure staging buffers (capped to what fits in remaining capacity)
        const stagingSize = Math.min(totalPoints, maxWrite);
        if (this._stagingChunkSize < stagingSize) {
            this._stagingPositions = new Float32Array(stagingSize * 2);
            this._stagingColors = new Float32Array(stagingSize);
            this._stagingSizes = new Float32Array(stagingSize);
            this._stagingChunkSize = stagingSize;
        }

        const positions = this._stagingPositions!;
        const colorValues = this._stagingColors!;
        const sizeValues = this._stagingSizes!;
        let writeIdx = 0;

        // Store __ROW_PATH__ tooltip data if present
        if (this._groupBy.length > 0) {
            const rowPathCol = columns.get("__ROW_PATH__");
            if (rowPathCol?.type === "list-string" && rowPathCol.listValues) {
                if (!this._stringRowData.has("__ROW_PATH__")) {
                    this._stringRowData.set(
                        "__ROW_PATH__",
                        new Array(totalCapacity),
                    );
                }
                const arr = this._stringRowData.get("__ROW_PATH__")!;
                for (let s = 0; s < series.length; s++) {
                    for (let j = 0; j < sourceLength; j++) {
                        const i = rowIndices ? rowIndices[j] : j;
                        arr[destStart + s * sourceLength + j] =
                            rowPathCol.listValues[i].join(" / ");
                    }
                }
            }
        }

        // Prepare split label and tooltip storage
        let splitLabelArr: string[] | null = null;
        let splitXArr: Float32Array | null = null;
        let splitYArr: Float32Array | null = null;
        if (hasSplits) {
            if (!this._stringRowData.has("Split")) {
                this._stringRowData.set("Split", new Array(totalCapacity));
            }
            splitLabelArr = this._stringRowData.get("Split")!;

            if (!this._numericRowData.has(this._xLabel)) {
                this._numericRowData.set(
                    this._xLabel,
                    new Float32Array(totalCapacity),
                );
            }
            if (!this._numericRowData.has(this._yLabel)) {
                this._numericRowData.set(
                    this._yLabel,
                    new Float32Array(totalCapacity),
                );
            }
            splitXArr = this._numericRowData.get(this._xLabel)!;
            splitYArr = this._numericRowData.get(this._yLabel)!;
        }

        for (let s = 0; s < series.length; s++) {
            if (writeIdx >= maxWrite) break;
            const ser = series[s];
            const colorCol =
                !hasSplits && this._colorName
                    ? columns.get(this._colorName)
                    : null;

            for (let j = 0; j < sourceLength; j++) {
                if (writeIdx >= maxWrite) break;
                const i = rowIndices ? rowIndices[j] : j;
                const x = ser.xCol[i] as number;
                const y = ser.yCol[i] as number;

                // Skip null values (common in split columns)
                if (
                    (ser.xValid && !ser.xValid[i]) ||
                    (ser.yValid && !ser.yValid[i])
                )
                    continue;

                // Domain tracking
                if (x < this._xMin) this._xMin = x;
                if (x > this._xMax) this._xMax = x;
                if (y < this._yMin) this._yMin = y;
                if (y > this._yMax) this._yMax = y;

                // CPU data for hit-testing
                this._xData![destStart + writeIdx] = x;
                this._yData![destStart + writeIdx] = y;

                // Split tooltip x/y under base column names
                if (splitXArr) {
                    splitXArr[destStart + writeIdx] = x;
                    splitYArr![destStart + writeIdx] = y;
                }

                // Position staging
                positions[writeIdx * 2] = x;
                positions[writeIdx * 2 + 1] = y;

                // Color staging
                if (hasSplits) {
                    // Split prefix as string color
                    if (!this._uniqueColorLabels.has(ser.colorLabel)) {
                        this._uniqueColorLabels.set(
                            ser.colorLabel,
                            this._uniqueColorLabels.size,
                        );
                    }
                    const idx = this._uniqueColorLabels.get(ser.colorLabel)!;
                    colorValues[writeIdx] = idx;
                    this._colorData![destStart + writeIdx] = idx;
                    if (idx < this._colorMin) this._colorMin = idx;
                    if (idx > this._colorMax) this._colorMax = idx;
                } else if (
                    colorCol &&
                    !this._colorIsString &&
                    colorCol.values
                ) {
                    const v = colorCol.values[i] as number;
                    colorValues[writeIdx] = v;
                    this._colorData![destStart + writeIdx] = v;
                    if (v < this._colorMin) this._colorMin = v;
                    if (v > this._colorMax) this._colorMax = v;
                } else if (colorCol && this._colorIsString && colorCol.labels) {
                    const label = colorCol.labels[i];
                    if (!this._uniqueColorLabels.has(label)) {
                        this._uniqueColorLabels.set(
                            label,
                            this._uniqueColorLabels.size,
                        );
                    }
                    const idx = this._uniqueColorLabels.get(label)!;
                    colorValues[writeIdx] = idx;
                    this._colorData![destStart + writeIdx] = idx;
                    if (idx < this._colorMin) this._colorMin = idx;
                    if (idx > this._colorMax) this._colorMax = idx;
                } else {
                    colorValues[writeIdx] = 0.5;
                }

                // Size staging
                if (ser.sizeCol) {
                    const v = ser.sizeCol[i] as number;
                    sizeValues[writeIdx] = v;
                    if (v < this._sizeMin) this._sizeMin = v;
                    if (v > this._sizeMax) this._sizeMax = v;
                } else if (!hasSplits && this._sizeName) {
                    const sc = columns.get(this._sizeName);
                    if (sc?.values) {
                        const v = sc.values[i] as number;
                        sizeValues[writeIdx] = v;
                        if (v < this._sizeMin) this._sizeMin = v;
                        if (v > this._sizeMax) this._sizeMax = v;
                    } else {
                        sizeValues[writeIdx] = 0;
                    }
                } else {
                    sizeValues[writeIdx] = 0;
                }

                // Store split label for tooltip
                if (splitLabelArr) {
                    splitLabelArr[destStart + writeIdx] = ser.colorLabel;
                }

                writeIdx++;
            }
        }

        // Store tooltip data (skip per-column storage for splits —
        // the split label + x/y values are sufficient and per-column
        // arrays would allocate one Float32Array(totalCapacity) per
        // composite column, which is prohibitive at high cardinality).
        if (!hasSplits) {
            for (const [name, col] of columns) {
                if (name.startsWith("__")) continue;
                if (col.type === "string") {
                    if (!this._stringRowData.has(name)) {
                        this._stringRowData.set(name, new Array(totalCapacity));
                    }
                    const arr = this._stringRowData.get(name)!;
                    for (let j = 0; j < sourceLength; j++) {
                        const i = rowIndices ? rowIndices[j] : j;
                        arr[destStart + j] = col.labels![i];
                    }
                } else if (col.values) {
                    if (!this._numericRowData.has(name)) {
                        this._numericRowData.set(
                            name,
                            new Float32Array(totalCapacity),
                        );
                    }
                    const arr = this._numericRowData.get(name)!;
                    const vals = col.values;
                    for (let j = 0; j < sourceLength; j++) {
                        const i = rowIndices ? rowIndices[j] : j;
                        arr[destStart + j] = vals[i] as number;
                    }
                }
            }
        }

        this._writeCursor += writeIdx;
        this._dataCount = this._writeCursor;
        this._spatialGridDirty = true;

        // Upload position data
        const byteOffset = destStart * 2 * Float32Array.BYTES_PER_ELEMENT;
        glManager.bufferPool.upload(
            "a_position",
            positions.subarray(0, writeIdx * 2),
            byteOffset,
            2,
        );

        // Upload color data
        const colorByteOffset = destStart * Float32Array.BYTES_PER_ELEMENT;
        glManager.bufferPool.upload(
            "a_color_value",
            colorValues.subarray(0, writeIdx),
            colorByteOffset,
        );

        // Upload size data
        const sizeByteOffset = destStart * Float32Array.BYTES_PER_ELEMENT;
        glManager.bufferPool.upload(
            "a_size_value",
            sizeValues.subarray(0, writeIdx),
            sizeByteOffset,
        );

        glManager.uploadedCount = this._writeCursor;

        // Update zoom controller base domain
        if (this._zoomController) {
            this._zoomController.setBaseDomain(
                this._xMin,
                this._xMax,
                this._yMin,
                this._yMax,
            );
        }

        // Batch rendering: coalesce multiple chunk uploads into a single frame
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

    /**
     * Full render cycle: gridlines → points → axes overlay → legend overlay.
     */
    private _fullRender(glManager: WebGLContextManager): void {
        const gl = glManager.gl;
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = glManager.gl.canvas.width / dpr;
        const cssHeight = glManager.gl.canvas.height / dpr;

        if (cssWidth <= 0 || cssHeight <= 0) return;

        // Get visible domain (accounts for zoom)
        const hasColorCol =
            (this._colorName !== "" || this._splitGroups.length > 0) &&
            this._colorMin < this._colorMax;
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

        // Build layout and cache for tooltip hit-testing
        const layout = new PlotLayout(cssWidth, cssHeight, {
            hasXLabel: !!this._xName,
            hasYLabel: !!this._yName,
            hasLegend: hasColorCol,
        });
        this._lastLayout = layout;

        // Update zoom controller layout for mouse coordinate mapping
        if (this._zoomController) {
            this._zoomController.updateLayout(layout);
        }

        // Build projection matrix
        const projection = layout.buildProjectionMatrix(
            domain.xMin,
            domain.xMax,
            domain.yMin,
            domain.yMax,
        );

        // Resolve gradient colors from theme
        const themeEl = this._gridlineCanvas!;
        const colorStart = parseCSSColorToVec3(
            getCSSVar(themeEl, "--psp-webgl--gradient-start--color", "#0366d6"),
        );
        const colorEnd = hasColorCol
            ? parseCSSColorToVec3(
                  getCSSVar(
                      themeEl,
                      "--psp-webgl--gradient-end--color",
                      "#ff7f0e",
                  ),
              )
            : colorStart;

        const xType = this._columnTypes[this._xLabel] || "";
        const yType = this._columnTypes[this._yLabel] || "";
        const xIsDate = xType === "date" || xType === "datetime";
        const yIsDate = yType === "date" || yType === "datetime";

        const xDomain: AxisDomain = {
            min: domain.xMin,
            max: domain.xMax,
            label: this._xLabel || this._xName,
            isDate: xIsDate,
        };
        const yDomain: AxisDomain = {
            min: domain.yMin,
            max: domain.yMax,
            label: this._yLabel || this._yName,
            isDate: yIsDate,
        };

        const { xTicks, yTicks } = computeTicks(xDomain, yDomain, layout);

        // Layer 1 (bottom canvas): gridlines behind points
        if (this._gridlineCanvas) {
            renderGridlines(
                this._gridlineCanvas,
                layout,
                xTicks,
                yTicks,
                this._gridlineCanvas,
            );
        }

        // Layer 2 (WebGL): scatter points, scissored to plot area
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
        this._setUniforms(gl, projection, colorStart, colorEnd);
        this._drawPoints(gl, glManager);
        gl.disable(gl.SCISSOR_TEST);

        // Cache chrome state for lightweight hover redraws
        this._lastXDomain = xDomain;
        this._lastYDomain = yDomain;
        this._lastXTicks = xTicks;
        this._lastYTicks = yTicks;
        this._lastColorStart = colorStart;
        this._lastColorEnd = colorEnd;
        this._lastHasColorCol = hasColorCol;

        // Layer 3 (top canvas): axes chrome, legend, tooltip
        this._renderChromeOverlay();
    }

    /**
     * Redraw only the chrome canvas (axes, legend, tooltip).
     * Used for hover updates without re-rendering WebGL points or gridlines.
     */
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

        if (this._lastHasColorCol) {
            if (this._colorIsString && this._uniqueColorLabels.size > 0) {
                renderCategoricalLegend(
                    this._chromeCanvas,
                    layout,
                    this._uniqueColorLabels,
                    this._lastColorStart,
                    this._lastColorEnd,
                );
            } else {
                renderLegend(
                    this._chromeCanvas,
                    layout,
                    {
                        min: this._colorMin,
                        max: this._colorMax,
                        label: this._colorName,
                    },
                    this._lastColorStart,
                    this._lastColorEnd,
                );
            }
        }

        if (this._hoveredIndex >= 0 && this._xData) {
            this._renderTooltip(this._chromeCanvas, layout);
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

        // Convert to pixel coords (uses padded domain from projection)
        const pos = layout.dataToPixel(xVal, yVal);

        const lines = this._buildTooltipLines(idx);

        // Resolve theme colors
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

        // Measure text
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

        // Position tooltip (offset from point, keep in viewport)
        let tx = pos.px + 12;
        let ty = pos.py - boxH - 8;
        if (tx + boxW > layout.cssWidth) tx = pos.px - boxW - 12;
        if (ty < 0) ty = pos.py + 12;
        if (ty + boxH > layout.cssHeight) ty = layout.cssHeight - boxH - 4;

        // Draw crosshair
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

        // Draw highlight ring
        ctx.strokeStyle = tickColor;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Draw tooltip background
        ctx.fillStyle = tooltipBg;
        ctx.strokeStyle = tooltipBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, boxW, boxH, 4);
        ctx.fill();
        ctx.stroke();

        // Draw tooltip text
        ctx.fillStyle = tooltipText;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], tx + padding, ty + padding + i * lineHeight);
        }

        ctx.restore();
    }

    private _buildTooltipLines(idx: number): string[] {
        const lines: string[] = [];
        const rowPath = this._stringRowData.get("__ROW_PATH__");
        if (rowPath && rowPath[idx] != null) {
            lines.push(String(rowPath[idx]));
        }
        for (const colName of this._tooltipColumns) {
            const strData = this._stringRowData.get(colName);
            if (strData && strData[idx] != null) {
                lines.push(`${colName}: ${strData[idx]}`);
                continue;
            }
            const numData = this._numericRowData.get(colName);
            if (numData) {
                const colType = this._columnTypes[colName] || "";
                const isDate = colType === "date" || colType === "datetime";
                const formatted = isDate
                    ? formatDateTickValue(numData[idx])
                    : formatTickValue(numData[idx]);
                lines.push(`${colName}: ${formatted}`);
            }
        }
        return lines;
    }

    private _showPinnedTooltip(pointIdx: number): void {
        this._dismissPinnedTooltip();
        this._pinnedIndex = pointIdx;
        const idx = pointIdx;
        if (idx < 0 || !this._xData || !this._yData || !this._lastLayout)
            return;

        const layout = this._lastLayout;
        const pos = layout.dataToPixel(this._xData[idx], this._yData[idx]);
        const lines = this._buildTooltipLines(idx);
        if (lines.length === 0) return;

        // Resolve theme
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

        // Position relative to the canvas parent
        const parent = this._glCanvas?.parentElement;
        if (!parent) return;

        parent.style.position = "relative";
        // Place offscreen first to measure without flicker
        div.style.left = "-9999px";
        div.style.top = "0px";
        parent.appendChild(div);
        this._pinnedTooltip = div;

        // Force reflow to get accurate dimensions
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

        // Clear the canvas tooltip so both don't show
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

    private _setUniforms(
        gl: WebGL2RenderingContext | WebGLRenderingContext,
        projection: Float32Array,
        colorStart: [number, number, number],
        colorEnd: [number, number, number],
    ): void {
        const loc = this._locations!;
        const dpr = window.devicePixelRatio || 1;

        gl.uniformMatrix4fv(loc.u_projection, false, projection);
        gl.uniform1f(loc.u_point_size, 8.0 * dpr);

        if (this._colorMin < this._colorMax) {
            gl.uniform2f(loc.u_color_range, this._colorMin, this._colorMax);
        } else {
            gl.uniform2f(loc.u_color_range, 0.0, 1.0);
        }

        gl.uniform4f(
            loc.u_color_start,
            colorStart[0],
            colorStart[1],
            colorStart[2],
            1.0,
        );

        gl.uniform4f(
            loc.u_color_end,
            colorEnd[0],
            colorEnd[1],
            colorEnd[2],
            1.0,
        );

        if (this._sizeMin < this._sizeMax) {
            gl.uniform2f(loc.u_size_range, this._sizeMin, this._sizeMax);
        } else {
            gl.uniform2f(loc.u_size_range, 0.0, 0.0);
        }

        gl.uniform2f(loc.u_point_size_range, 2.0 * dpr, 16.0 * dpr);
    }

    private _drawPoints(
        gl: WebGL2RenderingContext | WebGLRenderingContext,
        glManager: WebGLContextManager,
    ): void {
        const loc = this._locations!;
        const gl2 = glManager.isWebGL2 ? (gl as WebGL2RenderingContext) : null;

        // Use VAO on WebGL2 to avoid rebinding attributes every frame
        if (gl2 && this._vaoSetup && this._vao) {
            gl2.bindVertexArray(this._vao);
            gl.drawArrays(gl.POINTS, 0, glManager.uploadedCount);
            gl2.bindVertexArray(null);
            return;
        }

        if (gl2 && !this._vao) {
            this._vao = gl2.createVertexArray();
        }

        if (gl2 && this._vao) {
            gl2.bindVertexArray(this._vao);
        }

        const positionBuf = glManager.bufferPool.getOrCreate(
            "a_position",
            2,
            Float32Array.BYTES_PER_ELEMENT,
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuf.buffer);
        gl.enableVertexAttribArray(loc.a_position);
        gl.vertexAttribPointer(loc.a_position, 2, gl.FLOAT, false, 0, 0);

        const colorBuf = glManager.bufferPool.getOrCreate(
            "a_color_value",
            1,
            Float32Array.BYTES_PER_ELEMENT,
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf.buffer);
        gl.enableVertexAttribArray(loc.a_color_value);
        gl.vertexAttribPointer(loc.a_color_value, 1, gl.FLOAT, false, 0, 0);

        const sizeBuf = glManager.bufferPool.getOrCreate(
            "a_size_value",
            1,
            Float32Array.BYTES_PER_ELEMENT,
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf.buffer);
        gl.enableVertexAttribArray(loc.a_size_value);
        gl.vertexAttribPointer(loc.a_size_value, 1, gl.FLOAT, false, 0, 0);

        if (gl2 && this._vao) {
            gl2.bindVertexArray(null);
            this._vaoSetup = true;
            // Redraw using the VAO
            gl2.bindVertexArray(this._vao);
        }

        gl.drawArrays(gl.POINTS, 0, glManager.uploadedCount);

        if (gl2 && this._vao) {
            gl2.bindVertexArray(null);
        }
    }

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
        this._program = null;
        this._locations = null;
        this._vao = null;
        this._vaoSetup = false;
        this._allColumns = [];
        this._xData = null;
        this._yData = null;
        this._colorData = null;
        this._numericRowData.clear();
        this._stringRowData.clear();
        this._uniqueColorLabels.clear();
        this._spatialGrid = null;
        this._stagingPositions = null;
        this._stagingColors = null;
        this._stagingSizes = null;
    }
}
