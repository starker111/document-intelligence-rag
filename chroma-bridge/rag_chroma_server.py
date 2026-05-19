from fastapi import FastAPI, Request
import chromadb
import json

app = FastAPI()

client = chromadb.PersistentClient(path="./chroma-data")
collection = client.get_or_create_collection(name="docs")


def force_list(value):
    """
    n8n sometimes sends arrays as strings.
    This converts them back into real Python lists.
    """
    if isinstance(value, list):
        return value

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass

    return [value]


@app.post("/add")
async def add_documents(request: Request):
    data = await request.json()

    ids = force_list(data.get("ids"))
    documents = force_list(data.get("documents"))
    embeddings = force_list(data.get("embeddings"))
    metadatas = force_list(data.get("metadatas"))

    if not ids or not documents or not embeddings or not metadatas:
        return {
            "status": "error",
            "message": "Missing ids, documents, embeddings, or metadatas",
            "received": data
        }

    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )

    return {
        "status": "success",
        "added": len(ids)
    }


@app.post("/query")
async def query_documents(request: Request):
    data = await request.json()

    embedding = data.get("embedding")
    n_results = data.get("n_results", 3)

    if isinstance(embedding, str):
        embedding = json.loads(embedding)

    result = collection.query(
        query_embeddings=[embedding],
        n_results=n_results
    )

    return result


@app.get("/health")
def health():
    return {"status": "ok"}