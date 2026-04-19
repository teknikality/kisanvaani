const axios = require('axios');
const { SpeechClient } = require('@google-cloud/speech');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { Storage } = require('@google-cloud/storage');

async function downloadAudio(mediaId) {
  try {
    const metaRes = await axios.get(
      `https://graph.facebook.com/v22.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
    );

    const audioRes = await axios.get(metaRes.data.url, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(audioRes.data);
    console.log(`[DOWNLOAD] ${buffer.length} bytes for media ${mediaId}`);
    return buffer;
  } catch (e) {
    throw new Error('DOWNLOAD_FAILED');
  }
}

async function transcribe(audioBuffer) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const client = new SpeechClient({ credentials });

  const [response] = await client.recognize({
    audio: { content: audioBuffer.toString('base64') },
    config: {
      encoding: 'OGG_OPUS',
      sampleRateHertz: 16000,
      languageCode: 'hi-IN',
      alternativeLanguageCodes: [
        'ta-IN', 'te-IN', 'mr-IN',
        'pa-IN', 'kn-IN', 'bn-IN',
        'gu-IN', 'en-IN',
      ],
      model: 'latest_long',
      useEnhanced: true,
      enableAutomaticPunctuation: true,
    },
  });

  const transcript = response.results
    .map(r => r.alternatives[0].transcript)
    .join(' ')
    .trim();

  const languageCode = response.results[0]?.languageCode || 'hi-IN';

  if (!transcript) {
    throw new Error('EMPTY_TRANSCRIPT');
  }

  console.log(`[STT] ${languageCode} | "${transcript}"`);
  return { transcript, languageCode };
}

async function synthesize(text, languageCode) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const ttsClient = new TextToSpeechClient({ credentials });

  const voiceMap = {
    'hi-IN': 'hi-IN-Neural2-A',
    'ta-IN': 'ta-IN-Neural2-A',
    'te-IN': 'te-IN-Neural2-A',
    'mr-IN': 'mr-IN-Wavenet-A',
    'pa-IN': 'pa-IN-Wavenet-A',
    'kn-IN': 'kn-IN-Neural2-A',
    'bn-IN': 'bn-IN-Neural2-A',
    'gu-IN': 'gu-IN-Neural2-A',
    'en-IN': 'en-IN-Neural2-A',
  };

  const [ttsResponse] = await ttsClient.synthesizeSpeech({
    input: { text },
    voice: {
      languageCode,
      name: voiceMap[languageCode] || 'hi-IN-Neural2-A',
      ssmlGender: 'FEMALE',
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 0.9,
      pitch: 0.0,
      effectsProfileId: ['telephony-class-application'],
    },
  });

  const buffer = Buffer.from(ttsResponse.audioContent);
  console.log(`[TTS] ${buffer.length} bytes in ${languageCode}`);
  return buffer;
}

async function uploadAudio(audioBuffer) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const storage = new Storage({ credentials, projectId: credentials.project_id });
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

  const filename = `kisanvaani_${Date.now()}.mp3`;
  const file = bucket.file(filename);

  await file.save(audioBuffer, {
    metadata: { contentType: 'audio/mpeg' },
    resumable: false,
  });

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000,
  });

  setTimeout(async () => {
    try { await file.delete(); } catch (e) {}
  }, 15 * 60 * 1000);

  console.log(`[UPLOAD] ${signedUrl}`);
  return signedUrl;
}

async function sendAudioMessage(to, audioUrl) {
  const response = await axios.post(
    `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'audio',
      audio: { link: audioUrl },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Meta send failed: ${JSON.stringify(response.data)}`);
  }

  console.log(`[SEND] Audio sent to ${to}`);
}

module.exports = { downloadAudio, transcribe, synthesize, uploadAudio, sendAudioMessage };

if (require.main === module) {
  require('dotenv').config();
  (async () => {
    console.log('Testing synthesize + upload...');
    const { synthesize, uploadAudio } = module.exports;
    const buf = await synthesize(
      'नमस्ते, यह KisanVaani का परीक्षण है।',
      'hi-IN'
    );
    console.log(`Synthesized: ${buf.length} bytes`);
    const url = await uploadAudio(buf);
    console.log('Public URL:', url);
    console.log('Open in browser to confirm audio plays');
    process.exit(0);
  })().catch(e => {
    console.error('Test failed:', e.message);
    process.exit(1);
  });
}
