package cn.yizuw.magic.backend.investment;

import com.fasterxml.jackson.annotation.JsonSetter;

/** 招商雷达外部公开线索更新请求；保留旧端“字段未传”和“显式传 null 清空”的区别。 */
public class ExternalLeadUpdateRequest {

  private String invalidReason;
  private boolean invalidReasonPresent;
  private Object ownerUserId;
  private boolean ownerUserIdPresent;
  private String remark;
  private boolean remarkPresent;
  private String status;
  private boolean statusPresent;

  public String invalidReason() {
    return invalidReason;
  }

  public boolean invalidReasonPresent() {
    return invalidReasonPresent;
  }

  @JsonSetter("invalidReason")
  public void setInvalidReason(String invalidReason) {
    this.invalidReason = invalidReason;
    this.invalidReasonPresent = true;
  }

  public Object ownerUserId() {
    return ownerUserId;
  }

  public boolean ownerUserIdPresent() {
    return ownerUserIdPresent;
  }

  @JsonSetter("ownerUserId")
  public void setOwnerUserId(Object ownerUserId) {
    this.ownerUserId = ownerUserId;
    this.ownerUserIdPresent = true;
  }

  public String remark() {
    return remark;
  }

  public boolean remarkPresent() {
    return remarkPresent;
  }

  @JsonSetter("remark")
  public void setRemark(String remark) {
    this.remark = remark;
    this.remarkPresent = true;
  }

  public String status() {
    return status;
  }

  public boolean statusPresent() {
    return statusPresent;
  }

  @JsonSetter("status")
  public void setStatus(String status) {
    this.status = status;
    this.statusPresent = true;
  }
}
