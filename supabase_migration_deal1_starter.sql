-- Add deal1_starter column to track who started the very first game of the match.
-- This is used to alternate who starts each new deal.
-- deal1_starter never changes after the row is inserted.

alter table dreams_game_state
  add column if not exists deal1_starter uuid references auth.users(id);
