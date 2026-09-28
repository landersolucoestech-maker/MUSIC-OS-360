import type { LicenseStatus } from "@music-os-360/types";
import type { LICENSE_TYPE_OPTIONS } from "@/modules/licensing/lib/license-format";

export type { LicenseStatus };
export type LicenseType = (typeof LICENSE_TYPE_OPTIONS)[number]["value"];

export type RemunerationType = "FIXED" | "PERCENTAGE" | "FIXED_PLUS_PERCENTAGE";
export type Currency = "BRL" | "USD" | "EUR";

/** License as the API returns it (canonical English fields, CZ-035). */
export interface License {
  id: string;
  title: string;
  // Relations (source of truth)
  work_id?: string | null;
  client_id?: string | null;
  artist_id?: string | null;
  work_title?: string | null;
  artist_name?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  type?: LicenseType | string | null;
  usage_type?: string | null;
  target_media?: string | null;
  territory?: string | null;
  status?: LicenseStatus | string | null;
  start_date?: string | null;
  end_date?: string | null;
  // Structured compensation
  remuneration_type?: RemunerationType | null;
  currency?: Currency | null;
  amount?: number | null;
  percentage?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type LicenseInsert = Omit<License, "id" | "created_at" | "updated_at">;
export type LicenseUpdate = Partial<LicenseInsert>;
