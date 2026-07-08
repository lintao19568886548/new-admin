package cn.yizuw.magic.backend.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.yizuw.magic.backend.common.GlobalExceptionHandler;
import cn.yizuw.magic.backend.crm.CrmController;
import cn.yizuw.magic.backend.crm.CrmOwnerBindingCreateRequest;
import cn.yizuw.magic.backend.crm.CrmOwnerBindingDeleteRequest;
import cn.yizuw.magic.backend.crm.CrmOwnerBindingTransferRequest;
import cn.yizuw.magic.backend.crm.CrmOwnerBindingUpdateRequest;
import cn.yizuw.magic.backend.crm.CrmService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 第五十三批 CRM 客户归属本地写接口路由测试。 */
class FiftyThirdBatchControllerTest {

  private CrmService crmService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    crmService = org.mockito.Mockito.mock(CrmService.class);
    mockMvc =
        MockMvcBuilders.standaloneSetup(new CrmController(crmService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void createCrmOwnerBindingReturnsCreatedBinding() throws Exception {
    when(crmService.createOwnerBinding(any(CrmOwnerBindingCreateRequest.class)))
        .thenReturn(Map.of("id", 31, "customerName", "客户A", "ownerSalesUserId", 9));

    mockMvc
        .perform(
            post("/crm/binding/create")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "customerName":"客户A",
                      "phone":"13800138000",
                      "ownerSalesUserId":9
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(31))
        .andExpect(jsonPath("$.data.ownerSalesUserId").value(9));

    verify(crmService).createOwnerBinding(any(CrmOwnerBindingCreateRequest.class));
  }

  @Test
  void updateCrmOwnerBindingReturnsUpdatedBinding() throws Exception {
    when(crmService.updateOwnerBinding(any(CrmOwnerBindingUpdateRequest.class)))
        .thenReturn(Map.of("id", 31, "customerName", "客户B", "phone", "13900139000"));

    mockMvc
        .perform(
            post("/crm/binding/update")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "id":31,
                      "customerName":"客户B",
                      "phone":"13900139000"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(31))
        .andExpect(jsonPath("$.data.customerName").value("客户B"));

    verify(crmService).updateOwnerBinding(any(CrmOwnerBindingUpdateRequest.class));
  }

  @Test
  void deleteCrmOwnerBindingReturnsDeletedSnapshot() throws Exception {
    when(crmService.deleteOwnerBinding(any(CrmOwnerBindingDeleteRequest.class)))
        .thenReturn(Map.of("id", 31, "customerName", "客户A"));

    mockMvc
        .perform(
            post("/crm/binding/delete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "id":31,
                      "reason":"重复客户"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.id").value(31))
        .andExpect(jsonPath("$.data.customerName").value("客户A"));

    verify(crmService).deleteOwnerBinding(any(CrmOwnerBindingDeleteRequest.class));
  }

  @Test
  void transferCrmOwnerBindingReturnsTransferSummary() throws Exception {
    when(crmService.transferOwnerBinding(any(CrmOwnerBindingTransferRequest.class)))
        .thenReturn(
            Map.of(
                "binding", Map.of("id", 31, "ownerSalesUserId", 10),
                "fromOwnerSalesUserId", 9,
                "toOwnerSalesUserId", 10));

    mockMvc
        .perform(
            post("/crm/binding/transfer")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "id":31,
                      "toSalesUserId":10,
                      "reason":"销售交接"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.fromOwnerSalesUserId").value(9))
        .andExpect(jsonPath("$.data.toOwnerSalesUserId").value(10));

    verify(crmService).transferOwnerBinding(any(CrmOwnerBindingTransferRequest.class));
  }
}
