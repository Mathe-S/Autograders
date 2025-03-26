export type Point = {
  x: number;
  y: number;
};

export type Color =
  | "black"
  | "red"
  | "green"
  | "blue"
  | "yellow"
  | "purple"
  | "orange"
  | "cyan"
  | "magenta";

export interface Turtle {
  forward(units: number): void;
  turn(degrees: number): void;
  color(color: Color): void;
  getPosition(): Point;
  getHeading(): number;
}

export class SimpleTurtle implements Turtle {
  private x: number;
  private y: number;
  private headingDegrees: number;
  private penColor: Color = "black";
  private path: { start: Point; end: Point; color: Color }[] = [];

  constructor(startX: number = 0, startY: number = 0) {
    this.x = startX;
    this.y = startY;
    this.headingDegrees = 0;
  }

  forward(units: number): void {
    const startPoint: Point = { x: this.x, y: this.y };
    const headingRadians = (this.headingDegrees * Math.PI) / 180;
    this.x += units * Math.sin(headingRadians);
    this.y -= units * Math.cos(headingRadians);
    const endPoint: Point = { x: this.x, y: this.y };
    this.path.push({ start: startPoint, end: endPoint, color: this.penColor });
  }

  turn(degrees: number): void {
    this.headingDegrees += degrees;
    this.headingDegrees = this.headingDegrees % 360;
    if (this.headingDegrees < 0) {
      this.headingDegrees += 360;
    }
  }

  color(color: Color): void {
    this.penColor = color;
  }

  getPosition(): Point {
    return { x: this.x, y: this.y };
  }

  getHeading(): number {
    return this.headingDegrees;
  }

  getPath(): { start: Point; end: Point; color: Color }[] {
    return this.path;
  }
}
