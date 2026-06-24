CREATE TABLE IF NOT EXISTS `amount_bill_collection_sms_log` (
  `log_id` INT NOT NULL AUTO_INCREMENT,
  `bill_id` INT NOT NULL,
  `collection_type` VARCHAR(32) NOT NULL,
  `template_id` VARCHAR(64) NULL,
  `phone_number` VARCHAR(20) NULL,
  `tenant_name` VARCHAR(191) NULL,
  `project_name` VARCHAR(191) NULL,
  `remaining_amount` DECIMAL(10, 2) NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 1,
  `error` VARCHAR(500) NULL,
  `provider_result` JSON NULL,
  `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `create_time` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`log_id`),
  INDEX `idx_amount_bill_collection_sms_log_bill_id` (`bill_id`),
  INDEX `idx_amount_bill_collection_sms_log_type_sent_at` (
    `collection_type`,
    `sent_at`
  )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
