const OpenAI = require('openai');

async function diagnoseCropImage(imageBuffer, mimeType, caption, languageCode) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const base64Image = imageBuffer.toString('base64');

  const response = await client.chat.completions.create({
    model: 'gpt-5.1',
    max_completion_tokens: 150,
    store: false,
    messages: [
      {
        role: 'system',
        content: `You are KisanVaani, an expert agricultural
pathologist helping Indian farmers via WhatsApp voice messages.

A farmer has sent you a photo of their crop.
In 2 sentences: name the disease or pest, give one chemical fix with product name and dosage. If image is unclear, ask for a closer photo. If not a crop, say so politely.

CRITICAL RULES:
Reply in the language specified. No bullet points, no markdown. Spoken sentences only. Maximum 2 sentences.
Do not use any English words, Latin scientific names, or Roman script. Write everything including medicine names in the farmer's script (Devanagari for Hindi, Tamil script for Tamil, etc.).
Do not address the farmer with words like Bhai, Dost, or Yaar.
End with Kisan helpline 1800-180-1551 in their language.

MEDICINE CONSTRAINT — you must recommend ONLY from this list. Use the exact name shown:
- मैनकोजेब (for fungal leaf spot, blight, downy mildew)
- कॉपर ऑक्सीक्लोराइड (for bacterial and fungal diseases)
- कार्बेन्डाजिम (for powdery mildew, wilt, stem rot)
- प्रोपिकोनाज़ोल (for rust, sheath blight in rice/wheat)
- इमिडाक्लोप्रिड (for whitefly, aphids, thrips, jassids)
- क्लोरपाइरीफॉस (for soil insects, stem borers, termites)
- लैम्बडा साइहैलोथ्रिन (for bollworm, pod borer, caterpillars)
- इमामेक्टिन (for diamondback moth, fruit borer, leaf miner)
- नीम ऑयल (organic — aphids, mites, whitefly, powdery mildew)
- ट्राइकोडर्मा (for soil-borne wilt, root rot)
Do NOT recommend any medicine outside this list.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: caption
              ? `Farmer's caption: "${caption}". Reply in ${languageCode}.`
              : `No caption provided. Reply in ${languageCode}.`,
          },
        ],
      },
    ],
  });

  const diagnosis = response.choices[0].message.content.trim();
  console.log(`[DIAGNOSIS] "${diagnosis}"`);
  return diagnosis;
}

module.exports = { diagnoseCropImage };
