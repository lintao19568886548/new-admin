package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.auth.AuthController;
import cn.yizuw.magic.backend.auth.AuthService;
import cn.yizuw.magic.backend.auth.SmsCodeRequest;
import cn.yizuw.magic.backend.auth.SmsCodeVerifyRequest;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.permission.PermissionService;
import cn.yizuw.magic.backend.sms.SmsController;
import cn.yizuw.magic.backend.sms.SmsSendRequest;
import cn.yizuw.magic.backend.sms.SmsService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第六十七批短信验证码和通用短信 RabbitMQ 排队接口测试。 */
class SixtySeventhBatchControllerTest {

  private AuthService authService;
  private MockMvc mockMvc;
  private SmsService smsService;

  @BeforeEach
  void setUp() {
    authService = org.mockito.Mockito.mock(AuthService.class);
    smsService = org.mockito.Mockito.mock(SmsService.class);
    PermissionService permissionService = org.mockito.Mockito.mock(PermissionService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(
                new AuthController(authService, permissionService), new SmsController(smsService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void sendLoginCodeReturnsQueuedCodeTask() throws Exception {
    when(authService.sendLoginCode(any(SmsCodeRequest.class)))
        .thenReturn(
            Map.of(
                "debugCode",
                "123456",
                "expiresIn",
                300,
                "messageId",
                "login-code-1",
                "transport",
                "rabbitmq"));

    mockMvc
        .perform(
            post("/auth/send-login-code")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phoneNumber\":\"13800138000\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("验证码发送成功"))
        .andExpect(jsonPath("$.data.transport").value("rabbitmq"));

    verify(authService).sendLoginCode(any(SmsCodeRequest.class));
  }

  @Test
  void sendPageAccessCodeReturnsQueuedCodeTask() throws Exception {
    when(authService.sendPageAccessCode())
        .thenReturn(
            Map.of(
                "debugCode",
                "654321",
                "expiresIn",
                300,
                "messageId",
                "page-code-1",
                "transport",
                "rabbitmq"));

    mockMvc
        .perform(post("/auth/send-page-access-code"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("验证码发送成功"))
        .andExpect(jsonPath("$.data.messageId").value("page-code-1"));

    verify(authService).sendPageAccessCode();
  }

  @Test
  void verifyPageAccessCodeReturnsVerifiedState() throws Exception {
    when(authService.verifyPageAccessCode(any(SmsCodeVerifyRequest.class)))
        .thenReturn(Map.of("phoneNumber", "13800138000", "verified", true));

    mockMvc
        .perform(
            post("/auth/verify-page-access-code")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"654321\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.message").value("验证码校验成功"))
        .andExpect(jsonPath("$.data.verified").value(true));

    verify(authService).verifyPageAccessCode(any(SmsCodeVerifyRequest.class));
  }

  @Test
  void sendSmsReturnsQueuedReminder() throws Exception {
    when(smsService.enqueueContractReminder(any(SmsSendRequest.class)))
        .thenReturn(
            Map.of(
                "data",
                Map.of("messageId", "sms-1", "transport", "rabbitmq"),
                "message",
                "短信已加入发送队列",
                "rentalTenantId",
                88,
                "tenantName",
                "测试租户"));

    mockMvc
        .perform(
            post("/sms/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "tenantName":"测试租户",
                      "increaseDate":"2026-08-01",
                      "contractEndDate":"2026-10-01",
                      "phoneNumber":"13800138000",
                      "rentalTenantId":88
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.data.transport").value("rabbitmq"))
        .andExpect(jsonPath("$.data.rentalTenantId").value(88));

    verify(smsService).enqueueContractReminder(any(SmsSendRequest.class));
  }

  @Test
  void sendBulkSmsReturnsQueuedSummary() throws Exception {
    when(smsService.enqueueBulkContractReminders())
        .thenReturn(
            Map.of(
                "data",
                Map.of(
                    "errors",
                    List.of(),
                    "failed",
                    0,
                    "results",
                    List.of(Map.of("messageId", "bulk-1", "success", true, "tenantId", 89)),
                    "success",
                    1,
                    "total",
                    1,
                    "transport",
                    "rabbitmq"),
                "message",
                "批量短信任务已加入发送队列，成功: 1，失败: 0"));

    mockMvc
        .perform(post("/sms/send-bulk"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.data.total").value(1))
        .andExpect(jsonPath("$.data.data.transport").value("rabbitmq"));

    verify(smsService).enqueueBulkContractReminders();
  }
}
