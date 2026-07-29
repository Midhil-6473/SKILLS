# Java Fundamentals for DSA

## Arrays — the foundational structure

```java
int[] nums = new int[5];              // fixed-size, zero-initialized: [0,0,0,0,0]
int[] nums2 = {1, 2, 3, 4, 5};        // literal initialization
int[][] grid = new int[3][4];          // 2D array, 3 rows x 4 cols

nums[0] = 10;                          // O(1) access and assignment
int length = nums.length;              // NOTE: .length is a field, not a method (no parens)
```

**Arrays are fixed-size once created** — this is the core limitation that
`ArrayList` (below) exists to solve. Access by index is O(1); insertion/deletion
in the middle is O(n) since subsequent elements must shift.

```java
import java.util.Arrays;

Arrays.sort(nums);                              // O(n log n), in-place
int idx = Arrays.binarySearch(nums, 3);          // O(log n), array MUST be sorted first
int[] copy = Arrays.copyOf(nums, nums.length);   // O(n)
Arrays.fill(nums, 0);                            // O(n)
String s = Arrays.toString(nums);                 // "[1, 2, 3, 4, 5]" — for debugging
```

## The Collections Framework — the map every Java DSA solution lives in

```
Collection (interface)
├── List — ordered, allows duplicates, index access
│   ├── ArrayList   — backed by a resizable array
│   └── LinkedList   — doubly-linked list
├── Set — no duplicates
│   ├── HashSet       — no order guarantee, O(1) average add/contains
│   ├── LinkedHashSet — insertion order preserved
│   └── TreeSet        — sorted order, O(log n) operations
└── Queue / Deque
    ├── ArrayDeque      — resizable array, stack AND queue behavior — PREFER THIS
    ├── LinkedList       — also implements Deque
    └── PriorityQueue    — heap-ordered, NOT insertion order

Map (separate interface, not a Collection subtype)
├── HashMap       — no order guarantee, O(1) average get/put
├── LinkedHashMap — insertion (or access) order preserved
└── TreeMap        — sorted by key, O(log n) operations
```

Knowing this hierarchy is 80% of "which structure do I use" — most DSA problems
reduce to picking the right box from this map, not inventing something new.

## Generics — always use them

```java
List<Integer> nums = new ArrayList<>();     // correct — type-safe
List rawList = new ArrayList();              // WRONG in new code — no compile-time type checking

Map<String, List<Integer>> graph = new HashMap<>();   // generics compose naturally
```

Raw types compile (for legacy compatibility) but discard all compile-time type
safety — always parameterize collections in new code.

## Autoboxing — a real performance and correctness trap

```java
List<Integer> list = new ArrayList<>();
list.add(5);            // int 5 auto-boxed to Integer

Integer a = 1000;
Integer b = 1000;
System.out.println(a == b);        // false! — reference comparison on boxed objects
System.out.println(a.equals(b));   // true — correct way to compare boxed values

Integer c = 100;
Integer d = 100;
System.out.println(c == d);        // true — small values (-128 to 127) are cached, MISLEADING
```

**Never compare boxed types (`Integer`, `Long`, `Character`, etc.) with `==`** —
use `.equals()`. The small-integer cache (-128 to 127) makes `==` appear to work
for small test values and then silently break for larger ones — a classic,
genuinely common bug.

```java
// Autoboxing also has a real performance cost in tight loops
List<Integer> nums = new ArrayList<>();
for (int i = 0; i < 1_000_000; i++) {
    nums.add(i);   // 1,000,000 int → Integer boxing operations
}
// For performance-critical numeric code, a raw int[] avoids this entirely
```

## `var` — local type inference (Java 10+)

```java
var list = new ArrayList<Integer>();     // inferred as ArrayList<Integer>
var map = new HashMap<String, Integer>();
for (var entry : map.entrySet()) { ... }  // fine — type is clear from context
```

Use `var` when the type is already obvious from the right-hand side (reduces
visual noise); avoid it when it would obscure the type for a reader (e.g., `var
result = process(x);` where `process`'s return type isn't obvious from the name).

## Enhanced `switch` and pattern matching (Java 21+ LTS)

```java
// Old style
String describe(Object obj) {
    if (obj instanceof Integer) {
        Integer i = (Integer) obj;
        return "int: " + i;
    } else if (obj instanceof String) {
        String s = (String) obj;
        return "string: " + s;
    }
    return "unknown";
}

// Modern pattern-matching switch — binds the variable inline, no manual cast
String describe(Object obj) {
    return switch (obj) {
        case Integer i -> "int: " + i;
        case String s -> "string: " + s;
        default -> "unknown";
    };
}
```

This is genuinely useful in DSA code for things like tree/graph node type
dispatch or parsing problems with heterogeneous input — cleaner than a chain of
`instanceof` checks with manual casts.

## Records — concise immutable data carriers (Java 16+)

```java
record Point(int x, int y) {}
record Edge(int from, int to, int weight) {}

var p = new Point(3, 4);
System.out.println(p.x());        // accessor auto-generated
System.out.println(p);            // Point[x=3, y=4] — toString auto-generated

// equals()/hashCode() are auto-generated too — records work correctly as HashMap/HashSet keys
Set<Point> visited = new HashSet<>();
visited.add(new Point(1, 2));
visited.contains(new Point(1, 2));   // true — structural equality, for free
```

**Records are excellent for DSA code** representing coordinates, graph edges, or
any small immutable data bundle — you get correct `equals`/`hashCode` (critical
for use as `HashSet`/`HashMap` keys — see `hashing.md`) without writing it by
hand, which eliminates an entire class of "I forgot to override hashCode" bugs.

## Common Java-specific gotchas in DSA code

```java
// String comparison
String a = "hello";
String b = "hello";
a == b;          // true here (string pool interning) — but DON'T rely on this
a.equals(b);      // always correct — use this

// Integer division truncates
int result = 5 / 2;        // 2, not 2.5
double result2 = 5 / 2;    // still 2.0! — the division happens as int first
double result3 = 5.0 / 2;  // 2.5 — correct, force at least one operand to double

// Array vs List — arrays don't have a nice .toString(), and List<int[]> is a common trap
int[] arr = {1, 2, 3};
System.out.println(arr);              // prints something like [I@1b6d3586 — NOT the contents
System.out.println(Arrays.toString(arr));   // [1, 2, 3] — correct
```

## Practical guidance

1. **Learn the Collections Framework hierarchy before memorizing individual
   class APIs** — it tells you where to look for any given need.
2. **Never compare boxed numeric types with `==`.**
3. **Use records for small immutable data bundles** (points, edges, pairs) in
   DSA code — correct `equals`/`hashCode` for free.
4. **Prefer `Arrays.toString()`/`Arrays.deepToString()`** over printing an array
   directly.
5. **Watch integer division and overflow** — force `double` division
   deliberately when needed, use `long` for large sums.