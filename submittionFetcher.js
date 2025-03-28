// Import necessary modules
const fs = require("fs").promises; // For async file system operations
const path = require("path"); // For handling file paths reliably

// Use built-in fetch for Node.js v18+
// If using older Node.js, uncomment the next line after `npm install node-fetch`
// const fetch = require('node-fetch');

// --- Configuration ---
const SUBMISSIONS_DIR = "Submissions_auto"; // Name of the local output directory
const DEFAULT_BRANCH = "main"; // Default branch if not specified in the URL

// Define the two possible structures and their target files
const STRUCTURE_1_FILES = [
  "src/turtle.ts",
  "src/turtlesoup.ts",
  "test/turtlesoupTest.ts",
];
const STRUCTURE_2_FILES = [
  "PS0/src/turtle.ts",
  "PS0/src/turtlesoup.ts",
  "PS0/test/turtlesoupTest.ts",
];

// --- Helper Functions ---

/**
 * Extracts user, repo, and branch from a GitHub URL.
 * Handles URLs like:
 *   - https://github.com/user/repo
 *   - https://github.com/user/repo/tree/branch
 *   - https://github.com/user/repo/blob/branch/path/to/file
 * @param {string} githubUrl
 * @returns {object|null} Object with { user, repo, branch } or null if invalid.
 */
function parseGitHubUrl(githubUrl) {
  const regex = /github\.com\/([^/]+)\/([^/]+)(?:\/(?:tree|blob)\/([^/]+))?/;
  const match = githubUrl.match(regex);

  if (!match) {
    console.error(`[Error] Invalid GitHub URL format: ${githubUrl}`);
    return null;
  }

  const [, user, repo, branch] = match;
  return {
    user,
    repo,
    branch: branch || DEFAULT_BRANCH, // Use default if not found
  };
}

/**
 * Constructs the base URL for fetching raw content.
 * @param {object} repoInfo Object with { user, repo, branch }
 * @returns {string} Base raw content URL (e.g., https://raw.githubusercontent.com/user/repo/branch/)
 */
function buildRawBaseUrl(repoInfo) {
  return `https://raw.githubusercontent.com/${repoInfo.user}/${repoInfo.repo}/${repoInfo.branch}/`;
}

/**
 * Checks if a file exists at a given raw GitHub URL.
 * Uses a HEAD request for efficiency if possible, falls back to GET.
 * @param {string} rawUrl The full raw URL to the potential file.
 * @returns {Promise<boolean>} True if the file exists (HTTP 200), false otherwise.
 */
async function checkFileExists(rawUrl) {
  try {
    // Prefer HEAD request to avoid downloading content if we only need existence check
    // Note: Some servers might not handle HEAD perfectly, but it's worth trying
    let response = await fetch(rawUrl, { method: "HEAD" });

    // If HEAD fails or is disallowed, try a GET request
    if (!response.ok && response.status !== 405) {
      // 405 Method Not Allowed might indicate HEAD isn't supported
      response = await fetch(rawUrl, { method: "GET" });
    }

    return response.ok; // status 200-299
  } catch (error) {
    // Network errors etc. mean we can't confirm existence
    // console.warn(`[Warn] Error checking file existence for ${rawUrl}: ${error.message}`);
    return false;
  }
}

/**
 * Downloads content from a raw GitHub URL.
 * @param {string} rawUrl Full raw URL to the file.
 * @returns {Promise<string>} File content as text.
 * @throws {Error} If fetch fails or returns non-OK status.
 */
async function fetchFileContent(rawUrl) {
  const response = await fetch(rawUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${rawUrl}: ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

/**
 * Downloads a specific file and saves it locally.
 * @param {string} rawFileUrl Full raw URL to the file.
 * @param {string} localFilePath Full path where the file should be saved.
 * @returns {Promise<{status: string, error?: string}>} Result object.
 */
async function downloadAndSaveFile(rawFileUrl, localFilePath) {
  try {
    console.log(` -> Attempting to download: ${rawFileUrl}`);
    const content = await fetchFileContent(rawFileUrl);

    // Ensure the target directory exists
    const dirName = path.dirname(localFilePath);
    await fs.mkdir(dirName, { recursive: true }); // Create parent directories if needed

    // Write the file
    await fs.writeFile(localFilePath, content);
    console.log(`    Saved to: ${localFilePath}`);
    return { status: "success" };
  } catch (error) {
    console.error(`    Failed: ${error.message}`);
    return { status: "failed", error: error.message };
  }
}

/**
 * Processes a single submission entry.
 * Determines file structure, downloads files, and saves them.
 * @param {object} submissionInfo Object with { name, githubUrl }
 * @returns {Promise<object>} Summary of the processing result for this submission.
 */
async function processSingleSubmission(submissionInfo) {
  const { name, githubUrl } = submissionInfo;
  console.log(`\nProcessing submission: ${name} (${githubUrl})`);
  const result = { name, status: "failed", files: [] }; // Default status

  const repoInfo = parseGitHubUrl(githubUrl);
  if (!repoInfo) {
    result.error = `Invalid GitHub URL: ${githubUrl}`;
    return result;
  }

  const baseRawUrl = buildRawBaseUrl(repoInfo);
  const submissionBasePath = path.join(SUBMISSIONS_DIR, name); // e.g., Submissions/StudentA

  let targetFiles = null;
  let structureUsed = "unknown";

  // --- Probe for Structure 2 (PS0/...) first ---
  const probeUrlStructure2 = baseRawUrl + STRUCTURE_2_FILES[0]; // Check first file of structure 2
  console.log(` -> Probing for structure 2: ${probeUrlStructure2}`);
  if (await checkFileExists(probeUrlStructure2)) {
    console.log(` -> Structure 2 (PS0/...) detected.`);
    targetFiles = STRUCTURE_2_FILES;
    structureUsed = "PS0";
  } else {
    // --- If Structure 2 not found, try Structure 1 ---
    const probeUrlStructure1 = baseRawUrl + STRUCTURE_1_FILES[0]; // Check first file of structure 1
    console.log(
      ` -> Structure 2 not found. Probing for structure 1: ${probeUrlStructure1}`
    );
    if (await checkFileExists(probeUrlStructure1)) {
      console.log(` -> Structure 1 (src/..., test/...) detected.`);
      targetFiles = STRUCTURE_1_FILES;
      structureUsed = "standard";
    } else {
      console.error(
        ` [Error] Neither file structure found for ${name}. Skipping.`
      );
      result.error = `Could not find ${STRUCTURE_2_FILES[0]} or ${STRUCTURE_1_FILES[0]} in repo.`;
      return result;
    }
  }

  // --- Download the identified files ---
  let successCount = 0;
  const downloadPromises = targetFiles.map(async (relativeFilePath) => {
    const rawFileUrl = baseRawUrl + relativeFilePath;
    // Ensure local path mirrors the GitHub structure within the submission folder
    const localFilePath = path.join(submissionBasePath, relativeFilePath);
    const fileResult = await downloadAndSaveFile(rawFileUrl, localFilePath);
    if (fileResult.status === "success") {
      successCount++;
    }
    return { file: relativeFilePath, ...fileResult };
  });

  result.files = await Promise.all(downloadPromises);

  // Determine overall submission status
  if (successCount === targetFiles.length) {
    result.status = "success";
  } else if (successCount > 0) {
    result.status = "partial";
  } else {
    result.status = "failed"; // Already defaulted, but explicit
  }
  result.structureUsed = structureUsed;

  return result;
}

/**
 * Main function to process all submissions.
 * @param {Array<object>} submissionsArray Array of { name, githubUrl } objects.
 */
async function downloadAllSubmissions(submissionsArray) {
  console.log(
    `Starting download process... Target directory: ${SUBMISSIONS_DIR}`
  );

  // Ensure base submissions directory exists
  try {
    await fs.mkdir(SUBMISSIONS_DIR, { recursive: true });
    console.log(`Ensured directory ${SUBMISSIONS_DIR} exists.`);
  } catch (error) {
    console.error(
      `Fatal: Could not create base directory ${SUBMISSIONS_DIR}:`,
      error
    );
    return; // Stop if we can't create the base directory
  }

  // Process all submissions concurrently
  const results = await Promise.all(
    submissionsArray.map((subInfo) =>
      processSingleSubmission(subInfo).catch((err) => ({
        name: subInfo.name, // Include name even on unexpected errors
        status: "error",
        error: `Unexpected error processing ${subInfo.name}: ${err.message}`,
      }))
    )
  );

  console.log("\n\n--- Download Summary ---");
  results.forEach((res) => {
    console.log(`\nSubmission: ${res.name}`);
    console.log(`  Status: ${res.status}`);
    if (res.structureUsed && res.structureUsed !== "unknown") {
      console.log(`  Structure Detected: ${res.structureUsed}`);
    }
    if (res.error) {
      console.error(`  Error: ${res.error}`);
    }
    if (res.files && res.files.length > 0) {
      console.log("  Files:");
      res.files.forEach((f) => {
        const statusMsg =
          f.status === "success"
            ? "OK"
            : `FAILED (${f.error || "unknown reason"})`;
        console.log(`    - ${f.file}: ${statusMsg}`);
      });
    }
  });
  console.log("\n--- Process Complete ---");
}

// --- Example Usage ---

// Replace this with your actual array of submission objects
const submissions = [
  {
    name: "Example File 1",
    // Replace with a REAL public GitHub file URL for testing
    githubUrl: "https://github.com/tamakristesiashvili1/turtle-drawing",
  },
  //   {
  //     name: "Example File 2 (Nested)",
  //     // Replace with a REAL public GitHub file URL for testing
  //     githubUrl: "https://github.com/EleneBaiashvili/ITSEPC-Problem-sets",
  //   },
];

// --- Run the process ---
downloadAllSubmissions(submissions).catch((error) => {
  console.error("\n--- An Unhandled Error Occurred ---");
  console.error(error);
});
