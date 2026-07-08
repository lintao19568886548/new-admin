package cn.yizuw.magic.backend.bill;

import java.util.List;
import java.util.Map;

/**
 * 总账单新增/更新请求。
 *
 * <p>兼容旧 Nitro 接口的宽松入参类型，只写 {@code amount_bill} 主表和水电明细白名单字段；财务流水联动后续由
 * 财务同步专项或 XXL-Job 补偿任务接入。
 */
public record AmountBillSaveRequest(
    List<Map<String, Object>> eleBills,
    Object eleFee,
    Object eleItem,
    Object extraEleItem,
    Object extraEleRate,
    Object extraProjectItem,
    Object factoryRent,
    Object garbageFee,
    Object garbageRate,
    Object invoiceTax,
    Object managementFee,
    Object parkId,
    Object penaltyFee,
    Object penaltyItem,
    Object penaltyRate,
    Object privateBankAccount,
    Object projectName,
    Object publicBankAccount,
    Object receiptAmount,
    Object receiptTime,
    Object receiveFee,
    Object remark,
    Object serviceFee,
    Object serviceRate,
    Object taxRate,
    Object tenantId,
    Object tenantName,
    Object totalFee,
    Object waterFee,
    Object waterItem,
    List<Map<String, Object>> waterBills) {}
