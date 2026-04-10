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

import type { ColumnDataMap, ColumnData } from "../data/arrow-reader";
import type { WebGLContextManager } from "../webgl/context-manager";
import type { ChartImplementation } from "./chart";
import { parseCSSColorToVec3, getCSSVar } from "../utils/css";
import { renderLegend, renderCategoricalLegend } from "../layout/legend";
import { PlotLayout } from "../layout/plot-layout";
import { formatTickValue } from "../layout/ticks";
import treemapVert from "../shaders/treemap.vert.glsl";
import treemapFrag from "../shaders/treemap.frag.glsl";

function luminance(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

function lerpColor(
    a: [number, number, number],
    b: [number, number, number],
    t: number,
): [number, number, number] {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ];
}

// ---------------------------------------------------------------------------
// Tree data structure
// ---------------------------------------------------------------------------

interface TreeNode {
    name: string;
    children: TreeNode[];
    size: number;
    value: number; // aggregated (sum of descendant sizes)
    colorValue: number;
    colorLabel: string;
    depth: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    parent: TreeNode | null;
    rowPath: string[];
    tooltipData: Map<string, string | number>;
}

function createNode(name: string, parent: TreeNode | null): TreeNode {
    return {
        name,
        children: [],
        size: 0,
        value: 0,
        colorValue: NaN,
        colorLabel: "",
        depth: parent ? parent.depth + 1 : 0,
        x0: 0,
        y0: 0,
        x1: 0,
        y1: 0,
        parent,
        rowPath: [],
        tooltipData: new Map(),
    };
}

// ---------------------------------------------------------------------------
// Squarified treemap layout (Bruls-Huizing-van Wijk)
// ---------------------------------------------------------------------------

const PADDING_OUTER = 1;
const PADDING_LABEL = 14; // top padding for header tab label
const PADDING_INNER = 1;

function sumValues(node: TreeNode): number {
    if (node.children.length === 0) {
        node.value = Math.max(0, node.size);
        return node.value;
    }
    let total = 0;
    for (const child of node.children) {
        total += sumValues(child);
    }
    node.value = total;
    return total;
}

/**
 * Order-preserving treemap layout using recursive binary splits.
 * Splits the node list at the value midpoint, gives each half a
 * proportional portion of the rectangle, and alternates split
 * direction. Produces decent aspect ratios while preserving the
 * view's data order.
 */
function squarify(
    node: TreeNode,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    baseDepth: number,
): void {
    node.x0 = Math.round(x0);
    node.y0 = Math.round(y0);
    node.x1 = Math.round(x1);
    node.y1 = Math.round(y1);

    if (node.children.length === 0) return;

    // Depth relative to the current view root
    const relDepth = node.depth - baseDepth;

    // Only direct children of the view root (relDepth 1) get header tabs.
    const showHeader = relDepth === 1 && node.children.length > 0;
    const padTop = showHeader ? PADDING_LABEL : PADDING_INNER;
    const padOuter = showHeader ? PADDING_OUTER : PADDING_INNER;

    const ix0 = node.x0 + padOuter;
    const iy0 = node.y0 + padTop;
    const ix1 = node.x1 - padOuter;
    const iy1 = node.y1 - padOuter;
    if (ix1 <= ix0 || iy1 <= iy0) return;

    const active = node.children.filter((c) => c.value > 0);
    if (active.length === 0) return;

    layoutOrdered(active, ix0, iy0, ix1, iy1, baseDepth);
}

function layoutOrdered(
    nodes: TreeNode[],
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    baseDepth: number,
): void {
    if (nodes.length === 0) return;

    if (nodes.length === 1) {
        squarify(nodes[0], x0, y0, x1, y1, baseDepth);
        return;
    }

    // Find the split point closest to half the total value
    let totalValue = 0;
    for (const n of nodes) totalValue += n.value;
    const halfValue = totalValue / 2;

    let cumulative = 0;
    let splitIdx = 1; // at least 1 item on each side
    let bestDiff = Infinity;
    for (let i = 0; i < nodes.length - 1; i++) {
        cumulative += nodes[i].value;
        const diff = Math.abs(cumulative - halfValue);
        if (diff < bestDiff) {
            bestDiff = diff;
            splitIdx = i + 1;
        }
    }

    const leftNodes = nodes.slice(0, splitIdx);
    const rightNodes = nodes.slice(splitIdx);
    let leftValue = 0;
    for (const n of leftNodes) leftValue += n.value;
    const fraction = leftValue / totalValue;

    // Split along the longer side, snapped to pixels (no gap here —
    // gaps are applied per-leaf in vertex generation to avoid accumulation)
    const rw = x1 - x0;
    const rh = y1 - y0;

    if (rw >= rh) {
        const splitX = Math.round(x0 + rw * fraction);
        layoutOrdered(leftNodes, x0, y0, splitX, y1, baseDepth);
        layoutOrdered(rightNodes, splitX, y0, x1, y1, baseDepth);
    } else {
        const splitY = Math.round(y0 + rh * fraction);
        layoutOrdered(leftNodes, x0, y0, x1, splitY, baseDepth);
        layoutOrdered(rightNodes, x0, splitY, x1, y1, baseDepth);
    }
}

// Collect all visible nodes (for rendering)
function collectVisible(
    node: TreeNode,
    maxDepth: number,
    baseDepth: number,
    out: TreeNode[],
): void {
    if (node.value <= 0) return;
    if (node.depth >= baseDepth) {
        out.push(node);
    }
    if (node.depth - baseDepth < maxDepth) {
        for (const child of node.children) {
            collectVisible(child, maxDepth, baseDepth, out);
        }
    }
}

// ---------------------------------------------------------------------------
// Shader locations
// ---------------------------------------------------------------------------

interface TreemapLocations {
    u_resolution: WebGLUniformLocation | null;
    a_position: number;
    a_color: number;
}

// ---------------------------------------------------------------------------
// Breadcrumb hit region
// ---------------------------------------------------------------------------

interface BreadcrumbRegion {
    node: TreeNode;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

// ---------------------------------------------------------------------------
// TreemapChart
// ---------------------------------------------------------------------------

export class TreemapChart implements ChartImplementation {
    private _program: WebGLProgram | null = null;
    private _locations: TreemapLocations | null = null;
    private _positionBuffer: WebGLBuffer | null = null;
    private _colorBuffer: WebGLBuffer | null = null;
    private _vertexCount = 0;

    private _gridlineCanvas: HTMLCanvasElement | null = null;
    private _chromeCanvas: HTMLCanvasElement | null = null;
    private _glCanvas: HTMLCanvasElement | null = null;
    private _glManager: WebGLContextManager | null = null;

    // Config
    private _columnSlots: (string | null)[] = [];
    private _groupBy: string[] = [];
    private _splitBy: string[] = [];
    private _columnTypes: Record<string, string> = {};

    // Buffered data (treemap needs all data before layout)
    private _bufferedRows: {
        rowPath: string[];
        sizeValue: number;
        colorValue: number;
        colorLabel: string;
        tooltipData: Map<string, string | number>;
    }[] = [];
    private _sizeName = "";
    private _colorName = "";
    private _colorIsString = false;
    private _allColumns: string[] = [];

    // Tree state
    private _root: TreeNode | null = null;
    private _currentRoot: TreeNode | null = null;
    private _breadcrumbs: TreeNode[] = [];

    // Color state
    private _colorMin = Infinity;
    private _colorMax = -Infinity;
    private _uniqueColorLabels: Map<string, number> = new Map();

    // Interaction
    private _hoveredNode: TreeNode | null = null;
    private _visibleNodes: TreeNode[] = [];
    private _breadcrumbRegions: BreadcrumbRegion[] = [];
    private _mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
    private _clickHandler: ((e: MouseEvent) => void) | null = null;
    private _dblClickHandler: ((e: MouseEvent) => void) | null = null;
    private _mouseLeaveHandler: (() => void) | null = null;

    // Render batching
    private _renderScheduled = false;
    private _renderRAFId = 0;

    // Cached static chrome (labels, breadcrumbs, legend) to avoid
    // redrawing thousands of labels on every hover frame.
    private _chromeCache: ImageBitmap | null = null;
    private _chromeCacheDirty = true;

    // Pinned tooltip
    private _pinnedNode: TreeNode | null = null;
    private _pinnedTooltip: HTMLDivElement | null = null;
    private _hoverRAFId = 0;

    // -----------------------------------------------------------------------
    // ChartImplementation interface
    // -----------------------------------------------------------------------

    setGridlineCanvas(canvas: HTMLCanvasElement): void {
        this._gridlineCanvas = canvas;
    }

    setChromeCanvas(canvas: HTMLCanvasElement): void {
        this._chromeCanvas = canvas;
    }

    attachTooltip(glCanvas: HTMLCanvasElement): void {
        this._glCanvas = glCanvas;

        this._mouseMoveHandler = (e: MouseEvent) => {
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
            if (this._hoveredNode && !this._pinnedNode) {
                this._hoveredNode = null;
                this._renderChromeOverlay();
            }
        };

        this._clickHandler = (e: MouseEvent) => {
            const rect = glCanvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            this._handleClick(mx, my);
        };

        this._dblClickHandler = (e: MouseEvent) => {
            const rect = glCanvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            this._handleDblClick(mx, my);
        };

        glCanvas.addEventListener("mousemove", this._mouseMoveHandler);
        glCanvas.addEventListener("mouseleave", this._mouseLeaveHandler);
        glCanvas.addEventListener("click", this._clickHandler);
        glCanvas.addEventListener("dblclick", this._dblClickHandler);
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
            if (this._dblClickHandler) {
                this._glCanvas.removeEventListener(
                    "dblclick",
                    this._dblClickHandler,
                );
            }
        }
        this._mouseMoveHandler = null;
        this._mouseLeaveHandler = null;
        this._clickHandler = null;
        this._dblClickHandler = null;
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

    uploadAndRender(
        glManager: WebGLContextManager,
        columns: ColumnDataMap,
        startRow: number,
        _endRow: number,
    ): void {
        this._glManager = glManager;

        // Reset on first chunk
        if (startRow === 0) {
            // Cancel any pending RAF from the previous stream.
            if (this._renderRAFId) {
                cancelAnimationFrame(this._renderRAFId);
                this._renderRAFId = 0;
                this._renderScheduled = false;
            }

            this._bufferedRows = [];
            this._colorMin = Infinity;
            this._colorMax = -Infinity;
            this._uniqueColorLabels = new Map();
            this._root = null;
            this._visibleNodes = [];

            this._allColumns = Array.from(columns.keys()).filter(
                (k) => !k.startsWith("__"),
            );

            const slots = this._columnSlots;
            this._sizeName = slots[0] || this._allColumns[0] || "";
            this._colorName = slots[1] || this._sizeName;
            this._colorIsString = false;
            if (this._colorName) {
                const col = columns.get(this._colorName);
                this._colorIsString = col?.type === "string";
            }
        }

        // Buffer this chunk's rows
        this._bufferChunkRows(columns);

        // Rebuild tree and render
        this._rebuildAndRender(glManager);
    }

    redraw(glManager: WebGLContextManager): void {
        this._glManager = glManager;
        if (this._root) {
            this._layoutAndRender(glManager);
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
        this._chromeCache?.close();
        this._chromeCache = null;
        const gl = this._glManager?.gl;
        if (gl) {
            if (this._positionBuffer) gl.deleteBuffer(this._positionBuffer);
            if (this._colorBuffer) gl.deleteBuffer(this._colorBuffer);
        }
        this._positionBuffer = null;
        this._colorBuffer = null;
        this._program = null;
        this._locations = null;
        this._root = null;
        this._currentRoot = null;
        this._bufferedRows = [];
        this._visibleNodes = [];
        this._breadcrumbRegions = [];
    }

    // -----------------------------------------------------------------------
    // Data buffering
    // -----------------------------------------------------------------------

    private _bufferChunkRows(columns: ColumnDataMap): void {
        // Detect row path format: either __ROW_PATH__ (list column) or
        // individual "Column (Group by N)" string columns
        const rowPathCol = columns.get("__ROW_PATH__");

        // Find group-by columns: "Name (Group by N)" pattern
        const groupByCols: { name: string; col: ColumnData; index: number }[] =
            [];
        const groupByPattern = /^(.+) \(Group by (\d+)\)$/;
        for (const [key, col] of columns) {
            const m = key.match(groupByPattern);
            if (m && col.type === "string" && col.labels) {
                groupByCols.push({ name: m[1], col, index: parseInt(m[2]) });
            }
        }
        groupByCols.sort((a, b) => a.index - b.index);

        const hasRowPath =
            rowPathCol?.type === "list-string" && rowPathCol.listValues;
        const hasGroupByCols = groupByCols.length > 0;

        if (!hasRowPath && !hasGroupByCols) {
            this._bufferFlatRows(columns);
            return;
        }

        const sizeCol = this._sizeName ? columns.get(this._sizeName) : null;
        const colorCol = this._colorName ? columns.get(this._colorName) : null;

        // Determine row count from whichever path source we have
        const numRows = hasRowPath
            ? rowPathCol!.listValues!.length
            : (sizeCol?.values?.length ??
              groupByCols[0]?.col.labels?.length ??
              0);

        for (let i = 0; i < numRows; i++) {
            // Build the path for this row
            let path: string[];
            if (hasRowPath) {
                path = rowPathCol!.listValues![i];
                if (path.length === 0) continue; // skip total row
            } else {
                // Build path from group-by columns; empty labels mean
                // this is an aggregation row at a higher level
                path = [];
                for (const gbc of groupByCols) {
                    const label = gbc.col.labels![i];
                    if (!label && label !== "0") break; // stop at first empty level
                    path.push(label);
                }
                if (path.length === 0) continue; // skip total row
            }

            const sizeValue = sizeCol?.values
                ? (sizeCol.values[i] as number)
                : 1;

            let colorValue = NaN;
            let colorLabel = "";
            if (colorCol) {
                if (this._colorIsString && colorCol.labels) {
                    colorLabel = colorCol.labels[i];
                } else if (colorCol.values) {
                    colorValue = colorCol.values[i] as number;
                }
            }

            // Collect tooltip data from all non-groupby columns
            const tooltipData = new Map<string, string | number>();
            for (const [name, col] of columns) {
                if (name.startsWith("__")) continue;
                if (groupByPattern.test(name)) continue;
                if (col.type === "string" && col.labels) {
                    tooltipData.set(name, col.labels[i]);
                } else if (col.values) {
                    tooltipData.set(name, col.values[i] as number);
                }
            }

            this._bufferedRows.push({
                rowPath: path,
                sizeValue,
                colorValue,
                colorLabel,
                tooltipData,
            });
        }
    }

    private _bufferFlatRows(columns: ColumnDataMap): void {
        // When no group_by, create rows from column data as flat entries
        const sizeCol = this._sizeName ? columns.get(this._sizeName) : null;
        if (!sizeCol?.values) return;

        const colorCol = this._colorName ? columns.get(this._colorName) : null;
        const numRows = sizeCol.values.length;

        // Use a label column if available (first string column that isn't the size/color)
        let labelCol: ColumnData | undefined;
        let labelName = "";
        for (const [name, col] of columns) {
            if (name.startsWith("__")) continue;
            if (name === this._sizeName || name === this._colorName) continue;
            if (col.type === "string" && col.labels) {
                labelCol = col;
                labelName = name;
                break;
            }
        }

        for (let i = 0; i < numRows; i++) {
            const label = labelCol?.labels
                ? labelCol.labels[i]
                : `Row ${this._bufferedRows.length + i}`;

            const tooltipData = new Map<string, string | number>();
            for (const [name, col] of columns) {
                if (name.startsWith("__")) continue;
                if (col.type === "string" && col.labels) {
                    tooltipData.set(name, col.labels[i]);
                } else if (col.values) {
                    tooltipData.set(name, col.values[i] as number);
                }
            }

            let colorValue = NaN;
            let colorLabel = "";
            if (colorCol) {
                if (this._colorIsString && colorCol.labels) {
                    colorLabel = colorCol.labels[i];
                } else if (colorCol.values) {
                    colorValue = colorCol.values[i] as number;
                }
            }

            this._bufferedRows.push({
                rowPath: [label],
                sizeValue: Math.max(0, sizeCol.values[i] as number),
                colorValue,
                colorLabel,
                tooltipData,
            });
        }
    }

    // -----------------------------------------------------------------------
    // Tree building
    // -----------------------------------------------------------------------

    private _buildTree(): void {
        const root = createNode("Total", null);
        root.depth = 0;

        const groupByLen = this._groupBy.length || 1;

        for (const row of this._bufferedRows) {
            let current = root;
            for (let d = 0; d < row.rowPath.length; d++) {
                const segment = row.rowPath[d];
                let child = current.children.find((c) => c.name === segment);
                if (!child) {
                    child = createNode(segment, current);
                    current.children.push(child);
                }

                if (d === row.rowPath.length - 1) {
                    // This is the deepest level for this row
                    child.rowPath = row.rowPath.slice();
                    child.tooltipData = row.tooltipData;

                    if (row.rowPath.length === groupByLen) {
                        // Leaf row
                        child.size = Math.max(0, row.sizeValue);
                    }

                    // Color
                    if (!isNaN(row.colorValue)) {
                        child.colorValue = row.colorValue;
                    }
                    if (row.colorLabel) {
                        child.colorLabel = row.colorLabel;
                    }
                }

                current = child;
            }
        }

        // Compute aggregated values
        sumValues(root);

        // Track color domain from leaf nodes using percentiles to
        // avoid outliers washing out the color range
        this._colorMin = Infinity;
        this._colorMax = -Infinity;
        this._uniqueColorLabels = new Map();
        const colorValues: number[] = [];
        this._walkNodes(root, (n) => {
            if (n.children.length === 0 || !isNaN(n.colorValue)) {
                if (!isNaN(n.colorValue)) {
                    colorValues.push(n.colorValue);
                }
                if (
                    n.colorLabel &&
                    !this._uniqueColorLabels.has(n.colorLabel)
                ) {
                    this._uniqueColorLabels.set(
                        n.colorLabel,
                        this._uniqueColorLabels.size,
                    );
                }
            }
        });
        if (colorValues.length > 0) {
            colorValues.sort((a, b) => a - b);
            const p05 = colorValues[Math.floor(colorValues.length * 0.05)];
            const p95 = colorValues[Math.ceil(colorValues.length * 0.95) - 1];
            this._colorMin = p05;
            this._colorMax = p95;
            if (this._colorMin >= this._colorMax) {
                this._colorMin = colorValues[0];
                this._colorMax = colorValues[colorValues.length - 1];
            }
        }

        this._root = root;

        // Preserve drill-down if the path still exists
        if (this._currentRoot && this._breadcrumbs.length > 1) {
            const path = this._breadcrumbs.map((b) => b.name);
            let node = root;
            let valid = true;
            for (let i = 1; i < path.length; i++) {
                const child = node.children.find((c) => c.name === path[i]);
                if (!child) {
                    valid = false;
                    break;
                }
                node = child;
            }
            if (valid && node.children.length > 0) {
                this._currentRoot = node;
                this._rebuildBreadcrumbs(node);
                return;
            }
        }

        this._currentRoot = root;
        this._breadcrumbs = [root];
    }

    private _rebuildBreadcrumbs(node: TreeNode): void {
        const crumbs: TreeNode[] = [];
        let n: TreeNode | null = node;
        while (n) {
            crumbs.unshift(n);
            n = n.parent;
        }
        this._breadcrumbs = crumbs;
    }

    private _walkNodes(node: TreeNode, fn: (n: TreeNode) => void): void {
        fn(node);
        for (const child of node.children) {
            this._walkNodes(child, fn);
        }
    }

    // -----------------------------------------------------------------------
    // Layout and render
    // -----------------------------------------------------------------------

    private _rebuildAndRender(glManager: WebGLContextManager): void {
        this._buildTree();
        if (!this._root) return;
        this._layoutAndRender(glManager);
    }

    private _layoutAndRender(glManager: WebGLContextManager): void {
        if (!this._renderScheduled) {
            this._renderScheduled = true;
            this._renderRAFId = requestAnimationFrame(() => {
                this._renderScheduled = false;
                this._renderRAFId = 0;
                this._fullRender(glManager);
            });
        }
    }

    private _fullRender(glManager: WebGLContextManager): void {
        if (!this._currentRoot) return;

        const gl = glManager.gl;
        const dpr = window.devicePixelRatio || 1;
        // Use the GL canvas's physical size (set by glManager.resize via getBoundingClientRect)
        const cssWidth = (
            gl.canvas as HTMLCanvasElement
        ).getBoundingClientRect().width;
        const cssHeight = (
            gl.canvas as HTMLCanvasElement
        ).getBoundingClientRect().height;
        if (cssWidth <= 0 || cssHeight <= 0) return;

        // Reserve space for breadcrumbs (top) and legend (right)
        const breadcrumbH = this._breadcrumbs.length > 1 ? 28 : 0;
        const hasColor =
            this._colorName !== "" &&
            (this._colorIsString
                ? this._uniqueColorLabels.size > 0
                : this._colorMin < this._colorMax);
        const legendW = hasColor ? 90 : 0;

        // Layout the current subtree (baseDepth = currentRoot.depth so
        // the drilled-in view fills the canvas like the top level)
        squarify(
            this._currentRoot,
            0,
            breadcrumbH,
            cssWidth - legendW,
            cssHeight,
            this._currentRoot.depth,
        );

        // Collect visible nodes (show all depths from currentRoot)
        this._visibleNodes = [];
        collectVisible(
            this._currentRoot,
            100, // show all depths
            this._currentRoot.depth,
            this._visibleNodes,
        );

        // Ensure shader program
        if (!this._program) {
            this._program = glManager.shaders.getOrCreate(
                "treemap",
                treemapVert,
                treemapFrag,
            );
            this._locations = {
                u_resolution: gl.getUniformLocation(
                    this._program,
                    "u_resolution",
                ),
                a_position: gl.getAttribLocation(this._program, "a_position"),
                a_color: gl.getAttribLocation(this._program, "a_color"),
            };
        }

        // Resolve theme colors
        const themeEl = this._gridlineCanvas || this._chromeCanvas!;
        const colorStart = parseCSSColorToVec3(
            getCSSVar(themeEl, "--psp-webgl--gradient-start--color", "#0366d6"),
        );
        const colorEnd = parseCSSColorToVec3(
            getCSSVar(themeEl, "--psp-webgl--gradient-end--color", "#ff7f0e"),
        );

        // Clear gridline canvas (treemap doesn't use gridlines)
        if (this._gridlineCanvas) {
            const gCtx = this._gridlineCanvas.getContext("2d");
            if (gCtx) {
                gCtx.clearRect(
                    0,
                    0,
                    this._gridlineCanvas.width,
                    this._gridlineCanvas.height,
                );
            }
        }

        // Mark chrome cache dirty so labels/legend are redrawn
        this._chromeCacheDirty = true;

        // Generate and upload vertices
        this._generateAndUpload(gl, colorStart, colorEnd);

        // Draw WebGL - use theme-aware background for gap color
        const bgColor = parseCSSColorToVec3(
            getCSSVar(
                themeEl,
                "--psp-webgl--gridline--color",
                "rgba(128,128,128,0.8)",
            ),
        );
        gl.clearColor(
            bgColor[0] * 0.3,
            bgColor[1] * 0.3,
            bgColor[2] * 0.3,
            1.0,
        );
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this._program);
        gl.uniform2f(this._locations!.u_resolution, cssWidth, cssHeight);

        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer);
        gl.enableVertexAttribArray(this._locations!.a_position);
        gl.vertexAttribPointer(
            this._locations!.a_position,
            2,
            gl.FLOAT,
            false,
            0,
            0,
        );

        // Bind color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._colorBuffer);
        gl.enableVertexAttribArray(this._locations!.a_color);
        gl.vertexAttribPointer(
            this._locations!.a_color,
            3,
            gl.FLOAT,
            false,
            0,
            0,
        );

        gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);

        // Chrome overlay (labels, breadcrumbs, tooltips)
        this._renderChromeOverlay();
    }

    // -----------------------------------------------------------------------
    // Vertex generation
    // -----------------------------------------------------------------------

    private _generateAndUpload(
        gl: WebGL2RenderingContext | WebGLRenderingContext,
        colorStart: [number, number, number],
        colorEnd: [number, number, number],
    ): void {
        // Only render leaf-level and one-above nodes with fills
        const nodes = this._visibleNodes;
        const baseDepth = this._currentRoot?.depth ?? 0;

        // Count rectangles: leaf nodes get solid fill, relDepth-1 branches get border
        let rectCount = 0;
        for (const n of nodes) {
            if (n === this._currentRoot) continue;
            const w = n.x1 - n.x0;
            const h = n.y1 - n.y0;
            if (w < 1 || h < 1) continue;
            if (n.children.length === 0) {
                rectCount++;
            } else if (n.depth - baseDepth === 1) {
                rectCount += 2;
            }
        }

        const positions = new Float32Array(rectCount * 6 * 2); // 6 verts * 2 components
        const colors = new Float32Array(rectCount * 6 * 3); // 6 verts * 3 components
        let vi = 0; // vertex index

        const hasColor =
            this._colorName !== "" &&
            (this._colorIsString
                ? this._uniqueColorLabels.size > 0
                : this._colorMin < this._colorMax);

        for (const n of nodes) {
            if (n === this._currentRoot) continue;
            // Coordinates are already pixel-snapped by the layout
            const sx0 = n.x0;
            const sy0 = n.y0;
            const sx1 = n.x1;
            const sy1 = n.y1;
            const w = sx1 - sx0;
            const h = sy1 - sy0;
            if (w < 1 || h < 1) continue;

            if (n.children.length === 0) {
                // Leaf node: solid fill with 1px inset for visible gaps
                let color: [number, number, number];
                if (hasColor && this._colorIsString && n.colorLabel) {
                    const idx = this._uniqueColorLabels.get(n.colorLabel) ?? 0;
                    const maxIdx = Math.max(
                        1,
                        this._uniqueColorLabels.size - 1,
                    );
                    color = lerpColor(colorStart, colorEnd, idx / maxIdx);
                } else if (
                    hasColor &&
                    !isNaN(n.colorValue) &&
                    this._colorMax > this._colorMin
                ) {
                    const t =
                        (n.colorValue - this._colorMin) /
                        (this._colorMax - this._colorMin);
                    color = lerpColor(colorStart, colorEnd, t);
                } else {
                    color = colorStart;
                }

                vi = this._emitRect(
                    positions,
                    colors,
                    vi,
                    sx0,
                    sy0,
                    sx1 - 1,
                    sy1 - 1,
                    color,
                );
            } else {
                // Only draw borders for direct children of current root
                const relDepth = n.depth - baseDepth;
                if (relDepth === 1) {
                    // Only right + bottom edges (like leaf gaps) to avoid doubling
                    const borderColor: [number, number, number] = [
                        0.25, 0.25, 0.25,
                    ];
                    vi = this._emitRect(
                        positions,
                        colors,
                        vi,
                        sx0,
                        sy1 - 1,
                        sx1,
                        sy1,
                        borderColor,
                    );
                    vi = this._emitRect(
                        positions,
                        colors,
                        vi,
                        sx1 - 1,
                        sy0,
                        sx1,
                        sy1,
                        borderColor,
                    );
                }
            }
        }

        this._vertexCount = vi;

        // Upload
        if (!this._positionBuffer) {
            this._positionBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            positions.subarray(0, vi * 2),
            gl.DYNAMIC_DRAW,
        );

        if (!this._colorBuffer) {
            this._colorBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this._colorBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            colors.subarray(0, vi * 3),
            gl.DYNAMIC_DRAW,
        );
    }

    private _emitRect(
        positions: Float32Array,
        colors: Float32Array,
        vi: number,
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        color: [number, number, number],
    ): number {
        // Triangle 1: top-left, top-right, bottom-left
        const pi = vi * 2;
        const ci = vi * 3;

        positions[pi + 0] = x0;
        positions[pi + 1] = y0;
        positions[pi + 2] = x1;
        positions[pi + 3] = y0;
        positions[pi + 4] = x0;
        positions[pi + 5] = y1;

        // Triangle 2: top-right, bottom-right, bottom-left
        positions[pi + 6] = x1;
        positions[pi + 7] = y0;
        positions[pi + 8] = x1;
        positions[pi + 9] = y1;
        positions[pi + 10] = x0;
        positions[pi + 11] = y1;

        for (let v = 0; v < 6; v++) {
            colors[ci + v * 3 + 0] = color[0];
            colors[ci + v * 3 + 1] = color[1];
            colors[ci + v * 3 + 2] = color[2];
        }

        return vi + 6;
    }

    // -----------------------------------------------------------------------
    // Chrome overlay (labels, breadcrumbs, tooltip)
    // -----------------------------------------------------------------------

    /**
     * Render the chrome overlay. On layout changes, draws static content
     * (labels, breadcrumbs, legend) directly, then snapshots it into a
     * cached bitmap for fast hover frames. On hover-only updates,
     * composites the cached bitmap + tooltip without redrawing labels.
     */
    private _renderChromeOverlay(): void {
        if (!this._chromeCanvas || !this._currentRoot) return;

        const canvas = this._chromeCanvas;
        const dpr = window.devicePixelRatio || 1;

        const domRect = canvas.getBoundingClientRect();
        const cssWidth = domRect.width;
        const cssHeight = domRect.height;
        const targetW = Math.round(cssWidth * dpr);
        const targetH = Math.round(cssHeight * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
            this._chromeCacheDirty = true;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (this._chromeCacheDirty) {
            // Full redraw: render static content directly to the canvas,
            // then snapshot it async for future hover frames.
            this._chromeCache?.close();
            this._chromeCache = null;
            this._chromeCacheDirty = false;
            this._drawStaticChrome(ctx, dpr, cssWidth, cssHeight);

            // Snapshot for fast hover compositing (async, non-blocking)
            createImageBitmap(canvas).then((bmp) => {
                // Only use if we haven't been invalidated again
                if (!this._chromeCacheDirty) {
                    this._chromeCache = bmp;
                } else {
                    bmp.close();
                }
            });
        } else if (this._chromeCache) {
            // Fast path: blit cached bitmap, draw only tooltip on top
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(this._chromeCache, 0, 0);
        }
        // else: cache building, canvas already has static content from the
        // synchronous draw above — just draw tooltip on top.

        // Hover/pin: highlight first, then re-render headers + label on top
        const highlightNode = this._pinnedNode || this._hoveredNode;
        if (highlightNode) {
            ctx.save();
            ctx.scale(dpr, dpr);
            const fontFamily = getCSSVar(
                canvas,
                "--psp-webgl--font-family",
                "monospace",
            );
            const textColor = getCSSVar(
                canvas,
                "--psp-webgl--label--color",
                "rgba(180, 180, 180, 0.9)",
            );

            // Draw highlight border first (underneath labels)
            this._renderHoverHighlight(ctx, highlightNode);

            // Re-render header tabs and nested branch labels over the highlight
            const baseDepth = this._currentRoot!.depth;
            for (const n of this._visibleNodes) {
                if (n === this._currentRoot || n.children.length === 0)
                    continue;
                const nw = n.x1 - n.x0;
                const nh = n.y1 - n.y0;
                const relDepth = n.depth - baseDepth;
                if (relDepth === 1) {
                    this._renderBranchLabel(
                        ctx,
                        n,
                        nw,
                        nh,
                        fontFamily,
                        textColor,
                        false,
                    );
                } else if (relDepth === 2) {
                    this._renderBranchLabel(
                        ctx,
                        n,
                        nw,
                        nh,
                        fontFamily,
                        textColor,
                        true,
                    );
                }
            }

            // Re-render highlighted leaf label at full opacity
            if (highlightNode.children.length === 0) {
                const themeEl = this._gridlineCanvas || canvas;
                const colorStart = parseCSSColorToVec3(
                    getCSSVar(
                        themeEl,
                        "--psp-webgl--gradient-start--color",
                        "#0366d6",
                    ),
                );
                const colorEnd = parseCSSColorToVec3(
                    getCSSVar(
                        themeEl,
                        "--psp-webgl--gradient-end--color",
                        "#ff7f0e",
                    ),
                );
                const hasColor =
                    this._colorName !== "" &&
                    (this._colorIsString
                        ? this._uniqueColorLabels.size > 0
                        : this._colorMin < this._colorMax);
                const hw = highlightNode.x1 - highlightNode.x0;
                const hh = highlightNode.y1 - highlightNode.y0;
                this._renderLabel(
                    ctx,
                    highlightNode,
                    hw,
                    hh,
                    fontFamily,
                    colorStart,
                    colorEnd,
                    hasColor,
                    true,
                );
            }

            // Only show canvas tooltip on hover, not when pinned (pinned uses DOM tooltip)
            if (!this._pinnedNode && this._hoveredNode) {
                this._renderTooltip(
                    ctx,
                    this._hoveredNode,
                    cssWidth,
                    cssHeight,
                    fontFamily,
                );
            }
            ctx.restore();
        }
    }

    /** Draw labels, breadcrumbs, legend directly to the canvas context. */
    private _drawStaticChrome(
        ctx: CanvasRenderingContext2D,
        dpr: number,
        cssWidth: number,
        cssHeight: number,
    ): void {
        const canvas = this._chromeCanvas!;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(dpr, dpr);

        const fontFamily = getCSSVar(
            canvas,
            "--psp-webgl--font-family",
            "monospace",
        );
        const textColor = getCSSVar(
            canvas,
            "--psp-webgl--label--color",
            "rgba(180, 180, 180, 0.9)",
        );

        const themeEl = this._gridlineCanvas || canvas;
        const colorStart = parseCSSColorToVec3(
            getCSSVar(themeEl, "--psp-webgl--gradient-start--color", "#0366d6"),
        );
        const colorEnd = parseCSSColorToVec3(
            getCSSVar(themeEl, "--psp-webgl--gradient-end--color", "#ff7f0e"),
        );
        const hasColor =
            this._colorName !== "" &&
            (this._colorIsString
                ? this._uniqueColorLabels.size > 0
                : this._colorMin < this._colorMax);

        // Labels: draw leaves first, then branches on top
        const baseDepth = this._currentRoot!.depth;
        for (const n of this._visibleNodes) {
            if (n === this._currentRoot || n.children.length > 0) continue;
            const w = n.x1 - n.x0;
            const h = n.y1 - n.y0;
            this._renderLabel(
                ctx,
                n,
                w,
                h,
                fontFamily,
                colorStart,
                colorEnd,
                hasColor,
            );
        }
        for (const n of this._visibleNodes) {
            if (n === this._currentRoot || n.children.length === 0) continue;
            const w = n.x1 - n.x0;
            const h = n.y1 - n.y0;
            const relDepth = n.depth - baseDepth;
            if (relDepth === 1) {
                this._renderBranchLabel(
                    ctx,
                    n,
                    w,
                    h,
                    fontFamily,
                    textColor,
                    false,
                );
            } else if (relDepth === 2) {
                this._renderBranchLabel(
                    ctx,
                    n,
                    w,
                    h,
                    fontFamily,
                    textColor,
                    true,
                );
            }
        }

        // Breadcrumbs
        if (this._breadcrumbs.length > 1) {
            this._renderBreadcrumbs(ctx, cssWidth, fontFamily, textColor);
        }

        // Legend
        if (hasColor) {
            const legendLayout = new PlotLayout(cssWidth, cssHeight, {
                hasXLabel: false,
                hasYLabel: false,
                hasLegend: true,
            });
            if (this._colorIsString && this._uniqueColorLabels.size > 0) {
                renderCategoricalLegend(
                    canvas,
                    legendLayout,
                    this._uniqueColorLabels,
                    colorStart,
                    colorEnd,
                );
            } else if (this._colorMin < this._colorMax) {
                renderLegend(
                    canvas,
                    legendLayout,
                    {
                        min: this._colorMin,
                        max: this._colorMax,
                        label: this._colorName,
                    },
                    colorStart,
                    colorEnd,
                );
            }
        }

        ctx.restore();
    }

    private _renderLabel(
        ctx: CanvasRenderingContext2D,
        node: TreeNode,
        w: number,
        h: number,
        fontFamily: string,
        colorStart: [number, number, number],
        colorEnd: [number, number, number],
        hasColor: boolean,
        hovered = false,
    ): void {
        const MAX_FONT = 11;
        const PAD = 4;
        const LINE_HEIGHT = 1.3;

        if (w < 30 || h < 14) return;

        // Determine fill color for contrast
        let fillColor: [number, number, number] = colorStart;
        if (hasColor && this._colorIsString && node.colorLabel) {
            const idx = this._uniqueColorLabels.get(node.colorLabel) ?? 0;
            const maxIdx = Math.max(1, this._uniqueColorLabels.size - 1);
            fillColor = lerpColor(colorStart, colorEnd, idx / maxIdx);
        } else if (
            hasColor &&
            !isNaN(node.colorValue) &&
            this._colorMax > this._colorMin
        ) {
            const t =
                (node.colorValue - this._colorMin) /
                (this._colorMax - this._colorMin);
            fillColor = lerpColor(colorStart, colorEnd, t);
        }

        const lum = luminance(fillColor[0], fillColor[1], fillColor[2]);
        const labelColor = hovered
            ? lum > 0.5
                ? "rgba(0,0,0,0.85)"
                : "rgba(255,255,255,0.9)"
            : lum > 0.5
              ? "rgba(0,0,0,0.5)"
              : "rgba(255,255,255,0.55)";

        const fontSize = Math.min(MAX_FONT, Math.floor(h / 2));
        if (fontSize < 7) return;
        ctx.font = `${fontSize}px ${fontFamily}`;

        const maxW = w - PAD * 2;
        const lineH = fontSize * LINE_HEIGHT;
        const maxLines = Math.max(1, Math.floor((h - PAD * 2) / lineH));

        // Word-wrap the text
        const lines = this._wrapText(ctx, node.name, maxW, maxLines);
        if (lines.length === 0) return;

        // Center the block of lines vertically
        const blockH = lines.length * lineH;
        const startY = node.y0 + (h - blockH) / 2 + lineH / 2;

        ctx.fillStyle = labelColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const cx = node.x0 + w / 2;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], cx, startY + i * lineH);
        }
    }

    private _wrapText(
        ctx: CanvasRenderingContext2D,
        text: string,
        maxW: number,
        maxLines: number,
    ): string[] {
        if (maxLines <= 0 || maxW <= 0) return [];

        // If it fits on one line, done
        if (ctx.measureText(text).width <= maxW) {
            return [text];
        }

        const lines: string[] = [];
        let remaining = text;

        while (remaining.length > 0 && lines.length < maxLines) {
            const isLastLine = lines.length === maxLines - 1;

            // Find how many chars fit on this line
            let fitLen = remaining.length;
            while (
                fitLen > 0 &&
                ctx.measureText(remaining.slice(0, fitLen)).width > maxW
            ) {
                fitLen--;
            }
            if (fitLen === 0) fitLen = 1; // at least 1 char

            if (fitLen === remaining.length) {
                // Rest fits on this line
                lines.push(remaining);
                break;
            }

            // Try to break at a word boundary
            let breakAt = fitLen;
            const spaceIdx = remaining.lastIndexOf(" ", fitLen);
            if (spaceIdx > 0) {
                breakAt = spaceIdx;
            }

            if (isLastLine) {
                // Truncate with ellipsis
                lines.push(this._truncateWithEllipsis(ctx, remaining, maxW));
                break;
            }

            lines.push(remaining.slice(0, breakAt));
            remaining = remaining.slice(breakAt).trimStart();
        }

        if (lines.length === 1 && lines[0].length <= 2) return [];
        return lines;
    }

    private _truncateWithEllipsis(
        ctx: CanvasRenderingContext2D,
        text: string,
        maxW: number,
    ): string {
        if (ctx.measureText(text).width <= maxW) return text;
        while (text.length > 1) {
            text = text.slice(0, -1);
            if (ctx.measureText(text + "\u2026").width <= maxW) {
                return text + "\u2026";
            }
        }
        return text;
    }

    private _renderBranchLabel(
        ctx: CanvasRenderingContext2D,
        node: TreeNode,
        w: number,
        h: number,
        fontFamily: string,
        textColor: string,
        nested: boolean,
    ): void {
        if (nested) {
            // Need enough room for readable centered text
            if (w < 60 || h < 30) return;

            const fontSize = 12;
            ctx.font = `bold ${fontSize}px ${fontFamily}`;

            let text = node.name;
            const maxW = w - 16;
            let textW = ctx.measureText(text).width;
            if (textW > maxW) {
                while (text.length > 1) {
                    text = text.slice(0, -1);
                    if (ctx.measureText(text + "\u2026").width <= maxW) {
                        text += "\u2026";
                        break;
                    }
                }
            }
            if (text.length <= 3) return;

            // Clip to node rect so text never bleeds into neighbors
            ctx.save();
            ctx.beginPath();
            ctx.rect(node.x0, node.y0, w, h);
            ctx.clip();

            const cx = node.x0 + w / 2;
            const cy = node.y0 + h / 2;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
            ctx.lineJoin = "round";
            ctx.strokeText(text, cx, cy);
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            ctx.fillText(text, cx, cy);

            ctx.restore();
        } else {
            // Header tab: top-left
            if (w < 40 || h < 22) return;

            const fontSize = 11;
            ctx.font = `bold ${fontSize}px ${fontFamily}`;

            let text = node.name;
            const maxW = w - 10;
            let textW = ctx.measureText(text).width;
            if (textW > maxW) {
                while (text.length > 1) {
                    text = text.slice(0, -1);
                    if (ctx.measureText(text + "\u2026").width <= maxW) {
                        text += "\u2026";
                        break;
                    }
                }
            }

            ctx.fillStyle = textColor;
            ctx.globalAlpha = 0.85;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(text, node.x0 + 5, node.y0 + 4);
            ctx.globalAlpha = 1.0;
        }
    }

    private _renderBreadcrumbs(
        ctx: CanvasRenderingContext2D,
        cssWidth: number,
        fontFamily: string,
        textColor: string,
    ): void {
        this._breadcrumbRegions = [];

        const bgColor = getCSSVar(
            this._chromeCanvas!,
            "--psp-webgl--tooltip--background",
            "rgba(155,155,155,0.8)",
        );

        // Background bar
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, cssWidth, 24);

        ctx.font = `11px ${fontFamily}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        let x = 8;
        const y = 12;

        for (let i = 0; i < this._breadcrumbs.length; i++) {
            const crumb = this._breadcrumbs[i];
            const isLast = i === this._breadcrumbs.length - 1;
            const label = crumb.name;

            ctx.fillStyle = isLast ? textColor : textColor;
            ctx.font = isLast
                ? `bold 11px ${fontFamily}`
                : `11px ${fontFamily}`;

            const textW = ctx.measureText(label).width;
            ctx.fillText(label, x, y);

            this._breadcrumbRegions.push({
                node: crumb,
                x0: x - 2,
                y0: 0,
                x1: x + textW + 2,
                y1: 24,
            });

            x += textW;

            if (!isLast) {
                ctx.fillStyle = textColor;
                ctx.font = `11px ${fontFamily}`;
                const sep = " \u203A ";
                ctx.fillText(sep, x, y);
                x += ctx.measureText(sep).width;
            }
        }
    }

    private _renderHoverHighlight(
        ctx: CanvasRenderingContext2D,
        node: TreeNode,
    ): void {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(node.x0, node.y0, node.x1 - node.x0, node.y1 - node.y0);
    }

    private _renderTooltip(
        ctx: CanvasRenderingContext2D,
        node: TreeNode,
        cssWidth: number,
        cssHeight: number,
        fontFamily: string,
    ): void {
        const tooltipBg = getCSSVar(
            this._chromeCanvas!,
            "--psp-webgl--tooltip--background",
            "rgba(155,155,155,0.8)",
        );
        const tooltipText = getCSSVar(
            this._chromeCanvas!,
            "--psp-webgl--tooltip--color",
            "#161616",
        );
        const tooltipBorder = getCSSVar(
            this._chromeCanvas!,
            "--psp-webgl--tooltip--border-color",
            "#fff",
        );

        const lines = this._buildTooltipLines(node);
        if (lines.length === 0) return;

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

        // Position near the center of the hovered node
        const cx = (node.x0 + node.x1) / 2;
        const cy = (node.y0 + node.y1) / 2;
        let tx = cx + 12;
        let ty = cy - boxH - 8;
        if (tx + boxW > cssWidth) tx = cx - boxW - 12;
        if (tx < 0) tx = 4;
        if (ty < 0) ty = cy + 12;
        if (ty + boxH > cssHeight) ty = cssHeight - boxH - 4;

        ctx.fillStyle = tooltipBg;
        ctx.strokeStyle = tooltipBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, boxW, boxH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = tooltipText;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], tx + padding, ty + padding + i * lineHeight);
        }
    }

    private _buildTooltipLines(node: TreeNode): string[] {
        const lines: string[] = [];

        // Path
        if (node.rowPath.length > 0) {
            lines.push(node.rowPath.join(" \u203A "));
        } else {
            lines.push(node.name);
        }

        // Value
        lines.push(`Value: ${formatTickValue(node.value)}`);

        // Size
        if (this._sizeName && node.tooltipData.has(this._sizeName)) {
            const val = node.tooltipData.get(this._sizeName)!;
            lines.push(
                `${this._sizeName}: ${typeof val === "number" ? formatTickValue(val) : val}`,
            );
        }

        // Color
        if (this._colorName && !isNaN(node.colorValue)) {
            lines.push(
                `${this._colorName}: ${formatTickValue(node.colorValue)}`,
            );
        } else if (this._colorName && node.colorLabel) {
            lines.push(`${this._colorName}: ${node.colorLabel}`);
        }

        // Additional tooltip columns
        for (const [name, val] of node.tooltipData) {
            if (name === this._sizeName || name === this._colorName) continue;
            const formatted =
                typeof val === "number" ? formatTickValue(val) : val;
            lines.push(`${name}: ${formatted}`);
        }

        if (node.children.length > 0) {
            lines.push(`Children: ${node.children.length}`);
        }

        return lines;
    }

    // -----------------------------------------------------------------------
    // Interaction
    // -----------------------------------------------------------------------

    /**
     * Find the node at (mx, my). Returns the smallest leaf AND the
     * smallest (deepest) branch separately, so callers can decide.
     */
    private _hitTest(
        mx: number,
        my: number,
    ): { leaf: TreeNode | null; branch: TreeNode | null; inHeader: boolean } {
        let bestLeaf: TreeNode | null = null;
        let bestLeafArea = Infinity;
        let bestBranch: TreeNode | null = null;
        let bestBranchArea = Infinity;
        let labelBranch: TreeNode | null = null;
        const baseDepth = this._currentRoot?.depth ?? 0;

        for (const n of this._visibleNodes) {
            if (n === this._currentRoot) continue;
            if (mx >= n.x0 && mx <= n.x1 && my >= n.y0 && my <= n.y1) {
                const area = (n.x1 - n.x0) * (n.y1 - n.y0);
                if (n.children.length > 0) {
                    if (area < bestBranchArea) {
                        bestBranchArea = area;
                        bestBranch = n;
                    }
                    // Check if mouse is in ANY branch's label zone
                    const relDepth = n.depth - baseDepth;
                    if (relDepth === 1 && my <= n.y0 + PADDING_LABEL) {
                        labelBranch = n;
                    }
                    if (relDepth === 2) {
                        const nw = n.x1 - n.x0;
                        const nh = n.y1 - n.y0;
                        if (nw >= 60 && nh >= 30) {
                            const cy = n.y0 + nh / 2;
                            const cx = n.x0 + nw / 2;
                            if (
                                Math.abs(my - cy) < 10 &&
                                Math.abs(mx - cx) < nw * 0.4
                            ) {
                                labelBranch = n;
                            }
                        }
                    }
                } else {
                    if (area < bestLeafArea) {
                        bestLeafArea = area;
                        bestLeaf = n;
                    }
                }
            }
        }

        // If mouse is over a label zone, use that branch
        if (labelBranch) {
            return { leaf: null, branch: labelBranch, inHeader: true };
        }

        return { leaf: bestLeaf, branch: bestBranch, inHeader: false };
    }

    private _handleHover(mx: number, my: number): void {
        if (this._pinnedNode) return;

        // Check breadcrumbs first
        for (const region of this._breadcrumbRegions) {
            if (
                mx >= region.x0 &&
                mx <= region.x1 &&
                my >= region.y0 &&
                my <= region.y1
            ) {
                if (this._glCanvas) this._glCanvas.style.cursor = "pointer";
                this._hoveredNode = null;
                this._renderChromeOverlay();
                return;
            }
        }

        // In a header tab zone, show the branch as hovered (not the leaf under it)
        const { leaf, branch, inHeader } = this._hitTest(mx, my);
        const best = inHeader ? branch : leaf || branch;

        if (best !== this._hoveredNode) {
            this._hoveredNode = best;
            if (this._glCanvas) {
                this._glCanvas.style.cursor = branch ? "pointer" : "default";
            }
            this._renderChromeOverlay();
        }
    }

    private _handleClick(mx: number, my: number): void {
        // Dismiss pinned tooltip on any click
        if (this._pinnedNode) {
            this._dismissPinnedTooltip();
            return;
        }

        // Check breadcrumbs
        for (const region of this._breadcrumbRegions) {
            if (
                mx >= region.x0 &&
                mx <= region.x1 &&
                my >= region.y0 &&
                my <= region.y1
            ) {
                if (region.node !== this._currentRoot) {
                    this._drillTo(region.node);
                }
                return;
            }
        }

        // Only drill when clicking header/label zones; otherwise pin leaf tooltip
        const { leaf, branch, inHeader } = this._hitTest(mx, my);

        if (branch && inHeader) {
            this._drillTo(branch);
        } else if (leaf) {
            this._showPinnedTooltip(leaf);
        } else if (branch) {
            this._drillTo(branch);
        }
    }

    private _handleDblClick(mx: number, my: number): void {
        this._dismissPinnedTooltip();
        const { leaf, branch } = this._hitTest(mx, my);
        const target =
            branch ||
            (leaf?.parent !== this._currentRoot ? leaf?.parent : null);
        if (
            target &&
            target !== this._currentRoot &&
            target.children.length > 0
        ) {
            this._drillTo(target);
            // Re-find and pin the leaf in the new layout
            if (leaf && leaf.children.length === 0) {
                // After drill + re-layout, the leaf still exists in the tree
                // but has new coordinates. Pin it.
                this._showPinnedTooltip(leaf);
            }
        }
    }

    private _drillTo(node: TreeNode): void {
        this._currentRoot = node;
        this._rebuildBreadcrumbs(node);
        this._hoveredNode = null;
        if (this._glManager) {
            this._fullRender(this._glManager);
        }
    }

    private _showPinnedTooltip(node: TreeNode): void {
        this._dismissPinnedTooltip();
        this._pinnedNode = node;

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

        const lines = this._buildTooltipLines(node);
        if (lines.length === 0) return;

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

        const cx = (node.x0 + node.x1) / 2;
        const cy = (node.y0 + node.y1) / 2;
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = (this._glCanvas?.width || 100) / dpr;
        const cssHeight = (this._glCanvas?.height || 100) / dpr;

        const divW = div.getBoundingClientRect().width;
        const divH = div.getBoundingClientRect().height;
        let tx = cx + 12;
        let ty = cy - divH - 8;
        if (tx + divW > cssWidth) tx = cx - divW - 12;
        if (tx < 0) tx = 4;
        if (ty < 0) ty = cy + 12;
        if (ty + divH > cssHeight) ty = cssHeight - divH - 4;

        div.style.left = `${tx}px`;
        div.style.top = `${ty}px`;

        this._hoveredNode = null;
        this._renderChromeOverlay();
    }

    private _dismissPinnedTooltip(): void {
        if (this._pinnedTooltip) {
            this._pinnedTooltip.remove();
            this._pinnedTooltip = null;
        }
        this._pinnedNode = null;
    }
}
