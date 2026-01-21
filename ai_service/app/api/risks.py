from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from app.services.risk_models import RiskEngine

router = APIRouter()

class RiskAnalysisRequest(BaseModel):
    patientId: str = Field(..., description="The unique identifier of the patient.", example="uuid-1234-5678")
    age: int = Field(..., ge=0, le=120, description="Patient age in years.", example=45)
    gender: str = Field(..., description="Patient gender (male/female/other).", example="male")
    systolic_bp: Optional[int] = Field(120, description="Systolic Blood Pressure (mmHg).", example=135)
    bmi: Optional[float] = Field(22.0, description="Body Mass Index.", example=28.5)
    smoker: Optional[bool] = Field(False, description="Whether the patient is a current smoker.", example=True)
    family_diabetes: Optional[bool] = Field(False, description="Family history of diabetes.", example=False)

class RiskAnalysisResponse(BaseModel):
    status: str
    patientId: str
    results: Dict[str, Any]

@router.post("/calculate", response_model=RiskAnalysisResponse, summary="Calculate Health Risks", description="Computes risk scores for Cardiovascular Disease (QRISK3-mock) and Diabetes (FINDRISC-mock) based on patient profile.")
async def calculate_risk(
    request: RiskAnalysisRequest = Body(..., example={
        "patientId": "p-101",
        "age": 55,
        "gender": "male",
        "systolic_bp": 145,
        "bmi": 31.2,
        "smoker": True,
        "family_diabetes": True
    })
):
    """
    **Calculates health risks** based on:
    - Demographic data (Age, Gender)
    - Clinical Vitals (BP, BMI)
    - Lifestyle Factors (Smoking, History)
    
    Returns detailed risk contribution vectors and actionable recommendations.
    """
    try:
        profile = request.dict()
        
        cvd_risk = RiskEngine.calculate_cvd_risk(profile)
        diabetes_risk = RiskEngine.calculate_diabetes_risk(profile)
        
        return {
            "status": "success",
            "patientId": request.patientId,
            "results": {
                "cardiovascular": cvd_risk,
                "diabetes": diabetes_risk
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
