import * as fs from "fs/promises";
import * as path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { StudentResult, ProcessedStudentResult } from "../types";

const dotenv = require("dotenv");
dotenv.config();

const AI_MODEL = "gemini-2.5-flash-preview-04-17";

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
try {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} catch (error) {
  console.error("Failed to initialize GoogleGenAI client:", error);
  // The functions below will handle the case where `ai` is null
}

// Define the structure for the LLM re-evaluation result
export interface ReevaluationResult {
  finalTotalPoints: number;
  finalGradingExplanation: string;
}

/**
 * Reads old and new submission files for a student.
 * @param studentId The student's ID.
 * @param oldSubmissionsDir Path to the old submissions directory.
 * @param newSubmissionsDir Path to the new submissions directory.
 * @returns An object containing the old and new code as strings, or null if files are missing.
 */
async function readSubmissions(
  studentId: string,
  oldSubmissionsDir: string,
  newSubmissionsDir: string
): Promise<{ oldCode: string; newCode: string } | null> {
  const oldFilePath = path.join(
    oldSubmissionsDir,
    studentId,
    "src",
    "algorithm.ts"
  );
  const newFilePath = path.join(
    newSubmissionsDir,
    studentId,
    "src",
    "algorithm.ts"
  );

  try {
    console.log(`Reading old submission: ${oldFilePath}`);
    const oldCode = await fs.readFile(oldFilePath, "utf-8");
    console.log(`Reading new submission: ${newFilePath}`);
    const newCode = await fs.readFile(newFilePath, "utf-8");
    return { oldCode, newCode };
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.error(
        `Error reading submissions for ${studentId}: File not found.`,
        error.path
      );
    } else {
      console.error(`Error reading submissions for ${studentId}:`, error);
    }
    return null;
  }
}

/**
 * Prepares the prompt for the LLM to re-evaluate the submission.
 * @param studentId The student's ID.
 * @param oldCode The student's previous submission code.
 * @param newCode The student's new submission code.
 * @param previousResult The student's grading results from the previous report.
 * @returns The prompt string for the LLM.
 */
function prepareReevaluationPrompt(
  studentId: string,
  oldCode: string,
  newCode: string,
  previousResult: ProcessedStudentResult
): string {
  // TODO: Craft a detailed prompt incorporating:
  // - Student ID
  // - Old code
  // - New code
  // - Previous feedback (notes, manualGradingResult, implementationStatus)
  // - Clear instructions to evaluate IMPROVEMENT based on the feedback
  // - Instruction to suggest a new totalPoints score (integer)
  // - Instruction to provide a concise explanation for the new score
  // - Emphasize comparing the *specific* feedback points with the changes made.

  const prompt = `
Re-evaluate the submission for student: ${studentId}

Previous Feedback & Score:
${JSON.stringify(previousResult.notes, null, 2)}
${JSON.stringify(previousResult.manualGradingResult, null, 2)}
Previous Total Points: ${previousResult.totalPoints}

---
Old Submission:
\`\`\`typescript
${oldCode}
\`\`\`

---
New Submission:
\`\`\`typescript
${newCode}
\`\`\`

---
Instructions:
1. Compare the old and new submissions, focusing on the changes made in response to the specific feedback provided above.
2. Evaluate the quality and correctness of the improvements.
3. Suggest a new final total score (as an integer) based on the improvements. The new score cannot be lower than the previous score (${
    previousResult.totalPoints
  }).
4. Provide a concise explanation for the suggested final score, referencing the specific feedback points and the changes observed in the new code.

Respond ONLY in the following JSON format:
{
  "finalTotalPoints": <integer>,
  "finalGradingExplanation": "<string>"
}
`;
  return prompt;
}

/**
 * Calls the LLM API to get the re-evaluation.
 * @param prompt The prompt for the LLM.
 * @returns The parsed ReevaluationResult object or null if the LLM call fails or returns invalid format.
 */
async function callLLMForReevaluation(
  prompt: string,
  maxRetries = 3
): Promise<ReevaluationResult | null> {
  if (!ai) {
    console.error("LLM client not initialized. Cannot call API.");
    return null;
  }

  let retries = 0;
  while (retries <= maxRetries) {
    try {
      console.log(
        `Calling Gemini API for re-evaluation... (attempt ${retries + 1}/${
          maxRetries + 1
        })`
      );

      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              finalTotalPoints: {
                type: Type.NUMBER,
                description:
                  "The final total score (integer) based on improvements. Must be lower than 40 and can be equal but not lower than the previous score.",
              },
              finalGradingExplanation: {
                type: Type.STRING,
                description:
                  "Concise explanation for the final score, referencing feedback and changes.",
              },
            },
            required: ["finalTotalPoints", "finalGradingExplanation"],
          },
        },
      });

      if (
        response &&
        response.candidates &&
        response.candidates.length > 0 &&
        response.candidates[0].content &&
        response.candidates[0].content.parts &&
        response.candidates[0].content.parts.length > 0
      ) {
        console.log("Received response from Gemini API for re-evaluation");
        const text = response.candidates[0].content.parts[0].text;

        if (text) {
          try {
            // Attempt to parse directly first, then check for markdown block
            let parsedResponse: ReevaluationResult;
            try {
              parsedResponse = JSON.parse(text);
            } catch (directParseError) {
              const jsonRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
              const jsonMatch = text.match(jsonRegex);
              if (jsonMatch && jsonMatch[1]) {
                parsedResponse = JSON.parse(jsonMatch[1]);
              } else {
                throw new Error(
                  "Response is not valid JSON and not in a markdown block."
                );
              }
            }

            // Validate the parsed structure
            if (
              typeof parsedResponse.finalTotalPoints === "number" &&
              typeof parsedResponse.finalGradingExplanation === "string"
            ) {
              return parsedResponse;
            } else {
              console.error(
                "LLM returned response missing required fields for re-evaluation.",
                parsedResponse
              );
              return null; // Invalid format
            }
          } catch (parseError) {
            console.error(
              "Failed to parse JSON from re-evaluation response:",
              parseError
            );
            console.log("Response text:", text);
            return null; // Parsing failed
          }
        }
      }

      console.error(
        "Unexpected response format from Gemini API for re-evaluation"
      );
      throw new Error("Invalid response format from Gemini API");
    } catch (error: any) {
      console.error(
        `Error calling Gemini API for re-evaluation (attempt ${retries + 1}/${
          maxRetries + 1
        }):`,
        error
      );

      if (error?.message?.includes("429") || error?.status === 429) {
        retries++;
        let retryDelay = 30000 * Math.pow(2, retries - 1); // Exponential backoff starting at 30s
        retryDelay = Math.min(retryDelay, 120000); // Cap at 2 minutes

        console.log(
          `Rate limit exceeded. Retrying re-evaluation in ${
            retryDelay / 1000
          } seconds...`
        );

        if (retries <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue; // Try again
        }
      }

      // Non-retryable error or max retries exceeded
      return null;
    }
  }
  // If loop completes (max retries exceeded)
  console.error("Exceeded maximum retries for Gemini API re-evaluation call.");
  return null;
}

/**
 * Re-evaluates a student's submission based on previous feedback and code changes.
 * @param studentId The student's ID.
 * @param previousResult The student's grading results from the previous report.
 * @param oldSubmissionsDir Path to the old submissions directory.
 * @param newSubmissionsDir Path to the new submissions directory.
 * @returns The ReevaluationResult containing the final score and explanation, or null if an error occurs.
 */
export async function reevaluateStudentSubmission(
  studentId: string,
  previousResult: ProcessedStudentResult,
  oldSubmissionsDir: string,
  newSubmissionsDir: string
): Promise<ReevaluationResult | null> {
  console.log(`Re-evaluating student ${studentId}...`);

  const submissions = await readSubmissions(
    studentId,
    oldSubmissionsDir,
    newSubmissionsDir
  );
  if (!submissions) {
    console.error(`Could not read submissions for ${studentId}`);
    return null;
  }

  const prompt = prepareReevaluationPrompt(
    studentId,
    submissions.oldCode,
    submissions.newCode,
    previousResult
  );

  const llmResult = await callLLMForReevaluation(prompt);

  if (!llmResult) {
    console.error(`LLM re-evaluation failed for ${studentId}`);
    return null;
  }

  // Ensure the final score is not less than the previous score
  const originalScore = previousResult.totalPoints ?? 0;
  if (llmResult.finalTotalPoints < originalScore) {
    console.warn(
      `LLM suggested score (${llmResult.finalTotalPoints}) is lower than original (${originalScore}) for ${studentId}. Keeping original score.`
    );
    llmResult.finalTotalPoints = originalScore;
    llmResult.finalGradingExplanation = `(Score adjusted upwards) ${llmResult.finalGradingExplanation}`;
  }

  console.log(
    `Re-evaluation complete for ${studentId}. New score: ${llmResult.finalTotalPoints}`
  );
  return llmResult;
}
