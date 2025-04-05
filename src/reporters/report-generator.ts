import * as path from "path";
import { GradingReport, StudentResult, CoverageResult } from "../types";
import * as fsUtils from "../utils/fs-utils";

/**
 * Generate a grading report from student results
 * @param results Array of student results
 * @param totalTime Total time taken for grading in milliseconds
 * @returns Complete grading report
 */
export function generateGradingReport(
  results: StudentResult[],
  totalTime: number
): GradingReport {
  // Prepare the grading report
  const gradingReport: GradingReport = {
    timestamp: new Date().toISOString(),
    students: [],
    summary: {
      totalStudents: results.length,
      passedImplementationTests: 0,
      passedStudentTests: 0,
      personalArtGenerationSuccess: 0,
    },
    timingInfo: {
      totalTime,
      studentTimes: {},
    },
  };

  // Add results to the grading report
  results.forEach((result) => {
    gradingReport.students.push(result);

    // Update summary statistics
    if (result.implementationTests.overall) {
      gradingReport.summary.passedImplementationTests++;
    }
    if (result.studentTests.overall) {
      gradingReport.summary.passedStudentTests++;
    }
    if (!result.personalArt.error) {
      gradingReport.summary.personalArtGenerationSuccess++;
    }
  });

  // Calculate average coverage metrics
  const averageCoverage = calculateAverageCoverage(results);
  if (averageCoverage) {
    gradingReport.summary.averageCoverage = averageCoverage;
  }

  return gradingReport;
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
 * Save the grading report to a JSON file
 * @param report The grading report to save
 * @param outputPath The path to save the report to (optional, defaults to grading_report.json in cwd)
 */
export async function saveGradingReport(
  report: GradingReport,
  outputPath?: string
): Promise<string> {
  // Create a simplified grading report without personalArt
  const simplifiedReport = {
    timestamp: report.timestamp,
    students: report.students.map((student) => ({
      studentId: student.studentId,
      implementationTests: student.implementationTests,
      studentTests: student.studentTests,
    })),
    summary: report.summary,
    timingInfo: report.timingInfo,
  };

  // Save grading report
  const reportPath =
    outputPath || path.join(process.cwd(), "grading_report.json");
  await fsUtils.writeFile(
    reportPath,
    JSON.stringify(simplifiedReport, null, 2)
  );

  console.log(`Grading report saved to ${reportPath}`);
  return reportPath;
}

/**
 * Print a summary of the grading report to the console
 * @param report The grading report to summarize
 */
export function printGradingSummary(report: GradingReport): void {
  console.log("\nGrading Summary:");
  console.log(`Total Students: ${report.summary.totalStudents}`);
  console.log(
    `Passed Instructor Tests: ${report.summary.passedImplementationTests}/${report.summary.totalStudents}`
  );
  console.log(
    `Passed Own Tests: ${report.summary.passedStudentTests}/${report.summary.totalStudents}`
  );
  console.log(
    `Successful Art Generation: ${report.summary.personalArtGenerationSuccess}/${report.summary.totalStudents}`
  );

  // Print coverage summary if available
  if (report.summary.averageCoverage) {
    console.log("\nAverage Test Coverage:");
    console.log(`Lines: ${report.summary.averageCoverage.lines}%`);
    console.log(`Statements: ${report.summary.averageCoverage.statements}%`);
    console.log(`Functions: ${report.summary.averageCoverage.functions}%`);
    console.log(`Branches: ${report.summary.averageCoverage.branches}%`);
  }

  if (report.timingInfo) {
    const totalMinutes = (report.timingInfo.totalTime / 1000 / 60).toFixed(2);
    console.log(`\nTotal time: ${totalMinutes} minutes`);
  }
}
