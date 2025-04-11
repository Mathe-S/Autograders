import assert from "assert";
import { AnswerDifficulty, Flashcard, BucketMap } from "../src/flashcards";
import {
  toBucketSets,
  getBucketRange,
  practice,
  update,
  getHint,
  computeProgress,
} from "../src/algorithm";
import { expect } from "chai";

/**
 * Testing Strategy for toBucketSets()
 *
 * Partition the input space by:
 * - Size of input map:
 *   × empty map
 *   × single bucket
 *   × multiple buckets
 *
 * - Bucket numbers:
 *   × sequential (0,1,2...)
 *   × with gaps (0,2,4...)
 *   × non-sequential ordering in map (2,0,1)
 *
 * - Contents of buckets:
 *   × empty sets
 *   × single card
 *   × multiple cards
 *
 * - Range of bucket numbers:
 *   × starting at 0
 *   × starting at higher number
 *   × sparse distribution
 *
 * Cover each part of each partition at least once.
 * Also test combinations of different characteristics:
 * - Multiple buckets with varied contents
 * - Non-sequential buckets with gaps
 * - High bucket numbers with empty intervening buckets
 *
 * We use a helper function createCard() to generate test flashcards
 * to avoid repetitive constructor calls and improve test readability.
 */
describe("toBucketSets()", () => {
  it("should handle empty buckets map", () => {
    const emptyMap = new Map<number, Set<Flashcard>>();
    const result = toBucketSets(emptyMap);
    expect(result).to.be.an("array");
    expect(result.length).to.equal(0);
  });

  it("should convert simple sequential buckets", () => {
    const buckets = new Map<number, Set<Flashcard>>();
    const card0 = createCard("card0");
    const card1 = createCard("card1");

    buckets.set(0, new Set([card0]));
    buckets.set(1, new Set([card1]));

    const result = toBucketSets(buckets);

    expect(result.length).to.equal(2);
    expect(result[0]?.has(card0)).to.be.true;
    expect(result[1]?.has(card1)).to.be.true;
  });

  it("should handle gaps in bucket numbers", () => {
    const buckets = new Map<number, Set<Flashcard>>();
    const card0 = createCard("card0");
    const card2 = createCard("card2");

    buckets.set(0, new Set([card0]));
    buckets.set(2, new Set([card2]));

    const result = toBucketSets(buckets);

    expect(result.length).to.equal(3);
    expect(result[0]?.has(card0)).to.be.true;
    expect(result[1]?.size).to.equal(0);
    expect(result[2]?.has(card2)).to.be.true;
  });

  it("should handle multiple cards in same bucket", () => {
    const buckets = new Map<number, Set<Flashcard>>();
    const card1 = createCard("card1");
    const card2 = createCard("card2");

    buckets.set(0, new Set([card1, card2]));

    const result = toBucketSets(buckets);

    expect(result.length).to.equal(1);
    expect(result[0]?.size).to.equal(2);
    expect(result[0]?.has(card1)).to.be.true;
    expect(result[0]?.has(card2)).to.be.true;
  });

  it("should handle non-sequential bucket numbers", () => {
    const buckets = new Map<number, Set<Flashcard>>();
    const card3 = createCard("card3");
    const card5 = createCard("card5");

    buckets.set(3, new Set([card3]));
    buckets.set(5, new Set([card5]));

    const result = toBucketSets(buckets);

    expect(result.length).to.equal(6);
    expect(result[0]?.size).to.equal(0);
    expect(result[1]?.size).to.equal(0);
    expect(result[2]?.size).to.equal(0);
    expect(result[3]?.has(card3)).to.be.true;
    expect(result[4]?.size).to.equal(0);
    expect(result[5]?.has(card5)).to.be.true;
  });
});

/*
 * Testing strategy for getBucketRange():
 *
 * Partition the input space by:
 * - Array size:
 *   × empty array
 *   × single bucket
 *   × multiple buckets
 *
 * - Distribution of cards:
 *   × no cards in any bucket (all empty sets)
 *   × cards in consecutive buckets
 *   × cards with gaps between buckets
 *   × cards only in first bucket
 *   × cards only in last bucket
 *   × cards in first and last bucket only
 *
 * - Bucket indices:
 *   × starting at index 0
 *   × range spanning multiple indices
 *   × large bucket indices
 *
 * Cover each part of each partition at least once.
 * Also test combinations of different characteristics.
 */
describe("getBucketRange()", () => {
  it("should return undefined for empty array", () => {
    const result = getBucketRange([]);
    expect(result).to.be.undefined;
  });

  it("should return undefined when all buckets are empty", () => {
    const buckets: Array<Set<Flashcard>> = [new Set(), new Set(), new Set()];
    const result = getBucketRange(buckets);
    expect(result).to.be.undefined;
  });

  it("should handle single bucket with cards", () => {
    const buckets = [new Set([createCard("card1")])];
    const result = getBucketRange(buckets);
    expect(result).to.deep.equal({ minBucket: 0, maxBucket: 0 });
  });

  it("should handle consecutive buckets with cards", () => {
    const buckets = [
      new Set([createCard("card1")]),
      new Set([createCard("card2")]),
      new Set([createCard("card3")]),
    ];
    const result = getBucketRange(buckets);
    expect(result).to.deep.equal({ minBucket: 0, maxBucket: 2 });
  });

  it("should handle gaps between buckets with cards", () => {
    const buckets: Array<Set<Flashcard>> = [
      new Set([createCard("card1")]),
      new Set(),
      new Set([createCard("card3")]),
      new Set(),
      new Set([createCard("card5")]),
    ];
    const result = getBucketRange(buckets);
    expect(result).to.deep.equal({ minBucket: 0, maxBucket: 4 });
  });

  it("should handle cards only in first bucket", () => {
    const buckets: Array<Set<Flashcard>> = [
      new Set([createCard("card1")]),
      new Set(),
      new Set(),
    ];
    const result = getBucketRange(buckets);
    expect(result).to.deep.equal({ minBucket: 0, maxBucket: 0 });
  });

  it("should handle cards only in last bucket", () => {
    const buckets: Array<Set<Flashcard>> = [
      new Set(),
      new Set(),
      new Set([createCard("card3")]),
    ];
    const result = getBucketRange(buckets);
    expect(result).to.deep.equal({ minBucket: 2, maxBucket: 2 });
  });

  it("should handle cards in first and last bucket only", () => {
    const buckets: Array<Set<Flashcard>> = [
      new Set([createCard("card1")]),
      new Set(),
      new Set([createCard("card3")]),
    ];
    const result = getBucketRange(buckets);
    expect(result).to.deep.equal({ minBucket: 0, maxBucket: 2 });
  });

  it("should handle large bucket indices", () => {
    const buckets = Array(10).fill(new Set());
    buckets[3] = new Set([createCard("card3")]);
    buckets[8] = new Set([createCard("card8")]);
    const result = getBucketRange(buckets);
    expect(result).to.deep.equal({ minBucket: 3, maxBucket: 8 });
  });
});

/*
 * Testing strategy for practice():
 *
 * Partition the input space for buckets:
 *  x empty Set
 *  x single Set bucket
 *  x multiple buckets
 *
 * Cards in the bucket:
 *  x single cards in the bucket
 *  x multiple cards in the bucket
 *  x some empty some single some multiple cards
 *
 * Partition the input space for days:
 *  x day = 0
 *  x day > 0
 *
 *
 *
 *
 */
describe("practice()", () => {
  it("should return empty Set when given empty bucket", () => {
    expect(practice([], 0)).to.deep.equal(new Set());
    expect(practice([new Set()], 1)).to.deep.equal(new Set());
    expect(practice([new Set(), new Set(), new Set()], 5)).to.deep.equal(
      new Set()
    );
  });

  it("should return all cards in single Set bucket", () => {
    const setOfFlashcards: Set<Flashcard> = new Set([
      createCard("card1"),
      createCard("card2"),
      createCard("card3"),
    ]);
    const bucket: Array<Set<Flashcard>> = [new Set([...setOfFlashcards])];

    expect(practice(bucket, 0)).to.deep.equal(setOfFlashcards);
    expect(practice(bucket, 23)).to.deep.equal(setOfFlashcards);
  });

  it("should return correct cards for day 0", () => {
    const setOfFlashcards0: Set<Flashcard> = new Set([
      createCard("card1"),
      createCard("card2"),
      createCard("card3"),
    ]);

    const setOfFlashcards1: Set<Flashcard> = new Set([
      createCard("card4"),
      createCard("card5"),
    ]);

    const setOfFlashcards2: Set<Flashcard> = new Set([createCard("card6")]);

    const bucket: Array<Set<Flashcard>> = [
      new Set([...setOfFlashcards0]),
      new Set([]),
      new Set([...setOfFlashcards1]),
      new Set(),
      new Set([...setOfFlashcards2]),
    ];

    expect(practice(bucket, 0)).to.deep.equal(setOfFlashcards0);
  });

  it("should return correct cards for day 1", () => {
    const setOfFlashcards0: Set<Flashcard> = new Set([
      createCard("card1"),
      createCard("card2"),
      createCard("card3"),
    ]);

    const setOfFlashcards1: Set<Flashcard> = new Set([
      createCard("card4"),
      createCard("card5"),
    ]);

    const setOfFlashcards2: Set<Flashcard> = new Set([createCard("card6")]);

    const bucket: Array<Set<Flashcard>> = [
      new Set([...setOfFlashcards0]),
      new Set([]),
      new Set([...setOfFlashcards1]),
      new Set(),
      new Set([...setOfFlashcards2]),
    ];

    expect(practice(bucket, 1)).to.deep.equal(setOfFlashcards0);
  });

  it("should return correct cards for day 2", () => {
    const setOfFlashcards0: Set<Flashcard> = new Set([
      createCard("card1"),
      createCard("card2"),
      createCard("card3"),
    ]);

    const setOfFlashcards1: Set<Flashcard> = new Set([
      createCard("card4"),
      createCard("card5"),
    ]);

    const setOfFlashcards2: Set<Flashcard> = new Set([createCard("card6")]);

    const bucket: Array<Set<Flashcard>> = [
      new Set([...setOfFlashcards0]),
      new Set([]),
      new Set([...setOfFlashcards1]),
      new Set(),
      new Set([...setOfFlashcards2]),
    ];

    expect(practice(bucket, 2)).to.deep.equal(setOfFlashcards0);
  });

  it("should return correct cards for day 3", () => {
    const setOfFlashcards0: Set<Flashcard> = new Set([
      createCard("card1"),
      createCard("card2"),
      createCard("card3"),
    ]);

    const setOfFlashcards1: Set<Flashcard> = new Set([
      createCard("card4"),
      createCard("card5"),
    ]);

    const setOfFlashcards2: Set<Flashcard> = new Set([createCard("card6")]);

    const bucket: Array<Set<Flashcard>> = [
      new Set([...setOfFlashcards0]),
      new Set([]),
      new Set([...setOfFlashcards1]),
      new Set(),
      new Set([...setOfFlashcards2]),
    ];

    expect(practice(bucket, 3)).to.deep.equal(
      new Set([...setOfFlashcards0, ...setOfFlashcards1])
    );
  });

  it("should return correct cards for day 7", () => {
    const setOfFlashcards0: Set<Flashcard> = new Set([
      createCard("card1"),
      createCard("card2"),
      createCard("card3"),
    ]);

    const setOfFlashcards1: Set<Flashcard> = new Set([
      createCard("card4"),
      createCard("card5"),
    ]);

    const setOfFlashcards2: Set<Flashcard> = new Set([createCard("card6")]);

    const bucket: Array<Set<Flashcard>> = [
      new Set([...setOfFlashcards0]),
      new Set([]),
      new Set([...setOfFlashcards1]),
      new Set(),
      new Set([...setOfFlashcards2]),
    ];

    expect(practice(bucket, 7)).to.deep.equal(
      new Set([...setOfFlashcards0, ...setOfFlashcards1])
    );
  });

  it("should return correct cards for day 15", () => {
    const setOfFlashcards0: Set<Flashcard> = new Set([
      createCard("card1"),
      createCard("card2"),
      createCard("card3"),
    ]);

    const setOfFlashcards1: Set<Flashcard> = new Set([
      createCard("card4"),
      createCard("card5"),
    ]);

    const setOfFlashcards2: Set<Flashcard> = new Set([createCard("card6")]);

    const bucket: Array<Set<Flashcard>> = [
      new Set([...setOfFlashcards0]),
      new Set([]),
      new Set([...setOfFlashcards1]),
      new Set(),
      new Set([...setOfFlashcards2]),
    ];

    expect(practice(bucket, 15)).to.deep.equal(
      new Set([...setOfFlashcards0, ...setOfFlashcards1, ...setOfFlashcards2])
    );
  });

  it("should handle bucket array shorter than Leitner numbers", () => {
    // Only 3 buckets but Leitner system has 6 values
    const bucket: Array<Set<Flashcard>> = [
      new Set([createCard("card1")]),
      new Set([createCard("card2")]),
      new Set([createCard("card3")]),
    ];

    // Test with a day that would access higher buckets if they existed
    expect(practice(bucket, 15)).to.deep.equal(
      new Set([...bucket[0]!, ...bucket[1]!, ...bucket[2]!])
    );
  });

  it("should follow the Leitner schedule correctly", () => {
    const buckets: Array<Set<Flashcard>> = Array(6)
      .fill(null)
      .map((_, i) => new Set([createCard(`card${i}`)]));

    // Bucket 0 should be practiced every day
    for (let day = 0; day < 10; day++) {
      expect(practice(buckets, day).has([...buckets[0]!][0]!)).to.be.true;
    }

    // Bucket 1 should be practiced every other day
    expect(practice(buckets, 1).has([...buckets[1]!][0]!)).to.be.true;
    expect(practice(buckets, 2).has([...buckets[1]!][0]!)).to.be.false;
    expect(practice(buckets, 3).has([...buckets[1]!][0]!)).to.be.true;

    // Bucket 2 should be practiced every 4th day
    expect(practice(buckets, 3).has([...buckets[2]!][0]!)).to.be.true;
    expect(practice(buckets, 4).has([...buckets[2]!][0]!)).to.be.false;
    expect(practice(buckets, 7).has([...buckets[2]!][0]!)).to.be.true;
  });
});

/*
 * Testing strategy for update():
 *
 * Input Space Partitioning:
 * Bucket States:
 *   × Card in bucket 0 (new or incorrectly answered).
 *   × Card in bucket 1 (hard).
 *   × Card in bucket 2 (easy).
 *   × Card in the retired bucket (not applicable for updates).
 * Difficulty Levels:
 *   × Difficulty = 0 (Wrong).
 *   × Difficulty = 1 (Hard).
 *   × Difficulty = 2 (Easy).
 * Card Presence:
 *   × Card is present in the buckets.
 *   × Card is not present in the buckets (should not change anything).
 * Expected Outcomes:
 *   × If the card is answered incorrectly (difficulty = 0), it should remain in bucket 0.
 *   × If the card is answered hard (difficulty = 1), it should move down one bucket unless it is already in bucket 0.
 *   × If the card is answered easy (difficulty = 2), it should move up one bucket unless it is in the retired bucket.
 * Edge Cases:
 *   × Attempting to update a card that does not exist in the buckets.
 *   × Ensuring that the function does not allow moving a card from the retired bucket.
 *
 */
describe("update()", () => {
  it("should move card from bucket 0 to bucket 1 when answered easy", () => {
    const buckets: BucketMap = new Map<number, Set<Flashcard>>();
    const card = new Flashcard("front", "back", "hint", []);
    buckets.set(0, new Set([card]));

    const updatedBuckets = update(buckets, card, AnswerDifficulty.Easy);
    expect(updatedBuckets.get(1)?.has(card)).to.be.true;
    expect(updatedBuckets.get(0)?.has(card)).to.be.false;
  });

  it("should move card from bucket 1 to bucket 2 when answered easy", () => {
    const buckets: BucketMap = new Map<number, Set<Flashcard>>();
    const card = new Flashcard("front", "back", "hint", []);
    buckets.set(1, new Set([card]));

    const updatedBuckets = update(buckets, card, AnswerDifficulty.Easy);
    expect(updatedBuckets.get(2)?.has(card)).to.be.true;
    expect(updatedBuckets.get(1)?.has(card)).to.be.false;
  });

  it("should move card from bucket 1 to bucket 0 when answered hard", () => {
    const buckets: BucketMap = new Map<number, Set<Flashcard>>();
    const card = new Flashcard("front", "back", "hint", []);
    buckets.set(1, new Set([card]));

    const updatedBuckets = update(buckets, card, AnswerDifficulty.Hard);
    expect(updatedBuckets.get(0)?.has(card)).to.be.true;
    expect(updatedBuckets.get(1)?.has(card)).to.be.false;
  });

  it("should keep card in bucket 0 when answered wrong", () => {
    const buckets: BucketMap = new Map<number, Set<Flashcard>>();
    const card = new Flashcard("front", "back", "hint", []);
    buckets.set(0, new Set([card]));

    const updatedBuckets = update(buckets, card, AnswerDifficulty.Wrong);
    expect(updatedBuckets.get(0)?.has(card)).to.be.true;
  });

  it("should not move card from retired bucket", () => {
    const buckets: BucketMap = new Map<number, Set<Flashcard>>();
    const card = new Flashcard("front", "back", "hint", []);
    buckets.set(5, new Set([card])); // Retired bucket

    const updatedBuckets = update(buckets, card, AnswerDifficulty.Easy);
    expect(updatedBuckets.get(5)?.has(card)).to.be.true; // Should remain in retired bucket
  });

  it("should not change buckets if card is not present", () => {
    const buckets: BucketMap = new Map<number, Set<Flashcard>>();
    const card1 = new Flashcard("front1", "back1", "hint1", []);
    const card2 = new Flashcard("front2", "back2", "hint2", []);
    buckets.set(0, new Set([card1]));

    const updatedBuckets = update(buckets, card2, AnswerDifficulty.Easy);
    expect(updatedBuckets.get(0)?.has(card1)).to.be.true; // card1 should still be there
  });
});

/*
 * Testing strategy for getHint():
 *
 * Input Space Partitioning:
 * Valid Flashcards:
 *   × Flashcards with different types of content on the front and back.
 *   × Flashcards with hints that are empty or non-empty.
 * Invalid Flashcards:
 *   × Non-flashcard objects (to test how the function handles unexpected input).
 * Expected Outcomes:
 *   × The function should return a hint based on the content of the flashcard.
 */
describe("getHint()", () => {
  it("should return the hint for a valid flashcard", () => {
    const card = new Flashcard(
      "What is the capital of France?",
      "Paris",
      "Think of the Eiffel Tower.",
      []
    );
    const hint = getHint(card);
    expect(hint).to.equal("Think of the Eiffel Tower.");
  });

  it("should return a message if the hint is empty", () => {
    const card = new Flashcard(
      "What is the capital of Spain?",
      "Madrid",
      "",
      []
    );
    const hint = getHint(card);
    expect(hint).to.equal("No hint available.");
  });

  it("should handle flashcards with no tags", () => {
    const card = new Flashcard(
      "What is the largest ocean?",
      "Pacific Ocean",
      "It's named after a peaceful nature.",
      []
    );
    const hint = getHint(card);
    expect(hint).to.equal("It's named after a peaceful nature.");
  });

  it("should throw an error for invalid input (null)", () => {
    expect(() => getHint(null as any)).to.throw(Error, "Invalid flashcard.");
  });

  it("should throw an error for invalid input (non-flashcard object)", () => {
    expect(() => getHint({} as any)).to.throw(Error, "Invalid flashcard.");
    expect(() => getHint("not a flashcard" as any)).to.throw(
      Error,
      "Invalid flashcard."
    );
  });
});

/**
 *  Helper function to create test flashcards
 * @param front
 * @returns Flashcard
 */
export const createCard = (front: string): Flashcard => {
  return new Flashcard(front, "back", "hint", []);
};
