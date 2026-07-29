# Heaps and Priority Queues

## What a heap is

A heap is a tree-shaped structure (usually implemented on a plain array, not
actual node objects) satisfying the **heap property**: in a min-heap, every
parent is ≤ its children (so the minimum is always at the root); in a max-heap,
every parent is ≥ its children. This gives O(log n) insertion and O(log n)
removal-of-min/max, with O(1) peek at the min/max — the right structure whenever
you repeatedly need "the smallest/largest remaining element" without needing the
whole collection sorted.

## `PriorityQueue` — Java's built-in heap

```java
import java.util.PriorityQueue;

PriorityQueue<Integer> minHeap = new PriorityQueue<>();          // min-heap by default
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Collections.reverseOrder());   // max-heap

minHeap.offer(5);
minHeap.offer(1);
minHeap.offer(3);
minHeap.poll();     // 1 — removes and returns the minimum
minHeap.peek();      // looks at the minimum without removing
```

**`PriorityQueue` is NOT sorted overall** — only the head (min or max,
depending on ordering) is guaranteed accessible in O(1); iterating it directly
gives no ordering guarantee at all. If you need the fully sorted sequence, poll
repeatedly (O(n log n) total) rather than iterating.

### Custom ordering with a comparator

```java
// Min-heap of int[] pairs, ordered by the second element
PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[1] - b[1]);

// Or with a named Comparator for clarity — often better for readability
PriorityQueue<Task> taskQueue = new PriorityQueue<>(Comparator.comparingInt(Task::priority));

// Multi-key comparator — sort by priority, then by arrival time as a tiebreak
PriorityQueue<Task> multiKey = new PriorityQueue<>(
    Comparator.comparingInt(Task::priority).thenComparingLong(Task::arrivalTime)
);
```

`Comparator.comparingInt(...).thenComparing(...)` is the idiomatic way to build
multi-key orderings without hand-writing a `compare` method — reach for this over
a raw lambda subtraction (`(a, b) -> a[1] - b[1]`) once ordering logic has more
than one key, and even for a single `int` key it avoids a subtle **integer
overflow bug** possible with subtraction-based comparators on large values.

## Building a heap from scratch (the array-based mechanics)

Worth understanding once, even though `PriorityQueue` is what you'd actually use:

```java
class MinHeap {
    private final List<Integer> heap = new ArrayList<>();

    private int parent(int i) { return (i - 1) / 2; }
    private int left(int i) { return 2 * i + 1; }
    private int right(int i) { return 2 * i + 2; }

    void offer(int val) {
        heap.add(val);
        siftUp(heap.size() - 1);
    }

    private void siftUp(int i) {
        while (i > 0 && heap.get(parent(i)) > heap.get(i)) {
            Collections.swap(heap, i, parent(i));
            i = parent(i);
        }
    }

    int poll() {
        int min = heap.get(0);
        int last = heap.remove(heap.size() - 1);
        if (!heap.isEmpty()) {
            heap.set(0, last);
            siftDown(0);
        }
        return min;
    }

    private void siftDown(int i) {
        int smallest = i;
        if (left(i) < heap.size() && heap.get(left(i)) < heap.get(smallest)) smallest = left(i);
        if (right(i) < heap.size() && heap.get(right(i)) < heap.get(smallest)) smallest = right(i);
        if (smallest != i) {
            Collections.swap(heap, i, smallest);
            siftDown(smallest);
        }
    }
}
```

The key insight: a **complete binary tree stored in an array** lets you compute
parent/child relationships purely by index arithmetic (`2i+1`, `2i+2`, `(i-1)/2`)
— no actual node/pointer objects needed. `siftUp` restores the heap property
after insertion (bubble toward the root); `siftDown` restores it after removal
(bubble toward the leaves).

## Classic heap problem patterns

### Top-K problems — the signature heap use case

```java
// K largest elements — use a MIN-heap of size K (counterintuitive but correct)
int[] findKLargest(int[] nums, int k) {
    PriorityQueue<Integer> minHeap = new PriorityQueue<>();
    for (int n : nums) {
        minHeap.offer(n);
        if (minHeap.size() > k) minHeap.poll();   // evict the smallest, keeping only the K largest
    }
    return minHeap.stream().mapToInt(Integer::intValue).toArray();
}
```

**The counterintuitive-but-standard trick**: for "K largest," use a **min-heap**
capped at size K (evicting the smallest whenever it overflows) — not a
max-heap. A max-heap would put the single largest element at the top but gives
no easy way to maintain "the K largest as a group." This pattern is O(n log k),
better than sorting the whole array (O(n log n)) when k is much smaller than n.

### Merge K sorted lists

```java
ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> pq = new PriorityQueue<>(Comparator.comparingInt(node -> node.val));
    for (ListNode node : lists) if (node != null) pq.offer(node);

    ListNode dummy = new ListNode(0);
    ListNode tail = dummy;
    while (!pq.isEmpty()) {
        ListNode smallest = pq.poll();
        tail.next = smallest;
        tail = tail.next;
        if (smallest.next != null) pq.offer(smallest.next);
    }
    return dummy.next;
}
```

### Two-heap median tracking

```java
// Running median from a data stream — a max-heap for the lower half, min-heap for the upper half
class MedianFinder {
    private final PriorityQueue<Integer> lowerHalf = new PriorityQueue<>(Collections.reverseOrder());
    private final PriorityQueue<Integer> upperHalf = new PriorityQueue<>();

    void addNum(int num) {
        lowerHalf.offer(num);
        upperHalf.offer(lowerHalf.poll());              // rebalance: move the max of lower half up
        if (upperHalf.size() > lowerHalf.size()) {
            lowerHalf.offer(upperHalf.poll());            // keep the halves size-balanced
        }
    }

    double findMedian() {
        if (lowerHalf.size() > upperHalf.size()) return lowerHalf.peek();
        return (lowerHalf.peek() + upperHalf.peek()) / 2.0;
    }
}
```

Two balanced heaps (a max-heap for values below the median, a min-heap for
values above) let you find the running median in O(log n) per insertion and
O(1) per query — a genuinely elegant pattern worth recognizing on sight.

## Heap Sort

```java
void heapSort(int[] arr) {
    PriorityQueue<Integer> pq = new PriorityQueue<>();
    for (int n : arr) pq.offer(n);
    for (int i = 0; i < arr.length; i++) arr[i] = pq.poll();
}
```

O(n log n) time, and this is essentially what `PriorityQueue`-based heap sort
looks like using the built-in class — see `sorting_and_searching.md` for how
this compares to other O(n log n) sorts and when an in-place array-based heap
sort (no auxiliary heap object) matters.

## Practical guidance

1. **Recognize "top-K" or "kth largest/smallest" as the heap-shaped problem
   signature** — and remember the min-heap-of-size-K trick for "K largest."
2. **Use `Comparator.comparingInt(...).thenComparing(...)`** for anything beyond
   a single trivial ordering key — avoids overflow bugs and reads more clearly
   than a subtraction lambda.
3. **Remember `PriorityQueue` only guarantees ordering at the head**, not full
   iteration order.
4. **Recognize the two-heap pattern** for running-median/balance-point problems.
5. **Use `PriorityQueue` in real code**; implement a heap from scratch only for
   the specific learning exercise of understanding sift-up/sift-down mechanics.