# Beginner → Advanced Learning Path (DSA in Java)

Use this as a curriculum when the user wants a structured roadmap rather than a
point answer. Each phase names the reference file(s) to pull detail from, with a
practice focus that builds cumulatively.

## Phase 0 — Orientation (30 minutes)

- Understand Big-O notation and why growth rate (not raw speed at one input
  size) is what it measures. See `SKILL.md`.
- Set up a Java environment (JDK 21+ recommended — LTS, modern syntax available).
- Understand the two goals of this skill: conceptual understanding AND idiomatic
  Java implementation, both from-scratch and via `java.util`.

**Practice:** Write and run a trivial Java program; confirm your JDK version
supports records and pattern-matching switch (Java 16+/21+).

## Phase 1 — Java Fundamentals for DSA

*Read: `java_fundamentals.md`*

1. Arrays: creation, access, `Arrays` utility methods.
2. The Collections Framework hierarchy — memorize the shape, not every method.
3. Generics — always parameterize.
4. Autoboxing pitfalls — never `==` on boxed types.
5. Records for immutable data bundles (points, pairs, edges).

**Practice project:** Write a few small utility functions using `ArrayList`,
`HashMap`, and a `record` — get comfortable with the syntax before tackling
actual algorithms.

## Phase 2 — Linear Structures

*Read: `linear_structures.md`*

1. ArrayList vs. LinkedList trade-offs — know when each is actually justified.
2. Implement a singly linked list from scratch; implement reverse and cycle
   detection (fast/slow pointers).
3. Use `ArrayDeque` for both stack and queue behavior.
4. Solve "valid parentheses" using a stack.

**Practice project:** Implement a singly linked list from scratch with insert,
delete, reverse, and cycle detection — this is the foundational from-scratch
exercise most DSA courses start with for a reason.

## Phase 3 — Hashing

*Read: `hashing.md`*

1. Solve Two Sum using a HashMap — internalize the O(n²)→O(n) hashmap pattern.
2. Understand why `equals()`/`hashCode()` must be overridden together; use a
   record to get both for free.
3. Build a frequency-counting solution (e.g., valid anagram check).
4. Implement an LRU cache via `LinkedHashMap`.

**Practice project:** Implement an LRU cache two ways — once via
`LinkedHashMap` (idiomatic), once from scratch with a manual doubly-linked list
+ HashMap (the from-scratch interview version) — and compare.

## Phase 4 — Trees

*Read: `trees.md`*

1. Implement all three DFS traversals and level-order BFS.
2. Implement a BST with insert/search.
3. Internalize "inorder of BST is sorted."
4. Implement a trie; solve a prefix-matching problem with it.
5. Solve "validate BST" and "lowest common ancestor."

**Practice project:** Build a BST from scratch with insert, search, delete, and
an inorder traversal that confirms sorted output. Then build a trie and solve
an autocomplete-style problem.

## Phase 5 — Heaps

*Read: `heaps.md`*

1. Use `PriorityQueue` with custom comparators.
2. Solve a "K largest elements" problem using the min-heap-of-size-K trick.
3. Implement a heap from scratch (sift-up/sift-down) at least once, to
   understand the array-indexing mechanics.
4. Solve "merge K sorted lists."

**Practice project:** Build a running-median tracker using the two-heap
pattern — a genuinely elegant exercise that ties heaps, balance, and streaming
data together.

## Phase 6 — Graphs

*Read: `graphs.md`*

1. Implement BFS and DFS (both recursive and iterative) on an adjacency list.
2. Solve directed-graph cycle detection (the three-state approach).
3. Implement topological sort (Kahn's algorithm).
4. Implement Dijkstra's algorithm.
5. Implement Union-Find and Kruskal's MST.

**Practice project:** Model a small "course prerequisites" system — build the
graph, run topological sort, and detect if the prerequisites are satisfiable
(no cycle).

## Phase 7 — Sorting, Searching, and Recursion/Backtracking

*Read: `sorting_and_searching.md` + `recursion_and_backtracking.md`*

1. Implement merge sort and quick sort from scratch; compare their trade-offs.
2. Implement binary search plus the leftmost/rightmost-occurrence variants.
3. Try "binary search on the answer" on a problem that doesn't look like
   classic search at first glance.
4. Solve permutations and subsets via backtracking — watch for the
   "forgot to copy the list" bug specifically.
5. Solve N-Queens.

**Practice project:** Implement merge sort from scratch, then solve a "binary
search on the answer" problem (e.g., minimum capacity to ship packages within
D days) — this pairs a from-scratch classic with the more advanced generalized
pattern.

## Phase 8 — Dynamic Programming

*Read: `dynamic_programming.md`*

1. Work through the five-step systematic DP derivation process on 2-3
   different problems.
2. Implement climbing stairs, house robber, and Kadane's algorithm — notice the
   shared "depends on last 1-2 states" shape.
3. Implement LCS, 0/1 Knapsack, and Edit Distance — the classic 2D DP trio.
4. Practice space-optimizing at least one 2D solution down to O(n) or O(1).

**Practice project:** Solve 0/1 Knapsack, then explicitly space-optimize your
2D solution to 1D — this exercises the full top-down→tabulation→space-optimization
pipeline in one problem.

## Phase 9 — Greedy Algorithms

*Read: `greedy_algorithms.md`*

1. Solve activity selection; understand why sorting by end time (not start
   time) is required.
2. Solve Jump Game and Gas Station.
3. Work through the coin-change greedy-vs-DP example — confirm for yourself
   that greedy fails on `{1,3,4}`, amount 6, and DP succeeds.

**Practice project:** Solve coin change both ways (a broken greedy attempt,
then the correct DP solution) on paper — internalizing exactly why greedy fails
here is more valuable than solving ten more DP problems mechanically.

## Phase 10 — Problem-Solving Strategy and Interview Practice

*Read: `problem_solving_strategy.md`*

1. Practice the symptom→pattern lookup table on 10-15 problems from a
   practice site, without looking at solutions first — just identify the
   likely pattern.
2. Practice sliding window and two-pointers specifically, since they're common
   and not covered as their own structure/algorithm file.
3. Use the complexity-driven approach selection table to sanity-check your
   approach *before* coding, on a few problems.

**Practice project:** Pick 5 unfamiliar problems (from a coding practice
platform) spanning different symptom categories from the lookup table, and for
each: state the brute force, identify the pattern, then implement the improved
solution — this simulates the actual interview workflow end to end.

## How to use this with a real student/learner

If the person is clearly a student or self-learner (vs. preparing for an
imminent interview):
- Go phase by phase, always implementing the from-scratch version at least once
  per structure, even though real code should use `java.util` — the from-scratch
  exercise is where the actual understanding is built.
- Check understanding with a small variant problem before advancing — e.g.,
  "before moving to heaps, want to try modifying your BST to also support
  delete?"
- If the learner is specifically interview-prep-focused rather than
  coursework-focused, weight time toward Phase 10 (pattern recognition) sooner
  and more heavily — interviews test pattern recognition speed more than deep
  from-scratch implementation skill in most cases.
- Flag clearly when something is a "know the concept" item (AVL tree
  rotations, Bellman-Ford's full mechanics) vs. a "must be able to implement
  cold" item (BFS/DFS, binary search, basic DP) — not everything in this skill
  carries equal priority for a time-constrained learner.