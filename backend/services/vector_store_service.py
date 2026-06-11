import os
import chromadb
from chromadb.config import Settings

# Backend root is one level up from services
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "vector_db")

class VectorStoreService:
    def __init__(self):
        # Ensure directory exists
        os.makedirs(DB_PATH, exist_ok=True)
        # Initialize persistent client
        self.client = chromadb.PersistentClient(
            path=DB_PATH,
            settings=Settings(anonymized_telemetry=False)
        )

    def get_or_create_collection(self, name: str) -> chromadb.Collection:
        # Use cosine similarity for the vector space
        return self.client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"}
        )

    def add_documents(self, collection_name: str, documents: list[dict], embeddings: list[list[float]]):
        if not documents:
            return
            
        collection = self.get_or_create_collection(collection_name)
        
        ids = [doc["id"] for doc in documents]
        texts = [doc["text"] for doc in documents]
        metadatas = [doc.get("metadata", {}) for doc in documents]
        
        # Upsert will automatically update if the id exists, or insert if it doesn't
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )

    def query(self, collection_name: str, query_embedding: list[float], n_results: int = 5, filters: dict = None) -> list[dict]:
        collection = self.get_or_create_collection(collection_name)
        
        # Query chromadb using the pre-computed embedding
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=filters if filters else None,
            include=["documents", "metadatas", "distances"]
        )
        
        # Format the output cleanly
        formatted_results = []
        if results['ids'] and len(results['ids']) > 0:
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "text": results['documents'][0][i] if results['documents'] else None,
                    "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                    "distance": results['distances'][0][i] if results['distances'] else None
                })
                
        return formatted_results

    def delete_collection(self, name: str):
        try:
            self.client.delete_collection(name)
        except ValueError:
            pass

vector_store = VectorStoreService()
