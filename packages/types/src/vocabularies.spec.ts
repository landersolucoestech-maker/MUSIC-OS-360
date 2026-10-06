import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRIAGE_PRIORITIES, RELATIONSHIP_PRIORITIES, WORK_PRIORITIES, PRIORITY_LABEL_PT_BR, SupportTicketPriority,
  INTEGRATION_PROVIDER_IDS, GENERIC_OAUTH_PROVIDER_IDS, SOCIAL_PLATFORM_IDS, CAMPAIGN_AD_PLATFORMS, AD_PLATFORM_TO_PROVIDER_ID,
  TRANSACTION_TYPE_VALUES, COUNTERPARTY_TYPE_VALUES, RULE_LINK_VALUES, COUNTERPARTY_TYPE_LABELS_PT_BR, RULE_LINK_LABELS_PT_BR,
  TRANSACTION_TYPE_LABELS_PT_BR, TransactionType,
  ARTIST_TEAM_CONTACT_CATEGORIES, ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR,
  ProjectStatus, PROJECT_STATUS_LABELS_PT_BR,
} from "./index";

const sorted = (xs: readonly string[]) => [...xs].sort();

test("priority scales are pinned and distinct", () => {
  assert.deepEqual(TRIAGE_PRIORITIES, ["high", "medium", "low"]);
  assert.deepEqual(RELATIONSHIP_PRIORITIES, ["low", "medium", "high", "strategic"]);
  assert.deepEqual(WORK_PRIORITIES, ["low", "normal", "high", "urgent"]);
});

test("PRIORITY_LABEL_PT_BR covers every priority value of every scale", () => {
  const all = new Set<string>([
    ...TRIAGE_PRIORITIES, ...RELATIONSHIP_PRIORITIES, ...WORK_PRIORITIES, ...Object.values(SupportTicketPriority),
  ]);
  assert.deepEqual(sorted(Object.keys(PRIORITY_LABEL_PT_BR)), sorted([...all]));
  assert.equal(PRIORITY_LABEL_PT_BR.medium, "Média");
  assert.equal(PRIORITY_LABEL_PT_BR.normal, "Normal");
});

test("integration providers are pinned (incl. corp_*)", () => {
  assert.deepEqual(INTEGRATION_PROVIDER_IDS, [
    "corp_instagram", "meta_business", "meta_ads", "corp_tiktok", "tiktok_business", "tiktok_ads",
    "corp_youtube", "youtube_business", "google_business", "google_ads", "youtube_ads",
    "spotify_ads", "corp_spotify", "docusign", "stripe_connect",
  ]);
  assert.deepEqual(GENERIC_OAUTH_PROVIDER_IDS, INTEGRATION_PROVIDER_IDS.filter((id) => !id.includes("spotify")));
  for (const id of INTEGRATION_PROVIDER_IDS) assert.match(id, /^[a-z]+(_[a-z]+)*$/);
});

test("social platforms equal a copy of the API SOCIAL_PLATFORMS list", () => {
  assert.deepEqual(SOCIAL_PLATFORM_IDS, ["spotify", "youtube", "deezer", "soundcloud", "instagram", "tiktok", "apple-music"]);
});

test("AD_PLATFORM_TO_PROVIDER_ID is total and targets real providers", () => {
  assert.deepEqual(CAMPAIGN_AD_PLATFORMS, ["META_ADS", "GOOGLE_ADS", "YOUTUBE_ADS", "TIKTOK_ADS", "SPOTIFY_ADS"]);
  assert.deepEqual(sorted(Object.keys(AD_PLATFORM_TO_PROVIDER_ID)), sorted(CAMPAIGN_AD_PLATFORMS));
  for (const platform of CAMPAIGN_AD_PLATFORMS) {
    assert.ok((INTEGRATION_PROVIDER_IDS as readonly string[]).includes(AD_PLATFORM_TO_PROVIDER_ID[platform]));
    assert.equal(AD_PLATFORM_TO_PROVIDER_ID[platform], platform.toLowerCase());
  }
});

test("accounting vocabulary is pinned and labelled", () => {
  assert.deepEqual(TRANSACTION_TYPE_VALUES, ["revenue", "expense", "investment", "tax", "transfer"]);
  assert.deepEqual(sorted(TRANSACTION_TYPE_VALUES), sorted(Object.values(TransactionType)));
  assert.deepEqual(sorted(Object.keys(TRANSACTION_TYPE_LABELS_PT_BR)), sorted(TRANSACTION_TYPE_VALUES));
  assert.deepEqual(COUNTERPARTY_TYPE_VALUES, ["company", "individual", "artist", "government", "own_account"]);
  assert.deepEqual(sorted(Object.keys(COUNTERPARTY_TYPE_LABELS_PT_BR)), sorted(COUNTERPARTY_TYPE_VALUES));
  assert.deepEqual(RULE_LINK_VALUES, [
    "artist", "project", "contract", "event", "cost_center", "reference_month", "source_bank_account", "destination_bank_account",
  ]);
  assert.deepEqual(sorted(Object.keys(RULE_LINK_LABELS_PT_BR)), sorted(RULE_LINK_VALUES));
});

test("artist team contact categories are pinned and labelled", () => {
  assert.deepEqual(ARTIST_TEAM_CONTACT_CATEGORIES, [
    "booker", "press_office", "legal", "finance", "accountant", "publisher", "agent", "record_label", "roadie",
  ]);
  assert.deepEqual(sorted(Object.keys(ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR)), sorted(ARTIST_TEAM_CONTACT_CATEGORIES));
});

test("project product statuses are the closed list of four labels; the internal review state is presented as in progress", () => {
  const labels = PROJECT_STATUS_LABELS_PT_BR;
  assert.equal(labels[ProjectStatus.REVIEW], labels[ProjectStatus.IN_PROGRESS]);
  assert.equal(new Set(Object.values(labels)).size, 4);
  assert.deepEqual(sorted(Object.keys(labels)), sorted(Object.values(ProjectStatus)));
});
