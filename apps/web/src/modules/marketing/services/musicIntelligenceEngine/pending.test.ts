import { describe, expect, it } from "vitest";
import { analyzeAudioDraft } from "./analyzeAudio";
import { mergeAudioLyricsInsights } from "./mergeAudioLyricsInsights";
import { PENDING_VALUE, isPendingValue } from "./pending";

describe("music intelligence pending sentinel", () => {
  it("uses the English canonical sentinel and still reads the legacy one", () => {
    expect(PENDING_VALUE).toBe("pending");
    expect(isPendingValue("pending")).toBe(true);
    expect(isPendingValue("pendente")).toBe(true);
    expect(isPendingValue("alta")).toBe(false);
  });

  it("emits no PT sentinel from the audio draft", () => {
    const audio = analyzeAudioDraft({ audioUrl: "", genre: "", subgenre: "", mood: "", bpm: "" });
    expect(JSON.stringify(audio)).not.toContain("pendente");
    expect(audio.mood).toBe("pending");
  });

  it("falls back to lyric sentiment when audio mood is pending (either spelling)", () => {
    const lyrics = { mainTheme: "", sentiment: "alegre", targetAudience: "", editorialTags: [], hooks: [], missingData: [] } as never;
    const audio = analyzeAudioDraft({ audioUrl: "", genre: "", subgenre: "", mood: "", bpm: "" });
    expect(mergeAudioLyricsInsights(audio, lyrics).mood).toBe("alegre");
    expect(mergeAudioLyricsInsights({ ...audio, mood: "pendente" }, lyrics).mood).toBe("alegre");
  });
});
