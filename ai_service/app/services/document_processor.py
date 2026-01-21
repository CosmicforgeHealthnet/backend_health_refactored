import re

class DocumentProcessor:
    @staticmethod
    def extract_text_from_file(file_content: bytes, filename: str) -> str:
        """
        Stub for OCR. In production, use pytesseract or Textract.
        For now, returns dummy text if not a text file.
        """
        # Simple simulation
        return """
        LAB REPORT
        Patient: John Doe
        Date: 2026-01-15
        
        Results:
        Total Cholesterol: 240 mg/dL
        HDL: 40 mg/dL
        LDL: 180 mg/dL
        
        Notes: Patient advised to reduce saturated fats.
        """

    @staticmethod
    def extract_medical_entities(text: str) -> dict:
        """
        Simple NLP to find keywords like 'Cholesterol', 'BP', etc.
        """
        entities = {"vitals": [], "medications": []}
        
        # Regex for Cholesterol
        chol_match = re.search(r"Cholesterol:\s*(\d+)", text, re.IGNORECASE)
        if chol_match:
            entities["vitals"].append({
                "name": "Total Cholesterol",
                "value": float(chol_match.group(1)),
                "unit": "mg/dL"
            })

        return entities
