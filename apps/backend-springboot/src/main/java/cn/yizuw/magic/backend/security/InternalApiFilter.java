package cn.yizuw.magic.backend.security;

import cn.yizuw.magic.backend.config.AppProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class InternalApiFilter extends OncePerRequestFilter {

  public static final String TOKEN_HEADER = "X-Internal-API-Token";

  private final AppProperties appProperties;

  public InternalApiFilter(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getServletPath();
    if (path == null || path.isEmpty()) {
      path = request.getRequestURI();
    }
    if (path == null || path.isEmpty()) {
      path = request.getPathInfo();
    }
    return !(path.startsWith("/internal/outbox/") || path.startsWith("/internal/rabbit/"));
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    if (!isInternalCallAllowed(request)) {
      response.sendError(HttpStatus.FORBIDDEN.value(), "internal api token or private network required");
      return;
    }
    filterChain.doFilter(request, response);
  }

  private boolean isInternalCallAllowed(HttpServletRequest request) {
    if (isPrivateNetworkAddress(request.getRemoteAddr())) {
      return true;
    }

    String expectedToken = appProperties.getInternalApi().getToken();
    String actualToken = request.getHeader(TOKEN_HEADER);
    return StringUtils.hasText(expectedToken) && StringUtils.hasText(actualToken) && expectedToken.equals(actualToken);
  }

  private boolean isPrivateNetworkAddress(String address) {
    if (!StringUtils.hasText(address)) {
      return false;
    }
    try {
      InetAddress inetAddress = InetAddress.getByName(address);
      return inetAddress.isLoopbackAddress() || inetAddress.isSiteLocalAddress();
    } catch (UnknownHostException error) {
      return false;
    }
  }
}
