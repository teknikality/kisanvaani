# KisanVaani — Architecture

## Request flow

### Voice message

```
Farmer (WhatsApp)
       │
       │  OGG audio
       ▼
Meta Graph API  ──────────────────────────────────────────────────┐
       │  POST /webhook                                            │
       ▼                                                           │
  index.js                                                         │
  res.sendStatus(200)  ◄── immediate ACK (WhatsApp timeout ~5s)   │
       │                                                           │
       ▼                                                           │
  processVoice(from, mediaId)                                      │
       │                                                           │
       ├─ downloadAudio(mediaId)                                   │
       │      └─ GET /v22.0/{mediaId}  → Meta CDN URL             │
       │         GET <CDN URL>         → OGG buffer               │
       │                                                           │
       ├─ transcribe(audioBuffer)                                  │
       │      └─ Google STT (OGG_OPUS 16kHz)                      │
       │         primary: hi-IN                                    │
       │         alternatives: ta, te, mr, pa, kn, bn, gu, en     │
       │         returns: { transcript, languageCode }             │
       │                                                           │
       ├─ [session check] getSession(from)                         │
       │      if awaitingFollowUp → skip intent, use context       │
       │                                                           │
       ├─ detectIntent(transcript)  →  disease|mandi|weather|      │
       │                               scheme|general              │
       │                                                           │
       ├─ [weather intent] extractLocation → Open-Meteo            │
       │      GPT extracts city/district from transcript           │
       │      Geocoding API → lat/lon → Forecast API               │
       │      → context.weather                                    │
       │                                                           │
       ├─ [mandi intent] extractCrop + fetchMandiPrices            │
       │      data.gov.in APMC API                                 │
       │      → context.priceData (or MSP fallback)               │
       │                                                           │
       ├─ askClaude(transcript, systemPrompt)                      │
       │      └─ GPT-5.1 chat completion                           │
       │         systemPrompt injected with live context           │
       │         max_completion_tokens: 200, store: false          │
       │         → reply (2 sentences, farmer's language)          │
       │                                                           │
       ├─ synthesize(reply, languageCode)                          │
       │      └─ Google TTS Neural2/Wavenet                        │
       │         MP3, 0.9x speed, telephony profile                │
       │         → audioBuffer                                     │
       │                                                           │
       ├─ uploadAudio(audioBuffer)                                 │
       │      └─ GCS save → signed URL (15-min TTL)                │
       │         auto-delete after 15 min                          │
       │                                                           │
       ├─ sendAudioMessage(from, audioUrl)  ──────────────────────►│
       │      └─ POST /messages  type:audio                        │
       │                                                           │
       ├─ [disease intent] findMedicine(reply)                     │
       │      └─ alias match (nukta-normalized)                    │
       │         getMedicineSignedUrl(filename)                    │
       │         sendImageMessage(from, url, caption) ────────────►│
       │                                                           │
       ├─ setSession(from, { intent, query, reply, languageCode }) │
       │                                                           │
       └─ sendAudioMessage(from, followUpPromptUrl)  ─────────────►│
              "Koi aur sawaal hai?"                                │
                                                                   │
                                              WhatsApp delivers ◄──┘
```

### Image message

```
Farmer sends crop photo
       │
       ▼
  processImage(from, mediaId, caption)
       │
       ├─ downloadImage(mediaId)  → { buffer, mimeType }
       │
       ├─ diagnoseCropImage(buffer, mimeType, caption, languageCode)
       │      └─ GPT-5.1 Vision
       │         base64 image + language instruction
       │         system prompt constrains medicine to approved list
       │         → diagnosis (2 sentences, Devanagari/native script)
       │
       ├─ synthesize → uploadAudio → sendAudioMessage
       │
       ├─ findMedicine(diagnosis) → sendImageMessage (product photo)
       │
       └─ setSession → sendAudioMessage (follow-up prompt)
```

---

## Component map

```
┌─────────────────────────────────────────────────────────────────┐
│                          index.js                               │
│                                                                 │
│  ┌──────────┐  ┌─────────────┐  ┌───────────────────────────┐  │
│  │ session  │  │  processVoice│  │      processImage         │  │
│  │  store   │  │             │  │                           │  │
│  │ (5-min   │  │             │  │                           │  │
│  │  TTL)    │  └──────┬──────┘  └────────────┬──────────────┘  │
│  └──────────┘         │                      │                  │
└───────────────────────┼──────────────────────┼──────────────────┘
                        │                      │
          ┌─────────────┼──────────────────────┘
          │             │
          ▼             ▼
┌─────────────┐  ┌────────────────────────────────────────────────┐
│  voice.js   │  │                  features/                     │
│             │  │                                                │
│ downloadAudio│  │  ┌────────────┐  ┌──────────┐  ┌──────────┐  │
│ downloadImage│  │  │diagnosis.js│  │ mandi.js │  │weather.js│  │
│ transcribe  │  │  │GPT Vision  │  │data.gov.in│  │Open-Meteo│  │
│ synthesize  │  │  └────────────┘  └──────────┘  └──────────┘  │
│ uploadAudio │  │                                                │
│ sendAudio   │  │  ┌─────────────────────────────────────────┐  │
│ sendImage   │  │  │            medicineDB.js                 │  │
│getMedSignUrl│  │  │  10 medicines · aliases · normalizeHindi │  │
└─────────────┘  │  └─────────────────────────────────────────┘  │
                 └────────────────────────────────────────────────┘
                        │
          ┌─────────────┘
          │
          ▼
┌─────────────────────┐    ┌──────────────────────────────────────┐
│     router.js       │    │            claude.js                 │
│                     │    │                                      │
│ detectIntent()      │    │ askClaude(transcript, systemPrompt)  │
│ getSystemPrompt()   │    │   └─ GPT-5.1, max 200 tokens         │
│   disease           │    │      store: false                    │
│   mandi             │    │                                      │
│   weather           │    └──────────────────────────────────────┘
│   scheme            │
│   general           │
└─────────────────────┘
```

---

## Data flows by intent

### Disease (voice)

```
transcript
  → detectIntent → "disease"
  → getSystemPrompt("disease")
      injects: approved medicine list with exact Devanagari spellings
  → GPT reply: "यह झुलसा रोग है, मैनकोजेब 2 मिली प्रति लीटर..."
  → findMedicine(reply)
      normalizeHindi: strip U+093C nukta
      alias match: मैनकोजेब → mancozeb
      GCS signed URL for medicines/mancozeb.jpg
  → sendImageMessage: product photo + name + use case
```

### Mandi price

```
transcript
  → detectIntent → "mandi"
  → extractCrop: keyword map (Hindi + transliterated + English)
  → fetchMandiPrices(commodity)
      data.gov.in APMC API, last 10 records
      fallback: hardcoded 2024-25 MSP rates
  → getSystemPrompt("mandi", { priceData })
      injected: "Wheat (UP): Min 2100, Max 2300, Modal 2250..."
  → GPT: single-sentence price + sell/wait advice
```

### Weather

```
transcript
  → detectIntent → "weather"
  → extractLocation(transcript)
      GPT: extract city/district; state → capital mapping
      e.g. "Uttar Pradesh" → "Lucknow"
  → getWeather(location)
      Open-Meteo geocoding → lat/lon
      Open-Meteo forecast → temp, humidity, rain%, wind, weather_code
      farming alerts: rain>70% / temp>42°C / wind>30kmh / humidity>85%
  → getSystemPrompt("weather", { weather })
      injected: full conditions block + farming alert
  → GPT: conditions + one farming action for today
```

---

## Session / follow-up

```
After every reply:
  setSession(from, {
    lastIntent, lastQuery, lastResponse,
    awaitingFollowUp: true, languageCode,
    expiresAt: now + 5min
  })

Next message from same number within 5 minutes:
  getSession(from) → session exists + awaitingFollowUp
  → skip intent detection
  → follow-up system prompt with original Q+A as context
  → GPT answers follow-up in 3 sentences max
  → clearSession(from)
```

---

## GCS storage strategy

All files served via signed URLs (15-minute TTL). GCS bucket has Public Access Prevention enforced — no public URLs possible.

| File type | Path pattern | Lifecycle |
|---|---|---|
| Audio replies | `kisanvaani_{timestamp}.mp3` | Auto-deleted after 15 min |
| Medicine images | `medicines/{name}.jpg/.webp` | Permanent, signed per-request |

---

## Medicine matching pipeline

```
GPT reply text
  → normalizeHindi(text)
      strip U+093C (nukta): ज़→ज, क़→क
      lowercase
  → iterate aliases map
      for each alias: normalizeHindi(alias)
      substring match
  → medicineDB[key] → { name, imageUrl, use }
  → GCS signed URL → sendImageMessage
```

Aliases cover: Hindi Devanagari · transliterated Hindi · brand names (Confidor, Bavistin, Tilt...) · variant spellings GPT has been observed to produce.

GPT is constrained by prompt to only use medicines from the approved list with exact Devanagari spellings, minimizing alias lookup misses.
