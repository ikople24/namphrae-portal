import { MapContainer, ZoomControl, CircleMarker, Popup, GeoJSON, useMapEvents } from 'react-leaflet';
import type { Layer } from 'leaflet';
import type { Feature } from 'geojson';
import type { IncidentItem } from '@/types/disaster';
import { imageUrl } from '@/lib/disaster-image';
import { DISASTER_COLORS } from '@/lib/disaster-types';
import type { VillageCollection, VillageProps } from '@/lib/village-geo';
import { ClusterLayer, HeatLayer } from '@/components/disaster/MapLayers';
import { CENTER, BaseTileLayer, FitBounds, type BaseLayer } from '@/components/disaster/mapBase';

export type DisplayMode = 'markers' | 'cluster' | 'heat';
export type { BaseLayer };

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapView({
  incidents,
  villages,
  displayMode = 'markers',
  baseLayer = 'road',
  onPick,
  picked,
}: {
  incidents: IncidentItem[];
  villages?: VillageCollection | null;
  displayMode?: DisplayMode;
  baseLayer?: BaseLayer;
  onPick?: (lat: number, lng: number) => void;
  picked?: { lat: number; lng: number } | null;
}) {
  return (
    <MapContainer center={CENTER} zoom={12} zoomControl={false} className="h-full w-full z-0">
      {/* ปุ่มซูมมุมล่างซ้าย (ไม่ทับการ์ดหัวมุมซ้ายบน / แผงขวา) */}
      <ZoomControl position="bottomleft" />
      <FitBounds villages={villages} />
      <BaseTileLayer baseLayer={baseLayer} />

      {villages && (
        <GeoJSON
          data={villages}
          style={{ color: '#0e7c66', weight: 1.4, fillColor: '#0e7c66', fillOpacity: 0.05 }}
          onEachFeature={(feature: Feature, layer: Layer) => {
            const title = (feature.properties as VillageProps | null)?.title;
            if (title) layer.bindTooltip(title, { sticky: true });
            layer.on('mouseover', () => (layer as unknown as { setStyle: (s: object) => void }).setStyle({ fillOpacity: 0.25 }));
            layer.on('mouseout', () => (layer as unknown as { setStyle: (s: object) => void }).setStyle({ fillOpacity: 0.05 }));
          }}
        />
      )}

      {onPick && <ClickHandler onPick={onPick} />}
      {picked && (
        <CircleMarker center={[picked.lat, picked.lng]} radius={10} pathOptions={{ color: '#2563eb' }} />
      )}

      {displayMode === 'cluster' && <ClusterLayer incidents={incidents} />}
      {displayMode === 'heat' && <HeatLayer incidents={incidents} />}
      {displayMode === 'markers' &&
        incidents.map((it) => {
          const c = DISASTER_COLORS[it.disasterType];
          return (
            <CircleMarker
              key={it._id}
              center={[it.location.coordinates[1], it.location.coordinates[0]]}
              radius={6}
              pathOptions={{ color: '#fff', weight: 1.5, fillColor: c, fillOpacity: 0.95 }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{it.dateText}</div>
                  <div>{it.areaType}</div>
                  {it.imageFile && (
                    <img src={imageUrl(it.imageFile)} alt={it.dateText} className="mt-1 w-40 rounded" />
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
