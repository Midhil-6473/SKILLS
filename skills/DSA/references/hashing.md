# Hashing — HashMap, HashSet, TreeMap, and Correct hashCode/equals

## Why hashing matters

A hash table gives **O(1) average-case** lookup, insertion, and deletion —
dramatically better than a linear O(n) scan through an array or list for
"does this exist?" / "what's the value for this key?" questions. This single
capability underlies an enormous fraction of efficient DSA solutions: turning an
O(n²) brute-force nested loop into an O(n) single pass by trading space for time.

## HashMap and HashSet — the basics

```java
Map<String, Integer> counts = new HashMap<>();
counts.put("apple", 1);
counts.get("apple");                              // 1
counts.getOrDefault("banana", 0);                  // 0 — avoids a null check
counts.merge("apple", 1, Integer::sum);            // increments existing value, or inserts if absent
counts.containsKey("apple");                        // O(1) average
counts.remove("apple");

Set<Integer> seen = new HashSet<>();
seen.add(5);
seen.contains(5);    // O(1) average
```

`getOrDefault` and `merge` are the two methods that eliminate almost all manual
"check if key exists, then increment or insert" boilerplate — use them by
default over manual `containsKey` checks.

### The classic pattern: frequency counting

```java
// Two Sum — the canonical "hashmap turns O(n²) into O(n)" example
int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();   // value -> index
    for (int i = 0; i < nums.length; i++) {
        int complement = target - nums[i];
        if (seen.containsKey(complement)) {
            return new int[]{seen.get(complement), i};
        }
        seen.put(nums[i], i);
    }
    throw new IllegalArgumentException("No solution");
}
```

```java
// Frequency map — the basis for anagram, majority element, and many other problems
Map<Character, Integer> freq = new HashMap<>();
for (char c : s.toCharArray()) {
    freq.merge(c, 1, Integer::sum);
}
```

## How HashMap actually works internally

A `HashMap` stores entries in an array of "buckets." A key's `hashCode()` is
computed and mapped (via modulo, roughly) to a bucket index. Multiple keys can
hash to the same bucket (a **collision**) — Java's `HashMap` handles this by
storing colliding entries as a linked list within that bucket (or, since Java 8,
as a balanced tree once a bucket gets large enough, to bound worst-case lookup
at O(log n) instead of O(n) even under many collisions in one bucket).

**This is exactly why both `hashCode()` and `equals()` must be overridden
together and consistently** for any custom class used as a `HashMap`/`HashSet`
key:

```java
class Point {
    int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Point p)) return false;   // pattern matching instanceof, Java 16+
        return x == p.x && y == p.y;
    }

    @Override
    public int hashCode() {
        return Objects.hash(x, y);   // combines both fields into one hash
    }
}
```

**The contract**: if `a.equals(b)` is true, then `a.hashCode() == b.hashCode()`
must also be true. Violating this silently breaks `HashMap`/`HashSet` —
two "equal" objects could land in different buckets and the map would never find
one when looking up the other. Overriding `equals()` without `hashCode()` (or
vice versa) is a very common, hard-to-notice bug — **always override both
together**, or better, use a `record` (see `java_fundamentals.md`) which
generates both correctly for free.

```java
// The record equivalent — correct equals/hashCode with zero manual code
record Point(int x, int y) {}
```

## TreeMap / TreeSet — sorted order, O(log n)

```java
TreeMap<Integer, String> sorted = new TreeMap<>();
sorted.put(3, "c");
sorted.put(1, "a");
sorted.put(2, "b");
sorted.firstKey();      // 1
sorted.lastKey();        // 3
sorted.ceilingKey(2);     // 2 — smallest key >= 2
sorted.floorKey(2);       // 2 — largest key <= 2
sorted.higherKey(2);      // 3 — smallest key > 2
sorted.lowerKey(2);       // 1 — largest key < 2
```

`TreeMap`/`TreeSet` are backed by a **red-black tree** (a self-balancing BST —
see `trees.md`), giving O(log n) operations instead of `HashMap`'s O(1) average —
**trade some speed for guaranteed sorted order and range queries**
(`ceilingKey`, `floorKey`, `subMap`). Reach for these specifically when you need
order, not just membership/lookup.

## LinkedHashMap — insertion (or access) order preserved

```java
Map<String, Integer> ordered = new LinkedHashMap<>();
// iterates in insertion order, unlike plain HashMap (whose iteration order is unspecified)

// LRU cache — a classic use of LinkedHashMap's access-order mode
class LRUCache extends LinkedHashMap<Integer, Integer> {
    private final int capacity;
    LRUCache(int capacity) {
        super(capacity, 0.75f, true);   // true = access-order (most recently used moves to the end)
        this.capacity = capacity;
    }
    @Override
    protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
        return size() > capacity;   // auto-evict the least-recently-used entry
    }
}
```

This is the standard, idiomatic Java way to implement an LRU cache — subclassing
`LinkedHashMap` with access-order mode and overriding `removeEldestEntry` gives
you a working LRU cache in ~10 lines, rather than hand-building a doubly linked
list + hashmap combination from scratch (which is also a legitimate exercise —
see `problem_solving_strategy.md` for when an interview specifically wants the
from-scratch version).

## Hash sets for existence/duplicate problems

```java
// Contains duplicate — O(n) time, O(n) space
boolean containsDuplicate(int[] nums) {
    Set<Integer> seen = new HashSet<>();
    for (int n : nums) {
        if (!seen.add(n)) return true;   // Set.add() returns false if the element was already present
    }
    return false;
}
```

`Set.add()` returning a `boolean` (false if the element was already present) is
a small but genuinely useful API detail — it lets you check-and-insert in one
call instead of a separate `contains()` check followed by `add()`.

## Practical guidance

1. **Reach for HashMap/HashSet as the default tool for "have I seen this
   before?" or "count occurrences" problems** — this converts most O(n²)
   brute-force approaches into O(n).
2. **Use `getOrDefault` and `merge`** instead of manual `containsKey` checks.
3. **Always override `equals()` and `hashCode()` together** on custom key
   classes — or use a `record` to get both correct automatically.
4. **Use `TreeMap`/`TreeSet` specifically when you need sorted order or range
   queries** — not as a default over `HashMap`/`HashSet`.
5. **Know the `LinkedHashMap` access-order LRU cache pattern** — it's a common
   interview question with a genuinely elegant built-in-class solution.