import { Turtle, SimpleTurtle, Point, Color } from "./turtle";

/**
 * Draws a square of the given side length using the turtle.
 */
export function drawSquare(turtle: Turtle, sideLength: number): void {
  // Student 2 implementation
  turtle.forward(sideLength);
  turtle.turn(90);
  turtle.forward(sideLength);
  turtle.turn(90);
  turtle.forward(sideLength);
  turtle.turn(90);
  turtle.forward(sideLength);
  turtle.turn(90);
}

/**
 * Calculates the length of a chord of a circle.
 */
export function chordLength(radius: number, angleInDegrees: number): number {
  // Student 2 implementation - correct
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return +(2 * radius * Math.sin(angleInRadians / 2)).toFixed(2);
}

/**
 * Draws an approximate circle using the turtle.
 */
export function drawApproximateCircle(
  turtle: Turtle,
  radius: number,
  numSides: number
): void {
  // Student 2 implementation - has an error in the direction of turning
  const turnAngle = 360 / numSides;
  for (let i = 0; i < numSides; i++) {
    turtle.forward(chordLength(radius, turnAngle));
    turtle.turn(-turnAngle); // Wrong direction (should be positive)
  }
}

/**
 * Calculates the distance between two points.
 */
export function distance(p1: Point, p2: Point): number {
  // Student 2 implementation
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Finds a path for the turtle to visit a list of points in order.
 */
export function findPath(turtle: Turtle, points: Point[]): string[] {
  // Student 2 implementation - mostly correct
  const path = [];
  let currentPos = turtle.getPosition();

  for (const point of points) {
    // Calculate distance and angle
    const dx = point.x - currentPos.x;
    const dy = point.y - currentPos.y;
    const dist = distance(currentPos, point);

    // Calculate turn angle
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = (90 - angle) % 360; // Convert to turtle's coordinate system

    // Make the moves
    turtle.turn(angle - turtle.getHeading());
    turtle.forward(dist);

    // Record instructions
    path.push(`forward ${dist} turn ${angle - turtle.getHeading()}`);

    // Update current position
    currentPos = point;
  }

  return path;
}

/**
 * Draws student 2's personal art.
 */
export function drawPersonalArt(turtle: Turtle): void {
  // Student 2's creative art
  turtle.color("purple");

  // Draw a spiral
  for (let i = 0; i < 50; i++) {
    turtle.forward(i * 2);
    turtle.turn(45);
  }

  turtle.color("green");

  // Draw a flower
  for (let i = 0; i < 8; i++) {
    // Draw petal
    for (let j = 0; j < 60; j++) {
      turtle.forward(1);
      turtle.turn(3);
    }
    turtle.turn(45);
  }
}
