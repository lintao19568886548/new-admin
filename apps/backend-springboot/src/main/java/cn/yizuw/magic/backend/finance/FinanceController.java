package cn.yizuw.magic.backend.finance;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.common.PageResult;
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
 * 财务模块接口。
 *
 * <p>迁移期只开放低副作用主表读写；图片关系、租赁费用同步和批量删除等高风险逻辑继续按批次后移。
 */
@RestController
public class FinanceController {

  private final FinanceService financeService;

  public FinanceController(FinanceService financeService) {
    this.financeService = financeService;
  }

  @GetMapping("/finance/list")
  public ApiResponse<PageResult<Map<String, Object>>> list(
      @RequestParam(required = false) String amount,
      @RequestParam(required = false) String billCategory,
      @RequestParam(required = false) String billName,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String endTime,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) String startTime,
      @RequestParam(required = false) Integer status,
      @RequestParam(required = false) String transactionType) {
    return ApiResponse.ok(
        financeService.getFinanceList(
            amount,
            billCategory,
            billName,
            currentPage,
            endTime,
            pageSize,
            parkId,
            startTime,
            status,
            transactionType));
  }

  @GetMapping("/finance/{id}")
  public ApiResponse<Map<String, Object>> detail(@PathVariable int id) {
    return ApiResponse.ok(financeService.getFinanceDetail(id));
  }

  /** 新增财务流水主表记录；图片关系和租赁费用同步仍保留在后续专项迁移。 */
  @PostMapping("/finance")
  public ApiResponse<Map<String, Object>> create(
      @RequestBody(required = false) FinanceCreateRequest request) {
    return ApiResponse.ok(financeService.createFinance(request));
  }

  /** 逻辑删除财务流水；不触发租赁财务同步或图片关系重建。 */
  @DeleteMapping("/finance/{id}")
  public ApiResponse<Map<String, Object>> delete(@PathVariable int id) {
    return ApiResponse.ok(financeService.deleteFinance(id));
  }

  /** 批量软删当前用户授权园区内的财务流水；不删除图片关系，也不触发同步任务。 */
  @DeleteMapping("/finance")
  public ApiResponse<Map<String, Object>> deleteAuthorizedFinances() {
    return ApiResponse.ok(financeService.deleteAuthorizedFinances());
  }

  /** 更新财务流水主表字段；图片关系和租赁财务同步仍保留在后续专项迁移。 */
  @PutMapping("/finance/{id}")
  public ApiResponse<Map<String, Object>> update(
      @PathVariable int id, @RequestBody(required = false) FinanceUpdateRequest request) {
    return ApiResponse.ok(financeService.updateFinance(id, request));
  }

  @GetMapping("/finance/bill-name-options")
  public ApiResponse<List<Map<String, Object>>> billNameOptions(
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) Integer currentPark) {
    return ApiResponse.ok(financeService.getBillNameOptions(keyword, parkId, currentPark));
  }
}
