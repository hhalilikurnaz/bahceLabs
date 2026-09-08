import type { Garden } from '../types'

const antalyaGeometry: Garden['geometry'] = {
  type: 'Polygon',
  coordinates: [
    [
      [30.7134, 36.8842],
      [30.7168, 36.8842],
      [30.7168, 36.8864],
      [30.7134, 36.8864],
      [30.7134, 36.8842],
    ],
  ],
}

const izmirGeometry: Garden['geometry'] = {
  type: 'Polygon',
  coordinates: [
    [
      [27.0284, 38.4237],
      [27.0312, 38.4237],
      [27.0312, 38.4255],
      [27.0284, 38.4255],
      [27.0284, 38.4237],
    ],
  ],
}

export const STUB_GARDENS: Garden[] = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Antalya Limon Bahçesi',
    locationLabel: 'Antalya, Kepez',
    areaM2: 23_500,
    geometry: antalyaGeometry,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'İzmir Demo Bahçe',
    locationLabel: 'İzmir, Bornova',
    areaM2: 12_400,
    geometry: izmirGeometry,
  },
]

export function getStubGarden(id: string): Garden | undefined {
  return STUB_GARDENS.find((garden) => garden.id === id)
}
