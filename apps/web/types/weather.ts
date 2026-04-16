export type Location = {
  id: string;
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  created_at: string;
};

export type FavoriteLocation = {
  user_id: string;
  location_id: string;
  created_at: string;
};

export type CurrentWeather = {
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

export type TemperatureUnit = "c" | "f";
export type WindSpeedUnit = "kmh" | "mph";
export type TimezoneDisplay = "location" | "utc";
export type TimeFormat = "12h" | "24h";

export type UserPreferences = {
  user_id: string;
  temperature_unit: TemperatureUnit;
  wind_speed_unit: WindSpeedUnit;
  default_location_id: string | null;
  timezone_display: TimezoneDisplay;
  time_format: TimeFormat;
  alerts_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type DailyForecast = {
  location_id: string;
  forecast_date: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  precipitation_sum_mm: number | null;
  precipitation_probability_max: number | null;
  wind_speed_max_kmh: number | null;
  weather_code: number | null;
  sunrise: string | null;
  sunset: string | null;
  uv_index_max: number | null;
  updated_at: string;
};

export type HourlyForecast = {
  location_id: string;
  forecast_time: string;
  temperature_c: number | null;
  precipitation_probability: number | null;
  wind_speed_kmh: number | null;
  weather_code: number | null;
  is_day: boolean | null;
  updated_at: string;
};

export type AlertRuleType = "precipitation" | "temperature_max" | "wind_speed";
export type AlertComparator = "gt" | "gte" | "lt" | "lte";

export type AlertRule = {
  id: string;
  user_id: string;
  location_id: string | null;
  rule_type: AlertRuleType;
  comparator: AlertComparator;
  threshold: number;
  horizon_days: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type SyncRunStatus = "running" | "success" | "partial" | "failed";

export type SyncRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: SyncRunStatus;
  locations_total: number;
  locations_ok: number;
  locations_failed: number;
  poll_interval_ms: number | null;
  open_meteo_base_url: string | null;
  source_http_status: number | null;
  error_message: string | null;
  created_at: string;
};
