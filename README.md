# PS0/PS1 Autograder

This repository contains an automated grading system, initially developed for Problem Set 0 and adapted for Problem Set 1. It handles fetching submissions, running student code against test cases, performing static analysis, checking for code similarity, generating feedback (optionally using an LLM), and creating detailed reports.

## Features

- Automated grading of student submissions based on test cases and implementation checks.
- Code similarity analysis to detect potential plagiarism and use of default instructor code.
- Optional LLM-based feedback generation for personalized comments.
- Parallel processing using available CPU cores for faster grading.
- Generation of detailed HTML and console grading reports.
- Fetches submissions based on a CSV list.

## Project Structure

```
PS1-autograder/
├── .env                  # Environment variables (e.g., API keys for LLM) - **MUST BE CREATED**
├── assignment_submissions.csv # CSV file listing student submissions to fetch
├── instructor/           # Contains instructor's reference solution/files
├── node_modules/         # Node.js dependencies (created by npm install)
├── package.json          # Project metadata and dependencies
├── package-lock.json     # Lockfile for reproducible installs
├── reports/              # Output directory for generated grading and similarity reports
├── src/                  # TypeScript source code
│   ├── index.ts          # Main entry point, orchestrates grading and similarity analysis
│   ├── constants.ts      # Project-wide constants
│   ├── services/         # Core logic for grading, testing, LLM interaction, similarity
│   │   ├── student-processor.ts # Handles processing of a single student
│   │   ├── test-runner.ts    # Executes test cases against student code
│   │   ├── llm-grader.ts     # Interacts with LLM for feedback (if enabled)
│   │   └── similarity/
│   │       └── code-similarity.ts # Logic for comparing code files
│   ├── reporters/        # Generates reports (HTML, console summaries)
│   │   ├── report-generator.ts # Generates the main grading report
│   │   └── similarity-reporter.ts # Generates the similarity report
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/            # Utility functions (filesystem, argument parsing)
│   │   ├── fs-utils.ts
│   │   └── define-similarity-threshold.ts
│   └── ...               # Other source files
├── Submissions_auto/     # Default directory where fetched student submissions are stored
├── submittionFetcher.js  # Script to download submissions based on the CSV
├── tsconfig.json         # TypeScript compiler configuration
└── dist/                 # Compiled JavaScript output (created by npm run build)
```

## Prerequisites

- Node.js (v18 or later recommended)
- npm (usually comes with Node.js)

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd PS1-autograder
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Create Environment File:**
    - Create a file named `.env` in the root directory (`PS1-autograder/.env`).
    - If using the LLM feedback feature, add your API key:
      ```
      GEMINI_API_KEY=YOUR_API_KEY_HERE
      ```
4.  **Prepare Submissions List:**
    - Ensure `assignment_submissions.csv` exists and contains the necessary information for `submittionFetcher.js` to download submissions.
5.  **Fetch Submissions:**
    - Run the fetcher script:
      ```bash
      npm run fetch-submissions
      ```
    - This will download submissions into the `Submissions_auto` directory (or configure `submittionFetcher.js` and `src/index.ts` if using a different directory).

## Usage

1.  **Build the project:** (Compile TypeScript to JavaScript)

    ```bash
    npm run build
    ```

    This step is often included in the run scripts but can be run manually.

2.  **Run the Autograder:**

    - **Grade all students:**
      ```bash
      npm run autograde
      ```
    - **Grade specific students:**
      ```bash
      # Grade one student
      npm run autograde -- --student=student_id1
      # Grade multiple students
      npm run autograde -- --student=student_id1,student_id2
      ```
      _(Note the extra `--` before the script arguments)_
    - **Grade all students with LLM Feedback:**
      ```bash
      npm run autograde-llm
      ```
      _(Requires `.env` file with API key)_
    - **Grade specific students with LLM Feedback:**
      ```bash
      npm run autograde-llm -- --student=student_id1,student_id2
      ```

3.  **Run Similarity Analysis Only:**
    - **Using default threshold (70%):**
      ```bash
      npm run build && node dist/index.js --similarity
      ```
    - **Using a custom threshold (e.g., 85%):**
      `bash
      npm run build && node dist/index.js --similarity --threshold=85
    # Or shorthand
    npm run build && node dist/index.js -s -t 85
    `
    This will generate an HTML similarity report and attempt to open it.

## Configuration

- **Submission Directory:** The directory used for grading is hardcoded in `src/index.ts` (`SUBMISSIONS_DIR`). Default is `Submissions_auto`.
- **LLM API Key:** Set the `GEMINI_API_KEY` in the `.env` file for LLM features.
- **Similarity Threshold:** Can be adjusted via command-line arguments when running similarity analysis (`--threshold=<percentage>`). The threshold used during the main grading run is hardcoded in `src/index.ts`.

## Output

- **Console:** Summaries of grading and similarity analysis are printed to the console.
- **Reports Directory:** Detailed HTML reports for grading and similarity are saved in the `reports/` directory.
- **Logs:** Failed submissions might be logged in `failed_submissions_log.txt`.
