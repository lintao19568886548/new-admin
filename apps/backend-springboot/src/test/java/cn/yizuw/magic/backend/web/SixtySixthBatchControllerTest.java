package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.bill.AmountBillCollectionSmsPreviewRequest;
import cn.yizuw.magic.backend.bill.AmountBillController;
import cn.yizuw.magic.backend.bill.AmountBillSaveRequest;
import cn.yizuw.magic.backend.bill.AmountBillService;
import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第六十六批总账单新增/更新、催缴短信投递和授权批量删除接口测试。 */
class SixtySixthBatchControllerTest {

  private AmountBillService amountBillService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    amountBillService = org.mockito.Mockito.mock(AmountBillService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new AmountBillController(amountBillService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void createAmountBillReturnsCreatedBill() throws Exception {
    when(amountBillService.createAmountBill(any(AmountBillSaveRequest.class)))
        .thenReturn(
            Map.of(
                "billId",
                701,
                "parkId",
                3,
                "projectName",
                "2026年7月租金",
                "totalFee",
                new BigDecimal("12000.00")));

    mockMvc
        .perform(
            post("/bill/amount")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "parkId":3,
                      "tenantId":88,
                      "tenantName":"测试租户",
                      "projectName":"2026年7月租金",
                      "totalFee":12000,
                      "waterBills":[{"waterName":"1号表","currentReading":12}],
                      "eleBills":[{"eleName":"A相电表","currentReading":30}]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.billId").value(701))
        .andExpect(jsonPath("$.data.projectName").value("2026年7月租金"));

    verify(amountBillService).createAmountBill(any(AmountBillSaveRequest.class));
  }

  @Test
  void updateAmountBillReturnsUpdatedBill() throws Exception {
    when(amountBillService.updateAmountBill(eq(702), any(AmountBillSaveRequest.class)))
        .thenReturn(
            Map.of(
                "billId",
                702,
                "parkId",
                3,
                "projectName",
                "2026年7月租金-修订",
                "receiptAmount",
                new BigDecimal("3000.00")));

    mockMvc
        .perform(
            put("/bill/amount/702")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "parkId":3,
                      "projectName":"2026年7月租金-修订",
                      "receiptAmount":3000,
                      "receiptTime":"2026-07-01 10:00:00"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.billId").value(702))
        .andExpect(jsonPath("$.data.receiptAmount").value(3000.00));

    verify(amountBillService).updateAmountBill(eq(702), any(AmountBillSaveRequest.class));
  }

  @Test
  void collectionSmsSendReturnsQueuedResult() throws Exception {
    when(amountBillService.enqueueCollectionSms(any(AmountBillCollectionSmsPreviewRequest.class)))
        .thenReturn(
            Map.of(
                "failedCount",
                0,
                "results",
                List.of(
                    Map.of(
                        "billId",
                        703,
                        "messageId",
                        "rabbit-703",
                        "sendChannel",
                        "rabbitmq",
                        "success",
                        true)),
                "successCount",
                1,
                "totalCount",
                1,
                "transport",
                "rabbitmq"));

    mockMvc
        .perform(
            post("/bill/amount/collection-sms/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "billIds":[703],
                      "collectionType":"overdue",
                      "dueDate":"2026-07-10",
                      "overdueDays":3
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.transport").value("rabbitmq"))
        .andExpect(jsonPath("$.data.results[0].messageId").value("rabbit-703"));

    verify(amountBillService).enqueueCollectionSms(any(AmountBillCollectionSmsPreviewRequest.class));
  }

  @Test
  void deleteAuthorizedAmountBillsReturnsDeletedCounts() throws Exception {
    when(amountBillService.deleteAuthorizedAmountBills())
        .thenReturn(
            Map.of(
                "deletedBillCount",
                4,
                "deletedEleBillCount",
                2,
                "deletedWaterBillCount",
                3,
                "scope",
                "authorized_parks"));

    mockMvc
        .perform(delete("/bill/amount"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.deletedBillCount").value(4))
        .andExpect(jsonPath("$.data.scope").value("authorized_parks"));

    verify(amountBillService).deleteAuthorizedAmountBills();
  }
}
