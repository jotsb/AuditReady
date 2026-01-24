# Self-Hosted AI Strategy for Audit Proof (Updated)

## Executive Summary

This document outlines comprehensive strategies to replace OpenAI's ChatGPT with self-hosted OR cloud-based AI solutions. It includes **CPU-only**, **GPU-accelerated**, and **cloud GPU** deployment options, with detailed comparisons to help you choose the best approach for your needs. All solutions maintain privacy where possible and significantly reduce costs compared to OpenAI.

**Important Note:** Your GTX 860/960 GPUs are unfortunately not suitable for modern AI workloads due to insufficient VRAM (2-4GB) and outdated CUDA architecture. This guide focuses on CPU-only and modern GPU options.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Deployment Options Overview](#deployment-options-overview)
3. [Comprehensive Comparison Table](#comprehensive-comparison-table)
4. [CPU-Only Deployment (No GPU)](#cpu-only-deployment-no-gpu)
5. [GPU-Accelerated Deployment (Local)](#gpu-accelerated-deployment-local)
6. [Cloud GPU Deployment](#cloud-gpu-deployment)
7. [OCR Solutions Comparison](#ocr-solutions-comparison)
8. [LLM Models Comparison](#llm-models-comparison)
9. [Application Integration Changes](#application-integration-changes)
10. [Implementation Roadmap](#implementation-roadmap)
11. [Cost-Benefit Analysis](#cost-benefit-analysis)
12. [Security & Compliance](#security--compliance)

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

---

## Deployment Options Overview

### Option 1: CPU-Only Deployment 🖥️
**No GPU Required - Works on Your Current Unraid Setup**

**What it is:** Run AI models entirely on your CPU using optimized lightweight models and quantization techniques.

**Who it's for:**
- Starting out with AI
- Low-moderate volume (<500 receipts/month)
- Budget-conscious
- Don't want to buy hardware yet

**Pros:**
- $0 hardware investment
- 100% private (data never leaves server)
- Easy setup (30 minutes)
- Works on existing Unraid server

**Cons:**
- Slower processing (15-30 seconds per receipt)
- Lower accuracy (90-92% vs 95%+)
- Limited to 1-2 concurrent users
- Can't run advanced AI features

---

### Option 2: GPU-Accelerated Deployment (Local) 🎮
**Requires Modern GPU Purchase**

**What it is:** Install a modern NVIDIA GPU (RTX 3060 or better) in your Unraid server for fast AI processing.

**Who it's for:**
- High volume (500+ receipts/month)
- Want best performance
- Long-term investment
- Privacy is critical

**Pros:**
- Fast processing (3-5 seconds per receipt)
- High accuracy (95-98%)
- 100% private
- Can fine-tune models
- Supports 10-20 concurrent users
- Enables advanced features (fraud detection, predictions)

**Cons:**
- Hardware cost ($300-$1,500 upfront)
- Higher electricity cost ($30/month)
- Requires GPU installation in server
- Break-even takes 6-12 months

**Your GTX 860/960:** ❌ Unfortunately not suitable
- Only 2-4GB VRAM (need 8GB minimum)
- Old CUDA architecture (unsupported by modern AI frameworks)
- **Better to use CPU-only than these older GPUs**

---

### Option 3: Cloud GPU Deployment ☁️
**Rent GPU Time as Needed**

**What it is:** Use cloud GPU services (Vast.ai, RunPod, AWS) to process receipts remotely.

**Who it's for:**
- Testing AI before buying hardware
- Occasional high-volume bursts
- Want GPU performance without hardware
- <200 receipts/month

**Pros:**
- $0 upfront cost
- GPU-level performance (3-8 seconds per receipt)
- Pay only for what you use
- Can test different models easily
- Scales to any volume

**Cons:**
- Data leaves your server (privacy concern)
- Ongoing monthly costs ($10-100+)
- Requires fast internet
- Never reaches break-even vs buying GPU
- More complex setup (API integration)

---

## Comprehensive Comparison Table

| Factor | CPU-Only | Local GPU | Cloud GPU | OpenAI (Current) |
|--------|----------|-----------|-----------|------------------|
| **💰 Initial Cost** | $0 | $300-$1,500 | $0 | $0 |
| **💸 Monthly Cost** | $5 | $15-30 | $10-100 | $11-1,100 |
| **⚡ Processing Speed** | 15-30 sec | 3-5 sec | 3-8 sec | 2-4 sec |
| **🎯 Accuracy** | 90-92% | 95-98% | 95-98% | 95-98% |
| **🔒 Privacy** | ✅ 100% Private | ✅ 100% Private | ⚠️ Data sent to cloud | ❌ Data sent to OpenAI |
| **📈 Scalability** | 100-200 receipts/mo | 1,000+ receipts/mo | Unlimited | Unlimited |
| **🛠️ Setup Time** | 30 min | 2-3 hours | 1-2 hours | 15 min |
| **🔧 Maintenance** | Minimal | Minimal | Minimal | None |
| **🌐 Internet Required** | No | No | Yes (fast) | Yes |
| **👥 Concurrent Users** | 1-2 | 10-20 | 50+ | Unlimited |
| **🤖 Model Options** | Limited (small models) | All models | All models | GPT-4 only |
| **🎓 Fine-tuning** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes (expensive) |
| **🔍 Fraud Detection** | ❌ Too slow | ✅ Yes | ✅ Yes | ✅ Yes |
| **📊 Real-time Processing** | ❌ No | ✅ Yes | ✅ Yes (if low latency) | ✅ Yes |
| **✅ PIPEDA/GDPR Compliant** | ✅ Yes | ✅ Yes | ⚠️ Depends | ❌ No (data leaves jurisdiction) |
| **⏱️ Break-Even Point** | Immediate | 6-12 months | Never | N/A |
| **🚀 Upgrade Path** | Buy GPU later | Add 2nd GPU | Switch to local | N/A |

---

## CPU-Only Deployment (No GPU)

### Recommended Stack

```
┌─────────────────────────────┐
│    Audit Proof Web App      │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  AI Orchestrator (FastAPI)  │
└────────────┬────────────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
┌──────────┐  ┌──────────┐
│Tesseract │  │ Phi-3    │
│   OCR    │  │  Mini    │
│ (CPU)    │  │ (CPU)    │
└──────────┘  └──────────┘
```

### Components

#### OCR: Tesseract
- **Why:** Fastest CPU-based OCR
- **Speed:** 1-3 seconds per receipt
- **Accuracy:** 85-90% (lower than GPU options)
- **Memory:** ~500MB RAM

#### LLM: Phi-3 Mini (3.8B parameters)
- **Why:** Designed specifically for CPU inference
- **Speed:** 10-15 seconds per receipt
- **Accuracy:** 90-92% for structured data extraction
- **Memory:** 4-6GB RAM

### Docker Setup (CPU-Only)

```yaml
# docker-compose-cpu.yml
version: '3.8'

services:
  tesseract-ocr:
    image: tesseractsuite/tesseract:latest
    container_name: auditproof-ocr-cpu
    ports:
      - "8001:8000"
    volumes:
      - /mnt/user/appdata/tesseract:/app
    restart: unless-stopped
    command: bash -c "pip install fastapi uvicorn pytesseract pillow && python /app/ocr_service.py"

  ollama-cpu:
    image: ollama/ollama:latest
    container_name: auditproof-llm-cpu
    ports:
      - "11434:11434"
    volumes:
      - /mnt/user/appdata/ollama:/root/.ollama
    restart: unless-stopped
    environment:
      - OLLAMA_NUM_THREADS=8  # Use 8 CPU cores
      - OLLAMA_KEEP_ALIVE=30m

  ai-orchestrator:
    build: ./orchestrator
    container_name: auditproof-ai-orchestrator
    depends_on:
      - tesseract-ocr
      - ollama-cpu
    ports:
      - "8002:8000"
    environment:
      - OCR_URL=http://tesseract-ocr:8000
      - LLM_URL=http://ollama-cpu:11434
      - DEPLOYMENT_MODE=cpu
    restart: unless-stopped
```

### Quick Start (CPU-Only)

```bash
# 1. Pull Ollama container
docker run -d \
  --name ollama-cpu \
  -p 11434:11434 \
  -v /mnt/user/appdata/ollama:/root/.ollama \
  ollama/ollama:latest

# 2. Pull Phi-3 Mini model (optimized for CPU)
docker exec ollama-cpu ollama pull phi3:mini

# 3. Test it
curl http://localhost:11434/api/generate -d '{
  "model": "phi3:mini",
  "prompt": "Extract JSON from: WALMART 2025-01-15 TOTAL $51.60",
  "stream": false,
  "format": "json"
}'

# Expected response time: 10-15 seconds
```

### Performance Expectations

| Metric | CPU-Only Performance |
|--------|---------------------|
| OCR Time | 1-3 seconds |
| LLM Extraction Time | 10-15 seconds |
| Total Time per Receipt | 15-30 seconds |
| Concurrent Requests | 1-2 max |
| Throughput | 100-150 receipts/hour |
| CPU Usage | 70-90% during processing |
| RAM Usage | 6-8GB |

### When to Upgrade from CPU-Only

Upgrade to GPU if:
- Processing >500 receipts/month
- Users complaining about speed
- Want to add fraud detection
- Need real-time processing
- Want to fine-tune models

---

## GPU-Accelerated Deployment (Local)

### Recommended GPU Options

| GPU Model | VRAM | Price (New) | Price (Used) | Performance | Recommended For |
|-----------|------|-------------|--------------|-------------|-----------------|
| **RTX 3060** | 12GB | $350 | $200-250 | Good | Starting out, 500-1000 receipts/mo |
| **RTX 4060 Ti** | 16GB | $500 | $350 | Better | 1,000-2,000 receipts/mo |
| **RTX 3080** | 10GB | $600 | $400 | Great | 2,000-5,000 receipts/mo |
| **RTX 4070** | 12GB | $600 | N/A | Great | 2,000-5,000 receipts/mo |
| **RTX 4090** | 24GB | $1,600 | $1,200 | Excellent | 5,000+ receipts/mo, enterprise |
| **A4000** | 16GB | $1,000 | $700 | Professional | Data centers, 24/7 operation |

**My Recommendation for You:** RTX 3060 12GB (used ~$200-250)
- Best value for starting out
- 12GB VRAM is enough for Llama 3.1 8B
- Low power consumption (~170W)
- Widely available used

### Recommended Stack

```
┌─────────────────────────────┐
│    Audit Proof Web App      │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  AI Orchestrator (FastAPI)  │
└────────────┬────────────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
┌──────────┐  ┌──────────┐
│PaddleOCR │  │  Llama   │
│  (GPU)   │  │  3.1 8B  │
│          │  │  (GPU)   │
└──────────┘  └──────────┘
      │             │
      └──────┬──────┘
             ▼
      ┌──────────────┐
      │  GPU (CUDA)  │
      └──────────────┘
```

### Components

#### OCR: PaddleOCR
- **Why:** Best accuracy for financial documents
- **Speed:** 2-3 seconds per receipt (with GPU)
- **Accuracy:** 95-98%
- **VRAM:** 2-4GB

#### LLM: Llama 3.1 8B
- **Why:** Best open-source model, excellent accuracy
- **Speed:** 3-5 seconds per receipt (with GPU)
- **Accuracy:** 95-98% for structured extraction
- **VRAM:** 8-10GB (full precision)

### Docker Setup (GPU)

```yaml
# docker-compose-gpu.yml
version: '3.8'

services:
  paddleocr-gpu:
    image: paddlepaddle/paddle:2.5.1-gpu-cuda11.7-cudnn8
    container_name: auditproof-ocr-gpu
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=0
    ports:
      - "8001:8000"
    volumes:
      - /mnt/user/appdata/paddleocr:/app
    restart: unless-stopped

  ollama-gpu:
    image: ollama/ollama:latest
    container_name: auditproof-llm-gpu
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=0
    ports:
      - "11434:11434"
    volumes:
      - /mnt/user/appdata/ollama:/root/.ollama
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:latest
    container_name: auditproof-vectordb
    ports:
      - "6333:6333"
    volumes:
      - /mnt/user/appdata/qdrant:/qdrant/storage
    restart: unless-stopped

  ai-orchestrator:
    build: ./orchestrator
    container_name: auditproof-ai-orchestrator
    depends_on:
      - paddleocr-gpu
      - ollama-gpu
      - qdrant
    ports:
      - "8002:8000"
    environment:
      - OCR_URL=http://paddleocr-gpu:8000
      - LLM_URL=http://ollama-gpu:11434
      - VECTOR_DB_URL=http://qdrant:6333
      - DEPLOYMENT_MODE=gpu
    restart: unless-stopped
```

### Performance Expectations

| Metric | GPU Performance |
|--------|-----------------|
| OCR Time | 2-3 seconds |
| LLM Extraction Time | 3-5 seconds |
| Total Time per Receipt | 5-8 seconds |
| Concurrent Requests | 10-20 |
| Throughput | 500-700 receipts/hour |
| GPU Usage | 60-80% during processing |
| VRAM Usage | 10-12GB |
| Power Consumption | 150-200W |

---

## Cloud GPU Deployment

### Provider Comparison

| Provider | GPU Options | Pricing | Pros | Cons |
|----------|-------------|---------|------|------|
| **Vast.ai** | RTX 3090, A6000 | $0.20-0.50/hr | Cheapest, flexible | Community hardware, variable quality |
| **RunPod** | RTX 4090, A100 | $0.50-2.00/hr | Reliable, good support | More expensive |
| **AWS SageMaker** | V100, A10G | $1.00-5.00/hr | Enterprise-grade | Most expensive, complex setup |
| **Lambda Labs** | A100, H100 | $1.10-2.49/hr | ML-optimized | Limited availability |
| **Paperspace** | RTX 6000, A6000 | $0.76-3.00/hr | Easy to use | Mid-tier pricing |

**Recommended for starting: Vast.ai**
- Lowest cost ($0.20/hr for RTX 3090)
- Good enough for Audit Proof needs
- Can process 200-300 receipts/hour
- $0.20/hr × 1 hour = $0.20 for 250 receipts

### Architecture

```
┌─────────────────────────────┐
│    Audit Proof Web App      │
│    (Your Unraid Server)     │
└────────────┬────────────────┘
             │ HTTPS/TLS
             ▼
┌─────────────────────────────┐
│   AI API Gateway (Cloud)    │
│   - Authentication          │
│   - Rate Limiting           │
│   - Request Queuing         │
└────────────┬────────────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
┌──────────┐  ┌──────────┐
│PaddleOCR │  │  Llama   │
│ (Cloud   │  │  3.1 8B  │
│  GPU)    │  │ (Cloud   │
│          │  │  GPU)    │
└──────────┘  └──────────┘
   Vast.ai      Vast.ai
```

### Setup Guide (Vast.ai Example)

```bash
# 1. Sign up at Vast.ai and add credit

# 2. Launch instance with Ollama
vastai create instance \
  --image ollama/ollama:latest \
  --disk 50 \
  --gpu-name "RTX 3090" \
  --ports "11434:11434"

# 3. Get instance IP
vastai show instances

# 4. Connect and setup
ssh root@<instance-ip>
ollama pull llama3.1:8b

# 5. Configure firewall to allow only your IP
# 6. Use HTTPS with API key authentication
```

### Cost Examples

**Scenario: 500 receipts/month**
- Processing time: 5 seconds per receipt = 2,500 seconds total
- GPU time needed: 2,500 / 3,600 = 0.7 hours
- Cost: 0.7 hours × $0.20/hr = **$0.14/month**

**Scenario: 5,000 receipts/month**
- GPU time needed: 7 hours
- Cost: 7 hours × $0.20/hr = **$1.40/month**

**Scenario: 20,000 receipts/month**
- GPU time needed: 28 hours
- Cost: 28 hours × $0.20/hr = **$5.60/month**

**Note:** These costs assume efficient batching and no idle time. Add 20-30% buffer for reality.

---

## OCR Solutions Comparison

| OCR Engine | Hardware | Speed | Accuracy | Best For | Setup Complexity |
|------------|----------|-------|----------|----------|------------------|
| **Tesseract** | CPU | 1-3 sec | 85-90% | CPU-only, simple receipts | Easy |
| **EasyOCR** | CPU/GPU | 3-5 sec (CPU), 1-2 sec (GPU) | 90-93% | Multi-language | Easy |
| **PaddleOCR** | GPU | 2-3 sec | 95-98% | Financial documents, complex layouts | Medium |
| **Donut** | GPU | 5-8 sec | 98%+ | Structured documents, forms | Hard |
| **Azure OCR** | Cloud | 1-2 sec | 95%+ | Enterprise, hybrid approach | Easy |

**My Recommendation:**
- **CPU-Only:** Tesseract
- **Local GPU:** PaddleOCR
- **Cloud GPU:** PaddleOCR or Donut
- **Hybrid:** Tesseract (CPU) + Azure OCR fallback for difficult receipts

---

## LLM Models Comparison

| Model | Parameters | Hardware | Speed | Accuracy | VRAM | Best For |
|-------|-----------|----------|-------|----------|------|----------|
| **Phi-3 Mini** | 3.8B | CPU | 10-15 sec | 90-92% | 4GB | CPU-only deployment |
| **Llama 3.1 8B** | 8B | GPU | 3-5 sec | 95-98% | 8-10GB | General purpose, best balance |
| **Mistral 7B** | 7B | GPU | 2-4 sec | 95-97% | 6-8GB | Speed-focused |
| **Llama 3.1 70B** | 70B | GPU (48GB) | 8-12 sec | 98%+ | 40-48GB | Maximum accuracy |
| **FinGPT** | 7B | GPU | 4-6 sec | 96%+ | 8GB | Financial documents only |

**Quantized Options (for limited VRAM):**
- Llama 3.1 8B (4-bit): 4GB VRAM, 5-8 sec, 93-95% accuracy
- Mistral 7B (4-bit): 3.5GB VRAM, 3-6 sec, 92-94% accuracy

**My Recommendation:**
- **CPU-Only:** Phi-3 Mini
- **12GB GPU:** Llama 3.1 8B (full precision)
- **8GB GPU:** Llama 3.1 8B (4-bit quantized)
- **24GB+ GPU:** Llama 3.1 70B (best accuracy)

---

## Application Integration Changes

### Current Flow (OpenAI)

```typescript
// Current implementation
async function processReceipt(imageFile: File) {
  // 1. Upload image to storage
  const imageUrl = await uploadToSupabase(imageFile);

  // 2. Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract receipt data as JSON' },
            { type: 'image_url', image_url: imageUrl }
          ]
        }
      ]
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### New Flow (Self-Hosted)

```typescript
// New implementation for self-hosted AI
async function processReceiptSelfHosted(imageFile: File) {
  // 1. Call AI Orchestrator service
  const formData = new FormData();
  formData.append('file', imageFile);

  const response = await fetch(`${AI_ORCHESTRATOR_URL}/process-receipt`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AI_SERVICE_TOKEN}`, // Local API key
    },
    body: formData
  });

  const data = await response.json();
  return data;
}
```

### AI Orchestrator Service (New Component)

Create a new service file: `/supabase/functions/ai-orchestrator/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const OCR_URL = Deno.env.get('OCR_URL') || 'http://localhost:8001';
const LLM_URL = Deno.env.get('LLM_URL') || 'http://localhost:11434';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 1. Get image from request
    const formData = await req.formData();
    const imageFile = formData.get('file') as File;

    // 2. Call OCR service
    const ocrFormData = new FormData();
    ocrFormData.append('file', imageFile);

    const ocrResponse = await fetch(`${OCR_URL}/extract`, {
      method: 'POST',
      body: ocrFormData
    });

    const ocrData = await ocrResponse.json();
    const extractedText = ocrData.text;

    // 3. Call LLM for structured extraction
    const llmResponse = await fetch(`${LLM_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        prompt: `Extract receipt data from this OCR text as JSON:

${extractedText}

Extract: vendor_name, transaction_date (YYYY-MM-DD), total_amount (number), currency, tax_amount, payment_method, items (array).

Return ONLY valid JSON.`,
        stream: false,
        format: 'json'
      })
    });

    const llmData = await llmResponse.json();
    const structuredData = JSON.parse(llmData.response);

    // 4. Return structured data
    return new Response(JSON.stringify({
      success: true,
      data: structuredData,
      ocr_text: extractedText,
      confidence: ocrData.confidence || 0.95
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

### Environment Variables to Add

Add to `.env`:

```bash
# AI Service Configuration
AI_ORCHESTRATOR_URL=http://localhost:8002
AI_SERVICE_TOKEN=your-secret-token-here

# Deployment mode: cpu, gpu, or cloud
AI_DEPLOYMENT_MODE=cpu

# OCR Service
OCR_SERVICE_URL=http://localhost:8001

# LLM Service
LLM_SERVICE_URL=http://localhost:11434
LLM_MODEL=phi3:mini  # or llama3.1:8b for GPU

# Cloud GPU (if using)
CLOUD_GPU_PROVIDER=vastai  # or runpod, aws
CLOUD_GPU_API_KEY=your-api-key
CLOUD_GPU_ENDPOINT=https://your-instance.vast.ai
```

### Frontend Changes

Update the receipt upload component:

```typescript
// src/services/receiptService.ts

// Add new function for self-hosted AI
export async function processReceiptWithSelfHostedAI(
  file: File
): Promise<ReceiptData> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${import.meta.env.VITE_AI_ORCHESTRATOR_URL}/process-receipt`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_AI_SERVICE_TOKEN}`
      },
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error('AI processing failed');
  }

  const result = await response.json();
  return result.data;
}

// Update existing function to use self-hosted by default
export async function processReceipt(file: File): Promise<ReceiptData> {
  const useSelfHosted = import.meta.env.VITE_USE_SELF_HOSTED_AI === 'true';

  if (useSelfHosted) {
    return processReceiptWithSelfHostedAI(file);
  } else {
    return processReceiptWithOpenAI(file);  // Fallback
  }
}
```

### Database Changes

Add tracking table for AI processing:

```sql
-- Track AI processing metrics
CREATE TABLE IF NOT EXISTS ai_processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id),
  deployment_mode TEXT NOT NULL, -- 'cpu', 'gpu', 'cloud', 'openai'
  ocr_time_ms INTEGER,
  llm_time_ms INTEGER,
  total_time_ms INTEGER,
  confidence_score DECIMAL(3,2),
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for analytics
CREATE INDEX idx_ai_logs_deployment ON ai_processing_logs(deployment_mode, created_at);
CREATE INDEX idx_ai_logs_receipt ON ai_processing_logs(receipt_id);
```

### Testing the Integration

```bash
# 1. Start AI services
docker-compose -f docker-compose-cpu.yml up -d

# 2. Test OCR service
curl -X POST -F "file=@test-receipt.jpg" http://localhost:8001/extract

# 3. Test LLM service
curl http://localhost:11434/api/generate -d '{
  "model": "phi3:mini",
  "prompt": "Extract JSON from: WALMART 2025-01-15 TOTAL $51.60",
  "stream": false,
  "format": "json"
}'

# 4. Test full orchestrator
curl -X POST -F "file=@test-receipt.jpg" \
  -H "Authorization: Bearer your-token" \
  http://localhost:8002/process-receipt
```

### Migration Plan

1. **Week 1: Setup**
   - Deploy AI services (CPU or GPU)
   - Create AI orchestrator
   - Add environment variables

2. **Week 2: Integration**
   - Update frontend service
   - Add fallback logic
   - Implement logging

3. **Week 3: Testing**
   - Process 100 test receipts
   - Compare with OpenAI results
   - Measure accuracy and speed

4. **Week 4: Rollout**
   - 10% traffic to self-hosted
   - Monitor errors
   - Increase gradually

5. **Week 5-6: Full Migration**
   - 100% traffic to self-hosted
   - Disable OpenAI
   - Monitor for 2 weeks

---

## Cost-Benefit Analysis

### Scenario A: Personal Use (50 receipts/month)

| Option | Setup Cost | Monthly Cost | Break-Even | Total Cost (12mo) |
|--------|-----------|--------------|------------|------------------|
| OpenAI | $0 | $1 | N/A | $12 |
| CPU-Only | $0 | $5 | Immediate | $60 |
| Local GPU | $300 | $25 | Never | $600 |
| Cloud GPU | $0 | $1 | N/A | $12 |

**Winner:** OpenAI or Cloud GPU (tie)

---

### Scenario B: Small Business (500 receipts/month)

| Option | Setup Cost | Monthly Cost | Break-Even | Total Cost (12mo) |
|--------|-----------|--------------|------------|------------------|
| OpenAI | $0 | $11 | N/A | $132 |
| CPU-Only | $0 | $5 | Immediate | $60 |
| Local GPU | $300 | $25 | 8 months | $600 |
| Cloud GPU | $0 | $8 | N/A | $96 |

**Winner:** CPU-Only (lowest total cost, adequate performance)

---

### Scenario C: Accounting Firm (2,000 receipts/month)

| Option | Setup Cost | Monthly Cost | Break-Even | Total Cost (12mo) |
|--------|-----------|--------------|------------|------------------|
| OpenAI | $0 | $44 | N/A | $528 |
| CPU-Only | $0 | $10 | Immediate | $120 |
| Local GPU | $300 | $30 | 11 months | $660 |
| Cloud GPU | $0 | $30 | N/A | $360 |

**Winner:** Local GPU (best long-term, privacy + performance)

---

### Scenario D: Enterprise (10,000 receipts/month)

| Option | Setup Cost | Monthly Cost | Break-Even | Total Cost (12mo) |
|--------|-----------|--------------|------------|------------------|
| OpenAI | $0 | $220 | N/A | $2,640 |
| CPU-Only | $0 | $30 | Immediate | $360 |
| Local GPU | $1,500 | $50 | 9 months | $2,100 |
| Cloud GPU | $0 | $150 | N/A | $1,800 |

**Winner:** Local GPU (break-even in 9 months, then massive savings)

---

## Implementation Roadmap

### Phase 1: Proof of Concept (Week 1-2)
**Goal:** Get AI running locally

**Tasks:**
1. Choose deployment mode (CPU/GPU/Cloud)
2. Set up Docker containers
3. Deploy Ollama + OCR service
4. Test with 20 sample receipts
5. Measure accuracy vs OpenAI

**Success Criteria:**
- AI services running and accessible
- 85%+ accuracy on test receipts
- Processing time <30 seconds

---

### Phase 2: Integration (Week 3-4)
**Goal:** Connect to Audit Proof app

**Tasks:**
1. Create AI orchestrator service
2. Update environment variables
3. Modify receipt upload flow
4. Add processing logs table
5. Implement fallback to OpenAI

**Success Criteria:**
- Receipts processed through self-hosted AI
- Fallback works if AI fails
- Logs captured for analysis

---

### Phase 3: Testing (Week 5-6)
**Goal:** Validate production readiness

**Tasks:**
1. Process 500 existing receipts
2. Compare accuracy with OpenAI
3. Measure latency and throughput
4. Load test with concurrent users
5. Fix any bugs/issues

**Success Criteria:**
- 90%+ accuracy match with OpenAI
- <10 second average processing time
- No crashes under load

---

### Phase 4: Gradual Rollout (Week 7-8)
**Goal:** Migrate production traffic

**Tasks:**
1. Deploy to 10% of users
2. Monitor error rates
3. Increase to 50%
4. Increase to 100%
5. Disable OpenAI integration

**Success Criteria:**
- <1% error rate
- User satisfaction maintained
- Cost savings achieved

---

## Security & Compliance

### Data Privacy Comparison

| Aspect | CPU/GPU (Local) | Cloud GPU | OpenAI |
|--------|----------------|-----------|--------|
| Data Location | Your server | Cloud provider | OpenAI servers |
| Data Retention | You control | Provider policy | OpenAI policy |
| PIPEDA Compliant | ✅ Yes | ⚠️ Depends | ❌ No |
| GDPR Compliant | ✅ Yes | ⚠️ Depends | ❌ No |
| SOC 2 Compliant | ✅ You control | ⚠️ Provider-dependent | ✅ Yes |
| Audit Trail | ✅ Complete | ⚠️ Limited | ⚠️ Limited |
| Client Data Exposure | ❌ None | ⚠️ To provider | ⚠️ To OpenAI |

---

## Conclusion & Recommendation

### For Your Situation (No GPU, Unraid Server)

**Best Starting Point: CPU-Only Deployment**

**Why:**
1. $0 investment - use existing hardware
2. 100% private - data never leaves your server
3. Good enough for <500 receipts/month
4. Easy to set up (30 minutes)
5. Can upgrade to GPU later if needed

**Next Steps:**
1. Deploy Ollama + Phi-3 Mini (CPU)
2. Deploy Tesseract OCR
3. Test with 50 receipts
4. If satisfied, migrate from OpenAI
5. Monitor volume - upgrade to GPU at 500+ receipts/month

**Hardware Upgrade Path:**
- If you reach 500+ receipts/month
- Buy used RTX 3060 12GB (~$200-250)
- Upgrade to Llama 3.1 8B + PaddleOCR
- 10x faster processing

---

## Quick Start Commands

### CPU-Only Setup (30 minutes)

```bash
# 1. Create directories
mkdir -p /mnt/user/appdata/{ollama,tesseract,ai-orchestrator}

# 2. Start Ollama
docker run -d \
  --name ollama-cpu \
  -p 11434:11434 \
  -v /mnt/user/appdata/ollama:/root/.ollama \
  ollama/ollama:latest

# 3. Pull Phi-3 Mini
docker exec ollama-cpu ollama pull phi3:mini

# 4. Test
curl http://localhost:11434/api/generate -d '{
  "model": "phi3:mini",
  "prompt": "Say hello",
  "stream": false
}'

# 5. Create Tesseract OCR service
# (See detailed setup in CPU-Only section)

# 6. Update your .env file
echo "AI_ORCHESTRATOR_URL=http://localhost:8002" >> .env
echo "AI_DEPLOYMENT_MODE=cpu" >> .env
echo "VITE_USE_SELF_HOSTED_AI=true" >> .env

# 7. Build and start
npm run build
```

**You're now running 100% private AI! 🎉**
