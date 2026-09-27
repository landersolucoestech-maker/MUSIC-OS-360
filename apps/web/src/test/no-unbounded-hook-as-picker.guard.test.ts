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
  "useArtistas",
  "useWorks",
  "useProjects",
  "useContracts",
  "useClientes",
  "usePhonograms",
  "useLicencas",
  "useEmployees",
];

// Definitions of the hooks themselves (and of the lookup infrastructure,
// which mentions them in JSDoc) — not real call sites.
const HOOK_DEFINITION_FILES = new Set([
  "modules/artist/hooks/useArtistas.ts",
  "modules/catalog/hooks/useObras.ts",
  "modules/catalog/hooks/useFonogramas.ts",
  "modules/projects/hooks/useProjects.ts",
  "modules/contracts/hooks/useContracts.ts",
  "modules/crm-relationships/hooks/useContacts.ts",
  "modules/crm-relationships/services/clients.service.ts",
  "modules/licensing/hooks/useLicencas.ts",
  "modules/hr/hooks/useEmployees.ts",
  "modules/artist/hooks/useArtistasPaginated.ts",
  "shared/hooks/useEntityLookup.ts",
  "shared/hooks/useEditQueryParam.ts",
  "shared/components/AsyncEntityCombobox.tsx",
]);

// Call sites confirmed LEGITIMATE in the Task J audit.
const ALLOWED_CALL_SITES: Record<string, string> = {
  "modules/dashboard/hooks/useMetrics.ts":
    "useArtistas()/useProjects() alimentam contagens com o agregado do backend (dashboard.artists_by_status/.artists) como fonte primária; o array capado só é usado como fallback quando o agregado ainda não carregou (mesmo padrão do HR stats).",
  "modules/artist/components/ArtistVision360Modal.tsx":
    "useWorks/usePhonograms/useProjects/useContracts(open, artistId) recebem artistId explícito e filtram server-side — não é 'me dê tudo'.",
  "modules/contracts/pages/Contracts.tsx":
    "useContracts() só para mutations; a lista é passada a useEditQueryParam, que tem fallback findById para IDs fora da página carregada.",
  "modules/contracts/components/ContractWizard.tsx":
    "useContracts() só para mutations (addContract/updateContract).",
  "modules/contracts/components/ContractFormModal.tsx":
    "useContracts() só para mutations (addContract/updateContract); o picker de clientes usa AsyncEntityCombobox.",
  "modules/catalog/pages/RegistroMusicas.tsx":
    "useWorks/usePhonograms só para mutations. useProjects() alimenta só o dropdown de projetos/gêneros (valores distintos) — risco documentado no próprio arquivo por falta de endpoint dedicado (equivalente a /works/stats/generos); busca, paginação e deep-links não dependem disso.",
  "modules/artist/components/ArtistFormModal.tsx":
    "useArtistas()/useClientes() só para mutations (addArtista/updateArtista/addCliente) — não há mais picker de contrato neste formulário (Task AA removeu a seção Classificação e Vínculos).",
  "modules/hr/pages/HR.tsx":
    "useEmployees() só para mutations + isLoading; nomes resolvidos via FuncionarioNomeCell (useEntityById) e o picker de documentos usa AsyncEntityCombobox.",
  "modules/hr/components/EmployeeFormModal.tsx":
    "useEmployees() só para mutations (addEmployee/updateEmployee).",
  "modules/hr/components/LeaveRequestFormModal.tsx":
    "useEmployees() só para isLoading; o picker de funcionário usa AsyncEntityCombobox.",
  "modules/catalog/components/ObraFormModal.tsx":
    "useWorks() só para mutations (addWork/updateWork); pickers de artista/projeto usam useEntityLookup/useEntityById.",
  "modules/catalog/components/FonogramaFormModal.tsx":
    "usePhonograms() só para mutations (addPhonogram/updatePhonogram); resolução de artista/obra usa storage.findById/listPaged direto.",
  "modules/projects/components/ProjectFormModal.tsx":
    "useProjects() só para mutations (addProject/updateProject).",
  "modules/projects/pages/Projects.tsx":
    "useProjects() só para mutations + dropdown de gêneros (valores distintos) — risco documentado no próprio arquivo; deep-link (?projeto=) e nome do artista por linha usam busca direta por ID.",
  "modules/marketing/components/ia-criativa/PerfilTab.tsx":
    "useObras/useFonogramas(!!artist, artist?.id) — escopados server-side pelo artista selecionado no próprio formulário.",
  "modules/licensing/pages/Licenciamento.tsx":
    "useLicencas() só para mutations (delete); a lista paginada usa hook separado (Task H).",
  "modules/licensing/components/LicencaFormModal.tsx":
    "useLicencas() só para mutations (addLicenca/updateLicenca); o picker de obra usa AsyncEntityCombobox.",
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

  it("the allowlist does not accumulate stale entries (file removed/renamed or hook removed from the file)", () => {
    const stale = Object.keys(ALLOWED_CALL_SITES).filter((rel) => !flagged.includes(rel));
    expect(stale).toEqual([]);
  });
});
