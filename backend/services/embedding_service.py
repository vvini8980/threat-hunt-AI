import os
import asyncio
import google.generativeai as genai
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class EmbeddingService:
    def __init__(self):
        self.model = "models/text-embedding-004"

    async def embed_text(self, text: str) -> list[float]:
        try:
            # Using async natively if supported, fallback to thread
            try:
                response = await genai.embed_content_async(
                    model=self.model,
                    content=text
                )
            except AttributeError:
                response = await asyncio.to_thread(
                    genai.embed_content,
                    model=self.model,
                    content=text
                )
            return response['embedding']
        except Exception as e:
            if "429" in str(e):
                print("Rate limit hit (429) for Gemini API. Sleeping 60 seconds...")
                await asyncio.sleep(60)
                try:
                    try:
                        response = await genai.embed_content_async(
                            model=self.model,
                            content=text
                        )
                    except AttributeError:
                        response = await asyncio.to_thread(
                            genai.embed_content,
                            model=self.model,
                            content=text
                        )
                    return response['embedding']
                except Exception as retry_e:
                    raise HTTPException(status_code=503, detail="Gemini embedding service unavailable after retry.")
            else:
                raise HTTPException(status_code=503, detail=f"Gemini API error: {str(e)}")

    async def embed_batch(self, texts: list[str], delay: float = 0.5) -> list[list[float]]:
        embeddings = []
        for i, text in enumerate(texts):
            emb = await self.embed_text(text)
            embeddings.append(emb)
            
            if (i + 1) % 100 == 0:
                print(f"Progress: Embedded {i + 1} / {len(texts)} items")
            
            if i < len(texts) - 1:
                await asyncio.sleep(delay)
                
        return embeddings

embedding_service = EmbeddingService()
