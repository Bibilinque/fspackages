// TODO: split the actual viewer stuff from this class into a more generic viewer component for later reuse
export class CJ4_MFD_ChartView extends HTMLElement {

  private _image = new Image;
  private _canvas: HTMLCanvasElement;
  private _zoom: number = 1;
  private _yOffset: number = 0;
  private _xOffset: number = 0;
  private _isDirty: boolean = true;

  private readonly STEP_RATE = 40;

  connectedCallback(): void {
    this._canvas = this.querySelector("#chartcanvas");
    this._image.src = "/Pages/VCockpit/Instruments/Airliners/CJ4/Shared/sample.png?cb=2";
  }

  update(dTime: number): void {
    if (this._isDirty) {
      this._isDirty = false;
      CJ4_MFD_ChartView.fitCanvasToContainer(this._canvas);
      const ctx = this._canvas.getContext("2d");
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
      ctx.setTransform(this._zoom, 0, 0, this._zoom, this._xOffset, this._yOffset);
      CJ4_MFD_ChartView.scaleImgToFit(this._canvas, ctx, this._image);
    }
  }

  onEvent(event: string): void {
    this._isDirty = true;
    switch (event) {
      case "Lwr_Push_ZOOM_INC":
      case "Lwr_Push_ZOOM_DEC":
        this._zoom = this._zoom === 1 ? 1.5 : 1;
        if (this._zoom === 1) {
          this._xOffset = 0;
          this._yOffset = 0;
        }
        break;
      case "Lwr_JOYSTICK_UP":
        this._yOffset = Math.min(0, this._yOffset + this.STEP_RATE);
        break;
      case "Lwr_JOYSTICK_DOWN":
        // -27 from height for the chart info container
        this._yOffset = Math.max(-((this._image.height * this._zoom) - (this._canvas.height - 27)), this._yOffset - this.STEP_RATE);
        break;
      case "Lwr_JOYSTICK_LEFT":
        this._xOffset = Math.min(0, this._xOffset + this.STEP_RATE);
        break;
      case "Lwr_JOYSTICK_RIGHT":
        this._xOffset = Math.max(-((this._image.width * this._zoom) - (this._canvas.width)), this._xOffset - this.STEP_RATE);
        break;
      default:
        this._isDirty = false;
        break;
    }
  }

  static scaleImgToFit(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, img: HTMLImageElement): void {
    const scale = (canvas.width / img.width);
    img.width *= scale;
    img.height *= scale;
    ctx.drawImage(img, 0, 0, img.width, img.height);
  }

  static fitCanvasToContainer(canvas: HTMLCanvasElement): void {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
}

customElements.define("cj4-mfd-chartview", CJ4_MFD_ChartView);