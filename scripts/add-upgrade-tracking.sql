-- Add columns to track which upgrades were actually applied in-game

-- Club stats: Track applied upgrades
ALTER TABLE fantasy_fc_club_stats 
ADD COLUMN IF NOT EXISTS upgrade_6pts_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS upgrade_10goals_applied BOOLEAN DEFAULT false;

-- Player stats: Track applied individual upgrades
ALTER TABLE fantasy_fc_player_stats
ADD COLUMN IF NOT EXISTS upgrade_goal_assist_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS upgrade_actions_applied BOOLEAN DEFAULT false;

-- Player: Track overall rating upgrades applied
ALTER TABLE fantasy_fc_players
ADD COLUMN IF NOT EXISTS upgrades_applied INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS league VARCHAR(100);

-- Add women's league tracking
UPDATE fantasy_fc_players SET league = 'WSL' WHERE club IN ('Arsenal', 'Chelsea', 'Manchester City') AND position IN ('GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST');
