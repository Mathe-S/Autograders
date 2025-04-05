/**
 * This file is maintained for backward compatibility.
 * The actual implementation has been moved to the src directory.
 */

import { runAutograder } from "./src/index";

// Run the autograder when this file is executed directly
if (require.main === module) {
  console.log(
    "Note: The autograder has been refactored to a modular structure in the src/ directory."
  );
  console.log("This file is maintained for backward compatibility.\n");

  runAutograder().catch((error) => {
    console.error("Error running autograder:", error);
    process.exit(1);
  });
}

// Export for any imports of this file
export { runAutograder };
