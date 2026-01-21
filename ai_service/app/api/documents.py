from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.document_processor import DocumentProcessor
from typing import Dict, Any, List

router = APIRouter()

@router.post(
    "/document", 
    summary="Process Medical Document",
    description="Upload a medical document (PDF, Image) to extract clinical entities via OCR and NLP.",
    response_description="JSON object containing extracted text and identified entites (Medications, Conditions, Vitals)."
)
async def process_document(
    file: UploadFile = File(..., description="The medical document to analyze.")
):
    """
    **Extracts intelligence from documents.**
    
    Performs the following steps:
    1.  **OCR**: Extracts raw text from the uploaded file (PDF/Image).
    2.  **NER**: Identifies medical named entities (Dosages, Lab Results).
    3.  **Structuring**: Returns a structured JSON representation of the document.
    """
    try:
        content = await file.read()
        
        # 1. OCR (Stub)
        extracted_text = DocumentProcessor.extract_text_from_file(content, file.filename)
        
        # 2. NLP Extraction
        entities = DocumentProcessor.extract_medical_entities(extracted_text)
        
        return {
            "status": "success",
            "filename": file.filename,
            "extracted_text_preview": extracted_text[:100] + "...",
            "entities": entities
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
