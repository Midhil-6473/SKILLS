# Interview / Competitive Problem-Solving Strategy

## The actual skill being tested

Coding interviews and competitive problems rarely test "can you write syntactically
correct Java" — they test **pattern recognition**: can you map an unfamiliar-looking
problem onto one of a fairly small number of recurring techniques? This file is a
routing guide from problem *symptoms* to likely *technique*.

## The general approach (apply to any problem)

1. **Restate the problem in your own words** — confirms you understood it, and
   often surfaces an edge case immediately.
2. **Work a small example by hand** — before writing any code.
3. **State the brute-force solution and its complexity first** — even if it's
   O(n²) or worse, this is a genuine checkpoint, not a waste of time; it also
   often reveals the "obvious" duplicate work that a better technique eliminates.
4. **Identify the pattern** (see the table below) — what does the brute force's
   inefficiency suggest?
5. **Code the improved solution.**
6. **Test against edge cases explicitly**: empty input, single element, all
   duplicates, already-sorted, reverse-sorted, negative numbers, integer
   overflow-prone inputs.
7. **State final time and space complexity.**

## Symptom → pattern lookup table

| If the problem involves... | Likely technique | Reference file |
|---|---|---|
| A sorted array, "find a pair/target" | Two pointers, or binary search | `sorting_and_searching.md` |
| "Contiguous subarray/substring" with a size or sum constraint | Sliding window | (pattern below) |
| Linked list, "find middle/cycle/Nth from end" | Fast & slow pointers | `linear_structures.md` |
| "Have I seen this before?" / counting occurrences | HashMap/HashSet | `hashing.md` |
| Matching/nesting (parentheses, tags) | Stack | `linear_structures.md` |
| "Process level by level" / shortest path, unweighted | BFS | `graphs.md` |
| Tree/graph exploration, "does a path exist" | DFS (recursive or explicit stack) | `graphs.md`, `trees.md` |
| "Kth largest/smallest", "top K" | Heap (`PriorityQueue`) | `heaps.md` |
| Weighted shortest path | Dijkstra (non-negative) / Bellman-Ford (negative allowed) | `graphs.md` |
| "Minimum cost to connect everything" | MST (Kruskal's + Union-Find) | `graphs.md` |
| "How many ways to..." / "minimum/maximum achievable..." with overlapping subproblems | Dynamic Programming | `dynamic_programming.md` |
| "Minimum/maximum achievable..." where a locally-best choice seems globally safe | Greedy (verify carefully) | `greedy_algorithms.md` |
| Generate all permutations/combinations/subsets | Backtracking | `recursion_and_backtracking.md` |
| "Minimum X such that condition holds" over a monotonic range | Binary search on the answer | `sorting_and_searching.md` |
| Prefix matching / autocomplete | Trie | `trees.md` |
| Dependency ordering ("must happen before") | Topological sort | `graphs.md` |
| Merging/combining, sorted structure | Divide and conquer, or a heap | `sorting_and_searching.md`, `heaps.md` |

## Sliding window — a pattern not yet covered elsewhere, worth its own callout

```java
// Longest substring without repeating characters — the canonical sliding window problem
int lengthOfLongestSubstring(String s) {
    Set<Character> window = new HashSet<>();
    int left = 0, maxLength = 0;
    for (int right = 0; right < s.length(); right++) {
        while (window.contains(s.charAt(right))) {
            window.remove(s.charAt(left));
            left++;                                    // shrink from the left until valid again
        }
        window.add(s.charAt(right));
        maxLength = Math.max(maxLength, right - left + 1);
    }
    return maxLength;
}
```

**The sliding window shape**: two pointers (`left`, `right`) defining a
contiguous window; `right` expands the window, and `left` shrinks it when some
constraint is violated. This converts an O(n²) or O(n³) brute-force "check
every substring" approach into O(n), since each pointer only moves forward,
never backward — every element is visited a bounded number of times total.

**Recognize sliding window when**: the problem asks about a contiguous
subarray/substring, and there's a size constraint, sum constraint, or
"no repeats"-style constraint defining validity.

## Two pointers — related to, but distinct from, sliding window

```java
// Two Sum on a SORTED array — two pointers from both ends, converging inward
int[] twoSumSorted(int[] nums, int target) {
    int left = 0, right = nums.length - 1;
    while (left < right) {
        int sum = nums[left] + nums[right];
        if (sum == target) return new int[]{left, right};
        else if (sum < target) left++;    // need a bigger sum — move left pointer up
        else right--;                       // need a smaller sum — move right pointer down
    }
    return new int[]{-1, -1};
}
```

Two pointers (converging from both ends) vs. sliding window (both moving in the
same direction, defining a shrinking/expanding range) are related but distinct
— worth keeping the distinction clear since they solve different problem shapes.

## When you're stuck — a concrete checklist

1. **Can I sort the input first?** Sorting is O(n log n) and unlocks binary
   search, two pointers, and many greedy approaches — a very common first move.
2. **Would a hash map eliminate a nested loop?** If you're checking "does X
   exist in the rest of the array" inside a loop, that's almost always an O(n²)
   → O(n) hashmap opportunity.
3. **Does the brute force recompute the same subproblem repeatedly?** →
   memoization/DP.
4. **Is there a monotonic relationship I can binary search over**, even if the
   problem doesn't look like classic search?
5. **Can I solve a smaller version of this problem and combine results?** →
   recursion / divide and conquer.
6. **Am I trying to track "the current best/smallest/largest remaining"
   repeatedly?** → heap.

## Complexity-driven approach selection

Before coding, estimate what complexity the input size *demands*, and let that
guide technique choice:

| Input size (n) | Required complexity | Rules out |
|---|---|---|
| n ≤ ~20 | O(2ⁿ) or O(n!) acceptable | — |
| n ≤ ~500 | O(n³) acceptable | — |
| n ≤ ~5,000 | O(n²) acceptable | O(n³)+ |
| n ≤ ~10⁶ | O(n log n) needed | O(n²)+ |
| n ≤ ~10⁸ | O(n) needed | O(n log n)+ often too slow |
| n > 10⁸ | O(log n) or O(1) needed | almost everything else |

This table is a fast sanity check: if a problem gives n up to 10⁶ and your
solution is O(n²), you already know it won't pass before even running it — go
back and find the better technique rather than debugging a fundamentally
too-slow approach.

## Practical guidance

1. **Always state the brute force and its complexity first** — it's not wasted
   effort, it's the fastest route to spotting the applicable pattern.
2. **Use the symptom→pattern table as a first triage step** on any unfamiliar
   problem — most problems, even novel-looking ones, map onto one of these.
3. **Let the input size constraint tell you the required complexity** before
   you commit to an approach.
4. **Test edge cases explicitly** — empty, single-element, all-duplicate,
   already-sorted/reverse-sorted, and overflow-prone inputs catch the majority
   of real bugs.