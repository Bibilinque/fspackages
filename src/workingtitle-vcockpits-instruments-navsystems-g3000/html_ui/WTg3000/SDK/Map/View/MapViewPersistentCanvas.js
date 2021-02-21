/**
 * A canvas sub-layer that is meant to be redrawn periodically and transformed between redraws to compensate
 * for changes in the map view. Invalidation occurs when transformations are no longer sufficient for compensation.
 * This sub-layer contains both an offscreen buffer and a display canvas which may be redrawn independently of each
 * other.
 */
class WT_MapViewPersistentCanvas extends WT_MapViewCanvas {
    /**
     * @param {Number} overdrawFactor - the factor with which to overdraw the map viewing window. A factor of at least
     *                                  sqrt(2) is required to avoid invalidations with rotation alone.
     */
    constructor(overdrawFactor) {
        super(true, true);

        this._overdrawFactor = overdrawFactor;

        this._nominalWidth = 0;
        this._nominalHeight = 0;
        this._topLeft = new WT_GVector2(0, 0);
        this._margin = 0;

        this._viewClipExtent = [new WT_GVector2(0, 0), new WT_GVector2(0, 0)];
        this._translate = new WT_GVector2(0, 0);

        this._tempVector = new WT_GVector2(0, 0);
    }

    _createBuffer() {
        return new WT_MapViewPersistenCanvasDrawable();
    }

    _createDisplay() {
        let display = new WT_MapViewPersistenCanvasDrawable();
        display.canvas.style.position = "absolute";
        display.canvas.style.left = 0;
        display.canvas.style.top = 0;
        return display;
    }

    /**
     * @property {Number} width - the width, in pixels, of this sublayer.
     * @type {Number}
     */
    get width() {
        return this.display.canvas.width;
    }

    set width(width) {
        super.width = width;
        let left = -(width - this._nominalWidth) / 2;
        this.display.canvas.style.left = `${left}px`;
        this._topLeft.set(left, this._topLeft.y);
        this._viewClipExtent[1].set(width, this.height);
        this._translate.set(width / 2, this._translate.y);
        this._updateProjectionRenderers();
    }

    /**
     * @property {Number} height - the height, in pixels, of this sublayer.
     * @type {Number}
     */
    get height() {
        return this.display.canvas.height;
    }

    set height(height) {
        super.height = height;
        let top = -(height - this._nominalHeight) / 2;
        this.display.canvas.style.top = `${top}px`;
        this._topLeft.set(this._topLeft.x, top);
        this._viewClipExtent[1].set(this.width, height);
        this._translate.set(this._translate.x, height / 2);
        this._updateProjectionRenderers();
    }

    /**
     * @readonly
     * @property {Number} overdrawFactor - the factor by which to overdraw this canvas relative to the map view window.
     * @type {Number}
     */
    get overdrawFactor() {
        return this._overdrawFactor;
    }

    /**
     * @readonly
     * @property {Number} margin - the smallest possible margin, in pixels, between the edge of the visible map view window and
     *                             the edge of the canvas.
     * @type {Number}
     */
    get margin() {
        return this._margin;
    }

    /**
     * @readonly
     * @property {Boolean} isDisplayInvalid - whether the displayed canvas is invalid. The canvas is invalid if the current map projection
     *                                        range has changed since the last redraw or if the offset of the canvas in either the x- or y-
     *                                        axes is greater than the margin.
     * @type {Boolean}
     */
    get isDisplayInvalid() {
        return this._isDisplayInvalid;
    }

    /**
     * @readonly
     * @property {Boolean} isBufferInvalid - whether the buffer is invalid. The buffer is invalid if the current map projection range has
     *                                       changed since the last time the buffer was reset or if the offset of the buffer in either the
     *                                       x- or y- axes is greater than the margin.
     * @type {Boolean}
     */
    get isBufferInvalid() {
        return this._isBufferInvalid;
    }

    _updateProjectionRenderers() {
        if (this.display.projectionRenderer) {
            this.display.projectionRenderer.viewClipExtent = this._viewClipExtent;
            this.buffer.projectionRenderer.viewClipExtent = this._viewClipExtent;

            this.display.projectionRenderer.translate = this._translate;
            this.buffer.projectionRenderer.translate = this._translate;
        }
    }

    _initProjectionRenderers(projection) {
        this.display._projectionRenderer = projection.createCustomRenderer();
        this.buffer._projectionRenderer = projection.createCustomRenderer();
        this._updateProjectionRenderers();
    }

    setSize(width, height) {
        this._nominalWidth = width;
        this._nominalHeight = height;
        let long = Math.max(width, height);
        let size = long * this.overdrawFactor;

        this.width = size;
        this.height = size;
        this._margin = long * (this.overdrawFactor - 1.41421356237) / 2;
    }

    /**
     * @param {WT_MapViewState} state
     */
    onProjectionViewChanged(state) {
        super.onProjectionViewChanged(state);
        this.display.invalidate();
        this.buffer.invalidate();
    }

    /**
     * @param {WT_MapViewState} state
     */
    onAttached(state) {
        super.onAttached(state);
        this._initProjectionRenderers(state.projection);
    }

    _syncDisplayFromBuffer() {
        this.display.reference._range.set(this.buffer.reference.range);
        this.display.reference._center.set(this.buffer.reference.center);
        this.display.reference.scale = this.buffer.reference.scale;
        this.display.reference.rotation = this.buffer.reference.rotation;

        this.display.projectionRenderer.center = this.buffer.projectionRenderer.center;
        this.display.projectionRenderer.scale = this.buffer.projectionRenderer.scale;
        this.display.projectionRenderer.rotation = this.buffer.projectionRenderer.rotation;
    }

    _updateReference(state, reference) {
        reference._range.set(state.projection.range);
        reference._center.set(state.projection.center);
        reference.scale = state.projection.scale;
        reference.rotation = state.projection.rotation;
    }

    _updateTransform(state, reference, transform) {
        transform.scale = state.projection.scale / reference.scale;
        transform.rotation = state.projection.rotation - reference.rotation;
        state.projection.project(reference.center, transform._offset).subtract(state.projection.viewCenter);
        transform.margin = this.margin * transform.scale;
    }

    _transformDisplay() {
        let transform = this.display.transform;
        let offset = this._tempVector.set(transform.offset).scale(1 / transform.scale);
        this.display.canvas.style.transform = `scale(${transform.scale}) translate(${offset.x}px, ${offset.y}px) rotate(${transform.rotation}deg)`;
    }

    /**
     * @param {WT_MapViewState} state
     */
    resetBuffer(state) {
        this.buffer.clear();
        this.buffer._isInvalid = false;
        this._updateReference(state, this.buffer.reference);
        state.projection.syncRenderer(this.buffer.projectionRenderer);
    }

    /**
     * @param {WT_MapViewState} state
     * @param {Boolean} [fromBuffer]
     */
    redrawDisplay(state, fromBuffer = true) {
        this.display._isInvalid = false;
        this.display.clear();
        if (fromBuffer) {
            this.copyBufferToCanvas();
            this._syncDisplayFromBuffer();
        } else {
            this._updateReference(state, this.display.reference);
            state.projection.syncRenderer(this.display.projectionRenderer);
        }
        this._updateTransform(state, this.display.reference, this.display.transform);
        this._transformDisplay();
    }

    /**
     * @param {WT_MapViewState} state
     */
    update(state) {
        let range = state.projection.range;

        this._updateTransform(state, this.display.reference, this.display.transform);
        this._updateTransform(state, this.buffer.reference, this.buffer.transform);
        let offsetXAbsDisplay = Math.abs(this.display.transform.offset.x);
        let offsetYAbsDisplay = Math.abs(this.display.transform.offset.y);
        let offsetXAbsBuffer = Math.abs(this.buffer.transform.offset.x);
        let offsetYAbsBuffer = Math.abs(this.buffer.transform.offset.y);

        if (!this.display.isInvalid) {
            this.display._isInvalid = !this.display.reference.range.equals(range) ||
                                      (offsetXAbsDisplay > this.display.transform.margin || offsetYAbsDisplay > this.display.transform.margin);
        }

        if (!this.buffer.isInvalid) {
            this.buffer._isInvalid = !this.buffer.reference.range.equals(range) ||
                                     (offsetXAbsBuffer > this.buffer.transform.margin || offsetYAbsBuffer > this.buffer.transform.margin);
        }

        if (!this.display.isInvalid) {
            this._transformDisplay();
        }
    }
}

class WT_MapViewPersistenCanvasDrawable extends WT_MapViewCanvasDrawable {
    constructor() {
        super();

        this._reference = {
            _range: new WT_NumberUnit(-1, WT_Unit.NMILE),
            get range() {return this._range.readonly()},
            _center: new WT_GeoPoint(0, 0),
            get center() {return this._center.readonly()},
            scale: 150,
            rotation: 0,
        };
        this._transform = {
            scale: 1,
            rotation: 0,
            _offset: new WT_GVector2(0, 0),
            get offset() {return this._offset.readonly()},
            margin: 0
        };
        this._isInvalid = false;
    }

    /**
     * @readonly
     * @property {WT_MapViewPersistenCanvasDrawableReference} reference - the parameters of the projection with which this drawable was last redrawn.
     * @type {WT_MapViewPersistenCanvasDrawableReference}
     */
    get reference() {
        return this._reference;
    }

    /**
     * @readonly
     * @property {WT_MapViewPersistenCanvasDrawableTransform} transform - the properties of this drawable's current compensatory transformation.
     * @type {WT_MapViewPersistenCanvasDrawableTransform}
     */
    get transform() {
        return this._transform;
    }

    /**
     * @readonly
     * @property {Boolean} reference - whether this drawable is invalid.
     * @type {Boolean}
     */
    get isInvalid() {
        return this._isInvalid;
    }

    /**
     * @readonly
     * @property {WT_MapProjectionRenderer} projectionRenderer - the projection renderer used to render to this drawable.
     * @type {WT_MapProjectionRenderer}
     */
    get projectionRenderer() {
        return this._projectionRenderer;
    }

    /**
     * Invalidates this drawable.
     */
    invalidate() {
        this._isInvalid = true;
        this.clear();
    }
}

/**
 * @typedef WT_MapViewPersistenCanvasDrawableReference
 * @property {WT_NumberUnitReadOnly} range - the projection's range.
 * @property {WT_GeoPointReadOnly} center - the projection's center.
 * @property {Number} scale - the projection's nominal scale factor.
 * @property {Number} rotation - the projection's post-projected rotation angle.
 */

 /**
 * @typedef WT_MapViewPersistenCanvasDrawableTransform
 * @property {Number} scale - the transformation's scaling factor.
 * @property {Number} rotation - the transformation's rotation angle.
 * @property {WT_GVector2ReadOnly} offset - the transformation's translation, in pixels.
 * @property {Number} margin - the margin, in pixels, available for translation without invalidation.
 */