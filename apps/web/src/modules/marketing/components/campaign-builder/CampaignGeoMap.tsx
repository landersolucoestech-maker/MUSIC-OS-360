import type { MouseEvent } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/shared/ui/button";

const PRESETS = [5, 10, 25, 50, 100];
const DEFAULT_LAT = -14.235;
const DEFAULT_LNG = -51.925;

export interface GeoSelection {
  lat?: number;
  lng?: number;
  radiusKm: number;
}

export function CampaignGeoMap({
  lat,
  lng,
  radiusKm,
  onChange,
}: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  onChange: (geo: GeoSelection) => void;
}) {
  const radius = radiusKm && radiusKm > 0 ? radiusKm : 25;
  const pointLat = typeof lat === "number" ? lat : DEFAULT_LAT;
  const pointLng = typeof lng === "number" ? lng : DEFAULT_LNG;
  const bbox = getBoundingBox(pointLat, pointLng, radius);
  const radiusPx = Math.min(250, Math.max(34, radius * 1.35));
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.left}%2C${bbox.bottom}%2C${bbox.right}%2C${bbox.top}&layer=mapnik&marker=${pointLat}%2C${pointLng}`;

  const setRadius = (km: number) => onChange({ lat: pointLat, lng: pointLng, radiusKm: km });
  const pickApproxPoint = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const nextLng = bbox.left + x * (bbox.right - bbox.left);
    const nextLat = bbox.top - y * (bbox.top - bbox.bottom);
    onChange({ lat: Number(nextLat.toFixed(5)), lng: Number(nextLng.toFixed(5)), radiusKm: radius });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pickApproxPoint}
        className="relative h-[280px] w-full overflow-hidden rounded-lg border border-border bg-muted text-left"
        aria-label="Mapa de segmentação geográfica"
      >
        <iframe
          key={src}
          title="Mapa de segmentação geográfica"
          src={src}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          tabIndex={-1}
        />
        <div className="pointer-events-none absolute inset-0 bg-transparent" />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-2 border-blue-600/70 bg-blue-500/15"
          style={{
            width: radiusPx,
            height: radiusPx,
            transform: "translate(-50%, -50%)",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-700 bg-white text-blue-700 ring-4 ring-blue-500/20">
            <MapPin className="h-5 w-5" />
          </div>
          <span className="mt-1 rounded-full border border-border bg-background/95 px-2 py-0.5 text-[10px] font-medium text-foreground">
            {radius} km
          </span>
        </div>
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-background/95 px-2 py-1 text-[11px] text-muted-foreground">
          Clique no mapa para ajustar o centro aproximado
        </div>
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Raio:</span>
        {PRESETS.map((km) => (
          <Button
            key={km}
            type="button"
            size="sm"
            variant={radius === km ? "default" : "outline"}
            className="h-7 px-2 text-[11px]"
            onClick={() => setRadius(km)}
          >
            {km} km
          </Button>
        ))}
        <input
          type="range"
          min={1}
          max={200}
          value={radius}
          onChange={(event) => setRadius(Number(event.target.value))}
          className="h-1 min-w-[120px] flex-1 accent-primary"
          aria-label="Raio em quilômetros"
        />
        <span className="w-14 text-right text-xs font-medium tabular-nums">{radius} km</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>Centro: {pointLat.toFixed(4)}, {pointLng.toFixed(4)} - raio {radius} km</span>
        <span>Dados © OpenStreetMap</span>
      </div>
    </div>
  );
}

function getBoundingBox(lat: number, lng: number, radiusKm: number) {
  const span = Math.max(1.2, Math.min(18, radiusKm / 4));
  const latSpan = span;
  const lngSpan = span / Math.max(0.35, Math.cos((lat * Math.PI) / 180));
  return {
    left: Number((lng - lngSpan).toFixed(5)),
    bottom: Number((lat - latSpan).toFixed(5)),
    right: Number((lng + lngSpan).toFixed(5)),
    top: Number((lat + latSpan).toFixed(5)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
