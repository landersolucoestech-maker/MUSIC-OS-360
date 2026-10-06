/** Distributed is never a plain status click: the modal opens the confirmation dialog instead of transitioning directly. */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MODAL = fs.readFileSync(path.resolve(__dirname, "ReleaseViewModal.tsx"), "utf8");

describe("ReleaseViewModal — distribution needs a registered confirmation", () => {
  it("the transition panel goes through the interceptor, not straight to the workflow hook", () => {
    expect(MODAL).toMatch(/onTransition=\{requestTransition\}/);
    expect(MODAL).not.toMatch(/onTransition=\{workflowTransition\}/);
  });

  it("the interceptor sends distributed targets to the dialog, and only the dialog sends the confirmation", () => {
    expect(MODAL).toMatch(/isDistributionTarget\(toStatus\)/);
    expect(MODAL).toMatch(/workflowTransition\(\{ toStatus: "distributed", metadata \}\)/);
  });
});
