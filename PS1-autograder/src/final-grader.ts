import path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import * as fsUtils from "./utils/fs-utils";
import { GradingReport, ProcessedStudentResult } from "./types";
import {
  analyzeSimilarity,
  SimilarityReport,
} from "./services/similarity/code-similarity";
import {
  ReevaluationResult,
  reevaluateStudentSubmission,
} from "./services/llm-regrader";
import {
  saveGradingReport,
  printGradingSummary,
} from "./reporters/report-generator"; // Assuming these can be reused

const NEW_SUBMISSIONS_DIR = path.join(process.cwd(), "Submissions_auto");
const OLD_SUBMISSIONS_DIR = path.join(process.cwd(), "Submissions_auto_old");
const REPORTS_DIR = path.join(process.cwd(), "reports");
const SIMILARITY_THRESHOLD = 80; // Threshold for automatic 0 grade

/**
 * Finds the latest grading report JSON file in the reports directory.
 * @returns The path to the latest grading report file, or null if none found.
 */
async function findLatestGradingReport(): Promise<string | null> {
  try {
    const files = await fs.readdir(REPORTS_DIR);
    const reportFiles = files
      .filter(
        (file) => file.startsWith("grading-report-") && file.endsWith(".json")
      )
      .sort()
      .reverse(); // Sort descending to get latest first

    if (reportFiles.length === 0) {
      console.error("No previous grading reports found in", REPORTS_DIR);
      return null;
    }
    return path.join(REPORTS_DIR, reportFiles[0]);
  } catch (error) {
    console.error("Error reading reports directory:", error);
    return null;
  }
}

/**
 * Generates the final grading report structure.
 */
function generateFinalReport(
  previousReport: GradingReport,
  finalResults: ProcessedStudentResult[],
  executionTimeSeconds: number,
  similarityReport: SimilarityReport | null // Pass similarity report for context
): GradingReport {
  // Create a new report object, copying some base data from the previous one
  const finalReport: GradingReport = {
    timestamp: new Date().toISOString(),
    totalStudents: finalResults.length, // Only count students included in the final grade
    statusCounts: { passed: 0, failed: 0, errors: 0, unknown: 0 }, // Recalculate based on final results
    passingPercentage: 0,
    executionTimeSeconds: Math.round(executionTimeSeconds),
    averageCoverage: previousReport.averageCoverage, // Keep previous coverage average
    students: finalResults,
    highSimilarityCount: similarityReport?.highSimilarityPairs?.length ?? 0,
    totalPoints: 0, // Recalculate
    averagePoints: 0, // Recalculate
  };

  // Recalculate stats based on final results
  let totalPointsSum = 0;
  finalResults.forEach((student) => {
    // Assuming 'passed' status for all for now, adjust if failure conditions are added
    finalReport.statusCounts.passed++;
    totalPointsSum += student.totalPoints ?? 0;
  });

  if (finalResults.length > 0) {
    finalReport.passingPercentage = Math.round(
      (finalReport.statusCounts.passed / finalResults.length) * 100
    );
    finalReport.totalPoints = totalPointsSum;
    finalReport.averagePoints = Math.round(
      totalPointsSum / finalResults.length
    );
  }

  return finalReport;
}

/**
 * Runs the final grading process.
 */
export async function runFinalGrading(): Promise<void> {
  const totalStartTime = Date.now();
  console.log("Starting PS1 final grading process...");

  // 1. Find and load the previous grading report
  const previousReportPath = await findLatestGradingReport();
  if (!previousReportPath) {
    console.error("Cannot proceed without a previous grading report.");
    return;
  }
  console.log(`Loading previous report: ${previousReportPath}`);
  const previousReportContent = await fs.readFile(previousReportPath, "utf-8");
  const previousReport: GradingReport = JSON.parse(previousReportContent);
  const previousResultsMap = new Map(
    previousReport.students.map((s) => [s.studentId, s])
  );

  // 2. Discover students in new and old directories
  const newStudents = await fsUtils.discoverStudentSubmissions(
    NEW_SUBMISSIONS_DIR
  );
  const oldStudents = await fsUtils.discoverStudentSubmissions(
    OLD_SUBMISSIONS_DIR
  );

  // 3. Filter students: must be in new dir AND in previous report AND have old submission
  const studentsToGrade = newStudents.filter((studentId) => {
    const isInPreviousReport = previousResultsMap.has(studentId);
    const hasOldSubmission = oldStudents.includes(studentId);
    if (!isInPreviousReport) {
      console.warn(
        `Skipping ${studentId}: Not found in previous report ${path.basename(
          previousReportPath
        )}.`
      );
    }
    if (!hasOldSubmission) {
      console.warn(
        `Skipping ${studentId}: Old submission not found in ${OLD_SUBMISSIONS_DIR}.`
      );
    }
    return isInPreviousReport && hasOldSubmission;
  });

  if (studentsToGrade.length === 0) {
    console.log(
      "No students eligible for final grading (check directories and previous report)."
    );
    return;
  }
  console.log(
    `Found ${studentsToGrade.length} students eligible for final grading.`
  );

  // 4. Run similarity analysis on NEW submissions for the filtered students
  console.log(
    `Running similarity analysis on ${studentsToGrade.length} new submissions...`
  );
  const similarityReport = await analyzeSimilarity(
    NEW_SUBMISSIONS_DIR, // Analyze the NEW submissions
    studentsToGrade,
    SIMILARITY_THRESHOLD
  );
  // Create a map for easy lookup of similarity pairs involving a student
  const highSimilarityMap = new Map<
    string,
    { otherStudent: string; similarity: number }
  >();
  (similarityReport.highSimilarityPairs ?? []).forEach((pair) => {
    highSimilarityMap.set(pair.student1, {
      otherStudent: pair.student2,
      similarity: pair.similarity,
    });
    highSimilarityMap.set(pair.student2, {
      otherStudent: pair.student1,
      similarity: pair.similarity,
    });
  });

  // 5. Process students for final grade
  console.log(
    `Processing ${studentsToGrade.length} students for final grades...`
  );
  const finalResults: ProcessedStudentResult[] = [];
  const concurrencyLimit = Math.max(1, os.cpus().length - 1);
  const totalBatches = Math.ceil(studentsToGrade.length / concurrencyLimit);

  for (let i = 0; i < studentsToGrade.length; i += concurrencyLimit) {
    const batchNum = Math.floor(i / concurrencyLimit) + 1;
    console.log(`Processing batch ${batchNum}/${totalBatches}...`);
    const batch = studentsToGrade.slice(i, i + concurrencyLimit);

    const batchResultsPromises = batch.map(
      async (studentId): Promise<ProcessedStudentResult | null> => {
        const previousResult = previousResultsMap.get(studentId)!;
        const similarityInfo = highSimilarityMap.get(studentId);

        // Add new fields to the result type definition if not already present
        interface FinalProcessedStudentResult extends ProcessedStudentResult {
          finalGradingExplanation?: string;
        }

        let finalResult: FinalProcessedStudentResult = { ...previousResult }; // Start with previous data

        // Check for high similarity
        if (
          similarityInfo &&
          similarityInfo.similarity >= SIMILARITY_THRESHOLD
        ) {
          console.warn(
            `ACADEMIC INTEGRITY ALERT: ${studentId} has high similarity (${similarityInfo.similarity}%) with ${similarityInfo.otherStudent}. Awarding 0 points.`
          );
          finalResult.totalPoints = 0;
          finalResult.notes.push(
            `ACADEMIC INTEGRITY ALERT: High similarity (${similarityInfo.similarity}%) detected with ${similarityInfo.otherStudent}. Final score adjusted to 0.`
          );
          // Keep other previous details as requested
        } else {
          // Re-evaluate using LLM
          try {
            const reevaluation = await reevaluateStudentSubmission(
              studentId,
              previousResult,
              OLD_SUBMISSIONS_DIR,
              NEW_SUBMISSIONS_DIR
            );

            if (reevaluation) {
              finalResult.totalPoints = reevaluation.finalTotalPoints;
              finalResult.finalGradingExplanation =
                reevaluation.finalGradingExplanation;
            } else {
              console.error(
                `Re-evaluation failed for ${studentId}, keeping previous score.`
              );
              // Keep previous totalPoints, maybe add a note?
              finalResult.notes.push(
                "NOTE: LLM re-evaluation failed. Final score is based on the previous report."
              );
            }
          } catch (error) {
            console.error(
              `Error during re-evaluation for ${studentId}:`,
              error
            );
            finalResult.notes.push(
              `ERROR: An error occurred during LLM re-evaluation. Final score is based on the previous report.`
            );
            // Keep previous totalPoints
          }
        }
        return finalResult;
      }
    );

    const processedBatch = await Promise.all(batchResultsPromises);
    finalResults.push(
      ...(processedBatch.filter((r) => r !== null) as ProcessedStudentResult[])
    );
  }

  // 6. Generate and save final report
  const finalGradingEndTime = Date.now();
  const finalGradingTimeSeconds = (finalGradingEndTime - totalStartTime) / 1000;

  const finalReport = generateFinalReport(
    previousReport,
    finalResults,
    finalGradingTimeSeconds,
    similarityReport
  );

  // Save the report - saveGradingReport generates the filename internally
  // const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  // const reportFilename = `final-grading-report-${timestamp}.json`;
  // const reportPath = path.join(REPORTS_DIR, reportFilename);

  // Pass the desired filename prefix to the save function (or modify save function)
  // For now, assume saveGradingReport handles the filename
  const reportPath = await saveGradingReport(finalReport); // Pass only the report object

  // 7. Print summary
  console.log("\n--- Final Grading Summary ---");
  printGradingSummary(finalReport); // Use existing print function

  console.log(
    `\nFinal grading process completed in ${finalGradingTimeSeconds.toFixed(
      1
    )}s`
  );
  console.log(`Final report saved to: ${reportPath}`);
}
