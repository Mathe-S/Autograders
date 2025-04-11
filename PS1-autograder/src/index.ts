import path from "path";
import * as os from "os";
import { defineSimilarityThreshold } from "./utils/define-similarity-threshold";
import * as fsUtils from "./utils/fs-utils";
import { analyzeSimilarity } from "./services/similarity/code-similarity";
import {
  generateSimilarityHtml,
  printSimilaritySummary,
  saveSimilarityReport,
} from "./reporters/similarity-reporter";
import { StudentResult } from "./types";
import { exec } from "child_process";
import { processStudent } from "./services/student-processor";
import {
  generateGradingReport,
  printGradingSummary,
  saveGradingReport,
} from "./reporters/report-generator";

// const SUBMISSIONS_DIR = path.join(process.cwd(), "Submissions_auto");
const SUBMISSIONS_DIR = path.join(process.cwd(), "submissions");

async function openHTML(filename?: string): Promise<void> {
  if (!filename) {
    console.warn("No filename provided to openHTML");
    return;
  }

  // Use the appropriate command based on the OS
  const cmd =
    process.platform === "win32"
      ? `start ${filename}`
      : process.platform === "darwin"
      ? `open ${filename}`
      : `xdg-open ${filename}`;

  try {
    console.log("Opening HTML report in default browser...");
    // Execute the command to open the file in the default browser
    exec(cmd);
    console.log(`Opened ${filename} in default browser`);
  } catch (e) {
    console.error(`Failed to open ${filename}:`, e);
  }
}

/**
 * Analyze code similarity between students
 * @param similarityThreshold Threshold percentage for considering submissions similar (default: 80)
 */
export async function runSimilarityAnalysis(
  similarityThreshold: number = 80
): Promise<void> {
  console.log("Starting PS1 code similarity analysis...");

  // Discover student submissions
  const students = await fsUtils.discoverStudentSubmissions(SUBMISSIONS_DIR);

  // Analyze similarity between all students
  const similarityReport = await analyzeSimilarity(
    SUBMISSIONS_DIR,
    students,
    similarityThreshold
  );

  // Generate and save similarity report
  const htmlReport = generateSimilarityHtml(similarityReport);
  const reportPath = await saveSimilarityReport(htmlReport);

  // Print summary to console
  printSimilaritySummary(similarityReport);

  // Import instructor functions to open HTML
  await openHTML(reportPath);
}

/**
 * Main autograder function
 * @param targetStudent Optional student ID to grade only that specific student
 */
export async function runAutograder(targetStudent?: string): Promise<void> {
  const totalStartTime = Date.now();
  console.log("Starting PS1 autograder...");

  // Discover student submissions
  let students = await fsUtils.discoverStudentSubmissions(SUBMISSIONS_DIR);

  // Filter for specific student if provided
  if (targetStudent) {
    const targetStudents = targetStudent.split(",").map((s) => s.trim());
    const notFound: string[] = [];

    // Check if all specified students exist
    for (const student of targetStudents) {
      if (!students.includes(student)) {
        notFound.push(student);
      }
    }

    // If any student isn't found, show error and exit
    if (notFound.length > 0) {
      console.error(
        `Error: Student(s) not found in submissions directory: ${notFound.join(
          ", "
        )}`
      );
      console.log(`Available students: ${students.join(", ")}`);
      return;
    }

    // Filter to just the requested students
    students = students.filter((s) => targetStudents.includes(s));
    console.log(
      `Grading ${students.length} specific students: ${students.join(", ")}`
    );
  }

  // Process students in parallel with progress logging
  console.log(`Processing ${students.length} students in parallel...`);

  // Use available CPU cores for parallel processing
  const concurrencyLimit = Math.max(1, os.cpus().length - 1); // Leave one core free
  console.log(`Using ${concurrencyLimit} parallel processes`);

  // Process all students in batches
  const results: StudentResult[] = [];
  const totalBatches = Math.ceil(students.length / concurrencyLimit);

  for (let i = 0; i < students.length; i += concurrencyLimit) {
    const batchNum = Math.floor(i / concurrencyLimit) + 1;
    console.log(
      `Processing batch ${batchNum}/${totalBatches} (${Math.min(
        concurrencyLimit,
        students.length - i
      )} students)`
    );

    const batch = students.slice(i, i + concurrencyLimit);
    const batchStartTime = Date.now();

    // Process all students in this batch concurrently
    const batchResults = await Promise.all(
      batch.map((studentId) => processStudent(studentId, SUBMISSIONS_DIR))
    );

    results.push(...batchResults);

    const batchEndTime = Date.now();
    const batchTime = batchEndTime - batchStartTime;
    console.log(
      `Completed batch ${batchNum}/${totalBatches} in ${(
        batchTime / 1000
      ).toFixed(1)}s`
    );
  }

  // Calculate total time for grading
  const gradingEndTime = Date.now();
  const gradingTime = gradingEndTime - totalStartTime;

  // Perform similarity analysis
  console.log("\nAnalyzing code similarity...");
  // Use a lower threshold of 70% for detecting similar submissions
  const similarityThreshold = 70;
  const similarityReport = await analyzeSimilarity(
    SUBMISSIONS_DIR,
    students,
    similarityThreshold
  );

  // Adjust scores for students using default implementations
  if (similarityReport.defaultImplementations) {
    console.log(
      "\nAdjusting scores for students using default implementations..."
    );
    for (const studentId in similarityReport.defaultImplementations) {
      const defaultFuncs = similarityReport.defaultImplementations[studentId];
      if (defaultFuncs.length > 0) {
        // Find the student result
        const studentResult = results.find((r) => r.studentId === studentId);
        if (studentResult) {
          console.log(
            `Student ${studentId} has ${
              defaultFuncs.length
            } default implementations: ${defaultFuncs.join(", ")}`
          );

          // Set implementation status to false for default functions
          for (const funcName of defaultFuncs) {
            // Find the function in the functionStatus array and set implemented to false
            const funcStatus =
              studentResult.implementationStatus.functionStatus.find(
                (fs) => fs.name === funcName
              );
            if (funcStatus) {
              funcStatus.implemented = false;
              funcStatus.isDefaultImplementation = true; // Mark as default implementation
              console.log(
                `  - ${funcName}: marked as not implemented (default code)`
              );
            }
          }

          // Recalculate score - count unimplemented functions
          const unimplementedCount =
            studentResult.implementationStatus.functionStatus.filter(
              (fs) => !fs.implemented
            ).length;

          // Check if student has submitted essentially the instructor's default code
          // (5 or more functions unchanged means it's basically the instructor file)
          const isInstructorFile = defaultFuncs.length >= 5;

          // Recalculate total points deduction
          let deduction;
          if (isInstructorFile) {
            // If it's identical or nearly identical to instructor file, give 0 points
            deduction = 30;
            console.log(
              `  - Student submitted instructor's default file with little to no changes: 0 points`
            );
          } else {
            // Otherwise, use normal deduction (5 points per unimplemented function, cap at 25)
            deduction = Math.min(unimplementedCount * 5, 25);
            console.log(`  - Score adjusted: deduction of ${deduction} points`);
          }

          studentResult.implementationStatus.totalPointsDeduction = deduction;
        }
      }
    }
  }

  // Generate and save grading report (including similarity info)
  const gradingReport = generateGradingReport(
    results,
    gradingTime,
    similarityReport.highSimilarityPairs
  );
  await saveGradingReport(gradingReport);

  // Print summary statistics
  printGradingSummary(gradingReport);

  // Calculate total time including similarity analysis
  const totalEndTime = Date.now();
  const totalTime = totalEndTime - totalStartTime;
  console.log(`\nTotal execution time: ${(totalTime / 1000).toFixed(1)}s`);
}

// Run the autograder if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);

  // Check for similarity analysis command
  if (args.includes("--similarity") || args.includes("-s")) {
    const threshold = defineSimilarityThreshold(args);
    runSimilarityAnalysis(threshold).catch((error) => {
      console.error("Error running similarity analysis:", error);
      process.exit(1);
    });
  } else {
    // Run regular autograder
    // Check if a specific student was specified
    const studentArg = args.find((arg) => arg.startsWith("--student="));
    let targetStudent: string | undefined = undefined;
    if (studentArg) {
      targetStudent = studentArg.split("=")[1];
      if (!targetStudent)
        console.warn(`Empty student value provided. Grading all students.`);
    }
    runAutograder(targetStudent).catch((error) => {
      console.error("Error running autograder:", error);
      process.exit(1);
    });
  }
}
