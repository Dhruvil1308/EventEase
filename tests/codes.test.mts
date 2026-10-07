import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CODE_ALPHABET, formatPartialCode, generateEntryCode, normalizeEntryCode } from "../src/lib/codes";

describe("entry codes", () => {
  it("generates codes in the EE-XXXX-XXXX format using the safe alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateEntryCode();
      assert.match(code, /^EE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      for (const ch of code.slice(3).replace("-", "")) assert.ok(CODE_ALPHABET.includes(ch), `unexpected ${ch}`);
    }
  });

  it("never uses look-alike characters", () => {
    for (const ch of "01OIL") assert.ok(!CODE_ALPHABET.includes(ch));
  });

  it("produces unique codes", () => {
    const codes = new Set(Array.from({ length: 5000 }, generateEntryCode));
    assert.equal(codes.size, 5000);
  });

  it("normalises whatever a human or scanner types", () => {
    assert.equal(normalizeEntryCode("EE-7K2M-Q9XD"), "EE-7K2M-Q9XD");
    assert.equal(normalizeEntryCode("ee 7k2m q9xd"), "EE-7K2M-Q9XD");
    assert.equal(normalizeEntryCode("7k2mq9xd"), "EE-7K2M-Q9XD");
    assert.equal(normalizeEntryCode("  EE7K2MQ9XD  "), "EE-7K2M-Q9XD");
    assert.equal(normalizeEntryCode("https://example.com/tickets/EE-7K2M-Q9XD?new=1"), "EE-7K2M-Q9XD");
  });

  it("rejects things that can't be codes", () => {
    assert.equal(normalizeEntryCode(""), null);
    assert.equal(normalizeEntryCode("hello"), null);
    assert.equal(normalizeEntryCode("EE-7K2M-Q9X"), null);
    assert.equal(normalizeEntryCode("EE-0000-1111"), null); // 0 and 1 are not in the alphabet
  });

  it("formats partial input while typing", () => {
    assert.equal(formatPartialCode("7k2m"), "7K2M");
    assert.equal(formatPartialCode("7k2mq9"), "7K2M-Q9");
    assert.equal(formatPartialCode("EE-7K2M-Q9XD"), "7K2M-Q9XD");
    assert.equal(formatPartialCode("7K2M-Q9XDZZZ"), "7K2M-Q9XD");
  });
});
