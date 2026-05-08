from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import optimize, export, health

app = FastAPI(title="SOP AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(optimize.router, prefix="/ai", tags=["AI Optimization"])
app.include_router(export.router, prefix="/export", tags=["Export"])
app.include_router(health.router, prefix="/health", tags=["Health"])

@app.get("/")
async def root():
    return {"message": "SOP AI Service is running"}
