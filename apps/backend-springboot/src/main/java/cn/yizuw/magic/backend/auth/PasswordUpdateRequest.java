package cn.yizuw.magic.backend.auth;

import jakarta.validation.constraints.NotBlank;

/** 当前登录用户修改密码请求，兼容旧 Nitro `/api/auth/password.ts`。 */
public record PasswordUpdateRequest(
    @NotBlank(message = "不能为空") String newPassword,
    @NotBlank(message = "不能为空") String oldPassword) {}
