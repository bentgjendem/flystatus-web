export type WeatherInfo = {
  temp: number;
  icon: string;
};

const WEATHER_ICONS: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "❄️",
  77: "❄️",
  80: "🌧️",
  81: "🌧️",
  82: "🌧️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

function weatherIcon(code: number): string {
  return WEATHER_ICONS[code] ?? "🌡️";
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherInfo> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code` +
    `&timezone=Europe%2FOslo`;
  const res = await fetch(url);
  const data = await res.json();
  return {
    temp: Math.round(data.current.temperature_2m),
    icon: weatherIcon(data.current.weather_code),
  };
}

export async function hentVaer(): Promise<{
  oslo: WeatherInfo;
  bergen: WeatherInfo;
}> {
  const [oslo, bergen] = await Promise.all([
    fetchWeather(59.9139, 10.7522),
    fetchWeather(60.3913, 5.3221),
  ]);
  return { oslo, bergen };
}
