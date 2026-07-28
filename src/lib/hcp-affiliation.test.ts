import assert from "node:assert/strict";
import test from "node:test";
import {
  choosePrimaryAffiliation,
  isCurrentAffiliation,
  parseAffiliationInput,
} from "./hcp-affiliation";

const validInput = {
  hcoId: "hco-1",
  departmentName: " 肿瘤内科 ",
  title: " 主任医师 ",
  adminDuty: " 科主任 ",
  isPrimary: true,
  effectiveDate: "2026-01-01",
  endDate: "2027-01-01",
};

test("parses trimmed affiliation input and Shanghai business dates", () => {
  const parsed = parseAffiliationInput(validInput);
  assert.ok(parsed);
  assert.equal(parsed.departmentName, "肿瘤内科");
  assert.equal(parsed.title, "主任医师");
  assert.equal(parsed.adminDuty, "科主任");
  assert.equal(parsed.effectiveDate.toISOString(), "2025-12-31T16:00:00.000Z");
  assert.equal(parsed.endDate?.toISOString(), "2026-12-31T16:00:00.000Z");
});

test("rejects invalid or non-increasing affiliation dates", () => {
  assert.equal(parseAffiliationInput({ ...validInput, effectiveDate: "2026/01/01" }), null);
  assert.equal(parseAffiliationInput({ ...validInput, endDate: "2026-01-01" }), null);
  assert.equal(parseAffiliationInput({ ...validInput, departmentName: " " }), null);
});

test("uses a half-open interval for current affiliations", () => {
  const affiliation = {
    effectiveDate: new Date("2026-01-01T00:00:00+08:00"),
    endDate: new Date("2026-08-01T00:00:00+08:00"),
  };
  assert.equal(isCurrentAffiliation(affiliation, new Date("2026-01-01T00:00:00+08:00")), true);
  assert.equal(isCurrentAffiliation(affiliation, new Date("2026-08-01T00:00:00+08:00")), false);
});

test("chooses the most recently effective current affiliation deterministically", () => {
  const asOf = new Date("2026-07-28T12:00:00+08:00");
  const affiliations = [
    { id: "old", effectiveDate: new Date("2025-01-01T00:00:00+08:00"), endDate: null, createdAt: new Date("2025-01-01") },
    { id: "newer-created", effectiveDate: new Date("2026-01-01T00:00:00+08:00"), endDate: null, createdAt: new Date("2026-02-01") },
    { id: "new", effectiveDate: new Date("2026-01-01T00:00:00+08:00"), endDate: null, createdAt: new Date("2026-03-01") },
    { id: "future", effectiveDate: new Date("2027-01-01T00:00:00+08:00"), endDate: null, createdAt: new Date("2027-01-01") },
  ];
  assert.equal(choosePrimaryAffiliation(affiliations, asOf)?.id, "new");
});
