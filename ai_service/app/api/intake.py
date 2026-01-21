from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.services.fhir_layer import FHIRConverter

router = APIRouter()

class IntakeFormRequest(BaseModel):
    patientId: str
    formData: Dict[str, Any]

@router.post("/intake")
async def process_intake_form(request: IntakeFormRequest):
    """
    Receives Patient Intake Form -> Converts to FHIR -> Returns FHIR JSON
    """
    try:
        # 1. Convert to FHIR
        fhir_response = FHIRConverter.create_patient_intake_response({
            "patientId": request.patientId,
            **request.formData
        })
        
        return {
            "status": "success",
            "fhir_data": fhir_response.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
