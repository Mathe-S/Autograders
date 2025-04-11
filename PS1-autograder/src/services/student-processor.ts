import path from "path";
import { ImplementationStatus, StudentResult } from "../types";
import { runTests } from "./test-runner";
import { generateManualGrading } from "./llm-grader";

const FUNCTIONS_TO_CHECK = [
  "toBucketSets",
  "getBucketRange",
  "practice",
  "update",
  "getHint",
];

/**
 * Process a single student
 * @param studentId Student identifier
 * @param submissionsDir Directory containing all submissions
 * @param enableLLM Whether to use LLM grading (default: false)
 * @returns Student grading results
 */
export async function processStudent(
  studentId: string,
  submissionsDir: string,
  enableLLM: boolean = false
): Promise<StudentResult> {
  const studentDir = path.join(submissionsDir, studentId);

  console.log(`Processing student ${studentId} in directory ${studentDir}`);

  // Initialize student result
  const studentResult: StudentResult = {
    studentId,
    implementationTests: {
      overall: false,
      details: {},
    },
    studentTests: {
      overall: false,
      details: {},
    },
    implementationStatus: {
      functionStatus: [],
      totalPointsDeduction: 0,
      implementationSummary: "",
    },
  };

  try {
    // Run the implementation tests to check which functions actually work
    // Run student tests, collect personal art
    const [implementationTests, studentTests] = await Promise.all([
      runTests(studentDir, true, "implementation"),
      runTests(studentDir, false, "student"),
    ]);

    // Update the student result with the test results
    studentResult.implementationTests = implementationTests;
    studentResult.studentTests = studentTests as any; // Type assertion to handle the coverage

    // Determine implementation status based on test results
    const implementationStatus =
      generateImplementationStatus(implementationTests);
    studentResult.implementationStatus = implementationStatus;

    // Use LLM to generate personalized "manual" grading if enabled
    if (enableLLM) {
      console.log(
        `Generating manual grading for ${studentId}'s computeProgress function...`
      );
      try {
        const manualGradingResult = await generateManualGrading(
          studentId,
          submissionsDir
        );
        studentResult.manualGradingResult = manualGradingResult;
        console.log(
          `Manual grading complete for ${studentId}: ${manualGradingResult.computeProgressScore}/10`
        );
      } catch (llmError: any) {
        console.error(
          `Error during manual grading for ${studentId}:`,
          llmError
        );
        // Don't let grading errors affect the rest of the process
      }
    }

    // Note: Default implementations will be marked separately by the similarity checker
  } catch (error: any) {
    console.error(`Error processing student ${studentId}:`, error);
    studentResult.implementationTests.errors = error.message;
    studentResult.studentTests.errors = error.message;
    studentResult.implementationStatus = {
      functionStatus: [],
      totalPointsDeduction: 0,
      implementationSummary: `Error checking implementations: ${error.message}`,
    };
  }

  return studentResult;
}

/**
 * Generate implementation status based on test results
 * @param testResult The implementation test result
 * @returns Implementation status with points deduction
 */
function generateImplementationStatus(testResult: {
  overall: boolean;
  details: { [testName: string]: boolean };
  errors?: string;
}): ImplementationStatus {
  // Define the functions to check and points to deduct per function
  const functionsToCheck = FUNCTIONS_TO_CHECK.map((func) => ({
    name: func,
    pointsWorth: 5,
  }));

  let totalPointsDeduction = 0;
  const functionStatus: {
    name: string;
    implemented: boolean;
    points: number;
    isDefaultImplementation?: boolean;
  }[] = [];

  // Create a map of test results by function
  const testResultByFunction: Record<string, boolean> = {};

  // Process test details to determine which functions pass
  Object.entries(testResult.details).forEach(([testTitle, passed]) => {
    // Extract function name from test title
    // Test titles follow the format "functionName description..."
    const functionMatch = /^(\w+)/.exec(testTitle);
    if (functionMatch) {
      const functionName = functionMatch[1];
      // If any test for a function passes, consider it implemented
      if (passed) {
        testResultByFunction[functionName] = true;
      } else if (testResultByFunction[functionName] !== true) {
        // Only set to false if not already set to true by another test
        testResultByFunction[functionName] = false;
      }
    }
  });

  // For each function, check if it's implemented based on test results
  for (const func of functionsToCheck) {
    // Check if we have test results for this function
    const testExists = Object.keys(testResult.details).some((testName) =>
      testName.startsWith(func.name)
    );

    let isImplemented = testResultByFunction[func.name] === true;

    // Additional check for beqakikutadze@gmail.com and other edge cases
    // If there's no matching test but the function name is in the test results details,
    // check if there's at least one passing test with this prefix
    if (!isImplemented && testExists) {
      // Manual check for any passing test with this function name prefix
      isImplemented = Object.entries(testResult.details).some(
        ([testName, passed]) => testName.startsWith(func.name) && passed
      );
    }

    if (!isImplemented) {
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
