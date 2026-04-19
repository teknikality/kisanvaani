# KisanVaani 🌾

A WhatsApp voice assistant for Indian farmers. Farmers send a voice note or crop photo; KisanVaani replies with spoken advice in their own language — disease diagnosis, live mandi prices, weather-based farming alerts, and government scheme information.

---

## What it does

| Input | Flow | Output |
|---|---|---|
| Voice note | STT → intent detection → GPT → TTS | Spoken reply in farmer's language |
| Crop photo | Vision AI diagnosis → TTS | Spoken diagnosis + medicine product image |
| Follow-up voice | Session context → GPT → TTS | Contextual follow-up reply |

### Supported languages

Hindi · Tamil · Telugu · Marathi · Punjabi · Kannada · Bengali · Gujarati · English (Indian)

### Intents

- **Disease** — names the pest/disease, recommends a specific chemical with dosage, sends medicine product image
- **Mandi** — live prices from data.gov.in, falls back to 2024-25 MSP rates
- **Weather** — live conditions from Open-Meteo, farming alert if rain/heat/wind/humidity threshold crossed
- **Scheme** — PM-Kisan, PM Fasal Bima, Kisan Credit Card, PM Kisan Maandhan
- **General** — open-ended agricultural advice

Every reply ends with the Kisan helpline number **1800-180-1551**.

---

## Tech stack

| Layer | Technology |
|---|---|
| Messaging | WhatsApp Business API (Meta Graph API v22.0) |
| Speech-to-text | Google Cloud Speech-to-Text (Neural2, OGG_OPUS) |
| Text-to-speech | Google Cloud Text-to-Speech (Neural2/Wavenet) |
| AI responses | OpenAI GPT-5.1 (chat completions) |
| Image diagnosis | OpenAI GPT-5.1 Vision |
| Location extraction | OpenAI GPT-5.1 (single-token extraction) |
| Weather | Open-Meteo API (no key required) |
| Mandi prices | data.gov.in APMC API |
| Audio/image storage | Google Cloud Storage (signed URLs, 15-min TTL) |
| Server | Node.js + Express |
| Session state | In-memory store with 5-minute TTL |

---

## Project structure

```
kisanvaani/
├── index.js                  # Express server, webhook handler, pipeline orchestration
├── claude.js                 # OpenAI wrapper (askClaude)
├── voice.js                  # All media I/O (download, STT, TTS, GCS upload, WhatsApp send)
├── router.js                 # Intent detection + system prompt builder
├── features/
│   ├── diagnosis.js          # Crop image diagnosis (GPT Vision)
│   ├── medicineDB.js         # Medicine lookup DB + alias matching
│   ├── mandi.js              # Live mandi price fetch + formatting
│   ├── weather.js            # Open-Meteo weather fetch
│   ├── disease.js            # (reserved)
│   ├── schemes.js            # (reserved)
│   └── uploadMedicineImages.js  # One-time GCS image upload script
└── scripts/
    ├── disable-uniform-access.js
    └── make-bucket-public.js
```

---

## Setup

### Prerequisites

- Node.js 18+
- Meta WhatsApp Business account with a verified phone number
- Google Cloud project with Speech-to-Text, Text-to-Speech, and Cloud Storage APIs enabled
- GCS service account with Storage Object Admin role
- OpenAI API key (GPT-5.1 access)
- data.gov.in API key

### Install

```bash
git clone https://github.com/teknikality/kisanvaani.git
cd kisanvaani
npm install
```

### Environment variables

Create a `.env` file:

```env
# WhatsApp
WHATSAPP_TOKEN=your_meta_access_token
WHATSAPP_PHONE_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=any_secret_string_for_webhook_verification

# OpenAI
OPENAI_API_KEY=your_openai_key

# Google Cloud — paste the entire service account JSON as a single-quoted string
GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"...","client_email":"...",...}'

# GCS bucket name (must exist, public access prevention enabled)
GCS_BUCKET_NAME=your_bucket_name

# data.gov.in
DATA_GOV_API_KEY=your_datagov_key

PORT=3000
```

### Upload medicine images (one-time)

```bash
node features/uploadMedicineImages.js
```

### Run

```bash
npm start
```

Expose port 3000 via ngrok or deploy to a server, then register the `/webhook` URL in the Meta developer console.

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full request flow, component diagram, and design decisions.

---

## Key design decisions

**Signed URLs everywhere** — GCS bucket has Public Access Prevention enforced. All audio files and medicine images are served via 15-minute signed URLs generated at send time.

**Fire-and-forget webhook** — `res.sendStatus(200)` is called immediately; all async processing happens after. WhatsApp requires a fast acknowledgment or it retries.

**Medicine constraint in prompt** — GPT is given an explicit approved medicine list with exact Devanagari spellings. This ensures `findMedicine()` can always match the recommendation to a product image.

**Devanagari nukta normalization** — U+093C (nukta) is stripped before alias matching so ज/ज़ variants of the same word always resolve.

**store: false on all OpenAI calls** — prevents context carryover between unrelated farmer queries.
