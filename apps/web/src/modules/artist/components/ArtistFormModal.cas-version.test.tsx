import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConflictError } from "@/shared/lib/errors";
import { ArtistFormModal } from "./ArtistFormModal";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import type { ArtistWireRecord } from "@/modules/artist/services/artist.mapper";

// ─── Regression: form fields and expectedUpdatedAt (CAS) must come from the
// SAME fresh version (GET /artists/:id), never from the list snapshot.
// Before the fix, the fields were tied to the `artista` prop (list) and only
// expectedUpdatedAt used the fresh version — letting a PATCH with a valid CAS
// silently overwrite a concurrent edit that was already saved.

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
import { toast } from "sonner";

const ARTIST_ID = "artist-1";

vi.mock("@/shared/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/api-client")>();
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => mockGet(...(args as [string])),
      post: vi.fn(async () => ({})),
      patch: (...args: unknown[]) => mockPatch(...(args as [string, Record<string, unknown>])),
      put: vi.fn(async () => ({})),
      delete: vi.fn(async () => undefined),
    },
  };
});

// In-memory "server" state — simulates a fresh GET, a normal PATCH and a real
// conflict (another session saving between this session's GET and PATCH).
// PT shape (the real wire/backend contract) — production code converts via
// wireToArtist()/artistToWirePayload() and never receives/sends the EN model
// directly over the network.
let server: ArtistWireRecord & { id: string };
let patchCalls: Array<{ path: string; body: Record<string, unknown> }>;

const mockGet = vi.fn(async (path: string) => {
  if (new RegExp(`^/artists/${ARTIST_ID}$`).test(path)) {
    return server;
  }
  return []; // lists (artists, clients, contacts) — not used in these tests
});

const mockPatch = vi.fn(async (path: string, body: Record<string, unknown>) => {
  patchCalls.push({ path, body });
  if (new RegExp(`^/artists/${ARTIST_ID}$`).test(path)) {
    const expected = body.expectedUpdatedAt as string | undefined;
    if (expected && expected !== server.updated_at) {
      throw new ConflictError("Este artista foi alterado por outra pessoa.");
    }
    server = {
      ...server,
      ...body,
      id: ARTIST_ID,
      updated_at: `2026-08-19T00:00:${String(patchCalls.length).padStart(2, "0")}.000Z`,
    };
    return server;
  }
  return {};
});

function renderModal(props: Partial<React.ComponentProps<typeof ArtistFormModal>> & { artist: Artist }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ArtistFormModal open onOpenChange={onOpenChange} onSuccess={onSuccess} {...props} />
    </QueryClientProvider>,
  );
  return { queryClient, onOpenChange, onSuccess };
}

/** Stale snapshot, like the one the list would provide via the `artista` prop. */
const listSnapshot: Artist = {
  id: ARTIST_ID,
  stageName: "Versão Antiga",
  legalName: "Nome Antigo",
  updated_at: "2026-08-01T00:00:00.000Z",
};

function freshVersion(overrides: Partial<ArtistWireRecord> = {}): ArtistWireRecord & { id: string } {
  return {
    id: ARTIST_ID,
    nome_artistico: "Versão Atual",
    nome_civil: "Nome Atual",
    updated_at: "2026-08-18T20:00:00.000Z",
    ...overrides,
  };
}

const nameInput = () => screen.getByTestId("input-nome-artistico") as HTMLInputElement;
const saveButton = () => screen.getByTestId("button-salvar-modal") as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  patchCalls = [];
  server = freshVersion();
});

describe("ArtistFormModal — hydration from the fresh version (CAS)", () => {
  it("shows the fields of the fresh version (GET), not the list snapshot, and sends the same fresh updated_at as CAS", async () => {
    renderModal({ artist: listSnapshot });

    // Before hydration: Save is unavailable.
    expect(saveButton()).toBeDisabled();

    await waitFor(() => expect(nameInput().value).toBe("Versão Atual"));
    expect(saveButton()).not.toBeDisabled();

    fireEvent.click(saveButton());

    await waitFor(() => expect(patchCalls.length).toBe(1));
    // expectedUpdatedAt sent = Y (fresh GET version), never X (list snapshot).
    expect(patchCalls[0].body.expectedUpdatedAt).toBe("2026-08-18T20:00:00.000Z");
    expect(patchCalls[0].body.expectedUpdatedAt).not.toBe(listSnapshot.updated_at);
    expect(patchCalls[0].body.nome_artistico).toBe("Versão Atual");
  });

  it("preserves what the user typed when a background refetch arrives after hydration", async () => {
    const { queryClient } = renderModal({ artist: listSnapshot });

    await waitFor(() => expect(nameInput().value).toBe("Versão Atual"));

    fireEvent.change(nameInput(), { target: { value: "Editado pelo usuário" } });
    expect(nameInput().value).toBe("Editado pelo usuário");

    // Simulates a background refetch (e.g. tab refocus) bringing a new server
    // version — it must NOT erase what the user typed.
    server = freshVersion({ nome_artistico: "Renomeado por outra sessão", updated_at: "2026-08-18T20:30:00.000Z" });
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["artists", ARTIST_ID, "edit-fresh"] });
    });

    expect(nameInput().value).toBe("Editado pelo usuário");
  });

  it("save normal funciona (ciclo 1: abrir → editar → salvar)", async () => {
    const { onSuccess } = renderModal({ artist: listSnapshot });

    await waitFor(() => expect(nameInput().value).toBe("Versão Atual"));
    fireEvent.change(nameInput(), { target: { value: "Editado ciclo 1" } });

    fireEvent.click(saveButton());

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].body.nome_artistico).toBe("Editado ciclo 1");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a normal save works (cycle 2: reopen → edit → save again, no spurious 409)", async () => {
    const { onSuccess } = renderModal({ artist: listSnapshot });
    await waitFor(() => expect(nameInput().value).toBe("Versão Atual"));
    fireEvent.change(nameInput(), { target: { value: "Editado ciclo 1" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(patchCalls).toHaveLength(1));
    const versionAfterCycle1 = server.updated_at;

    // "Reopen": a new modal instance; the artista prop now reflects what was saved
    // (the list may still be stale about the exact updated_at — which is exactly
    // the scenario this fix covers).
    const { onSuccess: onSuccess2 } = renderModal({
      artist: { ...listSnapshot, stageName: "Editado ciclo 1" },
    });

    await waitFor(() => {
      const inputs = screen.getAllByTestId("input-nome-artistico");
      expect((inputs[inputs.length - 1] as HTMLInputElement).value).toBe("Editado ciclo 1");
    });

    const inputs2 = screen.getAllByTestId("input-nome-artistico");
    fireEvent.change(inputs2[inputs2.length - 1], { target: { value: "Editado ciclo 2" } });

    const buttons2 = screen.getAllByTestId("button-salvar-modal");
    fireEvent.click(buttons2[buttons2.length - 1]);

    await waitFor(() => expect(onSuccess2).toHaveBeenCalledTimes(1));
    expect(patchCalls).toHaveLength(2);
    // Cycle 2's CAS uses the fresh version fetched on this second opening
    // (cycle 1's result), not the old snapshot passed via prop.
    expect(patchCalls[1].body.expectedUpdatedAt).toBe(versionAfterCycle1);
    expect(toast.error).not.toHaveBeenCalled();
    void onSuccess;
  });

  it("real A/B conflict: another session saves between this session's GET and PATCH → 409 (ConflictError), the modal stays open", async () => {
    const { onSuccess, onOpenChange } = renderModal({ artist: listSnapshot });
    await waitFor(() => expect(nameInput().value).toBe("Versão Atual"));

    // "A" saves first, outside this session — the server advances the version.
    server = freshVersion({ nome_artistico: "Salvo por A", updated_at: "2026-08-18T20:45:00.000Z" });

    // "B" (this session) still holds the old expectedUpdatedAt (from hydration).
    fireEvent.change(nameInput(), { target: { value: "Tentativa de B" } });
    fireEvent.click(saveButton());

    // useDataQuery fires a generic error toast in the mutation's onError, besides
    // the specific conflict toast emitted by onSubmit's catch
    // (handleConcurrencyConflict) — what matters is that the specific one appears.
    await waitFor(() => {
      const messages = vi.mocked(toast.error).mock.calls.map((c) => c[0] as string);
      expect(messages.some((m) => m.includes("alterado por outra pessoa"))).toBe(true);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // The server keeps A's version — B did not silently overwrite it.
    expect(server.nome_artistico).toBe("Salvo por A");
  });
});
