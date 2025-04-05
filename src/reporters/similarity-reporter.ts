import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import {
  SimilarityReport,
  SimilarityResult,
} from "../services/similarity/code-similarity";

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

/**
 * Finds the highest similarity match for each student
 * @param comparisons All similarity comparisons
 * @returns Array of each student's highest similarity match
 */
function findHighestSimilarities(
  comparisons: SimilarityResult[]
): SimilarityResult[] {
  // Get unique students
  const students = Array.from(
    new Set([
      ...comparisons.map((c) => c.student1),
      ...comparisons.map((c) => c.student2),
    ])
  );

  // Find highest similarity for each student
  const highestSimilarities: SimilarityResult[] = [];
  const processedPairs = new Set<string>();

  // For each student, find their highest similarity with any other student
  for (const student of students) {
    // Get all comparisons involving this student
    const studentComparisons = comparisons.filter(
      (c) => c.student1 === student || c.student2 === student
    );

    // Skip if no comparisons or already processed
    if (studentComparisons.length === 0) continue;

    // Sort by similarity (highest first)
    const sortedComparisons = [...studentComparisons].sort(
      (a, b) => b.similarity - a.similarity
    );

    // Get the highest similarity
    const highestSimilarity = sortedComparisons[0];

    // Create a unique key for this pair to avoid duplicates
    const pairKey = [highestSimilarity.student1, highestSimilarity.student2]
      .sort()
      .join("_");

    // Only add if we haven't processed this pair yet
    if (!processedPairs.has(pairKey)) {
      highestSimilarities.push(highestSimilarity);
      processedPairs.add(pairKey);
    }
  }

  // Sort final results by similarity (highest first)
  return highestSimilarities.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Generates an HTML report for similarity analysis
 * @param report The similarity analysis report
 * @returns HTML content as a string
 */
export function generateSimilarityHtml(report: SimilarityReport): string {
  const {
    timestamp,
    comparisons,
    highSimilarityPairs,
    averageSimilarity,
    earlyExit,
    perfectMatch,
  } = report;

  // Filter to just get each student's highest similarity match
  const highestSimilarities = findHighestSimilarities(highSimilarityPairs);

  // Create HTML for high similarity pairs (using the highest similarities per student)
  let highSimilarityHtml = "";
  if (highestSimilarities.length > 0) {
    highSimilarityHtml = `
      <h2>Highest Similarity Matches</h2>
      ${
        earlyExit && perfectMatch
          ? `
      <div class="alert alert-danger">
        <p><strong>Note:</strong> Analysis stopped early after finding a 100% match between 
        <strong>${perfectMatch.student1}</strong> and <strong>${perfectMatch.student2}</strong>.</p>
      </div>
      `
          : ""
      }
      <div class="alert alert-warning">
        <p><strong>Note:</strong> This table shows each student's highest similarity match to another student. 
        High similarity may indicate academic integrity concerns, but can also result from 
        starter code or common solutions. Manual review recommended.</p>
      </div>
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th>Student 1</th>
            <th>Student 2</th>
            <th>Similarity</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${highestSimilarities
            .map(
              (pair) => `
            <tr class="${
              pair.similarity >= 90 ? "table-danger" : "table-warning"
            }">
              <td>${pair.student1}</td>
              <td>${pair.student2}</td>
              <td><strong>${pair.similarity}%</strong></td>
              <td>
                <ul class="mb-0">
                  <li>turtlesoup.ts: ${pair.details?.turtlesoupSimilarity}%</li>
                  <li>test: ${pair.details?.testSimilarity}%</li>
                </ul>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  } else {
    highSimilarityHtml = `
      <h2>High Similarity Pairs</h2>
      <div class="alert alert-success">
        <p>No high similarity pairs were detected (threshold: 80%).</p>
      </div>
    `;
  }

  // Create the similarity matrix
  const students = Array.from(
    new Set([
      ...comparisons.map((c) => c.student1),
      ...comparisons.map((c) => c.student2),
    ])
  ).sort();

  let matrixHtml = `
    <h2>Similarity Matrix</h2>
    <p>Average similarity across all student pairs: <strong>${averageSimilarity}%</strong></p>
    <div class="table-responsive">
      <table class="table table-sm similarity-matrix">
        <thead>
          <tr>
            <th></th>
            ${students.map((s) => `<th>${shortenStudentId(s)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
  `;

  for (const student1 of students) {
    matrixHtml += `<tr><th>${shortenStudentId(student1)}</th>`;

    for (const student2 of students) {
      if (student1 === student2) {
        matrixHtml += '<td class="bg-dark">-</td>';
      } else {
        // Find the comparison for this pair
        const comparison = comparisons.find(
          (c) =>
            (c.student1 === student1 && c.student2 === student2) ||
            (c.student1 === student2 && c.student2 === student1)
        );

        if (comparison) {
          const similarity = comparison.similarity;
          const cellColor = getCellColorClass(similarity);
          matrixHtml += `<td class="${cellColor}" title="${student1} vs ${student2}: ${similarity}%">${similarity}%</td>`;
        } else {
          matrixHtml += '<td class="bg-light">N/A</td>';
        }
      }
    }

    matrixHtml += "</tr>";
  }

  matrixHtml += `
        </tbody>
      </table>
    </div>
  `;

  // Complete HTML document
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Code Similarity Report - PS0</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        .similarity-matrix td {
          text-align: center;
          min-width: 50px;
        }
        .bg-similarity-very-high { background-color: #dc3545; color: white; }
        .bg-similarity-high { background-color: #fd7e14; color: white; }
        .bg-similarity-medium { background-color: #ffc107; color: black; }
        .bg-similarity-low { background-color: #20c997; color: black; }
        .bg-similarity-very-low { background-color: #198754; color: white; }
      </style>
    </head>
    <body>
      <div class="container mt-4 mb-5">
        <h1>Code Similarity Analysis Report - PS0</h1>
        <p class="text-muted">Generated: ${new Date(
          timestamp
        ).toLocaleString()}</p>
        
        <div class="row">
          <div class="col-md-4">
            <div class="card mb-4">
              <div class="card-body">
                <h5 class="card-title">Summary</h5>
                <ul class="list-group list-group-flush">
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    Students Analyzed
                    <span class="badge bg-primary rounded-pill">${
                      students.length
                    }</span>
                  </li>
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    Comparisons Made
                    <span class="badge bg-primary rounded-pill">${
                      comparisons.length
                    }</span>
                  </li>
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    Average Similarity
                    <span class="badge bg-primary rounded-pill">${averageSimilarity}%</span>
                  </li>
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    High Similarity Pairs
                    <span class="badge ${
                      highestSimilarities.length > 0
                        ? "bg-warning"
                        : "bg-success"
                    } rounded-pill">
                      ${highestSimilarities.length}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="col-md-8">
            <div class="card mb-4">
              <div class="card-body">
                <h5 class="card-title">Similarity Scale</h5>
                <div class="d-flex justify-content-between mt-3">
                  <div class="text-center">
                    <div class="bg-similarity-very-low p-2 rounded">0-20%</div>
                    <small>Very Low</small>
                  </div>
                  <div class="text-center">
                    <div class="bg-similarity-low p-2 rounded">21-40%</div>
                    <small>Low</small>
                  </div>
                  <div class="text-center">
                    <div class="bg-similarity-medium p-2 rounded">41-60%</div>
                    <small>Medium</small>
                  </div>
                  <div class="text-center">
                    <div class="bg-similarity-high p-2 rounded">61-80%</div>
                    <small>High</small>
                  </div>
                  <div class="text-center">
                    <div class="bg-similarity-very-high p-2 rounded">81-100%</div>
                    <small>Very High</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        ${highSimilarityHtml}
        ${matrixHtml}
        
        <div class="mt-4 alert alert-info">
          <h4 class="alert-heading">About This Analysis</h4>
          <p>This similarity analysis uses a combination of Jaccard similarity and Levenshtein distance algorithms to compare code structure
          and content while ignoring comments, whitespace, and variable name differences.</p>
          <p>Files analyzed: <code>turtlesoup.ts</code> (70%), <code>turtlesoupTest.ts</code> (30%)</p>
          <hr>
          <p class="mb-0"><strong>Note:</strong> This is an automated analysis tool and should be used as a starting point for investigation,
          not as definitive evidence of academic dishonesty.</p>
        </div>
      </div>
      
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>
  `;
}

/**
 * Saves the similarity report to an HTML file
 * @param htmlContent HTML content to save
 * @returns Path to the saved file
 */
export async function saveSimilarityReport(
  htmlContent: string
): Promise<string> {
  // Create the output directory if it doesn't exist
  const outputDir = path.join(process.cwd(), "reports");
  try {
    await mkdirAsync(outputDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
  const filename = `similarity-report-${timestamp}.html`;
  const outputPath = path.join(outputDir, filename);

  // Write the file
  await writeFileAsync(outputPath, htmlContent, "utf8");
  console.log(`Similarity report saved to: ${outputPath}`);

  return outputPath;
}

/**
 * Prints a summary of the similarity analysis to the console
 * @param report The similarity report
 */
export function printSimilaritySummary(report: SimilarityReport): void {
  const { highSimilarityPairs, averageSimilarity, earlyExit, perfectMatch } =
    report;

  console.log("\n=== Similarity Analysis Summary ===");

  if (earlyExit && perfectMatch) {
    console.log(`Analysis stopped early after finding a 100% match between:`);
    console.log(`${perfectMatch.student1} and ${perfectMatch.student2}`);
  }

  console.log(`Average similarity: ${averageSimilarity}%`);

  // Get each student's highest similarity
  const highestSimilarities = findHighestSimilarities(highSimilarityPairs);
  console.log(`High similarity pairs: ${highestSimilarities.length}`);

  if (highestSimilarities.length > 0) {
    console.log("\nTop high similarity pairs:");
    const topPairs = highestSimilarities.slice(
      0,
      Math.min(5, highestSimilarities.length)
    );

    topPairs.forEach((pair, index) => {
      console.log(
        `${index + 1}. ${pair.student1} - ${pair.student2}: ${pair.similarity}%`
      );
    });

    if (highestSimilarities.length > 5) {
      console.log(`... and ${highestSimilarities.length - 5} more pairs.`);
    }
  }

  console.log("\nSee the HTML report for detailed analysis.");
}

// Helper functions

/**
 * Shortens a student ID (email) for display
 * @param studentId Student ID (usually email)
 * @returns Shortened ID for display
 */
function shortenStudentId(studentId: string): string {
  // If it's an email, take the part before @, limit to 10 chars
  if (studentId.includes("@")) {
    return studentId.split("@")[0].substring(0, 10);
  }
  // Otherwise just take the first 10 chars
  return studentId.substring(0, 10);
}

/**
 * Gets a CSS class for a cell based on similarity percentage
 * @param similarity Similarity percentage (0-100)
 * @returns CSS class for coloring
 */
function getCellColorClass(similarity: number): string {
  if (similarity >= 81) return "bg-similarity-very-high";
  if (similarity >= 61) return "bg-similarity-high";
  if (similarity >= 41) return "bg-similarity-medium";
  if (similarity >= 21) return "bg-similarity-low";
  return "bg-similarity-very-low";
}
