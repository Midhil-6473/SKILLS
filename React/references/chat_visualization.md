# Data Visualization for ML/Analytics Dashboards

## Common chart libraries for React

| Library | Best for |
|---|---|
| **Recharts** | Standard charts (line, bar, area) with a clean declarative React API — the default choice for most dashboards |
| **Chart.js** (via `react-chartjs-2`) | Similar scope to Recharts, imperative-canvas-based, slightly better performance at very high data density |
| **D3.js** | Fully custom/novel visualizations (embeddings, network graphs) where no off-the-shelf chart fits |
| **Plotly** | Scientific/statistical plots (3D scatter, contour plots), interactive zoom/pan out of the box |
| **visx** (Airbnb) | Low-level D3-powered primitives with React idioms — a middle ground between Recharts and raw D3 |

**Default recommendation:** Recharts for standard dashboards; drop to D3/visx only for
genuinely custom visualizations (embedding scatter plots, attention maps) that don't
fit a standard chart type.

## Live training curves (loss/accuracy over epochs)

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function TrainingCurve({ history }) {
  // history: [{ epoch: 1, train_loss: 0.8, val_loss: 0.75 }, ...]
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={history}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="epoch" label={{ value: "Epoch", position: "insideBottom", offset: -5 }} />
        <YAxis label={{ value: "Loss", angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="train_loss" stroke="#8884d8" dot={false} />
        <Line type="monotone" dataKey="val_loss" stroke="#82ca9d" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Streaming updates during training (see `realtime_jobs.md` for the WebSocket/SSE side)

```jsx
function LiveTrainingMonitor({ jobId }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/training/${jobId}/stream`);
    eventSource.onmessage = (e) => {
      const epochData = JSON.parse(e.data);
      setHistory((prev) => [...prev, epochData]);
    };
    return () => eventSource.close();
  }, [jobId]);

  return <TrainingCurve history={history} />;
}
```

Standard `EventSource` (GET-based) works well here since training progress streams
don't need a request body — a genuine fit for the simpler native browser API rather
than needing `fetch`-based SSE.

## Confusion matrix

```jsx
function ConfusionMatrix({ matrix, labels }) {
  const max = Math.max(...matrix.flat());
  return (
    <table className="confusion-matrix">
      <thead>
        <tr><th></th>{labels.map((l) => <th key={l}>{l}</th>)}</tr>
      </thead>
      <tbody>
        {matrix.map((row, i) => (
          <tr key={i}>
            <th>{labels[i]}</th>
            {row.map((value, j) => (
              <td key={j} style={{ backgroundColor: `rgba(59,130,246,${value / max})` }}>
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

A simple HTML table with background-color intensity mapped to cell value is often
clearer than a "fancy" heatmap library for this specific, well-understood chart type.

## ROC curve / precision-recall curve

```jsx
import { LineChart, Line, XAxis, YAxis, ReferenceLine } from "recharts";

function ROCCurve({ points, auc }) {
  // points: [{ fpr: 0, tpr: 0 }, { fpr: 0.1, tpr: 0.4 }, ...]
  return (
    <div>
      <p>AUC: {auc.toFixed(3)}</p>
      <LineChart width={400} height={400} data={points}>
        <XAxis dataKey="fpr" domain={[0, 1]} label="False Positive Rate" />
        <YAxis domain={[0, 1]} label="True Positive Rate" />
        <Line type="monotone" dataKey="tpr" stroke="#8884d8" dot={false} />
        <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#ccc" strokeDasharray="3 3" />
      </LineChart>
    </div>
  );
}
```

## Feature importance / SHAP values

```jsx
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts";

function FeatureImportance({ features }) {
  // features: [{ name: "age", importance: 0.34 }, ...], sorted descending
  return (
    <BarChart layout="vertical" width={500} height={features.length * 30} data={features}>
      <XAxis type="number" />
      <YAxis type="category" dataKey="name" width={100} />
      <Bar dataKey="importance">
        {features.map((f, i) => (
          <Cell key={i} fill={f.importance > 0 ? "#22c55e" : "#ef4444"} />
        ))}
      </Bar>
    </BarChart>
  );
}
```

## Visualizing embeddings (2D projection scatter plot)

Embeddings are high-dimensional (e.g., 1536-D from OpenAI, 768-D from many
open-source models) — visualize them by first reducing to 2D server-side (t-SNE,
UMAP, or PCA in Python), then rendering a simple scatter plot in React:

```python
# Backend: reduce dimensionality before sending to frontend
from sklearn.manifold import TSNE

def project_embeddings(embeddings: list[list[float]]) -> list[dict]:
    coords = TSNE(n_components=2, random_state=42).fit_transform(np.array(embeddings))
    return [{"x": float(x), "y": float(y)} for x, y in coords]
```

```jsx
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip } from "recharts";

function EmbeddingScatterPlot({ points }) {
  // points: [{ x, y, label, category }]
  const categories = [...new Set(points.map((p) => p.category))];
  return (
    <ScatterChart width={600} height={500}>
      <XAxis type="number" dataKey="x" hide />
      <YAxis type="number" dataKey="y" hide />
      <Tooltip content={({ payload }) => payload?.[0] && <div>{payload[0].payload.label}</div>} />
      {categories.map((cat) => (
        <Scatter key={cat} name={cat} data={points.filter((p) => p.category === cat)} fill={colorFor(cat)} />
      ))}
    </ScatterChart>
  );
}
```

**Never run t-SNE/UMAP in the browser** — these are computationally expensive
algorithms meant for offline/server-side batch processing; send only the final 2D/3D
coordinates to the frontend.

## Real-time inference metrics dashboard

```jsx
function InferenceMetricsDashboard({ metrics }) {
  // metrics: { requestsPerMinute, avgLatencyMs, errorRate, p95LatencyMs }
  return (
    <div className="metrics-grid">
      <MetricCard label="Requests/min" value={metrics.requestsPerMinute} />
      <MetricCard label="Avg Latency" value={`${metrics.avgLatencyMs}ms`} />
      <MetricCard label="p95 Latency" value={`${metrics.p95LatencyMs}ms`} />
      <MetricCard label="Error Rate" value={`${(metrics.errorRate * 100).toFixed(2)}%`}
        variant={metrics.errorRate > 0.05 ? "warning" : "default"} />
    </div>
  );
}
```

Poll this on an interval (e.g., every 5-10 seconds) rather than streaming — dashboard
metrics don't need per-event granularity the way a training curve or chat response
does.

## Practical guidance

1. **Recharts by default; D3/visx only for genuinely custom visualizations** that
   don't map to a standard chart type.
2. **Reduce dimensionality (t-SNE/UMAP/PCA) server-side, always** — never in the
   browser.
3. **Stream training curves via SSE** (native `EventSource` works fine here since it's
   GET-based with no request body needed); **poll for dashboard-style summary
   metrics** rather than streaming every event.
4. **Simple HTML tables with color-intensity mapping** often communicate a confusion
   matrix better than a generic heatmap component.