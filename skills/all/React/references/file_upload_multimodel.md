# File/Image/Audio Upload for Vision & Multimodal Models

## The upload pipeline

```
React: select/drop file → client-side validation/resize → upload with progress →
FastAPI: validate → preprocess → run inference → return result
```

## Drag-and-drop file input (React)

```bash
npm install react-dropzone
```

```jsx
import { useDropzone } from "react-dropzone";

function ImageUploader({ onFileSelected }) {
  const [preview, setPreview] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onFileSelected(file);
  }, [onFileSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxSize: 10 * 1024 * 1024,  // 10MB
    multiple: false,
  });

  return (
    <div {...getRootProps()} className={isDragActive ? "dropzone dropzone--active" : "dropzone"}>
      <input {...getInputProps()} />
      {preview ? <img src={preview} alt="preview" /> : <p>Drag an image, or click to select</p>}
    </div>
  );
}
```

**Always revoke object URLs** to avoid memory leaks when swapping previews:

```jsx
useEffect(() => {
  return () => { if (preview) URL.revokeObjectURL(preview); };
}, [preview]);
```

## Client-side image resizing before upload

Resizing large images client-side reduces upload time and server load — most vision
models don't need (and won't benefit from) a 12MP photo when they'll resize internally
anyway.

```jsx
async function resizeImage(file, maxDimension = 1024) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}
```

## Upload with progress (using `XMLHttpRequest` for progress events)

`fetch` doesn't natively expose upload progress — use `XMLHttpRequest` or a library
like `axios` when you need a progress bar:

```jsx
function uploadWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.response));
      else reject(new Error(`Upload failed: ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.open("POST", "/api/classify-image");
    xhr.send(formData);
  });
}
```

```jsx
function ImageClassifier() {
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const handleFile = async (file) => {
    const resized = await resizeImage(file);
    const response = await uploadWithProgress(resized, setProgress);
    setResult(response);
  };
  // ... render progress bar + result
}
```

## FastAPI: receiving file uploads

```python
from fastapi import FastAPI, UploadFile, File, HTTPException

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

@app.post("/api/classify-image")
async def classify_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large (max 10MB)")

    image = Image.open(io.BytesIO(contents)).convert("RGB")
    result = run_inference(image)
    return result
```

**Always validate both `content_type` and actual file size server-side** — never
trust client-side validation alone, since it's trivially bypassed by anyone calling
the API directly.

## Multiple file upload (batch inference)

```jsx
function BatchUploader({ onFilesSelected }) {
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: onFilesSelected,
    accept: { "image/*": [] },
    multiple: true,
    maxFiles: 20,
  });
  return <div {...getRootProps()}><input {...getInputProps()} /></div>;
}
```

```python
@app.post("/api/classify-batch")
async def classify_batch(files: list[UploadFile] = File(...)):
    results = []
    for file in files:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        results.append(run_inference(image))
    return {"results": results}
```

For large batches, consider processing server-side with `asyncio.gather` (for I/O-bound
preprocessing) or offloading to a background job queue (see `realtime_jobs.md`) rather
than blocking a single request for a very large batch.

## Audio upload (for speech-to-text / audio classification models)

```jsx
function AudioRecorder({ onRecordingComplete }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      onRecordingComplete(blob);
      chunksRef.current = [];
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <button onClick={recording ? stopRecording : startRecording}>
      {recording ? "Stop Recording" : "Start Recording"}
    </button>
  );
}
```

```python
@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    # Pass to a speech-to-text model (Whisper, provider API, etc.)
    transcript = run_transcription(audio_bytes)
    return {"transcript": transcript}
```

## Multimodal chat (image + text in the same message)

```jsx
function MultimodalInput({ onSend }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);

  const handleSend = async () => {
    const base64Images = await Promise.all(images.map(fileToBase64));
    onSend({ text, images: base64Images });
  };
  // ... render text input + image previews + send button
}

async function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);  // strip data URL prefix
    reader.readAsDataURL(file);
  });
}
```

```python
class MultimodalMessage(BaseModel):
    text: str
    images: list[str] = []  # base64-encoded

@app.post("/api/chat/multimodal")
async def multimodal_chat(message: MultimodalMessage):
    content = [{"type": "text", "text": message.text}]
    for img_b64 in message.images:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}})

    response = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=1024,
        messages=[{"role": "user", "content": content}],
    )
    return {"content": response.content[0].text}
```

## Practical guidance

1. **Resize images client-side before upload** — reduces latency and server load with
   no accuracy cost for most vision models.
2. **Validate file type and size on both client and server** — client-side is UX,
   server-side is the actual security boundary.
3. **Revoke object URLs (`URL.revokeObjectURL`)** when previews are replaced, to
   avoid memory leaks in long-lived sessions.
4. **Use `XMLHttpRequest` (or a library like axios) instead of `fetch`** when you
   need upload progress — `fetch` doesn't expose upload progress events natively.
5. **For batch/large uploads, offload to a background job** rather than blocking a
   single synchronous request — see `realtime_jobs.md`.