import { describe, it, expect } from "vitest";
import { LeaveRequestStatus } from "@music-os-360/types";
import {
  CONTRACT_TYPE_OPTIONS, LEAVE_STATUS_OPTIONS, LEAVE_TYPE_OPTIONS,
  contractTypeLabel, leaveStatusLabel, leaveTypeLabel,
} from "./index";

describe("HR vocabularies (CZ-030)", () => {
  it("option values are canonical technical slugs, labels are PT-BR", () => {
    for (const option of [...CONTRACT_TYPE_OPTIONS, ...LEAVE_TYPE_OPTIONS]) {
      expect(option.value).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(option.label).not.toBe(option.value);
    }
  });

  it("leave status options are exactly the persistable statuses (no 'em andamento')", () => {
    expect(LEAVE_STATUS_OPTIONS.map((o) => o.value)).toEqual(Object.values(LeaveRequestStatus));
  });

  it("never renders a raw or unknown technical value", () => {
    expect(contractTypeLabel("internship")).toBe("Estágio");
    expect(leaveTypeLabel("sick_leave")).toBe("Licença médica");
    expect(leaveStatusLabel("pending")).toBe("Pendente");
    expect(leaveTypeLabel("mystery")).toBe("Outro tipo de ausência");
    expect(contractTypeLabel(null)).toBe("—");
  });
});
