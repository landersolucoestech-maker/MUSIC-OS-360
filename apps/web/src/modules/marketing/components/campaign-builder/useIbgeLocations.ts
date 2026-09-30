import { useEffect, useMemo, useState } from "react";
import { BR_STATES } from "./br-locations";

export interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao: {
    mesorregiao: {
      UF: {
        sigla: string;
        nome: string;
      };
    };
  };
}

export interface LocationOption {
  uf: string;
  city: string;
  label: string;
  lat?: number;
  lng?: number;
}

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1";

const municipiosCache = new Map<string, IbgeMunicipio[]>();

async function fetchMunicipiosByUf(uf: string): Promise<IbgeMunicipio[]> {
  if (municipiosCache.has(uf)) return municipiosCache.get(uf)!;
  const res = await fetch(`${IBGE_BASE}/localidades/estados/${uf}/municipios?orderBy=nome`);
  if (!res.ok) throw new Error(`IBGE: failed to fetch cities for ${uf}`);
  const data: IbgeMunicipio[] = await res.json();
  municipiosCache.set(uf, data);
  return data;
}

export function useIbgeMunicipios(uf: string | null) {
  const [municipios, setMunicipios] = useState<IbgeMunicipio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uf) {
      setMunicipios([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchMunicipiosByUf(uf)
      .then((data) => setMunicipios(data))
      .catch(() => setError("Não foi possível carregar as cidades. Tente novamente."))
      .finally(() => setLoading(false));
  }, [uf]);

  const options: LocationOption[] = useMemo(
    () =>
      municipios.map((m) => ({
        uf,
        city: m.nome,
        label: `${uf} - ${m.nome}`,
      } as LocationOption)),
    [municipios, uf],
  );

  return { options, loading, error };
}

export const STATE_OPTIONS: LocationOption[] = BR_STATES.map((s) => ({
  uf: s.uf,
  city: `${s.name} (todo o estado)`,
  label: `${s.uf} - ${s.name} (todo o estado)`,
}));

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeLocation(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.toLowerCase().trim();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  try {
    const params = new URLSearchParams({
      q: `${query}, Brasil`,
      format: "json",
      limit: "1",
      countrycodes: "br",
    });
    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { "Accept-Language": "pt-BR" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) { geocodeCache.set(key, null); return null; }
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    geocodeCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}
