from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import httpx
import asyncio

router = APIRouter()

class OptimizeRequest(BaseModel):
    provider: str
    api_base_url: str
    api_key: str
    model_name: str
    prompt: str
    image_urls: List[str] = []
    optimization_type: str

class OptimizeResponse(BaseModel):
    result: str
    usage: Optional[dict] = None

@router.post("/optimize", response_model=OptimizeResponse)
async def optimize(req: OptimizeRequest):
    try:
        if req.provider in ['openai']:
            result = await call_openai_compatible(req)
        elif req.provider in ['zhipu', 'moonshot', 'deepseek', 'qwen', 'ernie']:
            result = await call_openai_compatible(req)
        else:
            result = await call_generic_api(req)
        return OptimizeResponse(result=result["text"], usage=result.get("usage"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def call_openai_compatible(req: OptimizeRequest):
    headers = {
        "Authorization": f"Bearer {req.api_key}",
        "Content-Type": "application/json",
    }

    messages = [{"role": "system", "content": "You are an expert SOP optimization assistant."}]
    if req.image_urls and req.optimization_type == "image_completion":
        content = [{"type": "text", "text": req.prompt}]
        for url in req.image_urls[:3]:
            content.append({"type": "image_url", "image_url": {"url": url}})
        messages.append({"role": "user", "content": content})
    else:
        messages.append({"role": "user", "content": req.prompt})

    payload = {
        "model": req.model_name,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2000,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        url = f"{req.api_base_url.rstrip('/')}/chat/completions"
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return {
            "text": data["choices"][0]["message"]["content"],
            "usage": data.get("usage"),
        }

async def call_generic_api(req: OptimizeRequest):
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            req.api_base_url,
            headers={"Authorization": f"Bearer {req.api_key}"},
            json={"prompt": req.prompt, "model": req.model_name},
        )
        resp.raise_for_status()
        data = resp.json()
        return {"text": data.get("result") or data.get("text") or str(data)}
