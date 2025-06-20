# Assignment 6: Progress Key Verification Script

This script verifies the progress keys submitted by students for Assignment 6: Course Overview.

## Overview

The progress key verification process uses **format validation** since full decryption requires exact generation dates and user data that are not available. The verification checks:

1. **Format Structure**: Ensures the key follows the expected pattern
2. **Step Count Validation**: Verifies the step count is within reasonable range (0-20)
3. **Base64-like Encoding**: Checks for proper encoding patterns
4. **Prefix Validation**: Ensures keys start with the expected encryption prefix

## Progress Key Format

Based on the actual data analysis, progress keys follow this pattern:

```
U2FSDGVKX1[encrypted-part1]-[encrypted-part2]=-[steps]
```

Example: `U2FSDGVKX1815XWY-XTJ83GG2UGAVKQW=-20`

### Key Components

- **Prefix**: `U2FSDGVKX1` (constant encryption identifier)
- **Encrypted Part 1**: Base64-like encoded data
- **Encrypted Part 2**: More base64-like encoded data
- **Step Count**: Number of completed steps (16, 18, 20, etc.)

## Files

- `assignment_submissions.csv` - Input file containing student submissions
- `verify-progress-keys.ts` - Main verification script
- `test-progress-keys.ts` - Test script with examples
- `progress_key_verification_report.json` - Generated grading report
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

#### Option 4: Run tests with examples

```bash
npm run test
```

## Validation Logic

The script performs the following checks:

### 1. Format Validation

- ✅ Checks if key starts with `U2FSDGVKX1`
- ✅ Validates presence of at least 2 separators (`-`)
- ✅ Ensures minimum length (20+ characters)
- ✅ Checks for valid base64-like characters

### 2. Step Count Validation

- ✅ Extracts step count from the end of the key
- ✅ Validates step count is between 0-20
- ✅ Reports detected step count in results

### 3. Structure Analysis

- ✅ Analyzes key parts and structure
- ✅ Provides detailed feedback on format issues
- ✅ Enhanced validation with additional pattern checks

## Output

The script generates:

1. **Console output** with summary statistics:

   - Total students processed
   - Number passed/failed
   - Passing percentage
   - Average points
   - Execution time
   - Sample results
   - Failed cases summary for debugging

2. **JSON report file** (`progress_key_verification_report.json`) with detailed results

## Report Structure

```json
{
  "timestamp": "2025-01-XX...",
  "totalStudents": 49,
  "statusCounts": {
    "passed": 46,
    "failed": 3,
    "errors": 0,
    "unknown": 0
  },
  "passingPercentage": 94,
  "executionTimeSeconds": 0.003,
  "students": [
    {
      "studentId": "student@email.com",
      "status": "passed",
      "notes": [
        "Progress key format validated successfully",
        "Detected 20 completed steps",
        "Contains expected encryption prefix"
      ],
      "points": 50
    }
  ],
  "totalPoints": 2300,
  "averagePoints": 47
}
```

## Scoring

- **Passed (50 points)**: Progress key passes all format validations
- **Failed (0 points)**: Progress key fails format validation or is missing

## Validation Examples

### ✅ Valid Progress Keys

```
U2FSDGVKX1815XWY-XTJ83GG2UGAVKQW=-20        (20 steps)
U2FSDGVKX1896U8S-OJ/YBUPRZYRTLZOF-20       (20 steps)
U2FSDGVKX1++HQGL-AJAI6MMPS+SPJA==-16       (16 steps)
```

### ❌ Invalid Progress Keys

```
""                                          (empty)
"<3"                                        (invalid format)
"https://github.com/user/repo"             (not a progress key)
```

## Limitations

Since full cryptographic verification requires:

- Exact generation date
- User's complete profile data
- Original encryption key

This script focuses on **format validation** which is practical and reliable for grading purposes.

## Error Handling

The script handles various error conditions:

- Missing or empty progress keys
- Invalid format structures
- Step counts outside reasonable range
- Invalid characters in encoding
- File reading and CSV parsing issues

All errors are logged in the report notes for debugging and transparency.
