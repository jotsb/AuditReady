# Self-Hosted AI Strategy for Audit Proof

## Executive Summary

This document outlines a comprehensive strategy to replace OpenAI's ChatGPT with a self-hosted AI solution that maintains data privacy, reduces costs, and provides enterprise-grade OCR and financial intelligence capabilities. All components are designed to run on your Unraid Docker setup.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Self-Hosted AI Architecture](#self-hosted-ai-architecture)
3. [OCR & Document Processing Solutions](#ocr--document-processing-solutions)
4. [Large Language Model (LLM) Options](#large-language-model-llm-options)
5. [Specialized Financial AI Models](#specialized-financial-ai-models)
6. [Implementation Plan](#implementation-plan)
7. [Hardware Requirements](#hardware-requirements)
8. [Cost-Benefit Analysis](#cost-benefit-analysis)
9. [Security & Compliance](#security--compliance)
10. [Migration Strategy](#migration-strategy)

---

## Problem Statement

### Current Risks with OpenAI Integration

1. **Data Privacy & Compliance**
   - Financial data sent to third-party servers
   - PIPEDA/GDPR compliance concerns
   - Client data exposure risk
   - No control over data retention

2. **Security Vulnerabilities**
   - API keys can be compromised
   - Man-in-the-middle attack vectors
   - Data exfiltration risk
   - Audit trail gaps

3. **Cost Concerns**
   - Per-token pricing adds up quickly
   - Unpredictable monthly costs
   - No cost ceiling for high-volume users
   - Price increases at OpenAI's discretion

4. **Reliability & Availability**
   - Dependent on OpenAI uptime
   - Rate limiting during peak times
   - Service deprecation risk
   - No SLA guarantees for API tier

5. **Vendor Lock-In**
   - Hard to migrate prompts and workflows
   - Model-specific optimizations
   - Feature dependency

---

## Self-Hosted AI Architecture

### Recommended Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Audit Proof Web App                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              AI Orchestration Layer                      │
│  (LangChain / LlamaIndex / Custom API Gateway)          │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌─────────┐ ┌──────────────┐
│   OCR Engine │ │   LLM   │ │  Embeddings  │
│   (Tesseract,│ │ (Llama, │ │   (Vector    │
│    PaddleOCR,│ │  Mistral│ │    Store)    │
│    EasyOCR)  │ │  Falcon)│ │  (Qdrant,    │
│              │ │         │ │   Weaviate)  │
└──────────────┘ └─────────┘ └──────────────┘
        │            │            │
        └────────────┼────────────┘
                     ▼
        ┌─────────────────────────┐
        │   GPU Acceleration      │
        │   (CUDA / ROCm)         │
        └─────────────────────────┘
```

### Component Breakdown

#### 1. AI Orchestration Layer
**Purpose:** Manage requests, route to appropriate models, handle fallbacks

**Options:**
- **LangChain** (Recommended)
  - Python/TypeScript framework
  - Chain multiple AI operations
  - Built-in prompt templates
  - Agent-based workflows

- **LlamaIndex**
  - Specialized for document retrieval
  - RAG (Retrieval-Augmented Generation)
  - Great for financial document Q&A

- **Custom API Gateway**
  - Full control over routing
  - Optimized for your use cases
  - FastAPI or Express.js

**Docker Container:** `langchain-service:latest`

---

#### 2. OCR Engine
**Purpose:** Extract text from receipt images

**Options:**
- **Tesseract OCR** (Open Source)
- **PaddleOCR** (Best for financial documents)
- **EasyOCR** (80+ languages)
- **Surya OCR** (Modern, transformer-based)

**Docker Container:** `ocr-service:latest`

---

#### 3. Large Language Model (LLM)
**Purpose:** Understand context, extract structured data, answer questions

**Options:**
- **Llama 3.1** (Meta)
- **Mistral 7B** (French AI startup)
- **Falcon 40B** (Technology Innovation Institute)
- **CodeLlama** (For code generation if needed)

**Docker Container:** `llm-service:latest` (Ollama or vLLM)

---

#### 4. Vector Database
**Purpose:** Store embeddings for semantic search, RAG applications

**Options:**
- **Qdrant** (Recommended, Rust-based, fast)
- **Weaviate** (GraphQL API, popular)
- **ChromaDB** (Lightweight, Python)

**Docker Container:** `vector-db:latest`

---

## OCR & Document Processing Solutions

### Option 1: PaddleOCR (Recommended)
**Why:** State-of-the-art accuracy for financial documents

#### Features:
- Multi-language support (80+ languages)
- Layout analysis (detects tables, lines, boxes)
- Text direction detection
- Confidence scores for each word
- GPU acceleration support

#### Docker Setup:
```dockerfile
FROM paddlepaddle/paddle:2.5.1-gpu-cuda11.7-cudnn8

RUN pip install paddleocr paddlepaddle-gpu

COPY ocr_service.py /app/
WORKDIR /app

EXPOSE 8000
CMD ["uvicorn", "ocr_service:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### API Example:
```python
from paddleocr import PaddleOCR
from fastapi import FastAPI, File, UploadFile
import numpy as np
from PIL import Image
import io

app = FastAPI()
ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=True)

@app.post("/ocr/extract")
async def extract_text(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    image_np = np.array(image)

    result = ocr.ocr(image_np, cls=True)

    extracted_text = []
    for line in result[0]:
        text = line[1][0]
        confidence = line[1][1]
        extracted_text.append({
            "text": text,
            "confidence": confidence,
            "bbox": line[0]
        })

    return {
        "status": "success",
        "extracted_text": extracted_text,
        "full_text": " ".join([item["text"] for item in extracted_text])
    }
```

#### Performance:
- **Speed:** ~2-3 seconds per receipt (with GPU)
- **Accuracy:** 95%+ for clear receipts
- **GPU Memory:** 2-4GB VRAM

---

### Option 2: Tesseract OCR + Post-Processing
**Why:** Mature, widely used, good for simple receipts

#### Docker Setup:
```dockerfile
FROM tesseractsuite/tesseract:latest

RUN apt-get update && apt-get install -y \
    python3-pip \
    imagemagick \
    ghostscript

RUN pip3 install pytesseract pillow fastapi uvicorn

COPY tesseract_service.py /app/
WORKDIR /app

EXPOSE 8000
CMD ["uvicorn", "tesseract_service:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Advantages:
- Very lightweight
- No GPU required
- Battle-tested
- Easy to deploy

#### Disadvantages:
- Lower accuracy than PaddleOCR
- No layout analysis
- Struggles with rotated/skewed images

---

### Option 3: Donut (Document Understanding Transformer)
**Why:** End-to-end transformer model, no separate OCR needed

#### Features:
- Trained specifically for document understanding
- Can extract key-value pairs directly
- No traditional OCR step required
- Handles complex layouts well

#### Docker Setup:
```dockerfile
FROM huggingface/transformers-pytorch-gpu:latest

RUN pip install donut-python

COPY donut_service.py /app/
WORKDIR /app

EXPOSE 8000
CMD ["uvicorn", "donut_service:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Performance:
- **Speed:** ~5-8 seconds per receipt (with GPU)
- **Accuracy:** 98%+ for structured receipts
- **GPU Memory:** 6-8GB VRAM

#### Best For:
- Receipts with complex layouts
- Forms with tables
- Multi-page documents

---

## Large Language Model (LLM) Options

### Comparison Matrix

| Model | Size | VRAM Required | Accuracy | Speed | Best For |
|-------|------|---------------|----------|-------|----------|
| **Llama 3.1 8B** | 8B params | 8-10GB | Excellent | Fast | General purpose, data extraction |
| **Llama 3.1 70B** | 70B params | 40-48GB | Exceptional | Slower | Complex reasoning, financial analysis |
| **Mistral 7B** | 7B params | 6-8GB | Excellent | Very Fast | Structured data extraction |
| **Mistral 8x7B** | 8x7B (MoE) | 24GB | Exceptional | Fast | Complex tasks, multi-step reasoning |
| **Falcon 40B** | 40B params | 32GB | Excellent | Medium | Long context, document analysis |
| **Phi-3 Mini** | 3.8B params | 4GB | Good | Very Fast | Quick tasks, edge deployment |
| **CodeLlama** | 7-34B params | 8-24GB | Good | Fast | Code generation, data transformation |

---

### Recommended: Llama 3.1 8B

#### Why?
- Open-source (Meta's license)
- 8 billion parameters = great performance/cost ratio
- 128k context window (can process long documents)
- Excellent instruction following
- Strong on structured output (JSON)
- Active community support

#### Docker Setup with Ollama:
```dockerfile
FROM ollama/ollama:latest

RUN ollama pull llama3.1:8b

EXPOSE 11434

CMD ["ollama", "serve"]
```

#### Usage Example:
```python
import requests

def extract_receipt_data(ocr_text: str):
    prompt = f"""
You are a financial data extraction expert. Extract the following information from this receipt text and return it as JSON:

Receipt Text:
{ocr_text}

Extract:
- vendor_name
- transaction_date (format: YYYY-MM-DD)
- total_amount (numeric only)
- currency (CAD, USD, EUR, etc.)
- subtotal
- tax_amount (GST/HST/PST/VAT)
- payment_method
- items (array of {{description, quantity, unit_price, amount}})

Return ONLY valid JSON, no additional text.
"""

    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3.1:8b",
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
    )

    return response.json()
```

#### Performance:
- **Speed:** ~3-5 seconds per receipt (with GPU)
- **Accuracy:** 92-95% for structured data extraction
- **Cost:** $0 (self-hosted)

---

### Alternative: Mistral 7B

#### Advantages over Llama:
- Faster inference
- Better at following strict formats
- Smaller memory footprint
- Apache 2.0 license (fully permissive)

#### Docker Setup:
```bash
docker run -d \
  --name mistral-service \
  --gpus all \
  -p 8080:8080 \
  -v ~/models:/models \
  vllm/vllm-openai:latest \
  --model mistralai/Mistral-7B-Instruct-v0.2
```

---

## Specialized Financial AI Models

### 1. FinGPT (Financial Large Language Model)
**Purpose:** Fine-tuned for financial tasks

#### Features:
- Pre-trained on financial documents
- Understands accounting terminology
- Better at financial reasoning
- Open-source (Hugging Face)

#### Use Cases:
- Account categorization
- Tax code identification
- Financial statement analysis
- Budget recommendations

#### Docker Setup:
```dockerfile
FROM huggingface/transformers-pytorch-gpu:latest

RUN pip install fingpt

COPY fingpt_service.py /app/
WORKDIR /app

EXPOSE 8000
CMD ["uvicorn", "fingpt_service:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### 2. BloombergGPT-like Model (Fine-tuned Llama)

#### Custom Training on Financial Data:
You can fine-tune Llama 3.1 on your own receipt dataset to improve accuracy over time.

**Training Pipeline:**
1. **Collect Training Data**
   - 10,000+ receipts with manual annotations
   - Include edge cases (faded receipts, handwritten, etc.)

2. **Fine-Tuning with LoRA (Low-Rank Adaptation)**
   - Efficient fine-tuning method
   - Only 1-2GB of additional model weights
   - Can be done on consumer GPUs

3. **Continuous Learning**
   - User corrections feed back into training
   - Model improves over time
   - Personalized to your business types

**Docker Setup:**
```dockerfile
FROM huggingface/peft-gpu:latest

COPY train.py /app/
COPY receipts_dataset.json /app/

WORKDIR /app

CMD ["python", "train.py", "--model", "meta-llama/Llama-3.1-8B", "--dataset", "receipts_dataset.json"]
```

---

## Implementation Plan

### Phase 1: POC (Proof of Concept) - 2 weeks

**Goal:** Replace OpenAI with basic self-hosted OCR + LLM

#### Tasks:
1. Set up Ollama with Llama 3.1 8B
2. Deploy PaddleOCR container
3. Create simple orchestration layer
4. Test with 100 sample receipts
5. Compare accuracy with OpenAI baseline

#### Success Metrics:
- 90%+ accuracy on key fields (vendor, date, amount)
- <5 second processing time
- Zero data sent to external APIs

---

### Phase 2: Production Deployment - 4 weeks

**Goal:** Full production-ready AI stack

#### Tasks:
1. Deploy Qdrant vector database
2. Implement RAG for better context
3. Add model monitoring (Prometheus + Grafana)
4. Create fallback mechanisms
5. Load testing (1000 receipts/hour)
6. GPU optimization (batch processing)

#### Success Metrics:
- 95%+ accuracy
- <3 second average processing time
- 99.9% uptime
- Cost reduction: 90%+ vs. OpenAI

---

### Phase 3: Advanced Features - 8 weeks

**Goal:** Surpass OpenAI capabilities

#### Tasks:
1. Fine-tune Llama on proprietary receipt dataset
2. Implement multi-modal analysis (image + text)
3. Add anomaly detection (fraud detection)
4. Create financial insights engine
5. Build predictive analytics

#### Success Metrics:
- 98%+ accuracy
- Fraud detection capability
- Predictive cash flow forecasting
- Automated tax optimization suggestions

---

## Hardware Requirements

### Minimum (Development)
- **GPU:** NVIDIA RTX 3060 (12GB VRAM)
- **CPU:** 6-core Intel/AMD
- **RAM:** 32GB
- **Storage:** 500GB SSD

**Can Run:**
- Llama 3.1 8B (quantized to 4-bit)
- PaddleOCR
- Qdrant

**Performance:** 5-10 receipts/minute

---

### Recommended (Production)
- **GPU:** NVIDIA RTX 4090 (24GB VRAM) or A4000 (16GB VRAM)
- **CPU:** 12-core Intel/AMD
- **RAM:** 64GB
- **Storage:** 1TB NVMe SSD

**Can Run:**
- Llama 3.1 8B (full precision)
- Mistral 8x7B (MoE model)
- PaddleOCR
- Qdrant
- Multiple concurrent users

**Performance:** 30-50 receipts/minute

---

### Enterprise (High Volume)
- **GPU:** NVIDIA A6000 (48GB VRAM) or dual RTX 4090
- **CPU:** 24-core Threadripper/EPYC
- **RAM:** 128GB ECC
- **Storage:** 2TB NVMe SSD (RAID 1)

**Can Run:**
- Llama 3.1 70B
- Multiple model replicas
- Advanced multi-modal models
- Real-time inference for 100+ users

**Performance:** 100+ receipts/minute

---

### Your Unraid Setup Considerations

#### Current Unraid Capabilities:
- Docker containers: ✅ Perfect for AI stack
- GPU passthrough: ✅ Can dedicate GPU to AI containers
- Storage flexibility: ✅ Can allocate SSD cache for model storage
- Community Apps: ✅ Can use pre-built containers

#### Recommended Unraid Configuration:
```yaml
# docker-compose.yml for Unraid
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    container_name: auditproof-llm
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=0
    ports:
      - "11434:11434"
    volumes:
      - /mnt/user/appdata/ollama:/root/.ollama
    restart: unless-stopped

  paddleocr:
    image: paddlepaddle/paddle:2.5.1-gpu-cuda11.7-cudnn8
    container_name: auditproof-ocr
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=0
    ports:
      - "8001:8000"
    volumes:
      - /mnt/user/appdata/paddleocr:/app
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:latest
    container_name: auditproof-vectordb
    ports:
      - "6333:6333"
    volumes:
      - /mnt/user/appdata/qdrant:/qdrant/storage
    restart: unless-stopped

  langchain-service:
    build: ./langchain-service
    container_name: auditproof-ai-orchestrator
    depends_on:
      - ollama
      - paddleocr
      - qdrant
    ports:
      - "8002:8000"
    environment:
      - OLLAMA_URL=http://ollama:11434
      - OCR_URL=http://paddleocr:8000
      - QDRANT_URL=http://qdrant:6333
    volumes:
      - /mnt/user/appdata/langchain:/app/data
    restart: unless-stopped
```

---

## Cost-Benefit Analysis

### OpenAI Current Costs (Estimated)

**Assumptions:**
- 1,000 receipts/month
- Average receipt: 500 tokens (OCR text)
- Response: 200 tokens (structured JSON)
- GPT-4 Turbo pricing: $0.01/1K input tokens, $0.03/1K output tokens

**Monthly Cost:**
```
Input tokens: 1,000 receipts × 500 tokens = 500,000 tokens
Cost: 500,000 / 1,000 × $0.01 = $5

Output tokens: 1,000 receipts × 200 tokens = 200,000 tokens
Cost: 200,000 / 1,000 × $0.03 = $6

Total: $11/month for 1,000 receipts
```

**At Scale (10,000 receipts/month):** $110/month
**At Scale (100,000 receipts/month):** $1,100/month

---

### Self-Hosted Costs

**One-Time Hardware Investment:**
- NVIDIA RTX 4090: $1,600
- Additional RAM (32GB): $150
- NVMe SSD (1TB): $100
- **Total:** ~$1,850

**Ongoing Costs:**
- Electricity: ~$30/month (24/7 operation, ~300W)
- Maintenance: $0 (self-managed)
- **Total:** $30/month

**Break-Even Analysis:**
- At 1,000 receipts/month: 168 months (not worth it)
- At 10,000 receipts/month: 23 months
- At 100,000 receipts/month: 2 months ✅

**Additional Benefits:**
- No data privacy concerns: **Priceless**
- Unlimited processing: **Priceless**
- Customization capability: **Priceless**
- No vendor lock-in: **Priceless**

---

## Security & Compliance

### Data Privacy Advantages

1. **Zero Data Leakage**
   - All processing happens on-premise
   - No data sent to third parties
   - Full GDPR/PIPEDA compliance

2. **Audit Trail**
   - Complete control over logs
   - Can prove data never left infrastructure
   - Meets SOC 2 requirements

3. **Client Confidence**
   - Market as "Private AI"
   - Competitive advantage for sensitive industries
   - Can serve government clients

---

### Security Best Practices

1. **Model Isolation**
   - Run AI containers in isolated network
   - No internet access for inference containers
   - Only orchestration layer connects to app

2. **Model Verification**
   - Checksum verification of downloaded models
   - Only use models from trusted sources
   - Regular security updates

3. **Access Control**
   - API authentication for all AI endpoints
   - Rate limiting per user/business
   - Audit all AI requests

4. **Data Encryption**
   - Encrypt data at rest (model storage)
   - TLS for all internal API calls
   - Secure key management

---

## Migration Strategy

### Step 1: Parallel Processing (Week 1-2)
- Run both OpenAI and self-hosted in parallel
- Compare results side-by-side
- Log accuracy differences
- Identify failure cases

### Step 2: Gradual Rollout (Week 3-4)
- Start with 10% of traffic to self-hosted
- Monitor error rates
- Fallback to OpenAI if self-hosted fails
- Increase to 50% after validation

### Step 3: Full Migration (Week 5-6)
- 100% traffic to self-hosted
- OpenAI as backup only (manual trigger)
- Monitor for 2 weeks
- Decommission OpenAI integration

### Step 4: Optimization (Week 7-8)
- Fine-tune models on production data
- Optimize inference speed
- Reduce GPU memory usage
- Implement caching strategies

---

## Recommended Implementation Roadmap

### Immediate (Next 30 Days)

1. **Deploy Basic Stack**
   - Ollama + Llama 3.1 8B
   - PaddleOCR
   - Simple FastAPI orchestrator

2. **Test with Real Data**
   - Process 1,000 existing receipts
   - Measure accuracy vs. OpenAI
   - Document failure cases

3. **Performance Baseline**
   - Measure latency
   - GPU utilization
   - Throughput (receipts/minute)

**Deliverable:** Working POC with 90%+ accuracy

---

### Short-Term (60-90 Days)

1. **Production Hardening**
   - Add Qdrant for RAG
   - Implement retry logic
   - Add monitoring (Prometheus)
   - Load balancing for multiple GPUs

2. **Model Fine-Tuning**
   - Collect 5,000+ annotated receipts
   - Fine-tune Llama on receipt data
   - A/B test fine-tuned vs. base model

3. **Feature Parity**
   - Match all OpenAI features
   - Add new AI-powered features
   - Fraud detection
   - Smart categorization

**Deliverable:** Production-ready AI stack, 95%+ accuracy

---

### Long-Term (6-12 Months)

1. **Advanced AI Features**
   - Predictive cash flow
   - Automated tax optimization
   - Financial anomaly detection
   - Natural language queries ("Show me all restaurant expenses over $100 in Q2")

2. **Multi-Modal Models**
   - Image understanding (detect damaged receipts)
   - Layout analysis (extract from complex invoices)
   - Signature verification

3. **Continuous Learning**
   - Active learning pipeline
   - User feedback → model improvement
   - Personalized models per business

**Deliverable:** AI capabilities surpassing commercial solutions

---

## Conclusion

### Why Self-Hosted AI is the Right Choice

1. **Privacy & Compliance**: No data leaves your infrastructure
2. **Cost Savings**: $1,100/month → $30/month at scale
3. **Performance**: Faster inference, no rate limits
4. **Customization**: Fine-tune models for your specific use cases
5. **Competitive Advantage**: Unique AI capabilities
6. **Future-Proof**: Own your AI stack, not rented

### Recommended Starting Point

**For Audit Proof, I recommend:**

1. **Start with Llama 3.1 8B + PaddleOCR**
   - Best balance of performance and resource usage
   - Proven accuracy for financial documents
   - Can run on RTX 3060+ GPUs

2. **Use Ollama for Easy Deployment**
   - One-line installation
   - OpenAI-compatible API
   - Easy model switching

3. **Implement in Phases**
   - POC (2 weeks)
   - Production (4 weeks)
   - Advanced features (8 weeks)

4. **Measure Everything**
   - Accuracy vs. OpenAI
   - Cost savings
   - Processing time
   - User satisfaction

### Expected Outcomes

**6 Months from Now:**
- ✅ Zero data sent to OpenAI
- ✅ 95%+ accuracy on receipt extraction
- ✅ <3 second processing time
- ✅ $1,000+/month saved at scale
- ✅ New AI features (fraud detection, predictions)
- ✅ Competitive advantage in market

**The future of Audit Proof is privacy-first AI, and this roadmap gets you there.**

---

## Appendix: Quick Start Guide

### Deploy Llama 3.1 in 5 Minutes

```bash
# On your Unraid server terminal

# 1. Install Ollama
docker run -d \
  --name ollama \
  --gpus all \
  -p 11434:11434 \
  -v /mnt/user/appdata/ollama:/root/.ollama \
  --restart unless-stopped \
  ollama/ollama:latest

# 2. Pull Llama 3.1 8B model
docker exec ollama ollama pull llama3.1:8b

# 3. Test it
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Extract the vendor name, date, and total from this receipt: WALMART Supercenter 2025-01-15 SUBTOTAL $45.67 TAX $5.93 TOTAL $51.60",
  "stream": false,
  "format": "json"
}'
```

### Deploy PaddleOCR in 5 Minutes

```bash
# Create OCR service directory
mkdir -p /mnt/user/appdata/paddleocr
cd /mnt/user/appdata/paddleocr

# Create service file
cat > ocr_service.py << 'EOF'
from fastapi import FastAPI, File, UploadFile
from paddleocr import PaddleOCR
import numpy as np
from PIL import Image
import io

app = FastAPI()
ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=True)

@app.post("/extract")
async def extract_text(file: UploadFile):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    result = ocr.ocr(np.array(image))

    text = " ".join([line[1][0] for line in result[0]])
    return {"text": text}
EOF

# Run container
docker run -d \
  --name paddleocr \
  --gpus all \
  -p 8001:8000 \
  -v $(pwd):/app \
  -w /app \
  --restart unless-stopped \
  paddlepaddle/paddle:2.5.1-gpu-cuda11.7-cudnn8 \
  bash -c "pip install paddleocr fastapi uvicorn && uvicorn ocr_service:app --host 0.0.0.0 --port 8000"

# Test it
curl -X POST -F "file=@receipt.jpg" http://localhost:8001/extract
```

**You're now running a complete self-hosted AI stack! 🎉**
