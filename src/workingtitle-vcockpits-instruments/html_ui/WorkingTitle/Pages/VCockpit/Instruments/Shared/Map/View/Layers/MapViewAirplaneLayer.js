class WT_MapViewAirplaneLayer extends WT_MapViewMultiLayer {
    constructor(className = WT_MapViewAirplaneLayer.CLASS_DEFAULT, configName = WT_MapViewAirplaneLayer.CONFIG_NAME_DEFAULT) {
        super(className, configName);

        this._airplaneIcon = new WT_MapViewCanvas(false, false);
        this.addSubLayer(this._airplaneIcon);

        this._optsManager = new WT_OptionsManager(this, WT_MapViewAirplaneLayer.OPTIONS_DEF);

        this._iconImageLoaded = false;
    }

    /**
     * @readonly
     * @property {HTMLCanvasElement} airplaneIcon - the airplane icon element.
     * @type {HTMLCanvasElement}
     */
    get airplaneIcon() {
        return this._airplaneIcon;
    }

    _resizeCanvas() {
        this.airplaneIcon.canvas.width = this.iconSizePx;
        this.airplaneIcon.canvas.height = this.iconSizePx;
        this.airplaneIcon.canvas.style.left = `${-this.iconSizePx / 2}px`;
        this.airplaneIcon.canvas.style.top = `${-this.iconSizePx / 2}px`;
        this.airplaneIcon.canvas.style.width = `${this.iconSizePx}px`;
        this.airplaneIcon.canvas.style.height = `${this.iconSizePx}px`;
    }

    _redrawIcon() {
        this.airplaneIcon.context.drawImage(this._iconImage, 0, 0, this.iconSizePx, this.iconSizePx);
    }

    _drawIconToCanvas() {
        this._redrawIcon();
        this._iconImageLoaded = true;
    }

    /**
     * @param {WT_MapViewState} state
     */
    onConfigLoaded(state) {
        this._setPropertyFromConfig("iconSize");

        this.iconSizePx = this.iconSize * state.dpiScale;
        this._resizeCanvas();

        this._iconImage = document.createElement("img");
        this._iconImage.onload = this._drawIconToCanvas.bind(this);
        this._iconImage.src = this.config.iconPath;
    }

    /**
     * @param {WT_MapViewState} state
     */
    onViewSizeChanged(state) {
        let newIconSizePx = this.iconSize * state.dpiScale;
        if (newIconSizePx !== this.iconSizePx) {
            this.iconSizePx = newIconSizePx;
            this._resizeCanvas();
            if (this._iconImageLoaded) {
                this._redrawIcon();
            }
        }
    }

    /**
     * @param {WT_MapViewState} state
     */
    onUpdate(state) {
        if (!state.viewPlane) {
            return;
        }
        let iconRotation = state.model.airplane.headingTrue + state.projection.rotation;
        this.airplaneIcon.canvas.style.transform = `translate(${state.viewPlane.x}px, ${state.viewPlane.y}px) rotate(${iconRotation}deg)`;
    }
}
WT_MapViewAirplaneLayer.CLASS_DEFAULT = "airplaneLayer";
WT_MapViewAirplaneLayer.CONFIG_NAME_DEFAULT = "airplane";
WT_MapViewAirplaneLayer.OPTIONS_DEF = {
    iconSize: {default: 60, auto: true},
    iconSizePx: {default: 60, auto: true}
};