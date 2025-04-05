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
    coverage?: {
      lines: number;
      statements: number;
      functions: number;
      branches: number;
    };
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
    averageCoverage?: {
      lines: number;
      statements: number;
      functions: number;
      branches: number;
    };
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
  coverage?: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
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
        console.log(`Setting up instructor tests environment in ${tmpTestDir}`);
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
        console.log(`Setting up student tests environment in ${tmpTestDir}`);

        // This time we'll create fresh files instead of symlinks
        // First, copy the instructor's implementation
        await fsPromises.copyFile(
          path.join(process.cwd(), "instructor/src", "turtle.ts"),
          path.join(tmpTestDir, "turtle.ts")
        );
        await fsPromises.copyFile(
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
          console.log(`Found student test file at ${studentTestPath}`);
        } catch {
          console.log(`Student test file not found at ${studentTestPath}`);
          return {
            overall: false,
            details: {},
            errors: "Student test file does not exist",
          };
        }

        // Read and fix the student's test file
        const testContent = (
          await fsPromises.readFile(studentTestPath, "utf-8")
        )
          .replace(/from ["']\.\.\/src\/turtlesoup["']/g, 'from "./turtlesoup"')
          .replace(/from ["']\.\/turtlesoup["']/g, 'from "./turtlesoup"')
          .replace(/from ["']\.\.\/src\/turtle["']/g, 'from "./turtle"')
          .replace(/from ["']\.\/turtle["']/g, 'from "./turtle"');

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
      let cmd: string;
      if (useInstructorTests) {
        cmd = `cd ${tmpTestDir} && npx mocha -r ts-node/register turtlesoupTest.ts --reporter json`;
      } else {
        // Use c8 to collect coverage data for student tests
        // Run c8 and mocha separately to avoid mixing outputs
        // First run coverage to generate coverage data
        cmd = `cd ${tmpTestDir} && npx c8 --include=turtlesoup.ts --reporter=json --reporter=text --report-dir=coverage mocha -r ts-node/register turtlesoupTest.ts > /dev/null 2> c8_output.txt && npx mocha -r ts-node/register turtlesoupTest.ts --reporter json > mocha_output.json 2>&1 || echo "Tests completed with errors" >> c8_output.txt`;
      }

      const { stdout: output } = await execAsync(cmd, {
        maxBuffer: 1024 * 1024, // Increase buffer size to 1MB
        timeout: 15000, // 15 second timeout
      });

      // For student tests, check the mocha output file
      let mochaOutput = output;
      if (!useInstructorTests) {
        try {
          // Try to read the saved mocha output
          const mochaOutputPath = path.join(tmpTestDir, "mocha_output.json");
          if (
            await fsPromises
              .access(mochaOutputPath)
              .then(() => true)
              .catch(() => false)
          ) {
            mochaOutput = await fsPromises.readFile(mochaOutputPath, "utf-8");
            console.log(`Read Mocha output from file: ${mochaOutputPath}`);
          }

          // Log c8 output for debugging
          const c8OutputPath = path.join(tmpTestDir, "c8_output.txt");
          if (
            await fsPromises
              .access(c8OutputPath)
              .then(() => true)
              .catch(() => false)
          ) {
            const c8Output = await fsPromises.readFile(c8OutputPath, "utf-8");
            console.log(`C8 output: ${c8Output}`);
          }
        } catch (e) {
          console.warn(`Error reading output files: ${e}`);
        }
      }

      // Parse the JSON output from Mocha
      try {
        const results = JSON.parse(mochaOutput);
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

        // If we're running student tests with coverage, check if coverage data was generated
        if (!useInstructorTests) {
          try {
            const coverageFilePath = path.join(
              tmpTestDir,
              "coverage",
              "coverage-final.json"
            );
            if (
              await fsPromises
                .access(coverageFilePath)
                .then(() => true)
                .catch(() => false)
            ) {
              const coverageData = JSON.parse(
                await fsPromises.readFile(coverageFilePath, "utf-8")
              );

              // Extract coverage metrics
              let totalStatements = 0;
              let coveredStatements = 0;
              let totalBranches = 0;
              let coveredBranches = 0;
              let totalFunctions = 0;
              let coveredFunctions = 0;
              let totalLines = 0;
              let coveredLines = 0;

              // Process coverage data for each file
              for (const filePath in coverageData) {
                if (filePath.includes("turtlesoup.ts")) {
                  const fileCoverage = coverageData[filePath];

                  // Statements
                  totalStatements += Object.keys(
                    fileCoverage.statementMap
                  ).length;
                  coveredStatements += Object.values(fileCoverage.s).filter(
                    (v) => (v as number) > 0
                  ).length;

                  // Branches
                  totalBranches +=
                    Object.keys(fileCoverage.branchMap).length * 2;
                  coveredBranches += Object.values(fileCoverage.b)
                    .flat()
                    .filter((v) => (v as number) > 0).length;

                  // Functions
                  totalFunctions += Object.keys(fileCoverage.fnMap).length;
                  coveredFunctions += Object.values(fileCoverage.f).filter(
                    (v) => (v as number) > 0
                  ).length;

                  // Lines
                  totalLines += Object.keys(
                    fileCoverage.lineMap || fileCoverage.statementMap
                  ).length;
                  coveredLines += Object.values(
                    fileCoverage.l || fileCoverage.s
                  ).filter((v) => (v as number) > 0).length;
                }
              }

              // Calculate percentages
              return {
                overall: allPassed && Object.keys(testResults).length > 0,
                details: testResults,
                coverage: {
                  statements:
                    totalStatements > 0
                      ? Math.round((coveredStatements / totalStatements) * 100)
                      : 0,
                  branches:
                    totalBranches > 0
                      ? Math.round((coveredBranches / totalBranches) * 100)
                      : 0,
                  functions:
                    totalFunctions > 0
                      ? Math.round((coveredFunctions / totalFunctions) * 100)
                      : 0,
                  lines:
                    totalLines > 0
                      ? Math.round((coveredLines / totalLines) * 100)
                      : 0,
                },
              };
            }
          } catch (coverageError) {
            console.warn(`Error parsing coverage data: ${coverageError}`);
            // Continue without coverage data if there's an error
          }
        }

        return {
          overall: allPassed && Object.keys(testResults).length > 0,
          details: testResults,
        };
      } catch (parseError: any) {
        // Even if we can't parse the test results, try to get coverage data
        if (!useInstructorTests) {
          try {
            const coverageFilePath = path.join(
              tmpTestDir,
              "coverage",
              "coverage-final.json"
            );
            if (
              await fsPromises
                .access(coverageFilePath)
                .then(() => true)
                .catch(() => false)
            ) {
              const coverageData = JSON.parse(
                await fsPromises.readFile(coverageFilePath, "utf-8")
              );

              // Extract coverage metrics
              let totalStatements = 0;
              let coveredStatements = 0;
              let totalBranches = 0;
              let coveredBranches = 0;
              let totalFunctions = 0;
              let coveredFunctions = 0;
              let totalLines = 0;
              let coveredLines = 0;

              // Process coverage data for each file
              for (const filePath in coverageData) {
                if (filePath.includes("turtlesoup.ts")) {
                  const fileCoverage = coverageData[filePath];

                  // Statements
                  totalStatements += Object.keys(
                    fileCoverage.statementMap
                  ).length;
                  coveredStatements += Object.values(fileCoverage.s).filter(
                    (v) => (v as number) > 0
                  ).length;

                  // Branches
                  totalBranches +=
                    Object.keys(fileCoverage.branchMap).length * 2;
                  coveredBranches += Object.values(fileCoverage.b)
                    .flat()
                    .filter((v) => (v as number) > 0).length;

                  // Functions
                  totalFunctions += Object.keys(fileCoverage.fnMap).length;
                  coveredFunctions += Object.values(fileCoverage.f).filter(
                    (v) => (v as number) > 0
                  ).length;

                  // Lines
                  totalLines += Object.keys(
                    fileCoverage.lineMap || fileCoverage.statementMap
                  ).length;
                  coveredLines += Object.values(
                    fileCoverage.l || fileCoverage.s
                  ).filter((v) => (v as number) > 0).length;
                }
              }

              return {
                overall: false,
                details: {},
                errors: `Error parsing test results: ${parseError.message}`,
                coverage: {
                  statements:
                    totalStatements > 0
                      ? Math.round((coveredStatements / totalStatements) * 100)
                      : 0,
                  branches:
                    totalBranches > 0
                      ? Math.round((coveredBranches / totalBranches) * 100)
                      : 0,
                  functions:
                    totalFunctions > 0
                      ? Math.round((coveredFunctions / totalFunctions) * 100)
                      : 0,
                  lines:
                    totalLines > 0
                      ? Math.round((coveredLines / totalLines) * 100)
                      : 0,
                },
              };
            }
          } catch (coverageError) {
            console.warn(`Error parsing coverage data: ${coverageError}`);
          }
        }

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

          // Try to get coverage data even on test failures
          if (!useInstructorTests) {
            try {
              const coverageFilePath = path.join(
                tmpTestDir,
                "coverage",
                "coverage-final.json"
              );
              if (
                await fsPromises
                  .access(coverageFilePath)
                  .then(() => true)
                  .catch(() => false)
              ) {
                const coverageData = JSON.parse(
                  await fsPromises.readFile(coverageFilePath, "utf-8")
                );

                // Extract coverage metrics (similar to above)
                let totalStatements = 0;
                let coveredStatements = 0;
                let totalBranches = 0;
                let coveredBranches = 0;
                let totalFunctions = 0;
                let coveredFunctions = 0;
                let totalLines = 0;
                let coveredLines = 0;

                for (const filePath in coverageData) {
                  if (filePath.includes("turtlesoup.ts")) {
                    const fileCoverage = coverageData[filePath];

                    // Statements
                    totalStatements += Object.keys(
                      fileCoverage.statementMap
                    ).length;
                    coveredStatements += Object.values(fileCoverage.s).filter(
                      (v) => (v as number) > 0
                    ).length;

                    // Branches
                    totalBranches +=
                      Object.keys(fileCoverage.branchMap).length * 2;
                    coveredBranches += Object.values(fileCoverage.b)
                      .flat()
                      .filter((v) => (v as number) > 0).length;

                    // Functions
                    totalFunctions += Object.keys(fileCoverage.fnMap).length;
                    coveredFunctions += Object.values(fileCoverage.f).filter(
                      (v) => (v as number) > 0
                    ).length;

                    // Lines
                    totalLines += Object.keys(
                      fileCoverage.lineMap || fileCoverage.statementMap
                    ).length;
                    coveredLines += Object.values(
                      fileCoverage.l || fileCoverage.s
                    ).filter((v) => (v as number) > 0).length;
                  }
                }

                return {
                  overall: false,
                  details: testResults,
                  errors: cmdError.message,
                  coverage: {
                    statements:
                      totalStatements > 0
                        ? Math.round(
                            (coveredStatements / totalStatements) * 100
                          )
                        : 0,
                    branches:
                      totalBranches > 0
                        ? Math.round((coveredBranches / totalBranches) * 100)
                        : 0,
                    functions:
                      totalFunctions > 0
                        ? Math.round((coveredFunctions / totalFunctions) * 100)
                        : 0,
                    lines:
                      totalLines > 0
                        ? Math.round((coveredLines / totalLines) * 100)
                        : 0,
                  },
                };
              }
            } catch (coverageError) {
              console.warn(
                `Error parsing coverage data after test failure: ${coverageError}`
              );
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
      // Copy coverage data to a persistent location if it exists
      if (!useInstructorTests) {
        try {
          const coverageDir = path.join(tmpTestDir, "coverage");
          const studentCoverageDir = path.join(studentDir, "coverage");

          if (
            await fsPromises
              .access(coverageDir)
              .then(() => true)
              .catch(() => false)
          ) {
            // Ensure student coverage directory exists
            await fsPromises.mkdir(studentCoverageDir, { recursive: true });

            // Copy the coverage-final.json file
            await fsPromises.copyFile(
              path.join(coverageDir, "coverage-final.json"),
              path.join(studentCoverageDir, "coverage-final.json")
            );
          }
        } catch (e) {
          // Ignore errors when copying coverage data
          console.warn(`Could not copy coverage data: ${e}`);
        }
      }

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

  // Calculate average coverage metrics
  let totalLines = 0;
  let totalStatements = 0;
  let totalFunctions = 0;
  let totalBranches = 0;
  let coverageCount = 0;

  gradingReport.students.forEach((student) => {
    if (student.studentTests.coverage) {
      totalLines += student.studentTests.coverage.lines;
      totalStatements += student.studentTests.coverage.statements;
      totalFunctions += student.studentTests.coverage.functions;
      totalBranches += student.studentTests.coverage.branches;
      coverageCount++;
    }
  });

  if (coverageCount > 0) {
    gradingReport.summary.averageCoverage = {
      lines: Math.round(totalLines / coverageCount),
      statements: Math.round(totalStatements / coverageCount),
      functions: Math.round(totalFunctions / coverageCount),
      branches: Math.round(totalBranches / coverageCount),
    };
  }

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

  // Print coverage summary if available
  if (gradingReport.summary.averageCoverage) {
    console.log("\nAverage Test Coverage:");
    console.log(`Lines: ${gradingReport.summary.averageCoverage.lines}%`);
    console.log(
      `Statements: ${gradingReport.summary.averageCoverage.statements}%`
    );
    console.log(
      `Functions: ${gradingReport.summary.averageCoverage.functions}%`
    );
    console.log(`Branches: ${gradingReport.summary.averageCoverage.branches}%`);
  }

  if (gradingReport.timingInfo) {
    const totalMinutes = (
      gradingReport.timingInfo.totalTime /
      1000 /
      60
    ).toFixed(2);
    console.log(`\nTotal time: ${totalMinutes} minutes`);
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
