export type LocationRow = {
  id: string;
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  created_at: string;
};

export type FavoriteLocationRow = {
  user_id: string;
  location_id: string;
  created_at: string;
};

export type CurrentWeatherRow = {
  location_id: string;
  temperature_c: number | null;
  apparent_temperature_c: number | null;
  relative_humidity: number | null;
  wind_speed_kmh: number | null;
  precipitation: number | null;
  weather_code: number | null;
  is_day: boolean | null;
  observed_at: string | null;
  updated_at: string;
};

