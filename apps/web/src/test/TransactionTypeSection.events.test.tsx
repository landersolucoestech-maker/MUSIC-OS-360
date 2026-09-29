import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";
import { initialFormData } from "@/modules/accounting/constants/transaction-constants";
import { TransactionTypeSection } from "@/modules/accounting/components/transaction-form/sections/TransactionTypeSection";
import type { FinancialRulesResult } from "@/modules/accounting/components/transaction-form/hooks/useFinancialRules";

/**
 * 1dfd595 FE LOW-1 / 48de4bb I-c: the event picker lists the selected artist's
 * events (full sweep) with their starts_at date, and never says "no events"
 * while they load or after the sweep failed.
 */
vi.mock("@/shared/components/AsyncEntityCombobox", () => ({ AsyncEntityCombobox: () => null }));

const ORIGINAL_TZ = process.env.TZ;
const rules = { filteredEvents: [] } as unknown as FinancialRulesResult;
const formData = { ...initialFormData, linkType: "event", artistId: "artist-1" };
const render = (eventsStatus: { isLoading: boolean; error: Error | null; truncated: boolean; refetch: () => void }, events = [] as Array<{ id: string; title: string; starts_at?: string | null }>) =>
  renderWithProviders(
    <TransactionTypeSection
      formData={formData}
      rules={rules}
      categoryRules={[]}
      errors={{}}
      disabled={false}
      updateField={vi.fn()}
      filteredEvents={events}
      eventsStatus={eventsStatus}
    />,
  );

describe("<TransactionTypeSection /> event picker", () => {
  it("says it is loading, not 'Nenhum evento encontrado', while the artist's events load", () => {
    render({ isLoading: true, error: null, truncated: false, refetch: vi.fn() });
    expect(screen.getByText("Carregando eventos…")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum evento encontrado")).not.toBeInTheDocument();
  });

  it("after a failed sweep: unavailable + retry, never 'no events'", () => {
    const refetch = vi.fn();
    render({ isLoading: false, error: new Error("boom"), truncated: false, refetch });
    expect(screen.getByText("Eventos indisponíveis")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum evento encontrado")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("labels an event with its starts_at day in the system timezone", async () => {
    process.env.TZ = "UTC";
    try {
      render({ isLoading: false, error: null, truncated: true, refetch: vi.fn() }, [
        { id: "e-1", title: "Show Noturno", starts_at: "2030-10-11T00:30:00.000Z" },
      ]);
      expect(screen.getByText("A lista mostra apenas parte dos eventos deste artista.")).toBeInTheDocument();
      const trigger = screen.getAllByRole("combobox").find((el) => el.textContent?.includes("Selecione o evento"))!;
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
      fireEvent.click(trigger);
      expect(await screen.findByText("Show Noturno (10/10/2030)")).toBeInTheDocument();
    } finally {
      process.env.TZ = ORIGINAL_TZ;
    }
  });
});
