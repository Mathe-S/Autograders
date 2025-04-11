import path from "path";
import { defineSimilarityThreshold } from "./utils/define-similarity-threshold";
import * as fsUtils from "./utils/fs-utils";
import { analyzeSimilarity } from "./services/similarity/code-similarity";
import {
  generateSimilarityHtml,
  printSimilaritySummary,
  saveSimilarityReport,
} from "./reporters/similarity-reporter";
import { exec } from "child_process";

const SUBMISSIONS_DIR = path.join(process.cwd(), "Submissions_auto");
// const SUBMISSIONS_DIR = path.join(process.cwd(), "submissions");

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
    //   const studentArg = args.find((arg) => arg.startsWith("--student="));
    //   let targetStudent: string | undefined = undefined;
    //   if (studentArg) {
    //     targetStudent = studentArg.split("=")[1];
    //     if (!targetStudent) {
    //       console.warn(`Empty student value provided. Grading all students.`);
    //     }
    //   }
    //   runAutograder(targetStudent).catch((error) => {
    //     console.error("Error running autograder:", error);
    //     process.exit(1);
    //   });
  }
}
