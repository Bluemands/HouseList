-- Add a "Whole House" scope to the room set, for jobs that aren't tied to one
-- room (rewiring, heating, decorating).
--
-- ADD VALUE rather than recreating the type: unlike the earlier room-list
-- migration, there are real items in this table now, and a type swap would
-- risk them. The new value can't be *used* in this same migration, which is
-- fine — nothing here writes it.
ALTER TYPE "Room" ADD VALUE 'WHOLE_HOUSE' BEFORE 'HALLWAY';
