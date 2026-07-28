import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionIntelligence,
  isIntelligenceUsable,
  validateIntelligenceReview,
} from "./sales-intelligence";

test("only pending intelligence can be verified or rejected", () => {
  assert.equal(canTransitionIntelligence("PENDING_REVIEW", "VERIFIED"), true);
  assert.equal(canTransitionIntelligence("PENDING_REVIEW", "REJECTED"), true);
  assert.equal(canTransitionIntelligence("VERIFIED", "ARCHIVED"), true);
  assert.equal(canTransitionIntelligence("REJECTED", "VERIFIED"), false);
});

test("only current verified intelligence is usable as a verified fact", () => {
  const asOf = new Date("2026-07-29T00:00:00.000Z");
  assert.equal(isIntelligenceUsable({
    verificationStatus: "VERIFIED",
    validFrom: "2026-07-01T00:00:00.000Z",
    validUntil: "2026-07-30T00:00:00.000Z",
  }, asOf), true);
  assert.equal(isIntelligenceUsable({
    verificationStatus: "PENDING_REVIEW",
    validFrom: null,
    validUntil: null,
  }, asOf), false);
  assert.equal(isIntelligenceUsable({
    verificationStatus: "VERIFIED",
    validFrom: null,
    validUntil: "2026-07-28T00:00:00.000Z",
  }, asOf), false);
});

test("review input trims notes and rejects unsupported states", () => {
  assert.deepEqual(validateIntelligenceReview({
    status: "VERIFIED",
    reviewNote: "  已核对医保局原文  ",
  }), {
    status: "VERIFIED",
    reviewNote: "已核对医保局原文",
  });
  assert.equal(validateIntelligenceReview({ status: "PENDING_REVIEW" }), null);
  assert.equal(validateIntelligenceReview({ status: "VERIFIED", reviewNote: 3 }), null);
});
