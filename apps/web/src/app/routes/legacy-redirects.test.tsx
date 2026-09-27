import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LEGACY_ROUTES, legacyRoutes, legacyTarget } from "./legacy-redirects";

/**
 * Old Portuguese URLs (bookmarks, links shared with artists, open tabs) must land on
 * the English route with their params, query and hash intact, and every redirect
 * target must be a route the app really declares.
 */
function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</p>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        {legacyRoutes()}
        <Route path="*" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("legacy Portuguese routes redirect to the English routes", () => {
  it("keeps path params: the public artist application link shared before the rename still works", () => {
    renderAt("/cadastro/lander-records");
    expect(screen.getByTestId("location").textContent).toBe("/apply/lander-records");
  });

  it("renames legacy query keys and keeps the other query params and the hash", () => {
    renderAt("/registro-musicas?projeto=p1&obra=w1&tab=x#top");
    expect(screen.getByTestId("location").textContent).toBe("/music-registration?project=p1&work=w1&tab=x#top");
  });

  it("maps every legacy deep-link key the old links produced", () => {
    expect(legacyTarget("/music-registration", {}, "?newObra=1", "")).toBe("/music-registration?newWork=1");
    expect(legacyTarget("/music-registration", {}, "?editObra=2", "")).toBe("/music-registration?editWork=2");
    expect(legacyTarget("/music-registration", {}, "?fonograma=3", "")).toBe("/music-registration?phonogram=3");
    expect(legacyTarget("/music-registration", {}, "?editFonograma=4", "")).toBe("/music-registration?phonogram=4");
  });

  it("redirects nested legacy paths (Stripe return URLs of sessions opened before the rename)", () => {
    renderAt("/configuracoes/billing?success=1");
    expect(screen.getByTestId("location").textContent).toBe("/settings/billing?success=1");
  });

  it("redirects the old contracts v2 splat", () => {
    renderAt("/contratos-v2/anything/here");
    expect(screen.getByTestId("location").textContent).toBe("/contracts");
  });

  it("every redirect target is a route declared by the app's route modules", () => {
    const dir = path.resolve(__dirname);
    const declared = new Set<string>();
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".routes.tsx"))) {
      for (const m of fs.readFileSync(path.join(dir, file), "utf8").matchAll(/path="([^"]+)"/g)) declared.add(m[1]);
    }
    const missing = LEGACY_ROUTES.map((r) => r.to).filter((to) => !declared.has(to) && to !== "/");
    expect(missing).toEqual([]);
  });

  it("no legacy path shadows a live English route", () => {
    const dir = path.resolve(__dirname);
    const declared = new Set<string>();
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".routes.tsx"))) {
      for (const m of fs.readFileSync(path.join(dir, file), "utf8").matchAll(/path="([^"]+)"/g)) declared.add(m[1]);
    }
    expect(LEGACY_ROUTES.filter((r) => declared.has(r.from)).map((r) => r.from)).toEqual([]);
  });
});
