import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { TestResult, StudentTestResult } from "../types";
import * as fsUtils from "../utils/fs-utils";

const execAsync = promisify(exec);

/**
 * Run Mocha tests programmatically with a specific turtlesoup implementation
 * @param studentDir The student's directory
 * @param useInstructorTests Whether to use instructor tests or student tests
 * @param operation The operation being tested ('implementation', 'student', or 'art')
 * @returns Test results with pass/fail status
 */
export async function runTests(
  studentDir: string,
  useInstructorTests: boolean,
  operation: "implementation" | "student" | "art"
): Promise<TestResult | StudentTestResult> {
  // Prepare the environment for testing with a unique directory for each operation
  const tmpTestDir = path.join(studentDir, `tmp_${operation}`);

  try {
    // Create fresh temporary test directory
    await fsUtils.createTempDirectory(studentDir, `tmp_${operation}`);

    // Set up the test environment
    try {
      if (useInstructorTests) {
        // Test student implementation against instructor tests
        console.log(`Setting up instructor tests environment in ${tmpTestDir}`);
        await setupInstructorTestsEnvironment(studentDir, tmpTestDir);
      } else {
        // Test instructor implementation against student tests
        console.log(`Setting up student tests environment in ${tmpTestDir}`);
        await setupStudentTestsEnvironment(studentDir, tmpTestDir);
      }
    } catch (error: any) {
      // Handle setup errors
      console.error(`Error setting up tests for ${studentDir}:`, error);
      return {
        overall: false,
        details: {},
        errors: `Error setting up test environment: ${error.message}`,
      };
    }

    // Run the tests
    try {
      let cmd: string;
      if (useInstructorTests) {
        cmd = `cd ${tmpTestDir} && npx mocha -r ts-node/register turtlesoupTest.ts --reporter json`;
      } else {
        // Use c8 to collect coverage data for student tests
        // Run c8 and mocha separately to avoid mixing outputs
        cmd = `cd ${tmpTestDir} && npx c8 --include=turtlesoup.ts --reporter=json --reporter=text --report-dir=coverage mocha -r ts-node/register turtlesoupTest.ts > /dev/null 2> c8_output.txt && npx mocha -r ts-node/register turtlesoupTest.ts --reporter json > mocha_output.json 2>&1 || echo "Tests completed with errors" >> c8_output.txt`;
      }

      const { stdout: output } = await execAsync(cmd, {
        maxBuffer: 1024 * 1024, // Increase buffer size to 1MB
        timeout: 15000, // 15 second timeout
      });

      // Process test results
      return await processTestResults(tmpTestDir, useInstructorTests, output);
    } catch (cmdError: any) {
      // Handle command errors
      return processCommandError(cmdError, tmpTestDir, useInstructorTests);
    } finally {
      // Preserve coverage data if applicable
      if (!useInstructorTests) {
        await preserveCoverageData(tmpTestDir, studentDir);
      }

      // Clean up
      await fsUtils.removeDirectory(tmpTestDir);
    }
  } catch (error: any) {
    // Handle any other errors
    await fsUtils.removeDirectory(tmpTestDir);

    return {
      overall: false,
      details: {},
      errors: error.message,
    };
  }
}

/**
 * Set up the environment for instructor tests
 */
async function setupInstructorTestsEnvironment(
  studentDir: string,
  tmpTestDir: string
): Promise<void> {
  const rootDir = process.cwd();

  // Copy instructor's turtle.ts and student's turtlesoup.ts
  await fsUtils.copyFile(
    path.join(rootDir, "instructor/src", "turtle.ts"),
    path.join(tmpTestDir, "turtle.ts")
  );
  await fsUtils.copyFile(
    path.join(studentDir, "src", "turtlesoup.ts"),
    path.join(tmpTestDir, "turtlesoup.ts")
  );

  // Fix imports in the instructor test file
  const testContent = (
    await fsUtils.readFile(
      path.join(rootDir, "instructor/test", "turtlesoupTest.ts")
    )
  )
    .replace(/from "\.\.\/src\/turtlesoup"/g, 'from "./turtlesoup"')
    .replace(/from "\.\.\/src\/turtle"/g, 'from "./turtle"');

  await fsUtils.writeFile(
    path.join(tmpTestDir, "turtlesoupTest.ts"),
    testContent
  );
}

/**
 * Set up the environment for student tests
 */
async function setupStudentTestsEnvironment(
  studentDir: string,
  tmpTestDir: string
): Promise<void> {
  const rootDir = process.cwd();

  // Copy instructor's turtle.ts and turtlesoup.ts
  await fsUtils.copyFile(
    path.join(rootDir, "instructor/src", "turtle.ts"),
    path.join(tmpTestDir, "turtle.ts")
  );
  await fsUtils.copyFile(
    path.join(rootDir, "instructor/src", "turtlesoup.ts"),
    path.join(tmpTestDir, "turtlesoup.ts")
  );

  // Check if student test file exists
  const studentTestPath = path.join(studentDir, "test", "turtlesoupTest.ts");

  if (!(await fsUtils.fileExists(studentTestPath))) {
    console.log(`Student test file not found at ${studentTestPath}`);
    throw new Error("Student test file does not exist");
  }

  // Fix imports in the student test file
  const testContent = (await fsUtils.readFile(studentTestPath))
    .replace(/from ["']\.\.\/src\/turtlesoup["']/g, 'from "./turtlesoup"')
    .replace(/from ["']\.\/turtlesoup["']/g, 'from "./turtlesoup"')
    .replace(/from ["']\.\.\/src\/turtle["']/g, 'from "./turtle"')
    .replace(/from ["']\.\/turtle["']/g, 'from "./turtle"');

  await fsUtils.writeFile(
    path.join(tmpTestDir, "turtlesoupTest.ts"),
    testContent
  );
}

/**
 * Process test results from Mocha output
 */
async function processTestResults(
  tmpTestDir: string,
  useInstructorTests: boolean,
  output: string
): Promise<TestResult | StudentTestResult> {
  let mochaOutput = output;

  // For student tests, get the output from the file
  if (!useInstructorTests) {
    try {
      const mochaOutputPath = path.join(tmpTestDir, "mocha_output.json");
      if (await fsUtils.fileExists(mochaOutputPath)) {
        mochaOutput = await fsUtils.readFile(mochaOutputPath);
        console.log(`Read Mocha output from file: ${mochaOutputPath}`);
      }

      const c8OutputPath = path.join(tmpTestDir, "c8_output.txt");
      if (await fsUtils.fileExists(c8OutputPath)) {
        const c8Output = await fsUtils.readFile(c8OutputPath);
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

    // If running student tests, process coverage data
    if (!useInstructorTests) {
      const coverageData = await extractCoverageData(tmpTestDir);
      if (coverageData) {
        return {
          overall: allPassed && Object.keys(testResults).length > 0,
          details: testResults,
          coverage: coverageData,
        };
      }
    }

    return {
      overall: allPassed && Object.keys(testResults).length > 0,
      details: testResults,
    };
  } catch (parseError: any) {
    // Even if we can't parse the test results, try to get coverage data
    if (!useInstructorTests) {
      const coverageData = await extractCoverageData(tmpTestDir);
      if (coverageData) {
        return {
          overall: false,
          details: {},
          errors: `Error parsing test results: ${parseError.message}`,
          coverage: coverageData,
        };
      }
    }

    return {
      overall: false,
      details: {},
      errors: `Error parsing test results: ${parseError.message}`,
    };
  }
}

/**
 * Process errors that occur when running the command
 */
async function processCommandError(
  cmdError: any,
  tmpTestDir: string,
  useInstructorTests: boolean
): Promise<TestResult | StudentTestResult> {
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
        const coverageData = await extractCoverageData(tmpTestDir);
        if (coverageData) {
          return {
            overall: false,
            details: testResults,
            errors: cmdError.message,
            coverage: coverageData,
          };
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
}

/**
 * Extract coverage data from c8 output
 */
async function extractCoverageData(tmpTestDir: string): Promise<
  | {
      lines: number;
      statements: number;
      functions: number;
      branches: number;
    }
  | undefined
> {
  try {
    const coverageFilePath = path.join(
      tmpTestDir,
      "coverage",
      "coverage-final.json"
    );

    if (await fsUtils.fileExists(coverageFilePath)) {
      const coverageData = JSON.parse(await fsUtils.readFile(coverageFilePath));

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
          totalStatements += Object.keys(fileCoverage.statementMap).length;
          coveredStatements += Object.values(fileCoverage.s).filter(
            (v) => (v as number) > 0
          ).length;

          // Branches
          totalBranches += Object.keys(fileCoverage.branchMap).length * 2;
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
          totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0,
      };
    }
  } catch (coverageError) {
    console.warn(`Error parsing coverage data: ${coverageError}`);
  }

  return undefined;
}

/**
 * Copy coverage data to a persistent location
 */
async function preserveCoverageData(
  tmpTestDir: string,
  studentDir: string
): Promise<void> {
  try {
    const coverageDir = path.join(tmpTestDir, "coverage");
    const studentCoverageDir = path.join(studentDir, "coverage");

    if (await fsUtils.fileExists(coverageDir)) {
      // Ensure student coverage directory exists
      await fsUtils.createTempDirectory(studentDir, "coverage");

      // Copy the coverage-final.json file if it exists
      const coverageFilePath = path.join(coverageDir, "coverage-final.json");
      if (await fsUtils.fileExists(coverageFilePath)) {
        await fsUtils.copyFile(
          coverageFilePath,
          path.join(studentCoverageDir, "coverage-final.json")
        );
      }
    }
  } catch (e) {
    // Ignore errors when copying coverage data
    console.warn(`Could not copy coverage data: ${e}`);
  }
}
