import { NG_Chart } from "../../types/navigraph";

// TODO: split the actual viewer stuff from this class into a more generic viewer component for later reuse
export class CJ4_MFD_ChartView extends HTMLElement {

  private _image = new Image;
  private _canvas: HTMLCanvasElement;
  private _zoom: number = 1;
  private _yOffset: number = 0;
  private _xOffset: number = 0;
  private _isDirty: boolean = true;

  private readonly STEP_RATE = 40;
  private _chartindexnumber: HTMLElement;
  private _chartprocidentifier: HTMLElement;

  connectedCallback(): void {
    this._chartindexnumber = this.querySelector("#chartinfo_indexnumber");
    this._chartprocidentifier = this.querySelector("#chartinfo_procidentifier");
    this._canvas = this.querySelector("#chartcanvas");
    this._image.src = "#";
    this._image.onload = this.onImageLoaded.bind(this);
  }

  onImageLoaded(): void {
    this._isDirty = true;
  }

  loadChart(url: string = "", chart: NG_Chart = undefined): void {
    if (url !== "") {
      this._image.src = url; //"/Pages/VCockpit/Instruments/Airliners/CJ4/Shared/sample.png?cb=2";
    }
    if (chart !== undefined) {
      this._chartindexnumber.textContent = `${chart.icao_airport_identifier} ${chart.index_number}`;
      this._chartprocidentifier.textContent = chart.procedure_identifier;
    }
  }

  update(dTime: number): void {
    if (this._isDirty) {
      this._isDirty = false;
      CJ4_MFD_ChartView.fitCanvasToContainer(this._canvas);
      const ctx = this._canvas.getContext("2d");
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
      ctx.setTransform(this._zoom, 0, 0, this._zoom, this._xOffset, this._yOffset);
      if (this._image.src !== "" && this._image.src.indexOf("#") === -1) {
        CJ4_MFD_ChartView.scaleImgToFit(this._canvas, ctx, this._image);
      } else {
        ctx.fillStyle = "#cccac8";
        ctx.textAlign = "center";
        ctx.font = "26px Collins ProLine";
        ctx.fillText("NO CHART AVAILABLE", this._canvas.width / 2, this._canvas.height / 2);
      }
    }
  }

  onEvent(event: string): boolean {
    if (this.style.display === "none") {
      return false;
    }
    this._isDirty = true;
    let handled = true;
    switch (event) {
      case "Lwr_Push_ZOOM_INC":
      case "Lwr_Push_ZOOM_DEC":
        this._zoom = this._zoom === 1 ? 2.3 : 1;
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
        handled = false;
        break;
    }
    return handled;
  }

  static scaleImgToFit(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, img: HTMLImageElement): void {
    if (img.width > 0) {
      const ratio = img.width / img.height;
      let newW = canvas.width;
      let newH = newW / ratio;
      if (img.width > img.height) {
        newH = canvas.height;
        newW = newW * ratio;
      }


      // const scale = isLandscape ? (canvas.height / img.height) : (canvas.width / img.width);

      // img.width *= scale;
      // img.height *= scale;
      ctx.drawImage(img, 0, 0, newW, newH);
    }
  }

  static fitCanvasToContainer(canvas: HTMLCanvasElement): void {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
}

customElements.define("cj4-mfd-chartview", CJ4_MFD_ChartView);