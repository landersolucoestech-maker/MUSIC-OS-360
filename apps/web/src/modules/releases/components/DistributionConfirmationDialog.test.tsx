import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DistributionConfirmationDialog } from "./DistributionConfirmationDialog";

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<DistributionConfirmationDialog open onCancel={onCancel} onConfirm={onConfirm} />);
  return { onConfirm, onCancel };
}

describe("DistributionConfirmationDialog", () => {
  it("does not confirm an empty form and says what is missing", () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByTestId("distribution-confirmation-submit"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId("distribution-confirmation-problems").textContent).toMatch(/origem.*referência.*data/);
  });

  it("sends the metadata patch when the confirmation is complete", async () => {
    const { onConfirm } = setup();
    fireEvent.change(screen.getByLabelText("Origem da confirmação"), { target: { value: "external_confirmation" } });
    fireEvent.change(screen.getByLabelText(/Referência/), { target: { value: "DIST-42" } });
    fireEvent.change(screen.getByLabelText("Data da confirmação"), { target: { value: "2026-10-05" } });
    fireEvent.click(screen.getByTestId("distribution-confirmation-submit"));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith({
      distribution_confirmation: { source: "external_confirmation", reference: "DIST-42", confirmed_at: "2026-10-05" },
    });
  });

  it("cancel does not confirm", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
