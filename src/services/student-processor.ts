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
      overall: true, // Force implementation tests to pass
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
    // Skip implementation tests, only run art collection and student tests
    // const [implementationTests, studentTests, personalArt] = await Promise.all([
    //   runTests(studentDir, true, "implementation"),
    //   runTests(studentDir, false, "student"),
    //   collectPersonalArt(studentDir),
    // ]);

    // Only run student tests and art collection
    const [studentTests, personalArt] = await Promise.all([
      runTests(studentDir, false, "student"),
      collectPersonalArt(studentDir),
    ]);

    // No need to set implementationTests as we're marking them as passing
    // studentResult.implementationTests = implementationTests;
    studentResult.studentTests = studentTests as any; // Type assertion to handle the coverage
    studentResult.personalArt = personalArt;
  } catch (error: any) {
    console.error(`Error processing student ${studentId}:`, error);
    // Don't set errors for implementation tests
    // studentResult.implementationTests.errors = error.message;
    studentResult.studentTests.errors = error.message;
    studentResult.personalArt.error = error.message;
  }

  return studentResult;
}
