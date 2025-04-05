import { StudentResult, Point, Color } from "../types";
import * as fsUtils from "../utils/fs-utils";

/**
 * Generate an HTML art gallery from student personal art
 * @param students Array of student results
 * @returns HTML content for the gallery
 */
export async function generateArtGallery(
  students: StudentResult[]
): Promise<string> {
  console.log("\nGenerating student art gallery...");

  // Gallery layout configuration
  const studentsPerRow = 5;
  const canvasWidth = 400;
  const canvasHeight = 400;
  const padding = 20;
  const labelHeight = 30;

  // Calculate layout dimensions
  const totalRows = Math.ceil(students.length / studentsPerRow);
  const fullWidth = studentsPerRow * (canvasWidth + padding) + padding;
  const fullHeight =
    totalRows * (canvasHeight + labelHeight + padding) + padding;

  // Generate SVG elements for each student
  let svgElements = "";
  let validStudentIndex = 0;

  students.forEach((student) => {
    // Skip students with art generation errors
    if (student.personalArt.error) {
      return;
    }

    // Calculate position in the grid
    const row = Math.floor(validStudentIndex / studentsPerRow);
    const col = validStudentIndex % studentsPerRow;

    const xOffset = padding + col * (canvasWidth + padding);
    const yOffset = padding + row * (canvasHeight + labelHeight + padding);

    // Add student ID label
    svgElements += `
      <text 
        x="${xOffset + canvasWidth / 2}" 
        y="${yOffset + labelHeight / 2}" 
        text-anchor="middle" 
        dominant-baseline="middle" 
        font-family="Arial" 
        font-size="14" 
        font-weight="bold"
      >
        ${student.studentId}
      </text>
    `;

    // Create background for the canvas
    svgElements += `
      <rect 
        x="${xOffset}" 
        y="${yOffset + labelHeight}" 
        width="${canvasWidth}" 
        height="${canvasHeight}" 
        fill="#f0f0f0" 
        stroke="#ccc" 
        stroke-width="1"
      />
    `;

    // Add the student's art paths
    student.personalArt.pathData.forEach((segment) => {
      // Scale and center the paths within each canvas
      const x1 = segment.start.x + canvasWidth / 2;
      const y1 = segment.start.y + canvasHeight / 2 + labelHeight;
      const x2 = segment.end.x + canvasWidth / 2;
      const y2 = segment.end.y + canvasHeight / 2 + labelHeight;

      svgElements += `
        <line 
          x1="${xOffset + x1}" 
          y1="${yOffset + y1}" 
          x2="${xOffset + x2}" 
          y2="${yOffset + y2}" 
          stroke="${segment.color}" 
          stroke-width="2"
        />
      `;
    });

    validStudentIndex++;
  });

  // Create the HTML with SVG grid
  const galleryHtml = `<!DOCTYPE html>
  <html>
  <head>
      <title>Student Art Gallery</title>
      <style>
          body { margin: 0; font-family: Arial, sans-serif; }
          h1 { text-align: center; margin: 20px 0; }
          .container { display: flex; justify-content: center; }
      </style>
  </head>
  <body>
      <h1>Student Art Gallery</h1>
      <div class="container">
        <svg width="${fullWidth}" height="${fullHeight}">
          ${svgElements}
        </svg>
      </div>
  </body>
  </html>`;

  return galleryHtml;
}

/**
 * Save the art gallery HTML to a file
 * @param html HTML content for the gallery
 * @param outputPath The path to save the gallery to (optional, defaults to student_art_gallery.html in cwd)
 */
export async function saveArtGallery(
  html: string,
  outputPath?: string
): Promise<string> {
  const galleryPath = outputPath || "student_art_gallery.html";
  await fsUtils.writeFile(galleryPath, html);
  return galleryPath;
}
