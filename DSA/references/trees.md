# Trees — Binary Trees, BSTs, Balanced Trees, Tries

## Basic binary tree node

```java
class TreeNode {
    int val;
    TreeNode left, right;
    TreeNode(int val) { this.val = val; }
}
```

Or, more concisely with a record for an immutable variant — though mutable
classes are more common for trees since you typically build them incrementally.

## Tree traversals — the foundational skill

```java
// Depth-first traversals — three orderings, same recursive shape
void preorder(TreeNode root, List<Integer> result) {   // Root -> Left -> Right
    if (root == null) return;
    result.add(root.val);
    preorder(root.left, result);
    preorder(root.right, result);
}

void inorder(TreeNode root, List<Integer> result) {    // Left -> Root -> Right
    if (root == null) return;
    inorder(root.left, result);
    result.add(root.val);
    inorder(root.right, result);
}

void postorder(TreeNode root, List<Integer> result) {  // Left -> Right -> Root
    if (root == null) return;
    postorder(root.left, result);
    postorder(root.right, result);
    result.add(root.val);
}
```

**Inorder traversal of a BST visits nodes in sorted order** — this single fact
is the basis for a large fraction of BST problems (validate BST, find kth
smallest, etc.).

```java
// Breadth-first (level-order) traversal — uses a queue, not recursion
List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> result = new ArrayList<>();
    if (root == null) return result;
    Deque<TreeNode> queue = new ArrayDeque<>();
    queue.offer(root);
    while (!queue.isEmpty()) {
        int levelSize = queue.size();
        List<Integer> level = new ArrayList<>();
        for (int i = 0; i < levelSize; i++) {
            TreeNode node = queue.poll();
            level.add(node.val);
            if (node.left != null) queue.offer(node.left);
            if (node.right != null) queue.offer(node.right);
        }
        result.add(level);
    }
    return result;
}
```

The `levelSize` snapshot trick (capturing `queue.size()` before the inner loop)
is the standard technique for grouping BFS output **by level** — without it, you
get a flat traversal with no level boundaries.

### Iterative DFS (using an explicit stack — see `linear_structures.md`)

```java
List<Integer> preorderIterative(TreeNode root) {
    List<Integer> result = new ArrayList<>();
    if (root == null) return result;
    Deque<TreeNode> stack = new ArrayDeque<>();
    stack.push(root);
    while (!stack.isEmpty()) {
        TreeNode node = stack.pop();
        result.add(node.val);
        if (node.right != null) stack.push(node.right);   // push right FIRST so left is processed first
        if (node.left != null) stack.push(node.left);
    }
    return result;
}
```

Any recursive DFS can be rewritten iteratively with an explicit stack — worth
knowing since some interviews specifically ask for the iterative version (often
to test understanding of what recursion is doing under the hood with the call
stack).

## Binary Search Tree (BST) — ordered for O(log n) operations

```java
class BST {
    TreeNode root;

    void insert(int val) { root = insertHelper(root, val); }

    private TreeNode insertHelper(TreeNode node, int val) {
        if (node == null) return new TreeNode(val);
        if (val < node.val) node.left = insertHelper(node.left, val);
        else if (val > node.val) node.right = insertHelper(node.right, val);
        return node;
    }

    boolean search(int val) {
        TreeNode current = root;
        while (current != null) {
            if (val == current.val) return true;
            current = val < current.val ? current.left : current.right;
        }
        return false;
    }
}
```

**BST operations are O(log n) only if the tree stays balanced.** A BST built by
inserting already-sorted data degenerates into a linked list — O(n) worst case.
This is exactly the problem self-balancing trees solve.

## Balanced trees — the concept, not full from-scratch implementation

**AVL trees** and **Red-Black trees** are self-balancing BSTs that guarantee
O(log n) height via rotations after insert/delete. Full from-scratch
implementation is rarely asked for in interviews (it's genuinely intricate) —
what matters is:

1. **Understanding why balance matters** (worst-case O(n) degradation without it).
2. **Knowing Java's `TreeMap`/`TreeSet` are red-black trees under the hood** —
   you get the guaranteed O(log n) balanced-tree behavior for free via the
   built-in classes (see `hashing.md`), without implementing rotations yourself.

```java
// You get balanced-tree guarantees "for free" via TreeMap/TreeSet in real code
TreeMap<Integer, String> balanced = new TreeMap<>();   // red-black tree internally, O(log n) guaranteed
```

## Trie (prefix tree) — for string/prefix problems

```java
class TrieNode {
    Map<Character, TrieNode> children = new HashMap<>();
    boolean isEndOfWord;
}

class Trie {
    private final TrieNode root = new TrieNode();

    void insert(String word) {
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            node = node.children.computeIfAbsent(c, k -> new TrieNode());
        }
        node.isEndOfWord = true;
    }

    boolean search(String word) {
        TrieNode node = find(word);
        return node != null && node.isEndOfWord;
    }

    boolean startsWith(String prefix) {
        return find(prefix) != null;
    }

    private TrieNode find(String s) {
        TrieNode node = root;
        for (char c : s.toCharArray()) {
            node = node.children.get(c);
            if (node == null) return null;
        }
        return node;
    }
}
```

`computeIfAbsent` is the idiomatic one-liner for "get this child node, or create
it if it doesn't exist yet" — avoids a manual null-check-then-insert.

**Tries are the right structure specifically for**: autocomplete/prefix
matching, word search puzzles, and any problem repeatedly asking "does any word
in this set start with X?" — a plain `HashSet<String>` can't answer that
efficiently, but a trie does it in O(prefix length).

## Common tree problem patterns

```java
// Maximum depth — the simplest recursive tree pattern
int maxDepth(TreeNode root) {
    if (root == null) return 0;
    return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}

// Validate BST — must track a valid (min, max) RANGE, not just compare to immediate children
boolean isValidBST(TreeNode root) {
    return validate(root, Long.MIN_VALUE, Long.MAX_VALUE);
}
private boolean validate(TreeNode node, long min, long max) {
    if (node == null) return true;
    if (node.val <= min || node.val >= max) return false;
    return validate(node.left, min, node.val) && validate(node.right, node.val, max);
}

// Lowest Common Ancestor (LCA) — a very common interview question
TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
    if (root == null || root == p || root == q) return root;
    TreeNode left = lowestCommonAncestor(root.left, p, q);
    TreeNode right = lowestCommonAncestor(root.right, p, q);
    if (left != null && right != null) return root;   // p and q found in different subtrees
    return left != null ? left : right;
}
```

**The "validate BST" gotcha** is worth calling out explicitly: comparing each
node only to its immediate children (not the full valid range inherited from
ancestors) is a very common incorrect first attempt — a node can locally look
fine while still violating the BST property relative to a grandparent.

## Practical guidance

1. **Know all three DFS orderings and level-order BFS** cold — they're the
   building blocks for almost every other tree problem.
2. **Remember inorder-of-BST-is-sorted** — it unlocks many BST-specific
   problems.
3. **Use `TreeMap`/`TreeSet` in real code** rather than implementing your own
   balanced tree — reserve from-scratch AVL/Red-Black implementation for
   specific "implement a balanced tree" exercises.
4. **Reach for a trie specifically for prefix-matching problems** — a
   `HashSet<String>` cannot efficiently answer "does anything start with X?"
5. **When validating BST properties, track a range inherited from ancestors**,
   not just an immediate-parent comparison.