import { useEffect, useMemo, useState } from "react";
import { BR_STATES } from "./br-locations";

export interface IbgeMunicipality {
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
  stateCode: string;
  city: string;
  label: string;
  lat?: number;
  lng?: number;
}

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1";

const municipalitiesCache = new Map<string, IbgeMunicipality[]>();

async function fetchMunicipalitiesByStateCode(stateCode: string): Promise<IbgeMunicipality[]> {
  if (municipalitiesCache.has(stateCode)) return municipalitiesCache.get(stateCode)!;
  const res = await fetch(`${IBGE_BASE}/localidades/estados/${stateCode}/municipios?orderBy=nome`);
  if (!res.ok) throw new Error(`IBGE: failed to fetch cities for ${stateCode}`);
  const data: IbgeMunicipality[] = await res.json();
  municipalitiesCache.set(stateCode, data);
  return data;
}

export function useIbgeMunicipalities(stateCode: string | null) {
  const [municipalities, setMunicipalities] = useState<IbgeMunicipality[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stateCode) {
      setMunicipalities([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchMunicipalitiesByStateCode(stateCode)
      .then((data) => setMunicipalities(data))
      .catch(() => setError("Não foi possível carregar as cidades. Tente novamente."))
      .finally(() => setLoading(false));
  }, [stateCode]);

  const options: LocationOption[] = useMemo(
    () =>
      municipalities.map((m) => ({
        stateCode,
        city: m.nome,
        label: `${stateCode} - ${m.nome}`,
      } as LocationOption)),
    [municipalities, stateCode],
  );

  return { options, loading, error };
}

export const STATE_OPTIONS: LocationOption[] = BR_STATES.map((s) => ({
  stateCode: s.stateCode,
  city: `${s.name} (todo o estado)`,
  label: `${s.stateCode} - ${s.name} (todo o estado)`,
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
