package cn.yizuw.magic.backend.common;

public record ApiResponse<T>(Integer code, T data, Object error, String message) {

  public static <T> ApiResponse<T> ok(T data) {
    return new ApiResponse<>(0, data, null, "ok");
  }

  public static <T> ApiResponse<T> ok(T data, String message) {
    return new ApiResponse<>(0, data, null, message);
  }

  public static ApiResponse<Void> error(Integer code, String message) {
    return new ApiResponse<>(code, null, message, message);
  }
}
