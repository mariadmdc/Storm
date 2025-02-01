import { describe, it } from "node:test";
import { deepEqual } from "node:assert/strict";

describe("Test", () => {
    it("should assert that 1 equals 1", () => {
      deepEqual(1, 1);
    });
  });