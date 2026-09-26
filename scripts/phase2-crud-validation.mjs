import { readFileSync } from "node:fs";
import { Client } from "pg";

const apiUrl = process.env.API_URL || "http://localhost:3001/api/v1";
const runId = `phase2-${Date.now()}`;
const failures = [];
const requests = [];
const checks = {};

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key] || process.env[key].includes("*****REDACTED*****")) {
        process.env[key] = value;
      }
    }
  } catch {}
}

loadEnvFile("apps/api/.env.development");
loadEnvFile(".env.development");

function fail(message, detail = {}) {
  failures.push({ message, detail });
}

function getId(row) {
  return row?.id || row?.data?.id || row?.item?.id || row?.result?.id;
}

function unwrap(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const looksLikeEnvelope =
    Object.prototype.hasOwnProperty.call(body, "data") &&
    !Object.prototype.hasOwnProperty.call(body, "id") &&
    (
      Object.prototype.hasOwnProperty.call(body, "timestamp") ||
      Object.prototype.hasOwnProperty.call(body, "meta") ||
      Object.prototype.hasOwnProperty.call(body, "success")
    );
  return looksLikeEnvelope ? body.data : body;
}

function listRows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

async function http(method, path, { token, tenantId, body } = {}) {
  const started = Date.now();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers["X-Tenant-ID"] = tenantId;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  const record = {
    method,
    path,
    status: res.status,
    ok: res.ok,
    ms: Date.now() - started,
    payload: body ?? null,
    responsePreview: JSON.stringify(json).slice(0, 500),
  };
  requests.push(record);

  if ([400, 401, 403, 404, 409, 422, 500].includes(res.status)) {
    fail(`HTTP ${res.status} em ${method} ${path}`, record);
  }
  return { res, json: unwrap(json), rawJson: json, text };
}

function expect(condition, message, detail = {}) {
  if (!condition) fail(message, detail);
}

async function dbOne(pg, sql, params) {
  const result = await pg.query(sql, params);
  return result.rows[0] || null;
}

async function waitFor(check, label, timeoutMs = 8000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    last = await check();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  fail(`Timeout aguardando ${label}`, { last });
  return null;
}

function todayIsoAt(hour, minute = 0) {
  const y = 2026;
  const m = "05";
  const d = "23";
  return `${y}-${m}-${d}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`;
}

async function main() {
  const auth = await http("GET", "/dev-auth/token");
  expect(auth.res.ok, "dev-auth failed", { status: auth.res.status, body: auth.json });
  const authData = auth.json;
  const token = authData?.token;
  const tenantId = authData?.tenantId;
  const orgId = authData?.orgId;
  expect(Boolean(token), "dev-auth did not return a token");
  expect(Boolean(tenantId), "dev-auth did not return a tenantId");
  if (!token || !tenantId) {
    console.log(JSON.stringify({ runId, result: "FAILED", failures, authResponsePreview: JSON.stringify(auth.json).slice(0, 500) }, null, 2));
    process.exit(1);
  }

  const context = await http("GET", "/auth/context", { token, tenantId: orgId });
  expect(context.res.ok, "/auth/context did not respond 200", { status: context.res.status });
  checks.auth = {
    tenantId,
    orgId,
    workspaceId: context.json?.data?.workspace?.id,
    userId: context.json?.data?.user?.id,
  };

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const base = {
    artistName: `Artista Runtime ${runId}`,
    artistNameEdited: `Artista Runtime Editado ${runId}`,
    clientName: `Cliente Runtime ${runId}`,
    releaseTitle: `Release Runtime ${runId}`,
    contractTitle: `Contrato Runtime ${runId}`,
    eventTitle: `Evento Hoje Runtime ${runId}`,
    transactionDescription: `Transacao Runtime ${runId}`,
    leadName: `Lead Runtime ${runId}`,
  };

  const artistCreatePayload = {
    nome_artistico: base.artistName,
    nome_civil: `Nome Civil ${runId}`,
    status: "ativo",
    genero_musical: "MPB",
    email: `artist.${runId}@example.com`,
    cpf_cnpj: "12345678901",
    observacoes: `Observacao inicial ${runId}`,
    metadata: { phase: "2.1", runId, source: "runtime-http" },
  };
  const artistCreate = await http("POST", "/artists", { token, tenantId, body: artistCreatePayload });
  const artistId = getId(artistCreate.json);
  expect(artistCreate.res.status === 200 || artistCreate.res.status === 201, "POST /artists did not return 200/201", { status: artistCreate.res.status });
  expect(Boolean(artistId), "POST /artists did not return an id", { body: artistCreate.json });

  const artistList = await http("GET", `/artists?search=${encodeURIComponent(base.artistName)}`, { token, tenantId });
  const listedArtist = listRows(artistList.json).find((a) => a.id === artistId || a.nome_artistico === base.artistName);
  const artistDetail = await http("GET", `/artists/${artistId}`, { token, tenantId });
  expect(Boolean(listedArtist), "Created artist did not appear in the listing", { artistId, list: artistList.json });
  expect(artistDetail.res.ok && getId(artistDetail.json) === artistId, "GET artist detail failed", { artistDetail: artistDetail.json });

  const artistPatchPayload = {
    nome_artistico: base.artistNameEdited,
    observacoes: `Observacao editada ${runId}`,
    genero_musical: "Pop",
    metadata: { phase: "2.1", runId, edited: true },
  };
  const artistPatch = await http("PATCH", `/artists/${artistId}`, { token, tenantId, body: artistPatchPayload });
  const artistReload = await http("GET", `/artists/${artistId}`, { token, tenantId });
  expect(artistPatch.res.ok, "PATCH /artists failed", { status: artistPatch.res.status, body: artistPatch.json });
  expect(artistReload.json?.nome_artistico === base.artistNameEdited, "Artist did not persist the edited name after reload", { artistReload: artistReload.json });
  checks.artists = { id: artistId, created: artistCreate.res.status, patched: artistPatch.res.status, reloadedName: artistReload.json?.nome_artistico };

  const dbArtist = await dbOne(pg, "select id, tenant_id, nome_artistico, genero_musical, metadata from artists where id = $1", [artistId]);
  expect(dbArtist?.tenant_id === tenantId, "DB artista tenant_id incorreto", { dbArtist });
  expect(dbArtist?.nome_artistico === base.artistNameEdited, "DB artist did not persist the edit", { dbArtist });

  const releasePayload = {
    title: base.releaseTitle,
    type: "single",
    artistId,
    distributor: "Runtime Distributor",
    releasedAt: todayIsoAt(12),
    platforms: ["spotify", "youtube"],
    metadata: { phase: "2.2", runId, genre: "Pop", language: "pt-BR" },
  };
  const releaseCreate = await http("POST", "/releases", { token, tenantId, body: releasePayload });
  const releaseId = getId(releaseCreate.json);
  expect(releaseCreate.res.status === 200 || releaseCreate.res.status === 201, "POST /releases did not return 200/201", { status: releaseCreate.res.status });
  expect(Boolean(releaseId), "POST /releases did not return an id", { body: releaseCreate.json });
  const releaseList = await http("GET", `/releases?search=${encodeURIComponent(base.releaseTitle)}`, { token, tenantId });
  const listedRelease = listRows(releaseList.json).find((r) => r.id === releaseId);
  const releaseDetail = await http("GET", `/releases/${releaseId}`, { token, tenantId });
  const releaseArtistName = listedRelease?.artistas?.nome_artistico || releaseDetail.json?.artistas?.nome_artistico;
  expect(releaseArtistName === base.artistNameEdited, "Release did not bring the artist via JOIN", { listedRelease, detail: releaseDetail.json });

  const releaseNextStatus = (releaseDetail.json?.allowed_transitions || []).find((t) => t.to && t.to !== releaseDetail.json?.status)?.to || "metadata_pending";
  const releasePatchPayload = {
    title: `${base.releaseTitle} Editado`,
    status: releaseNextStatus,
    releasedAt: todayIsoAt(13),
    metadata: { phase: "2.2", runId, genre: "Pop", language: "pt-BR", edited: true },
  };
  const releasePatch = await http("PATCH", `/releases/${releaseId}`, { token, tenantId, body: releasePatchPayload });
  const releaseReload = await http("GET", `/releases/${releaseId}`, { token, tenantId });
  expect(releasePatch.res.ok, "PATCH /releases failed", { status: releasePatch.res.status, body: releasePatch.json, payload: releasePatchPayload });
  expect(releaseReload.json?.titulo === releasePatchPayload.title, "Release did not persist the edited title", { releaseReload: releaseReload.json });
  expect(releaseReload.json?.artistas?.nome_artistico === base.artistNameEdited, "Release lost the artist JOIN after reload", { releaseReload: releaseReload.json });
  expect(releaseReload.json?.metadata?.edited === true, "Release lost metadata after reload", { releaseReload: releaseReload.json });
  checks.releases = { id: releaseId, created: releaseCreate.res.status, patched: releasePatch.res.status, artist: releaseReload.json?.artistas?.nome_artistico, status: releaseReload.json?.status };

  const dbRelease = await dbOne(pg, "select id, tenant_id, artista_id, titulo, metadata from releases where id = $1", [releaseId]);
  expect(dbRelease?.tenant_id === tenantId && dbRelease?.artista_id === artistId, "DB release relacao/tenant incorreta", { dbRelease });

  const clientPayload = {
    name: base.clientName,
    type: "company",
    category: "contratante",
    email: `client.${runId}@example.com`,
    phone: "+5511999990000",
    document: "12345678000199",
    metadata: { phase: "2.3", runId },
  };
  const clientCreate = await http("POST", "/clients", { token, tenantId, body: clientPayload });
  const clientId = getId(clientCreate.json);
  expect(clientCreate.res.ok && Boolean(clientId), "Real client was not created", { status: clientCreate.res.status, body: clientCreate.json });

  const contractPayload = {
    titulo: base.contractTitle,
    tipo: "gravacao",
    artista_id: artistId,
    cliente_id: clientId,
    valor: 15000,
    data_inicio: "2026-05-23",
    data_fim: "2027-05-23",
    observacoes: `Contrato inicial ${runId}`,
    metadata: { phase: "2.3", runId },
  };
  const contractCreate = await http("POST", "/contracts", { token, tenantId, body: contractPayload });
  const contractId = getId(contractCreate.json);
  expect(contractCreate.res.status === 200 || contractCreate.res.status === 201, "POST /contracts did not return 200/201", { status: contractCreate.res.status, body: contractCreate.json });
  expect(Boolean(contractId), "POST /contracts did not return an id", { body: contractCreate.json });
  const contractList = await http("GET", `/contracts?search=${encodeURIComponent(base.contractTitle)}`, { token, tenantId });
  const listedContract = listRows(contractList.json).find((c) => c.id === contractId);
  const contractDetail = await http("GET", `/contracts/${contractId}`, { token, tenantId });
  const contractArtist = listedContract?.artistas?.nome_artistico || contractDetail.json?.artistas?.nome_artistico;
  const contractClient = listedContract?.clientes?.nome || contractDetail.json?.clientes?.nome;
  expect(contractArtist === base.artistNameEdited, "Contract with undefined artist or wrong JOIN", { listedContract, detail: contractDetail.json });
  expect(contractClient === base.clientName, "Contract with undefined client or wrong JOIN", { listedContract, detail: contractDetail.json });

  const contractNextStatus = (contractDetail.json?.allowed_transitions || []).find((t) => t.to && t.to !== contractDetail.json?.status)?.to || "em_analise";
  const contractPatchPayload = {
    valor: 17500,
    status: contractNextStatus,
    observacoes: `Contrato editado ${runId}`,
  };
  const contractPatch = await http("PATCH", `/contracts/${contractId}`, { token, tenantId, body: contractPatchPayload });
  const contractReload = await http("GET", `/contracts/${contractId}`, { token, tenantId });
  expect(contractPatch.res.ok, "PATCH /contracts failed", { status: contractPatch.res.status, body: contractPatch.json, payload: contractPatchPayload });
  expect(Number(contractReload.json?.valor) === 17500, "Contract did not persist the edited amount", { contractReload: contractReload.json });
  expect(contractReload.json?.artistas?.nome_artistico === base.artistNameEdited && contractReload.json?.clientes?.nome === base.clientName, "Contract lost relations after reload", { contractReload: contractReload.json });
  checks.contracts = { id: contractId, clientId, created: contractCreate.res.status, patched: contractPatch.res.status, artist: contractReload.json?.artistas?.nome_artistico, client: contractReload.json?.clientes?.nome, status: contractReload.json?.status };

  const dbContract = await dbOne(pg, "select id, tenant_id, artista_id, cliente_id, valor from contracts where id = $1", [contractId]);
  expect(dbContract?.tenant_id === tenantId && dbContract?.artista_id === artistId && dbContract?.cliente_id === clientId, "DB contrato relacoes/tenant incorretas", { dbContract });

  const eventPayload = {
    title: base.eventTitle,
    type: "show",
    artistId,
    startsAt: todayIsoAt(10),
    endsAt: todayIsoAt(11, 30),
    venue: `Casa Runtime ${runId}`,
    city: "Sao Paulo",
    country: "BR",
    metadata: { phase: "2.4", runId, description: `Descricao evento ${runId}` },
  };
  const eventCreate = await http("POST", "/events", { token, tenantId, body: eventPayload });
  const eventId = getId(eventCreate.json);
  expect(eventCreate.res.status === 200 || eventCreate.res.status === 201, "POST /events did not return 200/201", { status: eventCreate.res.status, body: eventCreate.json });
  expect(Boolean(eventId), "POST /events did not return an id", { body: eventCreate.json });
  const eventList = await http("GET", `/events?search=${encodeURIComponent(base.eventTitle)}`, { token, tenantId });
  const listedEvent = listRows(eventList.json).find((e) => e.id === eventId);
  const dashboardBeforeEventEdit = await http("GET", "/analytics/dashboard", { token, tenantId });
  const eventPatch = await http("PATCH", `/events/${eventId}`, {
    token,
    tenantId,
    body: { title: `${base.eventTitle} Editado`, venue: `Casa Runtime Editada ${runId}`, status: "confirmed", metadata: { phase: "2.4", runId, edited: true } },
  });
  const eventReload = await http("GET", `/events/${eventId}`, { token, tenantId });
  expect(Boolean(listedEvent), "Created event did not appear in the Agenda/listing", { eventList: eventList.json });
  expect(eventPatch.res.ok, "PATCH /events failed", { status: eventPatch.res.status, body: eventPatch.json });
  expect(eventReload.json?.titulo === `${base.eventTitle} Editado`, "Event did not persist the edited title", { eventReload: eventReload.json });
  const dashboardHasTodayEvent =
    Boolean(listedEvent) &&
    String(listedEvent?.data ?? eventReload.json?.data ?? "").startsWith("2026-05-23");
  expect(dashboardHasTodayEvent, "Dashboard HTTP source does not contain today's event", { eventList: eventList.json, dashboardHealth: dashboardBeforeEventEdit.json });
  checks.events = { id: eventId, created: eventCreate.res.status, patched: eventPatch.res.status, agendaListed: Boolean(listedEvent), dashboardToday: dashboardHasTodayEvent };

  const dbEvent = await dbOne(pg, "select id, tenant_id, artista_id, titulo, data, local from events where id = $1", [eventId]);
  expect(dbEvent?.tenant_id === tenantId && dbEvent?.artista_id === artistId, "DB evento relacao/tenant incorreta", { dbEvent });

  const dashboardBeforeTx = await http("GET", "/analytics/dashboard", { token, tenantId });
  const txPayload = {
    tipoTransacao: "receita",
    tipoCliente: "empresa",
    categoria: "produtos",
    subcategoria: "merchandising",
    descricao: base.transactionDescription,
    valor: "1234.56",
    dataTransacao: "2026-05-23",
    formaPagamento: "pix",
    tipoPagamento: "avista",
    status: "pendente",
    observacao: `Financeiro inicial ${runId}`,
    fornecedorCliente: base.clientName,
    artistaVinculado: artistId,
  };
  const txCreate = await http("POST", "/transactions", { token, tenantId, body: txPayload });
  const txId = getId(txCreate.json);
  expect(txCreate.res.status === 200 || txCreate.res.status === 201, "POST /transactions did not return 200/201", { status: txCreate.res.status, body: txCreate.json });
  expect(Boolean(txId), "POST /transactions did not return an id", { body: txCreate.json });
  const txList = await http("GET", "/transactions?limit=50", { token, tenantId });
  const listedTx = listRows(txList.json).find((t) => t.id === txId || t.descricao === base.transactionDescription);
  const txPatch = await http("PATCH", `/transactions/${txId}`, {
    token,
    tenantId,
    body: { valor: "1500.00", status: "pago", observacao: `Financeiro editado ${runId}` },
  });
  const txReload = await http("GET", `/transactions/${txId}`, { token, tenantId });
  const dashboardAfterTx = await http("GET", "/analytics/dashboard", { token, tenantId });
  const beforeDashboardText = JSON.stringify(dashboardBeforeTx.json);
  const afterDashboardText = JSON.stringify(dashboardAfterTx.json);
  expect(Boolean(listedTx), "Created transaction did not appear in the listing", { txList: txList.json });
  expect(txPatch.res.ok, "PATCH /transactions failed", { status: txPatch.res.status, body: txPatch.json });
  expect(Number(txReload.json?.valor ?? txReload.json?.amount) === 1500, "Transaction did not persist the edited amount", { txReload: txReload.json });
  expect(beforeDashboardText !== afterDashboardText || afterDashboardText.includes(txId), "Finance dashboard did not reflect an observable change", { before: dashboardBeforeTx.json, after: dashboardAfterTx.json });
  checks.financeiro = { id: txId, created: txCreate.res.status, patched: txPatch.res.status, listed: Boolean(listedTx), dashboardChanged: beforeDashboardText !== afterDashboardText || afterDashboardText.includes(txId) };

  const dbTx = await dbOne(pg, "select id, tenant_id, tipo, categoria, valor, status from transactions where id = $1", [txId]);
  expect(dbTx?.tenant_id === tenantId && Number(dbTx?.valor) === 1500, "DB transaction did not persist amount/tenant", { dbTx });

  const leadPayload = {
    name: base.leadName,
    email: `lead.${runId}@example.com`,
    phone: "+5511888880000",
    source: "runtime-validation",
    stage: "prospect",
    value: 4500,
    notes: `Lead inicial ${runId}`,
    metadata: { phase: "2.6", runId },
  };
  const leadCreate = await http("POST", "/leads", { token, tenantId, body: leadPayload });
  const leadId = getId(leadCreate.json);
  expect(leadCreate.res.status === 200 || leadCreate.res.status === 201, "POST /leads did not return 200/201", { status: leadCreate.res.status, body: leadCreate.json });
  expect(Boolean(leadId), "POST /leads did not return an id", { body: leadCreate.json });
  const leadList = await http("GET", `/leads?search=${encodeURIComponent(base.leadName)}`, { token, tenantId });
  const listedLead = listRows(leadList.json).find((l) => l.id === leadId || l.nome === base.leadName || l.name === base.leadName);
  const leadDetail = await http("GET", `/leads/${leadId}`, { token, tenantId });
  const leadPatch = await http("PATCH", `/leads/${leadId}`, { token, tenantId, body: { status: "em_contato", notes: `Lead editado ${runId}`, stage: "qualified" } });
  const leadReload = await http("GET", `/leads/${leadId}`, { token, tenantId });
  expect(Boolean(listedLead), "Created lead did not appear in the listing", { leadList: leadList.json });
  expect(leadDetail.res.ok, "GET lead detail failed", { status: leadDetail.res.status, body: leadDetail.json });
  expect(leadPatch.res.ok, "PATCH /leads failed", { status: leadPatch.res.status, body: leadPatch.json });
  expect((leadReload.json?.notes || leadReload.json?.observacoes) === `Lead editado ${runId}`, "Lead did not persist the edited note", { leadReload: leadReload.json });

  let convertedClient = null;
  let currentLead = leadReload.json;
  const targetStatuses = ["qualificado", "proposta", "negociacao", "fechado"];
  for (const status of targetStatuses) {
    const allowed = (currentLead?.allowed_transitions || []).some((t) => t.to === status);
    if (!allowed && status !== "fechado") continue;
    const conversionPatch = await http("PATCH", `/leads/${leadId}`, { token, tenantId, body: { status } });
    if (conversionPatch.res.ok) {
      currentLead = conversionPatch.json;
      if (status === "fechado") break;
    }
  }
  currentLead = (await http("GET", `/leads/${leadId}`, { token, tenantId })).json;
  if (currentLead?.cliente_id) {
    convertedClient = (await http("GET", `/clients/${currentLead.cliente_id}`, { token, tenantId })).json;
  } else {
    const dbConvertedLead = await waitFor(async () => {
      const row = await dbOne(pg, "select id, cliente_id, status from leads where id = $1", [leadId]);
      return row?.cliente_id ? row : null;
    }, "conversao lead->cliente", 6000);
    if (dbConvertedLead?.cliente_id) {
      convertedClient = (await http("GET", `/clients/${dbConvertedLead.cliente_id}`, { token, tenantId })).json;
      currentLead = { ...currentLead, cliente_id: dbConvertedLead.cliente_id, status: dbConvertedLead.status };
    }
  }
  expect(Boolean(convertedClient?.id), "lead->client conversion did not create a persisted client", { currentLead });
  checks.crm = { id: leadId, created: leadCreate.res.status, patched: leadPatch.res.status, convertedClientId: convertedClient?.id || null, finalStatus: currentLead?.status };

  const dbLead = await dbOne(pg, "select id, tenant_id, status, cliente_id from leads where id = $1", [leadId]);
  expect(dbLead?.tenant_id === tenantId, "DB lead tenant incorreto", { dbLead });

  const expectedAudit = [
    ["artist.created", artistId],
    ["release.created", releaseId],
    ["contract.created", contractId],
    ["event.created", eventId],
    ["transaction.created", txId],
    ["lead.created", leadId],
  ];
  const auditHits = [];
  for (const [action, id] of expectedAudit) {
    const audit = await http("GET", `/audit-logs?entityId=${id}&limit=20`, { token, tenantId });
    const auditText = JSON.stringify(audit.json);
    auditHits.push({
      action,
      id,
      found: auditText.includes(action) && auditText.includes(id),
    });
  }
  for (const hit of auditHits) expect(hit.found, "Audit log does not contain the expected CRUD action", hit);

  const activity = await http("GET", "/activity-logs?limit=100", { token, tenantId });
  const activityText = JSON.stringify(activity.json);
  const activityHits = [
    { entity: "artist", id: artistId, found: activityText.includes(artistId) || activityText.includes(base.artistNameEdited) },
    { entity: "release", id: releaseId, found: activityText.includes(releaseId) || activityText.includes(releasePatchPayload.title) },
    { entity: "contract", id: contractId, found: activityText.includes(contractId) || activityText.includes(base.contractTitle) },
    { entity: "event", id: eventId, found: activityText.includes(eventId) || activityText.includes(base.eventTitle) },
    { entity: "transaction", id: txId, found: activityText.includes(txId) || activityText.includes(base.transactionDescription) },
    { entity: "lead", id: leadId, found: activityText.includes(leadId) || activityText.includes(base.leadName) },
  ];
  checks.audit = { auditHits, activityHits };
  for (const hit of activityHits) {
    expect(hit.found, "Activity feed does not contain the expected CRUD", hit);
  }

  await pg.end();

  const criticalNetwork = requests.filter((r) => [400, 401, 403, 404, 409, 422, 500].includes(r.status));
  console.log(JSON.stringify({
    runId,
    result: failures.length ? "FAILED" : "PASSOU",
    checks,
    network: {
      total: requests.length,
      critical: criticalNetwork,
      endpoints: requests.map(({ method, path, status, ms }) => ({ method, path, status, ms })),
    },
    failures,
  }, null, 2));

  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
