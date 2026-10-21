import test from "node:test";
import assert from "node:assert/strict";

test("deliberately red", () => assert.fail("must block the build"));
