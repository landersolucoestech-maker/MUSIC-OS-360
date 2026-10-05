import { describe, expect, it } from "vitest";
import { normalizeUserStatus, userStatusLabel } from "@/modules/settings/lib/user-status";
import {
  normalizeOrganizationIndustry,
  organizationIndustryLabel,
} from "@/modules/auth/constants/organization-industry";
import { eventCategoryToBackendType, normalizeToBackendType } from "@/modules/events/lib/event-type";

// User/stored text must never resolve to an inherited Object.prototype member.
const PROTOTYPE_KEYS = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];

describe("prototype keys: user-status", () => {
  it.each(PROTOTYPE_KEYS)("%s falls back to the default status", (key) => {
    expect(normalizeUserStatus(key)).toBe("active");
    expect(normalizeUserStatus(key, "inactive")).toBe("inactive");
    expect(typeof userStatusLabel(key)).toBe("string");
  });
});

describe("prototype keys: organization-industry", () => {
  it.each(PROTOTYPE_KEYS)("%s falls back to other", (key) => {
    expect(normalizeOrganizationIndustry(key)).toBe("other");
    expect(typeof organizationIndustryLabel(key)).toBe("string");
  });
});

describe("prototype keys: event-type", () => {
  it.each(PROTOTYPE_KEYS)("%s maps to other (empty granular map)", (key) => {
    expect(eventCategoryToBackendType(key, {})).toBe("other");
    expect(normalizeToBackendType(key, {})).toBe("other");
  });
  it("still honours own granular entries", () => {
    expect(eventCategoryToBackendType("studio_sessions", { studio_sessions: "recording" })).toBe("recording");
    expect(normalizeToBackendType("rehearsals", { rehearsals: "meeting" })).toBe("meeting");
  });
});
