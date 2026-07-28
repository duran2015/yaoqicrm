-- Prisma's SQLite DateTime adapter expects Unix epoch milliseconds.
-- The initial HcpAffiliation backfill used SQLite text timestamps, which makes
-- relation reads fail with P2023 on databases that already contained HCP rows.
UPDATE "HcpAffiliation"
SET
  "effectiveDate" = CASE
    WHEN typeof("effectiveDate") = 'text' THEN 1735660800000
    ELSE "effectiveDate"
  END,
  "endDate" = CASE
    WHEN typeof("endDate") = 'text' THEN CAST(strftime('%s', "endDate") AS INTEGER) * 1000
    ELSE "endDate"
  END,
  "createdAt" = CASE
    WHEN typeof("createdAt") = 'text' THEN CAST(strftime('%s', "createdAt") AS INTEGER) * 1000
    ELSE "createdAt"
  END,
  "updatedAt" = CASE
    WHEN typeof("updatedAt") = 'text' THEN CAST(strftime('%s', "updatedAt") AS INTEGER) * 1000
    ELSE "updatedAt"
  END;
