/**
 * Compat wiring: the plan cards of the Register activation step print the PT-BR price suffix through
 * activationPlanPeriodSuffix (dual-read of the period: mensal|anual|month|year|monthly|yearly).
 */
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listPublicPlans = vi.hoisted(() => vi.fn());

vi.mock("@/app/providers/AuthContext", () => ({ useAuth: () => ({ signUp: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/modules/auth/services/activation-plans.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/auth/services/activation-plans.service")>();
  // Raw plans are served as stored (legacy period spellings are NOT normalized by the service here).
  return { ...original, activationPlansService: { listPublicPlans } };
});

import Register from "./Register";

const change = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });
const next = () => fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));

async function openActivationStep(plans: Record<string, unknown>[]) {
  listPublicPlans.mockResolvedValue(plans);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter><Register /></MemoryRouter>
    </QueryClientProvider>,
  );
  change("input-company-name", "Selo Teste Ltda");
  change("input-trade-name", "Selo Teste");
  change("input-cnpj", "12345678000190");
  change("input-address", "Rua das Artes, 123");
  change("input-city", "São Paulo");
  change("input-phone", "11999990000");
  change("input-corporate-email", "contato@selo.com");
  next();
  await waitFor(() => expect(screen.getByTestId("input-full-name")).toBeInTheDocument());
  change("input-full-name", "Maria Admin");
  change("input-role", "Diretora");
  change("input-admin-email", "maria@selo.com");
  change("input-password", "Senha#1234");
  change("input-confirm-password", "Senha#1234");
  next();
  await waitFor(() => expect(screen.getByTestId("input-workspace-name")).toBeInTheDocument());
  change("input-workspace-name", "Selo Teste");
  change("input-slug", "selo-teste");
  next();
  await waitFor(() => expect(screen.getByText("Plano & Ativação")).toBeInTheDocument());
}

const planText = (id: string) => screen.getByTestId(`plan-${id}`).textContent ?? "";

const PLANS = [
  { id: "p-mensal", name: "Mensal PT", description: "d", price: 99, currency: "BRL", period: "mensal", order: 1 },
  { id: "p-monthly", name: "Monthly", description: "d", price: 99, currency: "BRL", period: "monthly", order: 2 },
  { id: "p-month", name: "Month", description: "d", price: 99, currency: "BRL", period: "month", order: 3 },
  { id: "p-anual", name: "Anual PT", description: "d", price: 990, currency: "BRL", period: "anual", order: 4 },
  { id: "p-year", name: "Year", description: "d", price: 990, currency: "BRL", period: "year", order: 5 },
  { id: "p-yearly", name: "Yearly", description: "d", price: 990, currency: "BRL", period: "yearly", order: 6 },
  { id: "p-trial", name: "Trial", description: "d", price: 10, currency: "BRL", period: "trial", order: 7 },
  { id: "p-weekly", name: "Weekly", description: "d", price: 5, currency: "BRL", period: "weekly", order: 8 },
  { id: "p-none", name: "None", description: "d", price: 7, currency: "BRL", period: null, order: 9 },
];

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("Register activation plan price suffix", () => {
  it("renders '/mês' for every monthly spelling and '/ano' for every yearly spelling", async () => {
    await openActivationStep(PLANS);
    for (const id of ["p-mensal", "p-monthly", "p-month"]) expect(planText(id)).toMatch(/\/mês$/);
    for (const id of ["p-anual", "p-year", "p-yearly"]) expect(planText(id)).toMatch(/\/ano$/);
    expect(planText("p-mensal")).toContain("R$");
    expect(planText("p-anual")).toMatch(/990,00\/ano$/);
  });

  it("negative: no raw period string is ever printed and non-recurring periods get no suffix", async () => {
    await openActivationStep(PLANS);
    for (const [id, raw] of [["p-mensal", "mensal"], ["p-anual", "anual"], ["p-year", "year"], ["p-month", "month"], ["p-trial", "trial"], ["p-weekly", "weekly"]]) {
      expect(planText(id).toLowerCase().replace(/^.*r\$/, "")).not.toContain(raw);
    }
    expect(planText("p-trial")).toMatch(/10,00$/);
    expect(planText("p-weekly")).toMatch(/5,00$/);
    expect(planText("p-none")).toMatch(/7,00$/);
    expect(planText("p-trial")).not.toMatch(/\/(mês|ano)/);
    expect(planText("p-weekly")).not.toMatch(/\/(mês|ano)/);
    expect(planText("p-none")).not.toMatch(/\/(mês|ano)/);
  });
});
