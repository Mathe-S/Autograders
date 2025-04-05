import * as path from "path";
import { StudentResult } from "../types";
import { runTests } from "./test-runner";
import { collectPersonalArt } from "./art-collector";

/**
 * Process a single student
 * @param studentId Student identifier
 * @param submissionsDir Directory containing all submissions
 * @returns Student grading results
 */
export async function processStudent(
  studentId: string,
  submissionsDir: string
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
    personalArt: {
      pathData: [],
    },
  };

  try {
    // Run all tests and art collection in parallel with separate directories
    const [implementationTests, studentTests, personalArt] = await Promise.all([
      runTests(studentDir, true, "implementation"),
      runTests(studentDir, false, "student"),
      collectPersonalArt(studentDir),
    ]);

    studentResult.implementationTests = implementationTests;
    studentResult.studentTests = studentTests as any; // Type assertion to handle the coverage
    studentResult.personalArt = personalArt;
  } catch (error: any) {
    console.error(`Error processing student ${studentId}:`, error);
    studentResult.implementationTests.errors = error.message;
    studentResult.studentTests.errors = error.message;
    studentResult.personalArt.error = error.message;
  }

  return studentResult;
}
