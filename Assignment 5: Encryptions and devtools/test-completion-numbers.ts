// Test script to manually verify completion number generation

/**
 * Generate userHash from userId using btoa encoding and taking first 8 characters
 */
function generateUserHash(userId: string): string {
  try {
    return btoa(userId).slice(0, 8);
  } catch (error) {
    throw new Error(`Failed to generate userHash for userId: ${userId}`);
  }
}

/**
 * Apply Caesar cipher with +1 shift to generate completion number
 */
function generateCompletionNumber(userHash: string): string {
  return userHash
    .split("")
    .map((char) => {
      if (char.match(/[A-Za-z]/)) {
        const isUpperCase = char === char.toUpperCase();
        const base = isUpperCase ? 65 : 97;
        return String.fromCharCode(
          ((char.charCodeAt(0) - base + 1) % 26) + base
        );
      }
      return char;
    })
    .join("");
}

// Test with some example user IDs from the CSV
const testCases = [
  "3f5bdb0d-7bb0-4210-8a68-1977581f8c16", // luka khimshiashvili
  "5ee350da-972f-46b3-baa1-e4db4d512a66", // Daviti Matiashvili
  "a42a173d-1b4e-47c9-a7c9-fceb0cd51419", // nino ramishvili
];

console.log("=== COMPLETION NUMBER GENERATION TEST ===\n");

testCases.forEach((userId, index) => {
  try {
    const userHash = generateUserHash(userId);
    const completionNumber = generateCompletionNumber(userHash);

    console.log(`Test Case ${index + 1}:`);
    console.log(`User ID: ${userId}`);
    console.log(`User Hash: ${userHash}`);
    console.log(`Completion Number: ${completionNumber}`);
    console.log(`---`);
  } catch (error) {
    console.error(`Error processing test case ${index + 1}:`, error);
  }
});

// Interactive test - you can uncomment and modify this
/*
const customUserId = "your-test-user-id-here";
console.log("\nCustom Test:");
console.log(`User ID: ${customUserId}`);
console.log(`User Hash: ${generateUserHash(customUserId)}`);
console.log(`Completion Number: ${generateCompletionNumber(generateUserHash(customUserId))}`);
*/

export { generateUserHash, generateCompletionNumber };
