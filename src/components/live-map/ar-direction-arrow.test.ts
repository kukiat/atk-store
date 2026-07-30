import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArDirectionArrow } from "@/components/live-map/ar-direction-arrow";

describe("ArDirectionArrow", () => {
  it("uses a north-facing glyph so zero degrees means straight ahead", () => {
    const markup = renderToStaticMarkup(
      createElement(ArDirectionArrow, { rotationDegrees: 0 }),
    );

    expect(markup).toContain("lucide-navigation-2");
    expect(markup).toContain('points="12 2 19 21 12 17 5 21 12 2"');
    expect(markup).toContain("transform:rotate(0deg)");
  });

  it("rotates only the glyph to the route-relative heading", () => {
    const markup = renderToStaticMarkup(
      createElement(ArDirectionArrow, { rotationDegrees: 90 }),
    );

    expect(markup).toContain("transform:rotate(90deg)");
    expect(markup.match(/transform:/g)).toHaveLength(1);
  });
});
