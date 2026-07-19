# Sorting and Searching

## The sorting landscape

| Algorithm | Time (avg) | Time (worst) | Space | Stable? | Notes |
|---|---|---|---|---|---|
| Bubble Sort | O(n²) | O(n²) | O(1) | Yes | Educational only — never use in practice |
| Insertion Sort | O(n²) | O(n²) | O(1) | Yes | Fast for small/nearly-sorted arrays |
| Selection Sort | O(n²) | O(n²) | O(1) | No | Educational only |
| Merge Sort | O(n log n) | O(n log n) | O(n) | Yes | Guaranteed n log n, needs extra space |
| Quick Sort | O(n log n) | O(n²) | O(log n) | No | Fast in practice, worst case is rare with good pivot choice |
| Heap Sort | O(n log n) | O(n log n) | O(1) | No | Guaranteed n log n, in-place, but poor cache locality |
| Java's `Arrays.sort()` (primitives) | O(n log n) | O(n log n) | varies | N/A | Dual-pivot quicksort variant |
| Java's `Arrays.sort()` (objects) / `Collections.sort()` | O(n log n) | O(n log n) | O(n) | Yes | TimSort — stable, hybrid merge/insertion sort |

**In real Java code, always use `Arrays.sort()` or `Collections.sort()`** —
implementing your own sort is a learning exercise, not something to do in
production or (usually) even in an interview unless explicitly asked to
implement a specific algorithm.

```java
int[] nums = {5, 2, 8, 1};
Arrays.sort(nums);                                  // ascending, primitives — dual-pivot quicksort

Integer[] boxed = {5, 2, 8, 1};
Arrays.sort(boxed, Collections.reverseOrder());       // descending — needs boxed type for a Comparator

List<Integer> list = new ArrayList<>(List.of(5, 2, 8, 1));
Collections.sort(list);                              // ascending
list.sort(Comparator.reverseOrder());                  // descending, via List.sort

// Custom objects
List<Person> people = ...;
people.sort(Comparator.comparing(Person::age).thenComparing(Person::name));
```

**Note the primitive vs. object distinction**: `Arrays.sort(int[])` uses a
dual-pivot quicksort variant (no stability concept applies to primitives, since
there's no notion of "equal but distinguishable" elements); `Arrays.sort(Object[])`
and `Collections.sort()` use **TimSort**, a stable hybrid of merge sort and
insertion sort — stability matters whenever you're sorting objects by one field
but want to preserve relative order among equal elements.

## Merge Sort — from scratch (the classic divide-and-conquer example)

```java
void mergeSort(int[] arr, int left, int right) {
    if (left >= right) return;
    int mid = left + (right - left) / 2;   // avoids overflow vs (left + right) / 2 for large indices
    mergeSort(arr, left, mid);
    mergeSort(arr, mid + 1, right);
    merge(arr, left, mid, right);
}

private void merge(int[] arr, int left, int mid, int right) {
    int[] temp = new int[right - left + 1];
    int i = left, j = mid + 1, k = 0;
    while (i <= mid && j <= right) {
        temp[k++] = arr[i] <= arr[j] ? arr[i++] : arr[j++];   // <= preserves stability
    }
    while (i <= mid) temp[k++] = arr[i++];
    while (j <= right) temp[k++] = arr[j++];
    System.arraycopy(temp, 0, arr, left, temp.length);
}
```

`left + (right - left) / 2` (rather than `(left + right) / 2`) is the standard
guard against integer overflow when `left` and `right` are both large — a subtle
but real correctness issue worth knowing even though it rarely bites at typical
interview input sizes.

## Quick Sort — from scratch

```java
void quickSort(int[] arr, int low, int high) {
    if (low >= high) return;
    int pivotIndex = partition(arr, low, high);
    quickSort(arr, low, pivotIndex - 1);
    quickSort(arr, pivotIndex + 1, high);
}

private int partition(int[] arr, int low, int high) {
    int pivot = arr[high];
    int i = low - 1;
    for (int j = low; j < high; j++) {
        if (arr[j] < pivot) {
            i++;
            int tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
    }
    int tmp = arr[i + 1]; arr[i + 1] = arr[high]; arr[high] = tmp;
    return i + 1;
}
```

Quick sort's O(n²) worst case occurs on already-sorted (or reverse-sorted) input
with naive last-element pivot selection — real-world implementations (including
Java's) use techniques like randomized or median-of-three pivot selection to
make the worst case practically unreachable.

## Binary Search — and its variants

```java
int binarySearch(int[] arr, int target) {
    int left = 0, right = arr.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;   // not found
}
```

**Prerequisite: the array must be sorted.** Binary search is the canonical
O(log n) algorithm, and its core idea — repeatedly halving a search space based
on a comparison — generalizes far beyond plain array search.

### Finding the leftmost / rightmost occurrence (with duplicates)

```java
int findLeftmost(int[] arr, int target) {
    int left = 0, right = arr.length - 1, result = -1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) {
            result = mid;
            right = mid - 1;   // keep searching LEFT for an earlier occurrence
        } else if (arr[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return result;
}
```

### Binary search on the answer — a powerful generalized pattern

Binary search isn't only for finding a value in a sorted array — it applies to
any problem where you're searching over a **monotonic space of possible
answers** (if answer X works, does every value greater/lesser than X also
work?).

```java
// Example shape: "find the minimum capacity such that condition(capacity) is achievable"
int findMinimumCapacity(int[] weights, int days) {
    int left = Arrays.stream(weights).max().getAsInt();   // smallest plausible answer
    int right = Arrays.stream(weights).sum();               // largest plausible answer
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (canShipInDays(weights, mid, days)) {
            right = mid;   // mid works — try to do better (search left half)
        } else {
            left = mid + 1;   // mid doesn't work — need more capacity (search right half)
        }
    }
    return left;
}
```

**Recognizing "binary search on the answer" is a genuinely high-value pattern**
— many problems that don't look like classic array search (minimum/maximum
achievable value under some constraint) are solvable in O(n log(range)) this way
once you notice the underlying monotonicity ("if capacity X works, any capacity
> X also works").

## `Arrays.binarySearch` and `Collections.binarySearch` — built-in versions

```java
int idx = Arrays.binarySearch(sortedArr, target);          // array MUST be sorted first
int idx2 = Collections.binarySearch(sortedList, target);     // list MUST be sorted first
// Both return a NEGATIVE value (specifically -(insertion point) - 1) if not found —
// don't just check idx < 0 and discard it; the negative value is itself useful
// for finding where the target WOULD be inserted to keep the collection sorted.
```

## Practical guidance

1. **Use `Arrays.sort()`/`Collections.sort()` in real code** — implement sorts
   from scratch only as a learning exercise or when specifically asked.
2. **Know merge sort and quick sort's mechanics and complexity trade-offs**
   (guaranteed O(n log n) + extra space vs. usually-fast-but-O(n²)-worst-case
   in-place) — a very common conceptual interview question even without asking
   for implementation.
3. **Always use `left + (right - left) / 2`**, not `(left + right) / 2`, to
   avoid overflow in binary search midpoint calculation.
4. **Recognize "binary search on the answer"** as a pattern separate from
   plain array search — it applies whenever the solution space is monotonic.
5. **Remember the array must be sorted** before either flavor of binary search
   is valid — searching an unsorted array with `binarySearch` gives undefined,
   incorrect results.