package cn.yizuw.magic.backend.bill;

import java.util.List;

/** 总账单导出请求，只支持按园区 ID 白名单过滤，不生成文件。 */
public record AmountBillExportRequest(List<Object> parkIds) {}
