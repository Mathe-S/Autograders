export const PROBLEM_DESCRIPTION = `Overview
Have you ever used flashcards – maybe to improve your vocabulary either in your native language or in a foreign language you want to learn? A flashcard has two sides, a front and a back, which might be a vocabulary word and its meaning, respectively. To use a flashcard for learning practice, you look at the front and try to recall what’s on the back, then look at the back to see if you were right. Flashcards are an example of active learning, which is much more effective than passive reading or listening.

 
 
A flashcard system is a scheduling algorithm that decides when to practice each flashcard for the most efficient learning using evidence-based techniques. One such technique is spaced repetition, the principle that we learn more durably when practice is spaced out over time rather than crammed together. In addition, the rate of forgetting something is slower the more we have practiced it, so the spacing between practice can increase as a concept or skill becomes more learned.

This problem set uses a spaced repetition flashcard algorithm that we will call the Modified-Leitner system, because it is inspired by the Leitner system but differs in the details. In a Leitner system, flashcards are grouped into numbered learning buckets. Low-numbered buckets contain flashcards that are less well-learned, so low-numbered buckets are scheduled for practice more often than high-numbered buckets. As a flashcard receives more and more successful practice, it moves up to higher buckets, until finally reaching a retired bucket (e.g., bucket 5). Flashcards in the retired bucket are considered well-enough learned not to need practice anymore.

Here is the specific behavior of our Modified-Leitner algorithm:

A new card, before its first practice, is assumed to be in bucket 0.
On day n of the learning process, the user collects all the buckets that are scheduled for practice that day, and practices every card found in those buckets.
Cards in the retired bucket are not scheduled for practice.
Bucket 0 cards are practiced every day, bucket 1 cards every two days, bucket 2 cards every four days, and so forth. In general, bucket i is practiced every 2i days.
The user is of course free to practice new cards, or unscheduled cards of their own choice, or to practice cards repeatedly.
Whenever the user practices a flashcard:
if they get the card wrong – they are unable to correctly recall what’s on the back of the card – then the card is put back in bucket 0.
if they find the card easy – getting it right without much mental effort – then the card moves up from bucket i to bucket i+1 (unless the card is already in the retired bucket).
if they find the card hard – getting it right but only with effort – then the card moves down to bucket i-1 (unless the card is already in bucket 0).
This problem set consists of a group of functions that can be used to implement the Modified-Leitner flashcard system:

toBucketSets() converts a Map representation of learning buckets into a Array-of-Set representation
getBucketRange() finds the range of buckets that contain flashcards, as a rough measure of progress
practice() selects cards to practice on a particular day
update() updates a card’s bucket number after a practice trial
getHint() generates a hint for a flashcard
computeProgress() computes statistics about the user’s learning progress
In addition to implementing these functions yourself, you will also write a test suite for each function, carefully following the function’s spec. Your test suites will be graded in part by running them against various staff implementations of the function, some of which obey the spec and some which don’t. A good test suite should pass the good implementations and reject the bad ones.

You are asked to change exactly one of the given function specs, getHint(). Its current spec is weak, so you will strengthen the spec, and test and implement your stronger spec. Unlike your test suites for other functions, your getHint() tests won’t be run against good and bad staff implementations, because you’ll be changing the spec.

Finally, you are asked to design a specification for the last function, computeProgress(), and test and implement your own spec. Your computeProgress() tests won’t be run against staff implementations, and no staff tests will be run against your implementation either, because we don’t know what your spec will be. But, your own tests will be run against your own implementation, and your work on this function will be manually graded.

Steps
Since we are doing iterative test-first programming, your workflow for each function should follow the order specs → tests → implementation, iterating as needed. Make steady progress across functions and down the workflow, in the following pattern:

Read this entire handout first.
Read the specs for all functions carefully.
For toBucketSets() and getBucketRange():
Write tests for one function. Add/commit/push.
Write tests for the other function. Add/commit/push.
Implement one function. Add/commit/push.
Implement the other function. Add/commit/push.
For practice() and update():
Write tests for one function. Add/commit/push.
Write tests for the other function. Add/commit/push.
Implement one function. Add/commit/push.
Implement the other function. Add/commit/push.
For getHint():
Write tests for the staff-provided weak spec. Add/commit/push.
Code a trivial implementation of the weak spec, to exercise your tests. Add/commit/push.
Strengthen the spec, following instructions later in this handout. Add/commit/push.
Add tests for the revised spec. Add/commit/push.
Implement the revised spec. Add/commit/push.
For computeProgress():
Write a spec for the function. Add/commit/push.
Write tests for your spec. Add/commit/push.
Implement your spec. Add/commit/push.
 
toBucketSets
getBucketRange
practice
update
getHint
 ...strengthen...
computeProgress
spec	1	1	1	1	1	4c	5a
test	2a	2b	3a	3b	4a	4d	5b
implement	2c	2d	3c	3d	4b	4e	5c
The next few sections of this handout have more specific advice about these steps:

Specifications
Testing
Implementation
Strengthening getHint()
Designing computeProgress()
Use git add/git commit/git push after every step that changes your code. Committing frequently – whenever you’ve written some tests, fixed a bug, or added a new feature – is a good way to use version control, and will be a good habit to have for your team projects and as a software engineer in general, so start forming the habit now. Your git commit history for this problem set should:

demonstrate test-first programming;
have frequent small commits;
include short but descriptive commit messages.
What you can and can’t change
In order for your overall program to meet the specification of this problem set, you are required to keep some things unchanged:

Don’t change this file at all: the file flashcards.ts should not be modified at all.
Don’t change these filenames: the files algorithm.ts and algorithmTest.ts must use those names and remain in the folders where they are.
Don’t change the function signatures and specifications: the exported functions toBucketSets(), getBucketRange(), practice(), and update() must use the function signatures and the specifications that we provided.
Don’t export anything new: from algorithm.ts, only toBucketSets(), getBucketRange(), practice(), update(), getHint(), and computeProgress() may be exported.
Don’t change the function signature or weaken the specification: the function getHint() must have a stronger spec than we provided.
Don’t include illegal test cases: the tests you implement in algorithmTest.ts must respect the specifications for the functions you are testing.
Aside from these requirements, however, you are free to add new functions and new classes if you wish.

Specifications
Before you start, read the specs carefully, and take notes about what you observe. You can either read the TypeScript source files directly in VS Code, or read the TypeDoc documentation for all classes generated from the source files.

Keep in mind these facts about specifications:

Some specs have preconditions. Recall from the specs reading that when preconditions are violated by the client, the behavior of the function is completely unspecified.

Some specs have underdetermined postconditions. Recall that underdetermined postconditions allow a range of behavior. When you’re implementing such a function, the exact behavior of your function within that range is up to you to decide. When you’re writing a test case for the function, the test must allow for the full range of variation in the behavior of the implementation, because otherwise your test case is not a legal client of the spec as required above.

Exported functions can be used anywhere. These functions are independent modules, which might be called by various parts of a flashcard system, not necessarily just the Modified-Leitner algorithm. A function implementation must be able to handle all inputs that satisfy the precondition, even if they don’t arise in the Modified-Leitner algorithm. And it may return any output that satisfies its postcondition, even if that doesn’t seem useful in the Modified-Leitner algorithm.

Testing
You should partition each function’s inputs and outputs, write down your partitions in a testing strategy comment, and choose test cases to cover the partitions.

The function specs and implementations are in the file src/algorithm.ts, and the corresponding Mocha tests are in test/algorithmTest.ts. Separating implementation code from test code is a common practice in development projects. It makes the implementation code easier to understand, uncluttered by tests, and easier to package up for release.

The test suite for a function may already have example tests in it, which are provided as models. You are recommended to read and then throw away those example tests and write your own.

Some advice about testing:

Your test cases should be chosen using partitioning. This approach is explained in the reading about testing.

Include a comment at the top of each test suite describing your testing strategy. Examples are shown in the reading about testing.

Your test cases should be small and well-chosen. Don’t use a large set of data for each test. Instead, create inputs carefully chosen to test the partition you’re trying to test.

Your tests should find bugs. We will grade your test cases in part by running them against buggy implementations and seeing if your tests catch the bugs. So consider ways an implementation might inadvertently fail to meet the spec, and choose tests that will expose those bugs.

Your tests must be legal clients of the spec. We will also run your test cases against legal, variant implementations that still strictly satisfy the specs, and your test cases should not complain for these good implementations. That means that your test cases can’t make extra assumptions that are only true for your own implementation.

Put each test case in its own it() function. This will be far more useful than a single large test function, since it pinpoints the problems in the implementation.

Run testing coverage. When it’s time to do glass box testing, run your test suites with npm run coverage.

Be careful calling helper functions from testing code. Your test cases in algorithmTest.ts must not call a new helper function that you have defined in algorithm.ts. Remember that your tests will be run against staff implementations of algorithm.ts, and code in your version of that file will not be available. Put helper functions needed by your testing code into test/, and put helper functions needed by both implementation and test code into src/utils.ts (discussed below).

Again, keep your tests small. Don’t use unreasonable amounts of resources (such as arrays or strings of length MAX_SAFE_INTEGER). We won’t expect your test suite to catch bugs related to running out of resources; every program fails when it runs out of resources.

Use strictEqual and deepStrictEqual. For example. assert.equal(1, '1') passes because it uses the dangerous == comparison. Don’t use it, always use strictEqual for immutable built-in types.

However, assert.strictEqual([1], [1]) fails because it checks that the two arguments refer to the same array instance. To compare data structures, use deepStrictEqual as shown in the provided example tests.

Add/commit/push frequently. Whenever you do a nontrivial amount of work – e.g. after writing a testing strategy comment; after choosing some test inputs; after writing Mocha tests and seeing that they pass – you should add/commit/push your work with git.

Implementation
Implement each function, and revise your implementation and your tests until all your tests pass.

Some advice about implementation:

Small helper functions. If you want to write small helper functions for your implementation, then you can put them in the algorithm.ts file, alongside the other functions. Don’t export helper functions in algorithm.ts, because that changes the spec of the algorithm module in a way that you are not allowed to do. This means you cannot write tests for these helper functions, which is why they must be small. You are relying on your test suite for the public functions of algorithm to achieve coverage and find bugs in these small helper functions.

Larger helper functions. If you want to write helper functions of any complexity, then you should put them in the utils.ts file, and write Mocha tests for them in utilsTest.ts. This is also the place to put helper functions that are needed by both implementation code and test code. In utils.ts, if you export a function called myHelper, then in algorithm.ts and utilsTest.ts you can call the function as utils.myHelper(..).

Do not ask us to tell you whether a helper function is small or large. If you are not sure, then the function is large enough that it should have TypeDoc documentation and its own tests. Put the helper function in utils.ts, give it a clear spec, and test it in utilsTest.ts.

Don’t call testing code. Don’t put a helper function in the test/ folder if you need to call it from implementation code in src/. Testing code should be completely detachable from the implementation, so that the implementation can be packaged up separately for deployment. We also detach your testing code when we run staff tests against your implementation. Put helper functions needed by implementation code, or by both test and implementation code, into src/utils.ts.

Eliminate warnings. Revise your code to address all the yellow-underlined warnings shown in VS Code. These warnings should include both TypeScript compiler warnings and ESLint warnings, because ESLint is enabled for this problem set.

Check testing coverage. Do glass box testing and revise your tests until you have satisfactory code coverage.

Review your own code. Read your code critically with an eye to making it as SFB, ETU, and RFC as possible.

Test frequently. Rerun your tests whenever you make a change to your code.

Use Mocha’s -f argument to debug a single test. To run a subset of test cases from your whole test suite, use npm test -- -f 'pattern'. Only tests whose it() description contains the string pattern will be run. For example, for the starting test suite, the command npm test -- -f 'different buckets' runs only the test whose description is 'covers two cards in different buckets'. This is useful for debugging, because it allows you to focus on just one failing test at a time.

Use console.log or util.inspect for print debugging. Many types, including Map and Set, have very unhelpful toString() methods. This means if you try to debug using, say, console.log("buckets are " + bucketMap), you will likely see something unhelpful like “buckets are [object Map]”. There are two ways to make this better:

Use multiple arguments to console.log() instead of relying on + and toString():

console.log("buckets are", bucketMap);
This means that console.log() takes responsibility for displaying the bucketMap object, and it does a much better job of showing you what’s inside it.

Use util.inspect() to turn the object into a string:

import util from 'util';
console.log("buckets are " + util.inspect(bucketMap));
Add/commit/push frequently. Whenever you do a nontrivial amount of work – e.g. after writing a function body and seeing that the tests pass, or after finding a bug, adding a regression test for it, and fixing it – you should add/commit/push your work with git.

After you’ve implemented all the functions, you can use npm start to run main.ts, which uses the functions in a simulated flashcard application. The main.ts file is not part of the spec of this problem set, is not used for grading, and you are free to edit it as you wish.

Strengthening getHint()
Almost all the specs in this problem set should be used exactly as-is, with one exception. The getHint() function currently has a rather weak spec. You should at first use this weak spec to write some tests and a simple implementation. Make sure your tests respect the weak spec, and that your implementation passes your tests. Add/commit/push.

Then revise the spec of getHint() by editing its TypeDoc comment in algorithm.ts. Your new spec should be:

stronger than the original spec
deterministic
helpful, in the sense of helping a user in realistic learning situations
extending to a new learning domain, unrelated to language learning
Keep in mind that you are strengthening the spec, so getHint() can still be called in all the situations it could be used in the original weak spec.

This is a design problem, and you will need to think broadly and carefully. In the criteria given for your spec above, “stronger” and “deterministic” should be clear from the readings, but “helpful” is likely to involve tradeoffs and design decisions. There is no single right answer, but there are better and worse decisions.

After you change your spec for getHint(), revise your test suite in algorithmTest.ts and your implementation in algorithm.ts so that the implementation satisfies your stronger spec and passes your updated tests.

Some advice about this problem:

Work iteratively. Bite off the requirements one bit at a time. First handle the language-vocabulary domain – update the spec, write tests, then implement. Then for your new learning domain: spec, test, implement.

Keep your original tests if possible. Each time you change the spec, revise your test suite to test your new spec by updating the testing strategy and test cases in algorithmTest.ts. Keep the strategy and tests you wrote for the original weak staff-provided spec, so that your test suite is checking your implementation for compliance with the original weak spec as well as your stronger spec.

Revise specs and tests as needed. If you find while you are testing or implementing that you need to revise your spec, do so.

Add/commit/push frequently. If you commit after every step of this process (spec, commit, test, commit, implement, commit, etc.), then Git will keep track of your old versions of spec, tests, and code, so that you can refer back to them or even recover them if you have to. You don’t have to preserve your implementation of the original staff-provided weak spec in your final code, because your Git history should have it.

Designing computeProgress()
The computeProgress() function has no spec at all, so you need to write one, and then test and implement it.

The purpose of computeProgress() is to provide statistical information about the user’s learning progress.

Examples of statistics include counts, averages, medians, minimums, and maximums, as well as non-numeric values that minimize or maximize some statistic.

Inputs to the function should include, but are not limited to:

a representation of the current state of the flashcard buckets
a representation of the history of the user’s answers to flashcards (including types like Flashcard, AnswerDifficulty, and Date).
The output should:

include at least two different kinds of statistics that help the user understand their progress in learning the flashcards;
include statistics that are parameterized on the input in some way (e.g. by flashcard, by unit of time, by answer difficulty, by bucket), such that changing the inputs should be able to change the number of values in the output.
Your spec should be safe from bugs, easy to understand, and ready for change. In particular, use static typing as much as possible.

Your spec must have a nontrivial and relevant precondition that cannot be statically checked. For example, for sqrt(x), the precondition x ≥ 0 is both nontrivial and relevant, whereas x !== NaN is trivial (if that’s the entire precondition), and x is even is not relevant.

Your implementation must check the precondition and fail fast if the precondition is not satisfied.`;

export const FUNCTIONS_TO_CHECK = [
  "toBucketSets",
  "getBucketRange",
  "practice",
  "update",
  "getHint",
];
