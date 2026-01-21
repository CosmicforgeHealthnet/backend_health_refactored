# Patient Intelligence Microservice

Python-based microservice for **CosmicForge Health**, providing Advanced Risk Analytics, Medical Document Intelligence (OCR/NLP), and FHIR Standardization.

---

## 🚀 Getting Started

### Prerequisites
*   **Python 3.10+**
*   **Tesseract OCR** (Must be installed on the system path for OCR features)
*   **Node.js Backend** (Running on port 3000/5000 for full integration)

### Installation

1.  **Navigate to the service directory**
    ```bash
    cd ai_service
    ```

2.  **Create Virtual Environment**
    ```bash
    # Windows
    python -m venv venv
    .\venv\Scripts\Activate
    
    # Mac/Linux
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install Dependencies**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Download NLP Models**
    Required for Spacy (Medical Entity Extraction):
    ```bash
    python -m spacy download en_core_web_sm
    ```

### Running the Service
```bash
python main.py
```
*   **API Server**: http://localhost:8001
*   **Swagger Docs**: http://localhost:8001/docs

---

## 🧠 Core Features & Architecture

This service acts as the "Brain" of the platform, processing raw data from the Node.js backend.

### 1. Risk Prediction (`app/api/risks.py`)
*   **Endpoint**: `POST /api/v1/predict/calculate`
*   **Current Logic**: `app/services/risk_engine.py`
*   **Status**: Currently implements mocked/rule-based versions of **QRISK3** (CVD) and **FINDRISC** (Diabetes).
*   **Future Goal**: Replace with trained `scikit-learn` or `xgboost` models loaded from `.pkl` files.

### 2. Document Intelligence (`app/api/documents.py`)
*   **Endpoint**: `POST /api/v1/process/document`
*   **Logic**: `app/services/document_processor.py`
    *   **OCR**: Uses `pytesseract` to extract raw text from scanned PDFs/Images.
    *   **NLP**: Uses `spacy` to identify entities like *Medications*, *Conditions*, and *Vital Signs*.
*   **Integration**: Returns extracted data to Node.js, which stores it in the `metadata` JSON column of the `DocumentFile` entity.

### 3. FHIR Layer (`app/services/fhir_layer.py`)
*   Ensures all data ingress/egress adheres to **HL7 FHIR R4** standards.
*   Converts raw JSON inputs into strict `fhir.resources` objects (e.g., `Patient`, `RiskAssessment`, `Observation`).

---

## 🛠 Developer Guide: Extending Intelligence

We want to make this system more robust. Here is how you can contribute:

### Adding a New Risk Model
1.  **Create Logic**: Add your algorithm in `app/services/` (e.g., `kidney_risk_model.py`).
2.  **Input Schema**: Update `app/schemas/risk.py` or `risks.py` with Pydantic models for the new inputs (e.g., creatinine levels).
3.  **Register Endpoint**: Add a new route in `app/api/risks.py`.
4.  **FHIR Mapping**: Ensure the output is returned as a FHIR `RiskAssessment` resource.

~~~python
# Example Snippet
def calculate_kidney_risk(creatinine, age, gender):
    # Your advanced ML model or formula here
    prediction = model.predict([[creatinine, age, gender]])
    return prediction
~~~

### Improving Document NLP
The current `en_core_web_sm` model is a general-purpose English model.
*   **Task**: Train a custom Spacy model (or fine-tune a Transformer like BERT) on medical datasets (MIMIC-III, etc.).
*   **Goal**: Better recognition of specific drug names, dosages, and ICD-10 codes.

### Model Persistence
*   Currently, logic is hardcoded.
*   **Upgrade**: Create a `models/` directory to store serialized ML models (`.joblib`, `.pkl`) and load them on `lifespan` startup in `main.py`.

---

## 🧪 Testing

*   **Manual Testing**: Use the **Swagger UI** (`/docs`) to send test payloads.
*   **End-to-End**: Upload a document in the CosmicForge Frontend and watch the logs in this terminal to see the extraction process in real-time.

---
**CosmicForge Health Team**
