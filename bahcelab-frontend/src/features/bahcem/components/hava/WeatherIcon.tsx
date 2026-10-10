import { Cloud } from 'lucide-react'
import { WEATHER_ICONS } from '../../lib/weather'

/** Sunucunun ikon anahtarını (gunes, yagmur…) ikon olarak çizer. */
export function WeatherIcon({ name, ...props }: { name: string } & React.ComponentProps<typeof Cloud>) {
  const Icon = WEATHER_ICONS[name] ?? Cloud
  return <Icon {...props} />
}
