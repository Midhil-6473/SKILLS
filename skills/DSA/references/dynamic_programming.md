# Dynamic Programming

## What makes a problem a DP problem

Two properties, both required:
1. **Overlapping subproblems** — a naive recursive solution recomputes the same
   subproblem many times (see the naive Fibonacci example in
   `recursion_and_backtracking.md`, which recomputes exponentially many
   duplicate calls).
2. **Optimal substructure** — the optimal solution to the problem can be
   constructed from optimal solutions to its subproblems.

If both hold, DP converts an exponential brute-force solution into a polynomial
one by **computing each distinct subproblem exactly once** and reusing the
result.

## Two implementation styles: top-down vs. bottom-up

### Top-down (memoization) — start from recursion, add a cache

```java
Map<Integer, Long> memo = new HashMap<>();
long fib(int n) {
    if (n <= 1) return n;
    if (memo.containsKey(n)) return memo.get(n);
    long result = fib(n - 1) + fib(n - 2);
    memo.put(n, result);
    return result;
}
```

### Bottom-up (tabulation) — build up from base cases iteratively

```java
long fibTabulated(int n) {
    if (n <= 1) return n;
    long[] dp = new long[n + 1];
    dp[0] = 0;
    dp[1] = 1;
    for (int i = 2; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];
    }
    return dp[n];
}

// Space-optimized — most 1D DP problems only need the last k states, not the whole array
long fibOptimized(int n) {
    if (n <= 1) return n;
    long prev2 = 0, prev1 = 1;
    for (int i = 2; i <= n; i++) {
        long current = prev1 + prev2;
        prev2 = prev1;
        prev1 = current;
    }
    return prev1;
}
```

**Practical guidance on which style to use:** top-down is usually easier to
*derive* — start from a correct recursive brute-force solution, add a cache, and
it becomes efficient. Bottom-up is usually more efficient in practice (no
recursive call overhead, easier to further optimize space) and avoids any
stack-overflow risk. A common workflow: write the recursive solution first to
verify correctness, then convert to memoized, then to tabulated, then optimize
space — each step is typically a small, mechanical transformation from the last.

## Classic 1D DP patterns

```java
// Climbing Stairs — how many ways to reach step n, taking 1 or 2 steps at a time
int climbStairs(int n) {
    if (n <= 2) return n;
    int[] dp = new int[n + 1];
    dp[1] = 1; dp[2] = 2;
    for (int i = 3; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];   // same recurrence shape as Fibonacci!
    return dp[n];
}

// House Robber — maximum sum of non-adjacent elements
int rob(int[] nums) {
    int prev2 = 0, prev1 = 0;
    for (int num : nums) {
        int current = Math.max(prev1, prev2 + num);   // skip this house, or rob it + best from 2 back
        prev2 = prev1;
        prev1 = current;
    }
    return prev1;
}

// Kadane's Algorithm — maximum subarray sum, O(n), a DP problem in disguise
int maxSubArray(int[] nums) {
    int maxEndingHere = nums[0], maxSoFar = nums[0];
    for (int i = 1; i < nums.length; i++) {
        maxEndingHere = Math.max(nums[i], maxEndingHere + nums[i]);   // extend, or start fresh here
        maxSoFar = Math.max(maxSoFar, maxEndingHere);
    }
    return maxSoFar;
}
```

**Recognizing the recurring "current depends on the last 1-2 states" shape**
(Fibonacci, climbing stairs, house robber) is a genuinely high-value pattern —
many seemingly distinct problems reduce to the same underlying recurrence.

## Classic 2D DP patterns

```java
// Longest Common Subsequence — the canonical 2D DP problem
int longestCommonSubsequence(String text1, String text2) {
    int m = text1.length(), n = text2.length();
    int[][] dp = new int[m + 1][n + 1];   // dp[i][j] = LCS length of text1[0..i) and text2[0..j)

    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (text1.charAt(i - 1) == text2.charAt(j - 1)) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    return dp[m][n];
}

// 0/1 Knapsack — the canonical constrained-optimization DP problem
int knapsack(int[] weights, int[] values, int capacity) {
    int n = weights.length;
    int[][] dp = new int[n + 1][capacity + 1];   // dp[i][w] = max value using first i items, capacity w

    for (int i = 1; i <= n; i++) {
        for (int w = 0; w <= capacity; w++) {
            dp[i][w] = dp[i - 1][w];   // don't take item i-1
            if (weights[i - 1] <= w) {
                dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - weights[i - 1]] + values[i - 1]);   // take it
            }
        }
    }
    return dp[n][capacity];
}

// Edit Distance — minimum operations to transform one string into another
int minDistance(String word1, String word2) {
    int m = word1.length(), n = word2.length();
    int[][] dp = new int[m + 1][n + 1];

    for (int i = 0; i <= m; i++) dp[i][0] = i;   // base case: delete all of word1
    for (int j = 0; j <= n; j++) dp[0][j] = j;   // base case: insert all of word2

    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (word1.charAt(i - 1) == word2.charAt(j - 1)) {
                dp[i][j] = dp[i - 1][j - 1];   // characters match — no operation needed
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j - 1],      // replace
                                Math.min(dp[i - 1][j],          // delete
                                         dp[i][j - 1]));         // insert
            }
        }
    }
    return dp[m][n];
}
```

## The systematic approach to deriving any DP solution

1. **Define the state** — what does `dp[i]` (or `dp[i][j]`) actually represent?
   Be precise; most DP bugs trace back to an ambiguous state definition.
2. **Find the recurrence** — how does `dp[i]` relate to smaller/previous states?
3. **Identify base cases** — the smallest subproblems, solved directly.
4. **Determine iteration order** — must ensure every state you depend on is
   already computed before you need it (usually: smaller indices/subproblems
   first).
5. **Consider space optimization** — if `dp[i]` only depends on the last k
   rows/states, you rarely need the full table (see the Fibonacci
   space-optimization example above).

This systematic five-step process is the actual transferable skill — far more
valuable than memorizing individual problems, since novel DP problems are common
in interviews specifically to test whether you can derive a recurrence rather
than recall one.

## Practical guidance

1. **Check for both overlapping subproblems AND optimal substructure** before
   reaching for DP — if either is missing, DP isn't the right tool.
2. **Write the brute-force recursive solution first** if the recurrence isn't
   immediately obvious — memoize it, then convert to tabulation.
3. **Precisely define what `dp[i]` means before writing any code** — this is
   the step most novel DP problems are actually testing.
4. **Always consider space optimization** once a working tabulated solution
   exists — many 2D DP problems reduce to O(n) space with a rolling array, and
   many 1D DP problems reduce to O(1).
5. **Recognize recurring recurrence shapes** (Fibonacci-like, LCS-like,
   knapsack-like) across superficially different problems.