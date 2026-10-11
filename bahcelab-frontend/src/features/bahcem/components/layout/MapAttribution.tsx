import mapboxWordmark from '@/assets/brand/mapbox-wordmark.svg'
import { useMap } from '../../map/useMap'

const LINK = 'underline underline-offset-2 hover:text-app-text'

/**
 * Harita atıfları (sol altta, görünen harita alanının köşesinde): Mapbox altlığında resmi wordmark logosu +
 * "© Mapbox © OpenStreetMap © Maxar · Improve this map"; MapTiler'da "© MapTiler © OpenStreetMap katkıda bulunanlar".
 * 12 px yazı, mobilde de açık (kapalı "i" düğmesi yok).
 */
export function MapAttribution() {
  const { activeProvider } = useMap()

  return (
    <div
      className="surface-dark absolute bottom-[calc(var(--sheet-h)+0.5rem)] left-[var(--map-left)] min-[1180px]:bottom-2 z-20 flex max-w-[calc(100vw-var(--map-left)-0.75rem)] flex-wrap items-center gap-x-2 gap-y-0.5 rounded-sm bg-app-panel/85 px-2 py-1 text-caption text-app-text-muted backdrop-blur-sm"
      data-testid="map-attribution"
    >
      {activeProvider === 'mapbox' && (
        <>
          <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer" aria-label="Mapbox" className="shrink-0">
            <img src={mapboxWordmark} alt="Mapbox" width={64} height={17} className="h-[17px] w-16" />
          </a>
          <span>
            ©{' '}
            <a className={LINK} href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">
              Mapbox
            </a>{' '}
            ©{' '}
            <a className={LINK} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>{' '}
            ©{' '}
            <a className={LINK} href="https://www.maxar.com/" target="_blank" rel="noreferrer">
              Maxar
            </a>{' '}
            ·{' '}
            <a className={`${LINK} font-semibold`} href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noreferrer">
              Improve this map
            </a>
          </span>
        </>
      )}
      {activeProvider === 'maptiler' && (
        <span>
          ©{' '}
          <a className={LINK} href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">
            MapTiler
          </a>{' '}
          ©{' '}
          <a className={LINK} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap katkıda bulunanlar
          </a>
        </span>
      )}
      {activeProvider === 'osm' && (
        <span>
          ©{' '}
          <a className={LINK} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap katkıda bulunanlar
          </a>
        </span>
      )}
    </div>
  )
}
