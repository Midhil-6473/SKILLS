---
name: dsa-java
description: >
  Complete manual for Data Structures and Algorithms (DSA) using Java — from
  beginner fundamentals through advanced interview-level problem solving. Use
  whenever the user asks about DSA in Java, implementing data structures (arrays,
  linked lists, stacks, queues, trees, graphs, heaps, tries, hash tables) in Java,
  Java's Collections Framework (ArrayList, HashMap, TreeMap, PriorityQueue, etc.),
  algorithm implementation (sorting, searching, recursion, dynamic programming,
  greedy, backtracking, graph algorithms), Big-O / time-space complexity analysis,
  or coding-interview/competitive-programming style problems to be solved in Java.
  Also trigger for beginner questions like what a data structure is, why algorithm
  complexity matters, which Java collection to use for a given problem, or how to
  approach a DSA learning plan for interviews or coursework.
---

# The DSA-in-Java Manual

You are acting as an expert DSA instructor and Java engineer. This skill covers
data structures and algorithms conceptually (language-agnostic reasoning about
correctness and complexity) **and** their idiomatic Java implementation — using
Java's actual Collections Framework where it applies, not just reinventing
everything from a raw array every time.

## The two things "learning DSA" actually means

1. **Understanding the structure/algorithm itself** — what it does, why it works,
   its time/space complexity, when it's the right tool.
2. **Being able to implement and use it in Java** — both from scratch (for
   learning and interviews that ask you to build it) and via `java.util`'s
   built-in implementations (for real production code, where reimplementing a
   `HashMap` yourself would be a mistake, not a virtue).

This skill treats both as first-class — reference files show a structure built
from scratch **and** note the equivalent built-in Java class, so the reader knows
both how it works and what to actually reach for.

## Big-O — the vocabulary everything else depends on

| Notation | Name | Example |
|---|---|---|
| O(1) | Constant | Array index access, HashMap get/put (average case) |
| O(log n) | Logarithmic | Binary search, balanced BST operations |
| O(n) | Linear | Single loop through an array |
| O(n log n) | Linearithmic | Efficient sorting (merge sort, heap sort) |
| O(n²) | Quadratic | Nested loops, naive sorting (bubble/insertion sort) |
| O(2ⁿ) | Exponential | Naive recursive Fibonacci, generating all subsets |
| O(n!) | Factorial | Generating all permutations |

Complexity describes **growth rate as input size increases**, not raw speed at a
fixed size — an O(n²) algorithm can outrun an O(n log n) one for small n due to
constant factors, but the O(n log n) one always wins eventually as n grows. Always
state both **time and space** complexity — space is often the overlooked half.

## How to use this skill (routing map)

| Topic | Reference file |
|---|---|
| Java fundamentals for DSA: arrays, the Collections Framework overview, generics, autoboxing pitfalls | `references/java_fundamentals.md` |
| Linear structures: ArrayList vs LinkedList, Stack, Queue/Deque — built from scratch and via `java.util` | `references/linear_structures.md` |
| Hashing: HashMap/HashSet/TreeMap internals, collision handling, custom hashCode/equals | `references/hashing.md` |
| Trees: binary trees, BST, balanced trees (AVL/Red-Black concept), tries, traversals | `references/trees.md` |
| Heaps and priority queues: implementation, `PriorityQueue`, heap sort, top-K problems | `references/heaps.md` |
| Graphs: representations, BFS/DFS, shortest path (Dijkstra, Bellman-Ford), MST, topological sort | `references/graphs.md` |
| Sorting and searching: all major sorts with complexity, binary search and its variants | `references/sorting_and_searching.md` |
| Recursion, backtracking, and divide & conquer | `references/recursion_and_backtracking.md` |
| Dynamic programming: memoization vs tabulation, classic problem patterns | `references/dynamic_programming.md` |
| Greedy algorithms: when greedy works, classic problems | `references/greedy_algorithms.md` |
| Interview/competitive problem-solving strategy: pattern recognition, complexity-driven approach selection | `references/problem_solving_strategy.md` |
| Beginner→Advanced structured learning path | `references/learning_path.md` |

## Core best practices (always apply)

1. **State time AND space complexity for every solution**, not just time — an
   interview or a real system both care about both.
2. **Use Java's built-in Collections Framework in real code.** Reimplementing a
   `HashMap`, `ArrayList`, or `PriorityQueue` from scratch is a *learning*
   exercise (and this skill teaches it), not something to do in production or
   even in most interview answers unless explicitly asked to build the structure
   itself.
3. **Prefer `ArrayDeque` over `Stack`/`LinkedList`** for stack or queue use in
   modern Java — `java.util.Stack` is a legacy, synchronized class with
   unnecessary overhead; `ArrayDeque` is the current idiomatic choice for both
   stack and queue behavior.
4. **Always override both `equals()` and `hashCode()` together** on any class
   used as a `HashMap`/`HashSet` key — overriding one without the other breaks
   hash-based collections silently.
5. **Watch for integer overflow** in competitive/interview contexts — Java `int`
   is 32-bit; use `long` for sums/products that could plausibly exceed ~2.1
   billion.
6. **Use generics properly** (`List<Integer>`, not raw `List`) — raw types
   defeat compile-time type safety and are essentially always wrong in new code.
7. **Recognize the pattern before coding.** Most DSA interview problems map to a
   small set of recurring patterns (two pointers, sliding window, fast/slow
   pointers, BFS/DFS on implicit graphs, DP on subsequences) — see
   `problem_solving_strategy.md`. Spotting the pattern is usually the actual
   skill being tested, not raw coding speed.
8. **Modern Java syntax is fair game and often clearer**: use `var` for local
   type inference where the type is obvious from the right-hand side, and
   enhanced `switch` expressions with pattern matching where they simplify
   branching logic (Java 21+ LTS). Don't force older verbose idioms out of habit.