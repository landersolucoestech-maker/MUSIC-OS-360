import { describe, it, expect } from "vitest";
import {
  validateInstagramUrl,
  validateTiktokUrl,
  validateSoundcloudUrl,
  validateDeezerUrl,
  validateAppleMusicUrl,
} from "@/modules/artist/services/artist.mapper";

describe("artist URL validators (host-based, CWE-20)", () => {
  it("accepts real platform hosts (incl. subdomains)", () => {
    expect(validateInstagramUrl("https://instagram.com/lander")).toBe("valid");
    expect(validateInstagramUrl("https://www.instagram.com/lander")).toBe("valid");
    expect(validateTiktokUrl("https://www.tiktok.com/@lander")).toBe("valid");
    expect(validateSoundcloudUrl("https://soundcloud.com/lander")).toBe("valid");
    expect(validateDeezerUrl("https://www.deezer.com/artist/1")).toBe("valid");
    expect(validateAppleMusicUrl("https://music.apple.com/br/artist/1")).toBe("valid");
  });

  it("rejects substring-bypass attempts (host is NOT the platform)", () => {
    expect(validateInstagramUrl("https://evil.com/?x=instagram.com/")).toBe("invalid");
    expect(validateInstagramUrl("https://instagram.com.evil.com/x")).toBe("invalid");
    expect(validateTiktokUrl("https://evil.com/tiktok.com/")).toBe("invalid");
    expect(validateDeezerUrl("https://notdeezer.com/x")).toBe("invalid");
  });

  it("returns idle for empty and invalid for non-URLs", () => {
    expect(validateInstagramUrl("")).toBe("idle");
    expect(validateInstagramUrl("   ")).toBe("idle");
    expect(validateInstagramUrl("instagram.com/lander")).toBe("valid"); // scheme-less still host-validated
    expect(validateInstagramUrl("evil.com/instagram.com")).toBe("invalid"); // scheme-less bypass rejected
  });
});
