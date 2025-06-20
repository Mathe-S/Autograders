// Test script to validate progress key formats with actual examples

/**
 * Validate the format of a progress key
 * Expected format: U2FSDGVKX1[encrypted-part1]-[encrypted-part2]=-[steps]
 */
function validateProgressKeyFormat(progressKey: string): {
  isValid: boolean;
  stepCount?: number;
  formatIssues: string[];
} {
  const formatIssues: string[] = [];

  if (!progressKey || progressKey.trim() === "") {
    return {
      isValid: false,
      formatIssues: ["Progress key is empty or missing"],
    };
  }

  // Check if it starts with expected prefix pattern
  if (!progressKey.startsWith("U2FSDGVKX1")) {
    formatIssues.push("Progress key does not start with expected prefix");
  }

  // Extract step count from the end
  const stepMatch = progressKey.match(/-(\d+)$/);
  let stepCount: number | undefined;

  if (stepMatch) {
    stepCount = parseInt(stepMatch[1], 10);

    // Validate step count is reasonable (0-20 as mentioned in instructions)
    if (stepCount < 0 || stepCount > 20) {
      formatIssues.push(
        `Step count ${stepCount} is outside reasonable range (0-20)`
      );
    }
  } else {
    formatIssues.push("Could not extract step count from progress key");
  }

  // Check for base64-like pattern (contains alphanumeric, +, /, =)
  const base64Pattern = /^[A-Za-z0-9+/=\-]+$/;
  if (!base64Pattern.test(progressKey)) {
    formatIssues.push(
      "Progress key contains invalid characters for base64-like encoding"
    );
  }

  // Check for presence of separators
  const separatorCount = (progressKey.match(/-/g) || []).length;
  if (separatorCount < 2) {
    formatIssues.push("Progress key should contain at least 2 separators");
  }

  // Check minimum length (should be substantial if properly encrypted)
  if (progressKey.length < 20) {
    formatIssues.push("Progress key is too short to be a valid encrypted key");
  }

  return {
    isValid: formatIssues.length === 0,
    stepCount,
    formatIssues,
  };
}

// Test with actual examples from the CSV data
const testCases = [
  {
    student: "Davit Datunashvili",
    key: "U2FSDGVKX1815XWY-XTJ83GG2UGAVKQW=-20",
  },
  {
    student: "GafroN",
    key: "U2FSDGVKX1896U8S-OJ/YBUPRZYRTLZOF-20",
  },
  {
    student: "Gakha Pitskhelauri",
    key: "U2FSDGVKX1/KDYHA-MKQTRX6L0HYZDG==-20",
  },
  {
    student: "Unknown (demetresadaa)",
    key: "U2FSDGVKX1++HQGL-AJAI6MMPS+SPJA==-16",
  },
  {
    student: "Empty key example",
    key: "",
  },
  {
    student: "NickG (18 steps)",
    key: "U2FSDGVKX1/BU5DQ-CQFZTILRNU1URJOU-18",
  },
];

console.log("=== PROGRESS KEY FORMAT VALIDATION TEST ===\n");

testCases.forEach((testCase, index) => {
  console.log(`Test Case ${index + 1}: ${testCase.student}`);
  console.log(`Progress Key: ${testCase.key || "(empty)"}`);

  const validation = validateProgressKeyFormat(testCase.key);

  console.log(`Valid: ${validation.isValid}`);
  if (validation.stepCount !== undefined) {
    console.log(`Steps: ${validation.stepCount}`);
  }

  if (validation.formatIssues.length > 0) {
    console.log(`Issues: ${validation.formatIssues.join("; ")}`);
  }

  console.log("---\n");
});

// Analyze the common pattern
console.log("=== PATTERN ANALYSIS ===");
const validKeys = testCases
  .filter((tc) => tc.key && tc.key.trim() !== "")
  .map((tc) => tc.key);

console.log(`Total keys analyzed: ${validKeys.length}`);
console.log(
  `Keys starting with U2FSDGVKX1: ${
    validKeys.filter((k) => k.startsWith("U2FSDGVKX1")).length
  }`
);

const stepCounts = validKeys
  .map((key) => {
    const match = key.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  })
  .filter((step) => step !== null);

console.log(`Step counts found: ${stepCounts.join(", ")}`);
console.log(
  `Step range: ${Math.min(...stepCounts)} - ${Math.max(...stepCounts)}`
);

// Test key structure
console.log("\n=== KEY STRUCTURE ANALYSIS ===");
validKeys.forEach((key, index) => {
  const parts = key.split("-");
  console.log(`Key ${index + 1}: ${parts.length} parts`);
  parts.forEach((part, partIndex) => {
    console.log(`  Part ${partIndex + 1}: ${part} (length: ${part.length})`);
  });
  console.log("---");
});

export { validateProgressKeyFormat };
