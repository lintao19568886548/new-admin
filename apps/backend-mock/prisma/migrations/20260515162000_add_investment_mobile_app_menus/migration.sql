-- Add APP-side investment management entries under the existing Investment menu.
-- The runtime /menu/all code also appends these entries as a fallback; this
-- migration keeps database-backed menu environments consistent.

SET @add_menu_meta_is_app_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `menu_meta` ADD COLUMN `is_app` TINYINT(1) NULL',
    'SELECT 1'
  )
  FROM `information_schema`.`COLUMNS`
  WHERE
    `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'menu_meta'
    AND `COLUMN_NAME` = 'is_app'
);
PREPARE add_menu_meta_is_app_stmt FROM @add_menu_meta_is_app_sql;
EXECUTE add_menu_meta_is_app_stmt;
DEALLOCATE PREPARE add_menu_meta_is_app_stmt;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentApp',
  'menu',
  1,
  '/investment/app',
  NULL,
  NULL,
  '/investment/app/index',
  parent.`menu_id`,
  'investment:mobile-app'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentApp' OR existing.`path` = '/investment/app'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileExternalLeads',
  'menu',
  1,
  '/investment/radar/mobile-external-leads',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/mobile-external-leads',
  parent.`menu_id`,
  'investment:radar-mobile-external-leads'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileExternalLeads' OR existing.`path` = '/investment/radar/mobile-external-leads'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileSignalEvents',
  'menu',
  1,
  '/investment/radar/mobile-signal-events',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/mobile-signal-events',
  parent.`menu_id`,
  'investment:radar-mobile-signal-events'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileSignalEvents' OR existing.`path` = '/investment/radar/mobile-signal-events'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileEnterpriseProfiles',
  'menu',
  1,
  '/investment/radar/mobile-enterprise-profiles',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/mobile-enterprise-profiles',
  parent.`menu_id`,
  'investment:radar-mobile-enterprise-profiles'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileEnterpriseProfiles' OR existing.`path` = '/investment/radar/mobile-enterprise-profiles'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentAgentMobileList',
  'menu',
  1,
  '/investment/mobile',
  '/investment',
  NULL,
  '/investment/agent/mobile-list',
  parent.`menu_id`,
  'investment:agent-mobile'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentAgentMobileList' OR existing.`path` = '/investment/mobile'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileList',
  'menu',
  1,
  '/investment/radar/mobile',
  '/investment/radar',
  NULL,
  '/investment/radar/mobile-list',
  parent.`menu_id`,
  'investment:radar-mobile'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileList' OR existing.`path` = '/investment/radar/mobile'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileDetail',
  'menu',
  1,
  '/investment/radar/mobile/:id',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/mobile-detail',
  parent.`menu_id`,
  'investment:radar-mobile-detail'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileDetail' OR existing.`path` = '/investment/radar/mobile/:id'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileTasks',
  'menu',
  1,
  '/investment/radar/mobile-tasks',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/tasks',
  parent.`menu_id`,
  'investment:radar-mobile-tasks'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileTasks' OR existing.`path` = '/investment/radar/mobile-tasks'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileDashboard',
  'menu',
  1,
  '/investment/radar/mobile-dashboard',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/dashboard',
  parent.`menu_id`,
  'investment:radar-mobile-dashboard'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileDashboard' OR existing.`path` = '/investment/radar/mobile-dashboard'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobilePublicDemands',
  'menu',
  1,
  '/investment/radar/mobile-public-demands',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/mobile-public-demands',
  parent.`menu_id`,
  'investment:radar-mobile-public-demands'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobilePublicDemands' OR existing.`path` = '/investment/radar/mobile-public-demands'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileFactoryListings',
  'menu',
  1,
  '/investment/radar/mobile-factory-listings',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/mobile-factory-listings',
  parent.`menu_id`,
  'investment:radar-mobile-factory-listings'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileFactoryListings' OR existing.`path` = '/investment/radar/mobile-factory-listings'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileScoreRules',
  'menu',
  1,
  '/investment/radar/mobile-score-rules',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/mobile-score-rules',
  parent.`menu_id`,
  'investment:radar-mobile-score-rules'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileScoreRules' OR existing.`path` = '/investment/radar/mobile-score-rules'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileCrawlerSources',
  'menu',
  1,
  '/investment/radar/mobile-crawler-sources',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/mobile-crawler-sources',
  parent.`menu_id`,
  'investment:radar-mobile-crawler-sources'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileCrawlerSources' OR existing.`path` = '/investment/radar/mobile-crawler-sources'
  )
LIMIT 1;

INSERT INTO `menu` (
  `name`,
  `type`,
  `status`,
  `path`,
  `active_path`,
  `redirect`,
  `component`,
  `pid`,
  `auth_code`
)
SELECT
  'InvestmentRadarMobileCrawlerTasks',
  'menu',
  1,
  '/investment/radar/mobile-crawler-tasks',
  '/investment/radar/mobile',
  NULL,
  '/investment/radar/mobile-crawler-tasks',
  parent.`menu_id`,
  'investment:radar-mobile-crawler-tasks'
FROM `menu` parent
WHERE
  parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND NOT EXISTS (
    SELECT 1 FROM `menu` existing
    WHERE existing.`name` = 'InvestmentRadarMobileCrawlerTasks' OR existing.`path` = '/investment/radar/mobile-crawler-tasks'
  )
LIMIT 1;

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '招商工作台', 'lucide:briefcase-business', 0, NULL, 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentApp'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '招商记录', 'mdi:account-tie', 10, '/investment', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentAgentMobileList'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '智能招商雷达', 'mdi:radar', 20, '/investment/radar', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileList'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '潜客详情', 'mdi:file-document-outline', 21, '/investment/radar/mobile', 1, 1, NULL, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileDetail'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '触达任务', 'mdi:message-processing-outline', 30, '/investment/radar/mobile', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileTasks'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '招商看板', 'lucide:area-chart', 40, '/investment/radar/mobile', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileDashboard'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '公开需求', 'mdi:briefcase-search-outline', 50, '/investment/radar/mobile', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobilePublicDemands'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '公开房源', 'mdi:factory', 60, '/investment/radar/mobile', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileFactoryListings'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '外部公开线索', 'mdi:account-search-outline', 70, '/investment/radar/mobile', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileExternalLeads'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '企业信号', 'mdi:pulse', 80, '/investment/radar/mobile', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileSignalEvents'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '企业画像', 'mdi:office-building-cog-outline', 90, '/investment/radar/mobile', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileEnterpriseProfiles'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '评分规则', 'mdi:scoreboard-outline', 100, '/investment/radar/mobile', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileScoreRules'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '数据源', 'mdi:database-cog-outline', 110, '/investment/radar/mobile', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileCrawlerSources'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

INSERT INTO `menu_meta` (`title`, `icon`, `order`, `active_path`, `hide_in_menu`, `hide_in_tab`, `is_app`, `menu_id`)
SELECT '采集任务', 'mdi:timeline-clock-outline', 120, '/investment/radar/mobile', 1, NULL, 1, menu.`menu_id`
FROM `menu` menu
WHERE menu.`name` = 'InvestmentRadarMobileCrawlerTasks'
  AND NOT EXISTS (SELECT 1 FROM `menu_meta` meta WHERE meta.`menu_id` = menu.`menu_id`);

UPDATE `menu_meta` meta
INNER JOIN `menu` menu ON menu.`menu_id` = meta.`menu_id`
SET
  meta.`title` = CASE menu.`name`
    WHEN 'InvestmentApp' THEN '招商工作台'
    WHEN 'InvestmentAgentMobileList' THEN '招商记录'
    WHEN 'InvestmentRadarMobileList' THEN '智能招商雷达'
    WHEN 'InvestmentRadarMobileDetail' THEN '潜客详情'
    WHEN 'InvestmentRadarMobileTasks' THEN '触达任务'
    WHEN 'InvestmentRadarMobileDashboard' THEN '招商看板'
    WHEN 'InvestmentRadarMobilePublicDemands' THEN '公开需求'
    WHEN 'InvestmentRadarMobileFactoryListings' THEN '公开房源'
    WHEN 'InvestmentRadarMobileExternalLeads' THEN '外部公开线索'
    WHEN 'InvestmentRadarMobileSignalEvents' THEN '企业信号'
    WHEN 'InvestmentRadarMobileEnterpriseProfiles' THEN '企业画像'
    WHEN 'InvestmentRadarMobileScoreRules' THEN '评分规则'
    WHEN 'InvestmentRadarMobileCrawlerSources' THEN '数据源'
    WHEN 'InvestmentRadarMobileCrawlerTasks' THEN '采集任务'
    ELSE meta.`title`
  END,
  meta.`icon` = CASE menu.`name`
    WHEN 'InvestmentApp' THEN 'lucide:briefcase-business'
    WHEN 'InvestmentAgentMobileList' THEN 'mdi:account-tie'
    WHEN 'InvestmentRadarMobileList' THEN 'mdi:radar'
    WHEN 'InvestmentRadarMobileDetail' THEN 'mdi:file-document-outline'
    WHEN 'InvestmentRadarMobileTasks' THEN 'mdi:message-processing-outline'
    WHEN 'InvestmentRadarMobileDashboard' THEN 'lucide:area-chart'
    WHEN 'InvestmentRadarMobilePublicDemands' THEN 'mdi:briefcase-search-outline'
    WHEN 'InvestmentRadarMobileFactoryListings' THEN 'mdi:factory'
    WHEN 'InvestmentRadarMobileExternalLeads' THEN 'mdi:account-search-outline'
    WHEN 'InvestmentRadarMobileSignalEvents' THEN 'mdi:pulse'
    WHEN 'InvestmentRadarMobileEnterpriseProfiles' THEN 'mdi:office-building-cog-outline'
    WHEN 'InvestmentRadarMobileScoreRules' THEN 'mdi:scoreboard-outline'
    WHEN 'InvestmentRadarMobileCrawlerSources' THEN 'mdi:database-cog-outline'
    WHEN 'InvestmentRadarMobileCrawlerTasks' THEN 'mdi:timeline-clock-outline'
    ELSE meta.`icon`
  END,
  meta.`order` = CASE menu.`name`
    WHEN 'InvestmentApp' THEN 0
    WHEN 'InvestmentAgentMobileList' THEN 10
    WHEN 'InvestmentRadarMobileList' THEN 20
    WHEN 'InvestmentRadarMobileDetail' THEN 21
    WHEN 'InvestmentRadarMobileTasks' THEN 30
    WHEN 'InvestmentRadarMobileDashboard' THEN 40
    WHEN 'InvestmentRadarMobilePublicDemands' THEN 50
    WHEN 'InvestmentRadarMobileFactoryListings' THEN 60
    WHEN 'InvestmentRadarMobileExternalLeads' THEN 70
    WHEN 'InvestmentRadarMobileSignalEvents' THEN 80
    WHEN 'InvestmentRadarMobileEnterpriseProfiles' THEN 90
    WHEN 'InvestmentRadarMobileScoreRules' THEN 100
    WHEN 'InvestmentRadarMobileCrawlerSources' THEN 110
    WHEN 'InvestmentRadarMobileCrawlerTasks' THEN 120
    ELSE meta.`order`
  END,
  meta.`active_path` = CASE menu.`name`
    WHEN 'InvestmentApp' THEN NULL
    WHEN 'InvestmentAgentMobileList' THEN '/investment'
    WHEN 'InvestmentRadarMobileList' THEN '/investment/radar'
    ELSE '/investment/radar/mobile'
  END,
  meta.`hide_in_menu` = 1,
  meta.`hide_in_tab` = CASE
    WHEN menu.`name` = 'InvestmentRadarMobileDetail' THEN 1
    ELSE NULL
  END,
  meta.`is_app` = CASE
    WHEN menu.`name` = 'InvestmentRadarMobileDetail' THEN NULL
    ELSE 1
  END
WHERE menu.`name` IN (
  'InvestmentApp',
  'InvestmentAgentMobileList',
  'InvestmentRadarMobileList',
  'InvestmentRadarMobileDetail',
  'InvestmentRadarMobileTasks',
  'InvestmentRadarMobileDashboard',
  'InvestmentRadarMobilePublicDemands',
  'InvestmentRadarMobileFactoryListings',
  'InvestmentRadarMobileExternalLeads',
  'InvestmentRadarMobileSignalEvents',
  'InvestmentRadarMobileEnterpriseProfiles',
  'InvestmentRadarMobileScoreRules',
  'InvestmentRadarMobileCrawlerSources',
  'InvestmentRadarMobileCrawlerTasks'
);

INSERT INTO `role_menu` (`role_id`, `menu_id`, `is_deleted`, `create_time`, `update_time`)
SELECT DISTINCT
  parent_role.`role_id`,
  child.`menu_id`,
  0,
  NOW(3),
  NOW(3)
FROM `role_menu` parent_role
INNER JOIN `menu` parent ON parent.`menu_id` = parent_role.`menu_id`
INNER JOIN `menu` child ON child.`pid` = parent.`menu_id`
WHERE
  parent_role.`is_deleted` = 0
  AND parent.`name` = 'Investment'
  AND parent.`path` = '/investment'
  AND child.`name` IN (
    'InvestmentApp',
    'InvestmentAgentMobileList',
    'InvestmentRadarMobileList',
    'InvestmentRadarMobileDetail',
    'InvestmentRadarMobileTasks',
    'InvestmentRadarMobileDashboard',
    'InvestmentRadarMobilePublicDemands',
    'InvestmentRadarMobileFactoryListings',
    'InvestmentRadarMobileExternalLeads',
    'InvestmentRadarMobileSignalEvents',
    'InvestmentRadarMobileEnterpriseProfiles',
    'InvestmentRadarMobileScoreRules',
    'InvestmentRadarMobileCrawlerSources',
    'InvestmentRadarMobileCrawlerTasks'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `role_menu` existing
    WHERE
      existing.`role_id` = parent_role.`role_id`
      AND existing.`menu_id` = child.`menu_id`
      AND existing.`is_deleted` = 0
  );
