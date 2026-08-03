# Linear Structures — ArrayList, LinkedList, Stack, Queue/Deque

## ArrayList vs. LinkedList — the fundamental trade-off

| Operation | ArrayList | LinkedList |
|---|---|---|
| Get by index | O(1) | O(n) |
| Add/remove at end | O(1) amortized | O(1) |
| Add/remove at beginning | O(n) | O(1) |
| Add/remove in middle | O(n) | O(n) to find + O(1) to splice |
| Memory overhead | Low (contiguous array) | Higher (node + 2 pointers per element) |

**Default to `ArrayList` unless you specifically need frequent insertion/removal
at the front or middle** — its contiguous memory layout gives it better cache
locality and lower per-element overhead, and index access is O(1) vs.
LinkedList's O(n). `LinkedList` is the right choice far less often in practice
than its ubiquity in DSA courses might suggest.

```java
List<Integer> list = new ArrayList<>();
list.add(10);              // append, O(1) amortized
list.add(0, 5);              // insert at index 0, O(n) — shifts everything right
list.get(0);                 // O(1)
list.remove(Integer.valueOf(10));   // removes the VALUE 10 — note the boxing, see below
list.remove(0);              // removes the INDEX 0 — easy to confuse with the line above!
```

**Gotcha:** `list.remove(int)` removes by **index**; `list.remove(Object)`
removes by **value**. `list.remove(10)` on a `List<Integer>` removes the element
at index 10 — to remove the *value* 10, you must write `list.remove(Integer.valueOf(10))`
to force the compiler to pick the `Object` overload. A very common source of bugs.

## Implementing a singly linked list from scratch

```java
class ListNode {
    int val;
    ListNode next;
    ListNode(int val) { this.val = val; }
}

class SinglyLinkedList {
    private ListNode head;
    private int size;

    void addFirst(int val) {
        ListNode node = new ListNode(val);
        node.next = head;
        head = node;
        size++;
    }

    void addLast(int val) {
        ListNode node = new ListNode(val);
        if (head == null) { head = node; size++; return; }
        ListNode current = head;
        while (current.next != null) current = current.next;
        current.next = node;   // O(n) without a tail pointer — keep a `tail` reference to make this O(1)
        size++;
    }

    boolean remove(int val) {
        if (head == null) return false;
        if (head.val == val) { head = head.next; size--; return true; }
        ListNode current = head;
        while (current.next != null && current.next.val != val) current = current.next;
        if (current.next == null) return false;
        current.next = current.next.next;
        size--;
        return true;
    }
}
```

**Classic linked-list interview techniques:**

```java
// Reverse a linked list in place — O(n) time, O(1) space
ListNode reverse(ListNode head) {
    ListNode prev = null;
    while (head != null) {
        ListNode next = head.next;
        head.next = prev;
        prev = head;
        head = next;
    }
    return prev;
}

// Detect a cycle — Floyd's cycle detection ("tortoise and hare")
boolean hasCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) return true;
    }
    return false;
}

// Find the middle node — same slow/fast pointer idea
ListNode findMiddle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;   // slow is at the middle when fast reaches the end
}
```

The fast/slow pointer technique (also called "tortoise and hare") solves an
entire family of linked-list problems — cycle detection, finding the middle,
finding the Nth-from-end node — with O(1) space instead of an O(n)-space
auxiliary structure.

## Stack — LIFO (Last In, First Out)

```java
import java.util.ArrayDeque;
import java.util.Deque;

Deque<Integer> stack = new ArrayDeque<>();   // PREFERRED over java.util.Stack
stack.push(1);
stack.push(2);
stack.push(3);
stack.pop();      // 3 — removes and returns the top
stack.peek();      // 2 — looks without removing
stack.isEmpty();
```

**Avoid `java.util.Stack`** — it's a legacy class extending `Vector`, making it
synchronized (unnecessary overhead for typical single-threaded use) and giving it
an unfortunate index-based API inherited from `Vector`. `ArrayDeque` is the
modern, idiomatic choice for stack behavior in Java.

### Classic stack problems

```java
// Valid parentheses — the canonical stack problem
boolean isValid(String s) {
    Deque<Character> stack = new ArrayDeque<>();
    Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');
    for (char c : s.toCharArray()) {
        if (pairs.containsValue(c)) {
            stack.push(c);
        } else if (pairs.containsKey(c)) {
            if (stack.isEmpty() || stack.pop() != pairs.get(c)) return false;
        }
    }
    return stack.isEmpty();
}
```

Stacks are the natural fit for: matching/nesting problems (parentheses, HTML
tags), undo functionality, expression evaluation (infix/postfix conversion), and
depth-first traversal implemented iteratively (see `graphs.md`).

## Queue — FIFO (First In, First Out)

```java
Deque<Integer> queue = new ArrayDeque<>();   // used as a queue via addLast/pollFirst
queue.offer(1);     // add to the back (offer == addLast for a queue)
queue.offer(2);
queue.poll();        // 1 — removes and returns the front
queue.peek();         // looks at the front without removing
```

Queues are the natural fit for: BFS traversal (see `graphs.md`), task
scheduling, and any "process in the order received" problem.

## Deque — double-ended queue, the Swiss Army knife

```java
Deque<Integer> deque = new ArrayDeque<>();
deque.addFirst(1);
deque.addLast(2);
deque.removeFirst();
deque.removeLast();
```

`ArrayDeque` implements both stack and queue behavior in one class — this is why
it's the standard modern replacement for both `java.util.Stack` and using
`LinkedList` as a queue. Also the standard structure for the **sliding window
maximum** pattern:

```java
// Sliding window maximum — maintain a deque of indices, front is always the current max
int[] maxSlidingWindow(int[] nums, int k) {
    Deque<Integer> deque = new ArrayDeque<>();   // stores INDICES, decreasing value order
    int[] result = new int[nums.length - k + 1];
    for (int i = 0; i < nums.length; i++) {
        while (!deque.isEmpty() && deque.peekFirst() <= i - k) deque.pollFirst();       // remove out-of-window
        while (!deque.isEmpty() && nums[deque.peekLast()] < nums[i]) deque.pollLast();  // remove smaller values
        deque.offerLast(i);
        if (i >= k - 1) result[i - k + 1] = nums[deque.peekFirst()];
    }
    return result;
}
```

## Practical guidance

1. **Default to `ArrayList`**; reach for `LinkedList` only with a specific,
   justified reason (frequent front-insertion, or implementing your own
   structure that needs O(1) splicing).
2. **Use `ArrayDeque` for both stack and queue needs** — avoid `java.util.Stack`
   entirely in new code.
3. **Master the fast/slow pointer technique** — it solves cycle detection,
   middle-finding, and Nth-from-end problems uniformly with O(1) space.
4. **Watch the `list.remove(int)` vs `list.remove(Object)` overload trap** on
   `List<Integer>` specifically.
5. **Recognize stack problems (matching/nesting) vs queue problems (BFS,
   order-of-arrival processing)** as a first triage step before coding.