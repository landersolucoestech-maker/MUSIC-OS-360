/**
 * no-unbounded-hook-as-picker.guard.test.ts  (Task J)
 *
 * Permanent guard: the 8 "give me everything" hooks below fetch only the
 * first ~50 tenant records, with no server-side search. Using them as a
 * source for select/autocomplete/relationship/name-resolution/autofill/
 * cross-reference/deep-link is the pattern Task J eliminated — this test
 * prevents silent reintroduction.
 *
 * Instead, use:
 *  - useEntityLookup (shared/hooks/useEntityLookup.ts) for server-side search;
 *  - useEntityById (same file) to resolve an already-known ID;
 *  - AsyncEntityCombobox (shared/components/AsyncEntityCombobox.tsx) for
 *    dropdown pickers.
 *
 * Any file that still calls one of these hooks must be listed in
 * ALLOWED_CALL_SITES, with the exact justification for why it's safe
 * (mutation-only, isLoading-only, scoped by a server-side ID, or a fallback
 * only used while a backend aggregate hasn't loaded yet). A new call site
 * appearing outside that list fails the test — the fix is to migrate to the
 * hooks above, not to add an entry here without review.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");

const UNBOUNDED_HOOKS = [
  "useArtists",
  "useWorks",
  "useProjects",
  "useContracts",
  "useClients",
  "usePhonograms",
  "useLicenses",
  "useEmployees",
];

// Definitions of the hooks themselves (and of the lookup infrastructure,
// which mentions them in JSDoc) — not real call sites.
const HOOK_DEFINITION_FILES = new Set([
  "modules/artist/hooks/useArtists.ts",
  "modules/catalog/hooks/useWorks.ts",
  "modules/catalog/hooks/usePhonograms.ts",
  "modules/projects/hooks/useProjects.ts",
  "modules/contracts/hooks/useContracts.ts",
  "modules/crm-relationships/hooks/useContacts.ts",
  "modules/crm-relationships/services/clients.service.ts",
  "modules/licensing/hooks/useLicenses.ts",
  "modules/hr/hooks/useEmployees.ts",
  "modules/artist/hooks/useArtistsPaginated.ts",
  "shared/hooks/useEntityLookup.ts",
  "shared/hooks/useEditQueryParam.ts",
  "shared/components/AsyncEntityCombobox.tsx",
]);

// Call sites confirmed LEGITIMATE in the Task J audit.
const ALLOWED_CALL_SITES: Record<string, string> = {
  "modules/dashboard/hooks/useMetrics.ts":
    "useArtists()/useProjects() feed counts from the backend aggregate (dashboard.artists_by_status/.artists) as the primary source; the capped array is only a fallback while the aggregate has not loaded yet (same pattern as the HR stats).",
  "modules/artist/components/ArtistVision360Modal.tsx":
    "useWorks/usePhonograms/useProjects/useContracts(open, artistId) receive an explicit artistId and filter server-side — not 'give me everything'.",
  "modules/artist/pages/Artists.tsx":
    "useArtists() for mutations + isLoading; the list only resolves the ?edit= deep link, with a storage.findById fallback for IDs outside the loaded batch (same pattern as Contracts.tsx).",
  "modules/auth/pages/ArtistSignupPublic.tsx":
    "useArtists() for mutations only (addArtist).",
  "modules/contracts/pages/Contracts.tsx":
    "useContracts() for mutations only; the list is passed to useEditQueryParam, which falls back to findById for IDs outside the loaded page.",
  "modules/contracts/components/ContractWizard.tsx":
    "useContracts() for mutations only (addContract/updateContract).",
  "modules/contracts/components/ContractFormModal.tsx":
    "useContracts() for mutations only (addContract/updateContract); the client picker uses AsyncEntityCombobox.",
  "modules/catalog/pages/MusicRegistration.tsx":
    "useWorks/usePhonograms for mutations only. useProjects() only feeds the project/genre dropdown (distinct values) — risk documented in the file itself for lack of a dedicated endpoint (equivalent to /works/stats/genres); search, pagination and deep links do not depend on it.",
  "modules/artist/components/ArtistFormModal.tsx":
    "useArtists()/useClients() for mutations only (addArtist/updateArtist/addClient) — this form no longer has a contract picker (Task AA removed the Classification and Links section).",
  "modules/hr/pages/HR.tsx":
    "useEmployees() for mutations + isLoading; names are resolved via EmployeeNameCell (useEntityById) and the documents picker uses AsyncEntityCombobox.",
  "modules/hr/components/EmployeeFormModal.tsx":
    "useEmployees() for mutations only (addEmployee/updateEmployee).",
  "modules/hr/components/LeaveRequestFormModal.tsx":
    "useEmployees() for isLoading only; the employee picker uses AsyncEntityCombobox.",
  "modules/catalog/components/WorkFormModal.tsx":
    "useWorks() for mutations only (addWork/updateWork); artist/project pickers use useEntityLookup/useEntityById.",
  "modules/catalog/components/PhonogramFormModal.tsx":
    "usePhonograms() for mutations only (addPhonogram/updatePhonogram); artist/work resolution uses storage.findById/listPaged directly.",
  "modules/projects/components/ProjectFormModal.tsx":
    "useProjects() for mutations only (addProject/updateProject).",
  "modules/projects/pages/Projects.tsx":
    "useProjects() for mutations + the genre dropdown (distinct values) — risk documented in the file itself; the deep link (?projeto=) and the per-row artist name use direct lookup by ID.",
  "modules/marketing/components/ai-creative/ProfileTab.tsx":
    "useWorks/usePhonograms(!!artist, artist?.id) — scoped server-side by the artist selected in the form itself.",
  "modules/licensing/pages/Licensing.tsx":
    "useLicenses() for mutations only (delete); the paginated list uses a separate hook (Task H).",
  "modules/licensing/components/LicenseFormModal.tsx":
    "useLicenses() for mutations only (addLicense/updateLicense); the work picker uses AsyncEntityCombobox.",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "test") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Strips comments (// line comments and /* block comments, including
 * multi-line {/* JSX *\/} ones) so a mention in prose/JSDoc isn't confused
 * with a real hook call. Stateful mini-lexer — needs to cross lines because a
 * block/JSX comment can have loose text on continuation lines without a
 * leading `*`. */
function stripCommentLines(content: string): string {
  let out = "";
  let inBlockComment = false;
  for (let i = 0; i < content.length; i++) {
    if (inBlockComment) {
      if (content[i] === "*" && content[i + 1] === "/") {
        inBlockComment = false;
        i++;
      } else if (content[i] === "\n") {
        out += "\n";
      }
      continue;
    }
    if (content[i] === "/" && content[i + 1] === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (content[i] === "/" && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    out += content[i];
  }
  return out;
}

const hookCallPattern = new RegExp(`\\b(${UNBOUNDED_HOOKS.join("|")})\\(`);

describe("Permanent guard (Task J): 'give me everything' hooks only where reviewed and justified", () => {
  const files = walk(SRC_ROOT);
  const flagged: string[] = [];

  for (const full of files) {
    const rel = path.relative(SRC_ROOT, full).replace(/\\/g, "/");
    if (HOOK_DEFINITION_FILES.has(rel)) continue;

    const code = stripCommentLines(fs.readFileSync(full, "utf8"));
    if (hookCallPattern.test(code)) flagged.push(rel);
  }

  it("every file calling a 'give me everything' hook is in the reviewed allowlist", () => {
    const unlisted = flagged.filter((rel) => !(rel in ALLOWED_CALL_SITES));
    expect(unlisted).toEqual([]);
  });

  it("every hook definition file exists (a renamed/moved file would silently disable the exemption)", () => {
    const missing = [...HOOK_DEFINITION_FILES].filter((rel) => !fs.existsSync(path.join(SRC_ROOT, rel)));
    expect(missing).toEqual([]);
  });

  it("every guarded hook is still exported under that name (a renamed hook would silently escape the guard)", () => {
    const exported = UNBOUNDED_HOOKS.filter((hook) =>
      [...HOOK_DEFINITION_FILES].some((rel) => {
        const full = path.join(SRC_ROOT, rel);
        return fs.existsSync(full) && new RegExp(`export (function|const) ${hook}\\b`).test(fs.readFileSync(full, "utf8"));
      }),
    );
    expect(exported).toEqual(UNBOUNDED_HOOKS);
  });

  it("the allowlist does not accumulate stale entries (file removed/renamed or hook removed from the file)", () => {
    const stale = Object.keys(ALLOWED_CALL_SITES).filter((rel) => !flagged.includes(rel));
    expect(stale).toEqual([]);
  });
});
