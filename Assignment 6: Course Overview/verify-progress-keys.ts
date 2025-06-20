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
  progressKey: string;
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
 * Validate the format of a progress key
 * Expected format: U2FSDGVKX1[encrypted-part1]-[encrypted-part2]=-[steps]
 * Or similar base64-like patterns with step numbers
 */
function validateProgressKeyFormat(progressKey: string): {
  isValid: boolean;
  stepCount?: number;
  formatIssues: string[];
} {
  const formatIssues: string[] = [];

  if (!progressKey || progressKey.trim() === "") {
    return {
      isValid: false,
      formatIssues: ["Progress key is empty or missing"],
    };
  }

  // Check if it starts with expected prefix pattern
  if (!progressKey.startsWith("U2FSDGVKX1")) {
    formatIssues.push("Progress key does not start with expected prefix");
  }

  // Extract step count from the end
  const stepMatch = progressKey.match(/-(\d+)$/);
  let stepCount: number | undefined;

  if (stepMatch) {
    stepCount = parseInt(stepMatch[1], 10);

    // Validate step count is reasonable (0-20 as mentioned in instructions)
    if (stepCount < 0 || stepCount > 20) {
      formatIssues.push(
        `Step count ${stepCount} is outside reasonable range (0-20)`
      );
    }
  } else {
    formatIssues.push("Could not extract step count from progress key");
  }

  // Check for base64-like pattern (contains alphanumeric, +, /, =)
  const base64Pattern = /^[A-Za-z0-9+/=\-]+$/;
  if (!base64Pattern.test(progressKey)) {
    formatIssues.push(
      "Progress key contains invalid characters for base64-like encoding"
    );
  }

  // Check for presence of separators
  const separatorCount = (progressKey.match(/-/g) || []).length;
  if (separatorCount < 2) {
    formatIssues.push("Progress key should contain at least 2 separators");
  }

  // Check minimum length (should be substantial if properly encrypted)
  if (progressKey.length < 20) {
    formatIssues.push("Progress key is too short to be a valid encrypted key");
  }

  return {
    isValid: formatIssues.length === 0,
    stepCount,
    formatIssues,
  };
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
        progressKey: values[7].replace(/"/g, ""),
      });
    }
  }

  return submissions;
}

/**
 * Verify progress key for a single student
 */
function verifyProgressKey(submission: StudentSubmission): StudentResult {
  const notes: string[] = [];
  let status: "passed" | "failed" = "failed";
  let points = 0;

  try {
    const validation = validateProgressKeyFormat(submission.progressKey);

    if (validation.isValid) {
      status = "passed";
      points = 50;
      notes.push("Progress key format validated successfully");

      if (validation.stepCount !== undefined) {
        notes.push(`Detected ${validation.stepCount} completed steps`);
      }
    } else {
      status = "failed";
      points = 0;
      notes.push("Progress key format validation failed");
      validation.formatIssues.forEach((issue) => notes.push(issue));
    }
  } catch (error) {
    status = "failed";
    points = 0;
    notes.push(
      `Error verifying progress key: ${
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
 * Additional validation for specific patterns observed in the data
 */
function performAdditionalValidation(submission: StudentSubmission): string[] {
  const additionalNotes: string[] = [];
  const key = submission.progressKey;

  if (!key) return additionalNotes;

  // Check for common patterns in the actual data
  if (key.includes("U2FSDGVKX1")) {
    additionalNotes.push("Contains expected encryption prefix");
  }

  // Analyze the structure more deeply
  const parts = key.split("-");
  if (parts.length >= 3) {
    additionalNotes.push(
      `Key has ${parts.length} parts (expected 3+ for proper format)`
    );
  }

  // Check for proper base64-like encoding in parts
  const base64Chars = /^[A-Za-z0-9+/=]+$/;
  let validParts = 0;
  parts.forEach((part, index) => {
    if (index < parts.length - 1) {
      // Don't check the last part (step count)
      if (base64Chars.test(part)) {
        validParts++;
      }
    }
  });

  if (validParts > 0) {
    additionalNotes.push(
      `${validParts} parts contain valid base64-like characters`
    );
  }

  return additionalNotes;
}

/**
 * Enhanced verification with additional checks
 */
function verifyProgressKeyEnhanced(
  submission: StudentSubmission
): StudentResult {
  const basicResult = verifyProgressKey(submission);
  const additionalNotes = performAdditionalValidation(submission);

  // Combine notes
  basicResult.notes = [...basicResult.notes, ...additionalNotes];

  return basicResult;
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
    const results: StudentResult[] = submissions.map(verifyProgressKeyEnhanced);

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
      "progress_key_verification_report.json"
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Console output
    console.log("\n=== PROGRESS KEY VERIFICATION REPORT ===");
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

    // Show failed cases for debugging
    const failedCases = results.filter((r) => r.status === "failed");
    if (failedCases.length > 0) {
      console.log("\n=== FAILED CASES SUMMARY ===");
      failedCases.forEach((failed) => {
        console.log(`${failed.studentId}: ${failed.notes.join("; ")}`);
      });
    }
  } catch (error) {
    console.error("Error processing submissions:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  processSubmissions();
}

export { processSubmissions, validateProgressKeyFormat, verifyProgressKey };
