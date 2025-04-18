// Define Point and Color types without importing from outside rootDir
export interface Point {
  x: number;
  y: number;
}

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
 * Similarity information for a student
 */
export interface StudentSimilarityInfo {
  otherStudent: string;
  similarity: number;
}

/**
 * Function implementation status
 */
export interface FunctionImplementationStatus {
  name: string;
  implemented: boolean;
  points: number;
  isDefaultImplementation?: boolean; // Flag to track if function is a default implementation
}

/**
 * Overall implementation status for a student
 */
export interface ImplementationStatus {
  functionStatus: FunctionImplementationStatus[];
  totalPointsDeduction: number;
  implementationSummary: string;
}

/**
 * Manual grading result from the "lecturer"
 */
export interface ManualGradingResult {
  computeProgressScore: number; // Score for computeProgress function (0-10 points)
  overallScore: number; // Overall score (0-40 points)
  feedback: string; // Feedback for improvement
  strengths: string[]; // Key strengths identified
  weaknesses: string[]; // Areas for improvement
  improvements: string[]; // Specific code improvement suggestions for resubmission
  implementedFunctions: string[]; // List of functions the LLM has determined are implemented
}

/**
 * Result for a single student
 */
export interface StudentResult {
  studentId: string;
  implementationTests: TestResult;
  studentTests: StudentTestResult;
  implementationStatus: ImplementationStatus;
  manualGradingResult?: ManualGradingResult; // Manual grading result from "lecturer"
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
  implementationStatus: ImplementationStatus;
  similarityInfo?: StudentSimilarityInfo;
  points: number; // Assignment points (0-30)
  manualGradingResult?: ManualGradingResult; // Manual grading result from "lecturer"
  totalPoints?: number; // Combined points from implementation and manual grading (0-40)
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
