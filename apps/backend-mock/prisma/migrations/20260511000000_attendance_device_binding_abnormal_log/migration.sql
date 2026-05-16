CREATE TABLE IF NOT EXISTS `attendance_device_binding` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int NOT NULL COMMENT '绑定用户ID，对应user.id',
  `device_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '设备唯一标识',
  `device_model` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '设备型号或浏览器平台信息',
  `device_system` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '设备系统信息',
  `first_bind_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '首次绑定时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `attendance_device_binding_user_id_idx` (`user_id`) USING BTREE,
  KEY `attendance_device_binding_device_id_idx` (`device_id`) USING BTREE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '考勤打卡设备绑定表' ROW_FORMAT = DYNAMIC;

CREATE TABLE IF NOT EXISTS `attendance_device_abnormal_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` int NOT NULL COMMENT '异常打卡用户ID，对应user.id',
  `attendance_id` int NULL DEFAULT NULL COMMENT '关联考勤记录ID，对应attendances.attendance_id',
  `action` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '打卡动作：punch_in上班，punch_out下班',
  `abnormal_type` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '异常类型：device_changed更换设备，same_device_multi_account同设备多账号，多个类型用逗号分隔',
  `bound_device_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '用户已绑定设备标识',
  `current_device_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '本次打卡使用的设备标识',
  `duplicate_user_ids` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '同设备已绑定的其他用户ID列表',
  `duplicate_user_names` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '同设备已绑定的其他用户姓名列表',
  `punch_time` datetime(3) NULL DEFAULT NULL COMMENT '打卡时间',
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `attendance_device_abnormal_log_user_id_idx` (`user_id`) USING BTREE,
  KEY `attendance_device_abnormal_log_attendance_id_idx` (`attendance_id`) USING BTREE,
  KEY `attendance_device_abnormal_log_current_device_id_idx` (`current_device_id`) USING BTREE,
  KEY `attendance_device_abnormal_log_abnormal_type_idx` (`abnormal_type`) USING BTREE,
  KEY `attendance_device_abnormal_log_create_time_idx` (`create_time`) USING BTREE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '考勤打卡设备异常记录表' ROW_FORMAT = DYNAMIC;

ALTER TABLE `attendance_device_abnormal_log`
  MODIFY COLUMN `abnormal_type` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '异常类型：device_changed更换设备，same_device_multi_account同设备多账号，多个类型用逗号分隔';
