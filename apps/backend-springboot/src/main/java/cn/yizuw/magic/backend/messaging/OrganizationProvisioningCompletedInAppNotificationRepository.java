package cn.yizuw.magic.backend.messaging;

import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 中心库站内通知仓储；当前仅用于组织开通完成 in_app provider。 */
@Repository
public class OrganizationProvisioningCompletedInAppNotificationRepository {

  private final JdbcTemplate centerJdbcTemplate;

  public OrganizationProvisioningCompletedInAppNotificationRepository(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /** 逐收件人写入站内通知；唯一幂等键重复时跳过并计入 duplicateRows。 */
  public OrganizationProvisioningCompletedInAppNotificationRepositoryResult insertRows(
      List<OrganizationProvisioningCompletedInAppNotificationInsertRow> rows) {
    int insertedRows = 0;
    int duplicateRows = 0;
    for (OrganizationProvisioningCompletedInAppNotificationInsertRow row : rows) {
      try {
        centerJdbcTemplate.update(
            """
            INSERT INTO in_app_notification
              (event_id, idempotency_key, recipient_center_user_id, target_customer_id,
               target_db_name, template_key, title, content, status, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            row.eventId(),
            row.idempotencyKey(),
            row.recipientCenterUserId(),
            row.targetCustomerId(),
            row.targetDbName(),
            row.templateKey(),
            row.title(),
            row.content(),
            row.status(),
            row.payloadJson());
        insertedRows++;
      } catch (DuplicateKeyException duplicate) {
        duplicateRows++;
      }
    }
    return new OrganizationProvisioningCompletedInAppNotificationRepositoryResult(
        rows.size(), insertedRows, duplicateRows);
  }
}
