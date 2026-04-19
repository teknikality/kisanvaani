require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { downloadAudio, downloadImage, transcribe, synthesize, uploadAudio, sendAudioMessage, sendImageMessage, getMedicineSignedUrl } = require('./voice');
const { askClaude } = require('./claude');
const { detectIntent, getSystemPrompt } = require('./router');
const { extractCrop, fetchMandiPrices, formatPriceData } = require('./features/mandi');
const { diagnoseCropImage } = require('./features/diagnosis');
const { findMedicine } = require('./features/medicineDB');
const { getWeather } = require('./features/weather');

const app = express();
app.use(express.json());

// ─── Session store ────────────────────────────────────────────
const sessionStore = {};

function getSession(from) {
  const session = sessionStore[from];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete sessionStore[from];
    return null;
  }
  return session;
}

function setSession(from, data) {
  sessionStore[from] = {
    ...data,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
}

function clearSession(from) {
  delete sessionStore[from];
}

const followUpPrompts = {
  'hi-IN': 'Koi aur sawaal hai is baare mein? (haan/nahi ya seedha poochh lein)',
  'ta-IN': 'இதைப் பற்றி வேறு கேள்வி உள்ளதா?',
  'te-IN': 'దీని గురించి మరో ప్రశ్న ఉందా?',
  'mr-IN': 'याबद्दल आणखी काही प्रश्न आहे का?',
  'pa-IN': 'ਇਸ ਬਾਰੇ ਕੋਈ ਹੋਰ ਸਵਾਲ ਹੈ?',
  'en-IN': 'Any follow-up question about this?',
};

// ─── Routes ───────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', (req, res) => {
  res.sendStatus(200);

  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return;

  const from = message.from;
  const type = message.type;

  console.log(`[MSG] from=${from} type=${type}`);

  if (type === 'audio') {
    processVoice(from, message.audio.id);
  } else if (type === 'image') {
    const caption = message.image?.caption || '';
    processImage(from, message.image.id, caption, 'hi-IN');
  } else if (type === 'text') {
    processText(from, message.text.body);
  } else {
    sendTextMessage(from, '🌾 Photo, voice note, ya text message bhejein.');
  }
});

// ─── Voice pipeline ───────────────────────────────────────────
async function processVoice(from, mediaId) {
  try {
    await sendTextMessage(from, '🎤 Suna ja raha hai...');

    const audioBuffer = await downloadAudio(mediaId);
    const { transcript, languageCode } = await transcribe(audioBuffer);

    // ── Follow-up check ──
    const session = getSession(from);
    if (session?.awaitingFollowUp) {
      const followUpSystemPrompt = `You are KisanVaani answering
a follow-up question from an Indian farmer.

Context of original conversation:
Original question: "${session.lastQuery}"
Your previous answer: "${session.lastResponse}"
Original topic: ${session.lastIntent}

Now answer their follow-up question using this context.
Be concise — they already have the main answer.

CRITICAL RULES:
Reply in EXACTLY the same language as before: ${session.languageCode}
Spoken sentences only, no formatting. Maximum 3 sentences.
Do not start your reply with any address word — no Bhai, Bhai Sahab, Dost, Yaar, Sahab, Ji, or any equivalent. Begin directly with the information.
End with Kisan helpline 1800-180-1551 in their language.`;

      const followUpReply = await askClaude(transcript, followUpSystemPrompt);
      await sendTextMessage(from, followUpReply);

      const followUpAudio = await synthesize(followUpReply, session.languageCode);
      const followUpUrl = await uploadAudio(followUpAudio);
      await sendAudioMessage(from, followUpUrl);

      clearSession(from);
      return;
    }

    // ── Main intent flow ──
    const intent = detectIntent(transcript);
    console.log(`[INTENT] ${intent}`);

    const context = {};
    if (intent === 'weather') {
      try {
        const location = await extractLocation(transcript);
        console.log(`[WEATHER] Extracted location: ${location}`);
        if (location) {
          context.weather = await getWeather(location);
        }
      } catch (e) {
        console.error('[WEATHER] Failed:', e.message);
      }
    }

    if (intent === 'mandi') {
      const crop = extractCrop(transcript);
      if (crop) {
        try {
          const records = await fetchMandiPrices(crop);
          context.priceData = formatPriceData(crop, records);
        } catch (e) {
          console.error('[MANDI] Price fetch failed:', e.message);
        }
      }
    }

    const reply = await askClaude(transcript, getSystemPrompt(intent, context));
    const replyBuffer = await synthesize(reply, languageCode);
    const audioUrl = await uploadAudio(replyBuffer);
    await sendAudioMessage(from, audioUrl);

    if (intent === 'disease') {
      const medicine = findMedicine(reply);
      if (medicine) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const gcsFilename = medicine.imageUrl.replace(`https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/`, '');
        const signedMedicineUrl = await getMedicineSignedUrl(gcsFilename);
        await sendImageMessage(from, signedMedicineUrl, `💊 ${medicine.name}\n${medicine.use}`);
        console.log(`[MEDICINE] Sent image for ${medicine.name}`);
      }
    }

    // Save session and prompt follow-up
    setSession(from, {
      lastIntent: intent,
      lastQuery: transcript,
      lastResponse: reply,
      awaitingFollowUp: true,
      languageCode,
    });
    const followUpText = followUpPrompts[languageCode] || followUpPrompts['hi-IN'];
    const followUpPromptAudio = await synthesize(followUpText, languageCode);
    const followUpPromptUrl = await uploadAudio(followUpPromptAudio);
    await sendAudioMessage(from, followUpPromptUrl);

  } catch (err) {
    console.error('[ERROR] processVoice:', err.message);
    if (err.message === 'EMPTY_TRANSCRIPT') {
      await sendTextMessage(from,
        '🎤 Awaaz clearly nahi aayi. Thoda seedha mic ke paas bolein aur dobara bhejein.');
    } else if (err.message === 'DOWNLOAD_FAILED') {
      await sendTextMessage(from,
        'Audio download nahi hua. Dobara try karein.');
    } else {
      await sendTextMessage(from,
        'Kuch gadbad ho gayi. Thodi der baad try karein.');
    }
  }
}

// ─── Image pipeline ───────────────────────────────────────────
async function processImage(from, mediaId, caption, languageCode = 'hi-IN') {
  try {
    await sendTextMessage(from, '📸 Photo dekh raha hun...');

    const { buffer, mimeType } = await downloadImage(mediaId);
    const diagnosis = await diagnoseCropImage(buffer, mimeType, caption, languageCode);

    const audioBuffer = await synthesize(diagnosis, languageCode);
    const audioUrl = await uploadAudio(audioBuffer);
    await sendAudioMessage(from, audioUrl);

    const medicine = findMedicine(diagnosis);
    if (medicine) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const gcsFilename = medicine.imageUrl.replace(`https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/`, '');
      const signedMedicineUrl = await getMedicineSignedUrl(gcsFilename);
      await sendImageMessage(from, signedMedicineUrl, `💊 ${medicine.name}\n${medicine.use}`);
      console.log(`[MEDICINE] Sent image for ${medicine.name}`);
    }

    setSession(from, {
      lastIntent: 'disease',
      lastQuery: caption || 'crop photo sent',
      lastResponse: diagnosis,
      awaitingFollowUp: true,
      languageCode,
    });
    const followUpText = followUpPrompts[languageCode] || followUpPrompts['hi-IN'];
    const followUpPromptAudio = await synthesize(followUpText, languageCode);
    const followUpPromptUrl = await uploadAudio(followUpPromptAudio);
    await sendAudioMessage(from, followUpPromptUrl);

  } catch (err) {
    console.error('[ERROR] processImage:', err.message);
    await sendTextMessage(from,
      '📸 Photo process nahi ho saka. Dobara try karein.');
  }
}

// ─── Location extractor ───────────────────────────────────────
async function extractLocation(transcript) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: 'gpt-5.1',
    max_completion_tokens: 20,
    store: false,
    messages: [
      { role: 'system', content: 'Extract the city or district name from the message. If only a state name is mentioned, return its capital city (e.g. Uttar Pradesh → Lucknow, Maharashtra → Mumbai, Punjab → Chandigarh, Rajasthan → Jaipur, Gujarat → Ahmedabad, Karnataka → Bengaluru, Tamil Nadu → Chennai, Andhra Pradesh → Amaravati, Telangana → Hyderabad, Bihar → Patna, West Bengal → Kolkata, Madhya Pradesh → Bhopal, Haryana → Chandigarh). Reply with just the place name in English, nothing else. If no location found at all, reply with: NONE' },
      { role: 'user', content: transcript },
    ],
  });
  const result = response.choices[0].message.content.trim();
  return result === 'NONE' ? null : result;
}

// ─── Text handler ─────────────────────────────────────────────
async function processText(from, text) {
  await sendTextMessage(from,
    '🌾 Voice note bhejein — main sunkar jawab dunga.');
}

// ─── WhatsApp sender ──────────────────────────────────────────
async function sendTextMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

module.exports = { sendTextMessage };

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`KisanVaani running on port ${PORT}`)
);
