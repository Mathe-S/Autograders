import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const readFileAsync = promisify(fs.readFile);

/**
 * Interface for similarity comparison result between two students
 */
export interface SimilarityResult {
  student1: string;
  student2: string;
  similarity: number; // Percentage of similarity (0-100)
  details?: {
    turtlesoupSimilarity: number;
    testSimilarity?: number; // Make test similarity optional since we're not using it
  };
}

/**
 * Interface for the overall similarity report
 */
export interface SimilarityReport {
  timestamp: string;
  comparisons: SimilarityResult[];
  highSimilarityPairs: SimilarityResult[]; // Pairs with similarity above threshold
  averageSimilarity: number;
  earlyExit: boolean;
  perfectMatch?: { student1: string; student2: string };
  defaultImplementations?: {
    [studentId: string]: string[]; // List of function names that match default implementation
  };
}

/**
 * Interface for default implementation detection result
 */
export interface DefaultImplementationResult {
  studentId: string;
  defaultFunctions: string[]; // List of function names matching default implementation
  wholeCopyPaste: boolean;
}

/**
 * Calculates text similarity between two strings using Jaccard similarity
 * This method is more robust than simple string comparison
 * @param text1 First text to compare
 * @param text2 Second text to compare
 * @returns Similarity score between 0 and 1
 */
function calculateJaccardSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  // Normalize and tokenize the text
  const normalize = (text: string) => {
    // Remove comments
    const noComments = text.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "");
    // Remove whitespace
    const noWhitespace = noComments.replace(/\s+/g, " ").trim();
    // Split into tokens (words, operators, etc.)
    return noWhitespace
      .split(/[\s,;{}()\[\]<>=!+\-*/%&|^~?:]+/)
      .filter(Boolean);
  };

  const tokens1 = new Set(normalize(text1));
  const tokens2 = new Set(normalize(text2));

  if (tokens1.size === 0 && tokens2.size === 0) return 0;

  // Calculate intersection
  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));

  // Calculate union
  const union = new Set([...tokens1, ...tokens2]);

  // Jaccard similarity
  return intersection.size / union.size;
}

/**
 * Calculates Levenshtein distance between two strings
 * @param text1 First text
 * @param text2 Second text
 * @returns Normalized similarity score between 0 and 1
 */
function calculateLevenshteinSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  // Normalize text - remove comments and whitespace
  const normalize = (text: string) => {
    return text
      .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "") // Remove comments
      .replace(/\s+/g, "") // Remove all whitespace
      .toLowerCase(); // Convert to lowercase
  };

  const s1 = normalize(text1);
  const s2 = normalize(text2);

  const len1 = s1.length;
  const len2 = s2.length;

  // Zero length check
  if (len1 === 0) return 0;
  if (len2 === 0) return 0;

  // Create distance matrix
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // Deletion
        matrix[i][j - 1] + 1, // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  // The last cell contains the distance
  const distance = matrix[len1][len2];

  // Normalize to a similarity score (0-1)
  const maxLength = Math.max(len1, len2);
  return 1 - distance / maxLength;
}

/**
 * Reads file content or returns empty string if file doesn't exist
 */
async function readFileContent(filePath: string): Promise<string> {
  try {
    return await readFileAsync(filePath, "utf8");
  } catch (e) {
    return "";
  }
}

/**
 * Compare a single file between two students
 */
async function compareFile(
  submissionsDir: string,
  student1: string,
  student2: string,
  filePath: string
): Promise<number> {
  const filePath1 = path.join(submissionsDir, student1, filePath);
  const filePath2 = path.join(submissionsDir, student2, filePath);

  // Read both files in parallel
  const [content1, content2] = await Promise.all([
    readFileContent(filePath1),
    readFileContent(filePath2),
  ]);

  // Skip if either file is empty
  if (!content1 || !content2) return 0;

  // Calculate similarity using both methods
  const jaccardScore = calculateJaccardSimilarity(content1, content2);
  const levenshteinScore = calculateLevenshteinSimilarity(content1, content2);

  // Weighted average of both measures
  return jaccardScore * 0.7 + levenshteinScore * 0.3;
}

/**
 * Extract a specific function from a source file
 * @param sourceCode Complete source code
 * @param functionName Name of the function to extract
 * @returns Function body or empty string if not found
 */
function extractFunction(sourceCode: string, functionName: string): string {
  const functionPattern = new RegExp(
    `export\\s+function\\s+${functionName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]*)?{([^}]*)}`,
    "s"
  );
  const match = sourceCode.match(functionPattern);
  return match ? match[1].trim() : "";
}

/**
 * Reads and compares files from two student directories
 * @param submissionsDir Base directory containing all submissions
 * @param student1 First student ID
 * @param student2 Second student ID
 * @returns Similarity result between the two students
 */
export async function compareStudents(
  submissionsDir: string,
  student1: string,
  student2: string
): Promise<SimilarityResult> {
  // Only compare turtlesoup.ts file - no weighting needed since it's the only file
  const filesToCompare = [{ path: "src/turtlesoup.ts", weight: 1 }];

  try {
    // Compare all files in parallel
    const fileResults = await Promise.all(
      filesToCompare.map(async (file) => {
        try {
          const similarity = await compareFile(
            submissionsDir,
            student1,
            student2,
            file.path
          );

          return {
            path: file.path,
            similarity,
            weight: file.weight,
          };
        } catch (error) {
          console.error(
            `Error comparing ${file.path} for ${student1} and ${student2}:`,
            error
          );
          return { path: file.path, similarity: 0, weight: file.weight };
        }
      })
    );

    // Calculate weighted total
    let totalSimilarity = 0;
    let totalWeight = 0;
    const details: Record<string, number> = {};

    for (const result of fileResults) {
      if (result.similarity > 0) {
        totalSimilarity += result.similarity * result.weight;
        totalWeight += result.weight;

        // Store in details
        const fileKey = path.basename(result.path).replace(".ts", "Similarity");
        details[fileKey] = Math.round(result.similarity * 100);
      }
    }

    // Calculate overall similarity percentage (0-100)
    const overallSimilarity =
      totalWeight > 0 ? Math.round((totalSimilarity / totalWeight) * 100) : 0;

    return {
      student1,
      student2,
      similarity: overallSimilarity,
      details: {
        turtlesoupSimilarity: details.turtlesoupSimilarity || 0,
        // No testSimilarity since we're not comparing test files
      },
    };
  } catch (error) {
    console.error(
      `Error comparing students ${student1} and ${student2}:`,
      error
    );
    return {
      student1,
      student2,
      similarity: 0,
      details: {
        turtlesoupSimilarity: 0,
      },
    };
  }
}

/**
 * Compare student's implementation with instructor's default implementation
 * @param submissionsDir Base directory containing submissions
 * @param studentId Student ID
 * @returns List of functions that match the default implementation
 */
export async function checkDefaultImplementation(
  submissionsDir: string,
  studentId: string
): Promise<DefaultImplementationResult> {
  const rootDir = process.cwd();
  const instructorFile = path.join(
    rootDir,
    "instructor",
    "src",
    "turtlesoup.ts"
  );
  const studentFile = path.join(
    submissionsDir,
    studentId,
    "src",
    "turtlesoup.ts"
  );

  // Functions to check
  const functionsToCheck = [
    "drawSquare",
    "chordLength",
    "drawApproximateCircle",
    "distance",
    "findPath",
    "drawPersonalArt",
  ];

  // Read both files
  const [instructorCode, studentCode] = await Promise.all([
    readFileContent(instructorFile),
    readFileContent(studentFile),
  ]);

  if (!instructorCode || !studentCode) {
    return { studentId, defaultFunctions: [], wholeCopyPaste: false };
  }

  // First check overall file similarity
  const jaccardFileSimilarity = calculateJaccardSimilarity(
    instructorCode,
    studentCode
  );
  const levenshteinFileSimilarity = calculateLevenshteinSimilarity(
    instructorCode,
    studentCode
  );
  const overallFileSimilarity =
    jaccardFileSimilarity * 0.7 + levenshteinFileSimilarity * 0.3;

  // If the entire file is extremely similar (>95%), mark all functions as default
  if (overallFileSimilarity > 0.95) {
    console.log(
      `WARNING: Student ${studentId} file is ${Math.round(
        overallFileSimilarity * 100
      )}% similar to instructor file!`
    );
    return {
      studentId,
      defaultFunctions: functionsToCheck,
      wholeCopyPaste: true,
    };
  }

  // Extract and compare each function
  const defaultFunctions: string[] = [];

  for (const funcName of functionsToCheck) {
    const instructorFunc = extractFunction(instructorCode, funcName);
    const studentFunc = extractFunction(studentCode, funcName);

    if (instructorFunc && studentFunc) {
      // Calculate similarity
      const jaccardScore = calculateJaccardSimilarity(
        instructorFunc,
        studentFunc
      );
      const levenshteinScore = calculateLevenshteinSimilarity(
        instructorFunc,
        studentFunc
      );

      // Weighted similarity score
      const similarity = jaccardScore * 0.7 + levenshteinScore * 0.3;

      // If similarity is above 0.9 (90%), consider it unchanged from default
      if (similarity > 0.9) {
        defaultFunctions.push(funcName);
      }
    }
  }

  return {
    studentId,
    defaultFunctions,
    wholeCopyPaste: false,
  };
}

/**
 * Processes a batch of student pairs
 */
async function processBatch(
  submissionsDir: string,
  pairs: { student1: string; student2: string }[],
  batchIndex: number,
  totalBatches: number
): Promise<SimilarityResult[]> {
  console.log(
    `Processing similarity batch ${batchIndex + 1}/${totalBatches} (${
      pairs.length
    } pairs)`
  );
  const batchStart = Date.now();

  const results = await Promise.all(
    pairs.map(({ student1, student2 }) =>
      compareStudents(submissionsDir, student1, student2)
    )
  );

  const batchTime = (Date.now() - batchStart) / 1000;
  console.log(
    `Completed similarity batch ${
      batchIndex + 1
    }/${totalBatches} in ${batchTime.toFixed(1)}s`
  );

  return results;
}

/**
 * Analyzes code similarity across all student submissions
 * @param submissionsDir Directory containing all submissions
 * @param students Array of student IDs
 * @param similarityThreshold Threshold percentage for highlighting high similarity (default: 80)
 * @returns Similarity report containing all comparisons and statistics
 */
export async function analyzeSimilarity(
  submissionsDir: string,
  students: string[],
  similarityThreshold: number = 80
): Promise<SimilarityReport> {
  console.log(`Analyzing similarity across ${students.length} students...`);
  console.log(
    `This will compare ${
      (students.length * (students.length - 1)) / 2
    } pairs of submissions`
  );

  // Create all pairs of students to compare
  const pairs: { student1: string; student2: string }[] = [];
  for (let i = 0; i < students.length; i++) {
    for (let j = i + 1; j < students.length; j++) {
      pairs.push({
        student1: students[i],
        student2: students[j],
      });
    }
  }

  // Process in batches for better progress reporting
  const BATCH_SIZE = 50; // Adjust based on performance
  const totalBatches = Math.ceil(pairs.length / BATCH_SIZE);
  const comparisons: SimilarityResult[] = [];
  let earlyExitFound = false;
  let perfectMatchPair: { student1: string; student2: string } | undefined =
    undefined;

  // Process all batches
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE);
    const batchPairs = pairs.slice(i, i + BATCH_SIZE);

    const batchResults = await processBatch(
      submissionsDir,
      batchPairs,
      batchIndex,
      totalBatches
    );

    comparisons.push(...batchResults);

    // Check if we found a 100% match - if so, we can stop processing
    const perfectMatch = batchResults.find((r) => r.similarity === 100);
    if (perfectMatch) {
      console.log(
        `Found a 100% similarity match between ${perfectMatch.student1} and ${perfectMatch.student2}!`
      );
      console.log(`Early exit - stopping further similarity analysis.`);
      earlyExitFound = true;
      perfectMatchPair = {
        student1: perfectMatch.student1,
        student2: perfectMatch.student2,
      };
      break;
    }

    // Report progress
    console.log(
      `Overall progress: ${Math.min(
        100,
        Math.round(((i + batchPairs.length) / pairs.length) * 100)
      )}% complete`
    );
  }

  // Calculate statistics
  let totalSimilarity = 0;
  let validComparisons = 0;

  for (const comparison of comparisons) {
    if (comparison.similarity > 0) {
      totalSimilarity += comparison.similarity;
      validComparisons++;
    }
  }

  // Calculate average similarity
  const averageSimilarity =
    validComparisons > 0 ? Math.round(totalSimilarity / validComparisons) : 0;

  // Find pairs with high similarity
  const highSimilarityPairs = comparisons
    .filter((result) => result.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity);

  // Check default implementations for all students
  console.log("Checking for default implementations...");
  const defaultImplementationResults = await Promise.all(
    students.map((student) =>
      checkDefaultImplementation(submissionsDir, student)
    )
  );

  // Filter to only students with default implementations
  const defaultImplementations: { [studentId: string]: string[] } = {};
  defaultImplementationResults.forEach((result) => {
    if (result.defaultFunctions.length > 0) {
      defaultImplementations[result.studentId] = result.defaultFunctions;
    }
  });

  // Log summary of default implementations
  const studentsWithDefaults = Object.keys(defaultImplementations).length;
  if (studentsWithDefaults > 0) {
    console.log(
      `Found ${studentsWithDefaults} students with default implementations.`
    );
  } else {
    console.log("No students with default implementations found.");
  }

  console.log(
    earlyExitFound
      ? `Analysis stopped early after finding a 100% match. Found ${highSimilarityPairs.length} high-similarity pairs.`
      : `Analysis complete. Found ${highSimilarityPairs.length} high-similarity pairs.`
  );

  return {
    timestamp: new Date().toISOString(),
    comparisons,
    highSimilarityPairs,
    averageSimilarity,
    earlyExit: earlyExitFound,
    perfectMatch: perfectMatchPair,
    defaultImplementations,
  };
}
