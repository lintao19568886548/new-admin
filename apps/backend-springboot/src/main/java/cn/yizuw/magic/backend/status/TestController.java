package cn.yizuw.magic.backend.status;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** 兼容旧 Nitro `/api/test.get.ts` 和 `/api/test.post.ts` 的轻量测试接口。 */
@RestController
public class TestController {

  /** 返回旧接口固定文本，用于代理和路由连通性测试。 */
  @GetMapping("/test")
  public String test() {
    return "Test get handler";
  }

  /** 返回旧 POST 测试接口固定文本，用于验证写请求代理链路。 */
  @PostMapping("/test")
  public String testPost() {
    return "Test post handler";
  }
}
