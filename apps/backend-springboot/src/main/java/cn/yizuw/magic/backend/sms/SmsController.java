package cn.yizuw.magic.backend.sms;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 通用短信入口；迁移期统一投递 RabbitMQ，不在请求线程直连短信供应商。 */
@RestController
public class SmsController {

  private final SmsService smsService;

  public SmsController(SmsService smsService) {
    this.smsService = smsService;
  }

  /** 单条租户合同提醒短信排队。 */
  @PostMapping("/sms/send")
  public ApiResponse<Map<String, Object>> send(@RequestBody(required = false) SmsSendRequest request) {
    return ApiResponse.ok(smsService.enqueueContractReminder(request));
  }

  /** 批量扫描符合条件的租户合同提醒短信并排队。 */
  @PostMapping("/sms/send-bulk")
  public ApiResponse<Map<String, Object>> sendBulk() {
    return ApiResponse.ok(smsService.enqueueBulkContractReminders());
  }
}
