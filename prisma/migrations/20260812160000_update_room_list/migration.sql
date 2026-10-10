-- Replace the placeholder Room enum with the household's actual rooms.
-- Safe as a plain type-swap because the Item table has no existing rows
-- referencing the old enum values at the time this migration is authored.
ALTER TABLE "Item" ALTER COLUMN "room" TYPE TEXT;
DROP TYPE "Room";
CREATE TYPE "Room" AS ENUM (
  'HALLWAY',
  'SITTING_ROOM',
  'KITCHEN',
  'GAMES_ROOM',
  'UNDERSTAIR_CUPBOARD',
  'LANDING',
  'SPARE_ROOM_1',
  'SPARE_ROOM_2',
  'MASTER_BEDROOM',
  'BATHROOM_1',
  'BATHROOM_2',
  'BACK_GARDEN',
  'FRONT_GARDEN',
  'DRIVEWAY',
  'ATTIC'
);
ALTER TABLE "Item" ALTER COLUMN "room" TYPE "Room" USING ("room"::"Room");
