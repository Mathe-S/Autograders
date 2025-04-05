# PS0 Autograder

An automated grader for Problem Set 0 that evaluates student implementations, tests, and personal art.

## Project Structure

The autograder is organized into the following structure:

```
src/
  ├── index.ts                 # Main entry point
  ├── types/                   # Type definitions
  │   └── index.ts             # Shared types and interfaces
  ├── services/                # Core services
  │   ├── test-runner.ts       # Test execution logic
  │   ├── art-collector.ts     # Personal art collection
  │   └── student-processor.ts # Individual student processing
  ├── reporters/               # Output generators
  │   ├── report-generator.ts  # Grading report creation
  │   └── art-gallery-generator.ts # Student art gallery
  └── utils/                   # Utility functions
      └── fs-utils.ts          # File system operations
```

## Features

- Multi-threaded grading for faster processing
- Coverage reporting for student tests
- Student art gallery visualization
- Detailed grading reports

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the autograder:
   ```bash
   npm run autograde
   ```

## Configuration

- Student submissions are expected in the `Submissions_auto` directory
- Instructor reference implementation should be in the `instructor/src` directory
- Instructor tests should be in the `instructor/test` directory

## Development

To run in development mode without compiling:

```bash
npm run dev
```

## Output

The autograder produces:

- `grading_report.json`: Summary of all student results
- `student_art_gallery.html`: Visual gallery of student art
