# KisanVaani 🌾

A WhatsApp voice assistant for Indian farmers. Farmers send a voice note or crop photo; KisanVaani replies with spoken advice in their own language — disease diagnosis, live mandi prices, weather-based farming alerts, and government scheme information.

---

## The problem

India has 140 million farming households. The vast majority are smallholder farmers — typically under 2 hectares — operating with thin margins and almost no access to real-time agronomic advice.

### Pain points

**Information is inaccessible when it matters most**
A crop disease spreads in 48–72 hours. The nearest Krishi Vigyan Kendra (agricultural extension centre) may be 30–50 km away and unreachable by phone. By the time a farmer gets advice, 20–40% of yield can already be lost. There are roughly 700 KVK centres for 140 million farming families — one centre per 200,000 families.

**Literacy and language barriers block digital tools**
~40% of rural Indian adults have low functional literacy. Existing agri-apps require reading menus, typing queries, and navigating UI — creating an effective exclusion of the farmers who need help most. Nine major farming languages fragment the market further; most tools only support Hindi or English.

**Price discovery is opaque and exploited**
Farmers typically sell through commission agents (arhatiyas) who control price information. A farmer who doesn't know the mandi rate for their crop that day negotiates blind. Studies by NCAER and IIM-A show farmgate prices average 20–30% below mandi modal prices because of this information asymmetry.

**Scheme benefits go unclaimed**
PM-Kisan alone has ₹20,000+ crore in pending unclaimed installments annually due to registration failures and lack of awareness. Farmers don't know which schemes they qualify for or how to register.

**Pesticide misuse causes both crop loss and health harm**
Without diagnosis, farmers default to broad-spectrum pesticides — often the wrong chemical for the pest, at wrong dosages. This increases input costs by ₹2,000–5,000 per acre annually and contributes to pesticide resistance. The WHO estimates 385 million acute pesticide poisoning cases per year globally, heavily concentrated in developing-world smallholder agriculture.

---

## Impact

### Direct value per interaction

| Query type | Typical outcome without KisanVaani | With KisanVaani |
|---|---|---|
| Crop disease | Wrong pesticide or delayed treatment, 15–40% yield loss | Correct diagnosis + chemical in <60 seconds |
| Mandi price | Sells at arhitiya's quoted rate | Knows modal price, negotiates or waits |
| Weather | Sprays on a rain day, chemical washes off | Warned in advance, reschedules |
| Scheme | Misses registration deadline or doesn't know scheme exists | Told exactly what to carry and where to go |

### Scale of opportunity

- 600 million people depend on Indian agriculture for income
- WhatsApp has 530 million active users in India — the highest penetration of any app, including in rural areas
- A single WhatsApp Business number can serve unlimited inbound queries with no marginal cost per message

---

## Scalability

KisanVaani is stateless by design. The server holds only a 5-minute session cache per active conversation; everything else is computed on request.

**Horizontal scaling** — Any number of Node.js instances can run behind a load balancer. The session store can be migrated from in-memory to Redis with a single-file change to add TTL-based persistence. The webhook is fire-and-forget; each request is independent.

**Language scaling** — Adding a new language requires one entry in the TTS voice map and one entry in the follow-up prompts dictionary. Google STT auto-detects from a configurable list of alternativeLanguageCodes. GPT inherits the language from the transcript.

**Intent scaling** — New intents (soil testing, seed recommendations, crop insurance filing) follow the same pattern: add keywords to `detectIntent()`, add a case to `getSystemPrompt()`, optionally add a data-fetch function under `features/`.

**Cost profile at scale**

| Component | Cost driver | At 1M queries/month |
|---|---|---|
| Google STT | ~$0.006/15 sec audio | ~$6,000 |
| Google TTS | ~$0.000016/character | ~$800 (avg 50 chars/reply) |
| GPT-5.1 | ~$0.002/1K tokens | ~$4,000 (avg 400 tokens/query) |
| GCS | Negligible (auto-delete audio) | <$50 |
| WhatsApp | Free for farmer-initiated messages (24h window) | $0 |

Total estimated cost at 1M queries/month: **~$11,000** (~₹0.9 per query). Revenue per query via agri-input affiliate, scheme registration, or B2B API licensing easily exceeds this.

---

## Sustainability

**Revenue pathways**

- **Agri-input affiliate** — When KisanVaani recommends a pesticide, it can link to an e-commerce purchase (BigHaat, DeHaat, AgroStar). Commission per transaction: ₹15–80.
- **B2B API** — Seed companies, FPOs (Farmer Producer Organisations), and state government extension services pay per-query or per-seat for white-label access.
- **Government scheme facilitation** — CSC (Common Service Centres) pay per successful scheme registration completed through the platform.
- **Agronomic data** — Anonymised, aggregated query data (which diseases are spiking where, which crops farmers are price-checking) has commercial value to commodity traders, input companies, and insurers.
- **Crop insurance upsell** — PM Fasal Bima enrolment, which currently has low uptake, can be triggered during a disease or weather interaction.

**Unit economics** — The marginal cost of one query is under ₹1. A farmer who avoids one wrong pesticide purchase saves ₹500–2,000. Even a 0.1% conversion on affiliate links at average order value ₹300 covers infrastructure at scale.

**Non-revenue moats** — Trust built through correct, timely advice in a farmer's own language compounds over time. A farmer who got the right diagnosis once returns for every subsequent problem. Churn is near zero once the habit is formed.

---

## The moat

KisanVaani's defensibility does not come from any single technology — it comes from a combination that is difficult to replicate quickly.

**1. Voice-first in the farmer's language, not translated from English**
Every prompt is written for spoken output: no bullet points, no markdown, max 2 sentences, 0.9x speech rate, telephony audio profile. The language detection is automatic — a Punjabi farmer gets Punjabi back without choosing anything. This is not a feature flag on top of a text product. The entire system is voice-native.

**2. Distribution via WhatsApp — zero install friction**
WhatsApp already has 530M Indian users. There is no app to download, no account to create, no onboarding. A farmer who has never used a smartphone app beyond calls and WhatsApp can use KisanVaani in under 10 seconds. Any competitor building a standalone app faces an insurmountable distribution disadvantage against an embedded WhatsApp experience.

**3. Real-time data integrations a pure LLM cannot replicate**
A GPT chatbot can give general advice. KisanVaani gives today's mandi price for the specific crop in the farmer's region, today's weather for the farmer's district with a specific farming alert, and live government data. These integrations are invisible to the farmer but eliminate the most common failure mode of AI agricultural assistants — confidently wrong generalizations.

**4. Agronomic trust loop**
Each correct diagnosis or price prediction strengthens the farmer's reliance on the tool. The first interaction is functional; the tenth is habitual. Word-of-mouth in rural India travels through village networks, not social media — one farmer telling two neighbours during chai is how rural products spread. This compounding trust cannot be bought with marketing spend.

**5. Data flywheel**
Every query is a signal: which disease is spreading in which district this week, which crop price is being checked most in which state, which scheme questions spike after a government announcement. This data, aggregated at scale, becomes a proprietary early-warning layer for crop disease outbreaks, price intelligence for input companies, and demand forecasting for lenders — none of which a competitor can replicate without the query volume.

**6. Low cost of acquisition, high cost of switching**
A farmer acquires KisanVaani by saving a WhatsApp number. Switching requires learning a new interface, trusting a new source, and abandoning the conversation history and follow-up context they've built. The barrier is low to enter and high to leave.

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
