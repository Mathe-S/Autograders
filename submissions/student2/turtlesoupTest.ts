import { expect } from "chai";
import {
  drawSquare,
  chordLength,
  drawApproximateCircle,
  distance,
  findPath,
  drawPersonalArt,
} from "./turtlesoup";
import { SimpleTurtle, Point } from "./turtle";

describe("Student 2 tests for PS0", () => {
  // Student 2 has more comprehensive tests

  describe("chordLength", () => {
    it("should calculate chord length for angle 60", () => {
      expect(chordLength(5, 60)).to.equal(5);
    });

    it("should calculate chord length for angle 90", () => {
      expect(chordLength(5, 90)).to.equal(7.07);
    });

    it("should calculate chord length for angle 120", () => {
      expect(chordLength(5, 120)).to.equal(8.66);
    });

    it("should calculate chord length for angle 180", () => {
      expect(chordLength(5, 180)).to.equal(10);
    });
  });

  describe("distance", () => {
    it("should calculate distance correctly for points along x-axis", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 10, y: 0 };
      expect(distance(p1, p2)).to.equal(10);
    });

    it("should calculate distance correctly for points along y-axis", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 0, y: 10 };
      expect(distance(p1, p2)).to.equal(10);
    });

    it("should calculate distance correctly for diagonal points", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(distance(p1, p2)).to.equal(5);
    });

    it("should return 0 for identical points", () => {
      const p = { x: 5, y: 5 };
      expect(distance(p, p)).to.equal(0);
    });
  });

  describe("drawSquare", () => {
    it("should draw a square with the turtle", () => {
      const turtle = new SimpleTurtle();
      drawSquare(turtle, 100);

      const path = (turtle as SimpleTurtle).getPath();
      expect(path.length).to.equal(4); // Should have 4 line segments

      // Check we're back at the starting point
      const finalPosition = turtle.getPosition();
      expect(finalPosition.x).to.be.closeTo(0, 0.001);
      expect(finalPosition.y).to.be.closeTo(0, 0.001);

      // Check heading
      expect(turtle.getHeading()).to.equal(0);
    });
  });

  describe("findPath", () => {
    it("should generate path instructions for a list of points", () => {
      const turtle = new SimpleTurtle();
      const points = [
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const instructions = findPath(turtle, points);
      expect(instructions).to.be.an("array");
      expect(instructions.length).to.equal(3);
    });
  });
});
