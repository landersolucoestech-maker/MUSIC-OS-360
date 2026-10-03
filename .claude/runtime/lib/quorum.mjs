// Real quorum/consensus mechanism on top of the existing conflict/decision/
// vote record kinds — formalizes .claude/rules/agent-orchestration.md's
// "Arbiter resolves evidence-backed reviewer conflicts" as counted votes
// against a conflict's declared parties, instead of one agent unilaterally
// writing a decision-record and calling it arbitration.
import { addRecord, getRecord, updateRecord, listRecords } from "./record-store.mjs";

export function castVote(cwd, conflictId, voter, choice) {
  const conflict = getRecord(cwd, "conflict", conflictId);
  if (!conflict) throw new Error(`CONFLICT_NOT_FOUND: ${conflictId}`);
  if (conflict.status !== "OPEN") throw new Error(`CONFLICT_NOT_OPEN: ${conflictId} is ${conflict.status}`);
  if (!conflict.parties.includes(voter)) throw new Error(`VOTER_NOT_A_PARTY: ${voter} is not among ${conflict.parties.join(", ")}`);
  if (tallyVotes(cwd, conflictId).votes.some((v) => v.voter === voter)) {
    throw new Error(`DUPLICATE_VOTE: ${voter} already voted on ${conflictId}; one vote per party per conflict`);
  }
  return addRecord(cwd, "vote", { conflictId, voter, choice });
}

export function tallyVotes(cwd, conflictId) {
  const conflict = getRecord(cwd, "conflict", conflictId);
  const parties = new Set(conflict ? conflict.parties : []);
  const all = listRecords(cwd, "vote")
    .filter((v) => v.conflictId === conflictId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  // Only the first vote of each distinct declared party counts, so neither a repeated voter nor a
  // non-party can manufacture a quorum even if vote records were written by another path.
  const seen = new Set();
  const votes = [];
  for (const v of all) {
    if (!parties.has(v.voter) || seen.has(v.voter)) continue;
    seen.add(v.voter);
    votes.push(v);
  }
  const counts = {};
  for (const v of votes) counts[v.choice] = (counts[v.choice] || 0) + 1;
  return { votes, counts };
}

/** A choice wins only when its vote count exceeds `threshold` (default
 * simple majority, >50%) of the conflict's DECLARED parties — not just of
 * votes cast, so an arbiter can't manufacture a quorum by having only
 * supporters vote. Writes a decision-record and flips the conflict to
 * RESOLVED only when a winner is found; otherwise leaves both untouched and
 * reports resolved:false so the caller knows to keep soliciting votes. */
export function resolveByQuorum(cwd, conflictId, { threshold = 0.5, decidedBy = "quorum" } = {}) {
  // A quorum is a majority: a threshold below 0.5 (or not a finite number below 1) would let a minority resolve a conflict.
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < 0.5 || threshold >= 1) {
    throw new Error(`INVALID_THRESHOLD: quorum threshold must be a finite number in [0.5, 1), got ${threshold}`);
  }

  const conflict = getRecord(cwd, "conflict", conflictId);
  if (!conflict) throw new Error(`CONFLICT_NOT_FOUND: ${conflictId}`);
  if (conflict.status !== "OPEN") return { resolved: false, reason: `conflict already ${conflict.status}` };
  const { counts, votes } = tallyVotes(cwd, conflictId);
  const denominator = new Set(conflict.parties).size;
  if (denominator < 2) return { resolved: false, reason: `conflict has ${denominator} distinct party; a quorum needs at least two` };
  let winner = null;
  for (const [choice, count] of Object.entries(counts)) {
    if (count / denominator > threshold) {
      winner = choice;
      break;
    }
  }
  if (!winner) return { resolved: false, reason: "no choice has crossed the quorum threshold yet", counts, denominator };
  const decision = addRecord(cwd, "decision", {
    topic: conflict.description,
    decision: winner,
    rationale: `resolved by quorum: ${counts[winner]}/${denominator} parties voted "${winner}"`,
    decidedBy,
    conflictId,
  });
  const resolvedConflict = updateRecord(cwd, "conflict", conflictId, { status: "RESOLVED", decisionId: decision.id });
  return { resolved: true, winner, counts, decision, conflict: resolvedConflict };
}
