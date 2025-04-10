import * as fs from "fs";
import * as path from "path";
import * as fsPromises from "fs/promises";

/**
 * Discovers all student submission directories
 * @param submissionsDir The base directory containing student submissions
 * @returns Array of student directory names
 */
export async function discoverStudentSubmissions(
  submissionsDir: string
): Promise<string[]> {
  try {
    const entries = await fsPromises.readdir(submissionsDir, {
      withFileTypes: true,
    });
    const studentDirs = entries
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    return studentDirs;
  } catch (error) {
    console.error("Error discovering student submissions:", error);
    return [];
  }
}

/**
 * Creates a temporary directory for testing
 * @param baseDir Base directory
 * @param name Name of the temporary directory
 * @returns Path to the temporary directory
 */
export async function createTempDirectory(
  baseDir: string,
  name: string
): Promise<string> {
  const tempDir = path.join(baseDir, name);

  try {
    // Clean up if exists
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors if directory doesn't exist
  }

  // Create fresh directory
  await fsPromises.mkdir(tempDir, { recursive: true });

  return tempDir;
}

/**
 * Copies a file from source to destination
 * @param sourcePath Source file path
 * @param destPath Destination file path
 */
export async function copyFile(
  sourcePath: string,
  destPath: string
): Promise<void> {
  await fsPromises.copyFile(sourcePath, destPath);
}

/**
 * Reads a file and returns its content
 * @param filePath Path to the file
 * @returns File content as string
 */
export async function readFile(filePath: string): Promise<string> {
  return fsPromises.readFile(filePath, "utf-8");
}

/**
 * Writes content to a file
 * @param filePath Path to the file
 * @param content Content to write
 */
export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  await fsPromises.writeFile(filePath, content);
}

/**
 * Checks if a file exists
 * @param filePath Path to the file
 * @returns True if the file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  return fsPromises
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

/**
 * Removes a directory and its contents
 * @param dirPath Path to the directory
 */
export async function removeDirectory(dirPath: string): Promise<void> {
  try {
    await fsPromises.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors
  }
}
