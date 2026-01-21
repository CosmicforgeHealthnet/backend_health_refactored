from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse
import logging

# Configure Logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    filename="service.log"
)
logger = logging.getLogger("AI_Service")

def add_exception_handlers(app: FastAPI):
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Global Error: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": "Internal Server Error",
                "detail": str(exc)
            }
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        logger.warning(f"Validation Error: {str(exc)}")
        return JSONResponse(
            status_code=400,
            content={
                "status": "fail",
                "message": "Validation Error",
                "detail": str(exc)
            }
        )
