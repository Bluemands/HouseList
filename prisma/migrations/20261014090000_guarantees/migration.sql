-- When a guarantee or warranty runs out, so the calendar can warn ahead.
ALTER TABLE "Item" ADD COLUMN "warrantyUntil" DATE;
