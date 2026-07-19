# Greedy Algorithms

## What "greedy" means

A greedy algorithm builds a solution step by step, at each step making the
choice that looks best **right now**, without reconsidering earlier choices —
and never backtracking. Greedy is much simpler and faster than DP when it
applies, but **it only produces a correct (optimal) answer for problems with a
specific structural property** — using greedy where it doesn't apply produces a
plausible-looking but wrong answer, which is the main risk with this technique.

## When greedy actually works — the two required properties

1. **Greedy choice property** — a globally optimal solution can be reached by
   making a locally optimal choice at each step, without needing to reconsider
   past choices.
2. **Optimal substructure** — same requirement as DP (see
   `dynamic_programming.md`): the optimal solution contains optimal solutions
   to subproblems.

**There's no simple universal test for "does greedy work here?"** — the
practical approach is: try to prove (even informally, via an exchange argument
or by testing against DP) that a greedy choice never leads to a worse outcome
than any alternative first choice would. When in doubt, or when a greedy
solution is suspicious, DP is the safer fallback.

## Classic greedy problems

```java
// Activity Selection — maximum number of non-overlapping intervals
int maxNonOverlapping(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[1]));   // sort by END time — the key insight
    int count = 0;
    int lastEnd = Integer.MIN_VALUE;
    for (int[] interval : intervals) {
        if (interval[0] >= lastEnd) {
            count++;
            lastEnd = interval[1];
        }
    }
    return count;
}
```

**Sorting by end time (not start time) is the crucial insight** — greedily
picking the interval that finishes earliest at each step leaves the maximum
possible room for future intervals. Sorting by start time is a very common
incorrect first instinct that produces a suboptimal answer on some inputs.

```java
// Jump Game — can you reach the last index, given max jump distance at each position
boolean canJump(int[] nums) {
    int maxReach = 0;
    for (int i = 0; i < nums.length; i++) {
        if (i > maxReach) return false;   // this position is unreachable
        maxReach = Math.max(maxReach, i + nums[i]);
    }
    return true;
}

// Gas Station — find the starting index to complete a circular route, if one exists
int canCompleteCircuit(int[] gas, int[] cost) {
    int totalTank = 0, currentTank = 0, start = 0;
    for (int i = 0; i < gas.length; i++) {
        int diff = gas[i] - cost[i];
        totalTank += diff;
        currentTank += diff;
        if (currentTank < 0) {          // can't reach the next station from the current start
            start = i + 1;                // greedily restart from the next station
            currentTank = 0;
        }
    }
    return totalTank >= 0 ? start : -1;   // a solution exists only if total gas >= total cost
}
```

```java
// Huffman-coding-style: merge the two smallest elements repeatedly — a heap-driven greedy pattern
int minCostToConnectSticks(int[] sticks) {
    PriorityQueue<Integer> pq = new PriorityQueue<>();
    for (int s : sticks) pq.offer(s);

    int totalCost = 0;
    while (pq.size() > 1) {
        int first = pq.poll(), second = pq.poll();   // always combine the two smallest — the greedy choice
        int combined = first + second;
        totalCost += combined;
        pq.offer(combined);
    }
    return totalCost;
}
```

This pattern — repeatedly combining the two smallest available elements —
underlies Huffman coding and several "minimum cost to combine" problems; a
min-heap (see `heaps.md`) is the natural supporting structure for the "always
grab the smallest" greedy choice.

## Greedy vs. DP — a direct comparison on a related problem

```java
// Coin Change — MINIMUM number of coins to make an amount
// Greedy (grab the largest denomination that fits) WORKS for standard currency (1, 5, 10, 25...)
// but FAILS for arbitrary denominations, e.g. coins = {1, 3, 4}, amount = 6:
//   Greedy: 4 + 1 + 1 = 3 coins
//   Optimal: 3 + 3 = 2 coins  <-- greedy gives a WRONG answer here

// The general, always-correct solution requires DP:
int coinChange(int[] coins, int amount) {
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, amount + 1);   // sentinel value representing "unreachable"
    dp[0] = 0;
    for (int i = 1; i <= amount; i++) {
        for (int coin : coins) {
            if (coin <= i) {
                dp[i] = Math.min(dp[i], dp[i - coin] + 1);
            }
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];
}
```

**This is the single most instructive example of greedy's limitation** — greedy
coin change works for US currency specifically because of its denominations'
structure, but is provably incorrect for arbitrary denominations. Whenever a
problem "smells greedy" but you're not certain, testing it against a small
adversarial input (like `{1, 3, 4}`, amount 6, above) is a fast way to check
before committing to the approach.

## Practical guidance

1. **Verify (or at least sanity-check against a small adversarial example)
   that the greedy choice property actually holds** before trusting a greedy
   solution — it's easy to write a plausible greedy algorithm that's simply
   wrong.
2. **When in doubt, DP is the safer default** — greedy is an optimization once
   you've confirmed it applies, not a first resort.
3. **Sorting choice matters enormously** — activity selection's "sort by end
   time, not start time" is the canonical example of how the wrong sort key
   silently produces a suboptimal greedy result.
4. **Recognize the "repeatedly combine the two smallest" pattern** as a
   heap-backed greedy shape (Huffman-coding-style problems).
5. **Use coin change as your mental benchmark** for why greedy needs
   justification, not just intuition — it's correct for some denominations and
   provably wrong for others.