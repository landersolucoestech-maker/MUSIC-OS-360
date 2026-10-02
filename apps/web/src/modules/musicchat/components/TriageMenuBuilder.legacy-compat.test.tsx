import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
vi.mock("./MusicChatMemberPicker", () => ({ MusicChatMemberPicker: () => null }));

import { TriageMenuBuilder } from "./TriageMenuBuilder";

describe("TriageMenuBuilder default routing classification", () => {
  it.each([
    ["queue", "Atendimento"],
    ["sector", "Triagem"],
  ])("a new option is created with %s=%s", (field, value) => {
    const onChange = vi.fn();
    render(<TriageMenuBuilder options={[]} templates={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar opção/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [created] = onChange.mock.calls[0][0];
    expect(created[field]).toBe(value);
    expect(created.order).toBe(1);
  });
});
