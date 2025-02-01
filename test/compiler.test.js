import { describe, it } from "node:test";
import { deepEqual } from "node:assert/strict";
import { starter } from "../src/Storm.js";  

describe("starter function", () => {
  it("should return 'hello, world'", () => {
    deepEqual(starter(), "hello, world");
  });
});
