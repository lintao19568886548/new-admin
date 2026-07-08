package cn.yizuw.magic.backend.bill;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 总账单接口。
 *
 * <p>迁移期按批次开放读写能力；写接口保持园区权限边界，不直接触发旧端全量删除、短信供应商调用或财务同步副作用。
 */
@RestController
public class AmountBillController {

  private final AmountBillService amountBillService;

  public AmountBillController(AmountBillService amountBillService) {
    this.amountBillService = amountBillService;
  }

  /** 查询总账单分页列表；只读统计，不触发财务同步或催缴短信。 */
  @GetMapping("/bill/amount/list")
  public ApiResponse<Map<String, Object>> list(
      @RequestParam(required = false) String collectionStatus,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) String endTime,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String projectEndDate,
      @RequestParam(required = false) String projectName,
      @RequestParam(required = false) String projectStartDate,
      @RequestParam(required = false) String startTime,
      @RequestParam(required = false) String tenantName) {
    AmountBillListQuery query =
        new AmountBillListQuery(
            collectionStatus,
            currentPage,
            currentPark,
            endTime,
            pageSize,
            projectEndDate,
            projectName,
            projectStartDate,
            startTime,
            tenantName);
    return ApiResponse.ok(amountBillService.getAmountBillList(query));
  }

  /** 查询总账单详情，附带水电明细、租户名和园区管理人快照。 */
  @GetMapping("/bill/amount/{id}")
  public ApiResponse<Map<String, Object>> detail(@PathVariable Integer id) {
    return ApiResponse.ok(amountBillService.getAmountBillDetail(id));
  }

  /** 总账单项目名称自动完成选项。 */
  @GetMapping("/bill/amount/project-options")
  public ApiResponse<List<Map<String, Object>>> projectOptions(
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) Integer parkId) {
    return ApiResponse.ok(amountBillService.getProjectOptions(keyword, currentPark, parkId));
  }

  /** 旧 Nitro 将工具文件放在 api 目录；这里显式声明为迁移兼容说明路由。 */
  @GetMapping("/bill/amount/utils")
  public ApiResponse<Map<String, Object>> utilsCompatibility() {
    return ApiResponse.ok(amountBillService.getAmountBillUtilityRouteInfo("utils"));
  }

  /** 旧 Nitro 删除工具文件被路由差异脚本识别；Spring Boot 不暴露直接删除工具能力。 */
  @GetMapping("/bill/amount/delete-utils")
  public ApiResponse<Map<String, Object>> deleteUtilsCompatibility() {
    return ApiResponse.ok(amountBillService.getAmountBillUtilityRouteInfo("delete-utils"));
  }

  /** 总账单导出数据接口；只返回 JSON 数据，不生成文件，不触发短信或财务同步。 */
  @PostMapping("/bill/amount/export")
  public ApiResponse<List<Map<String, Object>>> export(
      @RequestBody(required = false) AmountBillExportRequest request) {
    return ApiResponse.ok(amountBillService.exportAmountBills(request));
  }

  /** 新增总账单主表和水电明细；不直接同步财务流水。 */
  @PostMapping("/bill/amount")
  public ApiResponse<Map<String, Object>> create(
      @RequestBody(required = false) AmountBillSaveRequest request) {
    return ApiResponse.ok(amountBillService.createAmountBill(request));
  }

  /** 更新总账单主表和水电明细；不直接同步财务流水。 */
  @PutMapping("/bill/amount/{id}")
  public ApiResponse<Map<String, Object>> update(
      @PathVariable Integer id, @RequestBody(required = false) AmountBillSaveRequest request) {
    return ApiResponse.ok(amountBillService.updateAmountBill(id, request));
  }

  /** 催缴短信预览接口；只计算候选账单和短信正文，不发送短信。 */
  @PostMapping("/bill/amount/collection-sms/preview")
  public ApiResponse<Map<String, Object>> collectionSmsPreview(
      @RequestBody(required = false) AmountBillCollectionSmsPreviewRequest request) {
    return ApiResponse.ok(amountBillService.previewCollectionSms(request));
  }

  /** 催缴短信发送兼容入口；迁移期只投递 RabbitMQ 任务，不直连短信供应商。 */
  @PostMapping("/bill/amount/collection-sms/send")
  public ApiResponse<Map<String, Object>> collectionSmsSend(
      @RequestBody(required = false) AmountBillCollectionSmsPreviewRequest request) {
    return ApiResponse.ok(amountBillService.enqueueCollectionSms(request));
  }

  /** 删除总账单及其水电明细，并软删关联财务流水。 */
  @DeleteMapping("/bill/amount/{id}")
  public ApiResponse<Map<String, Object>> delete(@PathVariable Integer id) {
    return ApiResponse.ok(amountBillService.deleteAmountBill(id));
  }

  /** 批量删除当前用户授权园区内的总账单；不执行旧端无范围全库删除。 */
  @DeleteMapping("/bill/amount")
  public ApiResponse<Map<String, Object>> deleteAuthorized() {
    return ApiResponse.ok(amountBillService.deleteAuthorizedAmountBills());
  }
}
