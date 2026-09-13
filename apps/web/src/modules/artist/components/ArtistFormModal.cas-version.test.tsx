import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConflictError } from "@/shared/lib/errors";
import { ArtistFormModal } from "./ArtistFormModal";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import type { ArtistWireRecord } from "@/modules/artist/services/artist.mapper";

// ─── Regressão: campos do formulário e expectedUpdatedAt (CAS) devem vir
// da MESMA versão fresca (GET /artists/:id), nunca do snapshot da listagem.
// Antes da correção, os campos ficavam presos ao `artista` prop (lista) e só
// o expectedUpdatedAt usava a versão fresca — permitindo que um PATCH com CAS
// válido sobrescrevesse silenciosamente uma edição concorrente já salva.

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

// Estado "servidor" em memória — permite simular GET fresco, PATCH normal e
// um conflito real (outra sessão salvando entre o GET e o PATCH desta).
// Formato PT (contrato real do wire/backend) — o código de produção converte
// via wireToArtist()/artistToWirePayload(), nunca recebe/envia o modelo EN
// diretamente pela rede.
let server: ArtistWireRecord & { id: string };
let patchCalls: Array<{ path: string; body: Record<string, unknown> }>;

const mockGet = vi.fn(async (path: string) => {
  if (new RegExp(`^/artists/${ARTIST_ID}$`).test(path)) {
    return server;
  }
  return []; // listagens (artists list, clients list, contacts list) — não usadas nestes testes
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

/** Snapshot desatualizado, como o que a listagem forneceria via prop `artista`. */
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

const nomeInput = () => screen.getByTestId("input-nome-artistico") as HTMLInputElement;
const saveButton = () => screen.getByTestId("button-salvar-modal") as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  patchCalls = [];
  server = freshVersion();
});

describe("ArtistFormModal — hidratação a partir da versão fresca (CAS)", () => {
  it("exibe os campos da versão fresca (GET), não do snapshot da listagem, e envia o mesmo updated_at fresco como CAS", async () => {
    renderModal({ artist: listSnapshot });

    // Antes da hidratação: Salvar indisponível.
    expect(saveButton()).toBeDisabled();

    await waitFor(() => expect(nomeInput().value).toBe("Versão Atual"));
    expect(saveButton()).not.toBeDisabled();

    fireEvent.click(saveButton());

    await waitFor(() => expect(patchCalls.length).toBe(1));
    // expectedUpdatedAt enviado = Y (versão fresca do GET), nunca X (snapshot da listagem).
    expect(patchCalls[0].body.expectedUpdatedAt).toBe("2026-08-18T20:00:00.000Z");
    expect(patchCalls[0].body.expectedUpdatedAt).not.toBe(listSnapshot.updated_at);
    expect(patchCalls[0].body.nome_artistico).toBe("Versão Atual");
  });

  it("preserva o que o usuário digitou quando um refetch em segundo plano chega depois da hidratação", async () => {
    const { queryClient } = renderModal({ artist: listSnapshot });

    await waitFor(() => expect(nomeInput().value).toBe("Versão Atual"));

    fireEvent.change(nomeInput(), { target: { value: "Editado pelo usuário" } });
    expect(nomeInput().value).toBe("Editado pelo usuário");

    // Simula um refetch em segundo plano (ex.: refocus da aba) trazendo uma
    // versão nova do servidor — NÃO pode apagar o que o usuário digitou.
    server = freshVersion({ nome_artistico: "Renomeado por outra sessão", updated_at: "2026-08-18T20:30:00.000Z" });
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["artists", ARTIST_ID, "edit-fresh"] });
    });

    expect(nomeInput().value).toBe("Editado pelo usuário");
  });

  it("save normal funciona (ciclo 1: abrir → editar → salvar)", async () => {
    const { onSuccess } = renderModal({ artist: listSnapshot });

    await waitFor(() => expect(nomeInput().value).toBe("Versão Atual"));
    fireEvent.change(nomeInput(), { target: { value: "Editado ciclo 1" } });

    fireEvent.click(saveButton());

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].body.nome_artistico).toBe("Editado ciclo 1");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("save normal funciona (ciclo 2: reabrir → editar → salvar de novo, sem 409 espúrio)", async () => {
    const { onSuccess } = renderModal({ artist: listSnapshot });
    await waitFor(() => expect(nomeInput().value).toBe("Versão Atual"));
    fireEvent.change(nomeInput(), { target: { value: "Editado ciclo 1" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(patchCalls).toHaveLength(1));
    const versionAfterCycle1 = server.updated_at;

    // "Reabrir": nova instância do modal, artista prop agora reflete o que
    // ficou salvo (lista ainda pode estar desatualizada quanto ao updated_at
    // exato — o que é justamente o cenário que este fix cobre).
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
    // CAS do ciclo 2 usa a versão fresca buscada nesta segunda abertura
    // (resultado do ciclo 1), não o snapshot antigo passado via prop.
    expect(patchCalls[1].body.expectedUpdatedAt).toBe(versionAfterCycle1);
    expect(toast.error).not.toHaveBeenCalled();
    void onSuccess;
  });

  it("conflito A/B real: outra sessão salva entre o GET e o PATCH desta sessão → 409 (ConflictError), modal não fecha", async () => {
    const { onSuccess, onOpenChange } = renderModal({ artist: listSnapshot });
    await waitFor(() => expect(nomeInput().value).toBe("Versão Atual"));

    // "A" salva primeiro, por fora desta sessão — servidor avança de versão.
    server = freshVersion({ nome_artistico: "Salvo por A", updated_at: "2026-08-18T20:45:00.000Z" });

    // "B" (esta sessão) ainda está com o expectedUpdatedAt antigo (da hidratação).
    fireEvent.change(nomeInput(), { target: { value: "Tentativa de B" } });
    fireEvent.click(saveButton());

    // useDataQuery dispara um toast genérico de erro no onError da mutação,
    // além do toast específico de conflito emitido pelo catch do onSubmit
    // (handleConcurrencyConflict) — o que importa é que o específico apareça.
    await waitFor(() => {
      const messages = vi.mocked(toast.error).mock.calls.map((c) => c[0] as string);
      expect(messages.some((m) => m.includes("alterado por outra pessoa"))).toBe(true);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // O servidor continua com a versão de A — B não sobrescreveu silenciosamente.
    expect(server.nome_artistico).toBe("Salvo por A");
  });
});
