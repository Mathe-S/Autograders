// Define Point and Color types without importing from outside rootDir
// export interface Point { ... } // Removed
// export type Color = ...; // Removed

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

// /**
//  * Coverage result from c8
//  */
// export interface CoverageResult { ... } // Removed

/**
 * Student test result with coverage information
 */
export interface StudentTestResult {
  overall: boolean;
  details: { [testName: string]: boolean };
  // coverage?: CoverageResult; // Removed as CoverageResult is removed
  errors?: string;
}

// /**
//  * Personal art generation result
//  */
// export interface PersonalArtResult { ... } // Removed

/**
 * Similarity information for a student
 */
export interface StudentSimilarityInfo {
  otherStudent: string;
  similarity: number;
}

// /**
//  * Function implementation status
//  */
// export interface FunctionImplementationStatus { ... } // Removed

// /**
//  * Overall implementation status for a student
//  */
// export interface ImplementationStatus { ... } // ImplementationStatus itself should be removed, not just FunctionImplementationStatus

/**
 * Result for a single student (Original, might be less relevant now without some sub-types)
 * Consider if this is still needed or if ProcessedStudentResult is sufficient.
 * For now, keeping it but noting its reduced scope.
 */
export interface StudentResult {
  studentId: string;
  implementationTests: TestResult;
  studentTests: StudentTestResult;
  // personalArt: PersonalArtResult; // Removed
  // implementationStatus: ImplementationStatus; // Removed
}

/**
 * Processed student result with status and similarity info
 */
export interface ProcessedStudentResult {
  studentId: string; // Corresponds to "Email" from CSV
  status: "passed" | "failed" | "error";
  notes: string[];
  implementationTests: TestResult; // Will be mocked/defaulted for this assignment
  studentTests: StudentTestResult; // Will represent backend/frontend tests
  // personalArt: PersonalArtResult; // Removed as PersonalArtResult type is removed
  // implementationStatus: ImplementationStatus; // Removed as ImplementationStatus type is removed
  similarityInfo?: StudentSimilarityInfo; // Not applicable for this assignment, but type remains
  points: number; // Assignment points (0-30 for backend/frontend)
  backendUrl?: string; // Store for reference
  frontendUrl?: string; // Store for reference
}

/**
 * Status counts in the grading report
 */
export interface StatusCounts {
  passed: number;
  failed: number;
  errors: number;
  unknown: number; // Or remove if not used
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
  // averageCoverage?: CoverageResult; // Removed as CoverageResult type is removed
  students: ProcessedStudentResult[];
  highSimilarityCount?: number; // Not applicable for this assignment, but type remains
  totalPoints: number; // Sum of all student points (considering max 30 per student)
  averagePoints: number;
}

// New interface for raw student data from CSV
export interface RawStudentData {
  StudentName: string;
  Email: string;
  GitHubUrl: string;
  RepositoryName: string;
  SubmittedAt: string;
  Grade: string;
  Backendurlendpoint: string;
  Frontendurl: string;
}
