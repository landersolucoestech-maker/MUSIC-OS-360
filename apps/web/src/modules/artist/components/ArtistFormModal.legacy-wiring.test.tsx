/**
 * Compat wiring of ArtistFormModal: a legacy-shaped artist (distributor id 'outros', legacy
 * distributor maps, legacy agent fields, platform metrics) is loaded through the real
 * GET -> wireToArtist -> artistToFormValues path and the modal must
 *   - treat the "Outros" distributor through isOtherDistributorId (custom-name input, no e-mail);
 *   - submit the canonical payload produced by formValuesToArtistPayload(values, preserved).
 * Boundary mocked: the mutation hooks (we assert the exact internal payload they receive).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Artist } from "@/modules/artist/hooks/useArtists";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const addArtist = vi.fn();
const updateArtist = vi.fn();
const addClient = vi.fn();

vi.mock("@/modules/artist/hooks/useArtists", () => ({
  useArtists: () => ({
    addArtist: { mutateAsync: (...a: unknown[]) => addArtist(...a) },
    updateArtist: { mutateAsync: (...a: unknown[]) => updateArtist(...a) },
  }),
}));
vi.mock("@/modules/crm-relationships/hooks/useContacts", () => ({
  useClients: () => ({ addClient: { mutateAsync: (...a: unknown[]) => addClient(...a) } }),
  useContacts: () => ({ contacts: [], createContact: vi.fn() }),
}));
vi.mock("@/modules/crm-relationships/modals/ContactFormModal", () => ({ ContactFormModal: () => null }));

let server: Record<string, unknown>;
vi.mock("@/shared/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/api-client")>();
  return {
    ...actual,
    api: {
      get: vi.fn(async (path: string) => (/^\/artists\/[^/]+$/.test(path) ? server : [])),
      post: vi.fn(async () => ({})),
      patch: vi.fn(async () => ({})),
      put: vi.fn(async () => ({})),
      delete: vi.fn(async () => undefined),
    },
  };
});

import { ArtistFormModal } from "./ArtistFormModal";

const ARTIST_ID = "artist-legacy-1";
const UPDATED_AT = "2026-09-01T10:00:00.000Z";
const listSnapshot = { id: ARTIST_ID, stageName: "Snapshot", updated_at: "2026-08-01T00:00:00.000Z" } as Artist;

function legacyServerRecord(extra: Record<string, unknown> = {}) {
  return {
    id: ARTIST_ID,
    stage_name: "Legado",
    full_name: "Legado Completo",
    profile_type: "managed",
    updated_at: UPDATED_AT,
    notes: "bio legada",
    rg: "12.345.678-9",
    spotify_url: "https://open.spotify.com/artist/abc123",
    instagram_url: "https://instagram.com/legado",
    spotify_listeners: 4200,
    contract_id: "ctr-1",
    agent_name: "Agent Smith",
    selected_distributors: { outros: true, onerpm: true },
    distributor_emails: { outros: "o@x.com" },
    general_distributors: [
      { id: "outros", email: "", customName: "" },
      { id: "onerpm", email: "d@x.com" },
    ],
    ...extra,
  };
}

function renderModal(props: Partial<React.ComponentProps<typeof ArtistFormModal>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ArtistFormModal open onOpenChange={onOpenChange} onSuccess={onSuccess} {...props} />
    </QueryClientProvider>,
  );
  return { onOpenChange, onSuccess };
}

const nameInput = () => screen.getByTestId("input-stage-name") as HTMLInputElement;
const saveButton = () => screen.getByTestId("button-save-modal") as HTMLButtonElement;

async function renderEditHydrated() {
  const handlers = renderModal({ artist: listSnapshot });
  await waitFor(() => expect(nameInput().value).toBe("Legado"));
  await waitFor(() => expect(saveButton()).not.toBeDisabled());
  return handlers;
}

beforeEach(() => {
  addArtist.mockReset().mockResolvedValue({ id: "new" });
  updateArtist.mockReset().mockResolvedValue({});
  addClient.mockReset().mockResolvedValue({ id: "client-1" });
  server = legacyServerRecord();
});

describe("ArtistFormModal distributors: the legacy 'outros' entry behaves as 'other'", () => {
  it("shows the custom-name input (not the e-mail input) for 'other' and the e-mail input for a regular distributor", async () => {
    await renderEditHydrated();

    // 'outros' (legacy, loaded) is the 'Outros' option: custom name, no e-mail until a name exists
    expect(screen.getAllByTestId("input-general-dist-custom-name")).toHaveLength(1);
    expect(screen.queryByTestId("input-general-dist-email-other")).toBeNull();
    expect(screen.getByText(/Preencha o nome da distribuidora/i)).toBeInTheDocument();

    // regular distributor: e-mail input with the stored value, never a custom-name input of its own
    const onerpmEmail = screen.getByTestId("input-general-dist-email-onerpm") as HTMLInputElement;
    expect(onerpmEmail.value).toBe("d@x.com");
    // the 'Outros' option has no per-id e-mail input while its name is empty
    expect(screen.queryByTestId("input-general-dist-email-other")).toBeNull();
  });

  it("typing the custom name reveals the e-mail of 'other' and applies only to the 'other' entry", async () => {
    await renderEditHydrated();
    fireEvent.change(screen.getByTestId("input-general-dist-custom-name"), { target: { value: "Minha Distro" } });
    expect(screen.getByTestId("input-general-dist-email-other")).toBeInTheDocument();
    expect(screen.queryByText(/Preencha o nome da distribuidora/i)).toBeNull();

    fireEvent.click(saveButton());
    await waitFor(() => expect(updateArtist).toHaveBeenCalledTimes(1));
    const dists = updateArtist.mock.calls[0][0].generalDistributors as Array<Record<string, unknown>>;
    expect(dists).toEqual([
      { id: "other", email: "", customName: "Minha Distro" },
      { id: "onerpm", email: "d@x.com" },
    ]);
    // the regular distributor never receives the custom name
    expect(dists[1]).not.toHaveProperty("customName");
  });

  it("negative: with only regular distributors there is no custom-name input and no 'fill the name' hint", async () => {
    server = legacyServerRecord({ general_distributors: [{ id: "onerpm", email: "d@x.com" }, { id: "symphonic", email: "" }] });
    await renderEditHydrated();
    expect(screen.queryByTestId("input-general-dist-custom-name")).toBeNull();
    expect(screen.queryByText(/Preencha o nome da distribuidora/i)).toBeNull();
    expect(screen.getByTestId("input-general-dist-email-onerpm")).toBeInTheDocument();
    expect(screen.getByTestId("input-general-dist-email-symphonic")).toBeInTheDocument();
  });

  it("checking 'Outros' starts an empty custom name; checking a regular distributor carries none", async () => {
    server = legacyServerRecord({ general_distributors: [] });
    await renderEditHydrated();

    fireEvent.click(screen.getByTestId("checkbox-general-dist-onerpm"));
    expect(screen.queryByTestId("input-general-dist-custom-name")).toBeNull();
    fireEvent.click(screen.getByTestId("checkbox-general-dist-other"));
    expect(screen.getAllByTestId("input-general-dist-custom-name")).toHaveLength(1);

    fireEvent.click(saveButton());
    await waitFor(() => expect(updateArtist).toHaveBeenCalledTimes(1));
    expect(updateArtist.mock.calls[0][0].generalDistributors).toEqual([
      { id: "onerpm", email: "", customName: undefined },
      { id: "other", email: "", customName: "" },
    ]);
  });
});

describe("ArtistFormModal submit sends the canonical payload (formValuesToArtistPayload with preserved fields)", () => {
  it("edit of a legacy-shaped artist: canonical keys, preserved legacy/metric fields, canonical distributor ids", async () => {
    await renderEditHydrated();
    fireEvent.click(saveButton());
    await waitFor(() => expect(updateArtist).toHaveBeenCalledTimes(1));
    const payload = updateArtist.mock.calls[0][0] as Record<string, unknown>;

    expect(payload).toMatchObject({
      id: ARTIST_ID,
      stageName: "Legado",
      fullName: "Legado Completo",
      profileType: "managed",
      // form value names are converted to the persistence names
      notes: "bio legada",
      idDocument: "12.345.678-9",
      spotifyUrl: "https://open.spotify.com/artist/abc123",
      instagramUrl: "https://instagram.com/legado",
      // fields preserved from the loaded artist (not shown in the form)
      spotifyListeners: 4200,
      contractId: "ctr-1",
      agentName: "Agent Smith",
      // legacy distributor selection migrated to the canonical id and re-derived
      selectedDistributors: { other: true, onerpm: true },
      distributorEmails: { other: "o@x.com" },
      generalDistributors: [
        { id: "other", email: "", customName: "" },
        { id: "onerpm", email: "d@x.com" },
      ],
      expectedUpdatedAt: UPDATED_AT,
    });
    expect(payload.relationships).toEqual([
      expect.objectContaining({
        type: "agent",
        name: "Agent Smith",
        distributors: [
          { id: "other", email: "o@x.com" },
          { id: "onerpm", email: "" },
        ],
      }),
    ]);
    // the raw form-value names never reach the API payload
    for (const formOnly of ["biography", "rg", "spotify", "instagram"]) {
      expect(payload).not.toHaveProperty(formOnly);
    }
    expect(JSON.stringify(payload)).not.toContain("outros");
  });

  it("create: a minimal artist is submitted with the canonical defaults and the form resets afterwards", async () => {
    const { onSuccess, onOpenChange } = renderModal();
    expect(nameInput().value).toBe("");
    fireEvent.change(nameInput(), { target: { value: "Novo Artista" } });
    fireEvent.change(screen.getByTestId("input-legal-name"), { target: { value: "Novo Artista Completo" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(addArtist).toHaveBeenCalledTimes(1));
    expect(addClient).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Novo Artista", individual_name: "Novo Artista Completo", person_type: "individual" }),
    );
    const payload = addArtist.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      stageName: "Novo Artista",
      fullName: "Novo Artista Completo",
      profileType: "independent",
      status: "signed",
      contractId: null,
      relationships: null,
      generalDistributors: null,
      linkedContacts: null,
      selectedDistributors: null,
      teamContacts: null,
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // closing resets the form to the empty values
    await waitFor(() => expect(nameInput().value).toBe(""));
  });

  it("closing an edit session resets to EMPTY values, not to the loaded artist", async () => {
    const { onOpenChange } = await renderEditHydrated();
    fireEvent.change(nameInput(), { target: { value: "Digitado" } });
    expect(nameInput().value).toBe("Digitado");
    fireEvent.click(screen.getByTestId("button-cancel-modal"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(nameInput().value).toBe(""));
    expect(updateArtist).not.toHaveBeenCalled();
  });

  it("negative: an invalid form (missing required names) submits nothing", async () => {
    renderModal();
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveButton()).not.toBeDisabled());
    expect(addArtist).not.toHaveBeenCalled();
    expect(addClient).not.toHaveBeenCalled();
  });
});
