from datetime import datetime
from fhir.resources.questionnaireresponse import QuestionnaireResponse, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer
from fhir.resources.patient import Patient
from fhir.resources.observation import Observation
import uuid

class FHIRConverter:
    @staticmethod
    def create_patient_intake_response(data: dict) -> QuestionnaireResponse:
        """
        Converts raw intake form JSON into a FHIR QuestionnaireResponse.
        """
        items = []
        
        # Helper to add items
        def add_item(link_id, text, answer_value):
            if answer_value:
                items.append(QuestionnaireResponseItem(
                    linkId=link_id,
                    text=text,
                    answer=[QuestionnaireResponseItemAnswer(valueString=str(answer_value))]
                ))

        # Mapping standard fields
        add_item("medical_history", "Medical History", data.get("medicalHistory"))
        add_item("symptoms", "Current Symptoms", data.get("symptoms"))
        add_item("lifestyle", "Lifestyle Info", str(data.get("lifestyle")))

        response = QuestionnaireResponse(
            status="completed",
            subject={"reference": f"Patient/{data.get('patientId')}"},
            authored=datetime.now().isoformat(),
            item=items
        )
        return response

    @staticmethod
    def create_vitals_observation(patient_id: str, vital_type: str, value: float, unit: str) -> Observation:
        """
        Creates a FHIR Observation for vitals (BP, BMI, etc.)
        """
        return Observation(
            status="final",
            code={
                "coding": [{
                    "system": "http://loinc.org",
                    "code": vital_type, 
                    "display": vital_type 
                }]
            },
            subject={"reference": f"Patient/{patient_id}"},
            valueQuantity={
                "value": value,
                "unit": unit,
                "system": "http://unitsofmeasure.org"
            },
            effectiveDateTime=datetime.now().isoformat()
        )
