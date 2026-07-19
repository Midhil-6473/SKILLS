# Recursion, Backtracking, and Divide & Conquer

## The anatomy of a correct recursive function

Every correct recursive solution needs two things:
1. **Base case(s)** — the condition(s) where the function returns directly,
   without recursing further, terminating the recursion.
2. **Recursive case** — the function calls itself on a "smaller" version of the
   problem, and combines that result to solve the current problem.

```java
// Factorial — the canonical minimal example
long factorial(int n) {
    if (n <= 1) return 1;              // base case
    return n * factorial(n - 1);       // recursive case — smaller subproblem
}
```

**Missing or incorrect base case is the #1 cause of `StackOverflowError`** —
always identify and write the base case first, before the recursive logic.

## The call stack — what's actually happening

```java
// Each recursive call adds a "stack frame" holding that call's local variables
// factorial(4) calls factorial(3) calls factorial(2) calls factorial(1) [base case, returns]
//   factorial(2) returns 2*1=2
//   factorial(3) returns 3*2=6
//   factorial(4) returns 4*6=24
```

Java's default call stack size is finite (a few thousand frames typically) —
**deep recursion (roughly beyond ~10,000 frames, depending on JVM settings) risks
`StackOverflowError`**. For problems where recursion depth could scale with a
large input (e.g., a linked list of 100,000 nodes processed recursively), prefer
an iterative approach with an explicit stack, or verify the JVM stack size is
sufficient.

## Memoization — caching recursive results

```java
// Naive recursive Fibonacci — O(2^n), catastrophically slow beyond n≈40
long fibNaive(int n) {
    if (n <= 1) return n;
    return fibNaive(n - 1) + fibNaive(n - 2);   // recomputes the same subproblems repeatedly
}

// Memoized — O(n), by caching each subproblem's result
Map<Integer, Long> memo = new HashMap<>();
long fibMemo(int n) {
    if (n <= 1) return n;
    if (memo.containsKey(n)) return memo.get(n);
    long result = fibMemo(n - 1) + fibMemo(n - 2);
    memo.put(n, result);
    return result;
}
```

This is the bridge concept into dynamic programming (see
`dynamic_programming.md`) — memoization is "recursion plus a cache," and it's
often the most natural way to *discover* a DP solution before converting it to
an iterative tabulated form.

## Backtracking — recursion that explores and undoes choices

Backtracking systematically explores all possible solutions by making a choice,
recursing, and then **undoing that choice** ("backtracking") to try the next
option — the standard technique for combinatorial problems: permutations,
combinations, subsets, and constraint-satisfaction puzzles.

```java
// Generate all permutations of an array — the canonical backtracking example
List<List<Integer>> permute(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    backtrack(nums, new ArrayList<>(), new boolean[nums.length], result);
    return result;
}

private void backtrack(int[] nums, List<Integer> current, boolean[] used, List<List<Integer>> result) {
    if (current.size() == nums.length) {
        result.add(new ArrayList<>(current));   // IMPORTANT: copy — `current` will keep mutating
        return;
    }
    for (int i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        current.add(nums[i]);
        backtrack(nums, current, used, result);   // explore with this choice made
        current.remove(current.size() - 1);          // UNDO the choice — this is "backtracking"
        used[i] = false;                                // UNDO the marking too
    }
}
```

**The `new ArrayList<>(current)` copy is not optional** — without it, every
entry in `result` would be a reference to the *same* mutating `current` list,
and by the time the outer function returns, all entries would incorrectly show
the final, fully-unwound state. This exact bug (forgetting to copy before adding
to the result) is one of the most common backtracking mistakes.

```java
// Subsets (the power set) — a slightly different backtracking shape
List<List<Integer>> subsets(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    backtrackSubsets(nums, 0, new ArrayList<>(), result);
    return result;
}

private void backtrackSubsets(int[] nums, int start, List<Integer> current, List<List<Integer>> result) {
    result.add(new ArrayList<>(current));   // every state along the way is a valid subset
    for (int i = start; i < nums.length; i++) {
        current.add(nums[i]);
        backtrackSubsets(nums, i + 1, current, result);   // start from i+1 — no reuse, no earlier revisits
        current.remove(current.size() - 1);
    }
}
```

### N-Queens — the classic constraint-satisfaction backtracking problem

```java
int totalNQueens(int n) {
    return solve(new int[n], 0, n);   // queens[row] = column of the queen in that row
}

private int solve(int[] queens, int row, int n) {
    if (row == n) return 1;   // all n queens placed validly — one solution found
    int count = 0;
    for (int col = 0; col < n; col++) {
        if (isValid(queens, row, col)) {
            queens[row] = col;
            count += solve(queens, row + 1, n);   // recurse to the next row
        }
    }
    return count;
}

private boolean isValid(int[] queens, int row, int col) {
    for (int r = 0; r < row; r++) {
        int c = queens[r];
        if (c == col || Math.abs(c - col) == Math.abs(r - row)) return false;   // same column or diagonal
    }
    return true;
}
```

Note there's no explicit "undo" step here — using a primitive array
(`queens[row] = col`) that just gets overwritten on the next iteration serves
the same purpose as explicit add/remove on a list; backtracking doesn't always
require a literal "remove" call, just returning the shared mutable state to a
valid condition for the next attempt.

## Divide and Conquer — a related but distinct pattern

Divide and conquer splits a problem into independent subproblems, solves each
recursively, and **combines** their results — merge sort and quick sort (see
`sorting_and_searching.md`) are the canonical examples. The distinction from
plain recursion: there's a genuine **combine** step merging separate subproblem
results, not just a single recursive call chain.

```java
// Maximum subarray sum via divide and conquer (Kadane's algorithm — see dynamic_programming.md
// — is actually the simpler, more standard solution to this specific problem, but D&C illustrates the pattern)
int maxSubarrayDC(int[] nums, int left, int right) {
    if (left == right) return nums[left];
    int mid = left + (right - left) / 2;
    int leftMax = maxSubarrayDC(nums, left, mid);
    int rightMax = maxSubarrayDC(nums, mid + 1, right);
    int crossMax = maxCrossingSum(nums, left, mid, right);
    return Math.max(Math.max(leftMax, rightMax), crossMax);
}
```

## Recursion vs. iteration — when to prefer which

| Favor recursion when | Favor iteration when |
|---|---|
| The problem has a naturally recursive structure (trees, backtracking, divide & conquer) | Simple linear processing (a single pass over an array) |
| Code clarity matters more than the last bit of performance | Recursion depth could be large enough to risk stack overflow |
| | Performance is genuinely critical (function call overhead, though the JIT often optimizes simple recursion well) |

Java does **not** guarantee tail-call optimization (unlike some functional
languages) — a "tail recursive" function in Java still consumes a stack frame
per call, so rewriting to "tail form" doesn't avoid stack overflow risk the way
it would in, say, Scheme or Scala with guaranteed TCO.

## Practical guidance

1. **Always identify the base case before writing the recursive case.**
2. **Always copy a mutable collection before adding it to a results list** in
   backtracking — this is the single most common backtracking bug.
3. **Recognize memoization as the bridge into dynamic programming** — if you can
   write a correct-but-slow recursive solution, you're most of the way to a
   memoized (and then tabulated) DP solution.
4. **Watch recursion depth for large inputs** — Java doesn't guarantee tail-call
   optimization, so deep recursion has a real stack-overflow ceiling regardless
   of how the recursive call is structured.
5. **Distinguish plain recursion from divide-and-conquer** by whether there's a
   genuine combine step merging independent subproblem results.