const medicineDB = {
  'mancozeb': {
    name: 'Mancozeb 75% WP',
    imageUrl: 'https://storage.googleapis.com/heartfit/medicines/mancozeb.jpg',
    use: 'Fungal diseases — leaf spot, blight, downy mildew',
  },
  'chlorpyrifos': {
    name: 'Chlorpyrifos 20% EC',
    imageUrl: 'https://storage.googleapis.com/heartfit/medicines/chlorpyrifos.jpg',
    use: 'Soil insects, stem borers, termites',
  },
  'imidacloprid': {
    name: 'Imidacloprid 17.8% SL',
    imageUrl: 'https://storage.googleapis.com/heartfit/medicines/imidacloprid.jpg',
    use: 'Whitefly, aphids, thrips, jassids',
  },
  'carbendazim': {
    name: 'Carbendazim 50% WP',
    imageUrl: 'https://storage.googleapis.com/heartfit/medicines/carbendazim.jpg',
    use: 'Powdery mildew, wilt, stem rot',
  },
  'copper oxychloride': {
    name: 'Copper Oxychloride 50% WP',
    imageUrl: 'https://storage.googleapis.com/heartfit/medicines/copper-oxychloride.jpg',
    use: 'Bacterial and fungal diseases',
  },
  'neem oil': {
    name: 'Neem Oil 1500 PPM',
    imageUrl: 'https://storage.googleapis.com/heartfit/medicines/neem-oil.jpg',
    use: 'Organic — aphids, mites, whitefly, powdery mildew',
  },
  'trichoderma': {
    name: 'Trichoderma Viride',
    imageUrl: 'https://storage.googleapis.com/heartfit/medicines/trichoderma.jpg',
    use: 'Soil-borne fungal diseases, wilt, root rot',
  },
  'lambda cyhalothrin': {
    name: 'Lambda Cyhalothrin 5% EC',
    imageUrl: 'https://storage.googleapis.com/heartfit/medicines/lambda-cyhalothrin.webp',
    use: 'Bollworm, pod borer, leaf eating caterpillars',
  },
  'propiconazole': {
    name: 'Propiconazole 25% EC',
    imageUrl: 'https://storage.googleapis.com/heartfit/medicines/propiconazole.jpg',
    use: 'Rust, sheath blight, leaf spot in rice and wheat',
  },
  'emamectin': {
    name: 'Emamectin Benzoate 5% SG',
    imageUrl: 'https://storage.googleapis.com/heartfit/medicines/emamectin.jpg',
    use: 'Diamondback moth, fruit borer, leaf miner',
  },
};

const aliases = {
  // mancozeb — GPT writes ऐ+न or ए+ं or ए+न interchangeably
  'मैनकोजेब': 'mancozeb', 'मैन्कोजेब': 'mancozeb', 'मेंकोजेब': 'mancozeb', 'मेन्कोजेब': 'mancozeb', 'मेनकोजेब': 'mancozeb',
  'mancozeb': 'mancozeb', 'm-45': 'mancozeb', 'dithane': 'mancozeb',
  'इंडोफिल': 'mancozeb', 'indofil': 'mancozeb', 'इन्डोफिल': 'mancozeb',
  // imidacloprid
  'इमिडाक्लोप्रिड': 'imidacloprid', 'imidacloprid': 'imidacloprid', 'confidor': 'imidacloprid', 'कॉन्फिडोर': 'imidacloprid',
  // propiconazole
  'प्रोपिकोनाज़ोल': 'propiconazole', 'propiconazole': 'propiconazole', 'tilt': 'propiconazole', 'टिल्ट': 'propiconazole',
  // carbendazim
  'कार्बेन्डाजिम': 'carbendazim', 'carbendazim': 'carbendazim', 'bavistin': 'carbendazim', 'बाविस्टिन': 'carbendazim',
  // copper oxychloride — GPT sometimes writes ऑक्सी क्लोराइड with a space
  'कॉपर ऑक्सीक्लोराइड': 'copper oxychloride', 'कॉपर ऑक्सी क्लोराइड': 'copper oxychloride',
  'copper oxychloride': 'copper oxychloride', 'blitox': 'copper oxychloride', 'कॉपर ऑक्सी': 'copper oxychloride',
  // chlorpyrifos
  'क्लोरपाइरीफॉस': 'chlorpyrifos', 'chlorpyrifos': 'chlorpyrifos', 'dursban': 'chlorpyrifos',
  // neem oil
  'नीम ऑयल': 'neem oil', 'नीम तेल': 'neem oil', 'neem oil': 'neem oil',
  // lambda cyhalothrin
  'लैम्बडा साइहैलोथ्रिन': 'lambda cyhalothrin', 'lambda cyhalothrin': 'lambda cyhalothrin', 'karate': 'lambda cyhalothrin',
  // emamectin
  'इमामेक्टिन': 'emamectin', 'emamectin': 'emamectin', 'proclaim': 'emamectin',
  // trichoderma
  'ट्राइकोडर्मा': 'trichoderma', 'trichoderma': 'trichoderma',
  // metalaxyl+mancozeb combo — maps to mancozeb; GPT spells मेटालेक्जिल or मेटलेक्सिल
  'मेटलेक्सिल': 'mancozeb', 'मेटालेक्जिल': 'mancozeb', 'मेटालेक्सिल': 'mancozeb',
  'metalaxyl': 'mancozeb', 'ridomil': 'mancozeb', 'रिडोमिल': 'mancozeb', 'रिडोमिल गोल्ड': 'mancozeb',
};

function normalizeHindi(text) {
  // Remove Devanagari nukta (U+093C) so ज़→ज, क़→क, etc.
  // This ensures मैनकोज़ेब and मैनकोजेब both match
  return text.replace(/\u093C/g, '').toLowerCase();
}

function findMedicine(diagnosisText) {
  const normalized = normalizeHindi(diagnosisText);
  for (const [alias, key] of Object.entries(aliases)) {
    if (normalized.includes(normalizeHindi(alias))) {
      return medicineDB[key] || null;
    }
  }
  console.log('[MEDICINE] No match found in diagnosis text');
  return null;
}

module.exports = { medicineDB, findMedicine };
