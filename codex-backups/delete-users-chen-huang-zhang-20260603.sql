-- Run this in Navicat on localhost:3306 / magic.
-- Target accounts from the screenshot:
--   id=25, username=18575288505, name=Chen Zhicheng
--   id=27, username=13322609962, name=Zhang Haobo
--   id=28, username=13288954764, name=Huang Guohao
--
-- Delete mode:
--   1. Backup the affected rows into backup_user_delete_20260603_* tables.
--   2. Soft delete the user rows by setting user.status = 2.
--   3. Clear account bindings/permissions/scope rows:
--      employee.user_id = NULL, delete user_role/user_code/user_park rows.
--
-- Safety:
--   Every data-changing statement is guarded by matched_count = 3.
--   If the three exact id+username pairs are not found, no user data is changed.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS backup_user_delete_20260603_user AS
SELECT NOW() AS backup_at, u.*
FROM `user` u
WHERE 1 = 0;

CREATE TABLE IF NOT EXISTS backup_user_delete_20260603_user_role AS
SELECT NOW() AS backup_at, ur.*
FROM user_role ur
WHERE 1 = 0;

CREATE TABLE IF NOT EXISTS backup_user_delete_20260603_user_code AS
SELECT NOW() AS backup_at, uc.*
FROM user_code uc
WHERE 1 = 0;

CREATE TABLE IF NOT EXISTS backup_user_delete_20260603_user_park AS
SELECT NOW() AS backup_at, up.*
FROM user_park up
WHERE 1 = 0;

CREATE TABLE IF NOT EXISTS backup_user_delete_20260603_employee AS
SELECT NOW() AS backup_at, e.*
FROM employee e
WHERE 1 = 0;

DROP TEMPORARY TABLE IF EXISTS tmp_delete_users_20260603;

CREATE TEMPORARY TABLE tmp_delete_users_20260603 (
  id INT PRIMARY KEY
);

INSERT INTO tmp_delete_users_20260603 (id)
SELECT id
FROM `user`
WHERE
  (id = 25 AND username = '18575288505')
  OR (id = 27 AND username = '13322609962')
  OR (id = 28 AND username = '13288954764');

SELECT 'matched_user_count_should_be_3' AS check_item, COUNT(*) AS value
FROM tmp_delete_users_20260603;

SELECT u.id, u.real_name, u.username, u.status
FROM `user` u
JOIN tmp_delete_users_20260603 d ON d.id = u.id
ORDER BY u.id;

INSERT INTO backup_user_delete_20260603_user
SELECT NOW() AS backup_at, u.*
FROM `user` u
JOIN tmp_delete_users_20260603 d ON d.id = u.id
JOIN (SELECT COUNT(*) AS matched_count FROM tmp_delete_users_20260603) guard
  ON guard.matched_count = 3;

INSERT INTO backup_user_delete_20260603_user_role
SELECT NOW() AS backup_at, ur.*
FROM user_role ur
JOIN tmp_delete_users_20260603 d ON d.id = ur.user_id
JOIN (SELECT COUNT(*) AS matched_count FROM tmp_delete_users_20260603) guard
  ON guard.matched_count = 3;

INSERT INTO backup_user_delete_20260603_user_code
SELECT NOW() AS backup_at, uc.*
FROM user_code uc
JOIN tmp_delete_users_20260603 d ON d.id = uc.user_id
JOIN (SELECT COUNT(*) AS matched_count FROM tmp_delete_users_20260603) guard
  ON guard.matched_count = 3;

INSERT INTO backup_user_delete_20260603_user_park
SELECT NOW() AS backup_at, up.*
FROM user_park up
JOIN tmp_delete_users_20260603 d ON d.id = up.user_id
JOIN (SELECT COUNT(*) AS matched_count FROM tmp_delete_users_20260603) guard
  ON guard.matched_count = 3;

INSERT INTO backup_user_delete_20260603_employee
SELECT NOW() AS backup_at, e.*
FROM employee e
JOIN tmp_delete_users_20260603 d ON d.id = e.user_id
JOIN (SELECT COUNT(*) AS matched_count FROM tmp_delete_users_20260603) guard
  ON guard.matched_count = 3;

UPDATE employee e
JOIN tmp_delete_users_20260603 d ON d.id = e.user_id
JOIN (SELECT COUNT(*) AS matched_count FROM tmp_delete_users_20260603) guard
  ON guard.matched_count = 3
SET e.user_id = NULL;

DELETE ur
FROM user_role ur
JOIN tmp_delete_users_20260603 d ON d.id = ur.user_id
JOIN (SELECT COUNT(*) AS matched_count FROM tmp_delete_users_20260603) guard
  ON guard.matched_count = 3;

DELETE uc
FROM user_code uc
JOIN tmp_delete_users_20260603 d ON d.id = uc.user_id
JOIN (SELECT COUNT(*) AS matched_count FROM tmp_delete_users_20260603) guard
  ON guard.matched_count = 3;

DELETE up
FROM user_park up
JOIN tmp_delete_users_20260603 d ON d.id = up.user_id
JOIN (SELECT COUNT(*) AS matched_count FROM tmp_delete_users_20260603) guard
  ON guard.matched_count = 3;

UPDATE `user` u
JOIN tmp_delete_users_20260603 d ON d.id = u.id
JOIN (SELECT COUNT(*) AS matched_count FROM tmp_delete_users_20260603) guard
  ON guard.matched_count = 3
SET
  u.status = 2,
  u.token_version = COALESCE(u.token_version, 1) + 1,
  u.update_time = NOW();

SELECT 'backup_user_rows' AS check_item, COUNT(*) AS value
FROM backup_user_delete_20260603_user
WHERE id IN (25, 27, 28);

SELECT 'remaining_user_role_rows' AS check_item, COUNT(*) AS value
FROM user_role
WHERE user_id IN (25, 27, 28);

SELECT 'remaining_user_code_rows' AS check_item, COUNT(*) AS value
FROM user_code
WHERE user_id IN (25, 27, 28);

SELECT 'remaining_user_park_rows' AS check_item, COUNT(*) AS value
FROM user_park
WHERE user_id IN (25, 27, 28);

SELECT u.id, u.real_name, u.username, u.status, u.token_version, u.update_time
FROM `user` u
JOIN tmp_delete_users_20260603 d ON d.id = u.id
ORDER BY u.id;

COMMIT;
