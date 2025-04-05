// Define Point and Color types without importing from outside rootDir
export interface Point {
  x: number;
  y: number;
}

export type Color = string;

/**
 * Type definitions for test results
 */
export interface TestResult {
  overall: boolean;
  details: {
    [testName: string]: boolean;
  };
  errors?: string;
}

/**
 * Type definitions for coverage results
 */
export interface CoverageResult {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

/**
 * Type definitions for student test results
 */
export interface StudentTestResult extends TestResult {
  coverage?: CoverageResult;
}

/**
 * Type definitions for student-specific results
 */
export interface StudentResult {
  studentId: string;
  implementationTests: TestResult;
  studentTests: StudentTestResult;
  personalArt: {
    pathData: { start: Point; end: Point; color: Color }[];
    error?: string;
  };
}

/**
 * Type definitions for overall grading report
 */
export interface GradingReport {
  timestamp: string;
  students: StudentResult[];
  summary: {
    totalStudents: number;
    passedImplementationTests: number;
    passedStudentTests: number;
    personalArtGenerationSuccess: number;
    averageCoverage?: CoverageResult;
  };
  timingInfo?: {
    totalTime: number;
    studentTimes: { [studentId: string]: number };
  };
}
