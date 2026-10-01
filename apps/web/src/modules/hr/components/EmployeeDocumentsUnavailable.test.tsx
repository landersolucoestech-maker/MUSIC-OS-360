import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmployeeDocumentsUnavailable } from "./EmployeeDocumentsUnavailable";

describe("EmployeeDocumentsUnavailable", () => {
  it("states that the module is unavailable and offers no upload or delete controls", () => {
    render(<EmployeeDocumentsUnavailable />);
    expect(screen.getByTestId("documents-unavailable")).toBeTruthy();
    expect(screen.getByText("Documentos de funcionários indisponíveis")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByTestId("file-upload-documents")).toBeNull();
  });
});
