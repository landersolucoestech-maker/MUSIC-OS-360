---
name: why
description: A structured 5-whys pass for turning a symptom into a systemic root cause — the technique root-cause-investigator applies, extracted as a standalone skill for use outside a full incident (e.g. "why does this test keep flaking", "why did this PR need three follow-up fixes"). Distinguishing symptom from systemic cause is the entire point; do not stop at the first plausible-sounding answer.
---

# Why

1. State the symptom precisely (not "it's broken" — the exact wrong behavior, input, and
   expected-vs-actual output).
2. Ask "why did that happen" and answer with something you can point at in the code/config/process
   — not a guess. Repeat against the new answer, typically 3-5 times, until you reach a systemic
   cause (a missing validation, a missing test, a missing review step) rather than stopping at the
   first proximate trigger.
3. At each level, ask whether this same chain could produce a DIFFERENT symptom elsewhere — if so,
   the systemic cause is broader than this one instance.
4. Record the chain as a `decision-record` (`node .claude/runtime/ops.mjs decision add
   --topic "why: <symptom>" --decision "<systemic cause + prevention>" --decided-by "..."`) so the reasoning survives past this conversation.

## Non-goals
Do not use this to justify a fix you've already decided on — if the chain doesn't actually lead
there, the fix is wrong, not the analysis.
