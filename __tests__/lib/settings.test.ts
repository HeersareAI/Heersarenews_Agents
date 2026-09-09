import { describe, it, expect } from "vitest";

describe("workspace settings defaults", () => {
  it("matches the expected default shape", () => {
    const defaults = {
      openaiModel: "gpt-4o",
      mockAiOutputs: false,
      newsSearchProvider: "tavily" as const,
    };
    expect(defaults.openaiModel).toBe("gpt-4o");
    expect(defaults.mockAiOutputs).toBe(false);
    expect(defaults.newsSearchProvider).toBe("tavily");
  });
});
