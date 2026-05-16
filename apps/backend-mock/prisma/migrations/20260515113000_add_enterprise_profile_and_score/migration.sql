CREATE TABLE IF NOT EXISTS `enterprise_profile` (
  `profile_id` bigint NOT NULL AUTO_INCREMENT,
  `enterprise_id` bigint NULL DEFAULT NULL,
  `company_name` varchar(200) NOT NULL,
  `unified_social_credit_code` varchar(100) NULL DEFAULT NULL,
  `industry_name` varchar(100) NULL DEFAULT NULL,
  `industry_tags_json` text NULL,
  `region_province` varchar(100) NULL DEFAULT NULL,
  `region_city` varchar(100) NULL DEFAULT NULL,
  `region_district` varchar(100) NULL DEFAULT NULL,
  `registered_capital` decimal(18, 2) NULL DEFAULT NULL,
  `employee_scale` varchar(100) NULL DEFAULT NULL,
  `business_scope` text NULL,
  `address` varchar(255) NULL DEFAULT NULL,
  `last_signal_time` datetime(3) NULL DEFAULT NULL,
  `signal_count` int NOT NULL DEFAULT 0,
  `latest_intent_type` varchar(50) NULL DEFAULT NULL,
  `profile_completeness` int NOT NULL DEFAULT 0,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`profile_id`),
  UNIQUE KEY `enterprise_profile_company_name_uq` (`company_name`),
  KEY `enterprise_profile_enterprise_id_idx` (`enterprise_id`),
  KEY `enterprise_profile_company_name_idx` (`company_name`),
  KEY `enterprise_profile_industry_name_idx` (`industry_name`),
  KEY `enterprise_profile_region_city_idx` (`region_city`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `enterprise_tag` (
  `tag_id` bigint NOT NULL AUTO_INCREMENT,
  `enterprise_id` bigint NULL DEFAULT NULL,
  `company_name` varchar(200) NOT NULL,
  `tag_type` varchar(50) NOT NULL,
  `tag_name` varchar(100) NOT NULL,
  `tag_source` varchar(100) NOT NULL,
  `confidence_score` int NOT NULL DEFAULT 0,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`tag_id`),
  UNIQUE KEY `enterprise_tag_company_type_name_uq` (`company_name`, `tag_type`, `tag_name`),
  KEY `enterprise_tag_enterprise_id_idx` (`enterprise_id`),
  KEY `enterprise_tag_company_name_idx` (`company_name`),
  KEY `enterprise_tag_tag_type_idx` (`tag_type`),
  KEY `enterprise_tag_tag_name_idx` (`tag_name`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lead_score_rule` (
  `rule_id` bigint NOT NULL AUTO_INCREMENT,
  `rule_code` varchar(100) NOT NULL,
  `rule_name` varchar(100) NOT NULL,
  `event_type` varchar(50) NULL DEFAULT NULL,
  `keyword_json` text NULL,
  `score_delta` int NOT NULL DEFAULT 0,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `rule_description` text NULL,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`rule_id`),
  UNIQUE KEY `lead_score_rule_code_uq` (`rule_code`),
  KEY `lead_score_rule_rule_code_idx` (`rule_code`),
  KEY `lead_score_rule_event_type_idx` (`event_type`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lead_score_breakdown` (
  `breakdown_id` bigint NOT NULL AUTO_INCREMENT,
  `lead_id` bigint NOT NULL,
  `event_id` bigint NULL DEFAULT NULL,
  `rule_id` bigint NOT NULL,
  `rule_code` varchar(100) NOT NULL,
  `rule_name` varchar(100) NOT NULL,
  `score_delta` int NOT NULL DEFAULT 0,
  `reason` varchar(500) NOT NULL,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`breakdown_id`),
  KEY `lead_score_breakdown_lead_id_idx` (`lead_id`),
  KEY `lead_score_breakdown_event_id_idx` (`event_id`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
