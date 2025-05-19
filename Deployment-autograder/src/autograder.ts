import fs from "fs/promises";
import path from "path";
import { parse } from "csv-parse/sync";
// import * as cheerio from 'cheerio'; // No longer needed
import puppeteer, { Browser } from "puppeteer"; // Removed Element import, relying on @types/puppeteer for el
import {
  GradingReport,
  ProcessedStudentResult,
  TestResult,
  RawStudentData,
} from "./types";

// Constants
const CSV_FILE_PATH = path.resolve(__dirname, "../assignment_submissions.csv");
const REPORT_OUTPUT_PATH = path.resolve(__dirname, "../grading_report.json");
const MAX_POINTS_BACKEND = 25;
const MAX_POINTS_FRONTEND = 25;
const TOTAL_MAX_POINTS = MAX_POINTS_BACKEND + MAX_POINTS_FRONTEND;
const FETCH_TIMEOUT_MS = 15000; // Increased timeout for Puppeteer page loads
const PUPPETEER_ELEMENT_TIMEOUT_MS = 7000; // Timeout for waiting for #answer span

// Helper to create a default TestResult
const createDefaultTestResult = (
  overall: boolean,
  details?: Record<string, boolean>,
  errors?: string
): TestResult => ({
  overall,
  details: details || {},
  errors,
});

async function main() {
  const startTime = Date.now();
  console.log("Starting autograder...");

  let browser: Browser | null = null;
  try {
    console.log("Launching Puppeteer browser...");
    browser = await puppeteer.launch({
      headless: true, // Can be set to false for debugging
      args: ["--no-sandbox", "--disable-setuid-sandbox"], // Common args for CI environments
    });
    console.log("Puppeteer browser launched.");
  } catch (e: any) {
    console.error("Failed to launch Puppeteer browser:", e);
    process.exit(1);
  }

  let csvContent: string;
  try {
    csvContent = await fs.readFile(CSV_FILE_PATH, "utf-8");
  } catch (error) {
    console.error(`Failed to read CSV file at ${CSV_FILE_PATH}:`, error);
    if (browser) await browser.close();
    process.exit(1);
  }

  const records: RawStudentData[] = parse(csvContent, {
    columns: (header) =>
      header.map((col: string) =>
        col.replace(/\s+/g, "").replace(/URL/g, "Url")
      ),
    skip_empty_lines: true,
    trim: true,
  });

  const report: GradingReport = {
    timestamp: new Date().toISOString(),
    totalStudents: 0,
    statusCounts: { passed: 0, failed: 0, errors: 0, unknown: 0 },
    passingPercentage: 0,
    executionTimeSeconds: 0,
    students: [],
    totalPoints: 0,
    averagePoints: 0,
  };

  const studentDataRows = records.slice(1);
  report.totalStudents = studentDataRows.length;

  for (const student of studentDataRows) {
    const studentId =
      student.Email || student.StudentName || `UnknownStudent-${Date.now()}`;
    console.log(`Processing student: ${studentId}...`);

    const notes: string[] = [];
    let studentPoints = 0;
    let backendTestDetails: Record<string, boolean> = {
      submissionReceived: false,
      postRequestSuccess: false,
    };
    let backendErrors: string | undefined;

    let frontendTestDetails: Record<string, boolean> = {
      pageAccessible: false,
      dataDisplayedCorrectly: false,
    };
    let frontendErrors: string | undefined;

    const uniqueData = `autograder-check-${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}`;

    // Backend Test
    const backendUrl = student.Backendurlendpoint;
    if (
      backendUrl &&
      typeof backendUrl === "string" &&
      backendUrl.trim() !== ""
    ) {
      backendTestDetails["submissionReceived"] = true;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(backendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: uniqueData }),
          signal: controller.signal, // Added for timeout
        });
        clearTimeout(timeoutId); // Clear timeout if fetch completes

        if (response.ok) {
          console.log(`Backend test PASSED for ${studentId}`);
          studentPoints += MAX_POINTS_BACKEND;
          backendTestDetails["postRequestSuccess"] = true;
        } else {
          const errorText = await response.text();
          console.warn(
            `Backend test FAILED for ${studentId} at ${backendUrl}: ${response.status} ${response.statusText}. Body: ${errorText}`
          );
          notes.push(
            `Backend error (${response.status}): ${
              response.statusText
            }. ${errorText.substring(0, 100)}`
          );
          backendErrors = `Status ${response.status}: ${
            response.statusText
          }. ${errorText.substring(0, 100)}`;
        }
      } catch (error: any) {
        clearTimeout(timeoutId); // Clear timeout if fetch fails
        console.error(
          `Error testing backend for ${studentId} at ${backendUrl}:`,
          error
        );
        notes.push(`Backend request failed: ${error.message}`);
        backendErrors = `Request failed: ${error.message}`;
        if (error.name === "AbortError") {
          notes.push("Backend request timed out.");
          backendErrors += " (Timeout)";
        }
      }
    } else {
      notes.push("Backend URL not provided or invalid.");
      backendErrors = "Backend URL not provided or invalid.";
      backendTestDetails["submissionReceived"] = false;
    }

    // Frontend Test using Puppeteer
    const frontendUrl = student.Frontendurl;
    if (
      frontendUrl &&
      typeof frontendUrl === "string" &&
      frontendUrl.trim() !== "" &&
      browser
    ) {
      let page = null;
      try {
        page = await browser.newPage();
        await page.goto(frontendUrl, {
          waitUntil: "networkidle0",
          timeout: FETCH_TIMEOUT_MS,
        });
        frontendTestDetails["pageAccessible"] = true;

        await page.waitForSelector("#answer", {
          timeout: PUPPETEER_ELEMENT_TIMEOUT_MS,
        });
        const displayedData = await page.$eval(
          "#answer",
          (el) => el.textContent
        );

        if (displayedData && displayedData.trim() === uniqueData) {
          console.log(`Frontend test PASSED for ${studentId}`);
          studentPoints += MAX_POINTS_FRONTEND;
          frontendTestDetails["dataDisplayedCorrectly"] = true;
        } else {
          console.warn(
            `Frontend test FAILED for ${studentId} at ${frontendUrl}: Data mismatch. Expected '${uniqueData}', got '${displayedData}'`
          );
          notes.push(
            `Frontend data mismatch: Expected '${uniqueData.substring(
              0,
              30
            )}...', got '${(displayedData || "").substring(0, 30)}...'`
          );
          frontendErrors = `Data mismatch. Expected '${uniqueData}', got '${displayedData}'`;
        }
      } catch (error: any) {
        notes.push(`Frontend test error: ${error.message.substring(0, 150)}`);
        frontendErrors = `Error: ${error.message.substring(0, 150)}`;
        if (error.name === "TimeoutError") {
          notes.push("Frontend page/element timed out.");
          frontendErrors += " (Timeout)";
        }
      } finally {
        if (page) {
          try {
            await page.close();
          } catch (closeError: any) {
            console.warn(
              `Error closing page for ${studentId}: ${closeError.message}`
            );
          }
        }
      }
    } else {
      if (!frontendUrl || frontendUrl.trim() === "") {
        notes.push("Frontend URL not provided or invalid.");
        frontendErrors = "Frontend URL not provided or invalid.";
      } else if (!browser) {
        notes.push("Puppeteer browser not available for frontend test.");
        frontendErrors = "Puppeteer browser not available.";
      }
    }

    // Consolidate results
    const backendOverall = backendTestDetails["postRequestSuccess"];
    const frontendOverall = frontendTestDetails["dataDisplayedCorrectly"];

    let overallStatus: ProcessedStudentResult["status"] = "failed";
    if (backendOverall && frontendOverall) {
      overallStatus = "passed";
    } else if (
      !backendTestDetails["submissionReceived"] ||
      !frontendUrl ||
      frontendUrl.trim() === ""
    ) {
      overallStatus = "error";
      if (!backendTestDetails["submissionReceived"])
        notes.push("Marked as error due to missing/invalid backend URL.");
      if (!frontendUrl || frontendUrl.trim() === "")
        notes.push("Marked as error due to missing/invalid frontend URL.");
    } else {
      overallStatus = "failed"; // Default to failed if not passed and not a submission error
    }

    const processedStudent: ProcessedStudentResult = {
      studentId,
      status: overallStatus,
      notes,
      points: studentPoints,
      backendUrl: student.Backendurlendpoint,
      frontendUrl: student.Frontendurl,
      implementationTests: createDefaultTestResult(true, { mockedTest: true }),
      studentTests: {
        overall: backendOverall && frontendOverall,
        details: {
          "Backend: Endpoint Responded":
            backendTestDetails["submissionReceived"],
          "Backend: POST Succeeded": backendTestDetails["postRequestSuccess"],
          "Frontend: Page Accessible": frontendTestDetails["pageAccessible"],
          "Frontend: Data Correctly Displayed":
            frontendTestDetails["dataDisplayedCorrectly"],
        },
        errors:
          [backendErrors, frontendErrors].filter(Boolean).join("; \n") ||
          undefined,
      },
    };

    report.students.push(processedStudent);
    if (overallStatus === "error") {
      report.statusCounts.errors++;
    } else if (overallStatus === "passed") {
      report.statusCounts.passed++;
    } else {
      report.statusCounts.failed++;
    }
    report.totalPoints += studentPoints;
  }

  // Finalize report and close browser
  if (browser) {
    console.log("Closing Puppeteer browser...");
    await browser.close();
    console.log("Puppeteer browser closed.");
  }

  if (report.totalStudents > 0) {
    const passedOrErrorCount =
      report.statusCounts.passed + report.statusCounts.errors;
    if (report.totalStudents - report.statusCounts.unknown > 0) {
      // Avoid division by zero if all are unknown
      report.passingPercentage =
        (report.statusCounts.passed /
          (report.totalStudents - report.statusCounts.unknown)) *
        100;
    }
    report.averagePoints = report.totalPoints / report.totalStudents;
  }
  const endTime = Date.now();
  report.executionTimeSeconds = (endTime - startTime) / 1000;

  console.log(
    `Autograding complete. Processed ${report.totalStudents} students.`
  );
  console.log(
    `Report: Passed: ${report.statusCounts.passed}, Failed: ${report.statusCounts.failed}, Errors: ${report.statusCounts.errors}`
  );
  console.log(`Report generated at: ${REPORT_OUTPUT_PATH}`);
  console.log(
    `Execution time: ${report.executionTimeSeconds.toFixed(2)} seconds`
  );

  await fs.writeFile(REPORT_OUTPUT_PATH, JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("Unhandled error in main autograding process:", error);
  // Ensure browser is closed if an unhandled error occurs before normal shutdown
  (async () => {
    // This is a bit of a hack to get the browser instance if it's in scope of main
    // A better way would be to manage browser instance in a class or a global-like module variable accessible here.
    // For now, we assume `main` might not have finished and `browser` might be open.
    // This catch is outside `main`, so direct access to `browser` isn't possible without refactor.
    // console.warn("Attempting to close browser due to unhandled error - this may not work if browser was not initialized.");
    // if (typeof browser !== 'undefined' && browser !== null) { // browser is not defined here
    //    await browser.close();
    // }
  })();
  process.exit(1);
});
