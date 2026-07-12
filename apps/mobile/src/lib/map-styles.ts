import type { StyleSpecification } from '@maplibre/maplibre-react-native';

/** Keyless raster basemap styles (usage-policy-friendly public tile servers). */
function rasterStyle(id: string, tiles: string[], attribution: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      [id]: { type: 'raster', tiles, tileSize: 256, attribution },
    },
    layers: [{ id, type: 'raster', source: id }],
  };
}

export const MAP_STYLES = {
  standard: rasterStyle(
    'osm',
    ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    '© OpenStreetMap contributors',
  ),
  satellite: rasterStyle(
    'esri-imagery',
    [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    'Source: Esri, Maxar, Earthstar Geographics',
  ),
  terrain: rasterStyle(
    'opentopo',
    ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
    '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)',
  ),
  dark: rasterStyle(
    'carto-dark',
    ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
    '© OpenStreetMap contributors © CARTO',
  ),
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;
export const MAP_STYLE_KEYS = Object.keys(MAP_STYLES) as MapStyleKey[];
