import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { Point, Color } from "../types";
import * as fsUtils from "../utils/fs-utils";

const execAsync = promisify(exec);

/**
 * Execute student's drawPersonalArt function and collect path data
 * @param studentDir The student's directory
 * @returns Path data from the turtle after drawing
 */
export async function collectPersonalArt(studentDir: string): Promise<{
  pathData: { start: Point; end: Point; color: Color }[];
  error?: string;
}> {
  const tmpArtDir = path.join(studentDir, "tmp_art");

  console.log(`Collecting personal art for ${studentDir}`);

  try {
    // Create a temporary directory for art generation
    await fsUtils.createTempDirectory(studentDir, "tmp_art");

    // Set up the necessary files
    const rootDir = process.cwd();

    // Check if student's turtlesoup.ts exists
    const studentTurtlesoupPath = path.join(studentDir, "src", "turtlesoup.ts");
    const studentTurtlesoupExists = await fsUtils.fileExists(
      studentTurtlesoupPath
    );
    if (!studentTurtlesoupExists) {
      throw new Error(
        `Student turtlesoup.ts not found at ${studentTurtlesoupPath}`
      );
    }

    // Copy the instructor's turtle.ts and the student's turtlesoup.ts
    await fsUtils.copyFile(
      path.join(rootDir, "instructor/src", "turtle.ts"),
      path.join(tmpArtDir, "turtle.ts")
    );

    await fsUtils.copyFile(
      studentTurtlesoupPath,
      path.join(tmpArtDir, "turtlesoup.ts")
    );

    // Create a wrapper script with better error handling
    const wrapperContent = `
      import { SimpleTurtle } from './turtle';
      import * as fs from 'fs';
      
      // Wrap in a try-catch to handle import errors
      try {
        // First check if drawPersonalArt exists in the imported module
        const turtlesoup = require('./turtlesoup');
        
        if (typeof turtlesoup.drawPersonalArt !== 'function') {
          console.error('Error: drawPersonalArt function not found in turtlesoup.ts');
          fs.writeFileSync('error.txt', 'drawPersonalArt function not found in turtlesoup.ts');
          process.exit(1);
        }
        
        // Execute the function
        try {
          const turtle = new SimpleTurtle();
          turtlesoup.drawPersonalArt(turtle);
          const pathData = JSON.stringify(turtle.getPath());
          fs.writeFileSync('path.json', pathData);
        } catch (error: any) {
          console.error('Error executing drawPersonalArt:', error);
          fs.writeFileSync('error.txt', 'Error executing drawPersonalArt: ' + (error.message || String(error)));
          process.exit(1);
        }
      } catch (importError: any) {
        console.error('Error importing turtlesoup module:', importError);
        fs.writeFileSync('error.txt', 'Error importing turtlesoup module: ' + (importError.message || String(importError)));
        process.exit(1);
      }
    `;

    await fsUtils.writeFile(path.join(tmpArtDir, "wrapper.ts"), wrapperContent);

    // Execute the wrapper with extended timeout
    try {
      await execAsync(
        `cd ${tmpArtDir} && npx ts-node --transpile-only wrapper.ts`,
        {
          timeout: 15000, // 15 second timeout (increased from 10)
        }
      );
    } catch (execError) {
      // Check if error.txt was created with more detailed error info
      const errorFilePath = path.join(tmpArtDir, "error.txt");
      if (await fsUtils.fileExists(errorFilePath)) {
        const errorDetails = await fsUtils.readFile(errorFilePath);
        throw new Error(`Art execution error: ${errorDetails}`);
      }
      throw execError;
    }

    // Read the path data
    const pathDataPath = path.join(tmpArtDir, "path.json");
    if (!(await fsUtils.fileExists(pathDataPath))) {
      throw new Error("Path data file was not created");
    }

    const pathDataRaw = await fsUtils.readFile(pathDataPath);
    if (!pathDataRaw || pathDataRaw.trim() === "") {
      throw new Error("Path data file is empty");
    }

    try {
      const pathData = JSON.parse(pathDataRaw);

      // Check if pathData is valid
      if (!Array.isArray(pathData)) {
        throw new Error("Path data is not an array");
      }

      if (pathData.length === 0) {
        console.warn(
          `Warning: Student ${path.basename(
            studentDir
          )} has empty art (no path data)`
        );
      }

      // Clean up
      await fsUtils.removeDirectory(tmpArtDir);

      return { pathData };
    } catch (parseError: any) {
      throw new Error(`Failed to parse path data: ${parseError.message}`);
    }
  } catch (error: any) {
    // Log specific error for this student
    console.error(
      `Error collecting art for ${path.basename(studentDir)}: ${error.message}`
    );

    // Clean up if possible
    try {
      await fsUtils.removeDirectory(tmpArtDir);
    } catch {
      // Ignore cleanup errors
    }

    return {
      pathData: [],
      error: error.message,
    };
  }
}
