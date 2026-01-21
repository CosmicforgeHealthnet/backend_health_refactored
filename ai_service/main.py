from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from app.api.routes import router as api_router
from app.core.errors import add_exception_handlers, logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Patient Intelligence Service...")
    yield
    # Shutdown (if needed)
    logger.info("Shutting down Patient Intelligence Service...")

app = FastAPI(
    title="CosmicForge Patient Intelligence API",
    description="""
    # Patient Intelligence Microservice
    
    This service provides advanced AI capabilities for the CosmicForge Health Platform, including:
    *   **Risk Modeling**: Predictive algorithms for CVD and Diabetes (QRISK3/FINDRISC).
    *   **Document Intelligence**: OCR and entity extraction for medical records.
    *   **FHIR Ingestion**: Standardization of patient intake forms.
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    root_path="/ai",  # ← Add this line
    contact={
        "name": "CosmicForge Team",
        "email": "support@cosmicforge.com",
    },
    license_info={
        "name": "Proprietary",
    },
)

add_exception_handlers(app)

# CORS (Allow Main Backend)
origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:5000", # Node backend often on 5000
    "*" # For development convenience
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

