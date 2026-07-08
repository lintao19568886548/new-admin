package cn.yizuw.magic.backend.security;

import cn.yizuw.magic.backend.tenant.TenantContext;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AuthFilter extends OncePerRequestFilter {

  private final JwtService jwtService;

  public AuthFilter(JwtService jwtService) {
    this.jwtService = jwtService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    if (isPublicPath(request)) {
      TenantContext.clear();
      filterChain.doFilter(request, response);
      return;
    }

    TenantContext.clear();
    String authorization = request.getHeader("Authorization");
    if (authorization != null && authorization.startsWith("Bearer ")) {
      try {
        TenantContext.set(jwtService.verifyAccessToken(authorization.substring("Bearer ".length())));
      } catch (JwtException | IllegalArgumentException ignored) {
        TenantContext.clear();
      }
    }

    try {
      filterChain.doFilter(request, response);
    } finally {
      TenantContext.clear();
    }
  }

  private boolean isPublicPath(HttpServletRequest request) {
    String path = request.getServletPath();
    return "/auth/login".equals(path)
        || "/auth/code-login".equals(path)
        || "/auth/refresh".equals(path)
        || "/auth/send-login-code".equals(path)
        || "/auth/password".equals(path)
        || "/auth/logout".equals(path);
  }
}
