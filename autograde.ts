import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { SimpleTurtle, Point, Color } from "./instructor/src/turtle";
import * as os from "os";
import * as fsPromises from "fs/promises";

const execAsync = promisify(exec);

/**
 * Type definitions for grading results
 */
interface StudentResult {
  studentId: string;
  implementationTests: {
    overall: boolean;
    details: {
      [testName: string]: boolean;
    };
    errors?: string;
  };
  studentTests: {
    overall: boolean;
    details: {
      [testName: string]: boolean;
    };
    errors?: string;
  };
  personalArt: {
    pathData: { start: Point; end: Point; color: Color }[];
    error?: string;
  };
}

interface GradingReport {
  timestamp: string;
  students: StudentResult[];
  summary: {
    totalStudents: number;
    passedImplementationTests: number;
    passedStudentTests: number;
    personalArtGenerationSuccess: number;
  };
  timingInfo?: {
    totalTime: number;
    studentTimes: { [studentId: string]: number };
  };
}

/**
 * Import necessary functions from the instructor's turtlesoup.ts
 */
async function importInstructorFunctions(): Promise<{
  generateHTML: (
    pathData: { start: Point; end: Point; color: Color }[]
  ) => string;
  saveHTMLToFile: (html: string, filename?: string) => void;
  openHTML: (filename?: string) => void;
  drawPersonalArt?: (turtle: SimpleTurtle) => void;
}> {
  try {
    const {
      generateHTML,
      saveHTMLToFile,
      openHTML,
      drawPersonalArt,
    } = require("./instructor/src/turtlesoup");
    return { generateHTML, saveHTMLToFile, openHTML, drawPersonalArt };
  } catch (error) {
    console.error("Error importing instructor functions:", error);
    throw error;
  }
}

/**
 * Discovers all student submission directories
 * @param submissionsDir The base directory containing student submissions
 * @returns Array of student directory names
 */
async function discoverStudentSubmissions(
  submissionsDir: string
): Promise<string[]> {
  try {
    const entries = await fsPromises.readdir(submissionsDir, {
      withFileTypes: true,
    });
    const studentDirs = entries
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    console.log(
      `Found ${studentDirs.length} student submissions: ${studentDirs.join(
        ", "
      )}`
    );
    return studentDirs;
  } catch (error) {
    console.error("Error discovering student submissions:", error);
    return [];
  }
}

/**
 * Run Mocha tests programmatically with a specific turtlesoup implementation
 * @param studentDir The student's directory
 * @param useInstructorTests Whether to use instructor tests or student tests
 * @param operation The operation being tested ('implementation', 'student', or 'art')
 * @returns Test results with pass/fail status
 */
async function runTests(
  studentDir: string,
  useInstructorTests: boolean,
  operation: "implementation" | "student" | "art"
): Promise<{
  overall: boolean;
  details: { [testName: string]: boolean };
  errors?: string;
}> {
  // Prepare the environment for testing with a unique directory for each operation
  const tmpTestDir = path.join(studentDir, `tmp_${operation}`);

  try {
    // Clean up the entire tmp directory first
    try {
      await fsPromises.rm(tmpTestDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }

    // Create fresh temporary test directory
    await fsPromises.mkdir(tmpTestDir, { recursive: true });

    // Set up the test environment using symbolic links
    try {
      if (useInstructorTests) {
        // Test student implementation against instructor tests
        await fsPromises.symlink(
          path.join(process.cwd(), "instructor/src", "turtle.ts"),
          path.join(tmpTestDir, "turtle.ts")
        );
        await fsPromises.symlink(
          path.join(studentDir, "src", "turtlesoup.ts"),
          path.join(tmpTestDir, "turtlesoup.ts")
        );

        // For the test file, we need to create a modified copy because we need to fix imports
        const testContent = (
          await fsPromises.readFile(
            path.join(process.cwd(), "instructor/test", "turtlesoupTest.ts"),
            "utf-8"
          )
        )
          .replace(/from "\.\.\/src\/turtlesoup"/g, 'from "./turtlesoup"')
          .replace(/from "\.\.\/src\/turtle"/g, 'from "./turtle"');
        await fsPromises.writeFile(
          path.join(tmpTestDir, "turtlesoupTest.ts"),
          testContent
        );
      } else {
        // Test instructor implementation against student tests
        await fsPromises.symlink(
          path.join(process.cwd(), "instructor/src", "turtle.ts"),
          path.join(tmpTestDir, "turtle.ts")
        );
        await fsPromises.symlink(
          path.join(process.cwd(), "instructor/src", "turtlesoup.ts"),
          path.join(tmpTestDir, "turtlesoup.ts")
        );

        // Skip if student test file doesn't exist
        const studentTestPath = path.join(
          studentDir,
          "test",
          "turtlesoupTest.ts"
        );
        try {
          await fsPromises.access(studentTestPath);
        } catch {
          return {
            overall: false,
            details: {},
            errors: "Student test file does not exist",
          };
        }

        // For the test file, we need to create a modified copy because we need to fix imports
        const testContent = (
          await fsPromises.readFile(studentTestPath, "utf-8")
        )
          .replace(/from "\.\.\/src\/turtlesoup"/g, 'from "./turtlesoup"')
          .replace(/from "\.\/turtlesoup"/g, 'from "./turtlesoup"')
          .replace(/from "\.\.\/src\/turtle"/g, 'from "./turtle"')
          .replace(/from "\.\/turtle"/g, 'from "./turtle"');
        await fsPromises.writeFile(
          path.join(tmpTestDir, "turtlesoupTest.ts"),
          testContent
        );
      }
    } catch (error: any) {
      // Handle symlink creation errors (might happen if file already exists)
      console.error(`Error creating symlinks for ${studentDir}:`, error);
      return {
        overall: false,
        details: {},
        errors: `Error setting up test environment: ${error.message}`,
      };
    }

    // Run the tests directly using project dependencies
    try {
      const cmd = `cd ${tmpTestDir} && npx mocha -r ts-node/register turtlesoupTest.ts --reporter json`;
      const { stdout: output } = await execAsync(cmd, {
        maxBuffer: 1024 * 1024, // Increase buffer size to 1MB
        timeout: 15000, // 15 second timeout
      });

      // Parse the JSON output from Mocha
      try {
        const results = JSON.parse(output);
        const testResults: { [testName: string]: boolean } = {};
        let allPassed = true;

        // Process test results
        if (results.passes) {
          for (const test of results.passes) {
            const testTitle = test.fullTitle;
            testResults[testTitle] = true;
          }
        }

        if (results.failures) {
          for (const test of results.failures) {
            const testTitle = test.fullTitle;
            testResults[testTitle] = false;
            allPassed = false;
          }
        }

        return {
          overall: allPassed && Object.keys(testResults).length > 0,
          details: testResults,
        };
      } catch (parseError: any) {
        return {
          overall: false,
          details: {},
          errors: `Error parsing test results: ${parseError.message}`,
        };
      }
    } catch (cmdError: any) {
      // Mocha command failed, but we can still try to extract test results
      // Even when tests fail, Mocha might have output JSON with failures
      try {
        const output = cmdError.stdout || "";
        if (output.includes("{") && output.includes("}")) {
          // Try to extract JSON from the output
          const jsonStart = output.indexOf("{");
          const jsonOutput = output.substring(jsonStart);
          const results = JSON.parse(jsonOutput);

          const testResults: { [testName: string]: boolean } = {};

          if (results.passes) {
            for (const test of results.passes) {
              const testTitle = test.fullTitle;
              testResults[testTitle] = true;
            }
          }

          if (results.failures) {
            for (const test of results.failures) {
              const testTitle = test.fullTitle;
              testResults[testTitle] = false;
            }
          }

          return {
            overall: false,
            details: testResults,
            errors: cmdError.message,
          };
        }
      } catch (e) {
        // Couldn't extract JSON, continue to default error handling
      }

      return {
        overall: false,
        details: {},
        errors: cmdError.message,
      };
    } finally {
      // Clean up
      try {
        await fsPromises.rm(tmpTestDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error: any) {
    // Handle any other errors
    try {
      await fsPromises.rm(tmpTestDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }

    return {
      overall: false,
      details: {},
      errors: error.message,
    };
  }
}

/**
 * Execute student's drawPersonalArt function and collect path data
 * @param studentDir The student's directory
 * @returns Path data from the turtle after drawing
 */
async function collectPersonalArt(studentDir: string): Promise<{
  pathData: { start: Point; end: Point; color: Color }[];
  error?: string;
}> {
  const tmpArtDir = path.join(studentDir, "tmp_art");

  console.log(`Collecting personal art for ${studentDir}`);

  try {
    // Clean up the entire tmp directory first
    try {
      await fsPromises.rm(tmpArtDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }

    // Create fresh temporary directory
    await fsPromises.mkdir(tmpArtDir, { recursive: true });

    // Set up files using symlinks where possible
    await fsPromises.symlink(
      path.join(process.cwd(), "instructor/src", "turtle.ts"),
      path.join(tmpArtDir, "turtle.ts")
    );
    await fsPromises.symlink(
      path.join(studentDir, "src", "turtlesoup.ts"),
      path.join(tmpArtDir, "turtlesoup.ts")
    );

    // Create a wrapper script that will execute drawPersonalArt and extract the path
    const wrapperContent = `
      import { SimpleTurtle } from './turtle';
      import { drawPersonalArt } from './turtlesoup';
      import * as fs from 'fs';

      // Create turtle, execute art function, and save the path
      (function() {
        try {
          const turtle = new SimpleTurtle();
          drawPersonalArt(turtle);
          const pathData = JSON.stringify(turtle.getPath());
          fs.writeFileSync('path.json', pathData);
        } catch (error) {
          console.error('Error generating art:', error);
          process.exit(1);
        }
      })();
    `;

    await fsPromises.writeFile(
      path.join(tmpArtDir, "wrapper.ts"),
      wrapperContent
    );

    // Execute the wrapper
    await execAsync(`cd ${tmpArtDir} && npx ts-node wrapper.ts`, {
      timeout: 10000, // 10 second timeout
    });

    // Read the path data
    const pathData = JSON.parse(
      await fsPromises.readFile(path.join(tmpArtDir, "path.json"), "utf-8")
    );

    // Clean up
    await fsPromises.rm(tmpArtDir, { recursive: true, force: true });

    return { pathData };
  } catch (error: any) {
    // Try to clean up if possible
    if (fs.existsSync(tmpArtDir)) {
      try {
        await fsPromises.rm(tmpArtDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return {
      pathData: [],
      error: error.message,
    };
  }
}

/**
 * Process a single student
 * @param studentId Student identifier
 * @param submissionsDir Directory containing all submissions
 * @returns Student grading results
 */
async function processStudent(
  studentId: string,
  submissionsDir: string
): Promise<StudentResult> {
  const studentDir = path.join(submissionsDir, studentId);

  console.log(`Processing student ${studentId} in directory ${studentDir}`);

  // Initialize student result
  const studentResult: StudentResult = {
    studentId,
    implementationTests: {
      overall: false,
      details: {},
    },
    studentTests: {
      overall: false,
      details: {},
    },
    personalArt: {
      pathData: [],
    },
  };

  try {
    // Run all tests and art collection in parallel with separate directories
    const [implementationTests, studentTests, personalArt] = await Promise.all([
      runTests(studentDir, true, "implementation"),
      runTests(studentDir, false, "student"),
      collectPersonalArt(studentDir),
    ]);

    studentResult.implementationTests = implementationTests;
    studentResult.studentTests = studentTests;
    studentResult.personalArt = personalArt;
  } catch (error: any) {
    console.error(`Error processing student ${studentId}:`, error);
    studentResult.implementationTests.errors = error.message;
    studentResult.studentTests.errors = error.message;
    studentResult.personalArt.error = error.message;
  }

  return studentResult;
}

/**
 * Main autograder function
 */
async function runAutograder(): Promise<void> {
  const totalStartTime = Date.now();
  console.log("Starting PS0 autograder...");

  // Import instructor functions
  const { generateHTML, saveHTMLToFile, openHTML } =
    await importInstructorFunctions();

  // Discover student submissions
  const submissionsDir = path.join(process.cwd(), "Submissions_auto");
  const students = await discoverStudentSubmissions(submissionsDir);

  // Prepare the grading report
  const gradingReport: GradingReport = {
    timestamp: new Date().toISOString(),
    students: [],
    summary: {
      totalStudents: students.length,
      passedImplementationTests: 0,
      passedStudentTests: 0,
      personalArtGenerationSuccess: 0,
    },
    timingInfo: {
      totalTime: 0,
      studentTimes: {},
    },
  };

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

  // Calculate and set total time
  const totalEndTime = Date.now();
  if (gradingReport.timingInfo) {
    gradingReport.timingInfo.totalTime = totalEndTime - totalStartTime;
  }

  // Generate grid layout of student art
  console.log("\nGenerating student art gallery...");
  const studentsPerRow = 5;
  const canvasWidth = 400;
  const canvasHeight = 400;
  const padding = 20;
  const labelHeight = 30;

  // Calculate layout dimensions
  const totalRows = Math.ceil(gradingReport.students.length / studentsPerRow);
  const fullWidth = studentsPerRow * (canvasWidth + padding) + padding;
  const fullHeight =
    totalRows * (canvasHeight + labelHeight + padding) + padding;

  // Generate SVG elements for each student
  let svgElements = "";
  let validStudentIndex = 0;

  gradingReport.students.forEach((student) => {
    // Skip students with art generation errors
    if (student.personalArt.error) {
      return;
    }

    // Calculate position in the grid
    const row = Math.floor(validStudentIndex / studentsPerRow);
    const col = validStudentIndex % studentsPerRow;

    const xOffset = padding + col * (canvasWidth + padding);
    const yOffset = padding + row * (canvasHeight + labelHeight + padding);

    // Add student ID label
    svgElements += `
      <text 
        x="${xOffset + canvasWidth / 2}" 
        y="${yOffset + labelHeight / 2}" 
        text-anchor="middle" 
        dominant-baseline="middle" 
        font-family="Arial" 
        font-size="14" 
        font-weight="bold"
      >
        ${student.studentId}
      </text>
    `;

    // Create background for the canvas
    svgElements += `
      <rect 
        x="${xOffset}" 
        y="${yOffset + labelHeight}" 
        width="${canvasWidth}" 
        height="${canvasHeight}" 
        fill="#f0f0f0" 
        stroke="#ccc" 
        stroke-width="1"
      />
    `;

    // Add the student's art paths
    student.personalArt.pathData.forEach((segment) => {
      // Scale and center the paths within each canvas
      const x1 = segment.start.x + canvasWidth / 2;
      const y1 = segment.start.y + canvasHeight / 2 + labelHeight;
      const x2 = segment.end.x + canvasWidth / 2;
      const y2 = segment.end.y + canvasHeight / 2 + labelHeight;

      svgElements += `
        <line 
          x1="${xOffset + x1}" 
          y1="${yOffset + y1}" 
          x2="${xOffset + x2}" 
          y2="${yOffset + y2}" 
          stroke="${segment.color}" 
          stroke-width="2"
        />
      `;
    });

    validStudentIndex++;
  });

  // Create the HTML with SVG grid
  const gridHTML = `<!DOCTYPE html>
  <html>
  <head>
      <title>Student Art Gallery</title>
      <style>
          body { margin: 0; font-family: Arial, sans-serif; }
          h1 { text-align: center; margin: 20px 0; }
          .container { display: flex; justify-content: center; }
      </style>
  </head>
  <body>
      <h1>Student Art Gallery</h1>
      <div class="container">
        <svg width="${fullWidth}" height="${fullHeight}">
          ${svgElements}
        </svg>
      </div>
  </body>
  </html>`;

  await fsPromises.writeFile("student_art_gallery.html", gridHTML);

  // Create a simplified grading report without personalArt
  const simplifiedReport = {
    timestamp: gradingReport.timestamp,
    students: gradingReport.students.map((student) => ({
      studentId: student.studentId,
      implementationTests: student.implementationTests,
      studentTests: student.studentTests,
    })),
    summary: gradingReport.summary,
    timingInfo: gradingReport.timingInfo,
  };

  // Save grading report
  const reportPath = path.join(process.cwd(), "grading_report.json");
  await fsPromises.writeFile(
    reportPath,
    JSON.stringify(simplifiedReport, null, 2)
  );
  console.log(`Grading report saved to ${reportPath}`);

  // Print summary statistics
  console.log("\nGrading Summary:");
  console.log(`Total Students: ${gradingReport.summary.totalStudents}`);
  console.log(
    `Passed Instructor Tests: ${gradingReport.summary.passedImplementationTests}/${gradingReport.summary.totalStudents}`
  );
  console.log(
    `Passed Own Tests: ${gradingReport.summary.passedStudentTests}/${gradingReport.summary.totalStudents}`
  );
  console.log(
    `Successful Art Generation: ${gradingReport.summary.personalArtGenerationSuccess}/${gradingReport.summary.totalStudents}`
  );

  if (gradingReport.timingInfo) {
    const totalMinutes = (
      gradingReport.timingInfo.totalTime /
      1000 /
      60
    ).toFixed(2);
    console.log(`\nTotal time: ${totalMinutes} minutes`);

    // Show the 5 slowest students
    const sortedTimes = Object.entries(gradingReport.timingInfo.studentTimes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    console.log(`\nSlowest 5 students:`);
    sortedTimes.forEach(([studentId, time], index) => {
      console.log(
        `${index + 1}. ${studentId}: ${(time / 1000).toFixed(2)} seconds`
      );
    });
  }

  // Open the grid art visualization
  console.log("\nOpening student art gallery visualization...");
  openHTML("student_art_gallery.html");
}

// Run the autograder if this file is executed directly
if (require.main === module) {
  runAutograder().catch((error) => {
    console.error("Error running autograder:", error);
    process.exit(1);
  });
}
