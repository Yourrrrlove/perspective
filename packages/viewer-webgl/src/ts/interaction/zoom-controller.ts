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

import type { PlotLayout } from "../layout/plot-layout";

export interface ZoomState {
    scaleX: number;
    scaleY: number;
    // Translate as fraction of base domain range (0 = centered, ±0.5 = edge)
    normTranslateX: number;
    normTranslateY: number;
}

const MAX_ZOOM = 50;
const MIN_ZOOM = 1;

export class ZoomController {
    private _scaleX = 1;
    private _scaleY = 1;
    // Normalized translate: fraction of base domain range
    private _normTX = 0;
    private _normTY = 0;

    private _baseXMin = 0;
    private _baseXMax = 1;
    private _baseYMin = 0;
    private _baseYMax = 1;

    private _element: HTMLElement | null = null;
    private _layout: PlotLayout | null = null;
    private _onUpdate: (() => void) | null = null;

    private _pointerDown = false;
    private _lastPointerX = 0;
    private _lastPointerY = 0;

    private _onWheel: ((e: WheelEvent) => void) | null = null;
    private _onPointerDown: ((e: PointerEvent) => void) | null = null;
    private _onPointerMove: ((e: PointerEvent) => void) | null = null;
    private _onPointerUp: ((e: PointerEvent) => void) | null = null;

    setBaseDomain(
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number,
    ): void {
        this._baseXMin = xMin;
        this._baseXMax = xMax;
        this._baseYMin = yMin;
        this._baseYMax = yMax;
    }

    isDefault(): boolean {
        return (
            this._scaleX === 1 &&
            this._scaleY === 1 &&
            this._normTX === 0 &&
            this._normTY === 0
        );
    }

    getVisibleDomain(): {
        xMin: number;
        xMax: number;
        yMin: number;
        yMax: number;
    } {
        const bxRange = this._baseXMax - this._baseXMin;
        const byRange = this._baseYMax - this._baseYMin;
        const vxRange = bxRange / this._scaleX;
        const vyRange = byRange / this._scaleY;

        // Center = base midpoint + normalized translate * base range
        const cx =
            (this._baseXMin + this._baseXMax) / 2 + this._normTX * bxRange;
        const cy =
            (this._baseYMin + this._baseYMax) / 2 + this._normTY * byRange;

        return {
            xMin: cx - vxRange / 2,
            xMax: cx + vxRange / 2,
            yMin: cy - vyRange / 2,
            yMax: cy + vyRange / 2,
        };
    }

    attach(
        element: HTMLElement,
        layout: PlotLayout,
        onUpdate: () => void,
    ): void {
        this.detach();
        this._element = element;
        this._layout = layout;
        this._onUpdate = onUpdate;

        this._onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = element.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const plot = this._layout!.plotRect;

            if (
                mouseX < plot.x ||
                mouseX > plot.x + plot.width ||
                mouseY < plot.y ||
                mouseY > plot.y + plot.height
            )
                return;

            // Data coordinate under cursor before zoom
            const domain = this.getVisibleDomain();
            const dataX =
                domain.xMin +
                ((mouseX - plot.x) / plot.width) * (domain.xMax - domain.xMin);
            const dataY =
                domain.yMax -
                ((mouseY - plot.y) / plot.height) * (domain.yMax - domain.yMin);

            // Zoom factor
            const factor = Math.pow(1.1, -e.deltaY / 100);
            this._scaleX = Math.max(
                MIN_ZOOM,
                Math.min(MAX_ZOOM, this._scaleX * factor),
            );
            this._scaleY = Math.max(
                MIN_ZOOM,
                Math.min(MAX_ZOOM, this._scaleY * factor),
            );

            // Adjust translate so the data point under cursor stays put
            const newDomain = this.getVisibleDomain();
            const newDataX =
                newDomain.xMin +
                ((mouseX - plot.x) / plot.width) *
                    (newDomain.xMax - newDomain.xMin);
            const newDataY =
                newDomain.yMax -
                ((mouseY - plot.y) / plot.height) *
                    (newDomain.yMax - newDomain.yMin);

            const bxRange = this._baseXMax - this._baseXMin;
            const byRange = this._baseYMax - this._baseYMin;
            if (bxRange > 0) this._normTX += (dataX - newDataX) / bxRange;
            if (byRange > 0) this._normTY += (dataY - newDataY) / byRange;

            this._onUpdate!();
        };

        this._onPointerDown = (e: PointerEvent) => {
            const rect = element.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const plot = this._layout!.plotRect;

            if (
                mouseX >= plot.x &&
                mouseX <= plot.x + plot.width &&
                mouseY >= plot.y &&
                mouseY <= plot.y + plot.height
            ) {
                this._pointerDown = true;
                this._lastPointerX = e.clientX;
                this._lastPointerY = e.clientY;
                element.setPointerCapture(e.pointerId);
            }
        };

        this._onPointerMove = (e: PointerEvent) => {
            if (!this._pointerDown) return;
            const dx = e.clientX - this._lastPointerX;
            const dy = e.clientY - this._lastPointerY;
            this._lastPointerX = e.clientX;
            this._lastPointerY = e.clientY;

            const domain = this.getVisibleDomain();
            const plot = this._layout!.plotRect;
            const dataPerPixelX = (domain.xMax - domain.xMin) / plot.width;
            const dataPerPixelY = (domain.yMax - domain.yMin) / plot.height;

            const bxRange = this._baseXMax - this._baseXMin;
            const byRange = this._baseYMax - this._baseYMin;
            if (bxRange > 0) this._normTX -= (dx * dataPerPixelX) / bxRange;
            if (byRange > 0) this._normTY += (dy * dataPerPixelY) / byRange;

            this._onUpdate!();
        };

        this._onPointerUp = () => {
            this._pointerDown = false;
        };

        element.addEventListener("wheel", this._onWheel, { passive: false });
        element.addEventListener("pointerdown", this._onPointerDown);
        element.addEventListener("pointermove", this._onPointerMove);
        element.addEventListener("pointerup", this._onPointerUp);
    }

    updateLayout(layout: PlotLayout): void {
        this._layout = layout;
    }

    detach(): void {
        if (this._element) {
            if (this._onWheel)
                this._element.removeEventListener("wheel", this._onWheel);
            if (this._onPointerDown)
                this._element.removeEventListener(
                    "pointerdown",
                    this._onPointerDown,
                );
            if (this._onPointerMove)
                this._element.removeEventListener(
                    "pointermove",
                    this._onPointerMove,
                );
            if (this._onPointerUp)
                this._element.removeEventListener(
                    "pointerup",
                    this._onPointerUp,
                );
        }
        this._element = null;
        this._onUpdate = null;
    }

    reset(): void {
        this._scaleX = 1;
        this._scaleY = 1;
        this._normTX = 0;
        this._normTY = 0;
    }

    serialize(): ZoomState {
        return {
            scaleX: this._scaleX,
            scaleY: this._scaleY,
            normTranslateX: this._normTX,
            normTranslateY: this._normTY,
        };
    }

    restore(state: ZoomState): void {
        this._scaleX = state.scaleX;
        this._scaleY = state.scaleY;
        this._normTX = state.normTranslateX;
        this._normTY = state.normTranslateY;
    }
}
