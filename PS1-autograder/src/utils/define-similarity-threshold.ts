export const defineSimilarityThreshold = (args: string[]) => {
  const thresholdArg = args.find((arg) => arg.startsWith("--threshold="));
  let threshold = 80; // Default threshold
  if (thresholdArg) {
    const thresholdValue = parseInt(thresholdArg.split("=")[1], 10);
    if (!isNaN(thresholdValue) && thresholdValue > 0 && thresholdValue <= 100) {
      threshold = thresholdValue;
    } else {
      console.warn(`Invalid threshold value. Using default threshold of 80%.`);
    }
  }
  return threshold;
};
