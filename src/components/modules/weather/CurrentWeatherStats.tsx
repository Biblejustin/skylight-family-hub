import { CloudRain, Droplets, Wind, Gauge, Eye, Thermometer } from 'lucide-react';
import { WeatherStat } from '../WeatherStat';
import type { WeatherConfig } from '@/types/config';
import type { HourlyWeather } from '@/lib/weather';

interface CurrentWeatherStatsProps {
  config: WeatherConfig;
  current: HourlyWeather;
  units: 'metric' | 'imperial';
  fontSize: string;
}

export function CurrentWeatherStats({ config, current, units, fontSize }: CurrentWeatherStatsProps) {
  return (
    <>
      <WeatherStat icon={CloudRain} value={current.precipProbability} unit="%" visible={config.showPrecipitation !== false} fontSize={fontSize} />
      <WeatherStat icon={Droplets} value={current.humidity} unit="%" visible={config.showHumidity} fontSize={fontSize} />
      <WeatherStat icon={Wind} value={current.windSpeed} visible={config.showWind} fontSize={fontSize} />
      <WeatherStat icon={Gauge} value={current.pressure} unit=" hPa" visible={config.showPressure} fontSize={fontSize} />
      <WeatherStat icon={Eye} value={current.visibility} unit={units === 'metric' ? ' km' : ' mi'} visible={config.showVisibility} fontSize={fontSize} />
      <WeatherStat icon={Thermometer} value={current.dewPoint} unit="°" visible={config.showDewPoint} fontSize={fontSize} />
    </>
  );
}
