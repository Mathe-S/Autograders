import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import * as fsUtils from "./utils/fs-utils";
import { processStudent } from "./services/student-processor";
import {
  generateGradingReport,
  saveGradingReport,
  printGradingSummary,
} from "./reporters/report-generator";
import {
  generateArtGallery,
  saveArtGallery,
} from "./reporters/art-gallery-generator";
import { StudentResult } from "./types";

const execAsync = promisify(exec);

/**
 * Import necessary functions from the instructor's turtlesoup.ts or provide fallback
 */
async function importInstructorFunctions(): Promise<{
  openHTML: (filename?: string) => void;
}> {
  try {
    // Use path.resolve to get an absolute path to the instructor directory
    const instructorDir = path.resolve(process.cwd(), "instructor");
    const turtlesoupPath = path.join(instructorDir, "src", "turtlesoup");

    // Try to require the module
    const turtlesoup = require(turtlesoupPath);

    // If successful, return the openHTML function
    return {
      openHTML: turtlesoup.openHTML,
    };
  } catch (error) {
    console.warn(
      "Could not import instructor's openHTML function, using fallback implementation"
    );

    // Provide a fallback implementation
    return {
      openHTML: (filename?: string) => {
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
          // Execute the command to open the file in the default browser
          exec(cmd);
          console.log(`Opened ${filename} in default browser`);
        } catch (e) {
          console.error(`Failed to open ${filename}:`, e);
        }
      },
    };
  }
}

/**
 * Main autograder function
 */
async function runAutograder(): Promise<void> {
  const totalStartTime = Date.now();
  console.log("Starting PS0 autograder...");

  // Import instructor functions
  const { openHTML } = await importInstructorFunctions();

  // Discover student submissions
  const submissionsDir = path.join(process.cwd(), "Submissions_auto");
  const students = await fsUtils.discoverStudentSubmissions(submissionsDir);

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
      batch.map((studentId) => processStudent(studentId, submissionsDir))
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

  // Calculate total time
  const totalEndTime = Date.now();
  const totalTime = totalEndTime - totalStartTime;

  // Generate grading report
  const gradingReport = generateGradingReport(results, totalTime);

  // Generate and save student art gallery
  const galleryHtml = await generateArtGallery(gradingReport.students);
  const galleryPath = await saveArtGallery(galleryHtml);

  // Save grading report
  await saveGradingReport(gradingReport);

  // Print summary statistics
  printGradingSummary(gradingReport);

  // Open the grid art visualization
  console.log("\nOpening student art gallery visualization...");
  openHTML(galleryPath);
}

// Run the autograder if this file is executed directly
if (require.main === module) {
  runAutograder().catch((error) => {
    console.error("Error running autograder:", error);
    process.exit(1);
  });
}

export { runAutograder };
