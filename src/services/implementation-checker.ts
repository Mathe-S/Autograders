import * as path from "path";
import * as fs from "fs";

interface FunctionImplementationStatus {
  name: string;
  implemented: boolean;
  points: number;
}

/**
 * Checks whether functions in a student's turtlesoup.ts file are properly implemented
 * or just contain placeholder code.
 *
 * @param studentDir The student's directory
 * @returns An object containing the implementation status of each function and the total points to deduct
 */
export async function checkFunctionImplementations(
  studentDir: string
): Promise<{
  functionStatus: FunctionImplementationStatus[];
  totalPointsDeduction: number;
  implementationSummary: string;
}> {
  const turtlesoupPath = path.join(studentDir, "src", "turtlesoup.ts");

  // Check if the file exists
  if (!fs.existsSync(turtlesoupPath)) {
    return {
      functionStatus: [],
      totalPointsDeduction: 30, // Deduct all points if file doesn't exist
      implementationSummary: "turtlesoup.ts not found",
    };
  }

  // Read the file content
  const content = fs.readFileSync(turtlesoupPath, "utf-8");

  // Define the functions to check and points to deduct per function
  const functionsToCheck = [
    { name: "drawSquare", pointsWorth: 5 },
    { name: "chordLength", pointsWorth: 5 },
    { name: "drawApproximateCircle", pointsWorth: 5 },
    { name: "distance", pointsWorth: 5 },
    { name: "findPath", pointsWorth: 5 },
    { name: "drawPersonalArt", pointsWorth: 5 },
  ];

  let totalPointsDeduction = 0;
  const functionStatus: FunctionImplementationStatus[] = [];

  // Check each function
  for (const func of functionsToCheck) {
    const functionPattern = new RegExp(
      `export function ${func.name}\\([^)]*\\)[^{]*{([^}]*)}`,
      "s"
    );
    const match = content.match(functionPattern);

    if (match) {
      const functionBody = match[1];

      // More sophisticated check for each function type
      let isPlaceholder = false;

      switch (func.name) {
        case "drawSquare":
          // Consider implemented if it has 4 forward/turn combinations that could make a square
          const forwardCalls = (functionBody.match(/turtle\.forward/g) || [])
            .length;
          const turnCalls = (functionBody.match(/turtle\.turn/g) || []).length;
          isPlaceholder = forwardCalls < 4 || turnCalls < 3;
          break;

        case "chordLength":
          // Must use Math.sin for chord length calculation
          isPlaceholder = !functionBody.includes("Math.sin");
          break;

        case "drawApproximateCircle":
          // Should call chordLength and have a loop
          isPlaceholder =
            !functionBody.includes("chordLength") ||
            !functionBody.includes("for") ||
            !functionBody.includes("turtle.forward");
          break;

        case "distance":
          // Must use Math.sqrt for distance calculation
          isPlaceholder = !functionBody.includes("Math.sqrt");
          break;

        case "findPath":
          // More comprehensive check for findPath implementation
          const hasMoveDistance =
            functionBody.includes("moveDistance") ||
            functionBody.includes("distance(");
          const hasTurnAngle =
            functionBody.includes("turnAngle") ||
            functionBody.includes("targetHeading") ||
            functionBody.includes("angle");
          const hasInstructions =
            functionBody.includes("instructions.push") ||
            functionBody.includes("instructions.");

          // Consider implemented if:
          // 1. It uses distance function or calculates move distance
          // 2. It calculates turn angles
          // 3. It adds instructions to an array
          isPlaceholder = !(hasMoveDistance && hasTurnAngle && hasInstructions);
          break;

        case "drawPersonalArt":
          // Only consider unimplemented if it's just the example hexagon
          // and nothing else substantial
          isPlaceholder =
            (functionBody.includes("for (let i = 0; i < 6; i++)") &&
              functionBody.includes("turtle.turn(60)") &&
              !functionBody.includes("color(")) ||
            functionBody.trim().length < 50; // If it's very short, it's probably not meaningful
          break;

        default:
          // Fallback to simple check for other functions
          isPlaceholder =
            functionBody.includes("return 0") ||
            functionBody.includes("return [];") ||
            (functionBody.includes("// TODO") &&
              functionBody.trim().length < 50);
      }

      if (isPlaceholder) {
        functionStatus.push({
          name: func.name,
          implemented: false,
          points: func.pointsWorth,
        });
        totalPointsDeduction += func.pointsWorth;
      } else {
        functionStatus.push({
          name: func.name,
          implemented: true,
          points: 0,
        });
      }
    } else {
      // Function not found at all
      functionStatus.push({
        name: func.name,
        implemented: false,
        points: func.pointsWorth,
      });
      totalPointsDeduction += func.pointsWorth;
    }
  }

  // Cap the deduction at 25 points to ensure students get at least 5 points if they submitted something
  totalPointsDeduction = Math.min(totalPointsDeduction, 25);

  // Generate implementation summary
  const notImplemented = functionStatus
    .filter((func) => !func.implemented)
    .map((func) => func.name);
  const implementationSummary =
    notImplemented.length === 0
      ? "All functions implemented"
      : `Not implemented: ${notImplemented.join(", ")}`;

  return {
    functionStatus,
    totalPointsDeduction,
    implementationSummary,
  };
}
