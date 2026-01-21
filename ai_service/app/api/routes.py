from fastapi import APIRouter
from app.api import intake, risks, documents

router = APIRouter()

router.include_router(intake.router, prefix="/ingest", tags=["Ingestion"])
router.include_router(documents.router, prefix="/process", tags=["Processing"])
router.include_router(risks.router, prefix="/predict", tags=["Predictions"])

# Placeholder for now
@router.get("/test")
async def test_route():
    return {"message": "API Router Working"}
