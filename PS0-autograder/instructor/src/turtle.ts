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
  color(color: Color): void; // Optional for personal art
  getPosition(): Point; // Helpful for testing/debugging
  getHeading(): number; // Helpful for testing/debugging
  penUp(): void; // New method to lift the pen (for drawPersonalArt in PS0)
  penDown(): void; // New method to put the pen down (for drawPersonalArt in PS0)
}

// A very basic, in-memory Turtle implementation for Problem Set 0.
export class SimpleTurtle implements Turtle {
  private x: number;
  private y: number;
  private headingDegrees: number; // 0 degrees is up
  private penColor: Color = "black";
  private path: { start: Point; end: Point; color: Color }[] = []; // Store drawn lines
  private penIsDown: boolean = true;

  penUp(): void {
    this.penIsDown = false;
  }

  penDown(): void {
    this.penIsDown = true;
  }

  constructor(startX: number = 0, startY: number = 0) {
    this.x = startX;
    this.y = startY;
    this.headingDegrees = 0; // Start facing up
  }

  forward(units: number): void {
    const startPoint: Point = { x: this.x, y: this.y };
    const headingRadians = (this.headingDegrees * Math.PI) / 180;
    this.x += units * Math.sin(headingRadians); // Y-axis is typically inverted in graphics
    this.y -= units * Math.cos(headingRadians);
    const endPoint: Point = { x: this.x, y: this.y };

    // Only draw the path if pen is down
    if (this.penIsDown) {
      this.path.push({
        start: startPoint,
        end: endPoint,
        color: this.penColor,
      });
    }
  }

  turn(degrees: number): void {
    this.headingDegrees += degrees;
    this.headingDegrees = this.headingDegrees % 360; // Keep heading within 0-360 range
    if (this.headingDegrees < 0) {
      this.headingDegrees += 360; // Ensure heading is never negative
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
