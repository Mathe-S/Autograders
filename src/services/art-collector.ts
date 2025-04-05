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

    // Copy the instructor's turtle.ts and the student's turtlesoup.ts
    await fsUtils.copyFile(
      path.join(rootDir, "instructor/src", "turtle.ts"),
      path.join(tmpArtDir, "turtle.ts")
    );

    await fsUtils.copyFile(
      path.join(studentDir, "src", "turtlesoup.ts"),
      path.join(tmpArtDir, "turtlesoup.ts")
    );

    // Create a wrapper script that will execute drawPersonalArt and extract the path
    const wrapperContent = `
      import { SimpleTurtle } from './turtle';
      import { drawPersonalArt } from './turtlesoup';
      import * as fs from 'fs';

      // Create turtle, execute art function, and save the path
      (function() {
        try {
          const turtle = new SimpleTurtle();
          drawPersonalArt(turtle);
          const pathData = JSON.stringify(turtle.getPath());
          fs.writeFileSync('path.json', pathData);
        } catch (error) {
          console.error('Error generating art:', error);
          process.exit(1);
        }
      })();
    `;

    await fsUtils.writeFile(path.join(tmpArtDir, "wrapper.ts"), wrapperContent);

    // Execute the wrapper
    await execAsync(`cd ${tmpArtDir} && npx ts-node wrapper.ts`, {
      timeout: 10000, // 10 second timeout
    });

    // Read the path data
    const pathDataPath = path.join(tmpArtDir, "path.json");
    const pathData = JSON.parse(await fsUtils.readFile(pathDataPath));

    // Clean up
    await fsUtils.removeDirectory(tmpArtDir);

    return { pathData };
  } catch (error: any) {
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
