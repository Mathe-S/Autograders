import * as path from "path";
import {
  GradingReport,
  StudentResult,
  CoverageResult,
  ProcessedStudentResult,
  StudentSimilarityInfo,
} from "../types";
import * as fsUtils from "../utils/fs-utils";
import { SimilarityResult } from "../services/similarity/code-similarity";

/**
 * Determines if a student's personal art is unique compared to other students
 * @param studentId ID of the student to check
 * @param results All student results
 * @returns true if the art is unique, false otherwise
 */
function isPersonalArtUnique(
  studentId: string,
  results: StudentResult[]
): boolean {
  const thisStudentArt = results.find(
    (r) => r.studentId === studentId
  )?.personalArt;

  // If art is missing or has error, it's not considered unique
  if (!thisStudentArt || thisStudentArt.error) return false;

  // If there are no path data points, it's not unique
  if (thisStudentArt.pathData.length === 0) return false;

  // Compare this student's art with all others
  const otherStudents = results.filter((r) => r.studentId !== studentId);

  // Check for similarity based on path data length and pattern
  for (const otherStudent of otherStudents) {
    // Skip students with errors or missing art
    if (
      otherStudent.personalArt.error ||
      otherStudent.personalArt.pathData.length === 0
    ) {
      continue;
    }

    // First quick check: same number of path segments is suspicious
    if (
      otherStudent.personalArt.pathData.length ===
      thisStudentArt.pathData.length
    ) {
      // Deeper check: Compare actual path data
      // If at least 80% of the segments are identical or very similar, consider it non-unique
      let similarSegments = 0;

      for (let i = 0; i < thisStudentArt.pathData.length; i++) {
        const thisSegment = thisStudentArt.pathData[i];
        const otherSegment = otherStudent.personalArt.pathData[i];

        // Compare segment coordinates (allowing for small differences)
        const startPointSimilar =
          Math.abs(thisSegment.start.x - otherSegment.start.x) < 10 &&
          Math.abs(thisSegment.start.y - otherSegment.start.y) < 10;

        const endPointSimilar =
          Math.abs(thisSegment.end.x - otherSegment.end.x) < 10 &&
          Math.abs(thisSegment.end.y - otherSegment.end.y) < 10;

        if (startPointSimilar && endPointSimilar) {
          similarSegments++;
        }
      }

      // If 80% or more segments are similar, consider it non-unique
      const similarityPercentage =
        (similarSegments / thisStudentArt.pathData.length) * 100;
      if (similarityPercentage >= 80) {
        return false;
      }
    }
  }

  // If passed all checks, consider it unique
  return true;
}

/**
 * Generate a comprehensive grading report
 * @param results Array of student results
 * @param totalTime Total time taken for grading in milliseconds
 * @param highSimilarityPairs Optional array of high similarity pairs to include in the report
 * @returns Grading report object
 */
export function generateGradingReport(
  results: StudentResult[],
  totalTime: number,
  highSimilarityPairs?: SimilarityResult[]
): GradingReport {
  // Sort students by their ID
  const sortedResults = [...results].sort((a, b) =>
    a.studentId.localeCompare(b.studentId)
  );

  // Process each student to calculate their scores and status
  const students = sortedResults.map((result) => {
    let status: "passed" | "failed" | "errors" | "unknown" = "unknown";
    let notes: string[] = [];
    let points = 30; // Default to full points unless similarity issues are found

    // Since we're skipping implementation tests, everyone passes by default
    status = "passed";
    notes.push("Implementation tests skipped");

    // Student tests and personal art errors don't affect grading status or points
    if (result.studentTests.errors) {
      notes.push(`Student test errors: ${result.studentTests.errors}`);
    }

    if (result.personalArt.error) {
      notes.push(`Personal art errors: ${result.personalArt.error}`);
    }

    // Find similarity info for this student
    let similarityInfo: StudentSimilarityInfo | undefined = undefined;
    if (highSimilarityPairs) {
      // Find the highest similarity match for this student
      const highestSimilarity = highSimilarityPairs.find(
        (p) =>
          p.student1 === result.studentId || p.student2 === result.studentId
      );

      if (highestSimilarity && highestSimilarity.similarity >= 70) {
        const otherStudent =
          highestSimilarity.student1 === result.studentId
            ? highestSimilarity.student2
            : highestSimilarity.student1;

        similarityInfo = {
          otherStudent,
          similarity: highestSimilarity.similarity,
        };

        // Adjust points based on similarity criteria
        if (highestSimilarity.similarity === 100) {
          // Rule 1: 0 points if 100% similarity
          points = 0;
          notes.push(`0 points: 100% similarity with ${otherStudent}`);
        } else {
          // Check if personal art is unique
          const hasUniqueArt = isPersonalArtUnique(result.studentId, results);

          if (!hasUniqueArt) {
            // Rule 2: 25 points if drawPersonalArt is not unique
            points = 25;
            notes.push(`25 points: drawPersonalArt is not sufficiently unique`);
          } else {
            // Rule 3: Full 30 points for unique drawPersonalArt
            points = 30;
            notes.push(
              `30 points: All requirements met with unique drawPersonalArt`
            );
          }
        }
      } else {
        // No similarity concerns, so add note for full points
        notes.push(
          `30 points: No significant similarity detected with other submissions`
        );
      }
    }

    return {
      studentId: result.studentId,
      status,
      notes,
      implementationTests: result.implementationTests,
      studentTests: result.studentTests,
      personalArt: result.personalArt,
      similarityInfo,
      points,
    };
  });

  // Count students by status
  const statusCounts = {
    passed: students.length,
    failed: 0, // No failed status since we're skipping implementation tests
    errors: 0, // No errors status since we're skipping implementation tests
    unknown: 0, // No unknown status since we're skipping implementation tests
  };

  // Count students with high similarity
  const highSimilarityCount = students.filter(
    (s) => s.similarityInfo && s.similarityInfo.similarity >= 90
  ).length;

  // Calculate passing percentage
  const passingPercentage = Math.round(
    (statusCounts.passed / students.length) * 100
  );

  // Calculate average points
  const totalPoints = students.reduce(
    (sum, student) => sum + student.points,
    0
  );
  const averagePoints = Math.round((totalPoints / students.length) * 10) / 10;

  // Calculate average coverage
  const avgCoverage = calculateAverageCoverage(results);

  return {
    timestamp: new Date().toISOString(),
    totalStudents: students.length,
    statusCounts,
    passingPercentage,
    executionTimeSeconds: totalTime / 1000,
    averageCoverage: avgCoverage,
    students,
    highSimilarityCount,
    totalPoints,
    averagePoints,
  };
}

/**
 * Calculate average coverage metrics from student results
 * @param students Array of student results
 * @returns Average coverage metrics or undefined if no coverage data is available
 */
function calculateAverageCoverage(
  students: StudentResult[]
): CoverageResult | undefined {
  let totalLines = 0;
  let totalStatements = 0;
  let totalFunctions = 0;
  let totalBranches = 0;
  let coverageCount = 0;

  students.forEach((student) => {
    if (student.studentTests.coverage) {
      totalLines += student.studentTests.coverage.lines;
      totalStatements += student.studentTests.coverage.statements;
      totalFunctions += student.studentTests.coverage.functions;
      totalBranches += student.studentTests.coverage.branches;
      coverageCount++;
    }
  });

  if (coverageCount > 0) {
    return {
      lines: Math.round(totalLines / coverageCount),
      statements: Math.round(totalStatements / coverageCount),
      functions: Math.round(totalFunctions / coverageCount),
      branches: Math.round(totalBranches / coverageCount),
    };
  }

  return undefined;
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
        personalArt,
        implementationTests,
        studentTests,
        notes,
        ...essentialStudentInfo
      } = student;

      // Include notes that explain point assignments (not just deductions)
      const pointNotes = notes.filter((note) => note.includes("points:"));

      return {
        ...essentialStudentInfo,
        // Include point-related notes for all students
        ...(pointNotes.length > 0 ? { notes: pointNotes } : {}),
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

  // Add points summary
  console.log(
    `\nPoints Summary: Average ${report.averagePoints.toFixed(1)} / 30 points`
  );
  const perfectScores = report.students.filter((s) => s.points === 30).length;
  const partialScores = report.students.filter((s) => s.points === 25).length;
  const zeroScores = report.students.filter((s) => s.points === 0).length;
  console.log(`- ${perfectScores} students with full credit (30 points)`);
  console.log(`- ${partialScores} students with partial credit (25 points)`);
  console.log(`- ${zeroScores} students with no credit (0 points)`);

  if (report.averageCoverage) {
    console.log(
      `\nAverage Test Coverage: lines ${report.averageCoverage.lines}%, functions ${report.averageCoverage.functions}%, branches ${report.averageCoverage.branches}%, statements ${report.averageCoverage.statements}%`
    );
  }

  // Add similarity summary
  if (report.highSimilarityCount !== undefined) {
    console.log(
      `\nSimilarity Analysis: ${report.highSimilarityCount} students with very high similarity (≥90%)`
    );
  }

  console.log("\nSee detailed reports in the reports directory.");
}
