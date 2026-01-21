from typing import Dict, List, Any

class RiskEngine:
    @staticmethod
    def calculate_cvd_risk(profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mock implementation of QRISK3 (Cardiovascular Disease Risk).
        Returns a risk score 0-100 and contributing factors.
        
        Real implementation would use coefficients based on:
        - Age, Gender, Ethnicity
        - Smoking, Diabetes, Family History
        - Systolic BP, BMI/Ratio
        """
        score = 0
        factors = []
        recommendations = []

        # 1. Age Factor (Simplified)
        age = profile.get("age", 0)
        if age > 40:
            score += (age - 40) * 0.5
            factors.append("Age > 40")

        # 2. Vitals
        sbp = profile.get("systolic_bp", 120)
        if sbp > 140:
            score += 10
            factors.append(f"Systolic BP High ({sbp})")
            recommendations.append("Consult a doctor about managing blood pressure.")

        bmi = profile.get("bmi", 22)
        if bmi > 30:
            score += 8
            factors.append(f"Obesity (BMI {bmi})")
            recommendations.append("Consider a diet and exercise plan to reduce BMI.")

        # 3. Lifestyle
        if profile.get("smoker", False):
            score += 15
            factors.append("Smoking")
            recommendations.append("Stop smoking program recommended.")

        # Cap score
        score = min(score, 100)
        
        risk_level = "Low"
        if score > 10: risk_level = "Moderate"
        if score > 20: risk_level = "High"

        return {
            "model": "QRISK3-Mock",
            "score": round(score, 1),
            "risk_level": risk_level,
            "vectors": factors,
            "recommendations": recommendations,
            "explanation": f"Risk calculated based on {', '.join(factors) if factors else 'basic profile'}."
        }

    @staticmethod
    def calculate_diabetes_risk(profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mock implementation of FINDRISC (Type 2 Diabetes Risk).
        """
        score = 0
        factors = []
        
        # BMI
        bmi = profile.get("bmi", 22)
        if bmi > 30: 
            score += 5
            factors.append("High BMI")
        elif bmi > 25:
            score += 2
            factors.append("Overweight")

        # Age
        age = profile.get("age", 0)
        if age > 45: 
            score += 4
            factors.append("Age > 45")
            
        # Family History
        if profile.get("family_diabetes", False):
            score += 5
            factors.append("Family History")

        risk_level = "Low"
        if score > 14: risk_level = "High"
        elif score > 7: risk_level = "Moderate"

        return {
            "model": "FINDRISC-Mock",
            "score": score,
            "risk_level": risk_level,
            "vectors": factors
        }
