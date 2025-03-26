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

describe("Student 1 tests for PS0", () => {
  describe("chordLength", () => {
    it("should calculate chord length correctly for angle 60", () => {
      expect(chordLength(5, 60)).to.be.closeTo(5, 0.01); // Student's test is a bit more lenient
    });

    it("should calculate chord length correctly for angle 120", () => {
      expect(chordLength(10, 120)).to.be.closeTo(17.32, 0.01);
    });
  });

  describe("distance", () => {
    it("should calculate distance correctly", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(distance(p1, p2)).to.equal(5);
    });

    // Missing test cases for distance
  });

  // This student doesn't properly test findPath

  describe("drawSquare", () => {
    it("should draw a square with the turtle", () => {
      const turtle = new SimpleTurtle();
      drawSquare(turtle, 100);

      const path = (turtle as SimpleTurtle).getPath();
      expect(path.length).to.equal(4); // Should have 4 line segments

      // No detailed verification of the actual drawing
    });
  });
});
