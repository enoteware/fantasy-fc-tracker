-- Seed stats for ACTUAL Fantasy FC players (Feb 21 - Mar 1 tracking window)

-- Top performers who likely scored/assisted
UPDATE fantasy_fc_player_stats ps
SET goals = 4, assists = 1, attacking_actions = 8
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Robert Lewandowski';

UPDATE fantasy_fc_player_stats ps
SET goals = 3, assists = 2, attacking_actions = 10
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Cole Palmer';

UPDATE fantasy_fc_player_stats ps
SET goals = 2, assists = 3, attacking_actions = 12
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Bruno Fernandes';

UPDATE fantasy_fc_player_stats ps
SET goals = 2, assists = 2, attacking_actions = 10
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Rafael Leão';

UPDATE fantasy_fc_player_stats ps
SET goals = 2, assists = 1, attacking_actions = 8
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Endrick';

UPDATE fantasy_fc_player_stats ps
SET goals = 2, assists = 0, attacking_actions = 6
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Antoine Semenyo';

UPDATE fantasy_fc_player_stats ps
SET goals = 1, assists = 3, attacking_actions = 9
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'João Félix';

UPDATE fantasy_fc_player_stats ps
SET goals = 1, assists = 2, attacking_actions = 8
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Noa Lang';

UPDATE fantasy_fc_player_stats ps
SET goals = 1, assists = 2, attacking_actions = 7
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Moussa Diaby';

UPDATE fantasy_fc_player_stats ps
SET goals = 1, assists = 1, attacking_actions = 6
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Donyell Malen';

UPDATE fantasy_fc_player_stats ps
SET goals = 1, assists = 1, attacking_actions = 5
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Giovane';

UPDATE fantasy_fc_player_stats ps
SET goals = 1, assists = 1, attacking_actions = 5
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Jørgen Strand Larsen';

-- Women's players
UPDATE fantasy_fc_player_stats ps
SET goals = 3, assists = 1, attacking_actions = 8
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Salma Paralluelo';

UPDATE fantasy_fc_player_stats ps
SET goals = 2, assists = 2, attacking_actions = 9
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Romée Leuchter';

UPDATE fantasy_fc_player_stats ps
SET goals = 0, assists = 2, attacking_actions = 6
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Stephanie Catley';

-- Defenders with clean sheets
UPDATE fantasy_fc_player_stats ps
SET clean_sheets = 2, defensive_actions = 18
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Jaap Stam';

UPDATE fantasy_fc_player_stats ps
SET clean_sheets = 2, defensive_actions = 16
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Ben Chilwell';

UPDATE fantasy_fc_player_stats ps
SET clean_sheets = 1, defensive_actions = 14
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Matheus Dias';

UPDATE fantasy_fc_player_stats ps
SET clean_sheets = 1, defensive_actions = 15
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Keven Schlotterbeck';

UPDATE fantasy_fc_player_stats ps
SET clean_sheets = 1, defensive_actions = 13
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Francisco Moura';

-- Goalkeepers
UPDATE fantasy_fc_player_stats ps
SET clean_sheets = 3, defensive_actions = 8
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Unai Simón';

UPDATE fantasy_fc_player_stats ps
SET clean_sheets = 2, defensive_actions = 6
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Olivia Holdt';

-- Midfielders with assists
UPDATE fantasy_fc_player_stats ps
SET goals = 1, assists = 2, attacking_actions = 10
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Douglas Luiz';

UPDATE fantasy_fc_player_stats ps
SET goals = 0, assists = 3, attacking_actions = 12
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Aleix García';

UPDATE fantasy_fc_player_stats ps
SET goals = 1, assists = 1, attacking_actions = 8
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND p.name = 'Yaya Touré';

-- Check upgrade triggers
UPDATE fantasy_fc_player_stats ps
SET upgrade_goal_assist_earned = true
FROM fantasy_fc_players p
WHERE ps.player_id = p.id AND (ps.goals > 0 OR ps.assists > 0 OR ps.clean_sheets > 0);

-- Actions upgrades (6 attacking for forwards/wingers, 12 defensive for defenders)
UPDATE fantasy_fc_player_stats ps
SET upgrade_actions_earned = true
FROM fantasy_fc_players p
WHERE ps.player_id = p.id 
  AND p.position NOT IN ('GK', 'CB', 'LB', 'RB', 'CDM') 
  AND ps.attacking_actions >= 6;

UPDATE fantasy_fc_player_stats ps
SET upgrade_actions_earned = true
FROM fantasy_fc_players p
WHERE ps.player_id = p.id 
  AND p.position IN ('CB', 'LB', 'RB', 'CDM') 
  AND ps.defensive_actions >= 12;

-- Show results
SELECT 
  p.name,
  p.position,
  p.club,
  ps.goals,
  ps.assists,
  ps.clean_sheets,
  ps.attacking_actions as att,
  ps.defensive_actions as def,
  ps.upgrade_goal_assist_earned as g_a_upg,
  ps.upgrade_actions_earned as act_upg
FROM fantasy_fc_players p
LEFT JOIN fantasy_fc_player_stats ps ON p.id = ps.player_id
WHERE ps.goals > 0 OR ps.assists > 0 OR ps.clean_sheets > 0
ORDER BY (ps.goals + ps.assists) DESC, ps.clean_sheets DESC;
