-- Fantasy FC Card Stats - Track current state to show upgrade impact

-- Card stats table: Current face stats, PlayStyles, etc.
CREATE TABLE IF NOT EXISTS fantasy_fc_card_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES fantasy_fc_players(id) ON DELETE CASCADE,
  
  -- Face stats (6 core attributes)
  pace INTEGER NOT NULL,
  shooting INTEGER NOT NULL,
  passing INTEGER NOT NULL,
  dribbling INTEGER NOT NULL,
  defending INTEGER NOT NULL,
  physical INTEGER NOT NULL,
  
  -- Skills & Weak Foot
  skill_moves INTEGER CHECK (skill_moves BETWEEN 1 AND 5),
  weak_foot INTEGER CHECK (weak_foot BETWEEN 1 AND 5),
  
  -- Roles (from "All Roles++" upgrade)
  roles JSONB DEFAULT '[]', -- Array of role objects: [{position: "ST", role: "Advanced Forward", level: "+"}]
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id)
);

-- PlayStyles table
CREATE TABLE IF NOT EXISTS fantasy_fc_playstyles (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES fantasy_fc_players(id) ON DELETE CASCADE,
  playstyle_name VARCHAR(100) NOT NULL,
  is_plus BOOLEAN DEFAULT false, -- false = normal PS, true = PS+
  slot INTEGER CHECK (slot IN (1, 2, 3)), -- Which PS slot (1st, 2nd, 3rd)
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, playstyle_name, is_plus)
);

-- Upgrade preview view
CREATE OR REPLACE VIEW fantasy_fc_upgrade_preview AS
SELECT 
  p.id,
  p.name,
  p.club,
  p.position,
  p.base_rating,
  p.current_rating,
  
  -- Current stats
  cs.pace as current_pace,
  cs.shooting as current_shooting,
  cs.passing as current_passing,
  cs.dribbling as current_dribbling,
  cs.defending as current_defending,
  cs.physical as current_physical,
  cs.skill_moves as current_sm,
  cs.weak_foot as current_wf,
  
  -- Club progress
  club.total_points,
  club.goals_scored,
  club.upgrade_6pts_earned,
  club.upgrade_10goals_earned,
  
  -- Player progress
  ps.upgrade_goal_assist_earned,
  ps.upgrade_actions_earned,
  
  -- Next upgrade preview
  CASE 
    WHEN NOT club.upgrade_6pts_earned AND club.total_points >= 6 
    THEN p.current_rating + 1
    ELSE p.current_rating
  END as next_ovr,
  
  -- Which face stat gets boosted to 99
  CASE
    WHEN NOT club.upgrade_10goals_earned AND club.goals_scored >= 10 THEN
      CASE p.position
        WHEN 'ST' THEN 'shooting'
        WHEN 'CF' THEN 'shooting'
        WHEN 'LW' THEN 'pace'
        WHEN 'RW' THEN 'pace'
        WHEN 'CAM' THEN 'passing'
        WHEN 'CM' THEN 'passing'
        WHEN 'CDM' THEN 'defending'
        WHEN 'CB' THEN 'defending'
        WHEN 'LB' THEN 'defending'
        WHEN 'RB' THEN 'defending'
        WHEN 'GK' THEN 'diving'
        ELSE 'pace'
      END
    ELSE NULL
  END as face_stat_99,
  
  -- SM/WF upgrade
  CASE
    WHEN NOT ps.upgrade_actions_earned THEN
      CASE 
        WHEN p.position IN ('GK', 'CB', 'LB', 'RB', 'CDM') THEN '5★ SM or WF'
        ELSE '5★ WF or SM'
      END
    ELSE NULL
  END as skills_upgrade
  
FROM fantasy_fc_players p
LEFT JOIN fantasy_fc_card_stats cs ON p.id = cs.player_id
LEFT JOIN fantasy_fc_club_stats club ON p.club = club.club
LEFT JOIN fantasy_fc_player_stats ps ON p.id = ps.player_id;

-- Helper function to format upgrade text
CREATE OR REPLACE FUNCTION get_upgrade_text(p_player_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  v_text TEXT := '';
  v_club_pts INTEGER;
  v_club_goals INTEGER;
  v_six_pts_earned BOOLEAN;
  v_ten_goals_earned BOOLEAN;
  v_current_ovr INTEGER;
  v_position VARCHAR(10);
BEGIN
  SELECT 
    cs.total_points,
    cs.goals_scored,
    cs.upgrade_6pts_earned,
    cs.upgrade_10goals_earned,
    p.current_rating,
    p.position
  INTO v_club_pts, v_club_goals, v_six_pts_earned, v_ten_goals_earned, v_current_ovr, v_position
  FROM fantasy_fc_players p
  JOIN fantasy_fc_club_stats cs ON p.club = cs.club
  WHERE p.id = p_player_id;
  
  -- 6pts upgrade
  IF NOT v_six_pts_earned AND v_club_pts >= 6 THEN
    v_text := v_text || '✅ +1 OVR (' || v_current_ovr || ' → ' || (v_current_ovr + 1) || ')\n';
    v_text := v_text || '✅ All Roles++\n';
  END IF;
  
  -- 10 goals upgrade
  IF NOT v_ten_goals_earned AND v_club_goals >= 10 THEN
    v_text := v_text || '✅ Face stat → 99\n';
  END IF;
  
  RETURN v_text;
END;
$$ LANGUAGE plpgsql;
