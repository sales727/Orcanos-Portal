import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import dms, bulk_updater

app = FastAPI(title="Orcanos Automation Portal API", version="1.0.0")

_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
origins = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dms.router)
app.include_router(bulk_updater.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
