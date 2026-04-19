require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { downloadAudio, transcribe, synthesize, uploadAudio, sendAudioMessage } = require('./voice');

const app = express();
app.use(express.json());

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
  } else if (type === 'text') {
    processText(from, message.text.body);
  } else {
    sendTextMessage(from, '🌾 Voice note ya text message bhejein.');
  }
});

async function processVoice(from, mediaId) {
  try {
    await sendTextMessage(from, '🎤 Suna ja raha hai...');

    const audioBuffer = await downloadAudio(mediaId);
    const { transcript, languageCode } = await transcribe(audioBuffer);

    await sendTextMessage(from, `"${transcript}"`);

    const replyBuffer = await synthesize(transcript, languageCode);
    const audioUrl = await uploadAudio(replyBuffer);
    await sendAudioMessage(from, audioUrl);
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

async function processText(from, text) {
  await sendTextMessage(from,
    '🌾 Voice note bhejein — main sunkar jawab dunga.');
}

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
