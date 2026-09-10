import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const cluster = process.argv[2];
if (cluster !== "artist") {
  throw new Error(`This runner revision only authorizes the artist mechanical cluster; received ${cluster ?? "<missing>"}`);
}

const WEB_SRC = "apps/web/src/";

function git(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

function trackedFiles() {
  const output = git(["ls-files"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function isCodeFile(file) {
  return /\.(?:ts|tsx|mts|cts)$/.test(file);
}

function assertUnprotected(file) {
  if (file === ".gitignore" || file.startsWith(".claude/")) {
    throw new Error(`Protected Engineering OS path would be modified: ${file}`);
  }
}

function writeIfChanged(file, source, next) {
  if (source === next) return false;
  assertUnprotected(file);
  fs.writeFileSync(file, next);
  console.log(`EDIT ${file}`);
  return true;
}

const EXACT = new Map([
  ["Artista", "Artist"],
  ["Artistas", "Artists"],
  ["ArtistaApi", "ArtistApi"],
  ["ArtistaInsert", "ArtistInsert"],
  ["ArtistaUpdate", "ArtistUpdate"],
  ["ArtistaFormData", "ArtistFormData"],
  ["ArtistaFormValues", "ArtistFormValues"],
  ["ArtistaFormAllValues", "ArtistFormAllValues"],
  ["ArtistaPreservedInput", "ArtistPreservedInput"],
  ["ArtistaAssinado", "ContractedArtist"],
  ["ArtistasAssinados", "ContractedArtists"],
  ["ArtistaDistribuidoraEntry", "ArtistDistributorEntry"],
  ["ArtistaDistribuidora", "ArtistDistributor"],
  ["ArtistaResponsavel", "ArtistContactPerson"],
  ["ArtistaFormResponsavel", "ArtistFormContactPerson"],
  ["ArtistaContatoVinculado", "LinkedArtistContact"],
  ["ArtistaContatoVinculadoValue", "LinkedArtistContactValue"],
  ["ArtistaRelacionamento", "ArtistRelationship"],
  ["ArtistaFormRelacionamento", "ArtistFormRelationship"],
  ["ArtistaTipoPerfil", "ArtistProfileType"],
  ["ArtistaEspecialidade", "ArtistSpecialty"],
  ["ArtistaStatus", "ArtistStatus"],
  ["ArtistaVisao360Modal", "ArtistOverview360Modal"],
  ["ArtistaVisao360ModalProps", "ArtistOverview360ModalProps"],
  ["ArtistaEvolucaoSection", "ArtistEvolutionSection"],
  ["ArtistaEvolucaoSectionProps", "ArtistEvolutionSectionProps"],
  ["ArtistaEvolutionCard", "ArtistEvolutionCard"],
  ["ArtistaEvolutionCardProps", "ArtistEvolutionCardProps"],
  ["ArtistaPlatformMetrics", "ArtistPlatformMetrics"],
  ["ArtistaPlatformMetricsProps", "ArtistPlatformMetricsProps"],
  ["ArtistaFormModal", "ArtistFormModal"],
  ["ArtistaFormModalProps", "ArtistFormModalProps"],
  ["ArtistaSignupPublic", "ArtistSignupPublic"],
  ["ArtistaLookup", "ArtistLookup"],
  ["ArtistasSkeleton", "ArtistsSkeleton"],
  ["EquipeContatosCRM", "TeamContactsCRM"],
  ["useArtistas", "useArtists"],
  ["useArtistasPaginated", "useArtistsPaginated"],
  ["useArtistasAssinados", "useContractedArtists"],
  ["artistaService", "artistService"],
  ["artistaSchema", "artistSchema"],
  ["buildArtistaSchema", "buildArtistSchema"],
  ["artistaToFormFields", "artistToFormFields"],
  ["artistaToPreservedInput", "artistToPreservedInput"],
  ["artistaToExportRowFromForm", "artistToExportRowFromForm"],
  ["parseArtistaImportRow", "parseArtistImportRow"],
  ["formToArtistaPayload", "formToArtistPayload"],
  ["formValuesToArtistaPayload", "formValuesToArtistPayload"],
  ["FormToArtistaInput", "FormToArtistInput"],
  ["mapApiToArtista", "mapApiToArtist"],
  ["addArtista", "addArtist"],
  ["updateArtista", "updateArtist"],
  ["deleteArtista", "deleteArtist"],
  ["todosArtistas", "allArtists"],
  ["selectedArtista", "selectedArtist"],
  ["selectedArtistas", "selectedArtists"],
  ["viewArtista", "artistToView"],
  ["setViewArtista", "setArtistToView"],
  ["resolvedArtistas", "resolvedArtists"],
  ["resolvedShareArtistas", "resolvedShareArtists"],
  ["tiposRelacionadosArtista", "artistRelatedTypes"],
  ["isArtistaRelated", "isArtistRelated"],
  ["totalArtistas", "totalArtists"],
  ["variosArtistas", "multipleArtists"],
  ["CAPPED_ARTISTAS", "CAPPED_ARTISTS"],
  ["EMPTY_ARTISTAS", "EMPTY_ARTISTS"],
]);

const PORTUGUESE_SUFFIXES = [
  ["Visao360", "Overview360"],
  ["Evolucao", "Evolution"],
  ["Distribuidora", "Distributor"],
  ["Relacionamento", "Relationship"],
  ["TipoPerfil", "ProfileType"],
  ["Especialidade", "Specialty"],
  ["Responsavel", "ContactPerson"],
];

function transformIdentifier(name) {
  if (EXACT.has(name)) return EXACT.get(name);

  if (name.startsWith("Artistas")) {
    let suffix = name.slice("Artistas".length);
    for (const [from, to] of PORTUGUESE_SUFFIXES) suffix = suffix.split(from).join(to);
    return `Artists${suffix}`;
  }
  if (name.startsWith("Artista")) {
    let suffix = name.slice("Artista".length);
    for (const [from, to] of PORTUGUESE_SUFFIXES) suffix = suffix.split(from).join(to);
    return `Artist${suffix}`;
  }
  if (name.startsWith("useArtistas")) return `useArtists${name.slice("useArtistas".length)}`;
  if (name.startsWith("useArtista")) return `useArtist${name.slice("useArtista".length)}`;
  if (name.startsWith("artista") && name.length > "artista".length && /[A-Z]/.test(name["artista".length])) {
    return `artist${name.slice("artista".length)}`;
  }
  if (name.includes("ARTISTAS")) return name.split("ARTISTAS").join("ARTISTS");
  if (name.startsWith("ARTISTA_")) return name.replace(/^ARTISTA_/, "ARTIST_");
  return name;
}

function shouldSkipIdentifier(node, sourceFile) {
  const parent = node.parent;
  const name = node.text;
  if (name !== "Artista" && name !== "ARTISTA" && name !== "Artistas" && name !== "ARTISTAS") return false;

  // Bare Portuguese role/category keys can be persisted enum values. Leave them for
  // the accounting/contracts/status migration waves instead of changing semantics
  // during a symbol-only artist rename.
  if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent) || ts.isEnumMember(parent)) && parent.name === node) {
    return true;
  }
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  return false;
}

function replaceRanges(source, ranges) {
  if (!ranges.length) return source;
  ranges.sort((a, b) => b.start - a.start || b.end - a.end);
  let next = source;
  let lastStart = source.length + 1;
  for (const range of ranges) {
    if (range.end > lastStart) throw new Error(`Overlapping AST edit at ${range.start}:${range.end}`);
    next = next.slice(0, range.start) + range.text + next.slice(range.end);
    lastStart = range.start;
  }
  return next;
}

function prepareSharedArtistEnum() {
  const file = `${WEB_SRC}shared/types/enums.ts`;
  const source = fs.readFileSync(file, "utf8");
  let next = source;
  if (!next.includes("ArtistStatus as PkgArtistStatus")) {
    next = next.replace(/(^\s*)ArtistStatus,(\r?\n)/m, "$1ArtistStatus as PkgArtistStatus,$2");
  }
  next = next.replace(/`\$\{ArtistStatus\}`/g, "`${PkgArtistStatus}`");
  writeIfChanged(file, source, next);
}

function rewriteIdentifiers() {
  for (const file of trackedFiles()) {
    if (!file.startsWith(WEB_SRC) || !isCodeFile(file)) continue;
    assertUnprotected(file);
    const source = fs.readFileSync(file, "utf8");
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    const ranges = [];

    function visit(node) {
      if (ts.isIdentifier(node) && !shouldSkipIdentifier(node, sf)) {
        const replacement = transformIdentifier(node.text);
        if (replacement !== node.text) {
          ranges.push({ start: node.getStart(sf), end: node.end, text: replacement });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
    writeIfChanged(file, source, replaceRanges(source, ranges));
  }
}

function transformPath(file) {
  let next = file;
  const replacements = [
    ["ArtistaVisao360", "ArtistOverview360"],
    ["ArtistaEvolucao", "ArtistEvolution"],
    ["ArtistaEvolution", "ArtistEvolution"],
    ["ArtistaPlatform", "ArtistPlatform"],
    ["ArtistasAssinados", "ContractedArtists"],
    ["ArtistaAssinado", "ContractedArtist"],
    ["ArtistaSignup", "ArtistSignup"],
    ["Artistas", "Artists"],
    ["Artista", "Artist"],
    ["EquipeContatosCRM", "TeamContactsCRM"],
    ["artista-tipo", "artist-type"],
    ["artistas", "artists"],
    ["artista", "artist"],
  ];
  for (const [from, to] of replacements) next = next.split(from).join(to);
  return next;
}

function renameFiles() {
  const moves = [];
  for (const oldPath of trackedFiles()) {
    if (!oldPath.startsWith(WEB_SRC)) continue;
    const newPath = transformPath(oldPath);
    if (newPath === oldPath) continue;
    assertUnprotected(oldPath);
    assertUnprotected(newPath);
    moves.push([oldPath, newPath]);
  }

  const destinations = new Map();
  for (const [oldPath, newPath] of moves) {
    if (destinations.has(newPath)) throw new Error(`Rename collision at ${newPath}`);
    if (fs.existsSync(newPath) && !moves.some(([candidate]) => candidate === newPath)) {
      throw new Error(`Rename destination already exists: ${newPath}`);
    }
    destinations.set(newPath, oldPath);
  }

  moves.sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]));
  for (const [oldPath, newPath] of moves) {
    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    git(["mv", "--", oldPath, newPath]);
    console.log(`MOVE ${oldPath} -> ${newPath}`);
  }
  return moves;
}

function moduleRulesFromMoves(moves) {
  const rules = [];
  const strip = (file) => file.replace(/\.(?:tsx?|mts|cts)$/, "");
  for (const [oldPath, newPath] of moves) {
    const oldBase = path.basename(strip(oldPath));
    const newBase = path.basename(strip(newPath));
    if (oldBase !== newBase) rules.push([oldBase, newBase]);
    const oldAlias = `@/${strip(oldPath.slice(WEB_SRC.length))}`;
    const newAlias = `@/${strip(newPath.slice(WEB_SRC.length))}`;
    if (oldAlias !== newAlias) rules.push([oldAlias, newAlias]);
  }
  return [...new Map(rules.map(([from, to]) => [from, to])).entries()].sort((a, b) => b[0].length - a[0].length);
}

function rewriteModuleSpecifiers(rules) {
  for (const file of trackedFiles()) {
    if (!file.startsWith(WEB_SRC) || !isCodeFile(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    const ranges = [];

    function isModuleString(node) {
      if (!ts.isStringLiteralLike(node)) return false;
      const parent = node.parent;
      if ((ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node) return true;
      if (ts.isExternalModuleReference(parent) && parent.expression === node) return true;
      if (ts.isCallExpression(parent) && parent.arguments[0] === node && (parent.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(parent.expression) && parent.expression.text === "require"))) return true;
      return false;
    }

    function visit(node) {
      if (isModuleString(node)) {
        let value = node.text;
        if (value.startsWith(".") || value.startsWith("@/")) {
          for (const [from, to] of rules) value = value.split(from).join(to);
          if (value !== node.text) {
            const raw = source.slice(node.getStart(sf), node.end);
            const quote = raw[0];
            ranges.push({ start: node.getStart(sf), end: node.end, text: `${quote}${value}${quote}` });
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
    writeIfChanged(file, source, replaceRanges(source, ranges));
  }
}

function verifyNoStalePaths() {
  const stale = trackedFiles().filter((file) => file.startsWith(WEB_SRC) && /Artista|Artistas|artista|artistas/.test(file));
  if (stale.length) throw new Error(`Stale Portuguese artist paths remain:\n${stale.join("\n")}`);
}

function reportRemainingIdentifiers() {
  const remaining = new Set();
  for (const file of trackedFiles()) {
    if (!file.startsWith(WEB_SRC) || !isCodeFile(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    function visit(node) {
      if (ts.isIdentifier(node) && /Artista|Artistas|ARTISTA|artista/.test(node.text)) {
        const transformed = shouldSkipIdentifier(node, sf) ? node.text : transformIdentifier(node.text);
        if (transformed !== node.text) remaining.add(`${file}: ${node.text} -> ${transformed}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
  if (remaining.size) {
    throw new Error(`Mapped Portuguese artist identifiers still remain after rewrite:\n${[...remaining].slice(0, 250).join("\n")}`);
  }
}

prepareSharedArtistEnum();
rewriteIdentifiers();
const moves = renameFiles();
rewriteModuleSpecifiers(moduleRulesFromMoves(moves));
verifyNoStalePaths();
reportRemainingIdentifiers();

if (!git(["status", "--short"])) throw new Error("Artist normalization produced no changes.");
console.log("\nFINAL STATUS");
console.log(git(["status", "--short"]));
