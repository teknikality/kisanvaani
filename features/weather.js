const axios = require('axios');

function getWeatherDescription(code) {
  if (code === 0) return 'clear sky';
  if (code <= 3) return 'partly cloudy';
  if (code <= 48) return 'foggy';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rainy';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain showers';
  if (code <= 99) return 'thunderstorm';
  return 'cloudy';
}

async function getWeather(location) {
  const geoRes = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name: location, count: 1, language: 'en', format: 'json' },
  });

  if (!geoRes.data.results || geoRes.data.results.length === 0) {
    throw new Error('LOCATION_NOT_FOUND');
  }

  const { latitude, longitude, name: resolvedCityName } = geoRes.data.results[0];

  const weatherRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude,
      longitude,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation_probability',
        'weather_code',
        'windspeed_10m',
      ].join(','),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'weather_code',
      ].join(','),
      timezone: 'Asia/Kolkata',
      forecast_days: 1,
    },
  });

  const { current, daily } = weatherRes.data;

  const currentTemp = Math.round(current.temperature_2m);
  const feelsLike = Math.round(current.apparent_temperature);
  const humidity = current.relative_humidity_2m;
  const rainChance = current.precipitation_probability;
  const windSpeed = Math.round(current.windspeed_10m);
  const maxTemp = Math.round(daily.temperature_2m_max[0]);
  const minTemp = Math.round(daily.temperature_2m_min[0]);
  const description = getWeatherDescription(current.weather_code);

  let farmingAlert = null;
  if (rainChance > 70) {
    farmingAlert = 'heavy rain likely — avoid spraying today';
  } else if (currentTemp > 42) {
    farmingAlert = 'extreme heat — irrigate in evening only';
  } else if (windSpeed > 30) {
    farmingAlert = 'high winds — do not spray, wait for calm weather';
  } else if (humidity > 85) {
    farmingAlert = 'high humidity — watch for fungal disease outbreak';
  }

  console.log(`[WEATHER] ${resolvedCityName} | ${currentTemp}°C | ${description} | rain:${rainChance}%`);

  return {
    location: resolvedCityName,
    currentTemp,
    feelsLike,
    humidity,
    rainChance,
    windSpeed,
    maxTemp,
    minTemp,
    description,
    farmingAlert,
  };
}

module.exports = { getWeather };
