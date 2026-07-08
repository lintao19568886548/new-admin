package cn.yizuw.magic.backend.cache;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;

class CacheServiceTest {

  @Test
  void evictByPrefixUsesScanInsteadOfKeys() {
    @SuppressWarnings("unchecked")
    RedisTemplate<String, Object> redisTemplate = org.mockito.Mockito.mock(RedisTemplate.class);
    @SuppressWarnings("unchecked")
    Cursor<String> cursor = org.mockito.Mockito.mock(Cursor.class);
    when(redisTemplate.scan(any(ScanOptions.class))).thenReturn(cursor);
    when(cursor.hasNext()).thenReturn(true, true, false);
    when(cursor.next()).thenReturn("tenant:org001:user-info:1", "tenant:org001:user-info:2");

    new CacheService(redisTemplate).evictByPrefix("tenant:org001:user-info:");

    verify(redisTemplate).scan(any(ScanOptions.class));
    verify(redisTemplate).delete(List.of("tenant:org001:user-info:1", "tenant:org001:user-info:2"));
    verify(redisTemplate, never()).keys(anyString());
  }

  @Test
  void evictByPrefixSkipsBlankPrefix() {
    @SuppressWarnings("unchecked")
    RedisTemplate<String, Object> redisTemplate = org.mockito.Mockito.mock(RedisTemplate.class);

    new CacheService(redisTemplate).evictByPrefix(" ");

    verify(redisTemplate, never()).scan(any(ScanOptions.class));
    verify(redisTemplate, never()).keys(anyString());
  }
}
