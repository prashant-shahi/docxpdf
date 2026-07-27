/*
 * Copyright 2026 Prashant Shahi
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect } from "vitest";
import {
  SHAPE_CATALOG,
  shapeLabel,
  shapeTypeFromOoxmlGeom,
  ooxmlGeomForShape,
  shapeBoxStyle,
} from "./shapes";
import type { ShapeElement } from "./types";

describe("shapes", () => {
  it("catalog includes extended shape types", () => {
    const types = SHAPE_CATALOG.map((s) => s.type);
    expect(types).toContain("rounded");
    expect(types).toContain("triangle");
    expect(types).toContain("star");
    expect(types).toContain("arrow");
  });

  it("maps OOXML geometry to internal shape types", () => {
    expect(shapeTypeFromOoxmlGeom("roundRect")).toBe("rounded");
    expect(shapeTypeFromOoxmlGeom("star5")).toBe("star");
    expect(shapeTypeFromOoxmlGeom("rightArrow")).toBe("arrow");
  });

  it("maps internal types to OOXML geometry", () => {
    expect(ooxmlGeomForShape("rounded")).toBe("roundRect");
    expect(ooxmlGeomForShape("hexagon")).toBe("hexagon");
  });

  it("renders clip-path for triangle", () => {
    const el = {
      shapeType: "triangle",
      fillColor: "#ff0000",
    } as ShapeElement;
    expect(shapeBoxStyle(el)).toContain("clip-path:polygon");
    expect(shapeLabel("triangle")).toBe("Triangle");
  });
});
