const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
require('dotenv').config();

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const storage = new Storage({ credentials, projectId: credentials.project_id });
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

const imagesToUpload = [
  {
    filename: 'medicines/mancozeb.jpg',
    url: 'https://cdn.shopify.com/s/files/1/0722/2059/files/indofil-m-45-fungicide-file-2528.jpg',
  },
  {
    filename: 'medicines/imidacloprid.jpg',
    url: 'https://cdn.shopify.com/s/files/1/0722/2059/files/confidor-file-673.jpg',
  },
  {
    filename: 'medicines/carbendazim.jpg',
    url: 'https://cdn.shopify.com/s/files/1/0722/2059/files/biostadt-bavistin-50-df-fungicide-file-2641.jpg',
  },
  {
    filename: 'medicines/propiconazole.jpg',
    url: 'https://cdn.shopify.com/s/files/1/0722/2059/files/tilt-fungicide-file-20079_3956a186-49b2-4d72-a6d0-5a1e4243ad58.jpg',
  },
  {
    filename: 'medicines/lambda-cyhalothrin.webp',
    url: 'https://cdn.shopify.com/s/files/1/0722/2059/files/karate-insecticide-file-3008.webp',
  },
  {
    filename: 'medicines/neem-oil.jpg',
    url: 'https://cdn.shopify.com/s/files/1/0722/2059/files/katyayani-activated-neem-oil-bio-pesticide-file-9952.jpg',
  },
];

async function uploadImage(filename, sourceUrl) {
  try {
    const response = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const contentType = filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const file = bucket.file(filename);
    await file.save(Buffer.from(response.data), {
      metadata: { contentType },
      resumable: false,
    });
    console.log(`✓ Uploaded: ${filename}`);
  } catch (err) {
    console.error(`✗ Failed: ${filename} — ${err.message}`);
  }
}

(async () => {
  for (const img of imagesToUpload) {
    await uploadImage(img.filename, img.url);
  }
  console.log('Done.');
})();
