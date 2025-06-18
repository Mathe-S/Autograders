# Assignment 5: Completion Number Verification Script

This script verifies the completion numbers submitted by students for Assignment 5: Encryptions and devtools.

## Overview

The completion number verification process:

1. **Generate userHash**: From the user's ID, create a hash using `btoa(userId).slice(0, 8)` (base64 encoding of user ID, first 8 characters)
2. **Apply Caesar cipher**: Apply a +1 shift to each letter in the userHash to generate the expected completion number
3. **Verify**: Compare the expected completion number with the student's submitted completion number

## Files

- `assignment_submissions.csv` - Input file containing student submissions
- `verify-completion-numbers.ts` - Main verification script
- `completion_verification_report.json` - Generated grading report
- `package.json` - Dependencies configuration
- `tsconfig.json` - TypeScript configuration

## Usage

### Prerequisites

Make sure you have Node.js installed (version 14 or higher).

### Installation

```bash
npm install
```

### Running the Script

#### Option 1: Run with TypeScript directly

```bash
npm run dev
```

#### Option 2: Build and run JavaScript

```bash
npm run build
npm start
```

#### Option 3: Build and run in one command

```bash
npm run verify
```

## Output

The script generates:

1. **Console output** with summary statistics:

   - Total students processed
   - Number passed/failed
   - Passing percentage
   - Average points
   - Execution time
   - Sample results

2. **JSON report file** (`completion_verification_report.json`) with detailed results in the same format as other autograder reports

## Report Structure

The generated report follows this structure:

```json
{
  "timestamp": "2025-01-XX...",
  "totalStudents": 61,
  "statusCounts": {
    "passed": 60,
    "failed": 1,
    "errors": 0,
    "unknown": 0
  },
  "passingPercentage": 98,
  "executionTimeSeconds": 0.002,
  "students": [
    {
      "studentId": "student@email.com",
      "status": "passed",
      "notes": ["Completion number verified successfully"],
      "points": 50
    }
  ],
  "totalPoints": 3000,
  "averagePoints": 49
}
```

## Completion Number Algorithm

The algorithm used to generate expected completion numbers:

```javascript
// Step 1: Generate userHash
const userHash = btoa(userId).slice(0, 8);

// Step 2: Apply Caesar cipher (+1 shift)
const completionNumber = userHash
  .split("")
  .map((char) => {
    if (char.match(/[A-Za-z]/)) {
      const isUpperCase = char === char.toUpperCase();
      const base = isUpperCase ? 65 : 97;
      return String.fromCharCode(((char.charCodeAt(0) - base + 1) % 26) + base);
    }
    return char;
  })
  .join("");
```

## Scoring

- **Passed (50 points)**: Completion number matches expected value
- **Failed (0 points)**: Completion number doesn't match or is missing

## Error Handling

The script handles various error conditions:

- Missing completion numbers
- Invalid user IDs
- File reading errors
- CSV parsing issues

All errors are logged in the report notes for debugging.
