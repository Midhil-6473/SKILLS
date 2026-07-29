# Loading Data & Working with Documents/Nodes

## The loading pipeline

```
Raw Data Sources → Readers/Connectors → Documents → Transformations → Nodes → Index
```

## SimpleDirectoryReader — the default loader

Reads all files from a directory (auto-detects Markdown, PDFs, Word, PowerPoint, images, etc.):

```python
from llama_index.core import SimpleDirectoryReader

# All files in ./data/
documents = SimpleDirectoryReader("./data").load_data()

# With progress bar
documents = SimpleDirectoryReader("./data", show_progress=True).load_data()

# Specific files or extensions
documents = SimpleDirectoryReader(
    input_dir="./data",
    required_exts=[".pdf", ".md"],
    recursive=True
).load_data()
```

## LlamaHub — 160+ connectors

Community-maintained connectors for databases, APIs, cloud storage, etc.:

```bash
# LlamaHub connectors are pip-installable separate packages
pip install llama-index-readers-web            # web pages
pip install llama-index-readers-database       # SQL databases
pip install llama-index-readers-notion         # Notion
pip install llama-index-readers-slack          # Slack
pip install llama-index-readers-s3             # AWS S3
pip install llama-index-readers-google         # Google Drive, Docs, Sheets
```

```python
from llama_index.readers.web import SimpleWebPageReader

documents = SimpleWebPageReader(html_to_text=True).load_data(
    urls=["https://example.com/docs"]
)
```

Browse all connectors: `llamahub.ai`

## LlamaParse — enterprise document parsing

LlamaIndex's own VLM-powered parser for complex PDFs (nested tables, charts, embedded images).
Far superior to basic text extraction for real-world enterprise docs.

```bash
pip install llama-parse
```

```python
import os
from llama_parse import LlamaParse

os.environ["LLAMA_CLOUD_API_KEY"] = "llx-..."

parser = LlamaParse(
    result_type="markdown",      # or "text"
    verbose=True,
)
documents = await parser.aload_data("complex_report.pdf")
```

Get API key at `cloud.llamaindex.ai`. 10,000 free credits/month.

## Document object — anatomy

```python
from llama_index.core import Document

doc = Document(
    text="The quick brown fox...",
    metadata={
        "filename": "fox.txt",
        "category": "animals",
        "date": "2026-01-15",
    },
    doc_id="fox_001",                    # optional, auto-generated if omitted
    excluded_llm_metadata_keys=["date"], # don't send these fields to the LLM
    excluded_embed_metadata_keys=[],     # don't embed these fields
)
```

## Splitting Documents into Nodes

Nodes are the atomic retrieval units. Quality of chunking directly determines retrieval quality.

### Core splitters

```python
from llama_index.core.node_parser import (
    SentenceSplitter,           # Respects sentence boundaries (recommended default)
    TokenTextSplitter,          # Splits by token count
    SemanticSplitterNodeParser, # LLM-guided semantic boundaries (most expensive, best quality)
    SentenceWindowNodeParser,   # Each sentence as node + context window around it
    HierarchicalNodeParser,     # Multiple granularities (doc → section → sentence)
    MarkdownNodeParser,         # Respects Markdown headers/structure
    JSONNodeParser,             # For JSON data
    CodeSplitter,               # Language-aware code chunking
)
```

### SentenceSplitter — recommended starting point

```python
from llama_index.core.node_parser import SentenceSplitter

parser = SentenceSplitter(
    chunk_size=512,       # tokens per chunk (not characters!)
    chunk_overlap=50,     # overlap between consecutive chunks
    separator=" ",        # split boundary fallback
)
nodes = parser.get_nodes_from_documents(documents)
```

**Chunk size guidance:**
- `256–512` tokens → precise retrieval, more chunks, more API calls, better for technical docs
- `512–1024` tokens → balanced (default 1024 is often too large)
- `1024–2048` tokens → broader context, fewer chunks, better for narrative/prose
- Always overlap 5–10% of chunk size to avoid breaking context at boundaries

### SemanticSplitterNodeParser — LLM-guided semantic splits

```python
from llama_index.core.node_parser import SemanticSplitterNodeParser
from llama_index.embeddings.openai import OpenAIEmbedding

semantic_parser = SemanticSplitterNodeParser(
    buffer_size=1,
    breakpoint_percentile_threshold=95,
    embed_model=OpenAIEmbedding(),
)
nodes = semantic_parser.get_nodes_from_documents(documents)
```

Uses embedding distance to find natural breakpoints. Best quality, highest cost.

### SentenceWindowNodeParser — small chunks + context

Stores each sentence as a node but adds a window of surrounding sentences as metadata.
Retrieval finds the precise sentence; the LLM sees surrounding context.

```python
from llama_index.core.node_parser import SentenceWindowNodeParser
from llama_index.core.postprocessor import MetadataReplacementPostProcessor

sentence_parser = SentenceWindowNodeParser.from_defaults(
    window_size=3,              # sentences on each side
    window_metadata_key="window",
    original_text_metadata_key="original_text",
)
nodes = sentence_parser.get_nodes_from_documents(documents)

# At query time, replace the node text with the window:
postprocessor = MetadataReplacementPostProcessor(target_metadata_key="window")
query_engine = index.as_query_engine(node_postprocessors=[postprocessor])
```

### HierarchicalNodeParser — multi-level chunks

Creates nodes at multiple sizes (e.g., 2048 → 512 → 128 tokens). Retrieve small precise
chunks but send larger parent context to the LLM.

```python
from llama_index.core.node_parser import HierarchicalNodeParser, get_leaf_nodes
from llama_index.core.retrievers import AutoMergingRetriever

parser = HierarchicalNodeParser.from_defaults(
    chunk_sizes=[2048, 512, 128]
)
all_nodes = parser.get_nodes_from_documents(documents)
leaf_nodes = get_leaf_nodes(all_nodes)   # 128-token nodes for indexing

index = VectorStoreIndex(leaf_nodes, storage_context=storage_context)
retriever = AutoMergingRetriever(
    index.as_retriever(similarity_top_k=6),
    storage_context=storage_context,
    verbose=True,
)
```

The `AutoMergingRetriever` upgrades small retrieved chunks to their parent nodes when
a threshold fraction of sibling nodes are also retrieved.

## IngestionPipeline — production ingestion

The recommended approach for production. Runs transformations as a pipeline,
supports caching, async, and deduplication.

```python
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.extractors import TitleExtractor, QuestionsAnsweredExtractor
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore
import chromadb

chroma_client = chromadb.PersistentClient(path="./chroma_db")
chroma_collection = chroma_client.get_or_create_collection("my_docs")
vector_store = ChromaVectorStore(chroma_collection=chroma_collection)

pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512, chunk_overlap=50),
        TitleExtractor(nodes=5),           # Extracts title from top nodes
        QuestionsAnsweredExtractor(questions=3),  # Generates Q's each node answers
        OpenAIEmbedding(model="text-embedding-3-small"),  # Embed last
    ],
    vector_store=vector_store,
    docstore=SimpleDocumentStore(),   # For deduplication
)

nodes = await pipeline.arun(documents=documents, num_workers=4)
```

Pipelines are idempotent — they skip already-processed nodes (via docstore). Use `num_workers`
for parallel embedding.

## Metadata extraction

LLM-powered metadata makes retrieval dramatically better:

```python
from llama_index.core.extractors import (
    TitleExtractor,
    SummaryExtractor,
    QuestionsAnsweredExtractor,
    KeywordExtractor,
    EntityExtractor,
)
```

`QuestionsAnsweredExtractor` stores questions a node can answer as metadata — the query
engine then filters by those questions before semantic search.

## Creating nodes manually

```python
from llama_index.core.schema import TextNode

node = TextNode(
    text="This is the content of this chunk.",
    metadata={"filename": "doc.txt", "page": 1},
    id_="unique_node_id",
)

# Build index from hand-crafted nodes
index = VectorStoreIndex(nodes=[node1, node2, node3])
```