package cn.yizuw.magic.backend.bill;

import java.util.Map;

/**
 * 催缴短信预览请求。
 *
 * <p>本接口只计算候选账单、短信正文和模板参数，不发送短信、不写发送日志。
 */
public record AmountBillCollectionSmsPreviewRequest(
    Object billIds,
    String collectionType,
    Object currentPark,
    String dueDate,
    Map<String, Object> filters,
    Object overdueDays) {}
