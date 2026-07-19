# Graphs — Representations, Traversal, Shortest Path, MST

## Graph representations

```java
// Adjacency list — the standard choice for most problems (sparse graphs)
Map<Integer, List<Integer>> graph = new HashMap<>();
graph.computeIfAbsent(0, k -> new ArrayList<>()).add(1);   // edge 0 -> 1
graph.computeIfAbsent(1, k -> new ArrayList<>()).add(2);   // edge 1 -> 2

// Or, for a fixed number of nodes 0..n-1
List<List<Integer>> adjList = new ArrayList<>();
for (int i = 0; i < n; i++) adjList.add(new ArrayList<>());
adjList.get(0).add(1);

// Adjacency matrix — O(1) edge lookup, O(V²) space — better for DENSE graphs
int[][] matrix = new int[n][n];
matrix[0][1] = 1;   // edge exists between 0 and 1

// Weighted edges — a record pairs well here
record Edge(int to, int weight) {}
Map<Integer, List<Edge>> weightedGraph = new HashMap<>();
```

| | Adjacency List | Adjacency Matrix |
|---|---|---|
| Space | O(V + E) | O(V²) |
| Edge lookup | O(degree) | O(1) |
| Iterate all edges from a node | O(degree) — efficient | O(V) — wasteful for sparse graphs |
| Best for | Most real-world/sparse graphs | Dense graphs, or when O(1) edge lookup matters more than space |

**Default to adjacency list** — most graph problems (including nearly all
interview problems) involve sparse graphs where the list representation is both
more space-efficient and faster to iterate.

## BFS — Breadth-First Search

```java
List<Integer> bfs(Map<Integer, List<Integer>> graph, int start) {
    List<Integer> order = new ArrayList<>();
    Set<Integer> visited = new HashSet<>();
    Deque<Integer> queue = new ArrayDeque<>();
    queue.offer(start);
    visited.add(start);

    while (!queue.isEmpty()) {
        int node = queue.poll();
        order.add(node);
        for (int neighbor : graph.getOrDefault(node, List.of())) {
            if (!visited.contains(neighbor)) {
                visited.add(neighbor);
                queue.offer(neighbor);
            }
        }
    }
    return order;
}
```

**BFS visits nodes in order of increasing distance from the start** — this is
exactly why BFS is the right algorithm for **shortest path in an unweighted
graph** (or a graph where every edge has equal weight). Mark nodes visited **when
enqueued**, not when dequeued — marking on dequeue allows the same node to be
enqueued multiple times, wasting work (and can cause incorrect results in some
variants).

## DFS — Depth-First Search

```java
// Recursive
void dfs(Map<Integer, List<Integer>> graph, int node, Set<Integer> visited, List<Integer> order) {
    if (visited.contains(node)) return;
    visited.add(node);
    order.add(node);
    for (int neighbor : graph.getOrDefault(node, List.of())) {
        dfs(graph, neighbor, visited, order);
    }
}

// Iterative — using an explicit stack (see linear_structures.md)
List<Integer> dfsIterative(Map<Integer, List<Integer>> graph, int start) {
    List<Integer> order = new ArrayList<>();
    Set<Integer> visited = new HashSet<>();
    Deque<Integer> stack = new ArrayDeque<>();
    stack.push(start);

    while (!stack.isEmpty()) {
        int node = stack.pop();
        if (visited.contains(node)) continue;
        visited.add(node);
        order.add(node);
        for (int neighbor : graph.getOrDefault(node, List.of())) {
            if (!visited.contains(neighbor)) stack.push(neighbor);
        }
    }
    return order;
}
```

**BFS vs DFS — when to use which:**

| Need | Use |
|---|---|
| Shortest path (unweighted) | BFS |
| Any path / does a path exist | Either (DFS often simpler to write recursively) |
| Explore all possibilities exhaustively (e.g., maze solving, connected components) | Either |
| Detecting cycles | DFS (using a "currently in recursion stack" marker — see below) |
| Topological sort | DFS (or Kahn's BFS-based algorithm — both are standard) |
| Level-by-level processing | BFS |

## Cycle detection

```java
// Directed graph cycle detection — needs THREE states, not just visited/unvisited
boolean hasCycleDirected(Map<Integer, List<Integer>> graph, int n) {
    int[] state = new int[n];   // 0 = unvisited, 1 = in current DFS path, 2 = fully processed
    for (int i = 0; i < n; i++) {
        if (state[i] == 0 && dfsCycleCheck(graph, i, state)) return true;
    }
    return false;
}

private boolean dfsCycleCheck(Map<Integer, List<Integer>> graph, int node, int[] state) {
    state[node] = 1;   // mark as "in progress"
    for (int neighbor : graph.getOrDefault(node, List.of())) {
        if (state[neighbor] == 1) return true;         // back edge to an ancestor — CYCLE
        if (state[neighbor] == 0 && dfsCycleCheck(graph, neighbor, state)) return true;
    }
    state[node] = 2;   // mark as fully processed
    return false;
}
```

**A simple "visited" boolean set is NOT enough for directed-graph cycle
detection** — a node visited via one path and later reached again via a
different, non-cyclic path would produce a false positive. The three-state
approach (unvisited / in-current-path / fully-done) correctly distinguishes "a
back edge to an ancestor" (a real cycle) from "reaching an already-fully-explored
node via a different path" (not a cycle). Undirected graphs are simpler — a
single visited set works, as long as you also track and ignore the edge back to
the immediate parent.

## Topological Sort — ordering with dependencies

```java
// Kahn's algorithm — BFS-based, using in-degree counting
List<Integer> topologicalSort(Map<Integer, List<Integer>> graph, int n) {
    int[] inDegree = new int[n];
    for (List<Integer> neighbors : graph.values()) {
        for (int neighbor : neighbors) inDegree[neighbor]++;
    }

    Deque<Integer> queue = new ArrayDeque<>();
    for (int i = 0; i < n; i++) if (inDegree[i] == 0) queue.offer(i);

    List<Integer> order = new ArrayList<>();
    while (!queue.isEmpty()) {
        int node = queue.poll();
        order.add(node);
        for (int neighbor : graph.getOrDefault(node, List.of())) {
            if (--inDegree[neighbor] == 0) queue.offer(neighbor);
        }
    }

    return order.size() == n ? order : List.of();   // empty result signals a cycle exists
}
```

The classic real-world framing: **course scheduling with prerequisites**, build
dependency resolution, task scheduling — any "must happen before" ordering
problem. If the resulting order has fewer nodes than the graph, a cycle exists
and no valid ordering is possible.

## Dijkstra's Algorithm — shortest path, non-negative weights

```java
int[] dijkstra(Map<Integer, List<Edge>> graph, int start, int n) {
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[start] = 0;

    PriorityQueue<int[]> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a[1]));   // [node, distance]
    pq.offer(new int[]{start, 0});

    while (!pq.isEmpty()) {
        int[] current = pq.poll();
        int node = current[0], d = current[1];
        if (d > dist[node]) continue;   // stale entry — a shorter path to this node was already found

        for (Edge edge : graph.getOrDefault(node, List.of())) {
            int newDist = dist[node] + edge.weight();
            if (newDist < dist[edge.to()]) {
                dist[edge.to()] = newDist;
                pq.offer(new int[]{edge.to(), newDist});
            }
        }
    }
    return dist;
}
```

Dijkstra's is essentially BFS generalized to weighted edges, using a min-heap
(via `PriorityQueue`) instead of a plain queue to always process the currently-
closest unvisited node next. **Requires non-negative edge weights** — a negative
edge can invalidate the greedy "closest first" assumption the algorithm relies
on. Time complexity O((V + E) log V) with a binary heap.

## Bellman-Ford — shortest path, handles negative weights

```java
int[] bellmanFord(List<Edge3> edges, int n, int start) {   // Edge3 = record(from, to, weight)
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[start] = 0;

    for (int i = 0; i < n - 1; i++) {              // relax all edges V-1 times
        for (Edge3 e : edges) {
            if (dist[e.from()] != Integer.MAX_VALUE && dist[e.from()] + e.weight() < dist[e.to()]) {
                dist[e.to()] = dist[e.from()] + e.weight();
            }
        }
    }

    for (Edge3 e : edges) {                         // one more pass detects negative cycles
        if (dist[e.from()] != Integer.MAX_VALUE && dist[e.from()] + e.weight() < dist[e.to()]) {
            throw new IllegalStateException("Graph contains a negative-weight cycle");
        }
    }
    return dist;
}
```

**Use Bellman-Ford instead of Dijkstra specifically when negative edge weights
are possible** — slower (O(V·E) vs Dijkstra's O((V+E) log V)) but correct in
that case, and it can also detect negative cycles, which Dijkstra cannot handle
at all.

## Minimum Spanning Tree (MST) — Union-Find + Kruskal's

```java
class UnionFind {
    private final int[] parent, rank;

    UnionFind(int n) {
        parent = new int[n];
        rank = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;
    }

    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);   // path compression
        return parent[x];
    }

    boolean union(int x, int y) {
        int rootX = find(x), rootY = find(y);
        if (rootX == rootY) return false;   // already connected — would form a cycle
        if (rank[rootX] < rank[rootY]) { int tmp = rootX; rootX = rootY; rootY = tmp; }
        parent[rootY] = rootX;
        if (rank[rootX] == rank[rootY]) rank[rootX]++;
        return true;
    }
}

int kruskalMST(List<Edge3> edges, int n) {
    edges.sort(Comparator.comparingInt(Edge3::weight));
    UnionFind uf = new UnionFind(n);
    int totalWeight = 0, edgesUsed = 0;

    for (Edge3 e : edges) {
        if (uf.union(e.from(), e.to())) {   // only add the edge if it doesn't form a cycle
            totalWeight += e.weight();
            edgesUsed++;
            if (edgesUsed == n - 1) break;   // an MST always has exactly n-1 edges
        }
    }
    return totalWeight;
}
```

**Union-Find (Disjoint Set Union)** with path compression and union-by-rank
gives near-O(1) amortized `find`/`union` operations — this is the standard
structure underlying Kruskal's MST algorithm, and also solves "connected
components," "detect cycle in undirected graph," and "accounts merging"-style
problems directly.

## Practical guidance

1. **Default to adjacency-list representation** unless the graph is genuinely
   dense or you need O(1) edge existence checks.
2. **BFS for unweighted shortest path; Dijkstra for weighted non-negative;
   Bellman-Ford when negative weights are possible.**
3. **Mark nodes visited at enqueue time in BFS**, not at dequeue time.
4. **Use the three-state approach for directed-graph cycle detection** — a
   simple visited set is insufficient and will produce false positives.
5. **Recognize Union-Find as the right tool** for connected-components, MST, and
   "will adding this edge create a cycle" problems.