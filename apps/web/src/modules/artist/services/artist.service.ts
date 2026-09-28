/**
 * Service layer of the artist module.
 * The exclusive storage access point for artist data.
 * When connecting a real backend, replace the implementations here.
 *
 * PT (wire, backend contract) ↔ EN (`Artist`, internal model) boundary —
 * see `artist.mapper.ts` (`wireToArtist`/`artistToWirePayload`).
 */
import { storage } from "@/shared/lib/storage";
import type { Artist, ArtistInsert, ArtistUpdate } from "../types/artist.types";
import { wireToArtist, artistToWirePayload, type ArtistWireRecord } from "./artist.mapper";

export const artistService = {
  async list(): Promise<Artist[]> {
    return (await storage.list<ArtistWireRecord>("artists")).map(wireToArtist);
  },

  async findById(id: string): Promise<Artist | undefined> {
    const wire = await storage.findById<ArtistWireRecord>("artists", id);
    return wire ? wireToArtist(wire) : undefined;
  },

  async create(data: ArtistInsert): Promise<Artist> {
    const wire = await storage.create<ArtistWireRecord>(
      "artists",
      artistToWirePayload(data) as Omit<ArtistWireRecord, "id" | "user_id" | "created_at" | "updated_at">,
    );
    return wireToArtist(wire);
  },

  async update(id: string, data: ArtistUpdate): Promise<Artist> {
    const wire = await storage.update<ArtistWireRecord>(
      "artists",
      id,
      artistToWirePayload(data) as Partial<ArtistWireRecord>,
    );
    return wireToArtist(wire);
  },

  async delete(id: string): Promise<void> {
    await storage.delete("artists", id);
  },
};
