package cn.yizuw.magic.backend.auth;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank String password, @NotBlank String username) {}
