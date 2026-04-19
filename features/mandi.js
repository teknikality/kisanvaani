const axios = require('axios');

const CROP_MAP = {
  // Hindi/transliterated
  'गेहूं': 'Wheat', 'gehun': 'Wheat', 'wheat': 'Wheat',
  'चावल': 'Rice', 'chawal': 'Rice', 'rice': 'Rice',
  'धान': 'Paddy', 'dhan': 'Paddy', 'paddy': 'Paddy',
  'कपास': 'Cotton', 'kapas': 'Cotton', 'cotton': 'Cotton',
  'सोयाबीन': 'Soyabean', 'soybean': 'Soyabean', 'soya': 'Soyabean',
  'मक्का': 'Maize', 'makka': 'Maize', 'maize': 'Maize', 'corn': 'Maize',
  'सरसों': 'Mustard', 'sarson': 'Mustard', 'mustard': 'Mustard',
  'अरहर': 'Arhar', 'arhar': 'Arhar', 'tur': 'Arhar', 'toor': 'Arhar',
  'मूंग': 'Moong', 'moong': 'Moong',
  'मूंगफली': 'Groundnut', 'mungfali': 'Groundnut', 'groundnut': 'Groundnut',
  'गन्ना': 'Sugarcane', 'ganna': 'Sugarcane', 'sugarcane': 'Sugarcane',
  'प्याज': 'Onion', 'pyaj': 'Onion', 'onion': 'Onion',
  'टमाटर': 'Tomato', 'tamatar': 'Tomato', 'tomato': 'Tomato',
  'आलू': 'Potato', 'aloo': 'Potato', 'potato': 'Potato',
  'चना': 'Gram', 'chana': 'Gram', 'gram': 'Gram',
  'उड़द': 'Black Gram', 'urad': 'Black Gram',
};

function extractCrop(transcript) {
  const t = transcript.toLowerCase();
  for (const [keyword, commodity] of Object.entries(CROP_MAP)) {
    if (t.includes(keyword.toLowerCase())) return commodity;
  }
  return null;
}

async function fetchMandiPrices(commodity) {
  const response = await axios.get(
    'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070',
    {
      params: {
        'api-key': process.env.DATA_GOV_API_KEY,
        format: 'json',
        limit: 10,
        'filters[commodity]': commodity,
      },
    }
  );

  const records = response.data.records || [];
  console.log(`[MANDI] ${records.length} records for ${commodity}`);
  return records;
}

function formatPriceData(commodity, records) {
  if (!records || records.length === 0) {
    return `No live price data found for ${commodity} today.`;
  }

  const lines = records.map(r =>
    `${r.market} (${r.state}): Min ${r.min_price}, Max ${r.max_price}, Modal ${r.modal_price} rupees per quintal on ${r.arrival_date}`
  );

  return `Live mandi prices for ${commodity} today:\n${lines.join('\n')}`;
}

module.exports = { extractCrop, fetchMandiPrices, formatPriceData };
