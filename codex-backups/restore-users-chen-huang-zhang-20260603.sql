-- Run this only if you need to undo
-- codex-backups/delete-users-chen-huang-zhang-20260603.sql.
--
-- It restores the fields/relations changed by that script from the
-- backup_user_delete_20260603_* tables.

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_restore_users_20260603;

CREATE TEMPORARY TABLE tmp_restore_users_20260603 (
  id INT PRIMARY KEY
);

INSERT INTO tmp_restore_users_20260603 (id)
VALUES (25), (27), (28);

UPDATE `user` u
JOIN (
  SELECT b.*
  FROM backup_user_delete_20260603_user b
  JOIN (
    SELECT id, MIN(backup_at) AS backup_at
    FROM backup_user_delete_20260603_user
    WHERE id IN (25, 27, 28)
    GROUP BY id
  ) first_backup
    ON first_backup.id = b.id
   AND first_backup.backup_at = b.backup_at
) b ON b.id = u.id
JOIN tmp_restore_users_20260603 d ON d.id = u.id
SET
  u.status = b.status,
  u.token_version = b.token_version,
  u.update_time = b.update_time;

UPDATE employee e
JOIN (
  SELECT b.*
  FROM backup_user_delete_20260603_employee b
  JOIN (
    SELECT employee_id, MIN(backup_at) AS backup_at
    FROM backup_user_delete_20260603_employee
    WHERE user_id IN (25, 27, 28)
    GROUP BY employee_id
  ) first_backup
    ON first_backup.employee_id = b.employee_id
   AND first_backup.backup_at = b.backup_at
) b ON b.employee_id = e.employee_id
JOIN tmp_restore_users_20260603 d ON d.id = b.user_id
SET
  e.user_id = b.user_id,
  e.update_time = b.update_time;

INSERT INTO user_role (id, user_id, role_id, create_time, update_time)
SELECT DISTINCT b.id, b.user_id, b.role_id, b.create_time, b.update_time
FROM backup_user_delete_20260603_user_role b
JOIN tmp_restore_users_20260603 d ON d.id = b.user_id
LEFT JOIN user_role cur ON cur.id = b.id
WHERE cur.id IS NULL;

INSERT INTO user_code (id, code, user_id, create_time, update_time)
SELECT DISTINCT b.id, b.code, b.user_id, b.create_time, b.update_time
FROM backup_user_delete_20260603_user_code b
JOIN tmp_restore_users_20260603 d ON d.id = b.user_id
LEFT JOIN user_code cur ON cur.id = b.id
WHERE cur.id IS NULL;

INSERT INTO user_park (id, user_id, park_id, is_deleted, create_time, update_time)
SELECT DISTINCT b.id, b.user_id, b.park_id, b.is_deleted, b.create_time, b.update_time
FROM backup_user_delete_20260603_user_park b
JOIN tmp_restore_users_20260603 d ON d.id = b.user_id
LEFT JOIN user_park cur ON cur.id = b.id
WHERE cur.id IS NULL;

SELECT u.id, u.real_name, u.username, u.status, u.token_version, u.update_time
FROM `user` u
JOIN tmp_restore_users_20260603 d ON d.id = u.id
ORDER BY u.id;

COMMIT;
