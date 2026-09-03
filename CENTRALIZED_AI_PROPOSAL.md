# Centralized AI System: Proposal

## 1. Problem

AI functionality in this codebase is currently scattered and inconsistent:

- **`src/features/support/services/geminiService.js`**: a real LLM integration (Gemini 2.5 Flash, raw REST call, no SDK) powering the live support chat. Handles chat sessions, escalation to human agents.
- **`ai_service` (separate Python/FastAPI service)**: branded as "AI" but is not. `risk_models.py` is a hardcoded if/else scoring table (explicitly named "QRISK3-Mock" and "FINDRISC-Mock" in the code). `document_processor.py` returns dummy hardcoded text instead of doing real OCR/NLP. Consumed by the patient module via `aiIntegrationService.js`.
- No shared abstraction exists between these two. Each was built independently, with its own HTTP client, its own error handling, its own key management.
- No feedback loop anywhere. Nothing captures whether an AI output was right or wrong, so nothing can improve over time. The "risk scoring" in particular could be a real, continuously-improving model, but as built today it never learns from a single outcome.

Any new module that wants AI (health news summarization, first aid content generation, community moderation, etc.) would currently have to build its own integration from scratch, repeating the same mistakes.

## 2. Goal

One centralized AI service, inside this backend, that every module and every connected app calls through, built on more than one provider option, with a real path to retraining/fine-tuning as usage data accumulates. Not five different integrations wearing different names, and not a system that stays static forever.

## 3. Proposed Architecture

### 3.1 Internal module: `src/shared/services/ai/`

Mirrors the existing `src/shared/services/email` pattern already used for cross-cutting concerns in this codebase. Exposes a small provider-agnostic interface:

```
aiService.chat(messages, options)
aiService.classify(input, categories, options)
aiService.extract(input, schema, options)
aiService.score(input, criteria, options)
```

`options` includes a `modelConfig` key (see 3.4) rather than a hardcoded model string, so the underlying provider and model version can change without touching call sites.

### 3.2 HTTP layer: `/api/ai/*`

This is the part that actually centralizes AI across connected apps, not just internal modules. Every app that already talks to this backend (the 3 known frontends, admin, and whatever else is on the list we are still building) hits the same endpoints instead of embedding provider keys or calling a provider directly:

```
POST /api/ai/chat
POST /api/ai/classify
POST /api/ai/extract
POST /api/ai/score
POST /api/ai/feedback   (see Section 5)
```

Auth, rate limiting, usage logging, and cost tracking are handled once, at this layer, instead of being reimplemented (or skipped) per module.

### 3.3 Migration of existing consumers

- **Support chat**: already real. Wrap `geminiService.js` behind the new interface, no behavior change.
- **Patient risk scoring**: decision needed. Either replace the hardcoded `RiskEngine` with a real model call through the gateway, or keep it rule-based but stop presenting it as AI in the product and in any pricing conversation with stakeholders. This is also the strongest candidate for the retraining pipeline in Section 5, since real patient outcomes can eventually train it.
- **Document processing**: the current implementation is a stub. Either wire it to a real OCR/extraction call through the gateway, or remove the feature until it is real.

No big-bang cutover. One consumer migrated at a time, tested, then the next.

### 3.4 Model registry (what makes multi-provider and retraining possible)

Instead of a model name hardcoded per call site, the gateway holds a small config table:

| Call type | Provider | Model | Version | Status |
|---|---|---|---|---|
| support.chat | Gemini | gemini-2.5-flash | v1 | active |
| patient.riskScore | (rule-based, no provider) | RiskEngine | v1 | active, candidate for replacement |
| firstaid.classify | Gemini | gemini-2.5-flash-lite | v1 | proposed |

Swapping a provider, rolling out a fine-tuned replacement, or running two versions side by side for comparison is a row change in this table, not a code change in every module. This is the mechanism that gives both "multiple AI options" and "room for retraining" a real home instead of being aspirational.

## 4. Provider Comparison

Three categories worth deciding between, not just Gemini vs. one alternative.

### 4.1 Google Gemini (current provider)

Per Google's official pricing page (checked 2026-09-02):

| Model | Input $/1M | Output $/1M | Notes |
|---|---|---|---|
| Gemini 2.5 Flash | $0.30 (text/image/video), $1.00 (audio) | $2.50 | Currently in production use here |
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | Cheaper tier for classification/simple extraction |

Third-party trackers report an October 16, 2026 retirement date for the 2.5 model family. Not confirmed on Google's own pricing/docs pages as of this check, so verify directly with Google, but worth planning around given the timing (about six weeks from now).

Fine-tuning: Vertex AI supports supervised tuning for select Gemini models. Would mean moving off the plain Gemini API onto Vertex AI for any tuned model.

### 4.2 Anthropic Claude

| Model | Input $/1M | Output $/1M | Notes |
|---|---|---|---|
| Claude Haiku 4.5 | $1.00 | $5.00 | Cheapest Claude tier, good for classification/extraction |
| Claude Sonnet 5 | $2.00 | $10.00 | General-purpose, strong default |
| Claude Opus 5 | $5.00 | $25.00 | Highest capability, highest cost |

Fine-tuning: Anthropic does not currently offer a general-purpose weight-retraining/fine-tuning API for Claude models the way OpenAI and Google do. Customization is done through prompting, context, and tool design, not retrained weights. If retraining Claude specifically is a hard requirement, this is a real limitation to weigh, not a detail.

### 4.3 OpenAI

Numbers below came from aggregated third-party trackers (OpenAI's own pricing page blocked automated fetch during this check); treat as directional and confirm on openai.com/api/pricing before budgeting against them.

| Model tier | Input $/1M | Output $/1M | Notes |
|---|---|---|---|
| Cheapest current tier (reported as "GPT-5.6 Luna") | ~$0.20 | ~$1.20 | Roughly comparable to Gemini Flash-Lite |
| Mid tier (reported as "GPT-5.6 Terra") | ~$2.00 | ~$12.00 | Comparable band to Claude Sonnet 5 |
| Flagship tier (reported as "GPT-5.5" / "GPT-5.6 Sol") | ~$5.00 | ~$30.00 | Comparable band to Claude Opus 5, priciest output here |

Fine-tuning: OpenAI has historically offered a fine-tuning API for select smaller models. Whether the current flagship-tier models support it needs confirming at implementation time, since this shifts release to release.

### 4.4 Self-hosted open-weight models (Llama, Mistral, etc.)

Not usage-priced, infrastructure-priced instead: GPU hosting cost (cloud GPU instance or on-prem) plus MLOps overhead, no per-token bill.

This is the option with the most retraining headroom, since the weights are actually owned rather than rented. It's the right fit specifically for the patient risk-scoring use case if the goal is a model that improves from real patient outcome data over time, since that requires actual fine-tuning control, not prompt engineering against someone else's hosted model. The cost is real infrastructure and ML engineering effort that the other three options don't require.

### 4.5 Recommendation

Start with Gemini for chat/classification (already integrated, cheapest at the Flash-Lite tier), keep Claude as the documented fallback/alternative in the model registry (Section 3.4) for redundancy or higher-stakes calls, and treat self-hosting as the answer specifically for risk scoring once there's enough real outcome data to train on. Don't try to solve all four categories on day one.

## 5. Room for Retraining

This has to be designed in from the start, not bolted on later, because it depends on data being captured from day one.

### 5.1 Data capture

Every call through `/api/ai/*` gets logged: input, output, provider/model/version used, and (where applicable) any human correction or outcome that comes in later. For health data this needs to run through whatever consent/governance rules apply elsewhere in this codebase (there's a `dataGovernanceRoutes` module already present but currently commented out in `app.js`, worth revisiting alongside this).

### 5.2 Feedback loop

`POST /api/ai/feedback` lets a consuming app report back: was this AI output correct, was it corrected by a human, what was the actual outcome (e.g., did the patient's real diagnosis match the risk score). Without this, "retraining" has no data to retrain on.

### 5.3 Versioned rollout

Because the model registry (3.4) keys every call type to a specific model + version rather than a hardcoded string, a retrained or fine-tuned replacement can be rolled out to a percentage of traffic, compared against the current version using the feedback data from 5.2, and promoted or rolled back without touching the modules that call it.

### 5.4 What's realistic near-term vs. later

- **Near-term**: build the logging and feedback capture (5.1, 5.2) even before any retraining happens. This is cheap and it's the prerequisite for everything else.
- **Later**: actual retraining, once there's a meaningful volume of labeled outcome data. For risk scoring specifically, this likely means the self-hosted path (4.4) rather than trying to fine-tune a hosted provider's flagship model.

## 6. Open Items

1. **Full list of connected apps.** Known so far: 3 frontends, admin panel. Confirmed there are more; list not yet provided. Needed before the `/api/ai/*` auth model can be finalized.
2. **Decision on the fake risk engine and document stub**: replace with real calls, or keep rule-based and relabel honestly.
3. **Provider decision**: single provider now with room to add more (Section 4.5 recommendation), or multi-provider from day one.
4. **Gemini 2.5 retirement date**: verify directly with Google, since the current integration is pinned to `gemini-2.5-flash`.
5. **OpenAI pricing**: confirm directly on openai.com before this document is used for budgeting.
6. **Data governance for AI logging/retraining**: confirm how this interacts with the currently-disabled `dataGovernanceRoutes` module and any existing patient-data consent rules.

## 7. Suggested Next Step

Build the internal module and model registry first (Sections 3.1, 3.4), migrate the support chat into it as a proof of the pattern, add logging and feedback capture (5.1, 5.2) at the same time since they're cheap now and expensive to retrofit later, then add the HTTP layer (Section 3.2) once the app list is confirmed. This gets value shipped without waiting on the full list of consumers, and leaves the retraining path open instead of closing it off.
