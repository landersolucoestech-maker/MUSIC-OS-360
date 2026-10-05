import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReleaseGenresSummary } from "@/modules/releases/components/ReleaseGenresSummary";
import { genreLabel } from "@/modules/releases/lib/genre-match";

describe("ReleaseGenresSummary", () => {
  it("renders the labels of both genres, one label, or a dash", () => {
    const { container, rerender } = render(<ReleaseGenresSummary genre="rock" secondaryGenre="pop" />);
    expect(container.textContent).toBe(`${genreLabel("rock")}, ${genreLabel("pop")}`);
    rerender(<ReleaseGenresSummary genre="rock" secondaryGenre="" />);
    expect(container.textContent).toBe(genreLabel("rock"));
    rerender(<ReleaseGenresSummary genre="" secondaryGenre="" />);
    expect(container.textContent).toBe("—");
  });
});
