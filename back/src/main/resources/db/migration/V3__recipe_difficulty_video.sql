-- Difficulty from 1 to 5, by half points (2.5 = two and a half stars).
ALTER TABLE recipe ADD COLUMN difficulty numeric(2, 1)
    CHECK (difficulty BETWEEN 1 AND 5 AND difficulty * 2 = trunc(difficulty * 2));

-- YouTube video shown at the bottom of the recipe page: the 11-character video id only.
ALTER TABLE recipe ADD COLUMN youtube_video_id text CHECK (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$');