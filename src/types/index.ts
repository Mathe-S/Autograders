// Define Point and Color types without importing from outside rootDir
export interface Point {
  x: number;
  y: number;
}

export type Color =
  | "black"
  | "red"
  | "green"
  | "blue"
  | "yellow"
  | "purple"
  | "orange"
  | "cyan"
  | "magenta"
  | "white";

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
 * Coverage result from c8
 */
export interface CoverageResult {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

/**
 * Student test result with coverage information
 */
export interface StudentTestResult {
  overall: boolean;
  details: { [testName: string]: boolean };
  coverage?: CoverageResult;
  errors?: string;
}

/**
 * Personal art generation result
 */
export interface PersonalArtResult {
  pathData: { start: Point; end: Point; color: Color }[];
  error?: string;
}

/**
 * Similarity information for a student
 */
export interface StudentSimilarityInfo {
  otherStudent: string;
  similarity: number;
}

/**
 * Result for a single student
 */
export interface StudentResult {
  studentId: string;
  implementationTests: TestResult;
  studentTests: StudentTestResult;
  personalArt: PersonalArtResult;
}

/**
 * Processed student result with status and similarity info
 */
export interface ProcessedStudentResult {
  studentId: string;
  status: "passed"; // Only using passed status now that we're skipping implementation tests
  notes: string[];
  implementationTests: TestResult;
  studentTests: StudentTestResult;
  personalArt: PersonalArtResult;
  similarityInfo?: StudentSimilarityInfo;
  points: number; // Assignment points (0-30)
}

/**
 * Status counts in the grading report
 */
export interface StatusCounts {
  passed: number;
  failed: number;
  errors: number;
  unknown: number;
}

/**
 * Complete grading report format
 */
export interface GradingReport {
  timestamp: string;
  totalStudents: number;
  statusCounts: StatusCounts;
  passingPercentage: number;
  executionTimeSeconds: number;
  averageCoverage?: CoverageResult;
  students: ProcessedStudentResult[];
  highSimilarityCount?: number;
  totalPoints: number;
  averagePoints: number;
}
