/**
 * Service layer do módulo artist.
 * Ponto de acesso exclusivo ao storage para dados de artistas.
 * Ao conectar um backend real, substitua as implementações aqui.
 *
 * Fronteira PT(wire, contrato do backend) ↔ EN(`Artist`, modelo interno) —
 * ver `artist.mapper.ts` (`wireToArtist`/`artistToWirePayload`).
 */
import { storage } from "@/shared/lib/storage";
import type { Artist, ArtistInsert, ArtistUpdate } from "../types/artist.types";
import { wireToArtist, artistToWirePayload, type ArtistWireRecord } from "./artist.mapper";

export const artistaService = {
  async list(): Promise<Artist[]> {
    return (await storage.list<ArtistWireRecord>("artistas")).map(wireToArtist);
  },

  async findById(id: string): Promise<Artist | undefined> {
    const wire = await storage.findById<ArtistWireRecord>("artistas", id);
    return wire ? wireToArtist(wire) : undefined;
  },

  async create(data: ArtistInsert): Promise<Artist> {
    const wire = await storage.create<ArtistWireRecord>(
      "artistas",
      artistToWirePayload(data) as Omit<ArtistWireRecord, "id" | "user_id" | "created_at" | "updated_at">,
    );
    return wireToArtist(wire);
  },

  async update(id: string, data: ArtistUpdate): Promise<Artist> {
    const wire = await storage.update<ArtistWireRecord>(
      "artistas",
      id,
      artistToWirePayload(data) as Partial<ArtistWireRecord>,
    );
    return wireToArtist(wire);
  },

  async delete(id: string): Promise<void> {
    await storage.delete("artistas", id);
  },
};
