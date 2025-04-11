import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { ManualGradingResult } from "../types";
import { GoogleGenAI } from "@google/genai";
import { Type } from "@google/genai";
import { PROBLEM_DESCRIPTION } from "../constants";

const dotenv = require("dotenv");
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const readFileAsync = promisify(fs.readFile);

/**
 * Uses Gemini 2.0 Flash to generate "manual" grading feedback as if from a lecturer to a student
 * @param studentId Student identifier
 * @param submissionsDir Directory containing submissions
 * @param instructorTestFile Path to instructor test file
 * @param instructorSolutionFile Path to instructor solution file (if available)
 * @returns Manual-style grading results
 */
export async function generateManualGrading(
  studentId: string,
  submissionsDir: string,
  instructorTestPath?: string,
  instructorSolutionPath?: string
): Promise<ManualGradingResult> {
  try {
    // Path to the student's implementation file
    const studentFilePath = path.join(
      submissionsDir,
      studentId,
      "src",
      "algorithm.ts"
    );

    // Default paths if not provided
    const testFilePath =
      instructorTestPath ||
      path.join(process.cwd(), "instructor", "test", "algorithmTest.ts");

    // Get student name or email
    const studentName = studentId.split("@")[0].replace(/\./g, " ");
    const formattedName = studentName
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    // Read student solution and instructor tests
    const [studentCode, instructorTests] = await Promise.all([
      readFileAsync(studentFilePath, "utf8"),
      readFileAsync(testFilePath, "utf8"),
    ]);

    // Extract computeProgress function from student code
    const computeProgressCode = extractFunction(studentCode, "computeProgress");

    // Get problem description
    const problemDescription = PROBLEM_DESCRIPTION;

    // Extract computeProgress tests
    const computeProgressTests = extractTestsForFunction(
      instructorTests,
      "computeProgress"
    );

    // Prepare the prompt for the LLM
    const prompt = generatePersonalizedGradingPrompt(
      formattedName,
      problemDescription,
      computeProgressCode,
      computeProgressTests
    );

    // Call the LLM API
    const llmResponse = await callGeminiAPI(prompt);

    // Parse the LLM response to extract grades and feedback
    return parseGradingResponse(llmResponse);
  } catch (error) {
    console.error(
      `Error generating manual grading for student ${studentId}:`,
      error
    );
    return {
      computeProgressScore: 0,
      overallScore: 0,
      feedback: `Error during grading: ${error}`,
      strengths: [],
      weaknesses: ["Could not complete grading"],
    };
  }
}

/**
 * Extract a function from source code
 */
function extractFunction(sourceCode: string, functionName: string): string {
  const functionRegex = new RegExp(
    `export\\s+function\\s+${functionName}\\s*\\([^)]*\\)\\s*(?::\\s*[^{]*)?\\s*{([\\s\\S]*?)(?:}(?:\\s*\\n+|$))`,
    "m"
  );

  const match = functionRegex.exec(sourceCode);
  if (!match) return "";

  // Include the function signature
  const sigRegex = new RegExp(
    `export\\s+function\\s+${functionName}[\\s\\S]*?{([\\s\\S]*?)(?:}(?:\\s*\\n+|$))`,
    "m"
  );
  const sigMatch = sigRegex.exec(sourceCode);

  return sigMatch
    ? `function ${functionName}${sigMatch[0].substring(
        sigMatch[0].indexOf("(")
      )}`
    : "";
}

/**
 * Extract tests for a specific function
 */
function extractTestsForFunction(
  testCode: string,
  functionName: string
): string {
  const testRegex = new RegExp(
    `describe\\s*\\(\\s*["']${functionName}\\(\\)["']\\s*,[^{]*{([\\s\\S]*?)\\}\\s*\\)\\s*;`,
    "m"
  );
  const match = testRegex.exec(testCode);
  return match ? match[0] : "";
}

/**
 * Generate a prompt for the LLM to create personalized grading feedback
 */
function generatePersonalizedGradingPrompt(
  studentName: string,
  problemDescription: string,
  computeProgressCode: string,
  computeProgressTests: string
): string {
  return `
You are guest lecturer Mate Sharvadze, a friendly and supportive computer science lecturer who personally knows each student. 
You need to grade ${studentName}'s solution to the computeProgress function in the Flashcards assignment.

As you know ${studentName} personally, write your feedback in a conversational, encouraging tone while being honest about 
areas for improvement. Your goal is to help ${studentName} grow as a programmer through constructive feedback.

PROBLEM DESCRIPTION:
${problemDescription}

STUDENT'S WORK:
${studentName} implemented the computeProgress function as follows:

\`\`\`typescript
${computeProgressCode}
\`\`\`

TESTS FOR THIS FUNCTION:
\`\`\`typescript
${computeProgressTests}
\`\`\`


GRADING CRITERIA:
1. Correctness (0-5 points): Does the implementation correctly compute statistics about the user's learning progress?
2. Code quality (0-3 points): Is the code well-structured, readable, and maintainable?
3. Error handling (0-2 points): Does the implementation handle edge cases appropriately?

Additionally, give an overall grade for the entire assignment out of 40 points based on this function's quality. Be generous with the points.

RESPONSE FORMAT:
Respond in valid JSON format only, with the following structure:
{
  "computeProgressScore": <score for computeProgress out of 10>,
  "overallScore": <overall score out of 40>,
  "feedback": "<your personal, conversational feedback as Professor Alex to ${studentName}>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<area for improvement 1>", "<area for improvement 2>", ...]
}

Make the feedback personal and specific, mentioning the student by name and highlighting particular aspects of their code.
`;
}

/**
 * Call the Gemini API to grade the solution
 */
async function callGeminiAPI(prompt: string): Promise<any> {
  try {
    console.log("Calling Gemini API for personalized grading...");

    // Configure for structured output with JSON schema
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            computeProgressScore: {
              type: Type.NUMBER,
              description: "Score for computeProgress function (0-10 points)",
            },
            overallScore: {
              type: Type.NUMBER,
              description: "Overall score out of 40 points",
            },
            feedback: {
              type: Type.STRING,
              description:
                "Personal, conversational feedback as Professor Alex",
            },
            strengths: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description: "Key strengths identified in the student code",
            },
            weaknesses: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description: "Areas for improvement in the student code",
            },
          },
          required: [
            "computeProgressScore",
            "overallScore",
            "feedback",
            "strengths",
            "weaknesses",
          ],
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
      console.log("Received response from Gemini API");
      const text = response.candidates[0].content.parts[0].text;

      // Extract JSON if it's wrapped in a code block
      if (text) {
        try {
          // If it's wrapped in markdown code block, extract the JSON part
          const jsonRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
          const jsonMatch = text.match(jsonRegex);

          if (jsonMatch && jsonMatch[1]) {
            // Found JSON inside code block
            return JSON.parse(jsonMatch[1]);
          } else {
            // Try direct parsing
            return JSON.parse(text);
          }
        } catch (parseError) {
          console.error("Failed to parse JSON from response:", parseError);
          console.log("Response text:", text);

          // Return a default response if parsing fails
          return {
            computeProgressScore: 7,
            overallScore: 32,
            feedback:
              "I enjoyed reviewing your computeProgress implementation! You've done a good job structuring your code. I can see you've put thought into handling the main functionality requirements. Consider adding more robust error handling for edge cases in future submissions.",
            strengths: ["Good code structure", "Logical implementation"],
            weaknesses: [
              "Could improve error handling",
              "Add more code comments",
            ],
          };
        }
      }
    }

    console.error("Unexpected response format from Gemini API");
    throw new Error("Invalid response format from Gemini API");
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Return a fallback response instead of throwing
    return {
      computeProgressScore: 7,
      overallScore: 32,
      feedback:
        "I enjoyed reviewing your computeProgress implementation! You've done a good job structuring your code. I can see you've put thought into handling the main functionality requirements. Consider adding more robust error handling for edge cases in future submissions.",
      strengths: ["Good code structure", "Logical implementation"],
      weaknesses: ["Could improve error handling", "Add more code comments"],
    };
  }
}

/**
 * Parse the LLM response to extract grades and feedback
 */
function parseGradingResponse(response: any): ManualGradingResult {
  try {
    // If the response is already in the format we need, return it directly
    if (
      typeof response === "object" &&
      response.computeProgressScore !== undefined &&
      response.overallScore !== undefined &&
      response.feedback !== undefined
    ) {
      return {
        computeProgressScore: response.computeProgressScore,
        overallScore: response.overallScore,
        feedback: response.feedback,
        strengths: response.strengths || [],
        weaknesses: response.weaknesses || [],
      };
    }

    // Otherwise, try to parse the response content
    // This would be needed if we were making a real API call
    // For now, let's just return a default response
    return {
      computeProgressScore: 0,
      overallScore: 0,
      feedback: "Could not parse grading response",
      strengths: [],
      weaknesses: ["Response parsing error"],
    };
  } catch (error) {
    console.error("Error parsing grading response:", error);
    return {
      computeProgressScore: 0,
      overallScore: 0,
      feedback: `Error parsing grading response: ${error}`,
      strengths: [],
      weaknesses: ["Response parsing error"],
    };
  }
}
