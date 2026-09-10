import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const cluster = process.argv[2];

const CLUSTERS = new Set(["artist", "hr", "contracts", "accounting", "catalog"]);
if (!CLUSTERS.has(cluster)) {
  throw new Error(`Unknown normalization cluster: ${cluster ?? "<missing>"}`);
}

const PROTECTED = [".gitignore", ".claude/"];
const WEB_SRC = "apps/web/src/";

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

function trackedFiles() {
  const out = git(["ls-files"]);
  return out ? out.split("\n").filter(Boolean) : [];
}

function isCodeFile(file) {
  return /\.(?:ts|tsx|mts|cts)$/.test(file);
}

function ensureSafePath(file) {
  if (file === ".gitignore" || file.startsWith(".claude/")) {
    throw new Error(`Protected Engineering OS path would be modified: ${file}`);
  }
}

function renameFiles(transformPath) {
  const moves = [];
  for (const oldPath of trackedFiles()) {
    if (!oldPath.startsWith(WEB_SRC)) continue;
    const newPath = transformPath(oldPath);
    if (newPath === oldPath) continue;
    ensureSafePath(oldPath);
    ensureSafePath(newPath);
    moves.push([oldPath, newPath]);
  }

  const destinations = new Map();
  for (const [oldPath, newPath] of moves) {
    if (destinations.has(newPath) && destinations.get(newPath) !== oldPath) {
      throw new Error(`Rename collision: ${oldPath} and ${destinations.get(newPath)} -> ${newPath}`);
    }
    if (fs.existsSync(newPath) && !moves.some(([candidate]) => candidate === newPath)) {
      throw new Error(`Rename destination already exists: ${newPath}`);
    }
    destinations.set(newPath, oldPath);
  }

  // Move deeper paths first. Parent directories are created explicitly so file-level
  // moves stay deterministic even when an entire technical directory is normalized.
  moves.sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]));
  for (const [oldPath, newPath] of moves) {
    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    git(["mv", "--", oldPath, newPath]);
    console.log(`MOVE ${oldPath} -> ${newPath}`);
  }

  return moves;
}

function stripCodeExtension(file) {
  return file.replace(/\.(?:tsx?|mts|cts)$/, "");
}

function buildModuleSpecifierRules(moves, extras = []) {
  const rules = [...extras];
  for (const [oldPath, newPath] of moves) {
    const oldBase = path.basename(stripCodeExtension(oldPath));
    const newBase = path.basename(stripCodeExtension(newPath));
    if (oldBase !== newBase) rules.push([oldBase, newBase]);

    if (oldPath.startsWith(WEB_SRC) && newPath.startsWith(WEB_SRC)) {
      const oldAlias = `@/${stripCodeExtension(oldPath.slice(WEB_SRC.length))}`;
      const newAlias = `@/${stripCodeExtension(newPath.slice(WEB_SRC.length))}`;
      if (oldAlias !== newAlias) rules.push([oldAlias, newAlias]);
    }
  }

  // Longest patterns first to avoid a shorter compatibility path eating a more
  // specific one.
  return [...new Map(rules.map(([from, to]) => [from, to])).entries()]
    .sort((a, b) => b[0].length - a[0].length);
}

function replaceModuleSpecifier(rawToken, rules) {
  const quote = rawToken[0];
  if ((quote !== '"' && quote !== "'") || rawToken.at(-1) !== quote) return rawToken;
  const inner = rawToken.slice(1, -1);
  if (!(inner.startsWith(".") || inner.startsWith("@/"))) return rawToken;

  let next = inner;
  for (const [from, to] of rules) next = next.split(from).join(to);
  return next === inner ? rawToken : `${quote}${next}${quote}`;
}

function rewriteIdentifiersAndImports(identifierTransform, moduleRules) {
  const changed = [];
  for (const file of trackedFiles()) {
    if (!file.startsWith(WEB_SRC) || !isCodeFile(file)) continue;
    ensureSafePath(file);

    const source = fs.readFileSync(file, "utf8");
    const variant = file.endsWith(".tsx") ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, variant, source);
    let token = scanner.scan();
    let cursor = 0;
    let output = "";

    while (token !== ts.SyntaxKind.EndOfFileToken) {
      const start = scanner.getTokenPos();
      const end = scanner.getTextPos();
      output += source.slice(cursor, start);
      const raw = source.slice(start, end);

      if (token === ts.SyntaxKind.Identifier) {
        output += identifierTransform(raw);
      } else if (token === ts.SyntaxKind.StringLiteral) {
        output += replaceModuleSpecifier(raw, moduleRules);
      } else {
        output += raw;
      }
      cursor = end;
      token = scanner.scan();
    }
    output += source.slice(cursor);

    if (output !== source) {
      fs.writeFileSync(file, output);
      changed.push(file);
      console.log(`EDIT ${file}`);
    }
  }
  return changed;
}

function applyOrdered(value, rules) {
  let next = value;
  for (const [from, to] of rules) next = next.split(from).join(to);
  return next;
}

function artistPath(file) {
  return applyOrdered(file, [
    ["ArtistaVisao360", "ArtistOverview360"],
    ["ArtistaEvolucao", "ArtistEvolution"],
    ["ArtistaEvolution", "ArtistEvolution"],
    ["ArtistaPlatform", "ArtistPlatform"],
    ["ArtistasAssinados", "ContractedArtists"],
    ["ArtistaAssinado", "ContractedArtist"],
    ["ArtistaSignup", "ArtistSignup"],
    ["Artistas", "Artists"],
    ["Artista", "Artist"],
    ["artista-tipo", "artist-type"],
    ["artistas", "artists"],
    ["artista", "artist"],
    ["EquipeContatosCRM", "TeamContactsCRM"],
  ]);
}

const ARTIST_EXACT = new Map([
  ["Artista", "Artist"],
  ["Artistas", "Artists"],
  ["ArtistaAssinado", "ContractedArtist"],
  ["ArtistasAssinados", "ContractedArtists"],
  ["ArtistaDistribuidoraEntry", "ArtistDistributorEntry"],
  ["ArtistaResponsavel", "ArtistContactPerson"],
  ["ArtistaFormResponsavel", "ArtistFormContactPerson"],
  ["ArtistaContatoVinculado", "LinkedArtistContact"],
  ["ArtistaContatoVinculadoValue", "LinkedArtistContactValue"],
  ["ArtistaRelacionamento", "ArtistRelationship"],
  ["ArtistaTipoPerfil", "ArtistProfileType"],
  ["ArtistaEspecialidade", "ArtistSpecialty"],
  ["ArtistaStatus", "ArtistStatus"],
  ["ArtistaVisao360Modal", "ArtistOverview360Modal"],
  ["ArtistaEvolucaoSection", "ArtistEvolutionSection"],
  ["ArtistaEvolutionCard", "ArtistEvolutionCard"],
  ["ArtistaPlatformMetrics", "ArtistPlatformMetrics"],
  ["ArtistaFormModal", "ArtistFormModal"],
  ["ArtistaSignupPublic", "ArtistSignupPublic"],
  ["useArtistasAssinados", "useContractedArtists"],
  ["artistaService", "artistService"],
  ["artistaSchema", "artistSchema"],
  ["buildArtistaSchema", "buildArtistSchema"],
  ["artistaToFormFields", "artistToFormFields"],
  ["artistaToPreservedInput", "artistToPreservedInput"],
  ["artistaToExportRowFromForm", "artistToExportRowFromForm"],
  ["parseArtistaImportRow", "parseArtistImportRow"],
  ["formToArtistaPayload", "formToArtistPayload"],
  ["mapApiToArtista", "mapApiToArtist"],
  ["addArtista", "addArtist"],
  ["updateArtista", "updateArtist"],
  ["deleteArtista", "deleteArtist"],
  ["EMPTY_ARTISTAS", "EMPTY_ARTISTS"],
]);

function artistIdentifier(identifier) {
  if (ARTIST_EXACT.has(identifier)) return ARTIST_EXACT.get(identifier);

  let next = identifier;
  if (next.includes("Artista") || next.includes("Artistas")) {
    next = applyOrdered(next, [
      ["ArtistaVisao360", "ArtistOverview360"],
      ["ArtistaEvolucao", "ArtistEvolution"],
      ["ArtistaEvolution", "ArtistEvolution"],
      ["ArtistaPlatform", "ArtistPlatform"],
      ["ArtistasAssinados", "ContractedArtists"],
      ["ArtistaAssinado", "ContractedArtist"],
      ["ArtistaDistribuidora", "ArtistDistributor"],
      ["ArtistaResponsavel", "ArtistContactPerson"],
      ["ArtistaRelacionamento", "ArtistRelationship"],
      ["ArtistaTipoPerfil", "ArtistProfileType"],
      ["ArtistaEspecialidade", "ArtistSpecialty"],
      ["Artistas", "Artists"],
      ["Artista", "Artist"],
    ]);
  }
  if (next.includes("ARTISTAS") || next.includes("ARTISTA")) {
    next = next.split("ARTISTAS").join("ARTISTS").split("ARTISTA").join("ARTIST");
  }
  return next;
}

function hrPath(file) {
  return applyOrdered(file, [
    ["/modules/rh/", "/modules/hr/"],
    ["SolicitacaoFerias", "LeaveRequest"],
    ["DocumentosFuncionario", "EmployeeDocuments"],
    ["DocumentoFuncionario", "EmployeeDocument"],
    ["Funcionarios", "Employees"],
    ["Funcionario", "Employee"],
    ["solicitacao-ferias", "leave-request"],
    ["documentos-funcionario", "employee-documents"],
    ["documento-funcionario", "employee-document"],
    ["funcionarios", "employees"],
    ["funcionario", "employee"],
  ]);
}

const HR_EXACT = new Map([
  ["DocumentoFuncionario", "EmployeeDocument"],
  ["DocumentosFuncionario", "EmployeeDocuments"],
  ["SolicitacaoFerias", "LeaveRequest"],
  ["SolicitacaoFeriasFormModal", "LeaveRequestFormModal"],
  ["Funcionario", "Employee"],
  ["Funcionarios", "Employees"],
  ["useFuncionarios", "useEmployees"],
  ["useFuncionarioDetail", "useEmployeeDetail"],
  ["useCreateFuncionario", "useCreateEmployee"],
  ["useUpdateFuncionario", "useUpdateEmployee"],
  ["useRemoveFuncionario", "useRemoveEmployee"],
  ["useDocumentosFuncionario", "useEmployeeDocuments"],
  ["useCreateDocumentoFuncionario", "useCreateEmployeeDocument"],
]);

function hrIdentifier(identifier) {
  if (HR_EXACT.has(identifier)) return HR_EXACT.get(identifier);
  let next = identifier;
  if (next.includes("SolicitacaoFerias")) next = next.split("SolicitacaoFerias").join("LeaveRequest");
  if (next.includes("DocumentosFuncionario")) next = next.split("DocumentosFuncionario").join("EmployeeDocuments");
  if (next.includes("DocumentoFuncionario")) next = next.split("DocumentoFuncionario").join("EmployeeDocument");
  if (next.includes("Funcionarios")) next = next.split("Funcionarios").join("Employees");
  if (next.includes("Funcionario")) next = next.split("Funcionario").join("Employee");
  if (next.includes("FUNCIONARIOS")) next = next.split("FUNCIONARIOS").join("EMPLOYEES");
  if (next.includes("FUNCIONARIO")) next = next.split("FUNCIONARIO").join("EMPLOYEE");
  return next;
}

function contractsPath(file) {
  return applyOrdered(file, [
    ["TemplatesContratos", "ContractTemplates"],
    ["Contratos", "Contracts"],
    ["Contrato", "Contract"],
    ["documentos-persist", "documents-persistence"],
    ["contratos", "contracts"],
    ["contrato", "contract"],
  ]);
}

function contractsIdentifier(identifier) {
  let next = identifier;
  if (next.includes("TemplatesContratos")) next = next.split("TemplatesContratos").join("ContractTemplates");
  if (next.includes("Contratos")) next = next.split("Contratos").join("Contracts");
  if (next.includes("Contrato")) next = next.split("Contrato").join("Contract");
  if (next.includes("CONTRATOS")) next = next.split("CONTRATOS").join("CONTRACTS");
  if (next.includes("CONTRATO")) next = next.split("CONTRATO").join("CONTRACT");
  return next;
}

function accountingPath(file) {
  return applyOrdered(file, [
    ["NovaTransacao", "NewTransaction"],
    ["Transacoes", "Transactions"],
    ["Transacao", "Transaction"],
    ["transacao-form", "transaction-form"],
    ["transacoes", "transactions"],
    ["transacao", "transaction"],
  ]);
}

function accountingIdentifier(identifier) {
  let next = identifier;
  if (next.includes("NovaTransacao")) next = next.split("NovaTransacao").join("NewTransaction");
  if (next.includes("Transacoes")) next = next.split("Transacoes").join("Transactions");
  if (next.includes("Transacao")) next = next.split("Transacao").join("Transaction");
  if (next.includes("TRANSACOES")) next = next.split("TRANSACOES").join("TRANSACTIONS");
  if (next.includes("TRANSACAO")) next = next.split("TRANSACAO").join("TRANSACTION");
  return next;
}

function catalogPath(file) {
  return applyOrdered(file, [
    ["Licencas", "Licenses"],
    ["Licenca", "License"],
    ["Participantes", "Participants"],
    ["Participante", "Participant"],
    ["licencas", "licenses"],
    ["licenca", "license"],
    ["participantes", "participants"],
    ["participante", "participant"],
  ]);
}

function catalogIdentifier(identifier) {
  let next = identifier;
  if (next.includes("Licencas")) next = next.split("Licencas").join("Licenses");
  if (next.includes("Licenca")) next = next.split("Licenca").join("License");
  if (next.includes("Participantes")) next = next.split("Participantes").join("Participants");
  if (next.includes("Participante")) next = next.split("Participante").join("Participant");
  if (next.includes("LICENCAS")) next = next.split("LICENCAS").join("LICENSES");
  if (next.includes("LICENCA")) next = next.split("LICENCA").join("LICENSE");
  if (next.includes("PARTICIPANTES")) next = next.split("PARTICIPANTES").join("PARTICIPANTS");
  if (next.includes("PARTICIPANTE")) next = next.split("PARTICIPANTE").join("PARTICIPANT");
  return next;
}

const CONFIG = {
  artist: {
    pathTransform: artistPath,
    identifierTransform: artistIdentifier,
    moduleRules: [],
    staleIdentifier: /Artista|Artistas|ARTISTA/,
    stalePath: /Artista|Artistas|artista|artistas/,
  },
  hr: {
    pathTransform: hrPath,
    identifierTransform: hrIdentifier,
    moduleRules: [["@/modules/rh/", "@/modules/hr/"], ["/modules/rh/", "/modules/hr/"]],
    staleIdentifier: /Funcionario|Funcionarios|SolicitacaoFerias|DocumentoFuncionario|FUNCIONARIO/,
    stalePath: /\/modules\/rh\/|Funcionario|Funcionarios|funcionario|funcionarios|SolicitacaoFerias/,
  },
  contracts: {
    pathTransform: (file) => file.includes("/modules/contracts/") ? contractsPath(file) : file,
    identifierTransform: contractsIdentifier,
    moduleRules: [],
    staleIdentifier: /Contrato|Contratos|CONTRATO/,
    stalePath: /\/modules\/contracts\/.*(?:Contrato|Contratos|contrato|contratos)/,
  },
  accounting: {
    pathTransform: (file) => file.includes("/modules/accounting/") ? accountingPath(file) : file,
    identifierTransform: accountingIdentifier,
    moduleRules: [["transacao-form", "transaction-form"]],
    staleIdentifier: /Transacao|Transacoes|TRANSACAO/,
    stalePath: /\/modules\/accounting\/.*(?:Transacao|Transacoes|transacao|transacoes)/,
  },
  catalog: {
    pathTransform: (file) => file.includes("/modules/catalog/") ? catalogPath(file) : file,
    identifierTransform: catalogIdentifier,
    moduleRules: [],
    staleIdentifier: /Licenca|Licencas|Participante|Participantes|LICENCA|PARTICIPANTE/,
    stalePath: /\/modules\/catalog\/.*(?:Licenca|Licencas|licenca|licencas|Participante|Participantes|participante|participantes)/,
  },
};

function scanStaleIdentifiers(pattern) {
  const hits = [];
  for (const file of trackedFiles()) {
    if (!file.startsWith(WEB_SRC) || !isCodeFile(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    const variant = file.endsWith(".tsx") ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, variant, source);
    let token = scanner.scan();
    while (token !== ts.SyntaxKind.EndOfFileToken) {
      if (token === ts.SyntaxKind.Identifier) {
        const raw = source.slice(scanner.getTokenPos(), scanner.getTextPos());
        if (pattern.test(raw)) hits.push(`${file}: ${raw}`);
        pattern.lastIndex = 0;
      }
      token = scanner.scan();
    }
  }
  return hits;
}

function verifyProtectedPathsUntouched() {
  const changed = git(["status", "--porcelain=v1"])
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1));
  for (const file of changed) ensureSafePath(file);
}

const config = CONFIG[cluster];
const moves = renameFiles(config.pathTransform);
const moduleRules = buildModuleSpecifierRules(moves, config.moduleRules);
rewriteIdentifiersAndImports(config.identifierTransform, moduleRules);
verifyProtectedPathsUntouched();

const stalePaths = trackedFiles().filter((file) => file.startsWith(WEB_SRC) && config.stalePath.test(file));
const staleIdentifiers = scanStaleIdentifiers(config.staleIdentifier);

if (stalePaths.length || staleIdentifiers.length) {
  console.error("\nNormalization left developer-facing Portuguese technical names in the selected mechanical cluster.");
  if (stalePaths.length) console.error(`Stale paths:\n${stalePaths.join("\n")}`);
  if (staleIdentifiers.length) console.error(`Stale identifier tokens:\n${staleIdentifiers.slice(0, 200).join("\n")}`);
  throw new Error(`Cluster ${cluster} did not converge; extend the explicit mapping before committing.`);
}

const status = git(["status", "--short"]);
if (!status) {
  throw new Error(`Cluster ${cluster} produced no changes.`);
}

console.log("\nFINAL STATUS");
console.log(status);
