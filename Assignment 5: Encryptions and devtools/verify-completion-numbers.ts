import * as fs from "fs";
import * as path from "path";

interface StudentSubmission {
  userId: string;
  studentName: string;
  email: string;
  githubUrl: string;
  repositoryName: string;
  submittedAt: string;
  grade: string;
  completionNumber: string;
}

interface StudentResult {
  studentId: string;
  status: "passed" | "failed";
  notes: string[];
  points: number;
}

interface GradingReport {
  timestamp: string;
  totalStudents: number;
  statusCounts: {
    passed: number;
    failed: number;
    errors: number;
    unknown: number;
  };
  passingPercentage: number;
  executionTimeSeconds: number;
  students: StudentResult[];
  totalPoints: number;
  averagePoints: number;
}

/**
 * Generate userHash from userId using btoa encoding and taking first 8 characters
 */
function generateUserHash(userId: string): string {
  try {
    return btoa(userId).slice(0, 8);
  } catch (error) {
    throw new Error(`Failed to generate userHash for userId: ${userId}`);
  }
}

/**
 * Apply Caesar cipher with +1 shift to generate completion number
 */
function generateCompletionNumber(userHash: string): string {
  return userHash
    .split("")
    .map((char) => {
      if (char.match(/[A-Za-z]/)) {
        const isUpperCase = char === char.toUpperCase();
        const base = isUpperCase ? 65 : 97;
        return String.fromCharCode(
          ((char.charCodeAt(0) - base + 1) % 26) + base
        );
      }
      return char;
    })
    .join("");
}

/**
 * Parse CSV file and return array of student submissions
 */
function parseCSV(csvContent: string): StudentSubmission[] {
  const lines = csvContent.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, ""));

  const submissions: StudentSubmission[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Parse CSV line handling quoted values
    const values: string[] = [];
    let currentValue = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Push the last value

    if (values.length >= 8) {
      submissions.push({
        userId: values[0].replace(/"/g, ""),
        studentName: values[1].replace(/"/g, ""),
        email: values[2].replace(/"/g, ""),
        githubUrl: values[3].replace(/"/g, ""),
        repositoryName: values[4].replace(/"/g, ""),
        submittedAt: values[5].replace(/"/g, ""),
        grade: values[6].replace(/"/g, ""),
        completionNumber: values[7].replace(/"/g, ""),
      });
    }
  }

  return submissions;
}

/**
 * Verify completion number for a single student
 */
function verifyCompletionNumber(submission: StudentSubmission): StudentResult {
  const notes: string[] = [];
  let status: "passed" | "failed" = "failed";
  let points = 0;

  try {
    // Skip students with empty completion numbers
    if (
      !submission.completionNumber ||
      submission.completionNumber.trim() === ""
    ) {
      notes.push("No completion number submitted");
      return {
        studentId: submission.email,
        status: "failed",
        notes,
        points: 0,
      };
    }

    // Generate expected completion number
    const userHash = generateUserHash(submission.userId);
    const expectedCompletionNumber = generateCompletionNumber(userHash);

    // Compare with submitted completion number
    if (submission.completionNumber === expectedCompletionNumber) {
      status = "passed";
      points = 50;
      notes.push("Completion number verified successfully");
    } else {
      status = "failed";
      points = 0;
      notes.push(
        `Completion number mismatch. Expected: ${expectedCompletionNumber}, Got: ${submission.completionNumber}`
      );
      notes.push(`UserHash: ${userHash}`);
    }
  } catch (error) {
    status = "failed";
    points = 0;
    notes.push(
      `Error verifying completion number: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  return {
    studentId: submission.email,
    status,
    notes,
    points,
  };
}

/**
 * Main function to process all submissions and generate grading report
 */
function processSubmissions(): void {
  const startTime = Date.now();

  try {
    // Read CSV file
    const csvPath = path.join(process.cwd(), "assignment_submissions.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");

    // Parse submissions
    const submissions = parseCSV(csvContent);
    console.log(`Parsed ${submissions.length} submissions`);

    // Verify each submission
    const results: StudentResult[] = submissions.map(verifyCompletionNumber);

    // Calculate statistics
    const statusCounts = {
      passed: results.filter((r) => r.status === "passed").length,
      failed: results.filter((r) => r.status === "failed").length,
      errors: 0,
      unknown: 0,
    };

    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
    const averagePoints = Math.round(totalPoints / results.length);
    const passingPercentage = Math.round(
      (statusCounts.passed / results.length) * 100
    );

    const executionTimeSeconds = (Date.now() - startTime) / 1000;

    // Generate report
    const report: GradingReport = {
      timestamp: new Date().toISOString(),
      totalStudents: results.length,
      statusCounts,
      passingPercentage,
      executionTimeSeconds,
      students: results,
      totalPoints,
      averagePoints,
    };

    // Write report to file
    const reportPath = path.join(
      process.cwd(),
      "completion_verification_report.json"
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Console output
    console.log("\n=== COMPLETION NUMBER VERIFICATION REPORT ===");
    console.log(`Total Students: ${report.totalStudents}`);
    console.log(`Passed: ${statusCounts.passed}`);
    console.log(`Failed: ${statusCounts.failed}`);
    console.log(`Passing Percentage: ${passingPercentage}%`);
    console.log(`Average Points: ${averagePoints}/50`);
    console.log(`Execution Time: ${executionTimeSeconds}s`);
    console.log(`\nReport saved to: ${reportPath}`);

    // Show some example results
    console.log("\n=== SAMPLE RESULTS ===");
    results.slice(0, 5).forEach((result) => {
      console.log(`\nStudent: ${result.studentId}`);
      console.log(`Status: ${result.status}`);
      console.log(`Points: ${result.points}`);
      if (result.notes.length > 0) {
        console.log(`Notes: ${result.notes.join("; ")}`);
      }
    });
  } catch (error) {
    console.error("Error processing submissions:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  processSubmissions();
}

export { processSubmissions, generateUserHash, generateCompletionNumber };
