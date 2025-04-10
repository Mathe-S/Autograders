// Import necessary modules
const fs = require("fs").promises;
const path = require("path");
const { parse } = require("csv-parse");

// --- Configuration ---
const CSV_FILE_PATH = "./assignment_submissions.csv";
const SUBMISSIONS_DIR = "Submissions_auto";
const FAILED_LOG_FILE = "failed_submissions_log.txt";
const DEFAULT_BRANCH = "main"; // Primary default branch to try
const FALLBACK_BRANCH = "master"; // Fallback default branch to try

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
 * Cleans a string to be used as a valid directory name.
 * Replaces invalid characters with underscores.
 * @param {string} name Original name (e.g., from CSV).
 * @returns {string} Sanitized name.
 */
function sanitizeName(name) {
  if (!name) return "Unknown_Student"; // Handle empty or null names
  // Replace invalid filename characters with '_'
  // Add or remove characters from the regex as needed for your OS
  const sanitized = name.replace(/[<>:"/\\|?*]/g, "_").trim();
  // Prevent completely empty names after sanitization
  return sanitized.length > 0 ? sanitized : "Invalid_Name_Provided";
}

/**
 * Extracts user, repo, and potentially branch/commit SHA from various GitHub URL formats.
 * Handles:
 *   - https://github.com/user/repo
 *   - https://github.com/user/repo.git
 *   - https://github.com/user/repo/tree/branchOrSha/...
 *   - https://github.com/user/repo/blob/branchOrSha/...
 * @param {string} githubUrl
 * @returns {object|null} Object with { user, repo, initialRef } (initialRef is from URL or null) or null.
 */
function parseGitHubUrl(githubUrl) {
  // Clean up potential ".git" suffix and trailing slashes
  const cleanedUrl = githubUrl.replace(/\.git$/, "").replace(/\/$/, "");

  // Regex breakdown:
  // github\.com/              - Literal match
  // ([^/]+)                   - Capture group 1: user (one or more chars not '/')
  // /                         - Literal slash
  // ([^/]+)                   - Capture group 2: repo (one or more chars not '/')
  // (?:                       - Optional non-capturing group for branch/blob/tree part
  //   /(?:tree|blob)/         - Matches /tree/ or /blob/
  //   ([^/]+)                 - Capture group 3: branch or commit SHA
  // )?                        - Makes the branch/blob/tree part optional
  const regex = /github\.com\/([^/]+)\/([^/]+)(?:\/(?:tree|blob)\/([^/]+))?/;
  const match = cleanedUrl.match(regex);

  if (!match) {
    console.error(`[Error] Invalid GitHub URL format: ${githubUrl}`);
    return null;
  }

  const [, user, repo, refFromUrl] = match; // Capture ref specifically from URL
  return {
    user,
    repo,
    // Store the ref found in the URL, or null if none was specified
    initialRef: refFromUrl || null,
  };
}
/**
 * Constructs the base URL for fetching raw content using the determined ref.
 * @param {object} repoInfo Object with { user, repo, ref }
 * @returns {string} Base raw content URL (e.g., https://raw.githubusercontent.com/user/repo/ref/)
 */
function buildRawBaseUrl(repoInfo) {
  return `https://raw.githubusercontent.com/${repoInfo.user}/${repoInfo.repo}/${repoInfo.ref}/`;
}

/**
 * Checks if a file exists at a given raw GitHub URL.
 * Uses a HEAD request for efficiency if possible, falls back to GET.
 * @param {string} rawUrl The full raw URL to the potential file.
 * @returns {Promise<boolean>} True if the file exists (HTTP 200), false otherwise.
 */
async function checkFileExists(rawUrl) {
  try {
    let response = await fetch(rawUrl, { method: "HEAD", redirect: "follow" }); // Follow redirects
    // Allow 405 Method Not Allowed (try GET instead)
    if (!response.ok && response.status !== 405) {
      response = await fetch(rawUrl, { method: "GET", redirect: "follow" });
    } else if (response.status === 405) {
      // If HEAD wasn't allowed, retry with GET
      console.warn(`[Warn] HEAD method not allowed for ${rawUrl}, trying GET.`);
      response = await fetch(rawUrl, { method: "GET", redirect: "follow" });
    }

    return response.ok; // status 200-299
  } catch (error) {
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
  const response = await fetch(rawUrl, { redirect: "follow" }); // Follow redirects
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
    const dirName = path.dirname(localFilePath);

    // Check if the directory already exists
    try {
      await fs.access(dirName);
      console.log(
        `    Skipping download: Directory already exists at ${dirName}`
      );
      return { status: "skipped", error: "Directory already exists." };
    } catch (error) {
      // Directory does not exist, proceed to create it
      await fs.mkdir(dirName, { recursive: true });
    }

    console.log(` -> Attempting to download: ${rawFileUrl}`);
    const content = await fetchFileContent(rawFileUrl);

    await fs.writeFile(localFilePath, content);
    console.log(`    Saved to: ${localFilePath}`);
    return { status: "success" };
  } catch (error) {
    // Make error message more specific if it's a 404
    const errorMsg = error.message.includes("404 Not Found")
      ? `File not found at URL.`
      : error.message;
    console.error(`    Failed: ${errorMsg}`);
    return { status: "failed", error: errorMsg };
  }
}

/**
 * Processes a single submission entry from the CSV data.
 * Attempts default branches 'main' and 'master' if no branch is specified.
 * @param {object} submissionData Object containing at least { name, githubUrl, email }
 * @returns {Promise<object>} Summary including original data, status, errors, etc.
 */
async function processSingleSubmission(submissionData) {
  const { name, githubUrl, email } = submissionData;
  const sanitizedFolderName = sanitizeName(email); // Use sanitized email for folder

  console.log(
    `\nProcessing submission: ${name} (Folder: ${sanitizedFolderName}, URL: ${githubUrl})`
  );

  const result = {
    ...submissionData,
    folderName: sanitizedFolderName,
    status: "failed",
    structureUsed: "unknown",
    refUsed: null, // Keep track of the branch/ref that worked
    files: [],
    error: null,
  };

  if (!githubUrl) {
    result.error = `Missing GitHub URL.`;
    console.error(` [Error] Missing GitHub URL for ${name}. Skipping.`);
    return result;
  }

  const repoInfo = parseGitHubUrl(githubUrl);
  if (!repoInfo) {
    result.error = `Invalid GitHub URL format: ${githubUrl}`;
    console.error(` [Error] Invalid GitHub URL for ${name}. Skipping.`);
    return result;
  }

  // Determine the refs (branches/SHAs) to try
  const refsToTry = [];
  if (repoInfo.initialRef) {
    // If a specific ref (branch/SHA) was in the URL, try only that one first.
    refsToTry.push(repoInfo.initialRef);
    console.log(
      ` -> URL specified ref: ${repoInfo.initialRef}. Trying this first.`
    );
  } else {
    // If no ref in URL, try default branches
    refsToTry.push(DEFAULT_BRANCH); // e.g., 'main'
    if (DEFAULT_BRANCH !== FALLBACK_BRANCH) {
      refsToTry.push(FALLBACK_BRANCH); // e.g., 'master'
    }
    console.log(
      ` -> No ref specified in URL. Will try default branches: [${refsToTry.join(
        ", "
      )}]`
    );
  }

  let targetFiles = null;
  let successfulRef = null;

  // Loop through the refs to try (usually 1 or 2)
  for (const currentRef of refsToTry) {
    console.log(` -> Attempting probe using ref: '${currentRef}'`);
    const currentRepoInfo = { ...repoInfo, ref: currentRef }; // Use current ref for this attempt
    const baseRawUrl = buildRawBaseUrl(currentRepoInfo);

    // --- Probe for Structure 2 (PS0/...) first ---
    const probeUrlStructure2 = baseRawUrl + STRUCTURE_2_FILES[0];
    console.log(`    -> Probing Structure 2: ${probeUrlStructure2}`);
    if (await checkFileExists(probeUrlStructure2)) {
      console.log(
        `    -> Structure 2 (PS0/...) detected on ref '${currentRef}'.`
      );
      targetFiles = STRUCTURE_2_FILES;
      result.structureUsed = "PS0";
      successfulRef = currentRef; // Found it!
      break; // Exit the loop, we found a working ref and structure
    }

    // --- If Structure 2 not found, try Structure 1 ---
    const probeUrlStructure1 = baseRawUrl + STRUCTURE_1_FILES[0];
    console.log(
      `    -> Structure 2 not found. Probing Structure 1: ${probeUrlStructure1}`
    );
    if (await checkFileExists(probeUrlStructure1)) {
      console.log(
        `    -> Structure 1 (src/..., test/...) detected on ref '${currentRef}'.`
      );
      targetFiles = STRUCTURE_1_FILES;
      result.structureUsed = "standard";
      successfulRef = currentRef; // Found it!
      break; // Exit the loop, we found a working ref and structure
    }

    console.log(` -> Did not find required files using ref '${currentRef}'.`);
    // If this was the last ref to try, the loop will end.
  } // End loop through refsToTry

  // --- Check if probing was successful ---
  if (!successfulRef || !targetFiles) {
    const errorMsg = `Could not find starting file for either structure on checked refs: [${refsToTry.join(
      ", "
    )}]. Please check repository structure and branch names.`;
    console.error(` [Error] ${errorMsg}`);
    result.error = errorMsg;
    return result; // Return failure
  }

  // --- Probing successful, proceed with download using the successful ref ---
  result.refUsed = successfulRef; // Store the ref that worked
  console.log(` -> Proceeding to download files using ref '${successfulRef}'.`);
  const finalRepoInfo = { ...repoInfo, ref: successfulRef };
  result.repoInfo = finalRepoInfo;
  const finalBaseRawUrl = buildRawBaseUrl(finalRepoInfo);

  let successCount = 0;
  const downloadPromises = targetFiles.map(async (relativeFilePath, index) => {
    const rawFileUrl = finalBaseRawUrl + relativeFilePath; // Use finalBaseRawUrl
    const localFilePath = path.join(
      SUBMISSIONS_DIR,
      sanitizedFolderName, // Use the consistent folder name
      STRUCTURE_1_FILES[index]
    );
    const fileResult = await downloadAndSaveFile(rawFileUrl, localFilePath);
    if (fileResult.status === "success" || fileResult.status === "skipped") {
      successCount++;
    }
    return {
      file: relativeFilePath,
      status: fileResult.status,
      error: fileResult.error,
      rawUrl: rawFileUrl,
      localPath: localFilePath,
    };
  });

  result.files = await Promise.all(downloadPromises);

  // Determine overall submission status
  if (successCount === targetFiles.length) {
    result.status = "success";
    console.log(
      ` -> Successfully downloaded all ${targetFiles.length} files for ${name} from ref '${successfulRef}'.`
    );
  } else if (successCount > 0) {
    result.status = "partial";
    result.error = `Downloaded ${successCount}/${targetFiles.length} files from ref '${successfulRef}'. See file details.`;
    console.warn(
      ` [Warning] Partially downloaded files for ${name} (${successCount}/${targetFiles.length}) from ref '${successfulRef}'.`
    );
  } else {
    result.status = "failed";
    if (!result.error) {
      const firstFileError =
        result.files.find((f) => f.error)?.error || "Unknown download failure.";
      result.error = `Failed to download any required files from ref '${successfulRef}'. First error: ${firstFileError}`;
    }
    console.error(
      ` [Error] Failed to download required files for ${name} from ref '${successfulRef}'.`
    );
  }

  return result;
}

/**
 * Reads and parses the CSV file.
 * @param {string} filePath Path to the CSV file.
 * @returns {Promise<Array<object>>} Array of submission objects from CSV.
 */
async function readSubmissionsFromCsv(filePath) {
  console.log(`Reading submissions from ${filePath}...`);
  try {
    const fileContent = await fs.readFile(filePath, { encoding: "utf8" });
    const records = await new Promise((resolve, reject) => {
      parse(
        fileContent,
        {
          columns: true, // Use header row to determine object keys
          skip_empty_lines: true,
          trim: true, // Trim whitespace from values
        },
        (err, output) => {
          if (err) {
            reject(new Error(`Error parsing CSV: ${err.message}`));
          } else {
            resolve(output);
          }
        }
      );
    });

    // Map to the structure needed by processSingleSubmission, ensuring key fields exist
    return records.map((record) => ({
      name: record["Student Name"] || "Unknown", // Use 'Student Name' column
      email: record["Email"] || "No Email Provided", // Use 'Email' column
      githubUrl: record["GitHub URL"] || "", // Use 'GitHub URL' column
      // Keep other CSV fields if needed for context or logging
      repoName: record["Repository Name"],
      submittedAt: record["Submitted At"],
      grade: record["Grade"],
    }));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`CSV file not found at path: ${filePath}`);
    }
    throw new Error(`Failed to read or parse CSV file: ${error.message}`);
  }
}

/**
 * Main function to process all submissions from the CSV.
 */
async function downloadAllSubmissionsFromCsv() {
  let submissionsArray;
  try {
    submissionsArray = await readSubmissionsFromCsv(CSV_FILE_PATH);
    console.log(`Found ${submissionsArray.length} submissions in CSV.`);
  } catch (error) {
    console.error(`Fatal Error: ${error.message}`);
    process.exit(1); // Exit if we can't read the input
  }

  if (submissionsArray.length === 0) {
    console.log("No submissions found in the CSV file. Exiting.");
    return;
  }

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
    process.exit(1);
  }

  const failedSubmissions = [];
  const results = []; // Keep track of all results for summary

  // Process submissions in parallel
  const processingPromises = submissionsArray.map(async (subInfo) => {
    let result; // Define result variable outside try block
    try {
      result = await processSingleSubmission(subInfo); // This now handles ref checking
      results.push(result);
      // Log failures based on the final status after trying refs
      if (result.status !== "success" && result.status !== "skipped") {
        failedSubmissions.push({
          name: result.name,
          email: result.email,
          githubUrl: result.githubUrl,
          folderName: result.folderName,
          status: result.status,
          reason: result.error || "Unknown failure reason.",
          structureDetected: result.structureUsed,
          refAttempted:
            result.refUsed ||
            (result.repoInfo
              ? result.repoInfo.initialRef ||
                `${DEFAULT_BRANCH}, ${FALLBACK_BRANCH}`
              : "N/A"), // Show ref used or attempted
          fileDetails: result.files
            .filter((f) => f.status !== "success")
            .map((f) => `  - ${f.file}: ${f.error || "Failed"}`),
        });
      }
    } catch (err) {
      // Catch unexpected errors during processing of a single submission
      console.error(
        `[CRITICAL] Unexpected error processing ${subInfo.name}: ${err.message}\n${err.stack}`
      );
      // Create a minimal error result if 'result' wasn't assigned
      const errorResult = result || {
        ...subInfo,
        status: "error",
        error: `Unexpected processing error: ${err.message}`,
        folderName: sanitizeName(subInfo.email),
      };
      results.push(errorResult);

      failedSubmissions.push({
        name: subInfo.name,
        email: subInfo.email,
        githubUrl: subInfo.githubUrl,
        folderName: sanitizeName(subInfo.email),
        status: "error",
        reason: `Unexpected processing error: ${err.message}`,
        structureDetected: "unknown",
        refAttempted: "N/A",
        fileDetails: [],
      });
    }
  });

  // Wait for all processing promises to complete
  await Promise.all(processingPromises);

  // --- Log Failures ---
  if (failedSubmissions.length > 0) {
    console.log(
      `\nLogging ${failedSubmissions.length} failed/partial submissions to ${FAILED_LOG_FILE}...`
    );
    let logContent = `Failed/Partial Submission Log (${new Date().toISOString()})\n`;
    logContent += `Total Failed/Partial: ${failedSubmissions.length}\n`;
    logContent += `============================================\n\n`;

    failedSubmissions.forEach((failure, index) => {
      logContent += `${index + 1}. Name: ${failure.name}\n`;
      logContent += `   Email: ${failure.email}\n`;
      logContent += `   GitHub URL: ${failure.githubUrl}\n`;
      logContent += `   Target Folder: ${failure.folderName}\n`;
      logContent += `   Status: ${failure.status}\n`;
      // Include the ref used or attempted in the log
      logContent += `   Ref Used/Attempted: ${failure.refAttempted || "N/A"}\n`;
      logContent += `   Structure Detected: ${failure.structureDetected}\n`;
      logContent += `   Reason: ${failure.reason}\n`;
      if (failure.fileDetails && failure.fileDetails.length > 0) {
        logContent += `   File Errors:\n${failure.fileDetails.join("\n")}\n`;
      }
      logContent += `--------------------------------------------\n`;
    });

    try {
      await fs.writeFile(FAILED_LOG_FILE, logContent);
      console.log(`Failure log written successfully.`);
    } catch (error) {
      console.error(
        `Error writing failure log file (${FAILED_LOG_FILE}):`,
        error
      );
    }
  } else {
    console.log("\nNo submission failures detected.");
  }

  console.log("\n--- Overall Summary ---");
  const successCount = results.filter(
    (r) => r && r.status === "success"
  ).length;
  const partialCount = results.filter(
    (r) => r && r.status === "partial"
  ).length;
  const failedCount = results.filter((r) => r && r.status === "failed").length;
  const errorCount = results.filter((r) => r && r.status === "error").length;
  console.log(`Processed: ${results.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Partial: ${partialCount}`);
  console.log(`Failed (Structure/Download): ${failedCount}`);
  console.log(`Errors (Processing): ${errorCount}`);
  console.log("\n--- Process Complete ---");

  // --- Check for missing submissions ---
  await checkMissingSubmissions(submissionsArray);
}

// --- Check for missing submissions ---
async function checkMissingSubmissions(submissionsArray) {
  try {
    // Read existing folders in the Submissions_auto directory
    const existingFolders = await fs.readdir(SUBMISSIONS_DIR);
    const existingEmails = existingFolders.map((folder) => folder); // Assuming folder names are sanitized emails

    // Read the failed submissions log
    const failedLogContent = await fs.readFile(FAILED_LOG_FILE, {
      encoding: "utf8",
    });
    const failedEmails = [];
    const failedLogLines = failedLogContent.split("\n");

    // Extract emails from the failed log
    for (const line of failedLogLines) {
      const match = line.match(/Email: (.+)/);
      if (match) {
        failedEmails.push(match[1].trim());
      }
    }

    // Check for emails that are not in existing folders and not in failed log
    const missingEmails = submissionsArray
      .map((submission) => submission.email)
      .filter(
        (email) =>
          !existingEmails.includes(email) && !failedEmails.includes(email)
      );

    if (missingEmails.length > 0) {
      console.log("\n--- Missing Submissions ---");
      console.log(
        "The following emails do not have corresponding folders and are not in the failed log:"
      );
      missingEmails.forEach((email) => console.log(`- ${email}`));
    } else {
      console.log("\n--- All submissions accounted for ---");
    }
  } catch (error) {
    console.error(`Error checking for missing submissions: ${error.message}`);
  }
}

// --- Run the process ---
downloadAllSubmissionsFromCsv().catch((error) => {
  console.error("\n--- An Unhandled Top-Level Error Occurred ---");
  console.error(error);
  process.exit(1); // Indicate failure
});
