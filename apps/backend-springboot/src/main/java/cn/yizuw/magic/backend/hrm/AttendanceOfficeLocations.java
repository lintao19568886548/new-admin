package cn.yizuw.magic.backend.hrm;

import java.util.List;
import java.util.Map;

/** 固定办公打卡地点，按旧 Nitro `attendance-location.ts` 常量迁移。 */
final class AttendanceOfficeLocations {

  private AttendanceOfficeLocations() {}

  static List<Map<String, Object>> all() {
    return List.of(
        location("总部办公室", 23.099596024527226, 113.76957489705129, 100),
        location("广州新塘园区夏埔二", 23.107344, 113.573356, 100),
        location("桥头十一宏威", 23.033413470702452, 114.14257838366677, 100),
        location("东莞同兴园区", 23.121099, 113.751778, 100),
        location("佛山乐从园区", 22.93635275158429, 113.14950568508898, 100),
        location("广州西州二园区", 23.10706867571143, 113.58779244665394, 100),
        location("广州园区（西州一）", 23.105772, 113.592908, 250),
        location("佛山九江园区", 22.880809, 113.014824, 130),
        location("广州园区", 23.105563, 113.592559, 100),
        location("广州十一兄弟实业", 23.112274, 113.590177, 100),
        location("深圳坪山23园区", 22.769621, 114.377519, 100),
        location("广州荔新", 23.183788, 113.696806, 120));
  }

  private static Map<String, Object> location(String name, double lat, double lng, int radius) {
    return Map.of("lat", lat, "lng", lng, "name", name, "radius", radius);
  }
}
