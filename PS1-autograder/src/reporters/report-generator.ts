import { FunctionImplementationStatus } from "../types";
import { CoverageResult, StatusCounts } from "../types";
import { ProcessedStudentResult } from "../types";
import { SimilarityResult } from "../services/similarity/code-similarity";
import { GradingReport, StudentResult } from "../types";
import path from "path";
import * as fsUtils from "../utils/fs-utils";
/**
 * Generate a complete grading report from student results
 * @param results Array of student results
 * @param executionTime Time taken to execute the grading in milliseconds
 * @returns Grading report object
 */
export function generateGradingReport(
  results: StudentResult[],
  executionTime: number,
  highSimilarityPairs?: SimilarityResult[]
): GradingReport {
  // Create processed results with status and points
  const processedResults: ProcessedStudentResult[] = results.map((result) => {
    // Set status to passed by default, we're looking for function implementations rather than pass/fail
    const status = "passed";

    // Calculate points: 30 points maximum - deduction for unimplemented functions
    const points = Math.max(
      0,
      30 - result.implementationStatus.totalPointsDeduction
    );

    // Generate notes array based on implementation status and errors
    const notes: string[] = [];

    // Add note about implementation status
    if (
      result.implementationStatus.functionStatus.some((f) => !f.implemented)
    ) {
      const deduction = result.implementationStatus.totalPointsDeduction;
      notes.push(
        `${result.implementationStatus.implementationSummary} (${deduction} points deducted)`
      );
    } else {
      notes.push("All functions implemented correctly");
    }

    // Add note if default implementations were detected
    const defaultFunctionCount =
      result.implementationStatus.functionStatus.filter(
        (f) => f.isDefaultImplementation
      ).length;

    if (defaultFunctionCount > 0) {
      const defaultFunctions = result.implementationStatus.functionStatus
        .filter((f) => f.isDefaultImplementation)
        .map((f) => f.name);

      if (defaultFunctionCount >= 5) {
        notes.push(
          `WARNING: Student submitted instructor's default file with little to no changes. The following functions appear unchanged: ${defaultFunctions.join(
            ", "
          )}. (30 points deducted)`
        );
      } else {
        notes.push(
          `Default implementations detected: ${defaultFunctions.join(
            ", "
          )}. These functions were not modified from the starter code. (${
            defaultFunctionCount * 5
          } points deducted)`
        );
      }
    }

    // Add LLM grading results if available
    let totalPoints = points;
    if (result.manualGradingResult) {
      const manualResult = result.manualGradingResult;

      // Add notes about manual grading
      notes.push(
        `Lecturer's grading of computeProgress: ${manualResult.computeProgressScore}/10 points`
      );

      // Add strengths identified
      if (manualResult.strengths && manualResult.strengths.length > 0) {
        notes.push(`Strengths: ${manualResult.strengths.join(", ")}`);
      }

      // Add areas for improvement
      if (manualResult.weaknesses && manualResult.weaknesses.length > 0) {
        notes.push(
          `Areas for improvement: ${manualResult.weaknesses.join(", ")}`
        );
      }

      // Add detailed feedback
      notes.push(`Personalized feedback: ${manualResult.feedback}`);

      // Calculate total points including manual score
      // The implementation gets 30 points max, and manual grading adds up to 10 additional points
      totalPoints = points + manualResult.computeProgressScore;
    }

    // Add test errors if any
    if (result.implementationTests.errors) {
      notes.push(
        `Error in implementation tests: ${result.implementationTests.errors}`
      );
    }
    if (result.studentTests.errors) {
      notes.push(`Error in student tests: ${result.studentTests.errors}`);
    }

    const processedResult: ProcessedStudentResult = {
      studentId: result.studentId,
      status,
      notes,
      implementationTests: result.implementationTests,
      studentTests: result.studentTests,
      implementationStatus: result.implementationStatus,
      points, // Original points (0-30)
      manualGradingResult: result.manualGradingResult,
      totalPoints, // Combined points (0-40)
    };

    return processedResult;
  });

  // Calculate coverage statistics if available
  const coverageResults = processedResults
    .map((r) => r.studentTests.coverage)
    .filter((c): c is CoverageResult => !!c);

  let averageCoverage: CoverageResult | undefined = undefined;
  if (coverageResults.length > 0) {
    averageCoverage = {
      lines: Math.round(
        coverageResults.reduce((sum, c) => sum + c.lines, 0) /
          coverageResults.length
      ),
      statements: Math.round(
        coverageResults.reduce((sum, c) => sum + c.statements, 0) /
          coverageResults.length
      ),
      functions: Math.round(
        coverageResults.reduce((sum, c) => sum + c.functions, 0) /
          coverageResults.length
      ),
      branches: Math.round(
        coverageResults.reduce((sum, c) => sum + c.branches, 0) /
          coverageResults.length
      ),
    };
  }

  // Calculate status counts
  const statusCounts: StatusCounts = {
    passed: processedResults.filter((r) => r.status === "passed").length,
    failed: 0, // Not using failed status anymore
    errors: 0, // Not using error status anymore
    unknown: 0, // Not using unknown status anymore
  };

  // Calculate points
  const totalPoints = processedResults.reduce(
    (sum, r) => sum + (r.totalPoints || r.points),
    0
  );
  const averagePoints = Math.round(
    totalPoints / (processedResults.length || 1)
  );

  // Add similarity info if provided
  if (highSimilarityPairs && highSimilarityPairs.length > 0) {
    // Find highest similarity per student
    const studentSimilarities =
      findHighestSimilaritiesPerStudent(highSimilarityPairs);

    // Track high-similarity students that need all points deducted (similarity >= 95%)
    const highSimilarityViolations = new Set<string>();

    // First pass: identify all students with similarity >= 95%
    for (const pair of highSimilarityPairs) {
      if (pair.similarity >= 95) {
        highSimilarityViolations.add(pair.student1);
        highSimilarityViolations.add(pair.student2);
      }
    }

    // Add to processed results
    for (const result of processedResults) {
      const similarity = studentSimilarities.get(result.studentId);

      // Check if this student is in the high similarity violations set
      if (highSimilarityViolations.has(result.studentId)) {
        result.notes.push(
          `ACADEMIC INTEGRITY ALERT: Extremely high similarity (≥95%) detected with another student. All points deducted.`
        );
        // Deduct all points for extremely high similarity
        result.totalPoints = 0;
      }

      if (similarity) {
        result.similarityInfo = {
          otherStudent: similarity.otherStudent,
          similarity: similarity.similarity,
        };

        // Add note about high similarity and handle penalties
        if (similarity.similarity >= 95) {
          result.notes.push(
            `ACADEMIC INTEGRITY ALERT: Very high similarity (${similarity.similarity}%) with ${similarity.otherStudent}. All points deducted.`
          );
          // Deduct all points for extremely high similarity
          result.totalPoints = 0;
        } else if (similarity.similarity >= 90) {
          result.notes.push(
            `ALERT: Very high similarity (${similarity.similarity}%) with ${similarity.otherStudent}.`
          );
        } else if (similarity.similarity >= 80) {
          result.notes.push(
            `Note: High similarity (${similarity.similarity}%) with ${similarity.otherStudent}. May be coincidental.`
          );
        }
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalStudents: processedResults.length,
    statusCounts,
    passingPercentage: Math.round(
      (statusCounts.passed / processedResults.length) * 100
    ),
    executionTimeSeconds: Math.round(executionTime / 1000),
    averageCoverage,
    students: processedResults.sort((a, b) =>
      a.studentId.localeCompare(b.studentId)
    ),
    highSimilarityCount: highSimilarityPairs?.length || 0,
    totalPoints,
    averagePoints,
  };
}

/**
 * Helper function to find the highest similarity for each student
 * @param similarityPairs Array of similarity results
 * @returns Map of student IDs to their highest similarity matches
 */
function findHighestSimilaritiesPerStudent(
  similarityPairs: SimilarityResult[]
): Map<string, { otherStudent: string; similarity: number }> {
  const result = new Map<
    string,
    { otherStudent: string; similarity: number }
  >();

  // Get all unique student IDs from the similarity pairs
  const studentIds = new Set<string>();
  for (const pair of similarityPairs) {
    studentIds.add(pair.student1);
    studentIds.add(pair.student2);
  }

  // For each student, find their highest similarity match
  for (const studentId of studentIds) {
    // Find all pairs containing this student
    const relevantPairs = similarityPairs.filter(
      (p) => p.student1 === studentId || p.student2 === studentId
    );

    if (relevantPairs.length === 0) continue;

    // Sort by similarity (highest first)
    relevantPairs.sort((a, b) => b.similarity - a.similarity);

    // Get the highest similarity pair
    const highestPair = relevantPairs[0];

    // Determine the other student in the pair
    const otherStudent =
      highestPair.student1 === studentId
        ? highestPair.student2
        : highestPair.student1;

    // Store the result
    result.set(studentId, {
      otherStudent,
      similarity: highestPair.similarity,
    });
  }

  return result;
}

/**
 * Save the grading report to the file system
 * @param report Grading report to save
 * @returns Path to the saved report
 */
export async function saveGradingReport(
  report: GradingReport
): Promise<string> {
  const outputDir = path.join(process.cwd(), "reports");

  // Create directory if it doesn't exist - using fsUtils
  try {
    await fsUtils.createTempDirectory(process.cwd(), "reports");
  } catch (error) {
    // Directory might already exist
  }

  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
  const filename = `grading-report-${timestamp}.json`;
  const outputPath = path.join(outputDir, filename);

  // Create a streamlined version of the report with minimal data
  const serializableReport = {
    ...report,
    students: report.students.map((student) => {
      // Only include necessary fields, omit personalArt, implementationTests, and studentTests
      const {
        implementationTests,
        studentTests,
        notes,
        ...essentialStudentInfo
      } = student;

      // Keep important notes: point assignments, deductions, academic integrity, warnings
      const importantNotes = notes.filter(
        (note) =>
          note.includes("points:") ||
          note.includes("deduct") ||
          note.includes("ACADEMIC INTEGRITY") ||
          note.includes("WARNING") ||
          note.includes("Default implementations") ||
          note.includes("functions not implemented") ||
          note.includes("implemented") ||
          student.points < 30 // Always include notes for students with less than full points
      );

      // Add a clear summary note if points were deducted
      if (student.points < 30) {
        const deduction = 30 - student.points;
        const hasDeductionNote = importantNotes.some(
          (note) =>
            note.includes("deduct") || note.includes("ACADEMIC INTEGRITY")
        );

        if (!hasDeductionNote) {
          // Check if the implementation status has notes about missing functions
          const missingFunctions = student.implementationStatus.functionStatus
            .filter((f) => !f.implemented)
            .map((f) => f.name);

          if (missingFunctions.length > 0) {
            importantNotes.push(
              `Implementation issue: Missing or incorrect implementation of ${missingFunctions.join(
                ", "
              )} (${deduction} points deducted)`
            );
          } else {
            importantNotes.push(
              `Point summary: ${deduction} points deducted (final score: ${student.points}/30)`
            );
          }
        }
      }

      return {
        ...essentialStudentInfo,
        // Include all relevant notes for all students
        notes: importantNotes,
      };
    }),
  };

  // Use fsUtils instead of direct fs operation
  await fsUtils.writeFile(
    outputPath,
    JSON.stringify(serializableReport, null, 2)
  );
  console.log(`Grading report saved to: ${outputPath}`);

  return outputPath;
}

/**
 * Print summary statistics from grading report
 * @param report Grading report to summarize
 */
export function printGradingSummary(report: GradingReport): void {
  console.log("\n=== Grading Summary ===");
  console.log(
    `Total Students: ${report.totalStudents} (${report.passingPercentage}% passing)`
  );
  console.log(
    `Status Breakdown: ${report.statusCounts.passed} passed, ${report.statusCounts.failed} failed, ${report.statusCounts.errors} errors`
  );
  console.log(`Execution Time: ${report.executionTimeSeconds.toFixed(1)}s`);

  // Count which functions most students couldn't implement
  const functionCounts: Record<string, number> = {};
  for (const student of report.students) {
    for (const func of student.implementationStatus.functionStatus) {
      if (!func.implemented) {
        functionCounts[func.name] = (functionCounts[func.name] || 0) + 1;
      }
    }
  }

  console.log("\nFunction Implementation Stats:");
  if (Object.keys(functionCounts).length === 0) {
    console.log("- All students implemented all functions");
  } else {
    console.log("Functions not implemented by # of students:");
    for (const [funcName, count] of Object.entries(functionCounts).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(
        `- ${funcName}: ${count} students (${Math.round(
          (count / report.totalStudents) * 100
        )}%)`
      );
    }
  }

  // Count students by point ranges
  const fullCreditCount = report.students.filter(
    (s) => (s.totalPoints || s.points) === 40
  ).length;
  const partialCreditCount = report.students.filter(
    (s) => (s.totalPoints || s.points) > 0 && (s.totalPoints || s.points) < 40
  ).length;
  const noCreditCount = report.students.filter(
    (s) => (s.totalPoints || s.points) === 0
  ).length;

  console.log(
    `\nPoints Summary: Average ${report.averagePoints.toFixed(1)} / 40 points`
  );
  console.log(`- ${fullCreditCount} students with full credit (40 points)`);
  console.log(
    `- ${partialCreditCount} students with partial credit (1-39 points)`
  );
  console.log(`- ${noCreditCount} students with no credit (0 points)`);

  // Check if any students got no credit due to high similarity
  if (report.highSimilarityCount) {
    const zeroPointsDueToSimilarity = report.students.filter(
      (s) =>
        (s.totalPoints || s.points) === 0 &&
        s.notes.some((note) => note.includes("ACADEMIC INTEGRITY ALERT"))
    ).length;
    console.log(
      `  (${zeroPointsDueToSimilarity} of these due to very high similarity)`
    );
  }

  // Print manual grading stats if available
  const studentsWithManualGrading = report.students.filter(
    (s) => s.manualGradingResult
  ).length;
  if (studentsWithManualGrading > 0) {
    console.log("\nPersonalized Grading Results:");

    // Calculate average manual scores
    const totalComputeProgressScore = report.students.reduce(
      (sum, s) => sum + (s.manualGradingResult?.computeProgressScore || 0),
      0
    );
    const avgComputeProgressScore =
      totalComputeProgressScore / studentsWithManualGrading;

    console.log(
      `- Average computeProgress score: ${avgComputeProgressScore.toFixed(
        1
      )}/10 points`
    );
    console.log(
      `- ${studentsWithManualGrading} students received personalized feedback (${Math.round(
        (studentsWithManualGrading / report.totalStudents) * 100
      )}% of total)`
    );

    // Most common strengths and weaknesses
    const allStrengths: string[] = [];
    const allWeaknesses: string[] = [];

    report.students.forEach((s) => {
      if (s.manualGradingResult?.strengths) {
        allStrengths.push(...s.manualGradingResult.strengths);
      }
      if (s.manualGradingResult?.weaknesses) {
        allWeaknesses.push(...s.manualGradingResult.weaknesses);
      }
    });

    const strengthCounts: Record<string, number> = {};
    const weaknessCounts: Record<string, number> = {};

    allStrengths.forEach((s) => {
      strengthCounts[s] = (strengthCounts[s] || 0) + 1;
    });

    allWeaknesses.forEach((w) => {
      weaknessCounts[w] = (weaknessCounts[w] || 0) + 1;
    });

    // Display top 3 strengths and weaknesses
    const topStrengths = Object.entries(strengthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const topWeaknesses = Object.entries(weaknessCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topStrengths.length > 0) {
      console.log("\nTop strengths identified by instructors:");
      topStrengths.forEach(([strength, count]) => {
        console.log(`- ${strength} (${count} students)`);
      });
    }

    if (topWeaknesses.length > 0) {
      console.log("\nTop areas for improvement identified by instructors:");
      topWeaknesses.forEach(([weakness, count]) => {
        console.log(`- ${weakness} (${count} students)`);
      });
    }
  }

  if (report.averageCoverage) {
    console.log(
      `\nAverage Test Coverage: lines ${report.averageCoverage.lines}%, functions ${report.averageCoverage.functions}%, branches ${report.averageCoverage.branches}%, statements ${report.averageCoverage.statements}%`
    );
  }

  if (report.highSimilarityCount !== undefined) {
    console.log(
      `\nSimilarity Analysis: ${report.highSimilarityCount} high similarity pairs detected`
    );
  }

  console.log("\nSee detailed reports in the reports directory.");
}
