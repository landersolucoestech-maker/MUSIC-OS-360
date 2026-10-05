import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import OAuthPopupPage from "./OAuthPopupPage";

function renderAt(platform: string) {
  return render(
    <MemoryRouter initialEntries={[`/oauth/${encodeURIComponent(platform)}`]}>
      <Routes>
        <Route path="/oauth/:platform" element={<OAuthPopupPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OAuthPopupPage: platform param is an own-property lookup", () => {
  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
    "%s renders the unknown-integration screen instead of a provider experience",
    (platform) => {
      renderAt(platform);
      expect(screen.getByText("Integração indisponível")).toBeTruthy();
    },
  );
});
