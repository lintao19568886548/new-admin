-- Manual DDL for organization provisioning completed in-app notifications.
-- Apply this to the center database before enabling the real in_app provider executor.

CREATE TABLE IF NOT EXISTS in_app_notification (
  id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
  event_id VARCHAR(128) NOT NULL COMMENT 'Provider event id, usually source event id plus channel',
  idempotency_key VARCHAR(256) NOT NULL COMMENT 'Unique write key per recipient notification',
  recipient_center_user_id BIGINT NOT NULL COMMENT 'Center user receiving the notification',
  target_customer_id VARCHAR(128) NOT NULL COMMENT 'Opened organization/customer id',
  target_db_name VARCHAR(128) NOT NULL COMMENT 'Opened tenant database name',
  template_key VARCHAR(128) NOT NULL COMMENT 'Notification template key',
  title VARCHAR(255) NOT NULL COMMENT 'Notification title',
  content TEXT NOT NULL COMMENT 'Rendered notification content',
  status VARCHAR(32) NOT NULL DEFAULT 'unread' COMMENT 'unread/read/archived',
  payload_json LONGTEXT NULL COMMENT 'Optional provider payload snapshot',
  delivered_at DATETIME NULL COMMENT 'Reserved for websocket or push delivery acknowledgement',
  read_at DATETIME NULL COMMENT 'First read time',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_in_app_notification_idempotency (idempotency_key),
  KEY idx_in_app_notification_event (event_id),
  KEY idx_in_app_notification_recipient_status (recipient_center_user_id, status, created_at),
  KEY idx_in_app_notification_customer_created (target_customer_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
