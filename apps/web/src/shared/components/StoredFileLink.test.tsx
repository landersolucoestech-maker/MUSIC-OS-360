import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StoredFileLink } from "./StoredFileLink";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/shared/lib/stored-file", () => ({
  openStoredFile: vi.fn(() => Promise.resolve()),
  uploadFileIdFromUrl: (url: string | null | undefined) => (url && url.includes("/tenants/") ? "file-id" : null),
}));

describe("StoredFileLink (XSS: no scriptable href from API data)", () => {
  it.each(["javascript:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "//evil.example/x"])(
    "renders %j without an href",
    (url) => {
      render(<StoredFileLink url={url}>open file</StoredFileLink>);
      expect(screen.getByText("open file").hasAttribute("href")).toBe(false);
    },
  );
  it("keeps https links and calls the extra onClick", () => {
    const onClick = vi.fn();
    render(<StoredFileLink url="https://cdn.example.com/a.mp3" onClick={onClick}>open file</StoredFileLink>);
    const link = screen.getByText("open file");
    expect(link.getAttribute("href")).toBe("https://cdn.example.com/a.mp3");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
