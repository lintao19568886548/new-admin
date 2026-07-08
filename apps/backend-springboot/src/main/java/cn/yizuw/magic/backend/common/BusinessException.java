package cn.yizuw.magic.backend.common;

import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {

  private final String errorCode;
  private final HttpStatus status;

  public BusinessException(HttpStatus status, String message) {
    this(status, message, null);
  }

  public BusinessException(HttpStatus status, String message, String errorCode) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }

  public String getErrorCode() {
    return errorCode;
  }

  public HttpStatus getStatus() {
    return status;
  }
}
