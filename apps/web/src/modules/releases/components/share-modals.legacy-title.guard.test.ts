/**
 * Guard: the share modals no longer read the legacy `titulo_obra` key. The API never
 * returns it (the canonical field is `music_title`), so it was a dead probe.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (name: string) => fs.readFileSync(path.resolve(__dirname, name), "utf8");

describe("share modals title probes", () => {
  it.each(["ShareFormModal.tsx", "ShareViewModal.tsx"])("%s does not read titulo_obra", (file) => {
    const source = read(file);
    expect(source).not.toContain("titulo_obra");
    expect(source).toContain("music_title");
  });
});
