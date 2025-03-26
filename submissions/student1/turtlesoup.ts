import { Turtle, SimpleTurtle, Point, Color } from "./turtle";

/**
 * Draws a square of the given side length using the turtle.
 */
export function drawSquare(turtle: Turtle, sideLength: number): void {
  // Student 1 implementation
  for (let i = 0; i < 4; i++) {
    turtle.forward(sideLength);
    turtle.turn(90);
  }
}

/**
 * Calculates the length of a chord of a circle.
 */
export function chordLength(radius: number, angleInDegrees: number): number {
  // Student 1 implementation - this one has a bug
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return 2 * radius * Math.sin(angleInRadians / 2); // Missing toFixed(2)
}

/**
 * Draws an approximate circle using the turtle.
 */
export function drawApproximateCircle(
  turtle: Turtle,
  radius: number,
  numSides: number
): void {
  // Student 1 implementation
  for (let i = 0; i < numSides; i++) {
    turtle.forward(chordLength(radius, 360 / numSides));
    turtle.turn(360 / numSides);
  }
}

/**
 * Calculates the distance between two points.
 */
export function distance(p1: Point, p2: Point): number {
  // Student 1 implementation
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Finds a path for the turtle to visit a list of points in order.
 */
export function findPath(turtle: Turtle, points: Point[]): string[] {
  // Student 1 implementation - incorrect
  const instructions = [];
  let currentPosition = turtle.getPosition();

  for (const point of points) {
    const dist = distance(currentPosition, point);
    instructions.push(`forward ${dist} turn 0`); // This is wrong - doesn't calculate turns
    currentPosition = point;
  }

  return instructions;
}

/**
 * Draws student 1's personal art.
 */
export function drawPersonalArt(turtle: Turtle): void {
  // Student 1's creative art
  turtle.color("blue");

  // Draw a star
  for (let i = 0; i < 5; i++) {
    turtle.forward(100);
    turtle.turn(144);
  }

  turtle.color("red");

  // Draw some circles around it
  for (let i = 0; i < 6; i++) {
    turtle.turn(60);
    turtle.forward(70);
    for (let j = 0; j < 36; j++) {
      turtle.forward(3);
      turtle.turn(10);
    }
    turtle.turn(180);
    turtle.forward(70);
  }
}
