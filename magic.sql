/*
 Navicat Premium Dump SQL

 Source Server         : mysql
 Source Server Type    : MySQL
 Source Server Version : 80041 (8.0.41)
 Source Host           : localhost:3306
 Source Schema         : magic

 Target Server Type    : MySQL
 Target Server Version : 80041 (8.0.41)
 File Encoding         : 65001

 Date: 05/05/2025 11:40:16
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for _prisma_migrations
-- ----------------------------
DROP TABLE IF EXISTS `_prisma_migrations`;
CREATE TABLE `_prisma_migrations`  (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) NULL DEFAULT NULL,
  `migration_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `rolled_back_at` datetime(3) NULL DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of _prisma_migrations
-- ----------------------------
INSERT INTO `_prisma_migrations` VALUES ('d9da97b4-cd81-42a8-a327-8fe60b68537d', '629029d9286fc63a7ddc41d9e2415045b99b21195fa77890479a05fce2d80796', '2025-04-12 02:11:06.271', '20250328093655_init', NULL, NULL, '2025-04-12 02:11:06.133', 1);

-- ----------------------------
-- Table structure for access_car
-- ----------------------------
DROP TABLE IF EXISTS `access_car`;
CREATE TABLE `access_car`  (
  `car_id` int NOT NULL AUTO_INCREMENT,
  `status` int NOT NULL,
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `car_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `register_time` datetime(3) NOT NULL,
  `update_time` datetime(3) NULL DEFAULT NULL,
  `park_id` int NULL DEFAULT NULL,
  PRIMARY KEY (`car_id`) USING BTREE,
  INDEX `access_car_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of access_car
-- ----------------------------
INSERT INTO `access_car` VALUES (1, 1, NULL, '312414', '2025-04-14 05:48:36.652', '2025-04-14 05:48:31.000', '2025-04-24 08:22:03.094', 1);
INSERT INTO `access_car` VALUES (2, 1, NULL, '1211', '2025-04-24 08:22:13.758', '2025-04-24 08:22:06.000', '2025-04-25 06:08:28.151', 1);

-- ----------------------------
-- Table structure for access_visitor
-- ----------------------------
DROP TABLE IF EXISTS `access_visitor`;
CREATE TABLE `access_visitor`  (
  `visitor_id` int NOT NULL AUTO_INCREMENT,
  `visitor_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `car_num` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `phone_number` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` int NOT NULL,
  `register_time` datetime(3) NOT NULL,
  `remark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NOT NULL,
  `park_id` int NULL DEFAULT NULL,
  PRIMARY KEY (`visitor_id`) USING BTREE,
  INDEX `access_visitor_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 16 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of access_visitor
-- ----------------------------
INSERT INTO `access_visitor` VALUES (1, '刘安', '', '13725322145', 0, '2025-04-14 01:59:26.000', '送货', '2025-04-14 01:59:53.729', '2025-04-14 01:59:53.729', 1);
INSERT INTO `access_visitor` VALUES (2, '张志', '', '13756478977', 0, '2025-04-14 02:00:58.000', '租房', '2025-04-14 02:01:35.409', '2025-04-14 02:01:35.409', 1);
INSERT INTO `access_visitor` VALUES (3, '擎天柱', '京A123456', '17564545678', 0, '2025-04-14 02:15:31.000', '谈业务', '2025-04-14 02:16:30.500', '2025-04-14 02:16:30.500', 1);
INSERT INTO `access_visitor` VALUES (4, '方怡', '', '13725211111', 0, '2025-04-14 02:56:25.000', '送货', '2025-04-14 02:56:51.472', '2025-04-14 02:56:51.472', 1);
INSERT INTO `access_visitor` VALUES (5, '方怡', '', '13725211111', 1, '2025-04-14 05:34:11.000', '送货', '2025-04-14 05:34:19.838', '2025-04-14 05:34:19.838', 1);
INSERT INTO `access_visitor` VALUES (6, '擎天柱', '', '13728355699', 1, '2025-04-14 05:37:02.000', '谈业务', '2025-04-14 05:37:17.697', '2025-04-14 05:37:17.697', 1);
INSERT INTO `access_visitor` VALUES (7, '陈中文', '', '13728566993', 0, '2025-04-14 05:42:27.000', '谈业务', '2025-04-14 05:42:54.521', '2025-04-14 05:42:54.521', 1);
INSERT INTO `access_visitor` VALUES (8, '陈中文', '', '13728566993', 1, '2025-04-14 05:44:05.000', '谈业务', '2025-04-14 05:44:09.298', '2025-04-14 05:51:18.967', 2);
INSERT INTO `access_visitor` VALUES (9, '陈中文', '', '13728566993', 0, '2025-04-14 05:45:17.000', '谈业务', '2025-04-14 05:45:21.740', '2025-04-14 05:51:13.609', 1);
INSERT INTO `access_visitor` VALUES (14, '擎天柱', '', '13728322222', 0, '2025-04-23 01:51:24.000', '谈业务', '2025-04-23 01:51:41.820', '2025-04-23 01:51:41.820', 1);
INSERT INTO `access_visitor` VALUES (15, '擎天柱', '', '13728355669', 0, '2025-04-25 01:56:56.000', '谈业务', '2025-04-25 01:57:10.656', '2025-04-25 06:08:34.931', 1);

-- ----------------------------
-- Table structure for amount_bill
-- ----------------------------
DROP TABLE IF EXISTS `amount_bill`;
CREATE TABLE `amount_bill`  (
  `bill_id` int NOT NULL AUTO_INCREMENT,
  `ele_fee` decimal(10, 2) NULL DEFAULT 0.00,
  `water_fee` decimal(10, 2) NULL DEFAULT 0.00,
  `factory_rent` decimal(10, 2) NULL DEFAULT 0.00,
  `management_fee` decimal(10, 2) NULL DEFAULT 0.00,
  `service_fee` decimal(10, 2) NULL DEFAULT 0.00,
  `invoice_tax` decimal(10, 2) NULL DEFAULT 0.00,
  `total_fee` decimal(10, 2) NULL DEFAULT 0.00,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `receipt_time` datetime(3) NULL DEFAULT NULL,
  `tenant_id` int NULL DEFAULT NULL,
  `project_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `remark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `tenant_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `update_time` datetime(3) NULL DEFAULT NULL,
  `park_id` int NULL DEFAULT NULL,
  PRIMARY KEY (`bill_id`) USING BTREE,
  INDEX `amount_bill_tenant_id_idx`(`tenant_id` ASC) USING BTREE,
  INDEX `amount_bill_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of amount_bill
-- ----------------------------
INSERT INTO `amount_bill` VALUES (1, 1.00, 1.00, 0.00, 0.00, 0.00, 0.00, 2.00, '2025-04-14 01:18:33.920', '2025-04-14 01:18:17.416', NULL, '1', '', '1', '2025-04-29 05:44:00.874', 1);
INSERT INTO `amount_bill` VALUES (2, 22549.85, 723.00, 57969.00, 6900.00, 5065.47, 81.81, 93289.13, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', NULL, '2-3月份水电费', '', '锐锋鞋材', '2025-04-26 07:30:42.341', 1);

-- ----------------------------
-- Table structure for api_log
-- ----------------------------
DROP TABLE IF EXISTS `api_log`;
CREATE TABLE `api_log`  (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `method` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `referer_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `request_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`log_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 770 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of api_log
-- ----------------------------
INSERT INTO `api_log` VALUES (1, 'PUT', NULL, '/api/access/car/1', '', 'vben', '2025-04-24 07:04:08.480', '2025-04-24 07:04:08.481', '2025-04-24 07:04:08.481');
INSERT INTO `api_log` VALUES (2, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 07:19:08.337', '2025-04-24 07:19:08.338', '2025-04-24 07:19:08.338');
INSERT INTO `api_log` VALUES (3, 'PUT', NULL, '/api/access/car/1', '', 'vben', '2025-04-24 07:27:54.732', '2025-04-24 07:27:54.733', '2025-04-24 07:27:54.733');
INSERT INTO `api_log` VALUES (4, 'POST', NULL, '/api/auth/logout', '', 'guest', '2025-04-24 07:38:14.501', '2025-04-24 07:38:14.503', '2025-04-24 07:38:14.503');
INSERT INTO `api_log` VALUES (5, 'PUT', NULL, '/api/access/car/1', '', 'vben', '2025-04-24 08:21:36.089', '2025-04-24 08:21:36.090', '2025-04-24 08:21:36.090');
INSERT INTO `api_log` VALUES (6, 'PUT', NULL, '/api/access/car/1', '', 'vben', '2025-04-24 08:22:03.096', '2025-04-24 08:22:03.097', '2025-04-24 08:22:03.097');
INSERT INTO `api_log` VALUES (7, 'POST', NULL, '/api/access/car', '', 'vben', '2025-04-24 08:22:13.760', '2025-04-24 08:22:13.761', '2025-04-24 08:22:13.761');
INSERT INTO `api_log` VALUES (8, 'POST', NULL, '/api/auth/logout', '', 'guest', '2025-04-24 09:35:54.240', '2025-04-24 09:35:54.242', '2025-04-24 09:35:54.242');
INSERT INTO `api_log` VALUES (9, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:39:15.810', '2025-04-24 09:39:15.811', '2025-04-24 09:39:15.811');
INSERT INTO `api_log` VALUES (10, 'POST', NULL, '/api/auth/logout', '', 'guest', '2025-04-24 09:39:20.835', '2025-04-24 09:39:20.837', '2025-04-24 09:39:20.837');
INSERT INTO `api_log` VALUES (11, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:39:26.722', '2025-04-24 09:39:26.723', '2025-04-24 09:39:26.723');
INSERT INTO `api_log` VALUES (12, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:40:13.562', '2025-04-24 09:40:13.563', '2025-04-24 09:40:13.563');
INSERT INTO `api_log` VALUES (13, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:40:37.887', '2025-04-24 09:40:37.887', '2025-04-24 09:40:37.887');
INSERT INTO `api_log` VALUES (14, 'POST', NULL, '/api/auth/logout', '', 'guest', '2025-04-24 09:40:41.838', '2025-04-24 09:40:41.838', '2025-04-24 09:40:41.838');
INSERT INTO `api_log` VALUES (15, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:40:50.337', '2025-04-24 09:40:50.338', '2025-04-24 09:40:50.338');
INSERT INTO `api_log` VALUES (16, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:40:52.927', '2025-04-24 09:40:52.928', '2025-04-24 09:40:52.928');
INSERT INTO `api_log` VALUES (17, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:41:04.259', '2025-04-24 09:41:04.259', '2025-04-24 09:41:04.259');
INSERT INTO `api_log` VALUES (18, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:44:35.500', '2025-04-24 09:44:35.501', '2025-04-24 09:44:35.501');
INSERT INTO `api_log` VALUES (19, 'POST', NULL, '/api/auth/logout', '', 'guest', '2025-04-24 09:50:48.501', '2025-04-24 09:50:48.502', '2025-04-24 09:50:48.502');
INSERT INTO `api_log` VALUES (20, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:51:06.406', '2025-04-24 09:51:06.407', '2025-04-24 09:51:06.407');
INSERT INTO `api_log` VALUES (21, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:51:34.589', '2025-04-24 09:51:34.590', '2025-04-24 09:51:34.590');
INSERT INTO `api_log` VALUES (22, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:51:51.072', '2025-04-24 09:51:51.073', '2025-04-24 09:51:51.073');
INSERT INTO `api_log` VALUES (23, 'POST', NULL, '/api/auth/logout', '', 'guest', '2025-04-24 09:54:15.590', '2025-04-24 09:54:15.591', '2025-04-24 09:54:15.591');
INSERT INTO `api_log` VALUES (24, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-24 09:54:26.970', '2025-04-24 09:54:26.970', '2025-04-24 09:54:26.970');
INSERT INTO `api_log` VALUES (25, 'POST', NULL, '/api/auth/logout', '', 'guest', '2025-04-24 09:57:06.316', '2025-04-24 09:57:06.317', '2025-04-24 09:57:06.317');
INSERT INTO `api_log` VALUES (26, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-24 10:16:09.225', '2025-04-24 10:16:09.227', '2025-04-24 10:16:09.227');
INSERT INTO `api_log` VALUES (27, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-24 10:17:08.145', '2025-04-24 10:17:08.146', '2025-04-24 10:17:08.146');
INSERT INTO `api_log` VALUES (28, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-24 10:18:28.340', '2025-04-24 10:18:28.341', '2025-04-24 10:18:28.341');
INSERT INTO `api_log` VALUES (29, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-24 10:20:46.659', '2025-04-24 10:20:46.660', '2025-04-24 10:20:46.660');
INSERT INTO `api_log` VALUES (30, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-24 10:24:30.141', '2025-04-24 10:24:30.142', '2025-04-24 10:24:30.142');
INSERT INTO `api_log` VALUES (31, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-24 10:24:58.744', '2025-04-24 10:24:58.745', '2025-04-24 10:24:58.745');
INSERT INTO `api_log` VALUES (32, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-24 10:28:02.097', '2025-04-24 10:28:02.098', '2025-04-24 10:28:02.098');
INSERT INTO `api_log` VALUES (33, 'POST', NULL, '/api/system/park/upload', '', 'vben', '2025-04-25 01:01:58.273', '2025-04-25 01:01:58.275', '2025-04-25 01:01:58.275');
INSERT INTO `api_log` VALUES (34, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 01:02:22.635', '2025-04-25 01:02:22.637', '2025-04-25 01:02:22.637');
INSERT INTO `api_log` VALUES (35, 'POST', NULL, '/api/system/park/upload', '', 'vben', '2025-04-25 01:09:14.344', '2025-04-25 01:09:14.346', '2025-04-25 01:09:14.346');
INSERT INTO `api_log` VALUES (36, 'PUT', NULL, '/api/system/park/1', '', 'vben', '2025-04-25 01:09:18.675', '2025-04-25 01:09:18.676', '2025-04-25 01:09:18.676');
INSERT INTO `api_log` VALUES (37, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 01:13:53.766', '2025-04-25 01:13:53.767', '2025-04-25 01:13:53.767');
INSERT INTO `api_log` VALUES (38, 'POST', NULL, '/api/auth/login', '', 'guest', '2025-04-25 01:28:47.856', '2025-04-25 01:28:47.857', '2025-04-25 01:28:47.857');
INSERT INTO `api_log` VALUES (39, 'POST', NULL, '/api/access/visitor', '', 'vben', '2025-04-25 01:57:10.666', '2025-04-25 01:57:10.667', '2025-04-25 01:57:10.667');
INSERT INTO `api_log` VALUES (40, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:02:19.971', '2025-04-25 02:02:19.973', '2025-04-25 02:02:19.973');
INSERT INTO `api_log` VALUES (41, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:02:33.120', '2025-04-25 02:02:33.121', '2025-04-25 02:02:33.121');
INSERT INTO `api_log` VALUES (42, 'POST', NULL, '/api/system/park/upload', '', 'vben', '2025-04-25 02:03:03.652', '2025-04-25 02:03:03.653', '2025-04-25 02:03:03.653');
INSERT INTO `api_log` VALUES (43, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:03:07.086', '2025-04-25 02:03:07.088', '2025-04-25 02:03:07.088');
INSERT INTO `api_log` VALUES (44, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:03:26.550', '2025-04-25 02:03:26.551', '2025-04-25 02:03:26.551');
INSERT INTO `api_log` VALUES (45, 'POST', NULL, '/api/system/park/upload', '', 'vben', '2025-04-25 02:09:21.342', '2025-04-25 02:09:21.344', '2025-04-25 02:09:21.344');
INSERT INTO `api_log` VALUES (46, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:09:24.467', '2025-04-25 02:09:24.468', '2025-04-25 02:09:24.468');
INSERT INTO `api_log` VALUES (47, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:09:50.812', '2025-04-25 02:09:50.813', '2025-04-25 02:09:50.813');
INSERT INTO `api_log` VALUES (48, 'POST', NULL, '/api/system/park/upload', '', 'vben', '2025-04-25 02:10:16.308', '2025-04-25 02:10:16.309', '2025-04-25 02:10:16.309');
INSERT INTO `api_log` VALUES (49, 'PUT', NULL, '/api/system/park/1', '', 'vben', '2025-04-25 02:10:20.630', '2025-04-25 02:10:20.631', '2025-04-25 02:10:20.631');
INSERT INTO `api_log` VALUES (50, 'PUT', NULL, '/api/system/park/1', '', 'vben', '2025-04-25 02:10:29.455', '2025-04-25 02:10:29.456', '2025-04-25 02:10:29.456');
INSERT INTO `api_log` VALUES (51, 'PUT', NULL, '/api/system/park/1', '', 'vben', '2025-04-25 02:10:53.790', '2025-04-25 02:10:53.791', '2025-04-25 02:10:53.791');
INSERT INTO `api_log` VALUES (52, 'POST', NULL, '/api/system/park/upload', '', 'vben', '2025-04-25 02:16:15.211', '2025-04-25 02:16:15.212', '2025-04-25 02:16:15.212');
INSERT INTO `api_log` VALUES (53, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:16:22.586', '2025-04-25 02:16:22.587', '2025-04-25 02:16:22.587');
INSERT INTO `api_log` VALUES (54, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:16:39.101', '2025-04-25 02:16:39.102', '2025-04-25 02:16:39.102');
INSERT INTO `api_log` VALUES (55, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:17:54.820', '2025-04-25 02:17:54.821', '2025-04-25 02:17:54.821');
INSERT INTO `api_log` VALUES (56, 'POST', NULL, '/api/system/park/upload', '', 'vben', '2025-04-25 02:24:59.631', '2025-04-25 02:24:59.632', '2025-04-25 02:24:59.632');
INSERT INTO `api_log` VALUES (57, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:25:03.436', '2025-04-25 02:25:03.437', '2025-04-25 02:25:03.437');
INSERT INTO `api_log` VALUES (58, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:25:19.209', '2025-04-25 02:25:19.210', '2025-04-25 02:25:19.210');
INSERT INTO `api_log` VALUES (59, 'POST', NULL, '/api/system/park/upload', '', 'vben', '2025-04-25 02:25:57.110', '2025-04-25 02:25:57.111', '2025-04-25 02:25:57.111');
INSERT INTO `api_log` VALUES (60, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:26:00.247', '2025-04-25 02:26:00.249', '2025-04-25 02:26:00.249');
INSERT INTO `api_log` VALUES (61, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:26:13.665', '2025-04-25 02:26:13.667', '2025-04-25 02:26:13.667');
INSERT INTO `api_log` VALUES (62, 'POST', NULL, '/api/system/park/upload', '', 'vben', '2025-04-25 02:26:47.267', '2025-04-25 02:26:47.268', '2025-04-25 02:26:47.268');
INSERT INTO `api_log` VALUES (63, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:26:50.089', '2025-04-25 02:26:50.090', '2025-04-25 02:26:50.090');
INSERT INTO `api_log` VALUES (64, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:28:31.836', '2025-04-25 02:28:31.837', '2025-04-25 02:28:31.837');
INSERT INTO `api_log` VALUES (65, 'POST', NULL, '/api/system/park/upload', '', 'vben', '2025-04-25 02:34:53.171', '2025-04-25 02:34:53.172', '2025-04-25 02:34:53.172');
INSERT INTO `api_log` VALUES (66, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:34:55.574', '2025-04-25 02:34:55.575', '2025-04-25 02:34:55.575');
INSERT INTO `api_log` VALUES (67, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:36:16.898', '2025-04-25 02:36:16.899', '2025-04-25 02:36:16.899');
INSERT INTO `api_log` VALUES (68, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:36:41.010', '2025-04-25 02:36:41.011', '2025-04-25 02:36:41.011');
INSERT INTO `api_log` VALUES (69, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:43:10.582', '2025-04-25 02:43:10.583', '2025-04-25 02:43:10.583');
INSERT INTO `api_log` VALUES (70, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:44:19.260', '2025-04-25 02:44:19.261', '2025-04-25 02:44:19.261');
INSERT INTO `api_log` VALUES (71, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:45:06.198', '2025-04-25 02:45:06.199', '2025-04-25 02:45:06.199');
INSERT INTO `api_log` VALUES (72, 'PUT', NULL, '/api/finance/5', '', 'vben', '2025-04-25 02:45:39.775', '2025-04-25 02:45:39.777', '2025-04-25 02:45:39.777');
INSERT INTO `api_log` VALUES (73, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:47:10.951', '2025-04-25 02:47:10.953', '2025-04-25 02:47:10.953');
INSERT INTO `api_log` VALUES (74, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:48:07.504', '2025-04-25 02:48:07.506', '2025-04-25 02:48:07.506');
INSERT INTO `api_log` VALUES (75, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 02:49:19.199', '2025-04-25 02:49:19.200', '2025-04-25 02:49:19.200');
INSERT INTO `api_log` VALUES (76, 'PUT', NULL, '/api/finance/5', '', 'vben', '2025-04-25 02:49:43.375', '2025-04-25 02:49:43.377', '2025-04-25 02:49:43.377');
INSERT INTO `api_log` VALUES (77, 'PUT', NULL, '/api/finance/5', '', 'vben', '2025-04-25 02:50:45.088', '2025-04-25 02:50:45.089', '2025-04-25 02:50:45.089');
INSERT INTO `api_log` VALUES (78, 'PUT', NULL, '/api/finance/5', '', 'vben', '2025-04-25 02:51:05.162', '2025-04-25 02:51:05.163', '2025-04-25 02:51:05.163');
INSERT INTO `api_log` VALUES (79, 'PUT', NULL, '/api/finance/5', '', 'vben', '2025-04-25 02:52:09.369', '2025-04-25 02:52:09.370', '2025-04-25 02:52:09.370');
INSERT INTO `api_log` VALUES (80, 'POST', NULL, '/api/system/park', '', 'vben', '2025-04-25 03:11:34.607', '2025-04-25 03:11:34.608', '2025-04-25 03:11:34.608');
INSERT INTO `api_log` VALUES (81, 'PUT', NULL, '/api/finance/5', '', 'vben', '2025-04-25 03:32:40.375', '2025-04-25 03:32:40.377', '2025-04-25 03:32:40.377');
INSERT INTO `api_log` VALUES (82, 'PUT', NULL, '/api/finance/5', '', 'vben', '2025-04-25 03:40:41.217', '2025-04-25 03:40:41.219', '2025-04-25 03:40:41.219');
INSERT INTO `api_log` VALUES (83, 'PUT', NULL, '/api/finance/5', '', 'vben', '2025-04-25 03:44:09.786', '2025-04-25 03:44:09.787', '2025-04-25 03:44:09.787');
INSERT INTO `api_log` VALUES (84, 'PUT', NULL, '/api/finance/5', '', 'vben', '2025-04-25 03:45:31.942', '2025-04-25 03:45:31.944', '2025-04-25 03:45:31.944');
INSERT INTO `api_log` VALUES (85, 'PUT', NULL, '/api/finance/5', '', 'vben', '2025-04-25 03:46:17.143', '2025-04-25 03:46:17.144', '2025-04-25 03:46:17.144');
INSERT INTO `api_log` VALUES (86, 'POST', NULL, '/api/finance', '', 'vben', '2025-04-25 03:52:49.381', '2025-04-25 03:52:49.382', '2025-04-25 03:52:49.382');
INSERT INTO `api_log` VALUES (87, 'PUT', NULL, '/api/finance/7', '', 'vben', '2025-04-25 04:00:00.021', '2025-04-25 04:00:00.022', '2025-04-25 04:00:00.022');
INSERT INTO `api_log` VALUES (88, 'PUT', NULL, '/api/finance/7', '', 'vben', '2025-04-25 04:00:23.948', '2025-04-25 04:00:23.950', '2025-04-25 04:00:23.950');
INSERT INTO `api_log` VALUES (89, 'POST', NULL, '/api/image/upload', '', 'vben', '2025-04-25 05:25:09.172', '2025-04-25 05:25:09.173', '2025-04-25 05:25:09.173');
INSERT INTO `api_log` VALUES (90, 'POST', NULL, '/api/image/upload', '', 'vben', '2025-04-25 05:25:19.808', '2025-04-25 05:25:19.809', '2025-04-25 05:25:19.809');
INSERT INTO `api_log` VALUES (91, 'POST', NULL, '/api/image/upload', '', 'vben', '2025-04-25 05:44:24.383', '2025-04-25 05:44:24.384', '2025-04-25 05:44:24.384');
INSERT INTO `api_log` VALUES (92, 'PUT', NULL, '/api/system/park/1', '', 'vben', '2025-04-25 06:06:10.544', '2025-04-25 06:06:10.546', '2025-04-25 06:06:10.546');
INSERT INTO `api_log` VALUES (93, 'PUT', NULL, '/api/rental/tenant/84', '', 'vben', '2025-04-25 06:06:45.510', '2025-04-25 06:06:45.512', '2025-04-25 06:06:45.512');
INSERT INTO `api_log` VALUES (94, 'PUT', NULL, '/api/finance/7', '', 'vben', '2025-04-25 06:07:44.554', '2025-04-25 06:07:44.555', '2025-04-25 06:07:44.555');
INSERT INTO `api_log` VALUES (95, 'PUT', NULL, '/api/investment', '', 'vben', '2025-04-25 06:07:59.000', '2025-04-25 06:07:59.001', '2025-04-25 06:07:59.001');
INSERT INTO `api_log` VALUES (96, 'PUT', NULL, '/api/access/car/2', '', 'vben', '2025-04-25 06:08:28.154', '2025-04-25 06:08:28.155', '2025-04-25 06:08:28.155');
INSERT INTO `api_log` VALUES (97, 'PUT', NULL, '/api/access/visitor/15', '', 'vben', '2025-04-25 06:08:34.934', '2025-04-25 06:08:34.935', '2025-04-25 06:08:34.935');
INSERT INTO `api_log` VALUES (98, 'PUT', NULL, '/api/maintenance/firefighting/1001', '', 'vben', '2025-04-25 06:08:58.766', '2025-04-25 06:08:58.767', '2025-04-25 06:08:58.767');
INSERT INTO `api_log` VALUES (99, 'PUT', NULL, '/api/maintenance/firefighting/1001', '', 'vben', '2025-04-25 06:18:28.436', '2025-04-25 06:18:28.438', '2025-04-25 06:18:28.438');
INSERT INTO `api_log` VALUES (100, 'PUT', NULL, '/api/maintenance/transformer/776', '', 'vben', '2025-04-25 06:28:28.286', '2025-04-25 06:28:28.288', '2025-04-25 06:28:28.288');
INSERT INTO `api_log` VALUES (101, 'PUT', NULL, '/api/system/menu/16', '', 'vben', '2025-04-25 06:28:44.599', '2025-04-25 06:28:44.601', '2025-04-25 06:28:44.601');
INSERT INTO `api_log` VALUES (102, 'PUT', NULL, '/api/system/park/3', '', 'vben', '2025-04-25 06:29:21.822', '2025-04-25 06:29:21.823', '2025-04-25 06:29:21.823');
INSERT INTO `api_log` VALUES (103, 'PUT', NULL, '/api/finance/7', '', 'vben', '2025-04-25 06:38:20.801', '2025-04-25 06:38:20.802', '2025-04-25 06:38:20.802');
INSERT INTO `api_log` VALUES (104, 'POST', NULL, '/api/image/upload', '', 'vben', '2025-04-25 06:49:09.971', '2025-04-25 06:49:09.972', '2025-04-25 06:49:09.972');
INSERT INTO `api_log` VALUES (105, 'POST', NULL, '/api/image/upload', '', 'vben', '2025-04-25 06:49:22.856', '2025-04-25 06:49:22.857', '2025-04-25 06:49:22.857');
INSERT INTO `api_log` VALUES (106, 'POST', NULL, '/api/image/upload', '', 'vben', '2025-04-25 06:49:36.703', '2025-04-25 06:49:36.704', '2025-04-25 06:49:36.704');
INSERT INTO `api_log` VALUES (107, 'POST', NULL, '/api/image/upload', NULL, 'vben', '2025-04-25 06:56:37.022', '2025-04-25 06:56:37.023', '2025-04-25 06:56:37.023');
INSERT INTO `api_log` VALUES (108, 'POST', NULL, '/api/image/upload', NULL, 'vben', '2025-04-25 06:56:55.425', '2025-04-25 06:56:55.426', '2025-04-25 06:56:55.426');
INSERT INTO `api_log` VALUES (109, 'PUT', NULL, '/api/finance/7', '111', 'vben', '2025-04-25 06:58:02.043', '2025-04-25 06:58:02.045', '2025-04-25 06:58:02.045');
INSERT INTO `api_log` VALUES (110, 'POST', NULL, '/api/image/upload', NULL, 'vben', '2025-04-25 07:20:35.706', '2025-04-25 07:20:35.707', '2025-04-25 07:20:35.707');
INSERT INTO `api_log` VALUES (111, 'POST', NULL, '/api/image/upload', NULL, 'vben', '2025-04-25 07:20:35.706', '2025-04-25 07:20:35.708', '2025-04-25 07:20:35.708');
INSERT INTO `api_log` VALUES (112, 'POST', NULL, '/api/image/upload', NULL, 'vben', '2025-04-25 07:20:35.740', '2025-04-25 07:20:35.741', '2025-04-25 07:20:35.741');
INSERT INTO `api_log` VALUES (113, 'POST', NULL, '/api/image/upload', NULL, 'vben', '2025-04-25 07:20:54.017', '2025-04-25 07:20:54.019', '2025-04-25 07:20:54.019');
INSERT INTO `api_log` VALUES (114, 'PUT', NULL, '/api/finance/7', '111', 'vben', '2025-04-25 07:24:36.197', '2025-04-25 07:24:36.199', '2025-04-25 07:24:36.199');
INSERT INTO `api_log` VALUES (115, 'PUT', NULL, '/api/finance/7', '111', 'vben', '2025-04-25 07:26:43.710', '2025-04-25 07:26:43.711', '2025-04-25 07:26:43.711');
INSERT INTO `api_log` VALUES (116, 'POST', NULL, '/api/image/upload', NULL, 'vben', '2025-04-25 07:26:49.836', '2025-04-25 07:26:49.837', '2025-04-25 07:26:49.837');
INSERT INTO `api_log` VALUES (117, 'PUT', NULL, '/api/system/park/3', NULL, 'vben', '2025-04-25 07:26:53.687', '2025-04-25 07:26:53.688', '2025-04-25 07:26:53.688');
INSERT INTO `api_log` VALUES (118, 'PUT', NULL, '/api/system/park/3', NULL, 'vben', '2025-04-25 07:27:01.327', '2025-04-25 07:27:01.329', '2025-04-25 07:27:01.329');
INSERT INTO `api_log` VALUES (119, 'PUT', NULL, '/api/finance/7', '111', 'vben', '2025-04-25 07:27:49.391', '2025-04-25 07:27:49.392', '2025-04-25 07:27:49.392');
INSERT INTO `api_log` VALUES (120, 'PUT', NULL, '/api/system/park/3', NULL, 'vben', '2025-04-25 07:28:43.717', '2025-04-25 07:28:43.718', '2025-04-25 07:28:43.718');
INSERT INTO `api_log` VALUES (121, 'PUT', NULL, '/api/system/park/3', NULL, 'vben', '2025-04-25 07:28:56.994', '2025-04-25 07:28:56.995', '2025-04-25 07:28:56.995');
INSERT INTO `api_log` VALUES (122, 'PUT', NULL, '/api/system/park/3', NULL, 'vben', '2025-04-25 07:34:20.695', '2025-04-25 07:34:20.696', '2025-04-25 07:34:20.696');
INSERT INTO `api_log` VALUES (123, 'PUT', NULL, '/api/system/park/3', NULL, 'vben', '2025-04-25 07:39:12.838', '2025-04-25 07:39:12.840', '2025-04-25 07:39:12.840');
INSERT INTO `api_log` VALUES (124, 'POST', NULL, '/api/image/upload', NULL, 'vben', '2025-04-25 07:39:31.842', '2025-04-25 07:39:31.844', '2025-04-25 07:39:31.844');
INSERT INTO `api_log` VALUES (125, 'PUT', NULL, '/api/system/park/3', NULL, 'vben', '2025-04-25 07:39:34.211', '2025-04-25 07:39:34.213', '2025-04-25 07:39:34.213');
INSERT INTO `api_log` VALUES (126, 'PUT', NULL, '/api/finance/7', '111', 'vben', '2025-04-25 07:40:12.147', '2025-04-25 07:40:12.148', '2025-04-25 07:40:12.148');
INSERT INTO `api_log` VALUES (127, 'PUT', NULL, '/finance/manage', '111', 'vben', '2025-04-25 07:46:30.751', '2025-04-25 07:46:30.752', '2025-04-25 07:46:30.752');
INSERT INTO `api_log` VALUES (128, 'PUT', NULL, '/finance/manage', '111', 'vben', '2025-04-25 07:56:06.045', '2025-04-25 07:56:06.046', '2025-04-25 07:56:06.046');
INSERT INTO `api_log` VALUES (129, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:10:35.108', '2025-04-25 08:10:35.122', '2025-04-25 08:10:35.122');
INSERT INTO `api_log` VALUES (130, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:12:53.273', '2025-04-25 08:12:53.276', '2025-04-25 08:12:53.276');
INSERT INTO `api_log` VALUES (131, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:13:38.032', '2025-04-25 08:13:38.038', '2025-04-25 08:13:38.038');
INSERT INTO `api_log` VALUES (132, 'PUT', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:13:45.817', '2025-04-25 08:13:45.819', '2025-04-25 08:13:45.819');
INSERT INTO `api_log` VALUES (133, 'PUT', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:15:21.585', '2025-04-25 08:15:21.586', '2025-04-25 08:15:21.586');
INSERT INTO `api_log` VALUES (134, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:15:27.597', '2025-04-25 08:15:27.603', '2025-04-25 08:15:27.603');
INSERT INTO `api_log` VALUES (135, 'PUT', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:15:29.991', '2025-04-25 08:15:29.992', '2025-04-25 08:15:29.992');
INSERT INTO `api_log` VALUES (136, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:19:11.461', '2025-04-25 08:19:11.467', '2025-04-25 08:19:11.467');
INSERT INTO `api_log` VALUES (137, 'PUT', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:19:13.596', '2025-04-25 08:19:13.597', '2025-04-25 08:19:13.597');
INSERT INTO `api_log` VALUES (138, 'PUT', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:19:52.859', '2025-04-25 08:19:52.860', '2025-04-25 08:19:52.860');
INSERT INTO `api_log` VALUES (139, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:20:18.152', '2025-04-25 08:20:18.155', '2025-04-25 08:20:18.155');
INSERT INTO `api_log` VALUES (140, 'PUT', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:20:22.149', '2025-04-25 08:20:22.150', '2025-04-25 08:20:22.150');
INSERT INTO `api_log` VALUES (141, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:26:54.970', '2025-04-25 08:26:54.975', '2025-04-25 08:26:54.975');
INSERT INTO `api_log` VALUES (142, 'PUT', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:26:57.135', '2025-04-25 08:26:57.136', '2025-04-25 08:26:57.136');
INSERT INTO `api_log` VALUES (143, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:30:58.179', '2025-04-25 08:30:58.182', '2025-04-25 08:30:58.182');
INSERT INTO `api_log` VALUES (144, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:33:32.179', '2025-04-25 08:33:32.181', '2025-04-25 08:33:32.181');
INSERT INTO `api_log` VALUES (145, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:34:43.912', '2025-04-25 08:34:43.914', '2025-04-25 08:34:43.914');
INSERT INTO `api_log` VALUES (146, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:36:47.668', '2025-04-25 08:36:47.671', '2025-04-25 08:36:47.671');
INSERT INTO `api_log` VALUES (147, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:37:03.119', '2025-04-25 08:37:03.122', '2025-04-25 08:37:03.122');
INSERT INTO `api_log` VALUES (148, 'PUT', NULL, '/rental/manage/', '', 'vben', '2025-04-25 08:41:56.853', '2025-04-25 08:41:56.854', '2025-04-25 08:41:56.854');
INSERT INTO `api_log` VALUES (149, 'PUT', NULL, '/audit', '', 'vben', '2025-04-25 08:43:23.988', '2025-04-25 08:43:23.989', '2025-04-25 08:43:23.989');
INSERT INTO `api_log` VALUES (150, 'PUT', NULL, '/audit', '', 'vben', '2025-04-25 08:43:31.831', '2025-04-25 08:43:31.832', '2025-04-25 08:43:31.832');
INSERT INTO `api_log` VALUES (151, 'PUT', NULL, '/audit', '', 'vben', '2025-04-25 08:43:36.100', '2025-04-25 08:43:36.101', '2025-04-25 08:43:36.101');
INSERT INTO `api_log` VALUES (152, 'PUT', NULL, '/audit', '', 'vben', '2025-04-25 08:43:38.887', '2025-04-25 08:43:38.889', '2025-04-25 08:43:38.889');
INSERT INTO `api_log` VALUES (153, 'PUT', NULL, '/audit', '', 'vben', '2025-04-25 08:43:52.321', '2025-04-25 08:43:52.322', '2025-04-25 08:43:52.322');
INSERT INTO `api_log` VALUES (154, 'PUT', NULL, '/audit', '', 'vben', '2025-04-25 08:43:57.862', '2025-04-25 08:43:57.864', '2025-04-25 08:43:57.864');
INSERT INTO `api_log` VALUES (155, 'PUT', NULL, '/audit', '', 'vben', '2025-04-25 08:53:24.765', '2025-04-25 08:53:24.766', '2025-04-25 08:53:24.766');
INSERT INTO `api_log` VALUES (156, 'POST', NULL, '/rental/manage/', '', 'vben', '2025-04-25 09:04:45.933', '2025-04-25 09:04:45.939', '2025-04-25 09:04:45.939');
INSERT INTO `api_log` VALUES (157, 'POST', NULL, '/reimbursement/application', 'vben', 'vben', '2025-04-25 09:05:42.645', '2025-04-25 09:05:42.646', '2025-04-25 09:05:42.646');
INSERT INTO `api_log` VALUES (158, 'PUT', NULL, '/audit', '', 'vben', '2025-04-25 09:05:53.864', '2025-04-25 09:05:53.865', '2025-04-25 09:05:53.865');
INSERT INTO `api_log` VALUES (159, 'PUT', '/api/system/park/1', '/rental/manage/', '', 'vben', '2025-04-25 09:17:38.001', '2025-04-25 09:17:38.002', '2025-04-25 09:17:38.002');
INSERT INTO `api_log` VALUES (160, 'POST', '/api/reimbursement', '/reimbursement/application', 'vben', 'vben', '2025-04-25 09:53:17.314', '2025-04-25 09:53:17.316', '2025-04-25 09:53:17.316');
INSERT INTO `api_log` VALUES (161, 'PUT', NULL, '/rental/manage/', '', 'vben', '2025-04-25 09:55:34.057', '2025-04-25 09:55:34.058', '2025-04-25 09:55:34.058');
INSERT INTO `api_log` VALUES (162, 'PUT', NULL, '/rental/manage/', '', 'vben', '2025-04-25 09:55:51.203', '2025-04-25 09:55:51.204', '2025-04-25 09:55:51.204');
INSERT INTO `api_log` VALUES (163, 'POST', '/api/reimbursement', '/reimbursement/application', '1', 'vben', '2025-04-25 09:57:18.178', '2025-04-25 09:57:18.179', '2025-04-25 09:57:18.179');
INSERT INTO `api_log` VALUES (164, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-26 02:39:29.460', '2025-04-26 02:39:29.461', '2025-04-26 02:39:29.461');
INSERT INTO `api_log` VALUES (165, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-26 02:42:28.404', '2025-04-26 02:42:28.406', '2025-04-26 02:42:28.406');
INSERT INTO `api_log` VALUES (166, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-26 02:42:44.012', '2025-04-26 02:42:44.013', '2025-04-26 02:42:44.013');
INSERT INTO `api_log` VALUES (167, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-26 02:56:28.614', '2025-04-26 02:56:28.615', '2025-04-26 02:56:28.615');
INSERT INTO `api_log` VALUES (168, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-26 03:20:21.171', '2025-04-26 03:20:21.172', '2025-04-26 03:20:21.172');
INSERT INTO `api_log` VALUES (169, 'PUT', '/api/system/park/1', '/rental/manage/', '', 'vben', '2025-04-26 03:20:36.934', '2025-04-26 03:20:36.936', '2025-04-26 03:20:36.936');
INSERT INTO `api_log` VALUES (170, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 03:38:50.154', '2025-04-26 03:38:50.156', '2025-04-26 03:38:50.156');
INSERT INTO `api_log` VALUES (171, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 03:39:22.867', '2025-04-26 03:39:22.868', '2025-04-26 03:39:22.868');
INSERT INTO `api_log` VALUES (172, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 03:39:33.695', '2025-04-26 03:39:33.697', '2025-04-26 03:39:33.697');
INSERT INTO `api_log` VALUES (173, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 03:39:40.712', '2025-04-26 03:39:40.714', '2025-04-26 03:39:40.714');
INSERT INTO `api_log` VALUES (174, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 03:39:44.799', '2025-04-26 03:39:44.800', '2025-04-26 03:39:44.800');
INSERT INTO `api_log` VALUES (175, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 03:41:03.609', '2025-04-26 03:41:03.610', '2025-04-26 03:41:03.610');
INSERT INTO `api_log` VALUES (176, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 03:41:07.128', '2025-04-26 03:41:07.129', '2025-04-26 03:41:07.129');
INSERT INTO `api_log` VALUES (177, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 03:42:15.394', '2025-04-26 03:42:15.394', '2025-04-26 03:42:15.394');
INSERT INTO `api_log` VALUES (178, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 03:42:20.690', '2025-04-26 03:42:20.691', '2025-04-26 03:42:20.691');
INSERT INTO `api_log` VALUES (179, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-26 03:42:34.152', '2025-04-26 03:42:34.153', '2025-04-26 03:42:34.153');
INSERT INTO `api_log` VALUES (180, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-26 03:42:39.620', '2025-04-26 03:42:39.620', '2025-04-26 03:42:39.620');
INSERT INTO `api_log` VALUES (181, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 03:42:45.449', '2025-04-26 03:42:45.450', '2025-04-26 03:42:45.450');
INSERT INTO `api_log` VALUES (182, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 03:42:47.127', '2025-04-26 03:42:47.128', '2025-04-26 03:42:47.128');
INSERT INTO `api_log` VALUES (183, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 03:42:48.385', '2025-04-26 03:42:48.386', '2025-04-26 03:42:48.386');
INSERT INTO `api_log` VALUES (184, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-26 03:43:35.273', '2025-04-26 03:43:35.274', '2025-04-26 03:43:35.274');
INSERT INTO `api_log` VALUES (185, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-26 03:43:36.769', '2025-04-26 03:43:36.770', '2025-04-26 03:43:36.770');
INSERT INTO `api_log` VALUES (186, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 03:44:53.317', '2025-04-26 03:44:53.319', '2025-04-26 03:44:53.319');
INSERT INTO `api_log` VALUES (187, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 03:45:52.239', '2025-04-26 03:45:52.240', '2025-04-26 03:45:52.240');
INSERT INTO `api_log` VALUES (188, 'PUT', '/api/factory/undefined', '/rental/manage/', '31', 'vben', '2025-04-26 03:56:30.714', '2025-04-26 03:56:30.716', '2025-04-26 03:56:30.716');
INSERT INTO `api_log` VALUES (189, 'PUT', '/api/factory/3', '/rental/manage/', 'Fu An', 'vben', '2025-04-26 05:34:31.711', '2025-04-26 05:34:31.711', '2025-04-26 05:34:31.711');
INSERT INTO `api_log` VALUES (190, 'PUT', '/api/factory/undefined', '/rental/manage/', '31', 'vben', '2025-04-26 05:34:43.771', '2025-04-26 05:34:43.772', '2025-04-26 05:34:43.772');
INSERT INTO `api_log` VALUES (191, 'POST', '/api/factory', '/rental/manage/', '213', 'vben', '2025-04-26 05:35:02.398', '2025-04-26 05:35:02.399', '2025-04-26 05:35:02.399');
INSERT INTO `api_log` VALUES (192, 'POST', '/api/factory', '/rental/manage/', '31', 'vben', '2025-04-26 05:36:01.648', '2025-04-26 05:36:01.650', '2025-04-26 05:36:01.650');
INSERT INTO `api_log` VALUES (193, 'POST', '/api/factory', '/rental/manage/', '213', 'vben', '2025-04-26 05:42:32.274', '2025-04-26 05:42:32.275', '2025-04-26 05:42:32.275');
INSERT INTO `api_log` VALUES (194, 'PUT', '/api/factory/3', '/rental/manage/', 'Fu An', 'vben', '2025-04-26 05:43:41.386', '2025-04-26 05:43:41.387', '2025-04-26 05:43:41.387');
INSERT INTO `api_log` VALUES (195, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-26 05:43:57.392', '2025-04-26 05:43:57.393', '2025-04-26 05:43:57.393');
INSERT INTO `api_log` VALUES (196, 'POST', '/api/factory', '/rental/manage/', '132', 'vben', '2025-04-26 05:49:32.610', '2025-04-26 05:49:32.612', '2025-04-26 05:49:32.612');
INSERT INTO `api_log` VALUES (197, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 05:51:50.752', '2025-04-26 05:51:50.753', '2025-04-26 05:51:50.753');
INSERT INTO `api_log` VALUES (198, 'POST', '/api/factory', '/rental/manage/', '312', 'vben', '2025-04-26 05:52:19.108', '2025-04-26 05:52:19.109', '2025-04-26 05:52:19.109');
INSERT INTO `api_log` VALUES (199, 'POST', '/api/factory', '/rental/manage/', '123', 'vben', '2025-04-26 05:52:35.708', '2025-04-26 05:52:35.709', '2025-04-26 05:52:35.709');
INSERT INTO `api_log` VALUES (200, 'PUT', '/api/factory/3', '/rental/manage/', 'Fu An', 'vben', '2025-04-26 05:53:17.509', '2025-04-26 05:53:17.510', '2025-04-26 05:53:17.510');
INSERT INTO `api_log` VALUES (201, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 05:53:25.384', '2025-04-26 05:53:25.385', '2025-04-26 05:53:25.385');
INSERT INTO `api_log` VALUES (202, 'POST', '/api/factory', '/rental/manage/', '123', 'vben', '2025-04-26 05:54:38.205', '2025-04-26 05:54:38.206', '2025-04-26 05:54:38.206');
INSERT INTO `api_log` VALUES (203, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 05:55:08.851', '2025-04-26 05:55:08.852', '2025-04-26 05:55:08.852');
INSERT INTO `api_log` VALUES (204, 'POST', '/api/factory', '/rental/manage/', '312', 'vben', '2025-04-26 05:55:15.986', '2025-04-26 05:55:15.987', '2025-04-26 05:55:15.987');
INSERT INTO `api_log` VALUES (205, 'PUT', '/api/factory/3', '/rental/manage/', '312', 'vben', '2025-04-26 05:55:19.859', '2025-04-26 05:55:19.861', '2025-04-26 05:55:19.861');
INSERT INTO `api_log` VALUES (206, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 05:56:23.139', '2025-04-26 05:56:23.140', '2025-04-26 05:56:23.140');
INSERT INTO `api_log` VALUES (207, 'POST', '/api/factory', '/rental/manage/', '123', 'vben', '2025-04-26 05:59:05.102', '2025-04-26 05:59:05.104', '2025-04-26 05:59:05.104');
INSERT INTO `api_log` VALUES (208, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:03:41.308', '2025-04-26 06:03:41.310', '2025-04-26 06:03:41.310');
INSERT INTO `api_log` VALUES (209, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:04:23.541', '2025-04-26 06:04:23.542', '2025-04-26 06:04:23.542');
INSERT INTO `api_log` VALUES (210, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:05:01.876', '2025-04-26 06:05:01.877', '2025-04-26 06:05:01.877');
INSERT INTO `api_log` VALUES (211, 'DELETE', '/api/factory/117', '/rental/manage/', '', 'vben', '2025-04-26 06:05:02.620', '2025-04-26 06:05:02.621', '2025-04-26 06:05:02.621');
INSERT INTO `api_log` VALUES (212, 'DELETE', '/api/factory/116', '/rental/manage/', '', 'vben', '2025-04-26 06:05:04.738', '2025-04-26 06:05:04.739', '2025-04-26 06:05:04.739');
INSERT INTO `api_log` VALUES (213, 'DELETE', '/api/factory/115', '/rental/manage/', '', 'vben', '2025-04-26 06:05:05.778', '2025-04-26 06:05:05.779', '2025-04-26 06:05:05.779');
INSERT INTO `api_log` VALUES (214, 'DELETE', '/api/factory/114', '/rental/manage/', '', 'vben', '2025-04-26 06:06:20.150', '2025-04-26 06:06:20.151', '2025-04-26 06:06:20.151');
INSERT INTO `api_log` VALUES (215, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:06:28.521', '2025-04-26 06:06:28.522', '2025-04-26 06:06:28.522');
INSERT INTO `api_log` VALUES (216, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-26 06:06:36.952', '2025-04-26 06:06:36.952', '2025-04-26 06:06:36.952');
INSERT INTO `api_log` VALUES (217, 'PUT', '/api/factory/3', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-26 06:06:54.002', '2025-04-26 06:06:54.003', '2025-04-26 06:06:54.003');
INSERT INTO `api_log` VALUES (218, 'PUT', '/api/factory/112', '/rental/manage/', 'B栋建筑', 'vben', '2025-04-26 06:11:45.459', '2025-04-26 06:11:45.460', '2025-04-26 06:11:45.460');
INSERT INTO `api_log` VALUES (219, 'PUT', '/api/factory/118', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-26 06:12:04.019', '2025-04-26 06:12:04.020', '2025-04-26 06:12:04.020');
INSERT INTO `api_log` VALUES (220, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:17:55.721', '2025-04-26 06:17:55.722', '2025-04-26 06:17:55.722');
INSERT INTO `api_log` VALUES (221, 'POST', '/api/factory', '/rental/manage/', '1', 'vben', '2025-04-26 06:18:04.462', '2025-04-26 06:18:04.463', '2025-04-26 06:18:04.463');
INSERT INTO `api_log` VALUES (222, 'PUT', '/api/factory/119', '/rental/manage/', '1', 'vben', '2025-04-26 06:18:41.260', '2025-04-26 06:18:41.262', '2025-04-26 06:18:41.262');
INSERT INTO `api_log` VALUES (223, 'PUT', '/api/factory/119', '/rental/manage/', '1', 'vben', '2025-04-26 06:20:57.341', '2025-04-26 06:20:57.343', '2025-04-26 06:20:57.343');
INSERT INTO `api_log` VALUES (224, 'DELETE', '/api/factory/119', '/rental/manage/', '', 'vben', '2025-04-26 06:22:45.261', '2025-04-26 06:22:45.263', '2025-04-26 06:22:45.263');
INSERT INTO `api_log` VALUES (225, 'DELETE', '/api/access/visitor/11', '/access/visitor', '', 'vben', '2025-04-26 06:22:50.738', '2025-04-26 06:22:50.740', '2025-04-26 06:22:50.740');
INSERT INTO `api_log` VALUES (226, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:23:29.970', '2025-04-26 06:23:29.972', '2025-04-26 06:23:29.972');
INSERT INTO `api_log` VALUES (227, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:23:31.474', '2025-04-26 06:23:31.475', '2025-04-26 06:23:31.475');
INSERT INTO `api_log` VALUES (228, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:23:31.757', '2025-04-26 06:23:31.758', '2025-04-26 06:23:31.758');
INSERT INTO `api_log` VALUES (229, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:23:34.423', '2025-04-26 06:23:34.424', '2025-04-26 06:23:34.424');
INSERT INTO `api_log` VALUES (230, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-26 06:23:44.043', '2025-04-26 06:23:44.044', '2025-04-26 06:23:44.044');
INSERT INTO `api_log` VALUES (231, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:23:45.893', '2025-04-26 06:23:45.894', '2025-04-26 06:23:45.894');
INSERT INTO `api_log` VALUES (232, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:23:47.085', '2025-04-26 06:23:47.086', '2025-04-26 06:23:47.086');
INSERT INTO `api_log` VALUES (233, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:23:51.883', '2025-04-26 06:23:51.884', '2025-04-26 06:23:51.884');
INSERT INTO `api_log` VALUES (234, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:23:54.428', '2025-04-26 06:23:54.429', '2025-04-26 06:23:54.429');
INSERT INTO `api_log` VALUES (235, 'DELETE', '/api/access/visitor/13', '/access/visitor', '', 'vben', '2025-04-26 06:24:12.615', '2025-04-26 06:24:12.616', '2025-04-26 06:24:12.616');
INSERT INTO `api_log` VALUES (236, 'DELETE', '/api/access/visitor/12', '/access/visitor', '', 'vben', '2025-04-26 06:24:14.160', '2025-04-26 06:24:14.161', '2025-04-26 06:24:14.161');
INSERT INTO `api_log` VALUES (237, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:24:37.747', '2025-04-26 06:24:37.748', '2025-04-26 06:24:37.748');
INSERT INTO `api_log` VALUES (238, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:24:54.716', '2025-04-26 06:24:54.716', '2025-04-26 06:24:54.716');
INSERT INTO `api_log` VALUES (239, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:25:09.906', '2025-04-26 06:25:09.907', '2025-04-26 06:25:09.907');
INSERT INTO `api_log` VALUES (240, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:25:10.148', '2025-04-26 06:25:10.149', '2025-04-26 06:25:10.149');
INSERT INTO `api_log` VALUES (241, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:27:06.551', '2025-04-26 06:27:06.552', '2025-04-26 06:27:06.552');
INSERT INTO `api_log` VALUES (242, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-26 06:29:01.718', '2025-04-26 06:29:01.719', '2025-04-26 06:29:01.719');
INSERT INTO `api_log` VALUES (243, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:29:05.875', '2025-04-26 06:29:05.876', '2025-04-26 06:29:05.876');
INSERT INTO `api_log` VALUES (244, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:29:21.596', '2025-04-26 06:29:21.597', '2025-04-26 06:29:21.597');
INSERT INTO `api_log` VALUES (245, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 06:43:28.339', '2025-04-26 06:43:28.340', '2025-04-26 06:43:28.340');
INSERT INTO `api_log` VALUES (246, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-26 06:50:02.072', '2025-04-26 06:50:02.078', '2025-04-26 06:50:02.078');
INSERT INTO `api_log` VALUES (247, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-26 06:52:11.538', '2025-04-26 06:52:11.541', '2025-04-26 06:52:11.541');
INSERT INTO `api_log` VALUES (248, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-26 06:56:31.391', '2025-04-26 06:56:31.394', '2025-04-26 06:56:31.394');
INSERT INTO `api_log` VALUES (249, 'PUT', '/api/bill/amount', '/bill', '锐锋鞋材', 'vben', '2025-04-26 07:30:42.388', '2025-04-26 07:30:42.389', '2025-04-26 07:30:42.389');
INSERT INTO `api_log` VALUES (250, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:04:28.323', '2025-04-26 08:04:28.324', '2025-04-26 08:04:28.324');
INSERT INTO `api_log` VALUES (251, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:30:01.170', '2025-04-26 08:30:01.172', '2025-04-26 08:30:01.172');
INSERT INTO `api_log` VALUES (252, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:30:04.101', '2025-04-26 08:30:04.103', '2025-04-26 08:30:04.103');
INSERT INTO `api_log` VALUES (253, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:30:15.846', '2025-04-26 08:30:15.848', '2025-04-26 08:30:15.848');
INSERT INTO `api_log` VALUES (254, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:30:26.316', '2025-04-26 08:30:26.318', '2025-04-26 08:30:26.318');
INSERT INTO `api_log` VALUES (255, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:30:40.314', '2025-04-26 08:30:40.316', '2025-04-26 08:30:40.316');
INSERT INTO `api_log` VALUES (256, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:30:45.200', '2025-04-26 08:30:45.201', '2025-04-26 08:30:45.201');
INSERT INTO `api_log` VALUES (257, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:30:47.863', '2025-04-26 08:30:47.864', '2025-04-26 08:30:47.864');
INSERT INTO `api_log` VALUES (258, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:30:49.246', '2025-04-26 08:30:49.247', '2025-04-26 08:30:49.247');
INSERT INTO `api_log` VALUES (259, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 08:30:52.064', '2025-04-26 08:30:52.065', '2025-04-26 08:30:52.065');
INSERT INTO `api_log` VALUES (260, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-26 08:30:58.458', '2025-04-26 08:30:58.460', '2025-04-26 08:30:58.460');
INSERT INTO `api_log` VALUES (261, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:31:01.625', '2025-04-26 08:31:01.626', '2025-04-26 08:31:01.626');
INSERT INTO `api_log` VALUES (262, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-26 08:31:09.144', '2025-04-26 08:31:09.145', '2025-04-26 08:31:09.145');
INSERT INTO `api_log` VALUES (263, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 08:31:12.299', '2025-04-26 08:31:12.301', '2025-04-26 08:31:12.301');
INSERT INTO `api_log` VALUES (264, 'PUT', '/api/factory/121', '/rental/manage/', '312', 'vben', '2025-04-26 08:31:17.694', '2025-04-26 08:31:17.695', '2025-04-26 08:31:17.695');
INSERT INTO `api_log` VALUES (265, 'PUT', '/api/factory/122', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-26 08:31:27.268', '2025-04-26 08:31:27.269', '2025-04-26 08:31:27.269');
INSERT INTO `api_log` VALUES (266, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-26 08:35:25.509', '2025-04-26 08:35:25.511', '2025-04-26 08:35:25.511');
INSERT INTO `api_log` VALUES (267, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-26 08:35:29.576', '2025-04-26 08:35:29.578', '2025-04-26 08:35:29.578');
INSERT INTO `api_log` VALUES (268, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-26 08:38:12.828', '2025-04-26 08:38:12.830', '2025-04-26 08:38:12.830');
INSERT INTO `api_log` VALUES (269, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 00:57:39.755', '2025-04-28 00:57:39.756', '2025-04-28 00:57:39.756');
INSERT INTO `api_log` VALUES (270, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 00:57:43.222', '2025-04-28 00:57:43.223', '2025-04-28 00:57:43.223');
INSERT INTO `api_log` VALUES (271, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-28 00:57:46.431', '2025-04-28 00:57:46.431', '2025-04-28 00:57:46.431');
INSERT INTO `api_log` VALUES (272, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 00:57:50.719', '2025-04-28 00:57:50.720', '2025-04-28 00:57:50.720');
INSERT INTO `api_log` VALUES (273, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:02:25.854', '2025-04-28 01:02:25.860', '2025-04-28 01:02:25.860');
INSERT INTO `api_log` VALUES (274, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:03:57.817', '2025-04-28 01:03:57.822', '2025-04-28 01:03:57.822');
INSERT INTO `api_log` VALUES (275, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:04:58.370', '2025-04-28 01:04:58.374', '2025-04-28 01:04:58.374');
INSERT INTO `api_log` VALUES (276, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 01:09:55.056', '2025-04-28 01:09:55.057', '2025-04-28 01:09:55.057');
INSERT INTO `api_log` VALUES (277, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:09:59.129', '2025-04-28 01:09:59.131', '2025-04-28 01:09:59.131');
INSERT INTO `api_log` VALUES (278, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 01:16:30.639', '2025-04-28 01:16:30.640', '2025-04-28 01:16:30.640');
INSERT INTO `api_log` VALUES (279, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 01:17:12.748', '2025-04-28 01:17:12.749', '2025-04-28 01:17:12.749');
INSERT INTO `api_log` VALUES (280, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:17:17.411', '2025-04-28 01:17:17.414', '2025-04-28 01:17:17.414');
INSERT INTO `api_log` VALUES (281, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:19:05.974', '2025-04-28 01:19:05.978', '2025-04-28 01:19:05.978');
INSERT INTO `api_log` VALUES (282, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:19:19.475', '2025-04-28 01:19:19.477', '2025-04-28 01:19:19.477');
INSERT INTO `api_log` VALUES (283, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:32:47.267', '2025-04-28 01:32:47.269', '2025-04-28 01:32:47.269');
INSERT INTO `api_log` VALUES (284, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:33:32.105', '2025-04-28 01:33:32.107', '2025-04-28 01:33:32.107');
INSERT INTO `api_log` VALUES (285, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 01:38:30.084', '2025-04-28 01:38:30.086', '2025-04-28 01:38:30.086');
INSERT INTO `api_log` VALUES (286, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 01:38:34.522', '2025-04-28 01:38:34.524', '2025-04-28 01:38:34.524');
INSERT INTO `api_log` VALUES (287, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:38:38.118', '2025-04-28 01:38:38.120', '2025-04-28 01:38:38.120');
INSERT INTO `api_log` VALUES (288, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 01:39:37.177', '2025-04-28 01:39:37.179', '2025-04-28 01:39:37.179');
INSERT INTO `api_log` VALUES (289, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:39:43.375', '2025-04-28 01:39:43.379', '2025-04-28 01:39:43.379');
INSERT INTO `api_log` VALUES (290, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 01:40:04.231', '2025-04-28 01:40:04.232', '2025-04-28 01:40:04.232');
INSERT INTO `api_log` VALUES (291, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:41:09.044', '2025-04-28 01:41:09.048', '2025-04-28 01:41:09.048');
INSERT INTO `api_log` VALUES (292, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 01:41:11.026', '2025-04-28 01:41:11.028', '2025-04-28 01:41:11.028');
INSERT INTO `api_log` VALUES (293, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:42:35.550', '2025-04-28 01:42:35.554', '2025-04-28 01:42:35.554');
INSERT INTO `api_log` VALUES (294, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 01:42:40.946', '2025-04-28 01:42:40.947', '2025-04-28 01:42:40.947');
INSERT INTO `api_log` VALUES (295, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:42:54.373', '2025-04-28 01:42:54.376', '2025-04-28 01:42:54.376');
INSERT INTO `api_log` VALUES (296, 'PUT', '/api/factory/121', '/rental/manage/', '312', 'vben', '2025-04-28 01:42:55.997', '2025-04-28 01:42:55.998', '2025-04-28 01:42:55.998');
INSERT INTO `api_log` VALUES (297, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:44:25.649', '2025-04-28 01:44:25.653', '2025-04-28 01:44:25.653');
INSERT INTO `api_log` VALUES (298, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:45:30.133', '2025-04-28 01:45:30.137', '2025-04-28 01:45:30.137');
INSERT INTO `api_log` VALUES (299, 'PUT', '/api/factory/121', '/rental/manage/', '312', 'vben', '2025-04-28 01:45:33.427', '2025-04-28 01:45:33.428', '2025-04-28 01:45:33.428');
INSERT INTO `api_log` VALUES (300, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:45:39.075', '2025-04-28 01:45:39.081', '2025-04-28 01:45:39.081');
INSERT INTO `api_log` VALUES (301, 'PUT', '/api/factory/121', '/rental/manage/', '312', 'vben', '2025-04-28 01:45:44.050', '2025-04-28 01:45:44.051', '2025-04-28 01:45:44.051');
INSERT INTO `api_log` VALUES (302, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:48:39.769', '2025-04-28 01:48:39.773', '2025-04-28 01:48:39.773');
INSERT INTO `api_log` VALUES (303, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 01:48:40.930', '2025-04-28 01:48:40.931', '2025-04-28 01:48:40.931');
INSERT INTO `api_log` VALUES (304, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 01:54:00.075', '2025-04-28 01:54:00.076', '2025-04-28 01:54:00.076');
INSERT INTO `api_log` VALUES (305, 'PUT', '/api/factory/121', '/rental/manage/', '312', 'vben', '2025-04-28 01:54:34.967', '2025-04-28 01:54:34.969', '2025-04-28 01:54:34.969');
INSERT INTO `api_log` VALUES (306, 'PUT', '/api/factory/121', '/rental/manage/', '312', 'vben', '2025-04-28 01:54:39.145', '2025-04-28 01:54:39.146', '2025-04-28 01:54:39.146');
INSERT INTO `api_log` VALUES (307, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:54:51.359', '2025-04-28 01:54:51.363', '2025-04-28 01:54:51.363');
INSERT INTO `api_log` VALUES (308, 'PUT', '/api/factory/121', '/rental/manage/', '312', 'vben', '2025-04-28 01:54:52.697', '2025-04-28 01:54:52.698', '2025-04-28 01:54:52.698');
INSERT INTO `api_log` VALUES (309, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 01:57:53.735', '2025-04-28 01:57:53.736', '2025-04-28 01:57:53.736');
INSERT INTO `api_log` VALUES (310, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 01:57:57.254', '2025-04-28 01:57:57.259', '2025-04-28 01:57:57.259');
INSERT INTO `api_log` VALUES (311, 'PUT', '/api/factory/121', '/rental/manage/', '312', 'vben', '2025-04-28 01:57:59.357', '2025-04-28 01:57:59.358', '2025-04-28 01:57:59.358');
INSERT INTO `api_log` VALUES (312, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 02:16:40.393', '2025-04-28 02:16:40.394', '2025-04-28 02:16:40.394');
INSERT INTO `api_log` VALUES (313, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 02:16:43.601', '2025-04-28 02:16:43.605', '2025-04-28 02:16:43.605');
INSERT INTO `api_log` VALUES (314, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 02:22:33.507', '2025-04-28 02:22:33.511', '2025-04-28 02:22:33.511');
INSERT INTO `api_log` VALUES (315, 'PUT', '/api/factory/122', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-28 02:22:37.097', '2025-04-28 02:22:37.098', '2025-04-28 02:22:37.098');
INSERT INTO `api_log` VALUES (316, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 02:22:44.910', '2025-04-28 02:22:44.911', '2025-04-28 02:22:44.911');
INSERT INTO `api_log` VALUES (317, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 02:22:50.498', '2025-04-28 02:22:50.502', '2025-04-28 02:22:50.502');
INSERT INTO `api_log` VALUES (318, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 02:22:52.378', '2025-04-28 02:22:52.379', '2025-04-28 02:22:52.379');
INSERT INTO `api_log` VALUES (319, 'POST', '/api/system/role', '/system/role', '普通账户', 'vben', '2025-04-28 02:22:58.931', '2025-04-28 02:22:58.932', '2025-04-28 02:22:58.932');
INSERT INTO `api_log` VALUES (320, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 02:23:13.959', '2025-04-28 02:23:13.960', '2025-04-28 02:23:13.960');
INSERT INTO `api_log` VALUES (321, 'PUT', '/api/system/role/4', '/system/role', '普通账户', 'vben', '2025-04-28 02:24:04.176', '2025-04-28 02:24:04.178', '2025-04-28 02:24:04.178');
INSERT INTO `api_log` VALUES (322, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 02:28:35.498', '2025-04-28 02:28:35.499', '2025-04-28 02:28:35.499');
INSERT INTO `api_log` VALUES (323, 'PUT', '/api/factory/121', '/rental/manage/', '312', 'vben', '2025-04-28 02:28:49.067', '2025-04-28 02:28:49.068', '2025-04-28 02:28:49.068');
INSERT INTO `api_log` VALUES (324, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 02:30:57.012', '2025-04-28 02:30:57.016', '2025-04-28 02:30:57.016');
INSERT INTO `api_log` VALUES (325, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 02:30:58.246', '2025-04-28 02:30:58.247', '2025-04-28 02:30:58.247');
INSERT INTO `api_log` VALUES (326, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 02:31:05.122', '2025-04-28 02:31:05.126', '2025-04-28 02:31:05.126');
INSERT INTO `api_log` VALUES (327, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 02:31:06.395', '2025-04-28 02:31:06.396', '2025-04-28 02:31:06.396');
INSERT INTO `api_log` VALUES (328, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 02:31:28.059', '2025-04-28 02:31:28.060', '2025-04-28 02:31:28.060');
INSERT INTO `api_log` VALUES (329, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 02:32:49.928', '2025-04-28 02:32:49.933', '2025-04-28 02:32:49.933');
INSERT INTO `api_log` VALUES (330, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 02:32:51.082', '2025-04-28 02:32:51.083', '2025-04-28 02:32:51.083');
INSERT INTO `api_log` VALUES (331, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 02:33:02.224', '2025-04-28 02:33:02.225', '2025-04-28 02:33:02.225');
INSERT INTO `api_log` VALUES (332, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 02:56:28.578', '2025-04-28 02:56:28.582', '2025-04-28 02:56:28.582');
INSERT INTO `api_log` VALUES (333, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 02:56:30.641', '2025-04-28 02:56:30.642', '2025-04-28 02:56:30.642');
INSERT INTO `api_log` VALUES (334, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 02:59:44.944', '2025-04-28 02:59:44.945', '2025-04-28 02:59:44.945');
INSERT INTO `api_log` VALUES (335, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 02:59:50.366', '2025-04-28 02:59:50.370', '2025-04-28 02:59:50.370');
INSERT INTO `api_log` VALUES (336, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:00:03.069', '2025-04-28 03:00:03.073', '2025-04-28 03:00:03.073');
INSERT INTO `api_log` VALUES (337, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:00:06.927', '2025-04-28 03:00:06.928', '2025-04-28 03:00:06.928');
INSERT INTO `api_log` VALUES (338, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:00:28.665', '2025-04-28 03:00:28.669', '2025-04-28 03:00:28.669');
INSERT INTO `api_log` VALUES (339, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:00:31.335', '2025-04-28 03:00:31.336', '2025-04-28 03:00:31.336');
INSERT INTO `api_log` VALUES (340, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:00:38.213', '2025-04-28 03:00:38.216', '2025-04-28 03:00:38.216');
INSERT INTO `api_log` VALUES (341, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:00:39.876', '2025-04-28 03:00:39.877', '2025-04-28 03:00:39.877');
INSERT INTO `api_log` VALUES (342, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:01:01.247', '2025-04-28 03:01:01.251', '2025-04-28 03:01:01.251');
INSERT INTO `api_log` VALUES (343, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:01:04.179', '2025-04-28 03:01:04.181', '2025-04-28 03:01:04.181');
INSERT INTO `api_log` VALUES (344, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:01:16.341', '2025-04-28 03:01:16.343', '2025-04-28 03:01:16.343');
INSERT INTO `api_log` VALUES (345, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:01:19.894', '2025-04-28 03:01:19.898', '2025-04-28 03:01:19.898');
INSERT INTO `api_log` VALUES (346, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:01:50.122', '2025-04-28 03:01:50.127', '2025-04-28 03:01:50.127');
INSERT INTO `api_log` VALUES (347, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:01:55.753', '2025-04-28 03:01:55.754', '2025-04-28 03:01:55.754');
INSERT INTO `api_log` VALUES (348, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:11:30.706', '2025-04-28 03:11:30.707', '2025-04-28 03:11:30.707');
INSERT INTO `api_log` VALUES (349, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 03:13:29.049', '2025-04-28 03:13:29.050', '2025-04-28 03:13:29.050');
INSERT INTO `api_log` VALUES (350, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:13:31.491', '2025-04-28 03:13:31.492', '2025-04-28 03:13:31.492');
INSERT INTO `api_log` VALUES (351, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:13:38.524', '2025-04-28 03:13:38.527', '2025-04-28 03:13:38.527');
INSERT INTO `api_log` VALUES (352, 'PUT', '/api/system/role/3', '/system/role', 'Test', 'vben', '2025-04-28 03:14:13.673', '2025-04-28 03:14:13.674', '2025-04-28 03:14:13.674');
INSERT INTO `api_log` VALUES (353, 'PUT', '/api/system/role/4', '/system/role', '普通账户', 'vben', '2025-04-28 03:14:28.098', '2025-04-28 03:14:28.099', '2025-04-28 03:14:28.099');
INSERT INTO `api_log` VALUES (354, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 03:18:07.696', '2025-04-28 03:18:07.697', '2025-04-28 03:18:07.697');
INSERT INTO `api_log` VALUES (355, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:18:10.732', '2025-04-28 03:18:10.733', '2025-04-28 03:18:10.733');
INSERT INTO `api_log` VALUES (356, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:18:14.138', '2025-04-28 03:18:14.143', '2025-04-28 03:18:14.143');
INSERT INTO `api_log` VALUES (357, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:18:15.800', '2025-04-28 03:18:15.801', '2025-04-28 03:18:15.801');
INSERT INTO `api_log` VALUES (358, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:20:57.740', '2025-04-28 03:20:57.742', '2025-04-28 03:20:57.742');
INSERT INTO `api_log` VALUES (359, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:20:59.647', '2025-04-28 03:20:59.649', '2025-04-28 03:20:59.649');
INSERT INTO `api_log` VALUES (360, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:23:19.420', '2025-04-28 03:23:19.424', '2025-04-28 03:23:19.424');
INSERT INTO `api_log` VALUES (361, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:23:20.787', '2025-04-28 03:23:20.788', '2025-04-28 03:23:20.788');
INSERT INTO `api_log` VALUES (362, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:23:56.914', '2025-04-28 03:23:56.916', '2025-04-28 03:23:56.916');
INSERT INTO `api_log` VALUES (363, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:23:58.873', '2025-04-28 03:23:58.875', '2025-04-28 03:23:58.875');
INSERT INTO `api_log` VALUES (364, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:28:55.225', '2025-04-28 03:28:55.226', '2025-04-28 03:28:55.226');
INSERT INTO `api_log` VALUES (365, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:41:34.565', '2025-04-28 03:41:34.566', '2025-04-28 03:41:34.566');
INSERT INTO `api_log` VALUES (366, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:41:34.942', '2025-04-28 03:41:34.943', '2025-04-28 03:41:34.943');
INSERT INTO `api_log` VALUES (367, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:41:39.045', '2025-04-28 03:41:39.048', '2025-04-28 03:41:39.048');
INSERT INTO `api_log` VALUES (368, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:41:49.093', '2025-04-28 03:41:49.097', '2025-04-28 03:41:49.097');
INSERT INTO `api_log` VALUES (369, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:51:06.764', '2025-04-28 03:51:06.769', '2025-04-28 03:51:06.769');
INSERT INTO `api_log` VALUES (370, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:51:07.907', '2025-04-28 03:51:07.909', '2025-04-28 03:51:07.909');
INSERT INTO `api_log` VALUES (371, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 03:52:09.142', '2025-04-28 03:52:09.143', '2025-04-28 03:52:09.143');
INSERT INTO `api_log` VALUES (372, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:52:13.361', '2025-04-28 03:52:13.362', '2025-04-28 03:52:13.362');
INSERT INTO `api_log` VALUES (373, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:54:00.535', '2025-04-28 03:54:00.536', '2025-04-28 03:54:00.536');
INSERT INTO `api_log` VALUES (374, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:54:04.212', '2025-04-28 03:54:04.216', '2025-04-28 03:54:04.216');
INSERT INTO `api_log` VALUES (375, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 03:54:35.318', '2025-04-28 03:54:35.323', '2025-04-28 03:54:35.323');
INSERT INTO `api_log` VALUES (376, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 03:54:43.094', '2025-04-28 03:54:43.096', '2025-04-28 03:54:43.096');
INSERT INTO `api_log` VALUES (377, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:55:07.398', '2025-04-28 03:55:07.399', '2025-04-28 03:55:07.399');
INSERT INTO `api_log` VALUES (378, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:56:15.509', '2025-04-28 03:56:15.510', '2025-04-28 03:56:15.510');
INSERT INTO `api_log` VALUES (379, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 03:56:32.381', '2025-04-28 03:56:32.382', '2025-04-28 03:56:32.382');
INSERT INTO `api_log` VALUES (380, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:18:37.464', '2025-04-28 08:18:37.466', '2025-04-28 08:18:37.466');
INSERT INTO `api_log` VALUES (381, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:18:38.402', '2025-04-28 08:18:38.403', '2025-04-28 08:18:38.403');
INSERT INTO `api_log` VALUES (382, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:22:36.784', '2025-04-28 08:22:36.785', '2025-04-28 08:22:36.785');
INSERT INTO `api_log` VALUES (383, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:22:44.414', '2025-04-28 08:22:44.415', '2025-04-28 08:22:44.415');
INSERT INTO `api_log` VALUES (384, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:24:40.621', '2025-04-28 08:24:40.622', '2025-04-28 08:24:40.622');
INSERT INTO `api_log` VALUES (385, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:24:42.425', '2025-04-28 08:24:42.426', '2025-04-28 08:24:42.426');
INSERT INTO `api_log` VALUES (386, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:25:36.527', '2025-04-28 08:25:36.528', '2025-04-28 08:25:36.528');
INSERT INTO `api_log` VALUES (387, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-28 08:25:47.771', '2025-04-28 08:25:47.772', '2025-04-28 08:25:47.772');
INSERT INTO `api_log` VALUES (388, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:42:17.571', '2025-04-28 08:42:17.572', '2025-04-28 08:42:17.572');
INSERT INTO `api_log` VALUES (389, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 08:42:38.310', '2025-04-28 08:42:38.324', '2025-04-28 08:42:38.324');
INSERT INTO `api_log` VALUES (390, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:55:39.010', '2025-04-28 08:55:39.011', '2025-04-28 08:55:39.011');
INSERT INTO `api_log` VALUES (391, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:55:44.018', '2025-04-28 08:55:44.019', '2025-04-28 08:55:44.019');
INSERT INTO `api_log` VALUES (392, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 08:57:59.444', '2025-04-28 08:57:59.445', '2025-04-28 08:57:59.445');
INSERT INTO `api_log` VALUES (393, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 09:05:32.085', '2025-04-28 09:05:32.086', '2025-04-28 09:05:32.086');
INSERT INTO `api_log` VALUES (394, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 09:05:32.994', '2025-04-28 09:05:32.995', '2025-04-28 09:05:32.995');
INSERT INTO `api_log` VALUES (395, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-28 09:10:01.791', '2025-04-28 09:10:01.792', '2025-04-28 09:10:01.792');
INSERT INTO `api_log` VALUES (396, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-28 09:10:06.728', '2025-04-28 09:10:06.729', '2025-04-28 09:10:06.729');
INSERT INTO `api_log` VALUES (397, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-28 09:10:33.923', '2025-04-28 09:10:33.924', '2025-04-28 09:10:33.924');
INSERT INTO `api_log` VALUES (398, 'PUT', '/api/park/2', '/rental/manage/', '十一产业园（广州）', 'vben', '2025-04-28 09:26:24.491', '2025-04-28 09:26:24.492', '2025-04-28 09:26:24.492');
INSERT INTO `api_log` VALUES (399, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 09:40:24.818', '2025-04-28 09:40:24.831', '2025-04-28 09:40:24.831');
INSERT INTO `api_log` VALUES (400, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 09:40:35.226', '2025-04-28 09:40:35.275', '2025-04-28 09:40:35.275');
INSERT INTO `api_log` VALUES (401, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 09:41:42.522', '2025-04-28 09:41:42.524', '2025-04-28 09:41:42.524');
INSERT INTO `api_log` VALUES (402, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 09:43:27.968', '2025-04-28 09:43:27.971', '2025-04-28 09:43:27.971');
INSERT INTO `api_log` VALUES (403, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 09:51:02.512', '2025-04-28 09:51:02.513', '2025-04-28 09:51:02.513');
INSERT INTO `api_log` VALUES (404, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 09:51:36.915', '2025-04-28 09:51:36.916', '2025-04-28 09:51:36.916');
INSERT INTO `api_log` VALUES (405, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 09:51:45.917', '2025-04-28 09:51:45.919', '2025-04-28 09:51:45.919');
INSERT INTO `api_log` VALUES (406, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 09:51:56.893', '2025-04-28 09:51:56.894', '2025-04-28 09:51:56.894');
INSERT INTO `api_log` VALUES (407, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 09:52:25.395', '2025-04-28 09:52:25.399', '2025-04-28 09:52:25.399');
INSERT INTO `api_log` VALUES (408, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 09:52:26.631', '2025-04-28 09:52:26.633', '2025-04-28 09:52:26.633');
INSERT INTO `api_log` VALUES (409, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 09:52:30.188', '2025-04-28 09:52:30.189', '2025-04-28 09:52:30.189');
INSERT INTO `api_log` VALUES (410, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 09:52:37.401', '2025-04-28 09:52:37.403', '2025-04-28 09:52:37.403');
INSERT INTO `api_log` VALUES (411, 'PUT', '/api/factory/120', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 09:52:39.434', '2025-04-28 09:52:39.436', '2025-04-28 09:52:39.436');
INSERT INTO `api_log` VALUES (412, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-28 09:52:41.730', '2025-04-28 09:52:41.732', '2025-04-28 09:52:41.732');
INSERT INTO `api_log` VALUES (413, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 09:52:43.869', '2025-04-28 09:52:43.871', '2025-04-28 09:52:43.871');
INSERT INTO `api_log` VALUES (414, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 09:55:02.278', '2025-04-28 09:55:02.280', '2025-04-28 09:55:02.280');
INSERT INTO `api_log` VALUES (415, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 09:55:05.684', '2025-04-28 09:55:05.688', '2025-04-28 09:55:05.688');
INSERT INTO `api_log` VALUES (416, 'PUT', '/api/factory/123', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 09:55:08.218', '2025-04-28 09:55:08.219', '2025-04-28 09:55:08.219');
INSERT INTO `api_log` VALUES (417, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 09:55:11.546', '2025-04-28 09:55:11.547', '2025-04-28 09:55:11.547');
INSERT INTO `api_log` VALUES (418, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 09:55:20.596', '2025-04-28 09:55:20.604', '2025-04-28 09:55:20.604');
INSERT INTO `api_log` VALUES (419, 'PUT', '/api/factory/123', '/rental/manage/', 'Fu An', 'vben', '2025-04-28 09:55:29.363', '2025-04-28 09:55:29.364', '2025-04-28 09:55:29.364');
INSERT INTO `api_log` VALUES (420, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-28 09:55:32.314', '2025-04-28 09:55:32.315', '2025-04-28 09:55:32.315');
INSERT INTO `api_log` VALUES (421, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-28 09:55:33.722', '2025-04-28 09:55:33.723', '2025-04-28 09:55:33.723');
INSERT INTO `api_log` VALUES (422, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-28 09:55:43.896', '2025-04-28 09:55:43.899', '2025-04-28 09:55:43.899');
INSERT INTO `api_log` VALUES (423, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:16:18.527', '2025-04-29 01:16:18.528', '2025-04-29 01:16:18.528');
INSERT INTO `api_log` VALUES (424, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:18:37.799', '2025-04-29 01:18:37.800', '2025-04-29 01:18:37.800');
INSERT INTO `api_log` VALUES (425, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:22:24.994', '2025-04-29 01:22:24.995', '2025-04-29 01:22:24.995');
INSERT INTO `api_log` VALUES (426, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:25:44.409', '2025-04-29 01:25:44.411', '2025-04-29 01:25:44.411');
INSERT INTO `api_log` VALUES (427, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:26:30.871', '2025-04-29 01:26:30.873', '2025-04-29 01:26:30.873');
INSERT INTO `api_log` VALUES (428, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:29:18.735', '2025-04-29 01:29:18.735', '2025-04-29 01:29:18.735');
INSERT INTO `api_log` VALUES (429, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:29:22.083', '2025-04-29 01:29:22.087', '2025-04-29 01:29:22.087');
INSERT INTO `api_log` VALUES (430, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:29:45.545', '2025-04-29 01:29:45.546', '2025-04-29 01:29:45.546');
INSERT INTO `api_log` VALUES (431, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:29:48.877', '2025-04-29 01:29:48.882', '2025-04-29 01:29:48.882');
INSERT INTO `api_log` VALUES (432, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:29:55.962', '2025-04-29 01:29:55.977', '2025-04-29 01:29:55.977');
INSERT INTO `api_log` VALUES (433, 'PUT', '/api/factory/126', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 01:30:04.945', '2025-04-29 01:30:04.946', '2025-04-29 01:30:04.946');
INSERT INTO `api_log` VALUES (434, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:32:56.008', '2025-04-29 01:32:56.010', '2025-04-29 01:32:56.010');
INSERT INTO `api_log` VALUES (435, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:39:06.650', '2025-04-29 01:39:06.651', '2025-04-29 01:39:06.651');
INSERT INTO `api_log` VALUES (436, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:39:25.880', '2025-04-29 01:39:25.881', '2025-04-29 01:39:25.881');
INSERT INTO `api_log` VALUES (437, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:39:56.011', '2025-04-29 01:39:56.012', '2025-04-29 01:39:56.012');
INSERT INTO `api_log` VALUES (438, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:40:08.003', '2025-04-29 01:40:08.005', '2025-04-29 01:40:08.005');
INSERT INTO `api_log` VALUES (439, 'PUT', '/api/factory/126', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 01:40:13.529', '2025-04-29 01:40:13.530', '2025-04-29 01:40:13.530');
INSERT INTO `api_log` VALUES (440, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-29 01:40:18.939', '2025-04-29 01:40:18.940', '2025-04-29 01:40:18.940');
INSERT INTO `api_log` VALUES (441, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:40:30.066', '2025-04-29 01:40:30.067', '2025-04-29 01:40:30.067');
INSERT INTO `api_log` VALUES (442, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:49:34.438', '2025-04-29 01:49:34.441', '2025-04-29 01:49:34.441');
INSERT INTO `api_log` VALUES (443, 'PUT', '/api/factory/129', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 01:49:37.020', '2025-04-29 01:49:37.021', '2025-04-29 01:49:37.021');
INSERT INTO `api_log` VALUES (444, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:49:45.295', '2025-04-29 01:49:45.298', '2025-04-29 01:49:45.298');
INSERT INTO `api_log` VALUES (445, 'PUT', '/api/factory/129', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 01:49:48.450', '2025-04-29 01:49:48.451', '2025-04-29 01:49:48.451');
INSERT INTO `api_log` VALUES (446, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:50:14.738', '2025-04-29 01:50:14.742', '2025-04-29 01:50:14.742');
INSERT INTO `api_log` VALUES (447, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:50:32.344', '2025-04-29 01:50:32.353', '2025-04-29 01:50:32.353');
INSERT INTO `api_log` VALUES (448, 'PUT', '/api/factory/129', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 01:50:34.175', '2025-04-29 01:50:34.176', '2025-04-29 01:50:34.176');
INSERT INTO `api_log` VALUES (449, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:51:03.460', '2025-04-29 01:51:03.462', '2025-04-29 01:51:03.462');
INSERT INTO `api_log` VALUES (450, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:54:12.157', '2025-04-29 01:54:12.158', '2025-04-29 01:54:12.158');
INSERT INTO `api_log` VALUES (451, 'PUT', '/api/factory/129', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 01:54:14.312', '2025-04-29 01:54:14.313', '2025-04-29 01:54:14.313');
INSERT INTO `api_log` VALUES (452, 'PUT', '/api/factory/129', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 01:54:22.405', '2025-04-29 01:54:22.405', '2025-04-29 01:54:22.405');
INSERT INTO `api_log` VALUES (453, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:54:53.857', '2025-04-29 01:54:53.857', '2025-04-29 01:54:53.857');
INSERT INTO `api_log` VALUES (454, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:55:04.924', '2025-04-29 01:55:04.932', '2025-04-29 01:55:04.932');
INSERT INTO `api_log` VALUES (455, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:55:36.008', '2025-04-29 01:55:36.009', '2025-04-29 01:55:36.009');
INSERT INTO `api_log` VALUES (456, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:55:38.987', '2025-04-29 01:55:38.995', '2025-04-29 01:55:38.995');
INSERT INTO `api_log` VALUES (457, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-29 01:56:00.201', '2025-04-29 01:56:00.202', '2025-04-29 01:56:00.202');
INSERT INTO `api_log` VALUES (458, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:56:03.443', '2025-04-29 01:56:03.447', '2025-04-29 01:56:03.447');
INSERT INTO `api_log` VALUES (459, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:56:10.759', '2025-04-29 01:56:10.761', '2025-04-29 01:56:10.761');
INSERT INTO `api_log` VALUES (460, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:56:13.495', '2025-04-29 01:56:13.497', '2025-04-29 01:56:13.497');
INSERT INTO `api_log` VALUES (461, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:56:18.044', '2025-04-29 01:56:18.046', '2025-04-29 01:56:18.046');
INSERT INTO `api_log` VALUES (462, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:56:40.841', '2025-04-29 01:56:40.842', '2025-04-29 01:56:40.842');
INSERT INTO `api_log` VALUES (463, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:56:44.049', '2025-04-29 01:56:44.052', '2025-04-29 01:56:44.052');
INSERT INTO `api_log` VALUES (464, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:57:02.996', '2025-04-29 01:57:02.997', '2025-04-29 01:57:02.997');
INSERT INTO `api_log` VALUES (465, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:57:05.879', '2025-04-29 01:57:05.883', '2025-04-29 01:57:05.883');
INSERT INTO `api_log` VALUES (466, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 01:57:28.810', '2025-04-29 01:57:28.811', '2025-04-29 01:57:28.811');
INSERT INTO `api_log` VALUES (467, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:57:31.670', '2025-04-29 01:57:31.674', '2025-04-29 01:57:31.674');
INSERT INTO `api_log` VALUES (468, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:58:53.018', '2025-04-29 01:58:53.021', '2025-04-29 01:58:53.021');
INSERT INTO `api_log` VALUES (469, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 01:59:09.261', '2025-04-29 01:59:09.265', '2025-04-29 01:59:09.265');
INSERT INTO `api_log` VALUES (470, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:08:42.919', '2025-04-29 02:08:42.933', '2025-04-29 02:08:42.933');
INSERT INTO `api_log` VALUES (471, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-29 02:20:18.866', '2025-04-29 02:20:18.867', '2025-04-29 02:20:18.867');
INSERT INTO `api_log` VALUES (472, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 02:20:22.995', '2025-04-29 02:20:22.996', '2025-04-29 02:20:22.996');
INSERT INTO `api_log` VALUES (473, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:20:26.226', '2025-04-29 02:20:26.228', '2025-04-29 02:20:26.228');
INSERT INTO `api_log` VALUES (474, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 02:23:02.393', '2025-04-29 02:23:02.394', '2025-04-29 02:23:02.394');
INSERT INTO `api_log` VALUES (475, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:23:06.144', '2025-04-29 02:23:06.146', '2025-04-29 02:23:06.146');
INSERT INTO `api_log` VALUES (476, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:23:09.440', '2025-04-29 02:23:09.448', '2025-04-29 02:23:09.448');
INSERT INTO `api_log` VALUES (477, 'PUT', '/api/factory/129', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 02:23:13.194', '2025-04-29 02:23:13.195', '2025-04-29 02:23:13.195');
INSERT INTO `api_log` VALUES (478, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 02:23:27.415', '2025-04-29 02:23:27.416', '2025-04-29 02:23:27.416');
INSERT INTO `api_log` VALUES (479, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 02:24:00.338', '2025-04-29 02:24:00.339', '2025-04-29 02:24:00.339');
INSERT INTO `api_log` VALUES (480, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:24:03.433', '2025-04-29 02:24:03.435', '2025-04-29 02:24:03.435');
INSERT INTO `api_log` VALUES (481, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 02:27:17.446', '2025-04-29 02:27:17.448', '2025-04-29 02:27:17.448');
INSERT INTO `api_log` VALUES (482, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:27:20.853', '2025-04-29 02:27:20.856', '2025-04-29 02:27:20.856');
INSERT INTO `api_log` VALUES (483, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:27:26.540', '2025-04-29 02:27:26.542', '2025-04-29 02:27:26.542');
INSERT INTO `api_log` VALUES (484, 'PUT', '/api/factory/129', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 02:27:28.084', '2025-04-29 02:27:28.085', '2025-04-29 02:27:28.085');
INSERT INTO `api_log` VALUES (485, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-29 02:27:29.376', '2025-04-29 02:27:29.378', '2025-04-29 02:27:29.378');
INSERT INTO `api_log` VALUES (486, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 02:27:35.746', '2025-04-29 02:27:35.748', '2025-04-29 02:27:35.748');
INSERT INTO `api_log` VALUES (487, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:27:39.044', '2025-04-29 02:27:39.053', '2025-04-29 02:27:39.053');
INSERT INTO `api_log` VALUES (488, 'PUT', '/api/factory/132', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 02:27:40.376', '2025-04-29 02:27:40.378', '2025-04-29 02:27:40.378');
INSERT INTO `api_log` VALUES (489, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-29 02:27:41.550', '2025-04-29 02:27:41.552', '2025-04-29 02:27:41.552');
INSERT INTO `api_log` VALUES (490, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 02:27:43.291', '2025-04-29 02:27:43.293', '2025-04-29 02:27:43.293');
INSERT INTO `api_log` VALUES (491, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:34:29.721', '2025-04-29 02:34:29.739', '2025-04-29 02:34:29.739');
INSERT INTO `api_log` VALUES (492, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:34:45.774', '2025-04-29 02:34:45.786', '2025-04-29 02:34:45.786');
INSERT INTO `api_log` VALUES (493, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:34:56.447', '2025-04-29 02:34:56.457', '2025-04-29 02:34:56.457');
INSERT INTO `api_log` VALUES (494, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-29 02:38:55.749', '2025-04-29 02:38:55.750', '2025-04-29 02:38:55.750');
INSERT INTO `api_log` VALUES (495, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 02:38:58.384', '2025-04-29 02:38:58.385', '2025-04-29 02:38:58.385');
INSERT INTO `api_log` VALUES (496, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:39:02.844', '2025-04-29 02:39:02.849', '2025-04-29 02:39:02.849');
INSERT INTO `api_log` VALUES (497, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:39:53.018', '2025-04-29 02:39:53.023', '2025-04-29 02:39:53.023');
INSERT INTO `api_log` VALUES (498, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 02:40:01.232', '2025-04-29 02:40:01.233', '2025-04-29 02:40:01.233');
INSERT INTO `api_log` VALUES (499, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 02:41:07.278', '2025-04-29 02:41:07.279', '2025-04-29 02:41:07.279');
INSERT INTO `api_log` VALUES (500, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:41:10.618', '2025-04-29 02:41:10.622', '2025-04-29 02:41:10.622');
INSERT INTO `api_log` VALUES (501, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 02:41:12.215', '2025-04-29 02:41:12.216', '2025-04-29 02:41:12.216');
INSERT INTO `api_log` VALUES (502, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:41:36.729', '2025-04-29 02:41:36.733', '2025-04-29 02:41:36.733');
INSERT INTO `api_log` VALUES (503, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 02:41:38.119', '2025-04-29 02:41:38.120', '2025-04-29 02:41:38.120');
INSERT INTO `api_log` VALUES (504, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 02:42:00.976', '2025-04-29 02:42:00.977', '2025-04-29 02:42:00.977');
INSERT INTO `api_log` VALUES (505, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:42:05.574', '2025-04-29 02:42:05.577', '2025-04-29 02:42:05.577');
INSERT INTO `api_log` VALUES (506, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 02:42:07.853', '2025-04-29 02:42:07.854', '2025-04-29 02:42:07.854');
INSERT INTO `api_log` VALUES (507, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:42:46.670', '2025-04-29 02:42:46.674', '2025-04-29 02:42:46.674');
INSERT INTO `api_log` VALUES (508, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 02:42:48.337', '2025-04-29 02:42:48.338', '2025-04-29 02:42:48.338');
INSERT INTO `api_log` VALUES (509, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:43:14.092', '2025-04-29 02:43:14.096', '2025-04-29 02:43:14.096');
INSERT INTO `api_log` VALUES (510, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 02:52:04.968', '2025-04-29 02:52:04.970', '2025-04-29 02:52:04.970');
INSERT INTO `api_log` VALUES (511, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 02:52:34.616', '2025-04-29 02:52:34.621', '2025-04-29 02:52:34.621');
INSERT INTO `api_log` VALUES (512, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 02:52:36.035', '2025-04-29 02:52:36.037', '2025-04-29 02:52:36.037');
INSERT INTO `api_log` VALUES (513, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 03:05:34.439', '2025-04-29 03:05:34.441', '2025-04-29 03:05:34.441');
INSERT INTO `api_log` VALUES (514, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 03:05:35.937', '2025-04-29 03:05:35.939', '2025-04-29 03:05:35.939');
INSERT INTO `api_log` VALUES (515, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 03:14:38.397', '2025-04-29 03:14:38.398', '2025-04-29 03:14:38.398');
INSERT INTO `api_log` VALUES (516, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 03:14:43.514', '2025-04-29 03:14:43.515', '2025-04-29 03:14:43.515');
INSERT INTO `api_log` VALUES (517, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 03:14:52.017', '2025-04-29 03:14:52.019', '2025-04-29 03:14:52.019');
INSERT INTO `api_log` VALUES (518, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 03:14:55.207', '2025-04-29 03:14:55.208', '2025-04-29 03:14:55.208');
INSERT INTO `api_log` VALUES (519, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 03:18:19.898', '2025-04-29 03:18:19.903', '2025-04-29 03:18:19.903');
INSERT INTO `api_log` VALUES (520, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 03:18:21.795', '2025-04-29 03:18:21.797', '2025-04-29 03:18:21.797');
INSERT INTO `api_log` VALUES (521, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 03:36:44.058', '2025-04-29 03:36:44.060', '2025-04-29 03:36:44.060');
INSERT INTO `api_log` VALUES (522, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 03:36:50.238', '2025-04-29 03:36:50.240', '2025-04-29 03:36:50.240');
INSERT INTO `api_log` VALUES (523, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 03:44:46.986', '2025-04-29 03:44:46.996', '2025-04-29 03:44:46.996');
INSERT INTO `api_log` VALUES (524, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 03:45:01.530', '2025-04-29 03:45:01.538', '2025-04-29 03:45:01.538');
INSERT INTO `api_log` VALUES (525, 'PUT', '/api/bill/amount', '/bill', '1', 'vben', '2025-04-29 05:42:35.669', '2025-04-29 05:42:35.670', '2025-04-29 05:42:35.670');
INSERT INTO `api_log` VALUES (526, 'PUT', '/api/bill/amount', '/bill', '1', 'vben', '2025-04-29 05:42:44.463', '2025-04-29 05:42:44.464', '2025-04-29 05:42:44.464');
INSERT INTO `api_log` VALUES (527, 'PUT', '/api/bill/amount', '/bill', '1', 'vben', '2025-04-29 05:43:28.798', '2025-04-29 05:43:28.800', '2025-04-29 05:43:28.800');
INSERT INTO `api_log` VALUES (528, 'PUT', '/api/bill/amount', '/bill', '1', 'vben', '2025-04-29 05:44:00.878', '2025-04-29 05:44:00.879', '2025-04-29 05:44:00.879');
INSERT INTO `api_log` VALUES (529, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 05:45:09.926', '2025-04-29 05:45:09.927', '2025-04-29 05:45:09.927');
INSERT INTO `api_log` VALUES (530, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-29 05:45:17.592', '2025-04-29 05:45:17.593', '2025-04-29 05:45:17.593');
INSERT INTO `api_log` VALUES (531, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 05:45:24.226', '2025-04-29 05:45:24.227', '2025-04-29 05:45:24.227');
INSERT INTO `api_log` VALUES (532, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 05:45:24.460', '2025-04-29 05:45:24.460', '2025-04-29 05:45:24.460');
INSERT INTO `api_log` VALUES (533, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 05:49:30.152', '2025-04-29 05:49:30.153', '2025-04-29 05:49:30.153');
INSERT INTO `api_log` VALUES (534, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 05:49:31.937', '2025-04-29 05:49:31.937', '2025-04-29 05:49:31.937');
INSERT INTO `api_log` VALUES (535, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 05:49:34.384', '2025-04-29 05:49:34.384', '2025-04-29 05:49:34.384');
INSERT INTO `api_log` VALUES (536, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 05:49:36.310', '2025-04-29 05:49:36.311', '2025-04-29 05:49:36.311');
INSERT INTO `api_log` VALUES (537, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:07:18.440', '2025-04-29 06:07:18.441', '2025-04-29 06:07:18.441');
INSERT INTO `api_log` VALUES (538, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:13:46.439', '2025-04-29 06:13:46.440', '2025-04-29 06:13:46.440');
INSERT INTO `api_log` VALUES (539, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:15:33.699', '2025-04-29 06:15:33.700', '2025-04-29 06:15:33.700');
INSERT INTO `api_log` VALUES (540, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:18:53.611', '2025-04-29 06:18:53.613', '2025-04-29 06:18:53.613');
INSERT INTO `api_log` VALUES (541, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 06:36:40.712', '2025-04-29 06:36:40.714', '2025-04-29 06:36:40.714');
INSERT INTO `api_log` VALUES (542, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:36:42.178', '2025-04-29 06:36:42.179', '2025-04-29 06:36:42.179');
INSERT INTO `api_log` VALUES (543, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:38:07.751', '2025-04-29 06:38:07.752', '2025-04-29 06:38:07.752');
INSERT INTO `api_log` VALUES (544, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:39:04.270', '2025-04-29 06:39:04.271', '2025-04-29 06:39:04.271');
INSERT INTO `api_log` VALUES (545, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 06:39:23.993', '2025-04-29 06:39:23.994', '2025-04-29 06:39:23.994');
INSERT INTO `api_log` VALUES (546, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 06:39:27.690', '2025-04-29 06:39:27.695', '2025-04-29 06:39:27.695');
INSERT INTO `api_log` VALUES (547, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:39:29.614', '2025-04-29 06:39:29.615', '2025-04-29 06:39:29.615');
INSERT INTO `api_log` VALUES (548, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:43:02.593', '2025-04-29 06:43:02.594', '2025-04-29 06:43:02.594');
INSERT INTO `api_log` VALUES (549, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 06:43:18.880', '2025-04-29 06:43:18.882', '2025-04-29 06:43:18.882');
INSERT INTO `api_log` VALUES (550, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 06:45:27.362', '2025-04-29 06:45:27.366', '2025-04-29 06:45:27.366');
INSERT INTO `api_log` VALUES (551, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 06:48:19.748', '2025-04-29 06:48:19.749', '2025-04-29 06:48:19.749');
INSERT INTO `api_log` VALUES (552, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 06:48:22.761', '2025-04-29 06:48:22.764', '2025-04-29 06:48:22.764');
INSERT INTO `api_log` VALUES (553, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:49:26.758', '2025-04-29 06:49:26.759', '2025-04-29 06:49:26.759');
INSERT INTO `api_log` VALUES (554, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:52:17.929', '2025-04-29 06:52:17.930', '2025-04-29 06:52:17.930');
INSERT INTO `api_log` VALUES (555, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:52:37.664', '2025-04-29 06:52:37.665', '2025-04-29 06:52:37.665');
INSERT INTO `api_log` VALUES (556, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:52:48.300', '2025-04-29 06:52:48.301', '2025-04-29 06:52:48.301');
INSERT INTO `api_log` VALUES (557, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 06:53:02.710', '2025-04-29 06:53:02.711', '2025-04-29 06:53:02.711');
INSERT INTO `api_log` VALUES (558, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:53:08.589', '2025-04-29 06:53:08.590', '2025-04-29 06:53:08.590');
INSERT INTO `api_log` VALUES (559, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 06:53:36.878', '2025-04-29 06:53:36.880', '2025-04-29 06:53:36.880');
INSERT INTO `api_log` VALUES (560, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 06:54:55.847', '2025-04-29 06:54:55.848', '2025-04-29 06:54:55.848');
INSERT INTO `api_log` VALUES (561, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 06:54:58.370', '2025-04-29 06:54:58.371', '2025-04-29 06:54:58.371');
INSERT INTO `api_log` VALUES (562, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:02:17.805', '2025-04-29 07:02:17.806', '2025-04-29 07:02:17.806');
INSERT INTO `api_log` VALUES (563, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:02:21.565', '2025-04-29 07:02:21.566', '2025-04-29 07:02:21.566');
INSERT INTO `api_log` VALUES (564, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:02:26.109', '2025-04-29 07:02:26.117', '2025-04-29 07:02:26.117');
INSERT INTO `api_log` VALUES (565, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:02:27.470', '2025-04-29 07:02:27.471', '2025-04-29 07:02:27.471');
INSERT INTO `api_log` VALUES (566, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:02:31.521', '2025-04-29 07:02:31.522', '2025-04-29 07:02:31.522');
INSERT INTO `api_log` VALUES (567, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:03:04.874', '2025-04-29 07:03:04.883', '2025-04-29 07:03:04.883');
INSERT INTO `api_log` VALUES (568, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:07:54.722', '2025-04-29 07:07:54.727', '2025-04-29 07:07:54.727');
INSERT INTO `api_log` VALUES (569, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:07:56.649', '2025-04-29 07:07:56.650', '2025-04-29 07:07:56.650');
INSERT INTO `api_log` VALUES (570, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:08:02.839', '2025-04-29 07:08:02.840', '2025-04-29 07:08:02.840');
INSERT INTO `api_log` VALUES (571, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:08:29.935', '2025-04-29 07:08:29.936', '2025-04-29 07:08:29.936');
INSERT INTO `api_log` VALUES (572, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:08:35.128', '2025-04-29 07:08:35.130', '2025-04-29 07:08:35.130');
INSERT INTO `api_log` VALUES (573, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:08:38.296', '2025-04-29 07:08:38.305', '2025-04-29 07:08:38.305');
INSERT INTO `api_log` VALUES (574, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:08:39.922', '2025-04-29 07:08:39.924', '2025-04-29 07:08:39.924');
INSERT INTO `api_log` VALUES (575, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:08:48.898', '2025-04-29 07:08:48.900', '2025-04-29 07:08:48.900');
INSERT INTO `api_log` VALUES (576, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:08:50.551', '2025-04-29 07:08:50.552', '2025-04-29 07:08:50.552');
INSERT INTO `api_log` VALUES (577, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:09:03.429', '2025-04-29 07:09:03.430', '2025-04-29 07:09:03.430');
INSERT INTO `api_log` VALUES (578, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:09:03.430', '2025-04-29 07:09:03.432', '2025-04-29 07:09:03.432');
INSERT INTO `api_log` VALUES (579, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:09:03.518', '2025-04-29 07:09:03.526', '2025-04-29 07:09:03.526');
INSERT INTO `api_log` VALUES (580, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:09:03.527', '2025-04-29 07:09:03.536', '2025-04-29 07:09:03.536');
INSERT INTO `api_log` VALUES (581, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:09:03.535', '2025-04-29 07:09:03.543', '2025-04-29 07:09:03.543');
INSERT INTO `api_log` VALUES (582, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:09:05.651', '2025-04-29 07:09:05.652', '2025-04-29 07:09:05.652');
INSERT INTO `api_log` VALUES (583, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:09:20.592', '2025-04-29 07:09:20.594', '2025-04-29 07:09:20.594');
INSERT INTO `api_log` VALUES (584, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:09:20.593', '2025-04-29 07:09:20.595', '2025-04-29 07:09:20.595');
INSERT INTO `api_log` VALUES (585, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:09:22.818', '2025-04-29 07:09:22.819', '2025-04-29 07:09:22.819');
INSERT INTO `api_log` VALUES (586, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:09:39.148', '2025-04-29 07:09:39.156', '2025-04-29 07:09:39.156');
INSERT INTO `api_log` VALUES (587, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:09:40.775', '2025-04-29 07:09:40.779', '2025-04-29 07:09:40.779');
INSERT INTO `api_log` VALUES (588, 'PUT', '/api/factory/135', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:09:42.544', '2025-04-29 07:09:42.545', '2025-04-29 07:09:42.545');
INSERT INTO `api_log` VALUES (589, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-29 07:09:44.260', '2025-04-29 07:09:44.260', '2025-04-29 07:09:44.260');
INSERT INTO `api_log` VALUES (590, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:09:49.512', '2025-04-29 07:09:49.513', '2025-04-29 07:09:49.513');
INSERT INTO `api_log` VALUES (591, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:10:00.901', '2025-04-29 07:10:00.909', '2025-04-29 07:10:00.909');
INSERT INTO `api_log` VALUES (592, 'PUT', '/api/factory/138', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:10:02.650', '2025-04-29 07:10:02.650', '2025-04-29 07:10:02.650');
INSERT INTO `api_log` VALUES (593, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:10:13.930', '2025-04-29 07:10:13.934', '2025-04-29 07:10:13.934');
INSERT INTO `api_log` VALUES (594, 'PUT', '/api/factory/138', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:10:15.466', '2025-04-29 07:10:15.467', '2025-04-29 07:10:15.467');
INSERT INTO `api_log` VALUES (595, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:10:20.390', '2025-04-29 07:10:20.399', '2025-04-29 07:10:20.399');
INSERT INTO `api_log` VALUES (596, 'PUT', '/api/factory/138', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:10:22.154', '2025-04-29 07:10:22.155', '2025-04-29 07:10:22.155');
INSERT INTO `api_log` VALUES (597, 'PUT', '/api/factory/138', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:10:36.275', '2025-04-29 07:10:36.276', '2025-04-29 07:10:36.276');
INSERT INTO `api_log` VALUES (598, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:10:44.034', '2025-04-29 07:10:44.038', '2025-04-29 07:10:44.038');
INSERT INTO `api_log` VALUES (599, 'PUT', '/api/factory/138', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:10:45.385', '2025-04-29 07:10:45.385', '2025-04-29 07:10:45.385');
INSERT INTO `api_log` VALUES (600, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:14:55.527', '2025-04-29 07:14:55.529', '2025-04-29 07:14:55.529');
INSERT INTO `api_log` VALUES (601, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:26:01.374', '2025-04-29 07:26:01.376', '2025-04-29 07:26:01.376');
INSERT INTO `api_log` VALUES (602, 'POST', '/api/dormitory', '/rental/manage/', 'A栋宿舍', 'vben', '2025-04-29 07:26:04.509', '2025-04-29 07:26:04.510', '2025-04-29 07:26:04.510');
INSERT INTO `api_log` VALUES (603, 'POST', '/api/dormitory', '/rental/manage/', 'C栋宿舍', 'vben', '2025-04-29 07:26:29.135', '2025-04-29 07:26:29.136', '2025-04-29 07:26:29.136');
INSERT INTO `api_log` VALUES (604, 'PUT', '/api/system/park/3', '/rental/manage/', '', 'vben', '2025-04-29 07:26:35.059', '2025-04-29 07:26:35.060', '2025-04-29 07:26:35.060');
INSERT INTO `api_log` VALUES (605, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:28:21.556', '2025-04-29 07:28:21.557', '2025-04-29 07:28:21.557');
INSERT INTO `api_log` VALUES (606, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:28:26.575', '2025-04-29 07:28:26.577', '2025-04-29 07:28:26.577');
INSERT INTO `api_log` VALUES (607, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:28:34.253', '2025-04-29 07:28:34.254', '2025-04-29 07:28:34.254');
INSERT INTO `api_log` VALUES (608, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:28:40.503', '2025-04-29 07:28:40.504', '2025-04-29 07:28:40.504');
INSERT INTO `api_log` VALUES (609, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:28:47.100', '2025-04-29 07:28:47.101', '2025-04-29 07:28:47.101');
INSERT INTO `api_log` VALUES (610, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:30:04.626', '2025-04-29 07:30:04.627', '2025-04-29 07:30:04.627');
INSERT INTO `api_log` VALUES (611, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:30:23.996', '2025-04-29 07:30:23.997', '2025-04-29 07:30:23.997');
INSERT INTO `api_log` VALUES (612, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:34:21.870', '2025-04-29 07:34:21.872', '2025-04-29 07:34:21.872');
INSERT INTO `api_log` VALUES (613, 'DELETE', '/api/factory/142', '/rental/manage/', '', 'vben', '2025-04-29 07:34:35.814', '2025-04-29 07:34:35.816', '2025-04-29 07:34:35.816');
INSERT INTO `api_log` VALUES (614, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:37:58.281', '2025-04-29 07:37:58.282', '2025-04-29 07:37:58.282');
INSERT INTO `api_log` VALUES (615, 'DELETE', '/api/dormitory/18', '/rental/manage/', '', 'vben', '2025-04-29 07:38:24.547', '2025-04-29 07:38:24.549', '2025-04-29 07:38:24.549');
INSERT INTO `api_log` VALUES (616, 'PUT', '/api/factory/141', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:41:43.408', '2025-04-29 07:41:43.409', '2025-04-29 07:41:43.409');
INSERT INTO `api_log` VALUES (617, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-29 07:41:49.815', '2025-04-29 07:41:49.817', '2025-04-29 07:41:49.817');
INSERT INTO `api_log` VALUES (618, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 07:41:52.985', '2025-04-29 07:41:52.987', '2025-04-29 07:41:52.987');
INSERT INTO `api_log` VALUES (619, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:42:06.777', '2025-04-29 07:42:06.781', '2025-04-29 07:42:06.781');
INSERT INTO `api_log` VALUES (620, 'PUT', '/api/factory/141', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:42:11.923', '2025-04-29 07:42:11.924', '2025-04-29 07:42:11.924');
INSERT INTO `api_log` VALUES (621, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 07:42:51.557', '2025-04-29 07:42:51.560', '2025-04-29 07:42:51.560');
INSERT INTO `api_log` VALUES (622, 'PUT', '/api/factory/141', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:42:54.149', '2025-04-29 07:42:54.150', '2025-04-29 07:42:54.150');
INSERT INTO `api_log` VALUES (623, 'PUT', '/api/factory/141', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 07:43:03.439', '2025-04-29 07:43:03.440', '2025-04-29 07:43:03.440');
INSERT INTO `api_log` VALUES (624, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:19:52.594', '2025-04-29 08:19:52.596', '2025-04-29 08:19:52.596');
INSERT INTO `api_log` VALUES (625, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 08:20:07.608', '2025-04-29 08:20:07.616', '2025-04-29 08:20:07.616');
INSERT INTO `api_log` VALUES (626, 'PUT', '/api/factory/141', '/rental/manage/', 'Fu An', 'vben', '2025-04-29 08:20:09.166', '2025-04-29 08:20:09.167', '2025-04-29 08:20:09.167');
INSERT INTO `api_log` VALUES (627, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:20:53.559', '2025-04-29 08:20:53.560', '2025-04-29 08:20:53.560');
INSERT INTO `api_log` VALUES (628, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:32:08.362', '2025-04-29 08:32:08.363', '2025-04-29 08:32:08.363');
INSERT INTO `api_log` VALUES (629, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 08:32:17.390', '2025-04-29 08:32:17.399', '2025-04-29 08:32:17.399');
INSERT INTO `api_log` VALUES (630, 'PUT', '/api/factory/143', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-29 08:32:18.882', '2025-04-29 08:32:18.884', '2025-04-29 08:32:18.884');
INSERT INTO `api_log` VALUES (631, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:32:21.803', '2025-04-29 08:32:21.805', '2025-04-29 08:32:21.805');
INSERT INTO `api_log` VALUES (632, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:33:04.767', '2025-04-29 08:33:04.768', '2025-04-29 08:33:04.768');
INSERT INTO `api_log` VALUES (633, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:33:26.938', '2025-04-29 08:33:26.940', '2025-04-29 08:33:26.940');
INSERT INTO `api_log` VALUES (634, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:33:50.302', '2025-04-29 08:33:50.303', '2025-04-29 08:33:50.303');
INSERT INTO `api_log` VALUES (635, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:34:27.296', '2025-04-29 08:34:27.298', '2025-04-29 08:34:27.298');
INSERT INTO `api_log` VALUES (636, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:34:52.328', '2025-04-29 08:34:52.330', '2025-04-29 08:34:52.330');
INSERT INTO `api_log` VALUES (637, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:43:43.336', '2025-04-29 08:43:43.338', '2025-04-29 08:43:43.338');
INSERT INTO `api_log` VALUES (638, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 08:43:56.585', '2025-04-29 08:43:56.590', '2025-04-29 08:43:56.590');
INSERT INTO `api_log` VALUES (639, 'PUT', '/api/dormitory/17', '/rental/manage/', 'A栋宿舍', 'vben', '2025-04-29 08:43:57.814', '2025-04-29 08:43:57.816', '2025-04-29 08:43:57.816');
INSERT INTO `api_log` VALUES (640, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 08:45:51.803', '2025-04-29 08:45:51.812', '2025-04-29 08:45:51.812');
INSERT INTO `api_log` VALUES (641, 'PUT', '/api/dormitory/17', '/rental/manage/', 'A栋宿舍', 'vben', '2025-04-29 08:45:53.146', '2025-04-29 08:45:53.148', '2025-04-29 08:45:53.148');
INSERT INTO `api_log` VALUES (642, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 08:46:35.916', '2025-04-29 08:46:35.925', '2025-04-29 08:46:35.925');
INSERT INTO `api_log` VALUES (643, 'PUT', '/api/dormitory/17', '/rental/manage/', 'A栋宿舍', 'vben', '2025-04-29 08:46:36.556', '2025-04-29 08:46:36.558', '2025-04-29 08:46:36.558');
INSERT INTO `api_log` VALUES (644, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:47:11.292', '2025-04-29 08:47:11.293', '2025-04-29 08:47:11.293');
INSERT INTO `api_log` VALUES (645, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 08:47:14.973', '2025-04-29 08:47:14.977', '2025-04-29 08:47:14.977');
INSERT INTO `api_log` VALUES (646, 'PUT', '/api/dormitory/16', '/rental/manage/', 'B栋宿舍', 'vben', '2025-04-29 08:47:16.185', '2025-04-29 08:47:16.186', '2025-04-29 08:47:16.186');
INSERT INTO `api_log` VALUES (647, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:47:28.595', '2025-04-29 08:47:28.597', '2025-04-29 08:47:28.597');
INSERT INTO `api_log` VALUES (648, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:48:55.051', '2025-04-29 08:48:55.052', '2025-04-29 08:48:55.052');
INSERT INTO `api_log` VALUES (649, 'PUT', '/api/dormitory/17', '/rental/manage/', 'A栋宿舍', 'vben', '2025-04-29 08:49:01.983', '2025-04-29 08:49:01.984', '2025-04-29 08:49:01.984');
INSERT INTO `api_log` VALUES (650, 'PUT', '/api/dormitory/17', '/rental/manage/', 'A栋宿舍', 'vben', '2025-04-29 08:49:06.204', '2025-04-29 08:49:06.204', '2025-04-29 08:49:06.204');
INSERT INTO `api_log` VALUES (651, 'PUT', '/api/dormitory/17', '/rental/manage/', 'A栋宿舍', 'vben', '2025-04-29 08:49:19.434', '2025-04-29 08:49:19.435', '2025-04-29 08:49:19.435');
INSERT INTO `api_log` VALUES (652, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 08:49:25.825', '2025-04-29 08:49:25.833', '2025-04-29 08:49:25.833');
INSERT INTO `api_log` VALUES (653, 'PUT', '/api/dormitory/17', '/rental/manage/', 'A栋宿舍', 'vben', '2025-04-29 08:49:26.748', '2025-04-29 08:49:26.749', '2025-04-29 08:49:26.749');
INSERT INTO `api_log` VALUES (654, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:49:34.784', '2025-04-29 08:49:34.785', '2025-04-29 08:49:34.785');
INSERT INTO `api_log` VALUES (655, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:49:37.789', '2025-04-29 08:49:37.789', '2025-04-29 08:49:37.789');
INSERT INTO `api_log` VALUES (656, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:49:38.024', '2025-04-29 08:49:38.025', '2025-04-29 08:49:38.025');
INSERT INTO `api_log` VALUES (657, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:49:44.943', '2025-04-29 08:49:44.944', '2025-04-29 08:49:44.944');
INSERT INTO `api_log` VALUES (658, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:49:50.192', '2025-04-29 08:49:50.194', '2025-04-29 08:49:50.194');
INSERT INTO `api_log` VALUES (659, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:49:54.974', '2025-04-29 08:49:54.975', '2025-04-29 08:49:54.975');
INSERT INTO `api_log` VALUES (660, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 08:50:00.372', '2025-04-29 08:50:00.373', '2025-04-29 08:50:00.373');
INSERT INTO `api_log` VALUES (661, 'POST', '/api/park', '/rental/manage/', '123', 'vben', '2025-04-29 08:50:11.332', '2025-04-29 08:50:11.333', '2025-04-29 08:50:11.333');
INSERT INTO `api_log` VALUES (662, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-29 08:50:22.168', '2025-04-29 08:50:22.173', '2025-04-29 08:50:22.173');
INSERT INTO `api_log` VALUES (663, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-29 08:50:26.288', '2025-04-29 08:50:26.289', '2025-04-29 08:50:26.289');
INSERT INTO `api_log` VALUES (664, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 08:51:56.982', '2025-04-29 08:51:56.983', '2025-04-29 08:51:56.983');
INSERT INTO `api_log` VALUES (665, 'POST', '/api/factory', '/rental/manage/', 'B栋建筑', 'vben', '2025-04-29 08:52:09.182', '2025-04-29 08:52:09.183', '2025-04-29 08:52:09.183');
INSERT INTO `api_log` VALUES (666, 'POST', '/api/factory', '/rental/manage/', 'B栋建筑', 'vben', '2025-04-29 08:52:35.650', '2025-04-29 08:52:35.651', '2025-04-29 08:52:35.651');
INSERT INTO `api_log` VALUES (667, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 08:54:12.188', '2025-04-29 08:54:12.189', '2025-04-29 08:54:12.189');
INSERT INTO `api_log` VALUES (668, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 08:54:34.267', '2025-04-29 08:54:34.268', '2025-04-29 08:54:34.268');
INSERT INTO `api_log` VALUES (669, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 08:54:41.498', '2025-04-29 08:54:41.500', '2025-04-29 08:54:41.500');
INSERT INTO `api_log` VALUES (670, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 08:55:03.155', '2025-04-29 08:55:03.157', '2025-04-29 08:55:03.157');
INSERT INTO `api_log` VALUES (671, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-29 08:55:13.698', '2025-04-29 08:55:13.700', '2025-04-29 08:55:13.700');
INSERT INTO `api_log` VALUES (672, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-29 08:55:21.109', '2025-04-29 08:55:21.110', '2025-04-29 08:55:21.110');
INSERT INTO `api_log` VALUES (673, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 08:59:51.585', '2025-04-29 08:59:51.586', '2025-04-29 08:59:51.586');
INSERT INTO `api_log` VALUES (674, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-29 08:59:58.791', '2025-04-29 08:59:58.793', '2025-04-29 08:59:58.793');
INSERT INTO `api_log` VALUES (675, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:00:13.721', '2025-04-29 09:00:13.722', '2025-04-29 09:00:13.722');
INSERT INTO `api_log` VALUES (676, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-29 09:00:34.682', '2025-04-29 09:00:34.683', '2025-04-29 09:00:34.683');
INSERT INTO `api_log` VALUES (677, 'POST', '/api/factory', '/rental/manage/', 'D栋建筑', 'vben', '2025-04-29 09:00:43.563', '2025-04-29 09:00:43.569', '2025-04-29 09:00:43.569');
INSERT INTO `api_log` VALUES (678, 'DELETE', '/api/factory/144', '/rental/manage/', '', 'vben', '2025-04-29 09:00:46.780', '2025-04-29 09:00:46.781', '2025-04-29 09:00:46.781');
INSERT INTO `api_log` VALUES (679, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:01:26.796', '2025-04-29 09:01:26.797', '2025-04-29 09:01:26.797');
INSERT INTO `api_log` VALUES (680, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:08:10.137', '2025-04-29 09:08:10.138', '2025-04-29 09:08:10.138');
INSERT INTO `api_log` VALUES (681, 'POST', '/api/factory', '/rental/manage/', 'B栋建筑', 'vben', '2025-04-29 09:08:15.048', '2025-04-29 09:08:15.048', '2025-04-29 09:08:15.048');
INSERT INTO `api_log` VALUES (682, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-29 09:11:28.589', '2025-04-29 09:11:28.591', '2025-04-29 09:11:28.591');
INSERT INTO `api_log` VALUES (683, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:11:32.942', '2025-04-29 09:11:32.944', '2025-04-29 09:11:32.944');
INSERT INTO `api_log` VALUES (684, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-29 09:11:40.510', '2025-04-29 09:11:40.512', '2025-04-29 09:11:40.512');
INSERT INTO `api_log` VALUES (685, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-29 09:12:04.054', '2025-04-29 09:12:04.055', '2025-04-29 09:12:04.055');
INSERT INTO `api_log` VALUES (686, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-29 09:12:29.304', '2025-04-29 09:12:29.305', '2025-04-29 09:12:29.305');
INSERT INTO `api_log` VALUES (687, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:12:35.773', '2025-04-29 09:12:35.774', '2025-04-29 09:12:35.774');
INSERT INTO `api_log` VALUES (688, 'POST', '/api/factory', '/rental/manage/', 'A栋建筑', 'vben', '2025-04-29 09:12:42.783', '2025-04-29 09:12:42.783', '2025-04-29 09:12:42.783');
INSERT INTO `api_log` VALUES (689, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:14:23.314', '2025-04-29 09:14:23.314', '2025-04-29 09:14:23.314');
INSERT INTO `api_log` VALUES (690, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:17:31.747', '2025-04-29 09:17:31.748', '2025-04-29 09:17:31.748');
INSERT INTO `api_log` VALUES (691, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:17:43.491', '2025-04-29 09:17:43.492', '2025-04-29 09:17:43.492');
INSERT INTO `api_log` VALUES (692, 'PUT', '/api/system/role/4', '/system/role', '普通账户', 'vben', '2025-04-29 09:18:09.047', '2025-04-29 09:18:09.049', '2025-04-29 09:18:09.049');
INSERT INTO `api_log` VALUES (693, 'POST', '/api/system/role', '/system/role', '财务', 'vben', '2025-04-29 09:19:00.207', '2025-04-29 09:19:00.208', '2025-04-29 09:19:00.208');
INSERT INTO `api_log` VALUES (694, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:21:29.890', '2025-04-29 09:21:29.891', '2025-04-29 09:21:29.891');
INSERT INTO `api_log` VALUES (695, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:21:32.463', '2025-04-29 09:21:32.464', '2025-04-29 09:21:32.464');
INSERT INTO `api_log` VALUES (696, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:21:56.775', '2025-04-29 09:21:56.777', '2025-04-29 09:21:56.777');
INSERT INTO `api_log` VALUES (697, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:22:08.681', '2025-04-29 09:22:08.682', '2025-04-29 09:22:08.682');
INSERT INTO `api_log` VALUES (698, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:23:55.683', '2025-04-29 09:23:55.684', '2025-04-29 09:23:55.684');
INSERT INTO `api_log` VALUES (699, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:24:17.474', '2025-04-29 09:24:17.475', '2025-04-29 09:24:17.475');
INSERT INTO `api_log` VALUES (700, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:25:53.443', '2025-04-29 09:25:53.444', '2025-04-29 09:25:53.444');
INSERT INTO `api_log` VALUES (701, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:26:00.397', '2025-04-29 09:26:00.399', '2025-04-29 09:26:00.399');
INSERT INTO `api_log` VALUES (702, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:26:28.061', '2025-04-29 09:26:28.063', '2025-04-29 09:26:28.063');
INSERT INTO `api_log` VALUES (703, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:26:33.244', '2025-04-29 09:26:33.245', '2025-04-29 09:26:33.245');
INSERT INTO `api_log` VALUES (704, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:30:31.321', '2025-04-29 09:30:31.322', '2025-04-29 09:30:31.322');
INSERT INTO `api_log` VALUES (705, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:30:35.387', '2025-04-29 09:30:35.388', '2025-04-29 09:30:35.388');
INSERT INTO `api_log` VALUES (706, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:31:20.266', '2025-04-29 09:31:20.267', '2025-04-29 09:31:20.267');
INSERT INTO `api_log` VALUES (707, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:31:40.849', '2025-04-29 09:31:40.850', '2025-04-29 09:31:40.850');
INSERT INTO `api_log` VALUES (708, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:31:54.586', '2025-04-29 09:31:54.587', '2025-04-29 09:31:54.587');
INSERT INTO `api_log` VALUES (709, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:35:15.516', '2025-04-29 09:35:15.517', '2025-04-29 09:35:15.517');
INSERT INTO `api_log` VALUES (710, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:35:49.349', '2025-04-29 09:35:49.351', '2025-04-29 09:35:49.351');
INSERT INTO `api_log` VALUES (711, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:36:00.014', '2025-04-29 09:36:00.015', '2025-04-29 09:36:00.015');
INSERT INTO `api_log` VALUES (712, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:36:16.518', '2025-04-29 09:36:16.519', '2025-04-29 09:36:16.519');
INSERT INTO `api_log` VALUES (713, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:39:17.050', '2025-04-29 09:39:17.052', '2025-04-29 09:39:17.052');
INSERT INTO `api_log` VALUES (714, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:39:27.090', '2025-04-29 09:39:27.091', '2025-04-29 09:39:27.091');
INSERT INTO `api_log` VALUES (715, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:53:01.033', '2025-04-29 09:53:01.034', '2025-04-29 09:53:01.034');
INSERT INTO `api_log` VALUES (716, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-29 09:53:39.081', '2025-04-29 09:53:39.081', '2025-04-29 09:53:39.081');
INSERT INTO `api_log` VALUES (717, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-30 01:13:24.776', '2025-04-30 01:13:24.777', '2025-04-30 01:13:24.777');
INSERT INTO `api_log` VALUES (718, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-30 01:15:43.325', '2025-04-30 01:15:43.326', '2025-04-30 01:15:43.326');
INSERT INTO `api_log` VALUES (719, 'POST', '/api/factory', '/rental/manage/', 'B栋建筑', 'vben', '2025-04-30 01:15:51.243', '2025-04-30 01:15:51.245', '2025-04-30 01:15:51.245');
INSERT INTO `api_log` VALUES (720, 'POST', '/api/dormitory', '/rental/manage/', 'B栋宿舍', 'vben', '2025-04-30 01:17:35.916', '2025-04-30 01:17:35.917', '2025-04-30 01:17:35.917');
INSERT INTO `api_log` VALUES (721, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-30 01:17:38.947', '2025-04-30 01:17:38.948', '2025-04-30 01:17:38.948');
INSERT INTO `api_log` VALUES (722, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-30 01:17:42.004', '2025-04-30 01:17:42.005', '2025-04-30 01:17:42.005');
INSERT INTO `api_log` VALUES (723, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-30 01:17:44.461', '2025-04-30 01:17:44.462', '2025-04-30 01:17:44.462');
INSERT INTO `api_log` VALUES (724, 'POST', '/api/image/upload', '/rental/manage/', '', 'vben', '2025-04-30 01:17:46.895', '2025-04-30 01:17:46.897', '2025-04-30 01:17:46.897');
INSERT INTO `api_log` VALUES (725, 'PUT', '/api/dormitory/19', '/rental/manage/', 'B栋宿舍', 'vben', '2025-04-30 01:17:47.812', '2025-04-30 01:17:47.813', '2025-04-30 01:17:47.813');
INSERT INTO `api_log` VALUES (726, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-30 01:17:59.582', '2025-04-30 01:17:59.583', '2025-04-30 01:17:59.583');
INSERT INTO `api_log` VALUES (727, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-30 01:18:02.514', '2025-04-30 01:18:02.515', '2025-04-30 01:18:02.515');
INSERT INTO `api_log` VALUES (728, 'DELETE', '/api/system/park/7', '/rental/manage/', '', 'vben', '2025-04-30 06:08:32.002', '2025-04-30 06:08:32.004', '2025-04-30 06:08:32.004');
INSERT INTO `api_log` VALUES (729, 'PUT', '/api/park/7', '/rental/manage/', '123', 'vben', '2025-04-30 06:08:56.893', '2025-04-30 06:08:56.894', '2025-04-30 06:08:56.894');
INSERT INTO `api_log` VALUES (730, 'DELETE', '/api/factory/145', '/rental/manage/', '', 'vben', '2025-04-30 06:08:58.395', '2025-04-30 06:08:58.395', '2025-04-30 06:08:58.395');
INSERT INTO `api_log` VALUES (731, 'DELETE', '/api/dormitory/19', '/rental/manage/', '', 'vben', '2025-04-30 06:09:00.731', '2025-04-30 06:09:00.732', '2025-04-30 06:09:00.732');
INSERT INTO `api_log` VALUES (732, 'DELETE', '/api/system/park/7', '/rental/manage/', '', 'vben', '2025-04-30 06:09:03.336', '2025-04-30 06:09:03.337', '2025-04-30 06:09:03.337');
INSERT INTO `api_log` VALUES (733, 'DELETE', '/api/system/park/7', '/rental/manage/', '', 'vben', '2025-04-30 06:13:57.997', '2025-04-30 06:13:57.999', '2025-04-30 06:13:57.999');
INSERT INTO `api_log` VALUES (734, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-30 06:14:09.718', '2025-04-30 06:14:09.719', '2025-04-30 06:14:09.719');
INSERT INTO `api_log` VALUES (735, 'DELETE', '/api/system/park/1', '/rental/manage/', '', 'vben', '2025-04-30 06:14:13.394', '2025-04-30 06:14:13.395', '2025-04-30 06:14:13.395');
INSERT INTO `api_log` VALUES (736, 'POST', '/api/park', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-30 06:38:22.708', '2025-04-30 06:38:22.709', '2025-04-30 06:38:22.709');
INSERT INTO `api_log` VALUES (737, 'DELETE', '/api/system/park/8', '/rental/manage/', '', 'vben', '2025-04-30 06:38:26.401', '2025-04-30 06:38:26.403', '2025-04-30 06:38:26.403');
INSERT INTO `api_log` VALUES (738, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-30 07:32:42.943', '2025-04-30 07:32:42.944', '2025-04-30 07:32:42.944');
INSERT INTO `api_log` VALUES (739, 'PUT', '/api/park/3', '/rental/manage/', '十一产业园（深圳）', 'vben', '2025-04-30 07:38:01.915', '2025-04-30 07:38:01.916', '2025-04-30 07:38:01.916');
INSERT INTO `api_log` VALUES (740, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-30 07:44:47.033', '2025-04-30 07:44:47.034', '2025-04-30 07:44:47.034');
INSERT INTO `api_log` VALUES (741, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-30 07:45:50.611', '2025-04-30 07:45:50.612', '2025-04-30 07:45:50.612');
INSERT INTO `api_log` VALUES (742, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-30 07:47:37.356', '2025-04-30 07:47:37.357', '2025-04-30 07:47:37.357');
INSERT INTO `api_log` VALUES (743, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-30 07:48:43.741', '2025-04-30 07:48:43.742', '2025-04-30 07:48:43.742');
INSERT INTO `api_log` VALUES (744, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-04-30 08:24:54.813', '2025-04-30 08:24:54.814', '2025-04-30 08:24:54.814');
INSERT INTO `api_log` VALUES (745, 'POST', '/api/park', '/rental/manage/', '312', 'vben', '2025-04-30 08:25:27.776', '2025-04-30 08:25:27.777', '2025-04-30 08:25:27.777');
INSERT INTO `api_log` VALUES (746, 'PUT', '/api/park/9', '/rental/manage/', '312', 'vben', '2025-04-30 08:26:53.640', '2025-04-30 08:26:53.641', '2025-04-30 08:26:53.641');
INSERT INTO `api_log` VALUES (747, 'DELETE', '/api/system/park/9', '/rental/manage/', '', 'vben', '2025-05-05 01:14:02.956', '2025-05-05 01:14:02.957', '2025-05-05 01:14:02.957');
INSERT INTO `api_log` VALUES (748, 'POST', '/api/reimbursement', '/reimbursement/application', 'asd', 'vben', '2025-05-05 02:46:44.298', '2025-05-05 02:46:44.302', '2025-05-05 02:46:44.302');
INSERT INTO `api_log` VALUES (749, 'DELETE', '/api/reimbursement/26', '/audit', '', 'vben', '2025-05-05 02:46:57.141', '2025-05-05 02:46:57.142', '2025-05-05 02:46:57.142');
INSERT INTO `api_log` VALUES (750, 'DELETE', '/api/reimbursement/26', '/audit', '', 'vben', '2025-05-05 02:47:16.436', '2025-05-05 02:47:16.438', '2025-05-05 02:47:16.438');
INSERT INTO `api_log` VALUES (751, 'DELETE', '/api/reimbursement/26', '/audit', '', 'vben', '2025-05-05 02:47:35.546', '2025-05-05 02:47:35.548', '2025-05-05 02:47:35.548');
INSERT INTO `api_log` VALUES (752, 'DELETE', '/api/reimbursement/26', '/audit', '', 'vben', '2025-05-05 02:47:42.268', '2025-05-05 02:47:42.270', '2025-05-05 02:47:42.270');
INSERT INTO `api_log` VALUES (753, 'PUT', '/api/rental/tenant/84', '/rental/tenant/', 'Zeng Zitao', 'vben', '2025-05-05 02:49:40.357', '2025-05-05 02:49:40.359', '2025-05-05 02:49:40.359');
INSERT INTO `api_log` VALUES (754, 'DELETE', '/api/reimbursement/26', '/audit', '', 'vben', '2025-05-05 02:49:54.584', '2025-05-05 02:49:54.586', '2025-05-05 02:49:54.586');
INSERT INTO `api_log` VALUES (755, 'POST', '/api/rental/tenant', '/rental/tenant/', '4e123', 'vben', '2025-05-05 02:50:57.500', '2025-05-05 02:50:57.501', '2025-05-05 02:50:57.501');
INSERT INTO `api_log` VALUES (756, 'PUT', '/api/rental/tenant/84', '/rental/tenant/', 'Zeng Zitao', 'vben', '2025-05-05 02:51:38.471', '2025-05-05 02:51:38.473', '2025-05-05 02:51:38.473');
INSERT INTO `api_log` VALUES (757, 'PUT', '/api/rental/tenant/84', '/rental/tenant/', 'Zeng Zitao', 'vben', '2025-05-05 02:55:59.433', '2025-05-05 02:55:59.435', '2025-05-05 02:55:59.435');
INSERT INTO `api_log` VALUES (758, 'PUT', '/api/rental/tenant/84', '/rental/tenant/', 'Zeng Zitao', 'vben', '2025-05-05 02:56:37.593', '2025-05-05 02:56:37.594', '2025-05-05 02:56:37.594');
INSERT INTO `api_log` VALUES (759, 'PUT', '/api/rental/tenant/84', '/rental/tenant/', 'Zeng Zitao', 'vben', '2025-05-05 03:08:32.265', '2025-05-05 03:08:32.267', '2025-05-05 03:08:32.267');
INSERT INTO `api_log` VALUES (760, 'PUT', '/api/rental/tenant/84', '/rental/tenant/', 'Zeng Zitao', 'vben', '2025-05-05 03:12:10.936', '2025-05-05 03:12:10.937', '2025-05-05 03:12:10.937');
INSERT INTO `api_log` VALUES (761, 'PUT', '/api/rental/tenant/84', '/rental/tenant/', 'Zeng Zitao', 'vben', '2025-05-05 03:12:17.739', '2025-05-05 03:12:17.741', '2025-05-05 03:12:17.741');
INSERT INTO `api_log` VALUES (762, 'DELETE', '/api/reimbursement/26', '/audit', '', 'vben', '2025-05-05 03:14:43.323', '2025-05-05 03:14:43.324', '2025-05-05 03:14:43.324');
INSERT INTO `api_log` VALUES (763, 'DELETE', '/api/reimbursement/26', '/audit', '', 'vben', '2025-05-05 03:15:36.728', '2025-05-05 03:15:36.729', '2025-05-05 03:15:36.729');
INSERT INTO `api_log` VALUES (764, 'DELETE', '/api/reimbursement/26', '/audit', '', 'vben', '2025-05-05 03:16:18.712', '2025-05-05 03:16:18.714', '2025-05-05 03:16:18.714');
INSERT INTO `api_log` VALUES (765, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-05-05 03:17:23.801', '2025-05-05 03:17:23.803', '2025-05-05 03:17:23.803');
INSERT INTO `api_log` VALUES (766, 'PUT', '/api/park/1', '/rental/manage/', '十一产业园（东莞）', 'vben', '2025-05-05 03:17:27.029', '2025-05-05 03:17:27.031', '2025-05-05 03:17:27.031');
INSERT INTO `api_log` VALUES (767, 'PUT', '/api/rental/tenant/84', '/rental/tenant/', 'Zeng Zitao', 'vben', '2025-05-05 03:21:00.457', '2025-05-05 03:21:00.459', '2025-05-05 03:21:00.459');
INSERT INTO `api_log` VALUES (768, 'PUT', '/api/rental/tenant/84', '/rental/tenant/', 'Zeng Zitao', 'vben', '2025-05-05 03:21:15.846', '2025-05-05 03:21:15.848', '2025-05-05 03:21:15.848');
INSERT INTO `api_log` VALUES (769, 'PUT', '/api/rental/tenant/86', '/rental/tenant/', 'Liang Ziyi', 'vben', '2025-05-05 03:26:40.588', '2025-05-05 03:26:40.590', '2025-05-05 03:26:40.590');

-- ----------------------------
-- Table structure for dormitory
-- ----------------------------
DROP TABLE IF EXISTS `dormitory`;
CREATE TABLE `dormitory`  (
  `dormitory_id` int NOT NULL AUTO_INCREMENT,
  `park_id` int NOT NULL,
  `dormitory_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `floor_count` int NOT NULL,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `floor_height_first` decimal(5, 2) NULL DEFAULT NULL,
  `floor_height_other` decimal(5, 2) NULL DEFAULT NULL,
  `remark` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `rent_price_first` decimal(10, 2) NULL DEFAULT NULL,
  `rent_price_other` decimal(10, 2) NULL DEFAULT NULL,
  `room_area` decimal(10, 2) NULL DEFAULT NULL,
  `total_rooms` int NOT NULL DEFAULT 20,
  `used_rooms_first` int NOT NULL DEFAULT 0,
  `used_rooms_other` int NOT NULL DEFAULT 0,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`dormitory_id`) USING BTREE,
  INDEX `dormitory_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 20 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of dormitory
-- ----------------------------
INSERT INTO `dormitory` VALUES (16, 3, 'B栋宿舍', 0, '2025-04-26 02:56:28.610', '2025-04-29 08:47:16.182', 0.00, 0.00, NULL, 0.00, 0.00, 0.00, 0, 0, 0, 0);
INSERT INTO `dormitory` VALUES (17, 3, 'A栋宿舍', 0, '2025-04-29 07:26:04.507', '2025-04-29 08:49:26.745', 0.00, 0.00, NULL, 0.00, 0.00, 0.00, 0, 0, 0, 0);

-- ----------------------------
-- Table structure for dormitory_image
-- ----------------------------
DROP TABLE IF EXISTS `dormitory_image`;
CREATE TABLE `dormitory_image`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `dormitory_id` int NOT NULL,
  `img_id` int NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `dormitory_image_dormitory_id_key`(`dormitory_id` ASC) USING BTREE,
  UNIQUE INDEX `dormitory_image_img_id_key`(`img_id` ASC) USING BTREE,
  INDEX `dormitory_image_dormitory_id_idx`(`dormitory_id` ASC) USING BTREE,
  INDEX `dormitory_image_img_id_idx`(`img_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of dormitory_image
-- ----------------------------
INSERT INTO `dormitory_image` VALUES (2, 16, 61, '2025-04-29 08:47:16.183', '2025-04-29 08:47:16.183');
INSERT INTO `dormitory_image` VALUES (5, 17, 59, '2025-04-29 08:49:26.746', '2025-04-29 08:49:26.746');

-- ----------------------------
-- Table structure for ele_bill
-- ----------------------------
DROP TABLE IF EXISTS `ele_bill`;
CREATE TABLE `ele_bill`  (
  `ele_id` int NOT NULL AUTO_INCREMENT,
  `bill_id` int NOT NULL,
  `meter_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_reading` decimal(10, 2) NULL DEFAULT 0.00,
  `current_reading` decimal(10, 2) NULL DEFAULT 0.00,
  `monthly_usage` decimal(10, 2) NULL DEFAULT 0.00,
  `multiplier` decimal(10, 2) NULL DEFAULT 0.00,
  `total_usage` decimal(10, 2) NULL DEFAULT 0.00,
  `unit_price` decimal(10, 8) NULL DEFAULT 0.00000000,
  `amount` decimal(10, 2) NULL DEFAULT 0.00,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `receipt_time` datetime(3) NOT NULL,
  `remark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `update_time` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`ele_id`) USING BTREE,
  INDEX `ele_bill_bill_id_idx`(`bill_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 18 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of ele_bill
-- ----------------------------
INSERT INTO `ele_bill` VALUES (1, 1, '', 0.00, 1.00, 1.00, 1.00, 1.00, 1.00000000, 1.00, '2025-04-14 01:18:33.920', '2025-04-14 01:18:17.416', '', '2025-04-14 01:18:33.920');
INSERT INTO `ele_bill` VALUES (2, 2, '尖', 882.00, 911.28, 29.28, 120.00, 3513.60, 1.20236875, 4224.64, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `ele_bill` VALUES (3, 2, '峰', 1171.00, 1209.77, 38.77, 120.00, 4652.40, 1.20236875, 5593.90, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `ele_bill` VALUES (4, 2, '平', 2443.00, 2524.90, 81.90, 120.00, 9828.00, 0.71866750, 7063.06, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `ele_bill` VALUES (5, 2, '谷', 2069.00, 2134.28, 65.28, 120.00, 7833.60, 0.29026875, 2273.85, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `ele_bill` VALUES (6, 2, '办公室用电', 1947.50, 1976.60, 29.10, 60.00, 1746.00, 1.20000000, 2095.20, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `ele_bill` VALUES (7, 2, '宿舍热水电表', 9833.00, 10306.00, 473.00, 1.00, 473.00, 1.20000000, 567.60, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `ele_bill` VALUES (8, 2, '宿舍用电（401-410）', 37383.00, 37526.00, 143.00, 1.00, 143.00, 1.20000000, 171.60, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `ele_bill` VALUES (9, 2, '公共用电', 0.00, 0.00, 2800.00, 1.00, 2800.00, 0.20000000, 560.00, '2025-04-16 08:16:52.159', '2025-04-16 07:56:41.769', '', '2025-04-16 08:16:52.159');
INSERT INTO `ele_bill` VALUES (13, 2, '合计', 0.00, 0.00, 0.00, 1.00, 28189.60, 0.00000000, 22549.85, '2025-04-16 08:48:46.660', '2025-04-16 07:56:41.769', '', '2025-04-16 08:48:46.660');
INSERT INTO `ele_bill` VALUES (14, 1, '', 0.00, 0.00, 0.00, 1.00, 0.00, 0.00000000, 0.00, '2025-04-29 05:42:35.664', '2025-04-14 01:18:17.416', '', '2025-04-29 05:42:35.664');
INSERT INTO `ele_bill` VALUES (15, 1, '合计', 0.00, 0.00, 0.00, 1.00, 1.00, 0.00000000, 1.00, '2025-04-29 05:42:35.664', '2025-04-14 01:18:17.416', '', '2025-04-29 05:42:35.664');
INSERT INTO `ele_bill` VALUES (16, 1, '', 0.00, 0.00, 0.00, 1.00, 0.00, 0.00000000, 0.00, '2025-04-29 05:43:28.795', '2025-04-14 01:18:17.416', '', '2025-04-29 05:43:28.795');
INSERT INTO `ele_bill` VALUES (17, 1, '合计', 0.00, 0.00, 0.00, 1.00, 1.00, 0.00000000, 1.00, '2025-04-29 05:43:28.795', '2025-04-14 01:18:17.416', '', '2025-04-29 05:43:28.795');

-- ----------------------------
-- Table structure for factory
-- ----------------------------
DROP TABLE IF EXISTS `factory`;
CREATE TABLE `factory`  (
  `factory_id` int NOT NULL AUTO_INCREMENT,
  `factory_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `park_id` int NOT NULL,
  `build_time` date NOT NULL,
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`factory_id`) USING BTREE,
  INDEX `factory_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 146 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of factory
-- ----------------------------
INSERT INTO `factory` VALUES (141, 'Fu An', 3, '2025-04-25', '772 Bank Street', '111', 'Anyone who has ever made anything of importance was disciplined. Navicat Monitor is a safe, simple and agentless remote server monitoring tool that is packed with powerful features to make your monitoring effective as possible.', '2025-04-23 07:49:11.025', '2025-04-29 08:20:09.157', 0);
INSERT INTO `factory` VALUES (143, 'A栋建筑', 3, '2025-04-26', '1233', '123', NULL, '2025-04-26 06:06:36.950', '2025-04-29 08:32:18.878', 0);

-- ----------------------------
-- Table structure for factory_floor
-- ----------------------------
DROP TABLE IF EXISTS `factory_floor`;
CREATE TABLE `factory_floor`  (
  `floor_id` int NOT NULL AUTO_INCREMENT,
  `floor_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `factory_id` int NOT NULL,
  `floor_height` decimal(5, 2) NULL DEFAULT NULL,
  `load_bearing` decimal(10, 2) NULL DEFAULT NULL,
  `rent_price` decimal(10, 2) NOT NULL,
  `total_area` decimal(10, 2) NOT NULL,
  `used_area` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`floor_id`) USING BTREE,
  INDEX `factory_floor_factory_id_idx`(`factory_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 127 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of factory_floor
-- ----------------------------
INSERT INTO `factory_floor` VALUES (124, '1层', 141, 0.00, 0.00, 0.00, 0.00, 0.00, '空闲', '', '2025-04-29 07:43:03.434', '2025-04-29 07:43:03.434', 0);
INSERT INTO `factory_floor` VALUES (125, '2层', 141, 0.00, 0.00, 0.00, 0.00, 0.00, '空闲', '', '2025-04-29 08:20:09.163', '2025-04-29 08:20:09.163', 0);
INSERT INTO `factory_floor` VALUES (126, '1层', 143, 0.00, 0.00, 0.00, 0.00, 0.00, '空闲', '', '2025-04-29 08:32:18.880', '2025-04-29 08:32:18.880', 0);

-- ----------------------------
-- Table structure for factory_floor_image
-- ----------------------------
DROP TABLE IF EXISTS `factory_floor_image`;
CREATE TABLE `factory_floor_image`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `floor_id` int NOT NULL,
  `img_id` int NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `factory_floor_image_floor_id_img_id_key`(`floor_id` ASC, `img_id` ASC) USING BTREE,
  INDEX `factory_floor_image_floor_id_idx`(`floor_id` ASC) USING BTREE,
  INDEX `factory_floor_image_img_id_idx`(`img_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 88 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of factory_floor_image
-- ----------------------------

-- ----------------------------
-- Table structure for finance
-- ----------------------------
DROP TABLE IF EXISTS `finance`;
CREATE TABLE `finance`  (
  `finance_id` int NOT NULL AUTO_INCREMENT,
  `bill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `bill_category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10, 2) NOT NULL,
  `transaction_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `transaction_time` datetime(3) NOT NULL,
  `remark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `park_id` int NULL DEFAULT NULL,
  PRIMARY KEY (`finance_id`) USING BTREE,
  INDEX `finance_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of finance
-- ----------------------------
INSERT INTO `finance` VALUES (1, '水费', '水费', 888.00, '收入', '2025-04-12 02:59:08.000', NULL, '2025-04-12 02:59:23.852', '2025-04-14 01:40:42.648', 1);
INSERT INTO `finance` VALUES (2, '电费', '电费', 500.00, '支出', '2025-04-12 06:09:02.000', NULL, '2025-04-12 06:09:14.383', '2025-04-14 01:40:38.946', 2);
INSERT INTO `finance` VALUES (3, '网络费用', '其他费用', 600.00, '支出', '2025-04-14 01:30:23.000', NULL, '2025-04-14 01:21:12.565', '2025-04-14 07:00:58.634', 1);
INSERT INTO `finance` VALUES (4, '房租', '房租', 5000.00, '收入', '2025-04-14 09:51:57.181', NULL, '2025-04-14 09:52:07.648', '2025-04-14 09:52:07.648', 1);
INSERT INTO `finance` VALUES (5, '3123', '房租', 1411.00, '支出', '2025-04-15 06:02:03.000', NULL, '2025-04-15 06:02:09.836', '2025-04-25 03:46:17.139', 2);
INSERT INTO `finance` VALUES (6, '电费', '房租', 16000.00, '收入', '2025-04-15 06:08:30.983', NULL, '2025-04-15 06:08:43.271', '2025-04-15 06:08:43.271', NULL);
INSERT INTO `finance` VALUES (7, '111', '房租', 1.00, '支出', '2025-04-25 03:52:41.000', NULL, '2025-04-25 03:52:49.378', '2025-04-25 07:56:06.043', 1);

-- ----------------------------
-- Table structure for firefighting
-- ----------------------------
DROP TABLE IF EXISTS `firefighting`;
CREATE TABLE `firefighting`  (
  `firefighting_id` int NOT NULL AUTO_INCREMENT,
  `firefighting_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `extinguisher` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `fire_exit` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `checker` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `remark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `check_time` datetime(3) NOT NULL,
  `hydrant` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `factory_id` int NOT NULL DEFAULT 20,
  `img_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `park_id` int NOT NULL,
  PRIMARY KEY (`firefighting_id`) USING BTREE,
  INDEX `firefighting_factory_id_idx`(`factory_id` ASC) USING BTREE,
  INDEX `firefighting_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1002 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of firefighting
-- ----------------------------
INSERT INTO `firefighting` VALUES (1, 'A6blYVUn6w', '792 4th Section  Renmin South Road, Jinjiang District', '维护', '异常', '邓嘉伦', 'cB66NMhBgB', '2022-07-28 08:52:32.000', '2019-02-18 20:29:17.000', '2001-12-23 02:52:05.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (2, 'uwUGDOcI3p', '13 Spring Gardens', '正常', '异常', '赵詩涵', 'LyLvp5ykw3', '2016-09-26 00:36:43.000', '2002-05-30 16:22:25.000', '2017-12-03 18:29:17.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (3, 'VRCFYLQUJw', '110 Tianhe Road, Tianhe District', '维护', '正常', '卢宇宁', 'zDJLIF71Nv', '2014-10-09 22:09:57.000', '2014-05-17 07:07:32.000', '2017-03-03 13:36:55.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (4, '0H2Y2kTKGD', '888 Cyril St, Braunstone Town', '维护', '异常', '夏宇宁', 'UaytEfA5HL', '2009-11-07 09:05:18.000', '2013-03-24 21:55:16.000', '2016-03-25 16:08:28.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (5, 'ElLiAzso87', '942 Elms Rd, Botley', '正常', '异常', '蒋晓明', 'VsrDN45swx', '2002-04-23 00:40:02.000', '2006-09-23 17:13:57.000', '2003-01-08 21:01:22.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (6, '2eVOCMM3bq', '6-1-3, Miyanomori 4 Jō, Chuo Ward', '维护', '正常', '苏嘉伦', 'Alyb0OYqOX', '2005-07-26 21:14:27.000', '2013-03-30 01:44:58.000', '2013-05-17 13:23:01.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (7, 'je6OEaiuri', '492 Portland St', '正常', '异常', '韦睿', '8PbZarlbsY', '2024-12-11 21:31:07.000', '2002-03-13 20:32:57.000', '2005-08-10 09:25:49.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (8, 'aRKp7RgeKM', '62 Hanover Street', '维护', '异常', '姚岚', 'Eeoco8Dp6O', '2005-08-16 19:33:06.000', '2003-08-17 16:42:12.000', '2010-03-22 06:43:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (9, '15XDdDpSdH', '354 Trafalgar Square, Charing Cross', '异常', '维护', '汤致远', 'l8Kdgm6BNG', '2018-05-18 13:24:04.000', '2008-04-21 05:54:31.000', '2012-11-22 19:16:56.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (10, 'D1oXKMUsUO', '39 1st Ave', '正常', '维护', '冯睿', 'EILACZkHca', '2022-01-14 08:17:46.000', '2001-10-23 12:59:30.000', '2007-03-12 14:12:03.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (11, '2Lar7LzfsN', '775 Zhongshan 5th Rd, Zimaling Shangquan', '维护', '正常', '顾子韬', 'dkqjzTqPlu', '2011-06-06 05:53:48.000', '2003-01-07 06:38:30.000', '2012-03-18 17:25:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (12, 'AbzVuxac9H', '16 3-803 Kusunokiajima, Kita Ward', '异常', '维护', '任睿', 'DWmHO0nCAL', '2017-08-20 22:48:19.000', '2023-10-17 20:56:17.000', '2005-07-27 14:32:13.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (13, '5tgN1bZYPg', '899 Dongtai 5th St', '异常', '异常', '朱安琪', 'kdNiotrLv2', '2011-09-26 17:25:27.000', '2021-10-31 10:22:33.000', '2012-10-07 13:37:56.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (14, 'WL86xGKFB3', '670 028 County Rd, Yanqing District', '维护', '维护', '孟岚', 'p9WChmkBja', '2019-12-19 05:16:30.000', '2007-08-19 13:15:55.000', '2017-07-31 18:28:06.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (15, '9m6yqnHGbr', '375 Diplomacy Drive', '异常', '维护', '罗致远', 'N85g8qVTF2', '2014-06-04 10:13:10.000', '2015-06-12 00:02:34.000', '2011-08-28 07:21:44.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (16, 'RBkyoGZpTR', '1-1-12 Deshiro, Nishinari Ward', '维护', '维护', '刘安琪', 'u1xJBZMQgw', '2017-03-27 13:30:00.000', '2015-08-25 08:32:36.000', '2022-08-01 15:35:17.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (17, 'WWfG34eKbS', '507 New Wakefield St', '异常', '维护', '龙子韬', '0sj0sTeVAR', '2016-10-06 07:14:08.000', '2013-03-30 22:55:10.000', '2015-01-15 19:17:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (18, 'QptsFJB1QE', '232 Osney Mead', '正常', '异常', '邓嘉伦', 'Nsv9gArbfx', '2010-09-17 03:24:06.000', '2002-04-18 23:28:05.000', '2006-05-13 20:27:19.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (19, '8ShlsrViZe', '610 Bank Street', '维护', '正常', '汪宇宁', 'IxkhOaBgih', '2014-10-23 23:28:01.000', '2006-03-05 01:56:06.000', '2011-01-26 07:21:51.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (20, 'JUX3VLVoIW', '84 Jianxiang Rd, Pudong', '异常', '异常', '郭宇宁', 'dJgUFIvjOm', '2003-06-16 12:28:22.000', '2002-07-14 05:56:45.000', '2010-11-17 14:19:47.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (21, 'Wv6bf0gUu5', '803 Tangyuan Street 5th Alley, Airport Road, Baiyun', '异常', '异常', '贺秀英', 'tqwXjiTeCq', '2002-09-23 17:03:13.000', '2020-01-13 01:10:15.000', '2018-05-08 22:55:51.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (22, 'u0tNR1uqO5', '645 Volac Park, Grantchester Rd', '维护', '异常', '蔡子异', 'kLFdJJT6PU', '2009-01-11 03:22:30.000', '2022-11-28 21:01:31.000', '2017-08-25 21:26:24.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (23, 'B9J0walbOz', '98 Tianhe Road, Tianhe District', '维护', '维护', '侯岚', '14wyz2RmWG', '2020-08-31 07:02:13.000', '2001-07-18 13:58:05.000', '2002-01-24 01:13:38.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (24, 'SO0BENKbng', '30 Lefeng 6th Rd', '维护', '维护', '韩致远', 'P10Y8g2M1z', '2003-09-06 20:25:34.000', '2000-08-08 18:59:45.000', '2024-05-15 09:29:20.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (25, 'PaZZR3UAsO', '676 Pedway', '正常', '异常', '钟岚', 'IT3mbeUpVi', '2008-01-06 22:16:03.000', '2018-07-03 07:49:01.000', '2005-11-27 21:05:59.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (26, '7rcSRmub4C', '161 Tianbei 1st Rd, Luohu District', '异常', '异常', '贺睿', 'Y8cDyY3Ram', '2011-07-02 06:42:57.000', '2023-05-29 03:32:51.000', '2024-02-29 21:15:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (27, '0O9AlVUBdQ', '619 Diplomacy Drive', '维护', '异常', '黄岚', 'gfadjED1Vv', '2010-02-07 18:04:36.000', '2022-11-02 22:59:39.000', '2009-10-22 04:05:12.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (28, '2OTeXqswDN', '107 Mosley St', '正常', '异常', '胡云熙', 'tyrwpaTZZk', '2016-09-06 13:54:40.000', '2003-10-03 18:13:07.000', '2008-06-24 02:35:18.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (29, 'mviIHvUw2W', '128 Shennan Ave, Futian District', '异常', '正常', '张晓明', 'qra5azZ1Te', '2000-03-26 13:46:33.000', '2006-01-24 21:17:14.000', '2018-03-12 18:05:44.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (30, 'QmvxQ5eOYU', '981 Zhongshan 5th Rd, Zimaling Shangquan', '正常', '正常', '徐秀英', 'd2ezCHn25I', '2000-01-17 02:47:44.000', '2001-03-23 00:55:20.000', '2011-06-05 00:11:37.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (31, '3xYo6l5Irl', '1-6-19, Marunouchi, Chiyoda-ku', '正常', '维护', '潘岚', '9yV9EClZ5s', '2018-11-25 20:15:06.000', '2008-02-10 04:25:36.000', '2019-12-23 16:15:24.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (32, 'U6eG4skajo', '460 Redfern St', '正常', '异常', '孔安琪', 'CUeVm7llKt', '2005-06-24 16:13:10.000', '2018-12-26 07:35:40.000', '2001-09-25 10:51:53.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (33, 'NuO8FS0xp1', '6-1-16, Miyanomori 4 Jō, Chuo Ward', '维护', '维护', '陶致远', 'YMfkQ9QDPl', '2004-10-06 20:50:10.000', '2010-05-12 15:58:13.000', '2024-07-10 04:32:51.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (34, 'GZKvcqAomd', '334 Columbia St', '异常', '异常', '萧宇宁', 's43boQWBkN', '2005-09-04 17:58:08.000', '2023-07-15 06:35:45.000', '2024-03-23 14:02:32.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (35, 'nM05Fz9mqe', '502 Hongqiao Rd., Xu Hui District', '维护', '正常', '余安琪', '0OqX09rjey', '2018-11-28 01:01:27.000', '2003-11-01 18:09:36.000', '2001-05-22 21:37:34.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (36, 'sMrl5fQkGk', '110 49/50 Strand, Charing Cross', '正常', '正常', '刘杰宏', 'bPWmy4jGc5', '2014-07-25 05:41:58.000', '2020-09-12 07:46:10.000', '2021-02-28 18:54:02.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (37, 'rNcWGZ3DPS', '5-4-2 Kikusui 3 Jo, Shiroishi Ward,', '异常', '维护', '贾岚', 'DL18Re7D56', '2018-08-21 14:43:10.000', '2023-10-30 12:40:53.000', '2004-05-16 00:50:08.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (38, '3pGpDm36J2', '6 1-1715 Sekohigashi, Moriyama Ward', '维护', '异常', '邵云熙', 'pNfcX5UYUA', '2008-03-11 00:32:53.000', '2019-05-16 22:46:41.000', '2004-03-20 10:06:22.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (39, 'XhMCJggoS2', '4-9-4 Kamihigashi, Hirano Ward', '维护', '维护', '孟宇宁', '02TAxXUPWQ', '2021-05-30 01:09:30.000', '2008-03-02 11:39:33.000', '2018-11-22 10:14:25.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (40, 'Jo6sv1Z66S', '3-27-17 Higashitanabe, Higashisumiyoshi Ward', '维护', '正常', '邹嘉伦', 'PMgwd1vj8a', '2005-10-08 17:05:47.000', '2009-04-12 18:07:28.000', '2007-07-12 15:40:00.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (41, 'WErKEmF6Rh', '678 68 Qinghe Middle St, Haidian District', '异常', '正常', '常宇宁', 'vKfMLDMosT', '2005-10-05 07:15:58.000', '2022-10-16 05:11:54.000', '2013-05-09 14:59:11.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (42, 'IQOfVqZOHX', '130 Hanover Street', '维护', '正常', '苏子韬', 'Nnb6i9bhN2', '2009-03-06 01:59:41.000', '2008-07-28 18:43:48.000', '2016-02-28 21:01:42.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (43, 'WgKXJcBcnd', '572 028 County Rd, Yanqing District', '正常', '维护', '邵詩涵', 'Ih30Jmmkrq', '2016-05-24 02:14:32.000', '2024-08-02 01:08:58.000', '2011-04-21 07:13:51.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (44, '5pnydHsg9u', '1-7-1 Saidaiji Akodacho', '正常', '维护', '贺子韬', 'Ah8AwZdpww', '2005-11-25 00:36:10.000', '2002-10-06 17:24:16.000', '2016-08-09 03:55:11.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (45, 'ndTT6EYtZk', '366 Jianxiang Rd, Pudong', '维护', '正常', '常安琪', '2mzHS9cM7U', '2019-06-09 03:59:35.000', '2009-05-28 01:49:19.000', '2018-10-23 20:36:52.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (46, '8x9ddDQTe3', '895 Binchuan Rd, Minhang District', '正常', '维护', '段詩涵', 'nZHffEgIEE', '2001-04-21 15:08:18.000', '2020-03-14 10:15:00.000', '2010-07-23 02:23:38.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (47, 'cMkMvCQeic', '530 Broadway', '正常', '维护', '姚嘉伦', 'nKGEddzxTC', '2025-01-01 20:11:36.000', '2012-05-23 09:10:08.000', '2010-12-01 09:07:52.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (48, '3LDHHbab0Z', '59 Aigburth Rd, Aigburth', '正常', '维护', '顾秀英', 'U7mAYCO5Mo', '2022-12-06 23:38:31.000', '2009-02-11 17:51:50.000', '2003-06-20 01:15:17.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (49, '9gimb42Aql', '814 49/50 Strand, Charing Cross', '维护', '异常', '高璐', 'xd8MNdRdbG', '2021-09-27 04:49:06.000', '2024-11-16 09:53:06.000', '2012-09-01 18:46:51.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (50, 'rCULPc1Bie', '937 Silver St, Newnham', '异常', '正常', '任云熙', 'luTjL4O7Ny', '2006-08-19 15:58:59.000', '2006-06-06 02:08:58.000', '2013-04-07 15:44:02.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (51, 'eqCbbi1ivr', '503 East Cooke Road', '正常', '异常', '李嘉伦', 'tXjyaCY4k9', '2021-10-31 07:20:24.000', '2004-11-27 06:05:46.000', '2009-02-10 18:34:42.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (52, 'qCQVe6QJ72', '759 Pedway', '正常', '正常', '潘致远', '5oGEmIIPF9', '2003-08-26 21:12:37.000', '2007-03-15 12:58:29.000', '2002-11-09 02:08:28.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (53, 'QYYS1rtvZA', '784 Abingdon Rd, Cumnor', '维护', '正常', '武宇宁', 'R0avkFqLqa', '2009-08-10 04:05:08.000', '2019-09-14 09:42:30.000', '2018-08-15 05:55:11.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (54, 'nXqJkALdq0', '665 028 County Rd, Yanqing District', '异常', '维护', '郭詩涵', 'ZoA5sU65Jr', '2023-05-24 14:33:45.000', '2006-02-20 19:07:27.000', '2009-03-08 01:01:38.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (55, 'zDa3az5jGs', 'No. 502, Shuangqing Rd, Chenghua District', '维护', '异常', '陶璐', 'ZqKsJVUZAY', '2025-02-04 08:18:14.000', '2011-10-13 15:53:20.000', '2024-03-15 06:19:17.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (56, '8hB8aORFKW', '20 1-1715 Sekohigashi, Moriyama Ward', '异常', '异常', '程璐', 'KwoM56VOLZ', '2017-11-29 17:02:37.000', '2019-09-04 03:01:22.000', '2018-10-26 08:54:38.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (57, 'OMHfR60Xsu', '931 Redfern St', '维护', '正常', '冯秀英', 'vatcFkPb4Q', '2002-08-30 06:25:49.000', '2010-08-12 22:39:57.000', '2003-09-07 22:52:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (58, 'O7jKk4iYAb', '2-3-7 Yoyogi, Shibuya-ku', '异常', '维护', '廖震南', 'QraBv8xtZc', '2005-02-26 08:25:23.000', '2009-11-13 19:50:06.000', '2004-08-20 23:13:25.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (59, 'nS0bUQPMnx', '413 Hanover Street', '正常', '维护', '陶子韬', 'RwauG0Xk8T', '2000-02-24 01:09:14.000', '2017-10-23 03:36:22.000', '2017-02-14 00:12:31.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (60, '9aNieC1k3B', '937 Osney Mead', '正常', '异常', '郭璐', 'I5VYNjFGPj', '2008-10-12 05:21:06.000', '2007-09-05 11:30:01.000', '2008-08-06 03:47:38.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (61, 'S3MOUDiomv', '506 Fifth Avenue', '维护', '维护', '孔致远', 'xOO1O63BX1', '2014-01-26 09:08:43.000', '2012-07-21 03:11:25.000', '2008-03-19 11:33:46.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (62, 'bL7FlKXX7b', '314 Flatbush Ave', '正常', '维护', '石睿', 'Opd0ibBZfE', '2007-10-22 01:31:12.000', '2016-07-25 13:23:18.000', '2006-07-28 05:40:41.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (63, 'XVl6q7jNg5', '185 Abingdon Rd, Cumnor', '异常', '正常', '夏子韬', 'nkOywwlf3I', '2018-11-11 19:35:34.000', '2011-11-26 10:06:30.000', '2016-11-20 08:29:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (64, 'QwWfGgnkQX', '5-19-12 Shinei 4 Jo, Kiyota Ward', '维护', '异常', '侯璐', '13VNF0sOWp', '2000-10-13 13:30:06.000', '2019-11-09 19:03:01.000', '2019-07-31 19:22:45.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (65, 'v4BbwWRVMn', '421 Volac Park, Grantchester Rd', '维护', '异常', '夏安琪', 'VW5Yi3Swxd', '2014-09-24 14:56:35.000', '2002-03-21 12:45:55.000', '2021-02-25 17:51:46.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (66, 'gBLctoKlKQ', '569 Lower Temple Street', '异常', '维护', '陈詩涵', 'Ejflq9tCiM', '2005-11-15 14:21:00.000', '2002-04-11 05:38:56.000', '2021-04-11 19:48:52.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (67, 'vyQLsiXfxh', '539 Tremont Road', '维护', '异常', '郝杰宏', 'FUm6B8iGpF', '2018-09-28 05:01:02.000', '2022-08-03 07:19:54.000', '2021-04-30 04:50:11.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (68, 'R68cj8WECK', '927 Cannon Street', '异常', '正常', '段安琪', 'FsXBEbCNr2', '2024-09-18 21:52:07.000', '2018-04-26 22:08:48.000', '2006-03-30 10:04:46.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (69, 'DcuiLO4nGd', '3-19-10 Shimizu, Kita Ward', '异常', '正常', '石子韬', 'NCneJAli5a', '2005-05-07 19:14:52.000', '2017-04-03 03:02:53.000', '2001-04-12 18:16:46.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (70, 'cyGOUb80pj', '782 East Cooke Road', '维护', '正常', '田詩涵', 'OTD6QUOMpF', '2013-03-10 08:34:05.000', '2013-06-19 16:00:24.000', '2010-10-08 02:38:28.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (71, 'vbWJ5mSW9E', '881 Bank Street', '维护', '正常', '高安琪', 'XREjnybZNF', '2001-11-17 09:58:47.000', '2024-04-07 15:43:06.000', '2020-05-04 18:05:14.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (72, 'cc7EGTvfIu', '208 Mosley St', '维护', '异常', '朱震南', 'pb27XNuAS4', '2013-02-12 17:23:32.000', '2014-06-14 03:20:24.000', '2015-08-23 22:41:24.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (73, 'x7FqSsA4na', '674 Edward Ave, Braunstone Town', '正常', '维护', '侯岚', 'XXz02nGaQt', '2010-04-05 23:33:28.000', '2010-10-12 13:29:57.000', '2008-10-31 09:43:10.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (74, 'glCFYb8eGH', '44 West Chang\'an Avenue, Xicheng District', '维护', '维护', '龙璐', 'ipZjN8cFf6', '2000-09-28 05:52:44.000', '2012-02-18 02:12:12.000', '2017-05-26 22:28:45.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (75, 'yz6oSA5hgV', '19 3-803 Kusunokiajima, Kita Ward', '异常', '维护', '吕杰宏', 'UFDr5FH3PT', '2005-09-02 04:05:15.000', '2009-05-15 04:04:27.000', '2018-03-09 12:29:13.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (76, 'Gl9jsYMgRd', '41 Jiangnan West Road, Haizhu District', '维护', '正常', '唐嘉伦', 'N0d9L3RI2i', '2010-07-22 06:36:58.000', '2021-05-22 15:23:03.000', '2001-09-25 09:06:32.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (77, 'TSpLoVgnvZ', '3-9-4 Gakuenminami', '异常', '异常', '彭宇宁', 'GueCCAKHif', '2009-03-29 21:02:31.000', '2021-02-28 10:27:00.000', '2001-11-15 16:12:24.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (78, 't3bIgDOV8X', '644 Canal Street', '异常', '异常', '戴璐', 'jx5at9rlsI', '2000-03-29 04:42:49.000', '2009-10-03 11:18:32.000', '2022-02-05 14:24:48.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (79, '8FfS2bpope', '927 New Street', '正常', '维护', '吴杰宏', 'uZpq6r6j4O', '2013-10-22 14:11:49.000', '2015-03-24 13:24:40.000', '2010-08-31 08:36:15.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (80, 'gZFbeCWhnt', '450 Xiaoping E Rd, Baiyun ', '正常', '正常', '韦子异', '7CO5ahM1ke', '2011-12-25 05:22:57.000', '2006-12-18 10:19:14.000', '2010-01-18 00:15:53.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (81, 'ATWPuVD1oP', '199 Pedway', '正常', '异常', '徐杰宏', 'PBUAZxIGYW', '2011-09-12 06:52:15.000', '2015-06-07 05:16:17.000', '2001-08-18 15:26:56.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (82, '26pCiVZ9Fu', '164 Wall Street', '异常', '维护', '梁子韬', '6RhqCBlTwT', '2018-12-05 01:10:29.000', '2013-11-05 13:25:47.000', '2016-12-11 19:16:15.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (83, 'bfbrUzmIiY', '51 Tianbei 1st Rd, Luohu District', '正常', '异常', '王秀英', '8sT9yMkal8', '2008-04-07 12:42:07.000', '2013-02-02 18:38:07.000', '2009-02-27 12:51:51.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (84, '0Lzq0XgBBS', '611 Broadway', '正常', '维护', '高秀英', 'HYdnGwGFha', '2004-09-03 08:30:32.000', '2009-05-15 13:31:51.000', '2005-05-21 22:36:34.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (85, 'GQBnv35dw1', '23 Tianbei 1st Rd, Luohu District', '异常', '异常', '冯宇宁', 'ZENvEixYXA', '2017-12-26 20:38:42.000', '2017-09-29 04:25:45.000', '2005-01-12 20:37:35.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (86, 'm06szpZDu3', '844 Volac Park, Grantchester Rd', '正常', '异常', '董子韬', 'YPwnsbDYFu', '2024-05-18 12:10:30.000', '2017-12-18 22:46:05.000', '2023-11-27 20:32:06.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (87, 'vpmFB59LvS', '500 Mosley St', '异常', '正常', '江云熙', 'V5j1ZjbbnL', '2015-02-27 01:48:28.000', '2016-04-25 12:01:49.000', '2022-01-01 19:11:57.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (88, 'Rfq1k6dKkx', '3-19-20 Shimizu, Kita Ward', '维护', '异常', '胡杰宏', 'dXrHfHAFyh', '2021-06-21 14:26:11.000', '2002-11-26 19:53:43.000', '2019-03-09 15:57:56.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (89, 'fHeINZEspM', '32 028 County Rd, Yanqing District', '正常', '异常', '雷杰宏', 'cl5vacf6IY', '2011-05-01 08:12:58.000', '2022-08-14 13:41:18.000', '2014-04-29 20:04:37.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (90, 'uzQT6T54kX', '244 Jingtian East 1st St, Futian District', '异常', '维护', '韩睿', 'K9XdojX7vs', '2024-06-16 20:43:55.000', '2022-03-23 12:35:04.000', '2014-06-02 12:21:16.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (91, 'jXD1ldoSQv', '158 Bank Street', '正常', '异常', '汪璐', 'XbqrC5geZC', '2016-07-30 14:23:52.000', '2005-07-20 03:46:30.000', '2010-04-12 19:22:58.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (92, 'YrujhcPvWp', '3-15-12 Ginza, Chuo-ku', '正常', '正常', '秦睿', 'sOuui9S0oY', '2004-06-10 07:35:39.000', '2015-07-13 22:17:30.000', '2024-08-24 17:03:51.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (93, 'zxV4RL2BF0', '678 Pollen Street', '正常', '异常', '彭璐', 'oQFWOcBCjp', '2003-09-16 00:40:37.000', '2024-12-16 11:12:12.000', '2009-06-13 03:21:00.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (94, 'QW100lhYJa', '590 Rush Street', '维护', '正常', '贾宇宁', 'SCpzwkVmTq', '2018-02-08 20:37:14.000', '2013-05-27 08:12:43.000', '2006-03-11 04:06:28.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (95, 'iai6tLbaTN', '150 S Broadway', '异常', '正常', '丁璐', 'OaBENfLGyO', '2009-11-21 15:47:54.000', '2023-07-29 18:41:57.000', '2011-03-03 14:09:12.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (96, 'XNa6eeeqNi', '72 Whitehouse Lane, Huntingdon Rd', '正常', '正常', '史致远', 'bLFJtGNgI3', '2021-10-04 12:45:59.000', '2009-09-04 14:38:57.000', '2000-12-22 00:52:13.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (97, '2jTeJISpid', '828 Dong Zhi Men, Dongcheng District', '正常', '正常', '张致远', 'HfOnnKsoL5', '2022-07-17 14:10:49.000', '2012-03-31 18:32:41.000', '2004-05-11 08:12:08.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (98, 'Imv38nOOFc', '376 Jingtian East 1st St, Futian District', '异常', '异常', '傅子韬', '0ohsx1pgQo', '2024-02-13 01:42:26.000', '2004-07-24 00:54:54.000', '2019-05-23 15:30:11.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (99, 'Z2ODI9BLw3', '2-3-20 Yoyogi, Shibuya-ku', '维护', '维护', '孙子异', 'XAobOR44H0', '2008-08-02 09:17:03.000', '2002-01-14 18:46:58.000', '2014-10-08 10:36:26.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (100, 'lH3N0nSvjx', '578 Mosley St', '异常', '维护', '罗璐', 'oSq8WKdaYB', '2018-10-21 20:49:53.000', '2010-12-09 01:16:54.000', '2007-02-09 19:05:25.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (101, 'WmOtchAai8', '11 1-1 Honjocho, Yamatokoriyama', '维护', '维护', '崔睿', '7cCpBH0per', '2000-09-11 19:29:26.000', '2005-12-01 15:54:37.000', '2007-05-17 23:56:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (102, '3MwZIkaelJ', '154 Park End St', '正常', '正常', '秦震南', 'RpGnC8q932', '2024-01-05 14:10:17.000', '2013-07-10 16:10:53.000', '2002-06-19 17:07:47.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (103, 'NDRxJbyALr', '2-3-10 Yoyogi, Shibuya-ku', '维护', '正常', '周秀英', 'kKKVE8MNsA', '2020-03-23 04:02:47.000', '2015-10-18 15:33:54.000', '2002-02-12 11:08:15.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (104, 'Hkg7WhVA2d', '3 1-1715 Sekohigashi, Moriyama Ward', '异常', '维护', '郭杰宏', 'kJuugNDebx', '2005-01-23 14:23:49.000', '2022-12-05 23:52:05.000', '2003-06-06 07:21:47.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (105, 'vkcYqtTIpQ', '3 1-1715 Sekohigashi, Moriyama Ward', '正常', '异常', '曾安琪', '3nBUkUx2sT', '2010-07-11 14:38:20.000', '2009-10-06 09:40:46.000', '2024-03-14 09:53:09.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (106, 'zxWKMiEWLx', '5 3-803 Kusunokiajima, Kita Ward', '正常', '异常', '余秀英', 'EXb2sgYP2l', '2013-04-20 08:13:28.000', '2023-05-09 13:02:33.000', '2011-08-06 12:47:17.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (107, 'F11REwYkax', '862 Fern Street', '维护', '正常', '何詩涵', '3BLcaTgUBN', '2020-08-17 06:55:24.000', '2007-09-13 03:53:25.000', '2001-09-14 22:15:23.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (108, 'VAOHzUeQiW', '3-27-14 Higashitanabe, Higashisumiyoshi Ward', '异常', '正常', '黄安琪', 'QXVvGRdMHy', '2024-12-17 17:51:40.000', '2013-01-11 13:34:44.000', '2024-01-20 14:45:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (109, '0PjGM1QGxK', '769 Qingshuihe 1st Rd, Luohu District', '正常', '异常', '黎秀英', 'lgf3f1beOP', '2015-08-30 16:38:38.000', '2010-02-01 07:51:40.000', '2020-02-24 20:29:32.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (110, 'CwFWv6pihL', '598 Huanqu South Street 2nd Alley', '维护', '正常', '曹晓明', '8NZ5cTnXwX', '2001-03-26 18:33:04.000', '2001-08-20 11:19:56.000', '2006-08-22 16:36:03.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (111, 'bF84YSBfpZ', '876 New Wakefield St', '异常', '异常', '顾睿', 'y0kI8KGBvh', '2010-08-28 17:32:58.000', '2000-06-27 22:55:14.000', '2019-03-30 14:31:46.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (112, 'FJyetWK7GK', '794 Lower Temple Street', '异常', '异常', '邵安琪', 'eJpriEd6Gr', '2019-05-20 06:12:42.000', '2004-12-24 21:48:32.000', '2003-08-27 05:46:32.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (113, 'tFHI5OicCY', '257 Maddox Street', '正常', '维护', '陶岚', 'gqJUzDrC0p', '2001-06-29 17:06:28.000', '2023-05-08 09:20:53.000', '2000-06-19 02:32:47.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (114, 'yMNvlYuqjA', '89 Central Avenue', '维护', '维护', '韦睿', 'gj2HQtJVvI', '2016-01-09 01:30:30.000', '2008-01-15 11:36:28.000', '2004-02-06 08:52:55.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (115, 'N1Qdb16xPY', '317 State Street', '异常', '正常', '郑嘉伦', '1MiouXunoi', '2018-06-27 09:44:00.000', '2018-07-28 08:14:06.000', '2016-06-18 11:09:24.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (116, '32IhFm2uYC', '611 3rd Section Hongxing Road, Jinjiang District', '正常', '异常', '董子异', 'FVkKSl6OWy', '2000-07-20 10:30:04.000', '2018-07-02 15:26:49.000', '2015-04-19 20:51:54.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (117, '93G7P7tT88', '797 3rd Section Hongxing Road, Jinjiang District', '异常', '正常', '侯嘉伦', 'f2j7N86hBE', '2019-12-13 00:46:57.000', '2024-12-23 07:34:53.000', '2017-12-04 03:55:57.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (118, 'jGnZkCjBs5', '467 Silver St, Newnham', '异常', '维护', '范秀英', 'ikjLTTdowJ', '2014-02-14 15:55:51.000', '2023-10-21 03:51:32.000', '2013-10-25 04:27:07.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (119, 'yEBHLoxPRM', '18 4-20 Kawagishicho, Mizuho Ward', '异常', '维护', '董宇宁', 'tp0KtxHEVJ', '2020-03-21 19:03:13.000', '2018-05-08 16:06:02.000', '2012-08-04 07:14:50.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (120, 'mJ4BZBbs41', '5-2-19 Kikusui 3 Jo, Shiroishi Ward', '维护', '维护', '唐晓明', 'RE6LKwlecj', '2020-04-22 21:04:19.000', '2017-03-02 14:35:50.000', '2000-09-04 02:30:57.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (121, 'ff4pptIkqd', '2-1-1 Tenjinnomori, Nishinari Ward', '维护', '异常', '顾嘉伦', '8ZlfNltGLc', '2002-12-05 12:14:53.000', '2005-01-20 01:05:00.000', '2017-12-05 07:29:18.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (122, 'VeRuNijuvm', '899 Lark Street', '正常', '正常', '杨岚', 'hsDa6SDzX2', '2015-02-17 18:39:42.000', '2005-10-24 14:45:27.000', '2023-09-02 19:17:03.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (123, 'LreuE0MKJ2', '5-19-6 Shinei 4 Jo, Kiyota Ward', '维护', '正常', '郑致远', 'ConPnlktLr', '2013-10-07 21:21:56.000', '2010-07-14 17:42:46.000', '2001-08-02 19:31:41.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (124, 'buu0IWHwXX', '324 Broadway', '正常', '正常', '向杰宏', 'yHkw6qI6JZ', '2007-03-10 06:51:39.000', '2002-01-25 04:33:02.000', '2014-10-25 22:46:19.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (125, 'ev4vMMoeYu', '5-19-3 Shinei 4 Jo, Kiyota Ward', '正常', '维护', '蔡安琪', 'vtsmwKWDod', '2003-06-08 14:57:51.000', '2018-03-20 21:54:38.000', '2007-10-31 03:36:34.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (126, 'orx2wxiE6u', '4 3-803 Kusunokiajima, Kita Ward', '维护', '维护', '周震南', 'smhN28IfD5', '2022-07-27 02:37:34.000', '2001-08-09 15:42:50.000', '2019-02-15 08:26:05.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (127, 'webkKGFoQK', '941 Binchuan Rd, Minhang District', '异常', '正常', '董子异', 'cQEI2kMAz7', '2010-01-06 12:50:27.000', '2006-06-19 06:00:21.000', '2022-11-22 21:38:58.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (128, 'vTBbhVdCWC', '280 Mosley St', '维护', '异常', '姜晓明', 'yZ2D0hN6yG', '2002-03-05 18:04:20.000', '2017-08-08 12:42:36.000', '2014-07-27 00:12:58.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (129, 'zjGSANpbuY', '867 Redfern St', '正常', '正常', '蒋子异', 'C9Dd4JYPHw', '2019-09-12 03:34:00.000', '2024-12-06 16:12:06.000', '2024-05-25 09:51:30.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (130, 'RaroozjAXE', '3-19-14 Shimizu, Kita Ward', '正常', '异常', '龙安琪', 'QFFwbxUOTB', '2014-11-15 17:31:20.000', '2016-08-08 12:03:50.000', '2016-07-09 03:48:10.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (131, 'NSXSGX4fUs', '825 Whitehouse Lane, Huntingdon Rd', '维护', '异常', '谢安琪', 'AUNMugH2wG', '2009-03-05 02:16:46.000', '2019-04-19 08:02:17.000', '2012-01-14 20:47:51.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (132, 'yDfqaLQOky', '6-1-7, Miyanomori 4 Jō, Chuo Ward', '异常', '维护', '陈嘉伦', 'yKpJFzXgNS', '2005-06-15 20:21:11.000', '2003-01-17 23:02:38.000', '2007-01-27 14:15:33.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (133, '0nGhjtBjso', '400 Pollen Street', '维护', '正常', '胡睿', '2l4fpft7uL', '2000-06-20 11:23:58.000', '2018-04-25 18:39:54.000', '2007-03-16 06:05:45.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (134, '9JY2kNUAbu', '908 Edward Ave, Braunstone Town', '维护', '正常', '陶致远', 'Bl71kq3eTf', '2021-12-16 19:47:31.000', '2010-11-12 12:53:35.000', '2015-01-11 19:15:46.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (135, 'dakojPZAwg', '2-3-3 Yoyogi, Shibuya-ku', '正常', '正常', '沈璐', 'ii70FgrOnJ', '2013-04-30 18:22:29.000', '2016-05-14 16:07:16.000', '2007-05-30 02:42:07.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (136, 'yfqrl5fIQV', '5-2-12 Kikusui 3 Jo, Shiroishi Ward', '正常', '维护', '邵杰宏', 'dU8JMrmBa2', '2008-01-17 23:43:38.000', '2007-06-17 13:13:39.000', '2013-12-06 21:28:44.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (137, 'IOQcT1mYfY', '185 Canal Street', '异常', '正常', '张安琪', 'dRMshdusVg', '2022-07-15 10:56:22.000', '2017-11-19 06:57:32.000', '2005-09-14 19:52:23.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (138, 'oQ6z3ou385', '1-7-5 Omido, Higashiosaka', '维护', '维护', '魏子韬', 'KnkaZVNONN', '2002-12-13 14:08:01.000', '2009-10-27 20:11:48.000', '2018-10-15 14:31:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (139, '5wAryDzMnJ', '3-9-20 Gakuenminami', '异常', '正常', '向嘉伦', 'op0FTmR6dp', '2021-03-03 23:48:13.000', '2008-02-02 01:38:40.000', '2006-11-16 03:52:36.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (140, 'kD115kj0HT', '4-9-5 Kamihigashi, Hirano Ward', '正常', '维护', '徐宇宁', 'WGzQzPTICq', '2003-01-30 15:54:09.000', '2010-02-26 06:43:21.000', '2017-07-02 04:34:16.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (141, 'Ij1cEOxZEz', '1-5-19, Higashi-Shimbashi, Minato-ku', '异常', '维护', '胡宇宁', 'tc4YrtBfbx', '2011-07-09 18:11:46.000', '2014-01-18 22:07:04.000', '2006-11-30 03:45:42.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (142, 'dM4wDxbeNm', '768 S Broadway', '维护', '正常', '谭子韬', '6m2eIYI5Ru', '2019-06-09 08:07:36.000', '2002-12-28 10:24:40.000', '2014-10-23 00:45:38.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (143, 'oIAPwwzIih', '1-7-15 Omido, Higashiosaka', '维护', '异常', '罗璐', '2YhoaZpotW', '2007-03-25 19:10:57.000', '2002-07-04 01:53:11.000', '2018-06-15 18:36:11.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (144, 'TkIvtPreZH', '11 Lark Street', '维护', '异常', '韩子韬', 'Y3LBWoJvF9', '2003-02-18 08:41:21.000', '2015-11-11 07:07:29.000', '2024-09-20 21:21:55.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (145, 'OGaasUxrub', '292 Sanlitun Road, Chaoyang District', '正常', '正常', '雷嘉伦', 'EAzsdFB2lo', '2008-07-25 03:32:10.000', '2001-09-28 03:04:39.000', '2019-03-19 18:16:32.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (146, 'cQojyLd8j1', '42 West Market Street', '正常', '异常', '傅晓明', 'xq5jkcMF7D', '2005-12-11 16:22:41.000', '2021-10-25 18:25:27.000', '2017-01-12 07:39:16.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (147, 'L121aX4wld', '2-3-6 Yoyogi, Shibuya-ku', '异常', '维护', '侯子韬', '31kmy21p98', '2007-10-31 11:05:48.000', '2005-02-07 13:48:09.000', '2020-03-07 13:56:17.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (148, 'VlEqoyXlHv', '730 Fifth Avenue', '异常', '维护', '邓詩涵', '7t2iXsFxSd', '2023-01-06 09:14:51.000', '2009-07-10 05:24:13.000', '2024-12-23 09:31:41.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (149, 'gxQE4TTDEk', '49 Nostrand Ave', '维护', '维护', '范宇宁', '9Qmwyh6NHR', '2010-05-09 13:58:53.000', '2013-04-08 12:39:49.000', '2020-07-18 17:12:14.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (150, 'iHGNuuEcw4', '345 Shanhu Rd', '异常', '维护', '武璐', '51W5j7r16I', '2004-08-31 18:17:09.000', '2007-07-22 23:08:11.000', '2011-01-26 07:55:40.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (151, 'o3iv2y7RdM', '26 39 William IV St, Charing Cross', '异常', '维护', '冯晓明', 'HdIaSVFLl9', '2013-05-09 18:13:20.000', '2025-03-03 18:51:59.000', '2006-12-18 00:53:35.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (152, 'RevsiaOedt', '741 Hongqiao Rd., Xu Hui District', '正常', '维护', '冯璐', 'S8SYpqBh93', '2018-12-06 03:27:50.000', '2017-05-22 22:01:37.000', '2014-03-09 11:53:42.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (153, 'FE1FnbRV9O', '2-1-18 Kaminopporo 1 Jo, Atsubetsu Ward', '异常', '正常', '钟宇宁', 'ytMW0SWVBh', '2018-12-15 05:01:29.000', '2020-01-01 10:08:37.000', '2004-09-04 23:26:45.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (154, 'HodZ161ZAh', '597 Edward Ave, Braunstone Town', '异常', '异常', '吴致远', 'WqmDkPzbrf', '2013-09-02 06:36:52.000', '2021-09-16 09:21:43.000', '2001-04-24 12:12:35.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (155, 'aLfx52jeef', '674 Lefeng 6th Rd', '维护', '正常', '韦睿', 'H7UbQfFc07', '2015-03-14 02:59:01.000', '2015-09-24 03:20:41.000', '2013-03-06 13:31:30.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (156, '36qdRPnXin', '326 Bergen St', '正常', '正常', '郝子异', 'itkTmLz0Qp', '2010-02-24 06:44:36.000', '2016-10-17 23:50:29.000', '2007-11-24 03:14:06.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (157, 'LfrUrX2KMr', '534 3rd Section Hongxing Road, Jinjiang District', '正常', '维护', '韩子异', 'NbnYqFdMko', '2002-10-14 15:57:17.000', '2009-10-18 17:00:45.000', '2022-08-21 15:13:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (158, '3oPm7N2GYH', '719 Osney Mead', '正常', '维护', '汪睿', 'eAZ6uMvFTS', '2017-12-24 13:24:37.000', '2006-04-27 09:49:19.000', '2009-07-03 15:08:11.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (159, 'AjvfsK5vB7', '458 Diplomacy Drive', '维护', '正常', '曹安琪', 'IfR6ue6aKX', '2013-04-03 18:26:11.000', '2007-12-13 13:49:15.000', '2017-05-17 18:05:46.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (160, 'E6Jccz9CD0', '384 Silver St, Newnham', '维护', '正常', '彭秀英', 'GBY61mWKIz', '2000-02-04 16:11:32.000', '2021-07-17 16:12:28.000', '2004-05-01 06:56:41.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (161, 'kyHFd3W54d', '658 Tremont Road', '维护', '维护', '钟宇宁', 'bSJVz1Uaep', '2025-02-20 10:00:33.000', '2019-04-06 04:46:59.000', '2022-01-11 22:27:59.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (162, 'kgtGx3Rpi5', '549 East Cooke Road', '正常', '异常', '曹詩涵', 'OgnG1vzQQy', '2014-10-20 08:51:06.000', '2009-06-02 21:26:51.000', '2012-08-16 19:12:18.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (163, 'Lu36vRfgUN', '493 Spring Gardens', '正常', '异常', '崔子韬', '2cYfMnGnup', '2013-11-30 04:58:11.000', '2009-05-07 20:10:35.000', '2021-10-21 01:32:29.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (164, 'lc7C8mEg7F', '987 Nostrand Ave', '正常', '正常', '尹杰宏', 'InRyS9oA8e', '2015-02-11 18:05:09.000', '2003-06-02 04:34:23.000', '2008-05-28 05:44:42.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (165, 'Qyyq125LmD', '755 Little Clarendon St', '异常', '异常', '邓宇宁', '20YfyyUrvT', '2022-09-29 13:59:46.000', '2023-07-04 09:04:26.000', '2018-09-29 05:11:23.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (166, 'Yrf6tfhfig', '22 Hanover Street', '异常', '异常', '谭震南', 'omsBiRz5lx', '2007-07-12 11:37:56.000', '2004-03-28 08:21:49.000', '2004-01-27 10:58:46.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (167, 'fXLIXSx5dH', '52 Cannon Street', '维护', '异常', '石詩涵', 'GcZmAnVj0h', '2009-01-10 09:56:30.000', '2024-10-17 04:12:56.000', '2010-08-14 21:13:37.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (168, 'FlXuRlQMPE', '8 1-1 Honjocho, Yamatokoriyama', '维护', '异常', '王秀英', 'qnZ6st8Zn1', '2022-05-29 19:37:10.000', '2022-06-14 15:55:21.000', '2019-06-13 04:37:48.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (169, 'YxApbxMSwy', '479 Pedway', '正常', '维护', '孔安琪', 'GZcKkMNOPe', '2018-10-08 14:25:28.000', '2006-11-05 09:26:25.000', '2001-05-30 02:40:07.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (170, '63F3CRWB1v', '858 Aigburth Rd, Aigburth', '异常', '异常', '梁杰宏', 'ogRs7K7H0T', '2011-04-08 00:03:44.000', '2003-05-22 16:11:35.000', '2007-04-16 14:26:12.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (171, 'RsJE9rvbaq', '487 Canal Street', '异常', '正常', '石致远', 'SpfWiRC5ZK', '2000-05-31 04:56:53.000', '2019-12-24 21:42:14.000', '2018-07-29 13:44:03.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (172, 'vwSknJDO0w', '578 State Street', '异常', '维护', '朱子异', 'vkK0iod9F6', '2024-11-06 12:12:19.000', '2000-12-27 08:21:22.000', '2018-12-02 06:55:52.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (173, 'vwiAQ5NqlO', '130 Bank Street', '异常', '维护', '邵云熙', '5qKalXfU1g', '2023-08-09 20:06:43.000', '2018-09-09 09:23:05.000', '2007-03-08 00:10:21.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (174, 'iANSIuz7r0', '731 FuXingMenNei Street, XiCheng District', '异常', '维护', '范震南', 'tlZ6WYD7R6', '2006-08-22 09:19:01.000', '2005-12-20 03:06:27.000', '2010-09-21 00:11:06.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (175, 'jlfFchAnHs', '1-7-7 Saidaiji Akodacho', '正常', '异常', '曹晓明', 'etFTfLkQ1y', '2021-09-02 19:22:00.000', '2003-08-23 15:52:05.000', '2024-07-06 00:27:31.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (176, 'n8f2TeN3BX', '681 Silver St, Newnham', '正常', '正常', '叶杰宏', 'zzQ3EeLtcs', '2005-08-30 12:18:55.000', '2024-01-29 11:54:05.000', '2015-02-09 04:49:40.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (177, 'Vw3JJGDUEY', '925 Hanover St', '正常', '维护', '罗詩涵', 'ZCdzmQB9cJ', '2007-09-06 07:06:07.000', '2020-08-25 14:48:23.000', '2010-01-16 18:25:52.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (178, 'paAoGUAhoA', '289 Sky Way', '正常', '正常', '蔡安琪', '0JEjgcanQH', '2002-06-19 09:40:45.000', '2008-01-20 03:50:26.000', '2022-01-13 04:21:37.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (179, 'QbuGzfjGPb', '205 Abingdon Rd, Cumnor', '维护', '维护', '孔睿', 'hxWwmoL6AF', '2015-06-27 09:10:37.000', '2006-01-19 09:27:47.000', '2022-05-27 14:59:41.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (180, 'hwgLCXPAsp', '231 Tianhe Road, Tianhe District', '异常', '维护', '于安琪', 'MfjTbw22pA', '2014-11-08 02:38:10.000', '2019-10-31 13:03:13.000', '2024-03-28 09:37:05.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (181, '3EpcNaSIFE', '1-5-17, Higashi-Shimbashi, Minato-ku', '异常', '维护', '戴晓明', 'gCBU3eJYt8', '2021-09-26 08:44:55.000', '2018-04-13 16:44:49.000', '2008-08-20 04:40:15.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (182, 'hWu5ODRzMI', '370 West Chang\'an Avenue, Xicheng District', '正常', '正常', '谢致远', 'zP2jSAHcem', '2015-04-02 11:11:56.000', '2000-03-10 14:28:51.000', '2009-11-23 14:34:16.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (183, 'eWIS4HRews', '613 Narborough Rd', '维护', '维护', '陈子异', 'JQy7tU5Qzx', '2008-09-22 04:18:10.000', '2008-05-30 22:43:29.000', '2012-03-04 09:45:42.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (184, 'WTAm5AAlfz', '13-3-19 Toyohira 3 Jo, Toyohira Ward', '维护', '维护', '阎璐', '1UO0aqmOsh', '2014-03-12 23:39:56.000', '2013-09-27 21:44:33.000', '2014-04-06 11:26:03.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (185, 'bri6sEgG42', '1-6-8, Marunouchi, Chiyoda-ku', '异常', '正常', '田云熙', 'OXJMonZB89', '2003-07-25 20:31:47.000', '2006-07-23 12:19:03.000', '2024-09-25 06:35:44.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (186, 'VwfDQfPsS7', '2 3-803 Kusunokiajima, Kita Ward', '正常', '维护', '方杰宏', '7sNStt48rM', '2015-01-19 01:14:50.000', '2020-01-07 04:01:30.000', '2011-08-08 08:13:31.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (187, 'S5st4OWHlr', '1-6-12, Marunouchi, Chiyoda-ku', '异常', '正常', '沈詩涵', 'JGSKQk6xor', '2019-03-22 10:52:42.000', '2004-01-17 15:25:54.000', '2006-08-29 21:59:46.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (188, 'Rc7VLSFSMr', '165 Whitehouse Lane, Huntingdon Rd', '异常', '正常', '熊杰宏', 'x8R4IdUMeU', '2000-01-18 22:41:38.000', '2003-06-23 20:10:28.000', '2012-09-23 04:02:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (189, 'zttXfizNFE', '874 Cannon Street', '异常', '维护', '魏杰宏', 'xMdC708Zel', '2008-08-05 13:06:29.000', '2011-04-11 12:36:03.000', '2023-05-21 03:48:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (190, 'Nxnt0s8Ig3', '900 Yueliu Rd, Fangshan District', '维护', '异常', '张安琪', 'h1319nygh4', '2018-04-18 22:03:56.000', '2007-12-20 01:47:04.000', '2021-08-25 09:39:37.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (191, '95pQrJlpOO', '814 Whitehouse Lane, Huntingdon Rd', '维护', '异常', '许震南', 'QSUDt4OMVu', '2018-03-07 15:03:30.000', '2011-09-17 00:15:25.000', '2003-08-27 03:47:39.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (192, 'HvwvtFn1FE', '2-3-11 Yoyogi, Shibuya-ku', '维护', '正常', '郑嘉伦', '5wF8Nq2VCv', '2020-10-30 17:00:03.000', '2012-08-03 17:16:38.000', '2019-11-14 19:13:18.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (193, '3dtlzDv55T', '252 Flatbush Ave', '异常', '维护', '郝秀英', 'DIFI6cA3zd', '2008-01-25 11:31:00.000', '2019-12-01 22:57:54.000', '2012-01-26 13:22:34.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (194, '97wIYYgMjS', '506 New Wakefield St', '异常', '正常', '汪云熙', 'iVN2J1jGMe', '2020-12-30 11:05:31.000', '2019-07-30 12:14:40.000', '2001-08-02 10:50:02.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (195, 'Cs7424t5L9', '379 Kengmei 15th Alley', '正常', '维护', '段子异', 'CCSNUm0Afo', '2016-09-07 17:20:56.000', '2023-02-13 02:52:03.000', '2015-09-21 02:33:44.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (196, 'dtDbzG9e67', '5-19-12 Shinei 4 Jo, Kiyota Ward', '正常', '维护', '马嘉伦', 'o2pIr9bP1v', '2005-03-06 08:48:32.000', '2013-02-16 21:46:50.000', '2019-02-26 08:08:51.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (197, '98DSxqbJom', '303 Broadway', '维护', '维护', '王晓明', 'Ht3nHUWrLi', '2018-07-02 09:32:59.000', '2000-02-03 14:05:44.000', '2017-12-25 18:05:35.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (198, 'ompIMkZ0vX', '768 Columbia St', '维护', '维护', '陈安琪', '3qh0MZtDq1', '2006-04-26 04:58:11.000', '2021-11-08 08:16:51.000', '2011-05-06 12:04:26.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (199, 'rr5KZ2O9VY', '133 Hanover St', '异常', '正常', '张睿', 'CBrAH8AaFn', '2014-12-03 18:27:43.000', '2006-10-11 14:12:25.000', '2000-07-10 15:06:30.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (200, 'ayC6JwI1VB', '849 Spring Gardens', '维护', '异常', '何子异', 'nj1chsJ5Jc', '2006-12-01 19:40:47.000', '2024-07-08 11:50:19.000', '2001-01-09 15:09:39.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (201, 'bjCT78Wgpp', '1-7-18 Saidaiji Akodacho', '维护', '正常', '何子异', 'aEfziJyx7G', '2015-10-14 05:08:28.000', '2008-07-28 22:34:18.000', '2022-05-20 06:41:22.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (202, 'AWqZxyjwtY', '435 Cyril St, Braunstone Town', '正常', '维护', '唐秀英', 'aQjM20kCxG', '2014-11-17 16:20:09.000', '2009-02-02 12:38:36.000', '2018-12-22 15:15:44.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (203, 'FfthcOUKih', '912 Fifth Avenue', '正常', '维护', '金晓明', 'EqOk67Liu7', '2019-01-21 21:06:55.000', '2023-04-23 03:57:18.000', '2021-04-11 21:46:14.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (204, 'G69TX7ZmeS', '944 Lower Temple Street', '正常', '异常', '董子韬', 'r1xSfIPYGR', '2018-09-01 20:01:29.000', '2009-07-16 23:25:09.000', '2007-12-04 20:06:13.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (205, '9OHWmqaszL', '730 Sanlitun Road, Chaoyang District', '正常', '异常', '萧晓明', 'CREsfy1Qcr', '2000-10-14 08:27:11.000', '2024-09-06 23:31:45.000', '2007-05-01 23:37:12.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (206, 'Dw4NkbiPpY', '752 Lower Temple Street', '维护', '异常', '刘子异', 'ol85yrsxxN', '2023-12-07 14:50:06.000', '2019-08-01 08:02:03.000', '2001-03-07 11:25:08.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (207, 'gqMuO8M2Np', '576 Zhongshan 5th Rd, Zimaling Shangquan', '正常', '维护', '方致远', '6pmMMRMwrR', '2023-12-09 02:52:50.000', '2015-02-08 13:01:33.000', '2018-03-22 05:15:01.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (208, 'PeohtaLSyG', '803 Lower Temple Street', '正常', '维护', '贺宇宁', 'EJHuCI9k2i', '2008-12-28 10:31:34.000', '2016-03-07 17:54:57.000', '2018-06-03 20:34:56.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (209, 'WOd0pFFXGU', '439 Portland St', '异常', '异常', '杜岚', 'uxOpW9iIKf', '2018-02-28 21:14:06.000', '2002-05-02 14:45:29.000', '2011-07-29 03:13:27.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (210, 'gWZqzWmD0k', '993 The Pavilion, Lammas Field, Driftway', '维护', '维护', '任宇宁', 'RECwYcm9dg', '2012-05-04 00:42:38.000', '2013-03-29 08:07:52.000', '2022-08-05 08:39:33.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (211, 'rDhRInvnZb', '770 Shennan E Rd, Cai Wu Wei, Luohu District', '异常', '维护', '朱宇宁', 'x5ubk9F0GS', '2019-10-02 18:18:21.000', '2017-08-24 16:55:56.000', '2001-05-18 13:28:54.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (212, 'GWSLpmwNru', '693 Central Avenue', '正常', '正常', '陶岚', '9dmjHRJeCr', '2004-03-09 20:59:02.000', '2017-07-26 12:24:11.000', '2012-09-23 23:42:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (213, 'v3e3Akzmja', '770 East Cooke Road', '异常', '正常', '王宇宁', 'ciBHQifnnu', '2019-06-15 19:50:22.000', '2023-10-04 00:01:25.000', '2015-01-10 18:45:49.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (214, 'A8EjqRpgHj', '5-4-16 Kikusui 3 Jo, Shiroishi Ward,', '正常', '异常', '杨宇宁', 'SLEqINwew6', '2006-04-04 08:53:21.000', '2024-02-24 23:20:21.000', '2021-07-26 00:57:59.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (215, '85uQfJurBC', '323 Qingshuihe 1st Rd, Luohu District', '正常', '正常', '邵璐', 'Cfwi66c4Fi', '2006-05-05 22:51:31.000', '2020-09-04 19:11:32.000', '2001-01-27 20:07:11.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (216, 'bk1ave3MSH', '916 Collier Road', '正常', '正常', '张睿', 'EDAPUEwmP1', '2019-07-22 09:28:12.000', '2023-11-29 16:49:06.000', '2004-01-07 21:21:44.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (217, 'DIr9h9PcXJ', '1-7-10 Saidaiji Akodacho', '维护', '正常', '郝宇宁', 'w9Vk9W9cLX', '2010-01-19 07:58:43.000', '2003-12-07 00:42:25.000', '2024-08-22 13:57:41.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (218, 'EkwDn0AUY8', '13-3-15 Toyohira 3 Jo, Toyohira Ward', '异常', '正常', '方嘉伦', 'Lmsb234IU0', '2002-03-14 16:35:02.000', '2022-11-06 04:44:53.000', '2000-09-25 05:06:29.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (219, 'yjTrHXg00y', '821 Wyngate Dr', '异常', '异常', '孟宇宁', 'Q4gm7vPBWi', '2006-09-11 05:29:22.000', '2024-07-15 00:33:36.000', '2000-03-30 00:39:07.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (220, 'BxMLDtABN7', '57 Alameda Street', '异常', '正常', '周嘉伦', 'ZzYA3QHG3d', '2000-12-08 17:46:36.000', '2011-12-20 10:37:43.000', '2020-11-21 07:12:47.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (221, '4cme47yi1o', '474 Hanover Street', '正常', '正常', '余睿', '2Dxc3hP9dl', '2008-01-02 14:09:28.000', '2016-11-12 22:28:24.000', '2011-12-12 20:46:54.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (222, 'Qoxgns6taj', '717 Sky Way', '维护', '正常', '陶震南', 'yCqBAzFm8K', '2002-07-12 09:22:01.000', '2012-10-10 23:32:46.000', '2019-09-17 19:24:47.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (223, 'ZO53U5lQwV', '855 Central Avenue', '维护', '正常', '高詩涵', 'agY1NxXkgA', '2004-10-22 07:36:13.000', '2007-12-08 13:41:00.000', '2019-08-18 02:32:41.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (224, 'wN6pWX4QUc', '1-7-15 Omido, Higashiosaka', '异常', '正常', '马晓明', 'vHQGINdHVn', '2023-03-07 17:56:40.000', '2008-06-10 05:51:36.000', '2008-08-30 07:24:19.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (225, 'BmkeY9BlzJ', '513 Collier Road', '异常', '维护', '余云熙', 'nOGFvegiHq', '2002-11-05 02:02:12.000', '2014-03-17 13:01:04.000', '2006-01-30 05:24:28.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (226, 'JF7TMM6qYj', '2-1-3 Tenjinnomori, Nishinari Ward', '维护', '正常', '熊云熙', '6KQOusvyDb', '2001-04-08 04:04:11.000', '2018-12-02 08:14:56.000', '2010-10-07 19:36:27.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (227, 'zAhT5Dax5C', '649 39 William IV St, Charing Cross', '维护', '维护', '曹震南', '6r56V2FruN', '2003-01-30 12:30:00.000', '2011-04-10 08:26:29.000', '2021-11-15 07:28:53.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (228, 'TgFcgZj3N6', '473 Maddox Street', '维护', '维护', '程子异', '2CGLjmbcHJ', '2008-09-25 17:25:19.000', '2021-10-21 07:30:33.000', '2023-12-08 23:49:01.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (229, 'TuXocbMLeh', '624 Osney Mead', '维护', '异常', '林子韬', 'C6jHwJtKaY', '2021-07-21 02:57:48.000', '2000-11-03 18:33:55.000', '2002-09-30 19:44:29.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (230, 'N1EhEw2Gtw', '744 Narborough Rd', '异常', '正常', '韩杰宏', '0iyfR76YGY', '2006-09-26 23:18:55.000', '2003-09-08 23:10:40.000', '2013-12-29 01:54:05.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (231, '5glJDTucrC', '1-1-5 Deshiro, Nishinari Ward', '正常', '正常', '于睿', 'ZrPoP78uMi', '2017-06-06 07:45:32.000', '2001-04-25 16:31:07.000', '2023-08-31 21:13:19.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (232, 'BUEpeB0OB2', '415 Central Avenue', '正常', '正常', '魏嘉伦', 'bXEhZgA1xq', '2020-10-15 09:49:54.000', '2012-05-30 21:12:37.000', '2025-01-15 02:38:19.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (233, 'xCpllTRPTV', '279 Tremont Road', '正常', '正常', '龙致远', 'ROn7ExyUFa', '2020-05-04 13:06:51.000', '2001-05-30 17:37:37.000', '2005-12-17 20:13:02.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (234, 'siXLxXMwoH', '886 Jiangnan West Road, Haizhu District', '正常', '异常', '邵晓明', 'kXEZvIbhel', '2024-06-30 23:37:15.000', '2016-02-03 01:04:22.000', '2017-02-22 11:44:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (235, 'N94yEocIdB', '6 Mosley St', '正常', '维护', '卢宇宁', 'x5ox4ZeyeO', '2012-04-23 05:42:14.000', '2010-04-12 09:49:24.000', '2017-07-17 13:47:41.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (236, 'Iz71XnVr2v', '2-1-20 Kaminopporo 1 Jo, Atsubetsu Ward', '异常', '异常', '孔岚', 'MmUTVt1CQN', '2006-06-16 03:45:13.000', '2002-07-12 04:03:15.000', '2018-03-30 17:29:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (237, 'a3UgZFWUGL', '86 Wicklow Road', '正常', '正常', '黄睿', 'c0oY5KHmig', '2004-08-03 19:18:10.000', '2009-02-14 00:10:21.000', '2016-06-26 22:05:44.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (238, '0wOqiEFbbq', '235 New Street', '维护', '维护', '侯秀英', 'bMcXXf2cKe', '2007-06-26 16:55:04.000', '2006-01-16 07:57:39.000', '2014-06-09 17:53:45.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (239, 'tklbTwoyko', '886 Abingdon Rd, Cumnor', '维护', '异常', '邓岚', '6sm7qKajHR', '2023-12-09 13:15:30.000', '2002-12-08 18:26:38.000', '2011-03-03 16:49:47.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (240, 'O7kV9joGnS', '723 Columbia St', '异常', '正常', '方璐', 'CxNaKyjQb7', '2010-10-07 18:17:11.000', '2006-07-08 17:18:48.000', '2010-05-13 22:21:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (241, 'XyNCBU4dTi', '438 49/50 Strand, Charing Cross', '维护', '异常', '江云熙', 'w0JryysKwY', '2018-01-19 11:08:52.000', '2021-12-04 18:53:36.000', '2024-08-16 10:09:57.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (242, 'OkWiGKW1uD', '886 2nd Zhongshan Road, Yuexiu District', '正常', '正常', '莫岚', '6HIssNyUvu', '2006-05-04 06:04:00.000', '2015-05-12 19:14:43.000', '2024-09-25 20:02:54.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (243, 'VDcDHdRY6F', '883 Alameda Street', '异常', '正常', '于嘉伦', 'N3zMnqshJl', '2003-07-04 02:22:39.000', '2020-12-08 11:58:08.000', '2004-09-03 12:48:28.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (244, 'kd9qbVPxWQ', '64 Sanlitun Road, Chaoyang District', '正常', '异常', '侯宇宁', 'd6I5NL9PgX', '2023-06-03 13:30:29.000', '2016-12-19 08:52:37.000', '2019-08-07 04:01:18.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (245, 'vnsmIXS3D2', '662 Kengmei 15th Alley', '异常', '维护', '田睿', 'm2MWoOis5W', '2004-06-15 10:03:06.000', '2019-10-13 00:10:42.000', '2023-02-06 02:13:32.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (246, 'n2lxokC83W', '205 Grape Street', '异常', '维护', '汪嘉伦', '99oMSEplH3', '2013-10-07 06:01:56.000', '2008-10-16 09:18:34.000', '2009-03-24 03:19:29.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (247, 'UpiRbS809i', '936 Hongqiao Rd., Xu Hui District', '正常', '异常', '龚云熙', 'Zhn0Ejz7Hx', '2000-06-06 09:26:18.000', '2012-01-15 16:05:15.000', '2006-05-11 08:39:16.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (248, 'XArVFEWEfd', '9 1-1 Honjocho, Yamatokoriyama', '正常', '维护', '邹詩涵', 'U5sYgzJ5Pc', '2016-05-20 19:19:07.000', '2007-02-27 13:15:15.000', '2016-01-06 02:43:04.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (249, 'ZWa6orJCZP', '13-3-19 Toyohira 3 Jo, Toyohira Ward', '异常', '正常', '向杰宏', 'OmPkXlYs3g', '2007-08-15 11:44:40.000', '2016-05-22 20:07:18.000', '2022-08-04 15:35:53.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (250, 'tqX5mB1GhU', '804 Park End St', '正常', '异常', '姚杰宏', 'oIoOaLzJlr', '2020-09-02 07:58:56.000', '2006-06-27 03:24:35.000', '2016-01-14 03:20:29.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (251, 'iDuyrFFxfa', '254 New Wakefield St', '正常', '异常', '韦宇宁', '70O9BeC80Y', '2019-06-25 06:57:44.000', '2020-04-30 02:14:10.000', '2011-10-25 21:40:12.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (252, 'WDStN6wJCC', '7 Whitehouse Lane, Huntingdon Rd', '维护', '异常', '叶宇宁', 'SbfOSUXkDU', '2017-01-19 14:23:53.000', '2018-06-22 19:51:24.000', '2008-04-12 13:59:04.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (253, 'AW0TI3ettr', '1 3-803 Kusunokiajima, Kita Ward', '正常', '维护', '高睿', 'ZBaNF2Aj8F', '2018-09-10 01:43:33.000', '2008-04-01 15:41:07.000', '2015-05-26 00:56:36.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (254, '2Y9OhPiYHf', '510 The Pavilion, Lammas Field, Driftway', '异常', '异常', '廖致远', 'k1W1ucPEUC', '2007-10-03 06:52:15.000', '2016-05-28 12:13:26.000', '2014-04-23 10:54:10.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (255, 'fItK4ibMnt', '97 West Chang\'an Avenue, Xicheng District', '异常', '异常', '朱睿', 'ASGfsM9IWV', '2024-03-02 17:03:13.000', '2004-08-24 13:48:19.000', '2002-01-01 05:27:43.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (256, 'I22X2pE7QB', '594 Wicklow Road', '正常', '正常', '许震南', 'paWXe7vUIp', '2020-04-30 23:12:42.000', '2009-02-16 23:33:43.000', '2008-12-28 15:10:30.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (257, 'b9Q21wjAan', '761 Cannon Street', '正常', '维护', '姜詩涵', 'vfoEo5kol7', '2001-01-10 04:18:38.000', '2020-09-18 06:56:34.000', '2015-05-11 14:01:14.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (258, 'RI2PMQBK8u', '223 Abingdon Rd, Cumnor', '异常', '正常', '邹子韬', 'IJZj4iigra', '2005-06-30 11:41:18.000', '2016-07-04 07:42:53.000', '2009-03-08 19:48:19.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (259, 'NqpFRA9f2o', '457 Sanlitun Road, Chaoyang District', '异常', '维护', '郑子韬', 'YHQ6ms9BgT', '2002-09-29 06:14:17.000', '2023-07-03 00:13:32.000', '2005-02-10 17:15:46.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (260, 'QEqlC6Tj41', '362 Little Clarendon St', '正常', '正常', '赵詩涵', 'jXCkCDRfMw', '2020-02-02 17:49:46.000', '2020-11-01 18:34:18.000', '2009-10-22 19:54:57.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (261, 'Kcg7XDlWjq', '304 North Michigan Ave', '维护', '异常', '田宇宁', 'SRs6c2ptUH', '2002-08-30 18:44:12.000', '2016-12-04 16:58:26.000', '2008-06-16 11:50:34.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (262, 'exQJPQlGGf', '3-19-8 Shimizu, Kita Ward', '维护', '异常', '余岚', 'oUnbGxHW01', '2013-10-07 08:47:23.000', '2007-04-05 10:51:59.000', '2015-08-21 02:14:52.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (263, 'YxWfE8BhDs', '292 Trafalgar Square, Charing Cross', '维护', '正常', '陶詩涵', 's3lMjh3UBy', '2000-08-18 14:13:40.000', '2011-01-19 06:03:53.000', '2023-04-13 13:49:48.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (264, 'Xp8rSk0p13', '488 Central Avenue', '正常', '异常', '戴云熙', '1hGDSjIc1s', '2005-09-19 10:21:24.000', '2006-03-29 03:11:41.000', '2003-12-20 21:50:28.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (265, '7zr6iuhBcA', '749 Stephenson Street', '正常', '异常', '任致远', '6ulWK0m24b', '2004-10-26 04:58:38.000', '2017-06-14 02:30:48.000', '2012-04-05 16:52:23.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (266, 'B8LCprfI0p', '903 Tianhe Road, Tianhe District', '正常', '维护', '夏睿', 'niu0aOlGog', '2010-02-03 15:01:27.000', '2011-07-22 14:33:26.000', '2023-03-04 22:19:29.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (267, 'Is8qv5Ele6', '254 Binchuan Rd, Minhang District', '正常', '维护', '宋宇宁', 'KGfDkdHvlP', '2009-05-10 21:04:05.000', '2020-08-14 13:27:48.000', '2009-07-23 05:03:54.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (268, 'q8WR0TUVS0', '327 Lark Street', '维护', '维护', '林宇宁', 'AMm9Gwoz1M', '2013-09-12 04:54:34.000', '2011-08-01 07:48:26.000', '2018-06-11 03:28:51.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (269, 'YLlXlsNiDe', '955 West Chang\'an Avenue, Xicheng District', '异常', '异常', '林杰宏', 'L1wz2iKOdZ', '2018-12-22 12:29:56.000', '2020-03-15 08:10:26.000', '2016-06-19 18:22:58.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (270, 'qVas1mVO5E', '293 Qingshuihe 1st Rd, Luohu District', '异常', '维护', '邱嘉伦', 'ObMxZFHD8N', '2006-10-20 20:58:34.000', '2013-12-08 20:26:07.000', '2015-11-16 11:24:26.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (271, 'AK6XPYihoZ', '349 Tremont Road', '异常', '正常', '于子异', 'VCjcBSBGDE', '2019-01-21 22:06:00.000', '2005-03-20 21:14:00.000', '2018-06-08 07:46:32.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (272, '3oBhwr1pO9', '6-1-13, Miyanomori 4 Jō, Chuo Ward', '异常', '正常', '龙子异', 'wcSTF7jenM', '2011-08-19 04:01:37.000', '2018-03-20 03:32:07.000', '2009-03-04 10:03:53.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (273, 'lJ9QTafjLe', '419 Spring Gardens', '维护', '正常', '袁詩涵', 'MffU2zfz2B', '2022-11-28 09:41:06.000', '2020-08-19 13:47:43.000', '2020-02-02 21:54:58.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (274, 'aCafd3TrQD', '212 Central Avenue', '异常', '异常', '方璐', 'QWawBW83fo', '2011-02-17 22:29:19.000', '2020-04-27 16:35:43.000', '2020-05-26 15:11:44.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (275, 'W7vNrsywPe', '973 New Wakefield St', '正常', '异常', '范安琪', 'c8WkOK7eiN', '2008-01-27 11:39:25.000', '2016-02-02 00:21:32.000', '2018-10-22 15:13:18.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (276, 'tUxEvd5m85', '157 68 Qinghe Middle St, Haidian District', '维护', '异常', '熊岚', 'nuaTKwZn5R', '2015-04-15 16:08:43.000', '2000-05-14 10:34:34.000', '2017-05-02 10:51:39.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (277, 'md25gYiKWS', '4 3-803 Kusunokiajima, Kita Ward', '异常', '维护', '江致远', 'O3XEWu4kvI', '2024-10-21 02:21:08.000', '2016-08-07 19:54:51.000', '2010-06-25 03:51:44.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (278, 'vZ6t95rs9s', '5-4-10 Kikusui 3 Jo, Shiroishi Ward,', '维护', '正常', '曹詩涵', 'CDPqMWIh2a', '2004-05-14 06:05:15.000', '2021-07-12 16:39:47.000', '2021-11-09 10:50:56.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (279, 'tFD2CbUY7P', '606 Dong Zhi Men, Dongcheng District', '维护', '异常', '曹安琪', 'XWjGbhLkF6', '2008-07-06 16:13:51.000', '2021-06-04 16:55:37.000', '2015-02-25 08:34:10.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (280, '84dwzevdjo', '208 Cannon Street', '正常', '异常', '薛岚', 'kTag8x4Sgy', '2016-08-14 11:08:27.000', '2023-10-16 14:40:42.000', '2012-05-26 11:30:15.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (281, 'ju1wC3caxO', '443 68 Qinghe Middle St, Haidian District', '异常', '正常', '吴岚', 'gj2N98Hcnv', '2003-12-28 01:05:09.000', '2000-12-07 00:37:30.000', '2009-04-06 15:14:22.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (282, '2GwAorCsvF', '5-2-4 Kikusui 3 Jo, Shiroishi Ward', '维护', '正常', '金杰宏', 'U2HX3goiyp', '2007-09-27 13:25:52.000', '2002-11-29 16:04:34.000', '2009-10-01 19:34:11.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (283, 'o4GvIz6yct', '461 2nd Zhongshan Road, Yuexiu District', '维护', '异常', '徐杰宏', 'cAZUdLSkCs', '2016-01-31 14:53:51.000', '2001-08-08 19:37:48.000', '2013-08-07 17:33:08.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (284, 'xV8c10Aghh', '49 Central Avenue', '异常', '正常', '丁睿', 'jDPW3lehqb', '2007-05-31 12:28:37.000', '2021-02-26 02:54:17.000', '2002-06-25 04:49:53.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (285, 'BtNNDRQ1wD', '884 Wicklow Road', '正常', '异常', '杨岚', 'Umu6pQMHS1', '2015-06-14 16:59:41.000', '2018-07-15 21:28:51.000', '2005-06-16 19:40:14.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (286, 'StbhlGFLWD', '755 Cannon Street', '维护', '正常', '马璐', 'rBYXz7yuv7', '2016-07-11 05:36:28.000', '2013-01-09 01:35:57.000', '2014-01-10 07:10:23.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (287, 'vbQgM6ta06', '974 Canal Street', '维护', '维护', '贺云熙', 'Pcst7VYcLV', '2006-04-24 06:33:29.000', '2021-05-24 16:14:16.000', '2012-12-17 17:10:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (288, 'dVSRctJwBo', '695 68 Qinghe Middle St, Haidian District', '正常', '正常', '董震南', 'nCACOJkUIF', '2022-02-22 20:23:54.000', '2020-11-05 20:55:43.000', '2008-05-01 14:11:34.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (289, 'nEXeRJj4jX', '691 New Wakefield St', '正常', '正常', '苏詩涵', 'hJIts62gd3', '2016-04-10 15:49:27.000', '2004-04-28 23:27:51.000', '2010-05-05 22:29:57.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (290, 'onsHkHutMO', '54 Zhongshan 5th Rd, Zimaling Shangquan', '正常', '维护', '丁震南', 'a0qgjxXc4v', '2020-02-27 13:35:08.000', '2024-12-30 08:07:22.000', '2004-11-30 08:38:40.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (291, 'MlQyQkU5J5', '3-27-12 Higashitanabe, Higashisumiyoshi Ward', '正常', '维护', '罗詩涵', 'LAXtdJQXdE', '2016-01-11 16:59:10.000', '2020-12-12 10:12:59.000', '2022-09-29 23:00:19.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (292, 'tUv6TGAfZG', '121 Binchuan Rd, Minhang District', '维护', '异常', '黄璐', 'tEPA3ioajF', '2020-03-09 10:18:50.000', '2014-09-20 14:54:59.000', '2001-06-05 07:55:30.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (293, 'eDep6i1iWH', '2-5-11 Chitose, Atsuta Ward', '维护', '维护', '胡詩涵', '57XhQhwxBa', '2019-04-30 20:53:38.000', '2020-02-05 08:06:10.000', '2005-01-02 07:26:51.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (294, 'KWr28lVUSh', '585 Alameda Street', '正常', '维护', '彭秀英', 'AoZFCJHPkq', '2020-06-07 10:30:03.000', '2001-10-10 11:07:27.000', '2024-12-27 13:51:02.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (295, 'bx9KZvINI0', '2-3-5 Yoyogi, Shibuya-ku', '正常', '维护', '李安琪', 'iGdGwyWMIP', '2015-03-01 11:24:08.000', '2012-06-01 10:11:17.000', '2003-03-20 05:43:20.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (296, 'OYiTfiKKES', '676 Abingdon Rd, Cumnor', '正常', '维护', '吕璐', 'OSnMrHhcMw', '2021-03-24 09:43:08.000', '2013-02-15 23:02:41.000', '2021-05-24 09:00:55.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (297, 'daD0HOOq1T', '1-7-7 Saidaiji Akodacho', '维护', '维护', '徐睿', 'iMJs1grHPG', '2016-10-16 03:54:50.000', '2000-12-11 22:32:18.000', '2019-04-30 00:28:55.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (298, '82Lqy5h2ss', '3-9-13 Gakuenminami', '正常', '维护', '周岚', 'QEopMUwFOV', '2012-12-02 19:43:12.000', '2015-08-29 04:48:41.000', '2012-10-28 21:22:52.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (299, 'e0xtKASMhv', '10 3-803 Kusunokiajima, Kita Ward', '异常', '异常', '常璐', 'T2ymbzV9Vd', '2000-08-26 15:38:17.000', '2002-05-28 12:47:29.000', '2009-08-17 15:50:13.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (300, 'rc69LAI94u', '63 Little Clarendon St', '异常', '正常', '侯晓明', 'MQN42DVuaT', '2013-01-19 17:15:20.000', '2019-10-25 18:59:12.000', '2011-02-10 03:57:49.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (301, 'MV807WsxdK', '15 3-803 Kusunokiajima, Kita Ward', '维护', '维护', '罗璐', 'DK2U36oJVC', '2004-02-07 03:53:05.000', '2000-09-28 16:36:03.000', '2013-03-25 17:48:33.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (302, 'MIlWRve4B9', '336 Papworth Rd, Trumpington', '正常', '正常', '吴安琪', '3mDriOY9gw', '2013-09-10 14:54:28.000', '2017-09-07 10:33:21.000', '2006-12-30 14:50:45.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (303, 'UjJJO14BZ7', '248 Cannon Street', '正常', '正常', '姜秀英', 'E6Ix7buFYo', '2010-07-21 20:08:09.000', '2013-08-27 17:10:06.000', '2015-07-17 23:40:05.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (304, 'ZGRADxlA6S', '279 Lark Street', '异常', '异常', '武杰宏', 'cfNoCdxsyC', '2022-11-18 13:38:29.000', '2024-10-18 10:32:07.000', '2001-10-22 02:39:07.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (305, 'SXnacu2PGu', '310 FuXingMenNei Street, XiCheng District', '正常', '正常', '阎子异', 'vBy647PhRR', '2008-02-04 11:39:05.000', '2012-12-20 06:02:50.000', '2004-05-19 05:14:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (306, 'gqonoCtVwc', '661 Grape Street', '异常', '异常', '钟安琪', '0Hsr6Imkyc', '2000-01-18 00:25:39.000', '2016-07-27 02:35:14.000', '2015-11-18 20:13:51.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (307, '6gekSA34Ee', '578 Central Avenue', '维护', '维护', '龙嘉伦', '9AkT5Z5fb5', '2012-01-12 07:15:54.000', '2014-10-25 17:41:32.000', '2003-08-25 13:37:17.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (308, 'j9drooXRPL', '921 Wicklow Road', '异常', '异常', '严子韬', 'fbemcfJquq', '2008-04-07 10:27:56.000', '2015-04-02 01:30:43.000', '2004-08-22 02:12:35.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (309, 'eGrxSChZtX', '279 S Broadway', '正常', '异常', '邓睿', '5D0CYgATCU', '2005-02-28 01:26:47.000', '2021-03-23 05:02:46.000', '2023-06-18 10:01:08.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (310, 'RD3X5TVz8E', 'No.735, Dongsan Road, Erxianqiao, Chenghua District', '异常', '正常', '杜睿', 'b5HqUXdMP1', '2011-04-17 00:47:34.000', '2011-02-10 10:52:26.000', '2018-06-18 11:28:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (311, 'FgvMbjgs5Q', '5-2-18 Kikusui 3 Jo, Shiroishi Ward', '异常', '维护', '田子异', 'By1yIHFHiz', '2018-04-24 06:18:35.000', '2002-07-26 14:19:25.000', '2024-11-18 06:37:09.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (312, 'HvTfpwvSlw', '721 Shanhu Rd', '正常', '异常', '张睿', 'Ci46MwHWii', '2012-08-22 06:17:35.000', '2008-09-29 23:22:04.000', '2006-05-26 03:54:20.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (313, 'tA6tPDrs9U', '449 Tianbei 1st Rd, Luohu District', '维护', '维护', '吕晓明', 'pYS3neandu', '2025-04-13 03:25:30.000', '2000-02-08 00:30:24.000', '2019-03-18 18:49:05.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (314, 'EfyyZupHZv', '202 New Street', '异常', '维护', '张子韬', 'oOkaH1t4QS', '2023-12-23 03:24:30.000', '2010-02-21 00:03:08.000', '2016-03-30 05:09:54.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (315, '0wJSihPLVX', '375 East Wangfujing Street, Dongcheng District ', '维护', '异常', '韦云熙', 'lMltImqe2o', '2013-06-27 13:40:24.000', '2004-11-22 10:20:21.000', '2007-09-06 17:08:19.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (316, 'ItgDR4rVwR', '3-19-4 Shimizu, Kita Ward', '正常', '正常', '宋詩涵', 'FQUYRndYXa', '2003-12-14 01:58:50.000', '2009-10-27 14:58:45.000', '2004-07-04 16:39:47.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (317, 'YiWiQrufAy', '699 Cannon Street', '维护', '正常', '龙睿', 'COOGpiuS8T', '2004-11-09 23:39:28.000', '2017-11-24 09:33:25.000', '2017-01-24 04:52:45.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (318, 'ckOucwGwzy', '556 West Market Street', '正常', '正常', '萧詩涵', '8Pbxuczpmv', '2004-06-27 00:05:31.000', '2016-07-01 00:19:48.000', '2013-07-05 07:16:54.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (319, 'kV2WQrBCsL', '1-6-2, Marunouchi, Chiyoda-ku', '维护', '异常', '韦宇宁', 'A8upmkRxtQ', '2018-08-20 08:02:25.000', '2012-02-28 14:15:34.000', '2007-07-03 07:37:00.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (320, 'fI4QWB4IAW', '694 Xiaoping E Rd, Baiyun ', '维护', '异常', '徐嘉伦', 'TprNc3AxXR', '2024-10-20 02:19:57.000', '2024-02-26 01:04:57.000', '2021-08-23 01:21:27.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (321, '4a2xJxmcBQ', '436 Sackville St', '异常', '维护', '高子韬', 'VIYI2GnvkM', '2017-10-21 15:36:37.000', '2016-03-22 18:39:01.000', '2011-12-17 12:49:17.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (322, 'P1epocqWzO', '3-9-17 Gakuenminami', '异常', '正常', '严晓明', 'zvhPTjPQ8m', '2019-07-15 10:18:47.000', '2015-07-24 06:29:07.000', '2003-11-25 15:13:46.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (323, 'HN7MGeSyPO', '743 New Wakefield St', '异常', '异常', '傅子异', 's3JLQxhNqb', '2023-12-16 18:19:22.000', '2005-04-27 04:03:52.000', '2015-01-28 08:35:41.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (324, '6bk31Lcy82', '6-1-18, Miyanomori 4 Jō, Chuo Ward', '正常', '维护', '邹子韬', 'bYDqoH95W9', '2003-11-09 13:12:36.000', '2020-11-25 05:51:31.000', '2019-06-27 21:14:26.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (325, 'WgwC5Wu1bp', '902 Cyril St, Braunstone Town', '正常', '维护', '程晓明', 'J8mKpS4vN3', '2018-01-21 07:30:14.000', '2025-03-12 09:21:07.000', '2011-10-26 05:13:47.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (326, 'GL76ibhimI', '767 Wooster Street', '异常', '维护', '韦云熙', 'DIWOIwbEYA', '2006-02-06 22:18:42.000', '2006-11-10 09:20:08.000', '2017-11-07 02:55:37.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (327, 'hfyMZaV6NB', '539 Cyril St, Braunstone Town', '正常', '异常', '薛云熙', 'reMqVluPsD', '2002-07-19 08:21:19.000', '2022-12-22 18:14:05.000', '2007-08-10 03:36:37.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (328, 'oMjCexOKaW', '993 Binchuan Rd, Minhang District', '维护', '维护', '杜璐', 'SKJzH8lKvw', '2003-06-07 03:58:25.000', '2019-02-14 03:52:40.000', '2015-04-30 15:34:06.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (329, 'D8ATxRKjgr', '610 Trafalgar Square, Charing Cross', '维护', '异常', '汪杰宏', 'en6m6k3CCW', '2000-02-20 04:54:03.000', '2001-09-07 22:06:24.000', '2024-08-01 11:29:57.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (330, 'rtFXetQPNw', '126 Cannon Street', '异常', '正常', '龙宇宁', 'zkgfuf6wxn', '2008-04-09 13:11:39.000', '2020-08-30 10:23:00.000', '2010-11-10 03:45:35.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (331, 'sBkB6XjBNG', '357 North Michigan Ave', '正常', '正常', '熊子韬', '4b07EguZBW', '2006-04-27 15:27:35.000', '2018-07-13 18:57:49.000', '2008-12-31 09:22:13.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (332, 'CLMCD4qXiS', '5-2-6 Higashi Gotanda, Shinagawa-ku ', '异常', '维护', '陶璐', 'scgeQqWko1', '2019-07-12 04:02:06.000', '2007-03-02 23:40:15.000', '2006-06-19 15:32:13.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (333, 'zFOpebuI5V', '309 Hanover Street', '正常', '异常', '孙子异', 'p9agPV3vos', '2000-02-05 12:49:57.000', '2014-04-30 23:59:46.000', '2010-03-29 18:23:39.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (334, 'OM4HqCSHWZ', '828 Shennan E Rd, Cai Wu Wei, Luohu District', '正常', '异常', '刘宇宁', 'YnUJNliR47', '2003-03-06 21:26:22.000', '2011-09-11 22:32:23.000', '2006-03-18 23:57:56.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (335, 'k9lzuhcBu4', '465 Middle Huaihai Road, Huangpu District', '维护', '异常', '钟致远', 'QVuYIxUA1O', '2005-01-07 19:02:04.000', '2008-07-31 01:33:20.000', '2025-02-22 10:23:41.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (336, 'ySVbS5atZt', '598 39 William IV St, Charing Cross', '异常', '维护', '廖睿', 'b2CyfwZvvl', '2009-01-31 22:06:17.000', '2000-10-07 21:19:04.000', '2009-12-11 00:06:26.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (337, '4GRs3qW2sH', '612 Sanlitun Road, Chaoyang District', '维护', '维护', '吴云熙', 'PUTFzfCRFw', '2001-08-22 06:27:10.000', '2017-04-28 20:09:29.000', '2012-03-18 02:31:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (338, 'hyh6ynkUjX', '2 Papworth Rd, Trumpington', '异常', '维护', '孙璐', 'OgWeH8BpQn', '2009-10-05 21:28:33.000', '2021-06-13 18:13:48.000', '2018-08-12 11:40:43.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (339, '2W8Fch8qFK', '988 Riverview Road', '正常', '维护', '孙岚', '6A5tzFhHii', '2007-07-21 05:12:05.000', '2019-03-19 10:45:45.000', '2007-02-19 10:37:24.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (340, 'SfhyVVt0jh', '583 Xue Yuan Yi Xiang, Longgang', '异常', '异常', '何杰宏', 's5udBZUezK', '2009-07-14 20:22:11.000', '2000-09-02 18:52:54.000', '2001-08-18 02:59:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (341, 'HFK3AA7iA9', '143 Kengmei 15th Alley', '维护', '维护', '严嘉伦', '7u9M9GSxRd', '2017-03-12 05:01:13.000', '2008-08-04 20:26:35.000', '2019-08-15 10:22:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (342, 'uAonxpBiqq', '5-4-16 Kikusui 3 Jo, Shiroishi Ward,', '维护', '异常', '朱晓明', 'FZPD9BxnNf', '2015-02-21 02:42:30.000', '2021-06-29 02:05:03.000', '2014-02-07 22:46:22.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (343, '1UGDcjHj6F', '277 Dongtai 5th St', '异常', '正常', '郭秀英', 'Gm3ECbGDig', '2019-07-11 22:07:39.000', '2010-07-01 14:02:56.000', '2006-07-19 21:26:34.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (344, 'wRmpGgPs77', '731 Wall Street', '正常', '正常', '廖岚', 'xSnPmdvxfd', '2018-02-27 06:56:31.000', '2008-08-20 05:46:10.000', '2010-06-28 13:28:11.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (345, 'HMvtKmIavz', '926 Fifth Avenue', '异常', '维护', '史秀英', 'ju6AEUzUZE', '2003-12-05 08:46:43.000', '2009-09-05 19:33:24.000', '2023-04-18 23:01:37.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (346, '8xfD0GJSXP', '127 Lark Street', '维护', '维护', '钟璐', 'oY6HM1ft0D', '2022-05-03 14:30:38.000', '2010-12-25 19:06:47.000', '2012-11-17 19:55:52.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (347, '1lhWwqGOOn', '617 Jianxiang Rd, Pudong', '正常', '正常', '戴秀英', 'eV4JhsA6HS', '2015-08-13 21:20:46.000', '2012-12-01 09:50:36.000', '2005-04-08 01:10:45.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (348, '3KqtP8LOPR', '10 4-20 Kawagishicho, Mizuho Ward', '正常', '维护', '曹嘉伦', 'NtKuDMQ0sP', '2003-12-31 12:58:58.000', '2004-12-02 14:58:00.000', '2006-07-17 18:52:44.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (349, 'VvqsDFs3Bk', '941 1st Ave', '维护', '异常', '侯子异', '85YbIsT9Kg', '2009-07-30 05:06:41.000', '2023-04-06 00:10:03.000', '2011-02-15 15:14:55.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (350, 'AV7fbdLL02', '871 Wooster Street', '维护', '正常', '蒋璐', 'cneZBvLapB', '2016-03-07 11:08:49.000', '2012-12-02 16:06:22.000', '2011-02-25 00:56:12.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (351, 'vkxLGQVNaM', '545 Fifth Avenue', '维护', '维护', '叶詩涵', 'FQD7o6DQ3j', '2001-06-21 08:36:47.000', '2020-12-14 11:27:53.000', '2024-06-01 12:13:54.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (352, '1emQKpOzre', '717 Riverview Road', '异常', '正常', '于震南', 'IUbI1M31hF', '2018-05-11 03:00:52.000', '2006-01-21 16:21:37.000', '2016-09-04 02:44:41.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (353, 'KX7zqJGr0F', '340 Abingdon Rd, Cumnor', '正常', '异常', '曹晓明', 'U6Xyw50Okk', '2014-07-06 00:54:18.000', '2002-06-23 23:22:48.000', '2000-06-27 08:33:54.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (354, '8Yea65KQL0', '839 S Broadway', '正常', '异常', '吕晓明', 'ocFd6netqb', '2002-06-06 11:38:14.000', '2016-10-16 03:00:36.000', '2023-11-20 16:14:55.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (355, 'XcZv2J8wze', '2-3-9 Yoyogi, Shibuya-ku', '维护', '异常', '林晓明', 'qvvob8V7y3', '2025-03-26 10:36:47.000', '2017-09-07 16:34:55.000', '2004-04-20 04:05:13.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (356, 'Cn3OWQuYpJ', '868 FuXingMenNei Street, XiCheng District', '正常', '正常', '汤震南', 'PuMZUM18gZ', '2001-11-20 21:41:42.000', '2001-08-13 19:46:53.000', '2010-10-06 06:50:06.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (357, 'FXnLaciTSH', '479 S Broadway', '维护', '维护', '韦秀英', 'Ekr23NBmkV', '2017-12-16 07:09:57.000', '2000-10-30 11:50:21.000', '2010-11-27 10:46:42.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (358, 'wrqfDKRX9B', '337 Tianbei 1st Rd, Luohu District', '异常', '异常', '邹嘉伦', '1Ekl9em5gX', '2000-12-03 22:28:35.000', '2007-04-06 02:28:30.000', '2021-03-23 05:13:25.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (359, '4d0zs0E7b2', '1-7-14 Saidaiji Akodacho', '正常', '异常', '胡安琪', '0cuEmxGBaz', '2016-11-11 17:36:55.000', '2014-06-30 10:35:24.000', '2016-01-06 09:07:42.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (360, 'Ue8OVvLoRN', '5 4-20 Kawagishicho, Mizuho Ward', '正常', '维护', '邱子韬', 'GxGPv5Vr6g', '2019-11-27 05:49:29.000', '2011-09-07 00:00:53.000', '2007-10-23 15:56:10.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (361, 'pgX0zxkNCC', '28 Fern Street', '正常', '维护', '侯嘉伦', 'FddRdRlOOJ', '2000-02-10 21:55:31.000', '2007-11-17 09:46:39.000', '2007-07-27 14:34:14.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (362, 'Q3e5TxOplL', '943 Lefeng 6th Rd', '异常', '正常', '蔡秀英', 'P6nE2sf4gx', '2005-08-17 02:00:25.000', '2024-11-23 20:43:18.000', '2008-03-31 23:49:49.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (363, 'HBB5RH6StP', '975 Bank Street', '维护', '正常', '曹睿', '60zEzx1Uzn', '2000-12-09 04:40:18.000', '2021-12-02 09:24:06.000', '2003-10-17 20:18:59.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (364, '34eNmNLXmq', '1-5-12, Higashi-Shimbashi, Minato-ku', '异常', '正常', '谢睿', '4RfiKtVeX8', '2013-05-23 17:53:57.000', '2004-12-27 08:19:20.000', '2012-07-10 06:59:54.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (365, 'FxcvsRW982', '5-19-14 Shinei 4 Jo, Kiyota Ward', '正常', '异常', '石秀英', 'PTjlpBGFj1', '2018-02-15 04:51:35.000', '2015-09-15 15:43:20.000', '2007-08-17 23:24:54.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (366, 'uRZ4juiQ0H', '4 3-803 Kusunokiajima, Kita Ward', '正常', '异常', '潘子韬', 'RTvUmlLExB', '2023-05-22 17:00:33.000', '2020-10-04 15:44:34.000', '2004-09-23 03:13:05.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (367, 'eDXjlL532y', '268 Lefeng 6th Rd', '正常', '正常', '郭杰宏', '1j4jNzxM8j', '2021-02-13 09:12:03.000', '2006-01-17 23:07:03.000', '2014-08-07 19:54:06.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (368, 'kFyp6MppEj', '905 Collier Road', '维护', '正常', '林子韬', 'CvHZreCS05', '2022-11-21 01:26:09.000', '2024-12-17 05:43:13.000', '2004-09-12 02:28:45.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (369, 'ojA0F4Kaj3', '2-1-2 Kaminopporo 1 Jo, Atsubetsu Ward', '正常', '维护', '阎嘉伦', 'gYSnaSAbj8', '2008-11-02 02:28:28.000', '2020-12-11 21:45:49.000', '2000-08-12 14:19:15.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (370, 'gePU1BtcEL', '932 Wooster Street', '正常', '异常', '卢子异', 'NO2T53xrZP', '2007-08-25 00:26:23.000', '2020-02-08 21:19:21.000', '2015-12-28 14:52:06.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (371, 'uO5myh47mC', '461 Broadway', '正常', '维护', '张子韬', 'FjOsggTGhq', '2023-08-07 17:26:36.000', '2007-03-05 11:53:27.000', '2001-10-26 10:47:47.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (372, '2qgsICHf4h', '42 Fern Street', '正常', '维护', '卢子韬', 'C77eRl1Hni', '2001-01-06 05:17:50.000', '2019-12-01 01:00:32.000', '2006-11-09 05:45:23.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (373, 'rGSBZTcoyq', '488 Central Avenue', '维护', '异常', '王云熙', 'uJt7xNtaSf', '2016-03-09 21:04:29.000', '2003-06-24 11:41:43.000', '2010-01-19 11:16:38.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (374, '29FXXrLHAl', '607 Regent Street', '维护', '异常', '邱子异', 'TBBaVXytkR', '2013-09-05 16:25:01.000', '2013-11-23 15:19:42.000', '2010-06-12 16:22:43.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (375, '7zdk8Nbmuq', '726 Kengmei 15th Alley', '正常', '异常', '李睿', 'TfWVuwgfqQ', '2016-04-08 16:20:56.000', '2008-11-10 21:42:39.000', '2008-08-05 22:02:38.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (376, 'NDX5uUWVYl', '123 Wyngate Dr', '异常', '异常', '阎子异', 'Se2ylw0Cn0', '2009-01-19 19:35:11.000', '2014-09-22 21:03:06.000', '2009-10-07 11:21:05.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (377, 'RABFnMsCuO', '176 Columbia St', '异常', '异常', '戴嘉伦', 'afU99jkFIq', '2024-07-26 21:56:10.000', '2021-07-18 15:33:24.000', '2010-08-25 00:59:08.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (378, 'jU2Hyoeq8C', '25 Sanlitun Road, Chaoyang District', '维护', '异常', '孙杰宏', 'mmqrvccu7a', '2006-05-23 01:51:19.000', '2019-01-23 08:21:36.000', '2003-06-10 06:40:52.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (379, 'kbx9bLYRbx', '263 Spring Gardens', '异常', '异常', '崔璐', 'f0KQ7EbiUP', '2000-05-25 09:07:38.000', '2019-07-01 07:54:16.000', '2000-10-15 22:50:55.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (380, 'Ec8zt6POz6', '1-7-4 Saidaiji Akodacho', '异常', '维护', '侯睿', 'WbIzNQvbkM', '2007-09-29 09:03:58.000', '2014-01-06 05:30:31.000', '2016-03-17 19:53:00.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (381, 'XGwyXj9tp8', '53 Riverview Road', '异常', '维护', '向宇宁', 'lc2ScqMyC6', '2024-03-27 21:12:28.000', '2011-08-19 23:13:11.000', '2015-10-19 20:09:20.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (382, 'xfdulcodUW', '7 4-20 Kawagishicho, Mizuho Ward', '异常', '维护', '田子韬', 'UNkZ44jfpF', '2023-01-27 14:15:01.000', '2006-08-04 03:50:03.000', '2009-04-18 12:35:31.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (383, 'q5o9gjB6if', '203 Grape Street', '维护', '维护', '梁璐', 'vcUwhGyErB', '2016-04-12 09:16:17.000', '2009-09-10 22:50:02.000', '2010-10-20 11:57:58.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (384, '6M4JLVKzbL', '1-7-1 Omido, Higashiosaka', '正常', '异常', '武璐', 'O24oebq2Ij', '2024-05-15 12:47:55.000', '2011-08-05 15:09:51.000', '2000-07-07 06:29:38.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (385, 'qi9Ahs1IXQ', '1-7-17 Saidaiji Akodacho', '维护', '维护', '魏晓明', 'B7KdlUiKQ8', '2018-09-27 06:45:18.000', '2003-11-01 13:41:19.000', '2009-07-13 22:18:08.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (386, '6EBjU1uRMy', '5-2-3 Kikusui 3 Jo, Shiroishi Ward', '异常', '异常', '郑致远', 'lyPHWsvmxI', '2012-07-30 15:10:44.000', '2004-04-01 10:27:55.000', '2021-04-07 12:56:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (387, 'fvbIFwpc32', '219 4th Section  Renmin South Road, Jinjiang District', '正常', '正常', '梁詩涵', 'kZjbLpubXY', '2014-05-23 17:00:53.000', '2000-12-18 11:22:16.000', '2012-07-29 03:37:05.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (388, 'y9LcgcuQFE', '132 West Chang\'an Avenue, Xicheng District', '正常', '异常', '张璐', 'fDbsUPSmWs', '2023-12-20 08:20:49.000', '2016-06-15 15:34:47.000', '2015-10-15 18:08:49.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (389, 'zCH0E3xdgi', '371 Stephenson Street', '异常', '维护', '萧致远', 'O7z7lB7BcC', '2016-12-13 00:36:15.000', '2016-02-16 20:49:18.000', '2017-05-11 16:03:57.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (390, '9ZF0Ts62nO', '4-9-3 Kamihigashi, Hirano Ward', '异常', '异常', '史晓明', '5PMcVhGR8x', '2008-11-24 04:51:01.000', '2002-10-04 21:29:51.000', '2001-12-05 15:52:27.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (391, 'te6EKNco4e', '5-2-6 Higashi Gotanda, Shinagawa-ku ', '正常', '异常', '曾子韬', 'ZRgeqhQin5', '2009-11-14 13:39:38.000', '2011-02-13 13:11:06.000', '2010-03-03 08:52:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (392, 'cwHk4HaNo9', '17 3-803 Kusunokiajima, Kita Ward', '异常', '异常', '刘安琪', '2yirG8Idwm', '2002-06-05 16:07:57.000', '2022-07-18 16:19:52.000', '2016-02-03 21:12:44.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (393, 'RKgUshUIEW', '494 W Ring Rd, Buji Town, Longgang', '正常', '正常', '吕致远', 'Bw9TJm9OIX', '2004-10-05 12:53:12.000', '2019-10-22 10:31:03.000', '2024-05-09 21:06:36.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (394, 'OchlS43aII', '2-1-5 Tenjinnomori, Nishinari Ward', '异常', '正常', '尹晓明', '8VWPWmBDIV', '2001-01-20 11:44:53.000', '2007-09-18 14:50:46.000', '2011-05-14 15:44:44.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (395, 'ec6HtSZbMO', '62 Lower Temple Street', '维护', '维护', '向嘉伦', '95Q3d4VlPb', '2021-03-14 04:51:16.000', '2009-05-10 21:14:45.000', '2003-03-10 07:34:45.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (396, 'INDNRbC4T3', '978 Cyril St, Braunstone Town', '异常', '异常', '袁致远', 'iCtdmzUYGl', '2017-03-29 12:52:01.000', '2010-10-08 11:38:18.000', '2006-02-02 03:31:39.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (397, 'Hnh5cxCsLh', '844 Wicklow Road', '正常', '维护', '吴岚', 'GzrBoHEBDB', '2012-03-22 20:21:28.000', '2002-05-31 08:26:54.000', '2002-07-09 15:26:23.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (398, 'laFZqUWDnO', '851 Hanover St', '维护', '异常', '唐子韬', 'fwoOGQv6Vl', '2023-04-20 22:21:33.000', '2023-10-29 01:30:44.000', '2011-12-30 06:43:07.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (399, 'kPZsSqUSBT', '754 Sanlitun Road, Chaoyang District', '维护', '正常', '李杰宏', 'acGUfQ30iE', '2016-05-26 12:42:42.000', '2007-12-31 19:35:02.000', '2020-11-03 13:41:44.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (400, '4w0DL378QY', '979 Ridgewood Road', '维护', '异常', '郝秀英', 'iIhdLOkPBD', '2005-10-05 07:05:57.000', '2022-03-24 20:33:13.000', '2020-04-08 08:36:49.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (401, 'WS8d9uXJae', '783 Central Avenue', '维护', '正常', '许杰宏', 'p5KDviFuDM', '2005-07-23 02:29:22.000', '2020-02-25 05:07:50.000', '2023-06-25 02:09:27.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (402, 'iv1zriKzNw', '1-6-12, Marunouchi, Chiyoda-ku', '维护', '正常', '孔杰宏', 'byiCVOFRfu', '2014-05-24 12:23:20.000', '2004-05-20 19:39:03.000', '2006-03-22 21:46:43.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (403, 'oNi7UrGI9L', '967 Narborough Rd', '正常', '维护', '孔云熙', 'xfq6f1Swew', '2019-11-19 13:37:45.000', '2024-09-29 10:53:56.000', '2003-07-26 11:53:58.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (404, '2Oy8LhzZjV', '78 Rush Street', '异常', '维护', '孔云熙', 'MgwzLYmvFz', '2016-07-08 10:37:20.000', '2016-03-23 16:32:35.000', '2011-09-23 00:49:49.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (405, 'XS4hQkNX4D', '707 Narborough Rd', '异常', '维护', '苏子异', 'iOMPYZEVsE', '2023-10-05 03:04:56.000', '2017-01-25 05:44:53.000', '2006-07-29 07:44:47.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (406, 'M3YjJ4Jj13', '225 Jingtian East 1st St, Futian District', '维护', '正常', '郝云熙', 'GllQLVCbDI', '2013-04-19 13:24:18.000', '2012-07-31 16:13:38.000', '2006-12-28 23:49:33.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (407, 'UzOFSI6GGf', '545 Huaxia St, Jinghua Shangquan', '正常', '异常', '潘致远', 'r2JH6pVg4E', '2007-12-08 23:22:10.000', '2015-04-29 10:38:56.000', '2001-03-22 22:36:55.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (408, 'ylF2T2FGf1', '795 The Pavilion, Lammas Field, Driftway', '正常', '正常', '许安琪', 'HWbvj8KXLB', '2001-05-22 13:27:38.000', '2022-12-03 14:01:46.000', '2020-09-23 21:55:08.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (409, 'ffgM0vV1ze', '741 Diplomacy Drive', '正常', '正常', '何詩涵', 'MBaxSEQ3qX', '2015-02-17 13:03:41.000', '2025-04-14 08:27:16.296', '2025-03-23 19:40:16.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (410, 'QxcVY8w4oA', '2-1-12 Kaminopporo 1 Jo, Atsubetsu Ward', '正常', '异常', '傅震南', 'noi4JjzskX', '2001-09-08 20:38:21.000', '2001-06-23 21:34:52.000', '2017-08-22 01:30:43.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (411, 'oL6CUHpTeF', '949 Tangyuan Street 5th Alley, Airport Road, Baiyun', '正常', '维护', '田云熙', 'GViFL1x9Bl', '2014-09-22 11:16:13.000', '2006-05-11 13:24:40.000', '2001-12-09 11:33:33.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (412, 'eN1XEzTJxM', '659 Hanover Street', '维护', '维护', '秦安琪', 'iM0gsJ2nwR', '2002-01-21 06:50:03.000', '2013-09-28 02:55:26.000', '2020-04-25 10:44:56.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (413, 'XLIRU8vNCS', '771 Hanover St', '正常', '维护', '赵安琪', 'Iwls9aSegF', '2015-02-15 01:14:52.000', '2018-03-12 11:11:59.000', '2006-08-22 00:52:07.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (414, 'P0sVVTAcx8', '585 Ridgewood Road', '异常', '正常', '叶震南', 'CHNuwwap02', '2016-09-08 18:17:58.000', '2020-11-02 21:41:20.000', '2024-10-04 02:55:02.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (415, 'NGZvlT0rVn', '926 Broadway', '正常', '正常', '潘云熙', 'dOwK2Vr0qE', '2001-09-21 16:13:18.000', '2009-09-14 01:14:14.000', '2023-12-13 20:16:07.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (416, '1A6nRwrBb1', '591 State Street', '异常', '异常', '方杰宏', '8T4Z4UChnb', '2016-05-17 02:53:58.000', '2000-04-17 17:01:44.000', '2010-07-01 12:27:10.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (417, 'NPELbuaBIA', '975 Portland St', '正常', '异常', '吕安琪', 'vQIM8X17qa', '2012-09-12 08:58:10.000', '2019-07-14 11:02:54.000', '2009-05-10 14:36:58.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (418, 'XarYb6nYJy', 'No.951, Dongsan Road, Erxianqiao, Chenghua District', '维护', '维护', '夏云熙', 'Vm77GVbDj3', '2016-02-02 23:05:12.000', '2021-12-28 10:16:39.000', '2001-05-16 12:00:27.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (419, 'xCWwRy6WXE', '679 Hinckley Rd', '维护', '维护', '汪嘉伦', 'dv2llNzSUy', '2010-10-07 14:35:42.000', '2019-08-16 05:37:48.000', '2006-11-05 05:25:31.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (420, '0WgG2BJNGo', '3-27-10 Higashitanabe, Higashisumiyoshi Ward', '异常', '维护', '钟云熙', 'J0Psbfwjzc', '2003-04-02 00:27:20.000', '2002-07-25 14:19:18.000', '2016-01-19 12:32:23.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (421, 'prLp6q9s8t', '770 Regent Street', '正常', '维护', '朱安琪', '2SjDQxTv0T', '2011-09-17 14:11:10.000', '2009-03-20 04:29:32.000', '2024-12-29 02:42:57.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (422, 'IkRqMg83IN', '3-9-12 Gakuenminami', '正常', '异常', '李致远', 'ekd67zUHJv', '2010-04-30 03:46:51.000', '2001-05-03 08:47:06.000', '2019-10-14 10:22:27.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (423, '4crrbygVO9', '372 Lefeng 6th Rd', '正常', '异常', '徐安琪', 'qryH2McKy4', '2009-04-22 07:22:49.000', '2008-08-09 00:39:45.000', '2008-03-22 15:39:21.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (424, 'LJnJMOxn5s', '908 Xue Yuan Yi Xiang, Longgang', '异常', '异常', '龙子异', 'dAoHJ55fB5', '2009-11-06 13:06:33.000', '2018-02-27 14:05:11.000', '2020-04-27 22:09:30.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (425, 'I2cHCDois8', '1-5-7, Higashi-Shimbashi, Minato-ku', '异常', '维护', '曹致远', 'tR429YaNzx', '2009-08-17 23:33:36.000', '2025-03-24 03:29:55.000', '2008-03-06 22:19:58.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (426, 'XduEihE5Cn', '948 State Street', '异常', '正常', '向宇宁', 'wRYPAJMjzh', '2011-02-08 00:48:50.000', '2023-05-04 02:41:25.000', '2001-09-04 19:11:10.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (427, 'updBcVqrKE', '479 Hinckley Rd', '异常', '维护', '邱震南', 'DEhhoXdWew', '2015-09-07 09:16:38.000', '2005-05-28 02:56:16.000', '2014-11-01 12:08:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (428, 'wz5Z3g6kAN', '519 Pedway', '维护', '维护', '袁詩涵', 'Mbp9On6JDz', '2024-05-24 21:52:15.000', '2012-04-27 13:12:04.000', '2006-04-08 00:20:19.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (429, 'sB89SlSWLW', '830 Diplomacy Drive', '异常', '异常', '罗晓明', 'IJgSaTaD4L', '2016-02-28 17:48:32.000', '2010-07-31 21:08:10.000', '2008-10-23 01:18:19.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (430, 'KZYH7eNSvJ', '808 Ganlan Rd, Pudong', '异常', '维护', '冯睿', 'tKF2oF4ox5', '2014-11-20 20:06:40.000', '2017-07-05 05:47:29.000', '2017-06-12 02:43:54.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (431, 'sX31zCM8C5', '644 1st Ave', '异常', '正常', '黎云熙', '2vPKX9z228', '2013-03-02 16:38:02.000', '2014-03-04 01:47:06.000', '2007-03-04 15:48:40.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (432, '1x8lTf9UR1', '13 1-1 Honjocho, Yamatokoriyama', '正常', '维护', '沈震南', 'USpThH6qa3', '2009-04-06 03:08:39.000', '2018-10-29 13:46:09.000', '2002-12-12 12:49:15.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (433, 'Ekay29Ss24', '409 Jingtian East 1st St, Futian District', '异常', '维护', '汤詩涵', '0w7kDbKM0S', '2000-04-08 17:05:11.000', '2012-12-30 17:53:09.000', '2009-06-11 02:58:45.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (434, 'N2fUcLJGZF', '956 028 County Rd, Yanqing District', '正常', '正常', '薛璐', 'sicJXMSGrY', '2004-08-03 16:18:12.000', '2010-02-12 14:23:17.000', '2005-02-27 04:18:00.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (435, 'i58LohWZng', '2 1-1715 Sekohigashi, Moriyama Ward', '正常', '维护', '袁岚', 'nzDP1pnHDJ', '2023-10-17 02:18:46.000', '2018-06-29 09:10:05.000', '2024-04-29 04:12:06.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (436, 'YfNNmmmkTz', '678 Osney Mead', '异常', '异常', '赵宇宁', '1xpjELIssD', '2011-03-17 11:59:06.000', '2012-06-13 18:35:55.000', '2022-07-22 03:56:17.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (437, 'BpPt8orhuv', '781 North Michigan Ave', '正常', '正常', '黎杰宏', 'FQ2LJfZjLv', '2009-04-02 09:51:33.000', '2018-09-23 04:23:23.000', '2019-08-28 11:18:05.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (438, 'NSb5zHKlAZ', '17 1-1715 Sekohigashi, Moriyama Ward', '正常', '异常', '任子韬', 'fyIfbWBtqR', '2017-08-19 08:57:16.000', '2008-09-18 23:32:01.000', '2012-06-14 05:36:51.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (439, '2T8rRGYxQQ', '159 Kengmei 15th Alley', '正常', '正常', '邵睿', '0PvUkTBTyB', '2005-07-07 14:35:05.000', '2017-08-04 08:00:55.000', '2016-11-24 23:54:30.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (440, 'lQ1lO29WTN', '716 Fern Street', '维护', '正常', '方子异', 'EaM2SSTfjy', '2008-06-22 00:23:23.000', '2014-04-17 22:50:13.000', '2017-04-09 18:51:21.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (441, 'cGbISFfSJ9', '949 Sky Way', '异常', '维护', '陶晓明', 'd4SdCwg0t7', '2015-04-13 04:00:38.000', '2006-05-14 09:21:21.000', '2017-12-17 13:57:33.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (442, 'zFLDFsHJpt', '628 Silver St, Newnham', '异常', '维护', '史詩涵', 'QOExCM0A9S', '2006-08-18 19:05:28.000', '2024-03-01 23:33:35.000', '2008-03-17 03:24:32.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (443, 'BjoUjvTJ0T', '53 Jianxiang Rd, Pudong', '维护', '维护', '谢嘉伦', 'gEpXIduCSV', '2014-05-14 14:14:05.000', '2022-06-14 04:58:18.000', '2018-09-18 18:27:43.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (444, 'bKDdNRhUjC', '935 Central Avenue', '异常', '维护', '龙震南', 'vzCuJKfItq', '2014-02-02 01:32:52.000', '2012-10-02 04:14:05.000', '2008-10-17 12:51:24.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (445, 'aIxD11PwHl', '997 Dongtai 5th St', '维护', '维护', '何晓明', 'eX8h4gveKz', '2023-03-17 17:48:22.000', '2023-08-02 22:41:49.000', '2012-08-17 10:52:50.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (446, 'PVAaouBxct', '246 1st Ave', '异常', '正常', '钱宇宁', 'JDR9dsnQsr', '2020-09-23 20:27:49.000', '2018-08-11 23:19:13.000', '2006-12-01 21:37:50.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (447, 'udADhvKz4P', '11 Sanlitun Road, Chaoyang District', '正常', '正常', '谢詩涵', 'jmcjw88faH', '2019-05-10 08:20:52.000', '2020-12-12 09:16:03.000', '2023-10-21 22:41:36.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (448, 'vgLmB4570B', '457 Figueroa Street', '异常', '维护', '范晓明', 'gwt1DIcmUf', '2018-10-20 19:27:04.000', '2000-06-22 01:54:31.000', '2008-10-29 06:12:04.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (449, 'rPnYRtRNLi', '840 S Broadway', '异常', '异常', '田嘉伦', 'ib2GToZaQw', '2015-10-20 12:31:03.000', '2009-04-12 18:32:50.000', '2002-04-28 20:17:48.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (450, 'xayJdtayX9', '909 Jianxiang Rd, Pudong', '异常', '异常', '宋子韬', 'ix95qD3dNE', '2001-03-05 01:38:08.000', '2017-08-24 06:10:47.000', '2005-08-10 21:42:37.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (451, 'BPjfUQBhSQ', '775 Lodge Ln, Toxteth', '正常', '正常', '范岚', 'M13ZRehbOt', '2015-12-24 09:33:46.000', '2021-01-19 18:35:39.000', '2003-03-19 08:38:11.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (452, 'CgUgvyKQ7g', '13-3-10 Toyohira 3 Jo, Toyohira Ward', '正常', '正常', '吕杰宏', 'X21hENV8hK', '2022-11-02 09:09:24.000', '2023-05-14 09:39:31.000', '2007-04-01 17:37:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (453, '7NILwcBq3d', '759 Collier Road', '异常', '异常', '冯晓明', 'QVvAMDHcox', '2009-09-24 11:54:57.000', '2019-01-27 12:37:28.000', '2012-05-29 19:54:56.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (454, 'KUsDNm1PaT', '631 4th Section  Renmin South Road, Jinjiang District', '异常', '正常', '汪宇宁', 'fTqKigemcS', '2017-04-26 22:05:26.000', '2017-05-30 04:09:17.000', '2014-08-18 02:31:36.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (455, 'nz8W5QPWwa', '256 1st Ave', '维护', '异常', '徐子韬', 'BQQZ7TujTF', '2009-12-16 06:28:56.000', '2021-08-21 00:02:38.000', '2014-01-21 04:21:42.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (456, '18EBbow578', '4-9-17 Kamihigashi, Hirano Ward', '异常', '维护', '梁安琪', '7LfhGN4XCI', '2025-03-22 16:52:28.000', '2015-01-02 10:31:15.000', '2008-09-05 20:42:00.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (457, 'w6yDCSiU7b', '572 Little Clarendon St', '异常', '正常', '周致远', 'uwGywaXg6w', '2006-09-29 01:56:31.000', '2025-02-15 10:44:18.000', '2001-04-21 06:45:15.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (458, 'Kj5SU7Sdgh', '5-4-20 Kikusui 3 Jo, Shiroishi Ward,', '维护', '异常', '黎詩涵', 'Y2DB9DGy5t', '2000-02-24 18:23:09.000', '2009-01-06 06:28:24.000', '2017-06-08 17:20:12.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (459, 'F82bfxkESb', '965 Riverview Road', '维护', '正常', '邵杰宏', 'RdA60fPPfs', '2016-03-19 23:32:38.000', '2014-10-18 20:43:40.000', '2017-04-13 02:33:48.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (460, 'IY36AH2pLv', '91 Ridgewood Road', '正常', '维护', '姚杰宏', 'x3Cvxg9ODy', '2021-03-05 11:26:19.000', '2018-01-19 19:10:36.000', '2018-01-15 07:17:55.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (461, 'mp2fPb0Olq', '617 Trafalgar Square, Charing Cross', '维护', '异常', '于嘉伦', 'uBZYE7McAL', '2004-03-23 23:40:36.000', '2004-10-06 13:14:28.000', '2011-10-07 11:55:37.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (462, '2dLRg3IxQV', '615 Jingtian East 1st St, Futian District', '正常', '正常', '徐致远', 't0CUBALX29', '2000-08-08 04:20:15.000', '2007-11-27 06:29:47.000', '2023-12-21 13:22:34.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (463, 'Z6h1XNaUXJ', '397 Volac Park, Grantchester Rd', '异常', '维护', '梁詩涵', 'zhGXU8uOMR', '2004-03-31 05:09:27.000', '2001-08-03 21:54:27.000', '2018-07-29 09:51:53.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (464, 'WYNxzLcEgH', '190 NO.6, YuShuang Road, ChengHua Distric', '维护', '异常', '秦致远', '84Cm0E6fce', '2023-11-03 13:26:42.000', '2014-04-17 23:03:46.000', '2011-08-31 12:58:18.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (465, '3apk85kVqh', '156 Lower Temple Street', '异常', '异常', '吴睿', 'xpcyGrYxuE', '2001-05-29 03:28:52.000', '2004-10-09 03:29:51.000', '2020-07-03 19:30:29.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (466, 'zSiEIBPU8j', '762 New Wakefield St', '正常', '维护', '韩晓明', 'Utw3mcp9Dy', '2013-06-16 18:04:52.000', '2008-06-03 16:49:05.000', '2013-10-31 20:30:07.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (467, 'sqfNICvbGG', '846 Lower Temple Street', '正常', '维护', '金子韬', '7w9jpZ0xWU', '2016-02-23 01:21:50.000', '2020-04-14 02:52:39.000', '2018-12-25 13:51:34.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (468, 'NuebQO5efy', '97 Zhongshan 5th Rd, Zimaling Shangquan', '正常', '维护', '黎詩涵', 'ffsDh4Mng8', '2012-10-09 10:30:26.000', '2015-06-30 06:52:16.000', '2010-10-04 12:52:24.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (469, 'gyNKbjT9jM', '302 Elms Rd, Botley', '异常', '维护', '蔡嘉伦', '7ffFNaqmgK', '2015-04-16 05:10:16.000', '2007-12-23 21:11:50.000', '2017-04-28 04:08:00.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (470, 'e3QYeO3BIk', '106 Lodge Ln, Toxteth', '维护', '维护', '邵璐', '4nTXsFJMWF', '2005-09-22 20:56:33.000', '2016-07-02 14:03:37.000', '2020-08-15 19:05:48.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (471, 'R6Xs1HsgNl', '546 Xiaoping E Rd, Baiyun ', '维护', '异常', '杜宇宁', 'pgpnB0H7gS', '2014-03-17 12:28:44.000', '2012-09-02 16:37:00.000', '2006-05-10 03:00:53.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (472, 'vVuN1k2NmL', '531 Elms Rd, Botley', '异常', '异常', '谭云熙', 'JRAZ1iaStl', '2006-03-27 22:35:20.000', '2018-10-20 09:27:10.000', '2014-02-20 13:06:49.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (473, 'opBHG6BF2H', '33 Qingshuihe 1st Rd, Luohu District', '正常', '异常', '郝秀英', 'GD3QpN4xRl', '2018-02-04 23:31:50.000', '2017-10-12 13:30:48.000', '2015-12-05 13:24:04.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (474, 'fMCQ0YlwDx', '19 3-803 Kusunokiajima, Kita Ward', '正常', '异常', '胡震南', '5mhjDsPBSS', '2002-10-23 06:09:07.000', '2012-02-18 07:44:40.000', '2003-03-08 21:36:42.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (475, 'EMCY84ckio', '173 Maddox Street', '异常', '正常', '薛安琪', 'DOuPi5oW9a', '2007-01-15 14:36:35.000', '2011-03-25 09:30:09.000', '2005-01-21 21:50:29.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (476, 'DLtd0OHf6V', '273 2nd Zhongshan Road, Yuexiu District', '异常', '正常', '周杰宏', 'jWsInHY5Ue', '2003-01-19 09:27:20.000', '2001-08-23 09:06:44.000', '2008-12-13 19:02:56.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (477, 'ekeNGIlbXR', '728 Portland St', '维护', '维护', '袁詩涵', '4fTtJK3cVQ', '2005-06-01 21:35:55.000', '2019-05-09 20:47:26.000', '2021-11-05 17:19:56.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (478, 'wO48OXMhQF', '298 New Wakefield St', '正常', '维护', '汤璐', '5Jgh7WNU7M', '2002-07-05 06:04:42.000', '2012-02-13 20:32:59.000', '2009-06-30 14:34:48.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (479, '4RMg9qdY4H', '83 Yueliu Rd, Fangshan District', '异常', '正常', '龚子韬', 'F3q9evNb6i', '2010-01-01 18:36:48.000', '2001-12-11 22:44:22.000', '2001-01-24 07:52:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (480, 'rIqYUsfOFP', '111 Abingdon Rd, Cumnor', '异常', '异常', '孙秀英', 'EthdrQ6NSa', '2004-03-21 17:21:56.000', '2024-08-30 05:43:24.000', '2025-02-09 05:05:48.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (481, 'y70Ooy36qA', '3-19-9 Shimizu, Kita Ward', '正常', '维护', '姚云熙', 'ek55X7c2rD', '2005-08-21 20:48:53.000', '2019-08-10 01:07:59.000', '2006-01-23 20:05:52.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (482, '6ugvahlN5M', '203 The Pavilion, Lammas Field, Driftway', '异常', '异常', '许睿', 'RPgDcJMMb7', '2003-10-28 18:25:18.000', '2013-01-22 00:40:56.000', '2017-06-08 02:55:35.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (483, 'LpNr28Y3PU', '555 Hinckley Rd', '维护', '维护', '张璐', 'AQV04XBi73', '2023-11-20 04:39:44.000', '2004-06-09 01:55:16.000', '2015-08-19 09:29:30.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (484, 'Qnh4Hf0sh9', '683 Trafalgar Square, Charing Cross', '正常', '异常', '金杰宏', 'UQQVzhVspe', '2005-03-13 15:48:41.000', '2014-07-11 04:25:17.000', '2007-04-10 02:57:27.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (485, 'dNOtVAcoiC', '530 East Cooke Road', '正常', '异常', '胡璐', 'jRbTaItQxZ', '2006-07-03 05:49:14.000', '2000-02-03 15:14:11.000', '2019-11-22 03:37:19.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (486, 'lUVE1xJIsJ', '749 Sackville St', '维护', '维护', '何子韬', '7HIi8ildQG', '2020-04-25 01:27:15.000', '2001-03-04 18:44:52.000', '2011-08-07 20:51:58.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (487, 'uWZyhnELvG', '303 Flatbush Ave', '异常', '正常', '雷安琪', 'kIYDRFKnNW', '2020-07-19 11:41:36.000', '2006-07-21 03:51:18.000', '2003-02-15 22:32:49.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (488, 'w6wFQ9a3LX', '2-1-6 Kaminopporo 1 Jo, Atsubetsu Ward', '正常', '正常', '贺詩涵', 'aCTC7dzcD2', '2004-09-27 16:22:03.000', '2000-06-14 13:19:03.000', '2008-09-16 17:19:13.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (489, 'Xg9GcA3uHm', '199 Ridgewood Road', '正常', '正常', '任晓明', 'V1BXNbDMJ8', '2018-02-18 08:42:22.000', '2007-11-01 12:45:16.000', '2011-06-13 10:28:07.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (490, 'ORlR2u8nQA', '5-4-14 Kikusui 3 Jo, Shiroishi Ward,', '正常', '维护', '常秀英', 'wPZpdoVGCY', '2004-02-14 13:54:40.000', '2009-12-03 12:25:23.000', '2005-02-27 09:23:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (491, 'ddtOirBNta', '13 1-1 Honjocho, Yamatokoriyama', '异常', '异常', '钟致远', 'CZ0N2yovB1', '2007-10-29 06:07:58.000', '2012-04-20 21:54:15.000', '2005-10-29 09:55:31.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (492, '5RD1zI2oJH', '438 Hinckley Rd', '异常', '异常', '钱云熙', 'D1fMXxpyYN', '2013-04-25 21:07:05.000', '2008-08-15 08:56:20.000', '2015-08-29 09:36:33.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (493, 'vncios9edo', '45 Jiangnan West Road, Haizhu District', '异常', '维护', '熊晓明', 'PITF7u4sMb', '2020-11-03 00:09:34.000', '2009-10-02 16:56:49.000', '2012-02-24 23:22:06.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (494, 'Wl4NKtFb4N', '6-1-12, Miyanomori 4 Jō, Chuo Ward', '正常', '异常', '邹震南', 'i0ByczumKD', '2017-08-02 17:04:53.000', '2023-04-24 01:20:47.000', '2015-12-30 18:32:14.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (495, 'fj8LDh09Re', '1-7-7 Omido, Higashiosaka', '正常', '异常', '胡岚', '3LMsuNPNG8', '2000-11-10 04:05:28.000', '2009-07-29 12:36:43.000', '2000-08-18 02:51:02.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (496, 'be1x7aJbQG', '4 Little Clarendon St', '维护', '异常', '汪宇宁', 'cUMmIeWgmu', '2019-05-10 20:52:07.000', '2003-10-17 03:51:38.000', '2022-03-19 10:18:54.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (497, '5M89XLEi3l', '959 028 County Rd, Yanqing District', '维护', '正常', '周震南', 'l6P7KQTOqg', '2021-05-30 07:23:51.000', '2024-09-02 12:18:32.000', '2007-08-03 22:29:05.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (498, '1UZFBdKoWY', '2-1-19 Tenjinnomori, Nishinari Ward', '异常', '正常', '林子韬', 'gVcZb0cyxh', '2018-02-11 10:38:30.000', '2022-09-10 11:09:19.000', '2013-04-13 01:52:28.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (499, '0TCoL6t2lr', '887 North Michigan Ave', '维护', '维护', '冯睿', 'd1ZI5XmMXo', '2001-05-30 22:56:45.000', '2003-09-10 17:03:47.000', '2012-10-01 18:26:24.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (500, 'fvlu1EyHCZ', '3 1-1 Honjocho, Yamatokoriyama', '维护', '异常', '郝云熙', '3l3MLralwg', '2019-12-21 22:03:12.000', '2004-01-25 22:33:48.000', '2019-03-16 00:07:37.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (501, 'kFPJAWg280', '37 West Houston Street', '维护', '异常', '何云熙', 'B4ZRR53Xym', '2018-05-16 10:54:16.000', '2022-01-16 13:09:08.000', '2023-09-29 21:30:43.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (502, 'vxfKx4AewN', '85 FuXingMenNei Street, XiCheng District', '异常', '正常', '陶致远', 'vlfTApr2Ff', '2015-10-11 23:05:56.000', '2015-12-25 01:10:38.000', '2005-04-02 00:09:16.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (503, 'e9X8VnQNoG', '791 East Cooke Road', '正常', '正常', '胡震南', '2X419v2xCI', '2005-05-29 09:55:50.000', '2002-06-03 21:25:13.000', '2022-08-20 23:33:23.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (504, 'aMVF7PngqO', '1-6-4, Marunouchi, Chiyoda-ku', '维护', '正常', '江杰宏', 'b1ExrC7VQQ', '2015-07-28 18:29:17.000', '2009-06-26 18:27:34.000', '2013-02-08 21:32:11.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (505, 't1Rnwr2iLt', '6-1-6, Miyanomori 4 Jō, Chuo Ward', '正常', '正常', '张璐', '3hyevfHmkQ', '2008-07-28 22:02:11.000', '2005-01-17 23:10:36.000', '2020-09-25 15:53:23.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (506, 'Rt3edOFEsw', '32 Jingtian East 1st St, Futian District', '维护', '维护', '梁秀英', 'VulepYatHA', '2004-01-04 17:36:29.000', '2015-05-05 13:26:14.000', '2002-01-12 13:07:21.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (507, 'w1CURLV7NX', '145 Shennan E Rd, Cai Wu Wei, Luohu District', '维护', '维护', '许杰宏', 'XCkFZaC9Uu', '2006-10-04 02:08:14.000', '2008-03-14 06:25:59.000', '2016-08-02 22:07:17.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (508, '2kvwY5l9bA', '392 Wicklow Road', '正常', '正常', '杜秀英', 'ZPcWJtRYGz', '2018-05-18 22:16:05.000', '2014-03-07 03:07:10.000', '2001-03-31 22:07:31.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (509, 'eeCr5f5wod', '5-2-16 Higashi Gotanda, Shinagawa-ku ', '维护', '正常', '袁璐', 'lohDDPhyf5', '2011-02-17 10:38:19.000', '2010-11-22 03:46:09.000', '2002-03-20 08:31:53.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (510, 'XDdsjNzkXJ', '1-7-1 Saidaiji Akodacho', '异常', '异常', '胡秀英', 'ncKO8Yjdlt', '2023-03-27 07:17:27.000', '2023-10-22 06:59:27.000', '2024-02-05 22:49:21.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (511, 'YbyfGFF0WH', '49 The Pavilion, Lammas Field, Driftway', '维护', '维护', '赵杰宏', 'RwYOMLCtTy', '2001-03-15 07:38:28.000', '2022-12-27 07:46:06.000', '2011-09-21 14:49:40.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (512, 'c9MiGBWcIv', '961 Canal Street', '异常', '正常', '董子韬', 'lVcWj0vea3', '2013-09-07 21:42:16.000', '2019-06-03 12:13:37.000', '2000-08-12 13:01:11.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (513, 'LXdznjoWgI', '769 Riverview Road', '正常', '正常', '高致远', 'p1BIuPnsHL', '2014-05-04 21:33:41.000', '2008-04-15 12:37:06.000', '2015-11-19 20:46:40.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (514, '0H0Z4T4BOr', '365 Tianbei 1st Rd, Luohu District', '正常', '正常', '夏晓明', 'ZEiYd1AWMk', '2018-06-16 01:01:45.000', '2021-05-29 03:36:31.000', '2005-12-15 13:39:00.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (515, 'sKtSJM0olC', '2-3-7 Yoyogi, Shibuya-ku', '异常', '异常', '周岚', 'oI1BJenT47', '2024-01-13 01:43:43.000', '2001-06-17 08:21:52.000', '2018-07-31 21:44:45.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (516, 'vAXewLPoqf', '6-1-6, Miyanomori 4 Jō, Chuo Ward', '维护', '异常', '阎子韬', 'AOQJpfjolI', '2016-03-21 16:33:52.000', '2021-06-26 04:57:28.000', '2008-04-27 20:29:25.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (517, 'FDX8KcPX5z', '252 Abingdon Rd, Cumnor', '异常', '异常', '林岚', 'FxqndhZgp8', '2009-12-20 07:21:32.000', '2008-09-11 03:39:02.000', '2000-11-27 09:33:23.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (518, 'ej1HX0Qf68', '982 4th Section  Renmin South Road, Jinjiang District', '异常', '异常', '崔詩涵', 'xrpyUytNkF', '2010-06-05 14:31:37.000', '2001-01-26 23:00:53.000', '2023-05-21 08:26:08.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (519, 'K1AuDjsKMw', '553 Hanover St', '维护', '维护', '范嘉伦', '7gmhc3gwBL', '2011-02-24 18:54:28.000', '2002-07-26 00:28:08.000', '2020-01-25 08:56:10.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (520, 'rjagUzB8hw', '5-4-1 Kikusui 3 Jo, Shiroishi Ward,', '维护', '正常', '范秀英', 'lHbdkHK01j', '2014-01-09 04:55:51.000', '2014-05-19 06:06:18.000', '2024-08-28 15:29:37.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (521, 'GV2NVVQCdq', '552 Ganlan Rd, Pudong', '异常', '异常', '曾震南', 'EORsm2jayl', '2000-07-15 07:23:16.000', '2002-07-02 20:50:46.000', '2022-07-11 18:23:33.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (522, 'G1UyJRLj6i', '473 Portland St', '维护', '正常', '曾睿', 'IQB58Cnim8', '2008-12-24 15:31:21.000', '2024-03-07 12:40:46.000', '2010-05-22 21:24:58.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (523, 'PW9q1lBQ1R', '832 Columbia St', '正常', '异常', '莫云熙', 'UUta1VPmLl', '2021-11-26 06:05:47.000', '2006-01-31 10:35:54.000', '2024-07-26 09:56:43.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (524, 'ld4c61q8QC', '296 Hongqiao Rd., Xu Hui District', '异常', '正常', '武璐', 'cgHe8AzIr5', '2024-11-20 10:35:42.000', '2021-12-06 15:23:21.000', '2001-01-06 07:33:05.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (525, 'zTyyQRdqUy', '306 Volac Park, Grantchester Rd', '维护', '正常', '胡安琪', 'MNbhTylFuV', '2001-02-25 22:34:06.000', '2002-01-18 05:08:26.000', '2024-11-11 05:26:20.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (526, 'tpTcfgAh8A', '883 Kengmei 15th Alley', '正常', '维护', '曾璐', '4bgp5GuqAO', '2014-04-17 05:45:15.000', '2004-12-15 13:03:44.000', '2023-03-17 02:27:03.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (527, 'eSM1xMmx4n', '142 New Street', '异常', '维护', '石震南', 'nN5YRduUXP', '2001-03-24 06:46:49.000', '2010-08-22 17:56:22.000', '2016-09-21 08:54:16.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (528, 'u2Ptt6uPQB', '284 Zhongshan 5th Rd, Zimaling Shangquan', '维护', '正常', '廖岚', '02FnpbClg6', '2002-06-29 22:32:36.000', '2015-08-11 11:42:25.000', '2004-07-21 09:37:33.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (529, 'u4oYv7mifW', '179 Fern Street', '维护', '维护', '薛云熙', 'dRTecDyIsh', '2020-08-21 09:18:26.000', '2015-07-23 09:47:14.000', '2010-06-30 04:20:20.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (530, 'XBqNlgyIM2', '1 Elms Rd, Botley', '异常', '正常', '杜云熙', 'q9ySapl4A1', '2016-10-21 11:02:06.000', '2021-10-28 22:26:37.000', '2001-01-11 14:07:38.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (531, 'YkLRS8eJnq', '643 West Market Street', '正常', '正常', '熊子异', 'Ilu5MeAbZr', '2013-03-09 17:53:31.000', '2016-02-16 20:00:54.000', '2012-04-26 09:39:58.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (532, 'g9G0Uq3sTQ', '80 Maddox Street', '异常', '正常', '龙晓明', 'AU6vKoGlSC', '2010-01-18 09:08:15.000', '2006-02-13 01:27:04.000', '2020-08-01 07:52:16.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (533, 'HZOuFFHeLk', '705 Xue Yuan Yi Xiang, Longgang', '正常', '异常', '潘云熙', 'z3Mg77m2EQ', '2012-09-29 16:45:15.000', '2014-01-31 23:26:38.000', '2002-06-25 11:37:35.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (534, 'QsEBeSgrhr', '221 Broadway', '维护', '维护', '蒋宇宁', '7yfucNFogP', '2003-01-18 02:51:59.000', '2022-08-03 22:11:19.000', '2001-08-31 19:12:02.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (535, 'PPbU8LuyWV', '5-4-6 Kikusui 3 Jo, Shiroishi Ward,', '正常', '维护', '傅震南', 'oTWqsskfOG', '2014-11-13 12:39:12.000', '2014-02-20 17:42:29.000', '2013-12-10 09:37:33.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (536, 'lh2Ov9GXyg', '5-2-10 Higashi Gotanda, Shinagawa-ku ', '异常', '正常', '戴睿', 'sU0SHPGrPy', '2006-03-06 04:18:06.000', '2014-02-11 23:43:32.000', '2001-12-10 12:30:57.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (537, 'fGObJhWxja', '196 Qingshuihe 1st Rd, Luohu District', '异常', '正常', '李宇宁', 'PhkZsn1IL2', '2014-01-15 14:18:35.000', '2014-07-01 05:23:08.000', '2012-09-26 23:02:45.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (538, 'eybmLL4CXQ', '496 Dong Zhi Men, Dongcheng District', '维护', '正常', '傅云熙', '24ViKxuKPX', '2018-09-24 00:35:09.000', '2016-06-18 18:00:31.000', '2005-07-17 02:43:32.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (539, 'kgLp7vl84O', '199 Wicklow Road', '维护', '正常', '武璐', 'GUJMg4u6x2', '2015-11-19 20:14:55.000', '2024-07-02 16:08:36.000', '2013-03-16 23:40:45.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (540, 'Fn7uZyJ209', '412 Nostrand Ave', '正常', '异常', '段璐', 'nf6iq7uI68', '2018-10-05 21:17:48.000', '2018-04-02 05:05:38.000', '2013-08-14 10:45:18.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (541, 'NqC6WBhpOh', '720 FuXingMenNei Street, XiCheng District', '维护', '维护', '邓璐', '7IkdBYhGC6', '2001-01-12 22:35:39.000', '2022-08-07 18:34:55.000', '2013-11-13 06:07:47.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (542, 'OIChGm0ZO5', '5-19-10 Shinei 4 Jo, Kiyota Ward', '异常', '异常', '郝嘉伦', 'yMYo4ITYgp', '2011-02-02 00:32:29.000', '2018-08-31 09:53:44.000', '2000-01-09 09:06:25.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (543, '93SKir2mZQ', '66 Trafalgar Square, Charing Cross', '异常', '正常', '许震南', 'J1Le0uCBQJ', '2012-10-29 04:11:06.000', '2004-07-09 22:38:58.000', '2018-03-01 06:43:08.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (544, '123', '521 Alameda Street', '维护', '异常', '严杰宏', 'vN7H6OsdC4', '2004-03-29 04:35:13.000', '2025-04-26 01:40:30.775', '2023-01-27 04:27:13.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (545, '9tVbUEDRMA', '3-27-2 Higashitanabe, Higashisumiyoshi Ward', '维护', '正常', '潘杰宏', 'AM36bVPr7U', '2011-07-08 08:14:41.000', '2006-12-02 23:31:07.000', '2016-04-28 10:30:55.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (546, '9z5UJvwUtI', '980 Shennan E Rd, Cai Wu Wei, Luohu District', '异常', '维护', '孔震南', 'mvRtu6leCy', '2011-01-03 18:05:41.000', '2014-07-10 03:33:51.000', '2022-08-17 17:59:37.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (547, 'JlERvqoyyt', '918 Lark Street', '正常', '维护', '郝嘉伦', 'UD6gUEiWZ7', '2004-02-09 21:42:03.000', '2011-05-02 03:04:04.000', '2006-08-06 04:09:20.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (548, 'qXL6b4kwjj', '886 Lark Street', '正常', '维护', '高子异', 'q5fO5y4KV7', '2014-08-15 06:33:22.000', '2015-08-04 03:16:20.000', '2002-10-15 22:31:09.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (549, 'DmL19slaUp', '290 Lodge Ln, Toxteth', '正常', '维护', '刘云熙', '7aPl0t3mUl', '2011-12-19 03:12:02.000', '2012-10-17 07:59:38.000', '2021-10-21 04:55:17.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (550, 'qW5H10XO85', '859 Portland St', '正常', '正常', '戴睿', 'pyLyU4QQ0P', '2022-03-22 19:27:21.000', '2004-10-15 14:50:18.000', '2008-09-11 18:40:23.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (551, 'BNZm3CYEc1', '289 Figueroa Street', '维护', '维护', '汪杰宏', '2BBrRO9UQf', '2022-08-08 16:15:38.000', '2013-08-25 02:08:09.000', '2011-08-16 23:42:48.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (552, 'tZNlxGuKac', '809 Canal Street', '正常', '正常', '黎睿', 'rrqxkkWyfC', '2023-02-11 22:11:54.000', '2017-02-10 00:28:27.000', '2002-06-20 01:24:20.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (553, 'a8ADrfazvA', '426 Lodge Ln, Toxteth', '异常', '异常', '钱宇宁', 'JnidhAfTrp', '2013-05-27 23:09:07.000', '2014-02-24 05:41:05.000', '2002-05-19 10:36:00.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (554, 'HlYN29jXsr', '327 Central Avenue', '维护', '维护', '段璐', 'JPVNXeGtJ9', '2021-03-02 00:38:05.000', '2020-09-29 03:54:37.000', '2024-10-30 14:06:31.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (555, 'uW55pwhFGp', '257 Ganlan Rd, Pudong', '维护', '维护', '郑璐', 'CguSE7QZiX', '2005-01-31 17:12:49.000', '2016-03-13 00:07:48.000', '2008-05-07 06:18:39.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (556, 'msOwaBRMFV', '5-2-17 Kikusui 3 Jo, Shiroishi Ward', '正常', '正常', '于秀英', 'rixrhsnbgy', '2018-04-12 07:22:35.000', '2010-03-14 14:58:32.000', '2019-11-15 21:12:19.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (557, 'oEJlVkLAMy', '29 Diplomacy Drive', '异常', '异常', '潘子韬', 'J3p3DqlnhI', '2009-04-16 23:13:31.000', '2013-02-22 12:14:20.000', '2017-05-02 19:19:08.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (558, 'fnsdR7yPBg', '669 Diplomacy Drive', '异常', '正常', '孟睿', 'u0UfiIkyQq', '2003-03-11 09:51:05.000', '2006-03-22 02:32:03.000', '2018-03-09 04:10:49.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (559, 'vaZDQaEh7b', '225 Figueroa Street', '异常', '正常', '贾岚', 'z1ab9Z0579', '2004-04-24 01:28:35.000', '2017-12-18 16:39:25.000', '2000-10-11 18:47:48.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (560, 'fd4liHND8N', '658 Sky Way', '正常', '维护', '顾睿', 'h1rZaWmDmr', '2018-08-23 17:39:24.000', '2022-09-02 20:38:38.000', '2000-10-23 04:56:30.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (561, 'KSRzE27mwb', '313 FuXingMenNei Street, XiCheng District', '维护', '维护', '曹詩涵', 'vKHU8ve4vY', '2021-11-07 01:31:50.000', '2006-05-07 03:28:11.000', '2003-11-27 00:53:11.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (562, 'PJRjfstNMI', '407 Papworth Rd, Trumpington', '正常', '异常', '韦杰宏', 'Zod28RpndQ', '2000-08-13 21:18:50.000', '2010-08-08 23:32:41.000', '2002-03-03 05:57:32.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (563, 'NxwsfXJgvu', '10 1-1715 Sekohigashi, Moriyama Ward', '异常', '正常', '严安琪', '511bQldlFH', '2016-03-21 06:30:01.000', '2003-07-23 00:19:55.000', '2006-01-26 23:33:20.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (564, 'sJpSwKKple', '1-5-2, Higashi-Shimbashi, Minato-ku', '正常', '正常', '任云熙', 'iHfrCmAn2y', '2002-10-15 14:35:40.000', '2003-08-18 15:02:58.000', '2001-02-23 12:01:40.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (565, 'm0Vpaj0kMl', '877 Collier Road', '异常', '维护', '雷宇宁', 'AaMH6jhm6b', '2001-01-19 16:47:25.000', '2004-09-15 09:20:52.000', '2005-03-26 00:04:06.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (566, '0EkWuhpTom', '260 Dong Zhi Men, Dongcheng District', '维护', '正常', '向晓明', 'k5w4KmcrYd', '2006-07-27 15:03:23.000', '2012-04-03 14:55:10.000', '2002-09-01 00:35:49.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (567, 'KaBysvZMAP', '622 Pedway', '异常', '正常', '龚致远', 'r9lWnVB6HB', '2005-06-06 17:10:17.000', '2012-04-29 02:49:58.000', '2024-01-06 02:02:17.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (568, '5XDh80fijO', '460 Papworth Rd, Trumpington', '维护', '异常', '胡晓明', 'OTsxEv9How', '2023-07-03 10:48:24.000', '2024-05-16 04:11:10.000', '2023-05-23 18:51:19.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (569, 'ZVybZOY7g3', '3-15-16 Ginza, Chuo-ku', '维护', '正常', '熊致远', 'WgYSOmiKeQ', '2004-01-07 16:57:59.000', '2019-03-30 12:40:16.000', '2024-04-07 02:52:25.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (570, 'b7ZKyz8Wxf', '645 Shanhu Rd', '异常', '异常', '赵璐', 'LQ9LTpdCfS', '2022-12-27 02:00:04.000', '2000-09-05 12:20:28.000', '2004-06-07 02:20:43.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (571, 'XLVdmiWJQZ', '587 Central Avenue', '正常', '异常', '郑子异', 'k9gwewnI63', '2008-12-01 22:02:14.000', '2018-04-28 21:59:16.000', '2014-12-24 01:05:07.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (572, 'DbTjP2HUfv', '3-27-16 Higashitanabe, Higashisumiyoshi Ward', '异常', '正常', '钱秀英', 'xnZhw5wIv3', '2004-09-02 13:51:49.000', '2002-02-24 17:49:48.000', '2015-10-14 04:54:51.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (573, 'uTL6fmt6kh', '1-6-12, Marunouchi, Chiyoda-ku', '维护', '维护', '崔震南', 'CMnNjHcKOQ', '2019-12-21 17:47:05.000', '2003-10-03 14:55:50.000', '2004-03-16 13:12:07.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (574, 'dAsJ0y76tM', '457 Nostrand Ave', '异常', '正常', '崔岚', 'cGUJXz5DJ4', '2019-01-28 20:08:45.000', '2023-08-26 21:09:05.000', '2023-08-06 18:18:19.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (575, 'PdI5K2FEGH', '637 028 County Rd, Yanqing District', '维护', '正常', '林致远', 'rAXeqO4rcm', '2016-06-09 02:08:52.000', '2005-12-27 05:54:16.000', '2005-12-10 14:33:10.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (576, 'orMYwwgxII', '5-4-2 Kikusui 3 Jo, Shiroishi Ward,', '正常', '维护', '龚子异', 'htQUt3S5xD', '2018-08-03 14:22:44.000', '2018-12-31 08:20:21.000', '2017-12-02 21:18:42.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (577, 'fhZsNtt0VT', '1-5-17, Higashi-Shimbashi, Minato-ku', '正常', '维护', '杜晓明', 'HnrSFecAQO', '2014-03-10 11:53:29.000', '2005-04-08 01:35:18.000', '2012-04-20 13:00:04.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (578, 'pHdN05kQG3', '664 Yueliu Rd, Fangshan District', '正常', '维护', '苏杰宏', 'ObfwhUt9hq', '2016-11-23 22:12:57.000', '2025-02-10 19:42:48.000', '2011-01-21 13:26:38.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (579, 'HhmFrdRDpm', '1-7-1 Saidaiji Akodacho', '维护', '正常', '程杰宏', 'tOa94kzMYU', '2003-06-20 00:06:14.000', '2003-07-17 14:36:30.000', '2017-06-03 20:51:03.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (580, 'P9WC6yQltk', '678 Central Avenue', '正常', '异常', '卢晓明', 'SZew99Htxb', '2015-01-21 06:50:38.000', '2021-10-24 15:27:48.000', '2006-11-18 00:21:21.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (581, '59GOnbPKpJ', '222 Figueroa Street', '异常', '异常', '宋杰宏', 'uadgLyrCHN', '2008-09-08 23:44:29.000', '2009-04-06 02:07:06.000', '2010-07-06 12:58:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (582, 'S85mpUJ5bN', '1-5-9, Higashi-Shimbashi, Minato-ku', '正常', '正常', '宋安琪', 'YovJdAkBDj', '2010-11-25 12:50:43.000', '2006-02-17 03:08:15.000', '2017-01-04 19:07:25.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (583, 'DuMt2FDgp7', '732 Earle Rd', '维护', '异常', '高子韬', '1oKFMlLVs6', '2022-12-29 22:49:47.000', '2010-09-05 04:56:51.000', '2017-09-10 10:45:46.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (584, 'eTC03qgW6C', '5-2-1 Kikusui 3 Jo, Shiroishi Ward', '异常', '异常', '龙嘉伦', 'ADO6n3KQYF', '2019-12-01 13:48:08.000', '2021-05-18 14:29:01.000', '2024-05-15 20:19:07.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (585, 'IcxMvfSBqk', '4-9-8 Kamihigashi, Hirano Ward', '正常', '异常', '宋岚', 'Xep2dIniKA', '2024-03-19 03:08:35.000', '2003-02-17 12:21:48.000', '2006-12-05 10:45:01.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (586, 'W6n4sXB0CA', '301 Redfern St', '正常', '异常', '李安琪', 'kG0NMsksVC', '2022-07-28 22:09:28.000', '2003-09-24 05:03:57.000', '2023-07-03 17:56:33.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (587, 'uwxQ2DQRHC', '89 Tianbei 1st Rd, Luohu District', '维护', '异常', '杜嘉伦', 'kBNxDWJBmH', '2006-02-02 12:17:43.000', '2011-01-12 12:49:19.000', '2019-09-02 12:41:29.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (588, 'k62v5WC9m4', '603 NO.6, YuShuang Road, ChengHua Distric', '维护', '维护', '黄宇宁', 'kr0KWzj5LW', '2009-10-08 03:54:38.000', '2021-09-20 16:20:23.000', '2005-04-13 15:16:10.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (589, 'ibkI4XSp2G', '725 Spring Gardens', '正常', '异常', '李秀英', 'N4f8JKVne5', '2003-07-23 22:38:13.000', '2006-11-24 08:52:29.000', '2008-10-08 19:57:40.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (590, 'pchzdBqjYH', '947 Broadway', '正常', '维护', '苏震南', 'hy6tt0mjhV', '2001-09-03 17:03:03.000', '2002-01-14 06:11:33.000', '2023-02-04 22:20:45.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (591, 'YG4QO4YUyB', '993 1st Ave', '异常', '维护', '莫安琪', 'Xn63DTFCYi', '2005-12-14 22:45:15.000', '2013-06-02 23:02:04.000', '2023-02-06 14:49:54.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (592, 'GT7G400Xn3', '3-9-17 Gakuenminami', '异常', '维护', '莫子韬', 'pz6xIeuArS', '2000-08-16 06:30:14.000', '2020-08-09 20:54:44.000', '2023-09-12 08:51:06.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (593, 'lgklp9vBvv', '325 Wooster Street', '维护', '维护', '姚詩涵', 'SWr6qdgVXk', '2023-06-14 10:00:03.000', '2021-10-14 20:01:58.000', '2011-01-24 16:32:25.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (594, 'ZpkckEvcmi', '235 Central Avenue', '正常', '正常', '姜子韬', 'wukwbiFTLi', '2013-07-02 05:08:11.000', '2009-07-19 09:44:17.000', '2001-10-14 14:42:55.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (595, 'C5Tz4oNDRK', '740 S Broadway', '维护', '维护', '龚岚', 'MmnosuYhac', '2002-08-24 04:53:04.000', '2008-07-15 13:28:09.000', '2011-01-24 23:54:24.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (596, 'DTzzeGJJSx', '932 North Michigan Ave', '异常', '正常', '郭秀英', 'zUi0Xfrehj', '2007-11-03 00:58:03.000', '2024-08-13 18:08:55.000', '2017-10-05 20:11:45.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (597, 'sL115mAq3r', '743 Nostrand Ave', '维护', '正常', '彭岚', 'ohSXQBjGYv', '2001-07-28 12:15:26.000', '2004-06-05 05:01:16.000', '2015-12-05 06:47:52.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (598, 'FPBiZThAxu', '863 Collier Road', '维护', '异常', '江岚', 'E9Ri9JWhLI', '2000-03-13 03:08:58.000', '2005-05-19 19:34:32.000', '2011-02-10 05:26:55.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (599, '7R2gPqbcO6', '929 FuXingMenNei Street, XiCheng District', '维护', '维护', '顾宇宁', 'xIRVgiq0fp', '2000-05-04 03:34:33.000', '2004-12-02 11:35:57.000', '2004-07-15 14:36:29.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (600, 'EiSTcDlPtY', '852 Wooster Street', '维护', '异常', '郝子异', 'aHHzMORU0p', '2024-07-02 09:42:15.000', '2004-08-10 09:44:17.000', '2019-12-13 06:50:26.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (601, 'RRbYzUvGsf', '453 East Alley', '异常', '正常', '曾詩涵', 'kpORPYYONR', '2003-07-27 10:07:57.000', '2005-11-08 13:21:25.000', '2008-05-13 09:16:52.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (602, '3CcEV5zlNH', '452 Fern Street', '维护', '异常', '侯岚', 'VXcPRKtxwz', '2015-12-22 22:33:29.000', '2014-11-30 17:35:08.000', '2020-03-10 18:18:07.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (603, 'S4MVznlvrU', '57 39 William IV St, Charing Cross', '维护', '维护', '萧睿', 'BT8p0qDKdO', '2008-05-13 03:41:01.000', '2006-09-29 05:14:33.000', '2019-07-11 19:18:11.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (604, 'QE0tM3RlFh', '358 Narborough Rd', '正常', '正常', '汤詩涵', 'vv1vPm4kNU', '2014-06-19 06:21:21.000', '2016-12-23 05:32:32.000', '2008-06-30 16:50:36.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (605, 'rfYUfAWGpB', '377 Trafalgar Square, Charing Cross', '异常', '正常', '韦杰宏', '60sdG4kKMq', '2002-09-21 01:21:05.000', '2017-06-01 01:33:40.000', '2010-01-09 02:34:24.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (606, 'b1ZK21eC3d', '654 Fifth Avenue', '正常', '异常', '蔡宇宁', 'Omm4FbcUPH', '2023-04-04 23:27:46.000', '2008-05-27 23:33:26.000', '2008-11-11 21:14:40.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (607, 'jyGyvid8NH', '728 Hongqiao Rd., Xu Hui District', '异常', '维护', '钟晓明', 'uDtloV40kb', '2014-03-23 19:26:16.000', '2008-07-28 05:58:10.000', '2005-07-16 01:19:21.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (608, 'YTK1uaQNW2', '725 49/50 Strand, Charing Cross', '正常', '异常', '唐杰宏', 'f2I9aiIGwh', '2018-07-21 22:42:41.000', '2020-04-06 00:46:08.000', '2004-04-12 14:27:40.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (609, 'YKijQH1e87', '1-6-15, Marunouchi, Chiyoda-ku', '异常', '正常', '徐震南', 'cf8AkWwiuu', '2008-09-28 08:57:43.000', '2025-02-12 08:07:42.000', '2003-04-29 01:01:31.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (610, '75xYswGj7n', '319 Papworth Rd, Trumpington', '正常', '维护', '夏璐', 'jBV7ywZQSp', '2016-07-05 13:26:12.000', '2001-01-20 07:00:44.000', '2012-08-01 00:04:23.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (611, 'CK2Yiu9Am3', '334 Stephenson Street', '维护', '维护', '任嘉伦', 'dDx0QxHCOt', '2004-04-19 17:51:31.000', '2023-06-11 07:19:34.000', '2014-09-26 05:43:42.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (612, 'mrEnZyieKD', '98 028 County Rd, Yanqing District', '正常', '维护', '马子异', '0kq3AlC0NB', '2006-06-16 20:37:33.000', '2018-07-21 01:48:27.000', '2004-06-27 16:48:34.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (613, 'PTZtMXsQLq', '973 Riverview Road', '异常', '正常', '赵岚', 'Vodu3pJk3t', '2018-02-06 12:07:52.000', '2025-03-12 17:59:15.000', '2009-05-15 05:31:31.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (614, 'hNwA5rD8wt', '319 Zhongshan 5th Rd, Zimaling Shangquan', '维护', '维护', '谭致远', 'XZoAKszK3M', '2021-05-12 17:58:40.000', '2017-08-29 14:23:04.000', '2003-01-11 21:31:43.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (615, 'AMnexEMJHQ', '2-5-10 Chitose, Atsuta Ward', '正常', '正常', '傅杰宏', 'tj7OWj3teG', '2018-10-03 00:12:28.000', '2022-04-06 19:12:08.000', '2005-11-21 01:06:08.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (616, 'gBE2yiGChI', '1 4-20 Kawagishicho, Mizuho Ward', '正常', '维护', '陶杰宏', 'kl2lOCXxgm', '2003-09-06 13:30:12.000', '2006-12-09 09:01:55.000', '2023-03-26 08:24:19.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (617, '4CvCICeo3Q', '771 Park End St', '维护', '正常', '林宇宁', '9rLeIylzGn', '2024-04-25 17:30:25.000', '2003-08-31 08:44:34.000', '2003-07-23 21:34:23.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (618, 'kMYLV5LuUH', '5-4-18 Kikusui 3 Jo, Shiroishi Ward,', '正常', '异常', '曾晓明', 'YiZ2gt7Vk2', '2006-12-26 20:10:29.000', '2011-09-28 03:23:34.000', '2020-05-17 06:04:15.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (619, 'e0HHfk6RzM', '631 Jiangnan West Road, Haizhu District', '维护', '正常', '薛杰宏', 'LS9C84Pzs1', '2024-08-22 02:22:04.000', '2020-09-10 11:20:47.000', '2015-05-04 14:40:27.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (620, 'BSXyWO4cet', '698 North Michigan Ave', '异常', '正常', '贾秀英', 'p79VrbWkvw', '2014-08-19 04:11:29.000', '2012-12-15 15:52:29.000', '2001-09-21 14:02:47.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (621, 'NCuxPVi8FN', '662 Huanqu South Street 2nd Alley', '正常', '正常', '廖杰宏', 'okDznUkupN', '2008-09-07 05:24:14.000', '2020-04-27 08:32:47.000', '2006-01-28 00:28:08.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (622, 'oA29JuMWYb', '1-6-12, Marunouchi, Chiyoda-ku', '异常', '维护', '廖晓明', 'k0sDYsxw6y', '2023-08-04 20:30:32.000', '2008-11-27 11:37:58.000', '2004-06-23 20:24:57.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (623, 'fqqQD86Mdx', '196 Fifth Avenue', '维护', '异常', '彭杰宏', 'jd7UOb4Onh', '2004-04-08 06:00:46.000', '2007-04-24 06:19:53.000', '2002-09-27 15:32:03.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (624, 'C1nJDJurq5', '170 Hongqiao Rd., Xu Hui District', '正常', '异常', '吴睿', 'XTHiWCUOTc', '2011-07-06 15:11:09.000', '2017-07-02 22:18:57.000', '2005-04-06 15:50:33.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (625, 'OmNZRg9nhZ', '343 Wyngate Dr', '维护', '正常', '姜嘉伦', '1tlGoHrxA2', '2014-10-20 05:36:24.000', '2023-12-15 05:31:00.000', '2010-10-24 14:35:12.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (626, 'MGOQiIoxeV', '99 Jingtian East 1st St, Futian District', '维护', '维护', '秦秀英', 'qip5kRwahY', '2016-05-12 05:48:36.000', '2004-11-23 09:55:40.000', '2010-07-07 00:58:03.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (627, 'rWA4TiUWbl', '706 Collier Road', '正常', '维护', '罗安琪', 'mcNV8ipufl', '2003-01-26 11:16:38.000', '2000-06-07 04:06:03.000', '2015-05-03 13:07:43.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (628, 'i5BFsBzcdh', '980 Alameda Street', '异常', '维护', '常宇宁', 'k2aJoy0cnm', '2015-12-13 02:33:31.000', '2014-03-23 23:17:16.000', '2020-01-16 12:07:44.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (629, 'RjTrDHC5bz', '598 Collier Road', '正常', '正常', '夏子异', 'sw9qG9sXSS', '2011-11-03 04:25:55.000', '2021-11-23 13:05:34.000', '2001-10-12 22:30:32.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (630, 'YM4B5PRMBL', '245 Mosley St', '异常', '正常', '方岚', 'PU9SkCi90O', '2011-07-16 02:48:02.000', '2015-01-25 17:50:01.000', '2018-04-03 01:37:29.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (631, 'gTffR5dOv6', '559 Qingshuihe 1st Rd, Luohu District', '正常', '正常', '赵子异', 'vxToBrCfjW', '2012-05-18 15:05:25.000', '2011-05-09 17:33:43.000', '2025-03-23 06:56:14.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (632, '4cSq1ciadl', '90 Edward Ave, Braunstone Town', '异常', '维护', '熊云熙', 'E93SK5s6A8', '2012-10-23 17:50:32.000', '2023-04-03 16:36:03.000', '2014-09-07 09:12:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (633, 'TF4RMTraia', '907 State Street', '维护', '维护', '陆岚', 'msvwXTnVV0', '2000-01-27 14:52:35.000', '2006-03-18 05:10:09.000', '2022-11-19 03:45:44.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (634, '6R6SDYX1IW', '6-1-16, Miyanomori 4 Jō, Chuo Ward', '维护', '正常', '阎晓明', 'VgCjcICjFg', '2015-11-04 17:40:57.000', '2022-02-12 00:49:30.000', '2000-04-27 08:11:48.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (635, 'IsYZwAE9r6', '668 Hanover Street', '异常', '维护', '韦杰宏', 'xhYxd1Dbsk', '2023-03-07 13:48:07.000', '2004-10-29 19:39:37.000', '2010-01-31 18:51:21.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (636, 'laUPBr02aD', '6-1-16, Miyanomori 4 Jō, Chuo Ward', '正常', '正常', '阎子韬', 'iJkpCQJkiI', '2012-03-19 18:03:04.000', '2000-06-08 10:40:59.000', '2021-11-26 19:37:45.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (637, 'LFAmhc9RE9', '910 Stephenson Street', '异常', '维护', '唐璐', 'DVdmB2q6MG', '2013-09-23 09:50:20.000', '2013-09-26 22:12:23.000', '2024-11-17 12:41:47.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (638, 'XceESjDoES', '45 39 William IV St, Charing Cross', '正常', '维护', '蒋岚', 'sbXpxlQQny', '2014-09-17 16:38:38.000', '2022-04-21 13:54:52.000', '2010-08-12 13:46:40.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (639, 'NQ2MGz1jlW', '747 FuXingMenNei Street, XiCheng District', '异常', '维护', '武睿', 'Zz4MDzCanZ', '2025-03-07 00:14:42.000', '2001-04-17 17:24:19.000', '2005-09-09 04:18:16.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (640, '98ezTDRSUL', '825 East Cooke Road', '维护', '维护', '邹晓明', 'opXNssTekg', '2004-08-14 19:37:06.000', '2015-12-29 04:50:51.000', '2014-10-29 09:50:28.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (641, 'ykXTCnT2jR', '317 2nd Zhongshan Road, Yuexiu District', '正常', '异常', '龚嘉伦', 'R987gCZrNj', '2013-09-20 06:25:09.000', '2020-11-21 14:13:21.000', '2013-04-17 00:36:05.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (642, 'qAHf6AtHou', '6 1-1715 Sekohigashi, Moriyama Ward', '异常', '正常', '黎云熙', '1OZQju8ZDx', '2009-02-17 21:59:03.000', '2000-09-27 11:50:30.000', '2000-06-07 23:05:56.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (643, '3uwJR5frGY', '371 Broadway', '维护', '维护', '孔云熙', 'mtFRwWmHsT', '2022-08-02 03:44:31.000', '2011-09-09 10:53:19.000', '2005-03-28 04:29:50.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (644, 'ynfQ3a2yeE', 'No.355, Dongsan Road, Erxianqiao, Chenghua District', '维护', '维护', '蒋子韬', 'fY0ZHCxsR4', '2004-06-18 05:26:19.000', '2018-12-06 07:37:00.000', '2007-10-25 08:15:10.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (645, 'tU4pbXjdjX', '130 Volac Park, Grantchester Rd', '维护', '异常', '姚岚', 'vmaY5MNF6E', '2004-10-05 01:51:13.000', '2012-10-06 01:56:12.000', '2023-09-04 23:25:09.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (646, 'pNdLYV4Uzp', '95 Mosley St', '正常', '异常', '赵云熙', 'BgKdbaPYS8', '2020-11-12 14:51:39.000', '2008-10-28 10:52:57.000', '2015-06-09 23:42:36.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (647, 'uPozYJ6o35', '996 Bergen St', '正常', '维护', '谢杰宏', 'i0xspe0cyw', '2002-10-14 11:21:56.000', '2004-04-17 00:03:02.000', '2007-11-28 13:29:13.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (648, 'dHM27TGTsS', '800 Earle Rd', '正常', '正常', '谢嘉伦', 'W9fXKHFBBU', '2014-05-09 21:00:31.000', '2021-08-04 23:08:26.000', '2019-01-17 03:19:54.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (649, 'whBGwz6g6R', '72 68 Qinghe Middle St, Haidian District', '维护', '维护', '傅杰宏', 'Qy8kYVQTnm', '2001-11-01 16:26:26.000', '2007-08-08 08:49:48.000', '2019-02-03 21:31:35.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (650, 'qBf3WLo4bM', '913 Regent Street', '维护', '维护', '雷秀英', '1Qbm5KQeBu', '2018-01-28 10:56:12.000', '2024-05-22 00:43:15.000', '2023-03-29 18:00:23.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (651, 'bNcXCpUEq5', '194 Jianxiang Rd, Pudong', '正常', '异常', '熊璐', 'ZdD1R3Wkzp', '2014-01-06 05:12:13.000', '2001-06-25 19:17:49.000', '2024-01-16 05:31:56.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (652, 'iITaoqHJcZ', '963 Wall Street', '正常', '异常', '袁嘉伦', '541TqXyrbr', '2017-06-22 17:20:29.000', '2023-06-25 22:08:33.000', '2021-12-11 05:21:26.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (653, '1Iv0jkzyG5', '344 49/50 Strand, Charing Cross', '异常', '异常', '朱晓明', 'aSi64kfb0Y', '2006-04-08 17:40:16.000', '2010-12-05 11:55:36.000', '2025-04-06 22:42:31.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (654, 'QxaoahEGRx', '760 State Street', '维护', '异常', '潘致远', 'EEr9ca8p1y', '2014-02-07 02:42:05.000', '2006-10-31 19:02:21.000', '2011-08-09 17:31:09.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (655, 'pEa4BPNcxB', '3-27-5 Higashitanabe, Higashisumiyoshi Ward', '异常', '正常', '蒋璐', 'YPK67fetsN', '2012-05-25 17:52:34.000', '2004-05-24 03:02:14.000', '2020-09-24 16:50:32.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (656, 'A0jb0oAMRd', '3-15-17 Ginza, Chuo-ku', '异常', '维护', '高震南', 'rh7jhk4JCV', '2007-06-12 05:03:51.000', '2015-04-24 01:04:11.000', '2002-01-29 01:51:27.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (657, 'US3GWh7DpC', '454 Little Clarendon St', '维护', '维护', '黄致远', 'V0UoE4H6JZ', '2006-06-11 23:10:40.000', '2008-12-20 05:44:44.000', '2004-01-04 13:14:04.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (658, 'JrpXovP0sd', '2-5-8 Chitose, Atsuta Ward', '正常', '正常', '尹宇宁', 'm43zD1QS9x', '2012-06-07 19:20:05.000', '2011-10-15 23:18:11.000', '2014-07-13 22:07:31.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (659, 'EaqDzhFRly', '813 Portland St', '正常', '维护', '孟震南', 'Qtw1Vs5kx2', '2019-01-13 23:50:45.000', '2013-08-22 23:53:10.000', '2011-06-30 01:07:27.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (660, 'Isd9QnCYV1', '209 West Chang\'an Avenue, Xicheng District', '维护', '异常', '董晓明', 'KUJBAKORTv', '2001-05-20 01:37:31.000', '2016-11-17 15:40:38.000', '2003-04-09 01:25:56.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (661, 'iN1IpAW39V', '740 Lark Street', '异常', '维护', '任云熙', 'vUccGcNV6D', '2016-07-12 22:45:19.000', '2013-01-11 02:32:54.000', '2000-01-30 11:46:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (662, '52aup0tnZb', '214 West Chang\'an Avenue, Xicheng District', '维护', '异常', '常子异', 'O82TA1Ayh7', '2001-07-13 09:41:53.000', '2007-08-28 23:24:16.000', '2021-10-19 18:11:56.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (663, 'zkl7cnJTge', '722 Flatbush Ave', '异常', '维护', '武云熙', 'OcZ1ePHsGQ', '2016-07-04 03:42:10.000', '2019-07-16 01:30:41.000', '2016-10-29 19:46:21.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (664, 'O9kTYU4z0R', '757 Cannon Street', '异常', '维护', '贾云熙', 'RM5uAw1KZV', '2018-06-01 15:49:40.000', '2009-03-29 05:48:46.000', '2017-03-31 10:04:51.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (665, 'ljU3IzkTNI', '179 Daxin S Rd, Daxin Shangquan, Tianhe Qu', '异常', '异常', '夏璐', '5XafmyQq9I', '2012-06-12 05:17:36.000', '2025-03-23 04:03:17.000', '2014-07-31 17:26:04.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (666, 'M6mwAxAi2I', '418 Portland St', '维护', '正常', '郑杰宏', 'ImoDvKd31e', '2009-04-05 13:45:45.000', '2000-07-07 14:24:07.000', '2024-04-10 05:51:21.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (667, 'JQseCAeYyp', '33 Jiangnan West Road, Haizhu District', '维护', '正常', '阎致远', 'ZnuAz0BZSP', '2013-02-06 19:41:34.000', '2004-08-06 22:31:59.000', '2019-03-08 07:04:37.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (668, 'bkpND89rem', '161 Shanhu Rd', '正常', '正常', '吕安琪', '3GlYyfDxIt', '2009-06-16 18:18:24.000', '2001-10-27 21:31:45.000', '2020-04-04 13:38:40.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (669, 'KIb908GQL8', '714 Lodge Ln, Toxteth', '异常', '异常', '曾晓明', 'bNMTlyARjo', '2005-12-03 02:52:49.000', '2005-03-02 12:25:28.000', '2000-12-23 15:39:31.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (670, 'DO2Xd9nJmg', '41 Abingdon Rd, Cumnor', '异常', '正常', '毛致远', 'd2ZQIByApb', '2013-10-09 12:42:46.000', '2004-02-22 13:45:26.000', '2005-03-19 18:54:52.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (671, 'izDr6NEYb4', '549 West Houston Street', '异常', '正常', '苏震南', '1tzNzILMgz', '2023-11-19 15:13:21.000', '2015-10-07 14:15:44.000', '2005-04-20 06:35:23.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (672, 'Iu4gjE8yqg', '800 Fifth Avenue', '正常', '维护', '范睿', '9ExkwAvyG8', '2001-04-28 00:33:18.000', '2004-08-12 03:42:06.000', '2020-03-16 12:59:51.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (673, '4Tf7aikYZu', '131 Sanlitun Road, Chaoyang District', '异常', '异常', '罗璐', 'gJLealRxc1', '2013-08-18 01:13:25.000', '2009-06-03 15:32:23.000', '2010-02-05 05:32:34.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (674, 'IUMi7zdoec', '2-5-20 Chitose, Atsuta Ward', '正常', '异常', '孔秀英', '8thWImFGDC', '2009-06-18 01:13:56.000', '2013-01-07 11:55:06.000', '2004-11-11 04:15:39.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (675, 'aZdAeIoxbq', '815 Xiaoping E Rd, Baiyun ', '正常', '正常', '胡安琪', 'iYxcdqIKz9', '2013-03-05 20:07:32.000', '2003-09-29 13:21:36.000', '2015-03-09 10:53:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (676, 't7AU6WBkfT', '844 3rd Section Hongxing Road, Jinjiang District', '异常', '异常', '崔睿', 'tksPEfZDyf', '2018-08-03 09:13:34.000', '2006-09-23 18:05:28.000', '2018-09-02 07:23:57.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (677, 'KsHveDHU9S', '879 Lower Temple Street', '维护', '异常', '汪嘉伦', 'xPH70CpwYV', '2003-03-26 01:47:36.000', '2013-10-29 04:47:07.000', '2022-11-05 02:21:30.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (678, 'BPZ7WNHUqS', '68 Osney Mead', '维护', '维护', '贾詩涵', '2uALP1uKoJ', '2020-11-28 23:29:12.000', '2018-08-13 03:16:13.000', '2015-11-19 21:41:52.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (679, 'BmFqJHkcM0', '327 Sackville St', '异常', '异常', '龚嘉伦', 'hG47s4r2FW', '2019-06-24 07:35:38.000', '2005-10-03 22:52:10.000', '2012-09-22 20:28:59.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (680, '01CW7DS8KC', '325 Yueliu Rd, Fangshan District', '异常', '维护', '卢詩涵', 'R77sHyIJ0c', '2007-08-29 20:35:21.000', '2017-05-23 16:20:10.000', '2019-08-13 11:57:01.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (681, 'mSvPGKR5Fv', '16 3-803 Kusunokiajima, Kita Ward', '正常', '正常', '阎詩涵', 'dQNAzHZsD6', '2013-03-08 04:10:58.000', '2006-06-13 01:34:19.000', '2021-06-27 00:55:34.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (682, 'v6Pxcqoae0', '777 Pedway', '维护', '异常', '杜秀英', 'EQTsrjwkLD', '2002-08-25 17:16:21.000', '2011-11-03 20:04:23.000', '2023-06-15 18:58:14.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (683, 'xfPjBqlQjj', '432 Flatbush Ave', '异常', '异常', '任璐', 'YF3f93AxRP', '2014-11-10 20:56:16.000', '2000-11-04 18:40:27.000', '2018-04-28 03:04:05.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (684, 'XzJtjFpdKu', '396 Tangyuan Street 5th Alley, Airport Road, Baiyun', '维护', '正常', '于子韬', 'q5FnexJi8E', '2013-08-05 20:54:55.000', '2008-10-14 09:44:06.000', '2004-04-29 11:46:00.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (685, 'SYIJVHqHHs', '656 Osney Mead', '异常', '维护', '罗詩涵', 'yMo9V0awzV', '2019-05-15 19:28:10.000', '2024-10-11 02:58:08.000', '2011-03-08 07:08:34.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (686, 'vjxw5K8Dy9', '163 S Broadway', '异常', '异常', '金子韬', '7PhXbZyoru', '2022-02-01 15:31:35.000', '2000-02-19 21:38:57.000', '2018-02-08 07:54:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (687, 'LzQ6qAONXo', '12 1-1 Honjocho, Yamatokoriyama', '正常', '异常', '宋詩涵', '5Yhg2Jpbds', '2001-01-27 13:37:54.000', '2004-07-27 00:57:14.000', '2013-07-31 19:53:04.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (688, 'lx4S4DPDoE', '17 4-20 Kawagishicho, Mizuho Ward', '异常', '异常', '范子异', 'AG7ebGKLMP', '2013-08-29 18:57:45.000', '2000-02-25 09:00:26.000', '2005-02-09 22:44:38.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (689, '7DTaxJedeh', '447 Lower Temple Street', '维护', '维护', '董睿', 'BIqgrFgMIj', '2024-08-19 05:51:51.000', '2001-05-08 08:13:05.000', '2011-06-18 04:45:38.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (690, 'QpPOlQBWbg', '180 Central Avenue', '异常', '正常', '郝璐', 'GuNtAQIljY', '2016-08-19 22:06:07.000', '2023-02-15 20:36:15.000', '2015-09-30 10:44:07.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (691, 'U37SwJFYB1', '2-5-2 Chitose, Atsuta Ward', '异常', '正常', '莫子异', 'cUujcVlKus', '2009-09-02 18:10:57.000', '2021-04-15 17:07:41.000', '2005-07-19 10:48:32.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (692, 'aLXNgI5SDP', '470 East Alley', '维护', '异常', '袁嘉伦', 'YKm4HLc63G', '2020-10-08 16:08:50.000', '2017-02-03 10:22:41.000', '2008-09-26 19:47:12.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (693, 'ZyYoNiReSi', '447 Stephenson Street', '异常', '维护', '李璐', 'ls9GjbrjhI', '2004-04-05 18:48:49.000', '2010-03-04 11:31:03.000', '2022-05-08 18:34:43.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (694, 'oVLicav6ZE', '3-9-2 Gakuenminami', '正常', '维护', '宋震南', 'y3vQRs1I7e', '2021-08-25 13:59:20.000', '2015-01-07 20:05:12.000', '2001-01-08 11:37:55.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (695, 'hAopM0AD30', '1-7-19 Omido, Higashiosaka', '正常', '维护', '邹宇宁', 'uLDWlhkePZ', '2004-05-05 08:53:12.000', '2012-09-22 19:46:14.000', '2024-05-02 04:13:26.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (696, 'XPKIdUhlN1', '884 Hinckley Rd', '正常', '异常', '廖震南', 'UoqmihrCwc', '2008-12-11 23:18:40.000', '2002-10-29 18:44:05.000', '2008-01-20 17:41:58.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (697, 'N578BnEaif', '710 Wall Street', '异常', '正常', '冯晓明', 'w9Z0vn4k6N', '2016-04-20 05:56:55.000', '2018-02-17 11:16:18.000', '2010-04-30 20:56:07.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (698, 'D3Z6yrQORf', '190 Daxin S Rd, Daxin Shangquan, Tianhe Qu', '维护', '维护', '陆嘉伦', 'J44Mdjl823', '2021-06-12 21:06:47.000', '2000-09-16 06:57:21.000', '2022-05-03 16:26:12.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (699, '87gjNuZEzM', '357 Jianxiang Rd, Pudong', '异常', '维护', '曹岚', 'nNhyWH8O5L', '2015-11-22 02:20:18.000', '2015-08-25 10:09:45.000', '2004-05-12 17:44:54.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (700, 'GbxKhiF3Ud', '1-7-6 Saidaiji Akodacho', '维护', '异常', '周安琪', 'wJQqp0fiDB', '2009-01-10 18:17:32.000', '2004-06-03 04:20:40.000', '2023-06-02 04:19:39.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (701, 'NOwgZAT9xk', '3-27-18 Higashitanabe, Higashisumiyoshi Ward', '维护', '维护', '袁致远', '9YqEJSiLLg', '2019-10-30 01:18:56.000', '2023-10-15 04:21:31.000', '2016-05-13 11:29:37.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (702, '00rL6Vih8f', '278 Papworth Rd, Trumpington', '正常', '正常', '杨詩涵', 'GJi2A6btgF', '2016-08-05 03:01:37.000', '2015-06-13 16:38:52.000', '2014-04-29 13:06:46.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (703, 'rLt3GITHer', '506 49/50 Strand, Charing Cross', '正常', '异常', '汪秀英', 'l6Chrz1vfb', '2001-05-01 09:16:51.000', '2017-06-25 00:58:07.000', '2013-06-05 12:38:31.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (704, 'J7PxPe06U0', '998 East Cooke Road', '正常', '正常', '范秀英', 'ufyrVtABNm', '2013-01-09 12:20:24.000', '2023-08-26 15:30:21.000', '2022-06-18 16:57:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (705, 'fbTqvuvCzH', '1-7-10 Saidaiji Akodacho', '异常', '异常', '郭杰宏', 'J5JMyaGhx1', '2015-10-19 18:33:46.000', '2017-12-22 15:40:32.000', '2011-07-19 17:49:03.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (706, 'mr6vS9P3QB', '43 Jiangnan West Road, Haizhu District', '正常', '正常', '萧致远', 'SbVj0K6WuM', '2004-12-23 06:19:42.000', '2006-06-26 14:43:59.000', '2021-09-09 07:12:45.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (707, '4cAPHGT4MD', '3-27-15 Higashitanabe, Higashisumiyoshi Ward', '维护', '异常', '常詩涵', 'jjIZsmRSNM', '2000-04-12 01:55:13.000', '2006-08-15 05:43:19.000', '2010-01-01 12:20:18.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (708, 'MkWqeHS0hf', '644 Diplomacy Drive', '维护', '正常', '汤安琪', 'Tgj3ErTq3E', '2015-11-05 10:40:08.000', '2009-11-20 22:15:03.000', '2001-10-01 11:34:31.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (709, 'AySfwjbdIv', '159 Huanqu South Street 2nd Alley', '维护', '异常', '廖詩涵', 'p78VCGEXOv', '2021-11-17 23:44:07.000', '2010-06-22 23:42:02.000', '2022-12-03 08:53:33.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (710, 'k8QpGjkXbt', '18 4-20 Kawagishicho, Mizuho Ward', '正常', '正常', '吕秀英', 'EhbiluuW7a', '2004-11-01 06:49:12.000', '2014-04-24 00:15:17.000', '2001-01-11 02:58:17.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (711, 'oW8ihsdePX', '984 Canal Street', '正常', '正常', '汤睿', 'ozKwHxN5Qz', '2020-03-03 08:42:56.000', '2013-08-18 14:03:09.000', '2023-03-10 15:50:56.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (712, 'VkrM25S7G4', '493 Papworth Rd, Trumpington', '维护', '异常', '蔡杰宏', 'xcNCfjn0E9', '2018-11-25 09:25:05.000', '2023-03-08 03:58:38.000', '2004-04-11 08:15:30.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (713, 'KaqSIGQgcV', '920 49/50 Strand, Charing Cross', '异常', '维护', '唐子异', 'vgMeIqtGIP', '2019-04-16 11:32:57.000', '2012-08-25 08:52:22.000', '2017-07-18 02:40:53.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (714, '5YM3Q2ufdi', '602 Tianhe Road, Tianhe District', '正常', '异常', '韩詩涵', 'uG461ubaHy', '2016-10-18 06:54:52.000', '2009-03-02 17:29:31.000', '2004-11-07 17:57:07.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (715, 'hwNBO8d0WI', '382 Narborough Rd', '正常', '维护', '秦震南', 'aADRLbUxwh', '2007-07-10 05:26:50.000', '2016-12-23 11:24:08.000', '2001-05-28 00:40:13.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (716, '86RND0s9Pn', '952 Volac Park, Grantchester Rd', '异常', '维护', '孟子韬', '6rFYXlW46Q', '2006-07-09 14:56:02.000', '2004-09-18 10:53:16.000', '2017-04-14 09:58:30.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (717, 'ILf2lth6fz', '1-1-7 Deshiro, Nishinari Ward', '异常', '异常', '萧岚', 'ZJB5rFda8D', '2013-03-23 14:21:22.000', '2008-07-25 19:52:29.000', '2014-02-25 22:22:46.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (718, 'd3r4VEqcPL', '759 Bank Street', '正常', '维护', '廖璐', '88nRNCtNpe', '2018-01-24 14:25:27.000', '2016-03-01 09:38:23.000', '2011-07-23 05:35:42.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (719, 'RQo0KzhF2H', '5-2-12 Kikusui 3 Jo, Shiroishi Ward', '维护', '维护', '叶安琪', 'IBTA3qmtzz', '2012-03-15 12:51:05.000', '2009-05-25 02:01:40.000', '2004-12-23 09:12:26.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (720, 'zO5BxXZWLO', '855 Dong Zhi Men, Dongcheng District', '异常', '异常', '孔秀英', 'nckSxy1HiE', '2007-05-18 18:45:23.000', '2008-08-22 00:13:45.000', '2023-08-23 09:11:32.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (721, '5zDDCEMTqM', '499 Earle Rd', '正常', '维护', '潘致远', '5AFKEhXJLp', '2018-11-05 14:42:02.000', '2003-07-27 15:54:38.000', '2019-09-07 19:25:54.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (722, 'jP7N2ZdHbI', '745 Bergen St', '正常', '异常', '梁嘉伦', 'mIR5JwnOuh', '2011-10-18 09:27:52.000', '2021-10-09 10:08:25.000', '2000-05-14 05:10:05.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (723, 'wvJOWPkZ4N', '906 Middle Huaihai Road, Huangpu District', '维护', '异常', '朱秀英', 'IZAHUfRGQz', '2020-04-25 22:00:11.000', '2010-10-04 21:16:06.000', '2008-04-16 11:03:29.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (724, 'EUI1bIhoRQ', '434 Cannon Street', '异常', '异常', '孙震南', '5f053RauV6', '2016-05-24 18:42:01.000', '2025-03-14 10:48:49.000', '2018-10-12 02:29:07.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (725, '2j7KUl7CZN', '3-27-10 Higashitanabe, Higashisumiyoshi Ward', '正常', '正常', '贾安琪', 'OH1zTkTcnk', '2014-03-31 20:10:36.000', '2018-04-19 21:20:30.000', '2001-03-31 18:53:18.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (726, 'Pvy0AWwo7c', '2-1-20 Tenjinnomori, Nishinari Ward', '异常', '异常', '江睿', 'zwP62szwdU', '2022-06-12 19:34:30.000', '2009-01-12 17:04:15.000', '2025-02-13 18:03:28.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (727, '1oTCGc1VXJ', '603 Ridgewood Road', '维护', '维护', '江詩涵', 'nwNgkJEaYL', '2016-02-08 17:21:27.000', '2007-12-19 13:47:54.000', '2002-12-22 19:02:40.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (728, 'uNHJb24QYN', '5-4-12 Kikusui 3 Jo, Shiroishi Ward,', '正常', '维护', '卢子异', 'nJ6m3VKD8k', '2024-10-09 07:32:51.000', '2019-01-04 11:22:08.000', '2007-03-27 23:40:45.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (729, 'wpw9n7mlam', '5-4-4 Kikusui 3 Jo, Shiroishi Ward,', '维护', '异常', '石安琪', 'UFgWcGuUta', '2010-11-10 03:01:33.000', '2000-09-22 17:48:09.000', '2008-07-21 21:42:42.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (730, 'OuFSUg9vVw', '745 Mosley St', '异常', '维护', '邱嘉伦', 'HTlgrseDmV', '2019-03-18 04:32:10.000', '2012-07-30 22:32:02.000', '2011-02-19 08:51:08.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (731, 'ZyMp21LbUk', '227 The Pavilion, Lammas Field, Driftway', '正常', '维护', '周宇宁', 'FaeXbGnvRF', '2006-07-28 11:28:20.000', '2020-04-06 11:38:27.000', '2021-10-12 09:18:34.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (732, 'D0AwmeMgPr', '672 Figueroa Street', '维护', '正常', '邹嘉伦', 'jBMaVoQckK', '2009-12-01 06:44:27.000', '2022-07-26 18:27:28.000', '2017-05-21 03:07:39.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (733, 'xs3ZMcicuO', '171 Grape Street', '异常', '维护', '戴秀英', 't6E3mJedEC', '2024-08-10 09:56:13.000', '2007-11-22 13:48:06.000', '2014-03-07 01:29:53.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (734, '7OSIvKioYQ', '4 Stephenson Street', '异常', '维护', '叶秀英', 'XpYx1OWaD8', '2009-01-13 02:09:29.000', '2016-07-16 11:37:10.000', '2021-02-27 21:31:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (735, 'Zav4i4onvP', '3-15-8 Ginza, Chuo-ku', '异常', '维护', '常杰宏', 'nILxfrs3bu', '2004-11-12 14:28:46.000', '2017-04-11 14:48:26.000', '2006-05-22 04:10:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (736, '6vR4imIz9P', '33 Qingshuihe 1st Rd, Luohu District', '正常', '正常', '宋岚', 'Vua9m2sBW5', '2018-02-04 03:13:43.000', '2018-10-19 04:39:25.000', '2002-09-30 19:06:05.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (737, 'QhE1w5NlvP', '77 W Ring Rd, Buji Town, Longgang', '异常', '正常', '任岚', 'vPKRbSqtm7', '2009-11-20 01:35:08.000', '2000-11-26 20:48:05.000', '2022-02-03 16:46:02.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (738, 'xxfdSs93Vh', '254 4th Section  Renmin South Road, Jinjiang District', '异常', '异常', '邵岚', 'VJyIyW15uE', '2003-01-30 19:56:53.000', '2013-02-16 19:08:36.000', '2022-05-24 19:02:10.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (739, 'XIH5Q2Mtsd', '275 Riverview Road', '异常', '异常', '范岚', '5gH86GHmKZ', '2018-05-16 08:18:20.000', '2013-03-01 10:08:25.000', '2010-09-20 20:20:10.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (740, 'zqJNMEZHBN', '12 4-20 Kawagishicho, Mizuho Ward', '正常', '维护', '许秀英', 'atlevM1n7D', '2017-05-13 22:01:53.000', '2005-05-22 17:40:15.000', '2020-12-28 14:56:20.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (741, 'g1CIOfm1GA', '919 4th Section  Renmin South Road, Jinjiang District', '维护', '维护', '龚晓明', 'xahSI7AEwa', '2018-04-14 05:03:42.000', '2008-10-05 14:14:10.000', '2013-05-26 02:58:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (742, 'bk2aP4Da8l', '834 Wall Street', '维护', '异常', '黎安琪', 'X1QzeKxv5v', '2001-04-11 18:30:33.000', '2009-02-28 02:09:58.000', '2007-03-04 10:53:24.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (743, 'w704WqguVX', '890 Wyngate Dr', '异常', '维护', '杨嘉伦', 'QBXAID8KIG', '2020-10-24 15:26:44.000', '2015-05-15 22:31:02.000', '2010-09-17 18:17:56.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (744, 'nayYOExTtl', '2-1-2 Kaminopporo 1 Jo, Atsubetsu Ward', '正常', '正常', '黄子异', 'gc8RBopiGr', '2002-02-03 21:59:03.000', '2023-10-31 10:51:16.000', '2010-03-14 17:46:32.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (745, 'UohG5wYxLo', '15 Tangyuan Street 5th Alley, Airport Road, Baiyun', '正常', '维护', '程秀英', '3kk6pjtcne', '2004-11-20 15:11:31.000', '2004-02-10 21:18:23.000', '2023-12-17 12:35:26.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (746, 'rd6TbmM2BI', '13 4-20 Kawagishicho, Mizuho Ward', '正常', '维护', '余杰宏', 'JsjxMS69GC', '2002-08-17 03:23:21.000', '2012-05-04 21:52:22.000', '2024-05-15 13:08:56.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (747, 'XriWBB47kR', '741 Xiaoping E Rd, Baiyun ', '异常', '异常', '魏宇宁', 'xeWLkZTyET', '2009-02-05 18:52:50.000', '2007-02-14 18:41:14.000', '2002-06-18 05:33:25.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (748, 'H7FRRNQKXl', '921 Lark Street', '异常', '异常', '薛云熙', 'jyIs9TlxRQ', '2003-05-15 21:52:47.000', '2003-01-09 18:34:49.000', '2003-07-17 01:32:40.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (749, 'XKmUqwfeaF', '89 West Houston Street', '异常', '正常', '林子异', 'SBHvSjUxNl', '2010-03-17 03:25:13.000', '2010-10-09 05:41:44.000', '2010-01-25 01:21:07.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (750, 'wTdBAJEDTh', '5-2-12 Kikusui 3 Jo, Shiroishi Ward', '维护', '正常', '向震南', 'NvFRu78Vov', '2014-03-02 00:12:44.000', '2009-08-04 09:56:43.000', '2014-09-17 07:25:51.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (751, 'CU56zoUCiP', '69 Central Avenue', '正常', '正常', '程宇宁', 'i6FLEQ8GiB', '2013-03-28 22:45:51.000', '2024-08-12 19:15:50.000', '2014-08-06 00:58:03.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (752, 'vDY6Jx87Rk', '332 Portland St', '维护', '维护', '张震南', 'djOl2DLEhI', '2022-07-22 08:44:57.000', '2010-07-03 21:35:58.000', '2017-04-17 19:57:02.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (753, 'hyWNMO61D1', '482 New Street', '维护', '异常', '邱秀英', 'kRRXTQfNUJ', '2016-04-11 16:13:48.000', '2020-09-29 23:26:42.000', '2013-06-27 09:51:41.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (754, 'PhEdMBjYwI', '761 Middle Huaihai Road, Huangpu District', '正常', '正常', '侯子异', 'H87PzF6llU', '2000-06-30 08:41:28.000', '2018-11-22 02:58:58.000', '2013-10-26 17:50:44.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (755, 'VOah1m15vG', '283 Elms Rd, Botley', '异常', '维护', '潘安琪', 'AFfc60BwO6', '2001-06-01 19:54:37.000', '2014-03-22 15:33:52.000', '2022-12-07 09:44:13.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (756, 'tEN5WujSXe', '922 West Market Street', '正常', '正常', '傅安琪', 'bsSlZeQk1H', '2022-08-31 19:39:43.000', '2010-02-15 04:43:59.000', '2021-10-13 21:34:25.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (757, 'LBPQ4IjVP7', '2-1-8 Kaminopporo 1 Jo, Atsubetsu Ward', '维护', '异常', '钟晓明', 'thPDq3oWTH', '2009-01-15 12:34:45.000', '2007-10-18 20:12:42.000', '2006-05-19 08:26:12.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (758, 'O5GhesxE6W', '594 The Pavilion, Lammas Field, Driftway', '维护', '异常', '贺璐', 'nawzhezovE', '2025-04-10 13:30:22.000', '2022-02-27 12:49:45.000', '2004-03-21 02:14:32.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (759, 'fYKKe1wjVh', '915 Lark Street', '维护', '维护', '丁睿', '0NUuTJ95lN', '2020-09-03 04:58:02.000', '2008-03-05 15:23:08.000', '2011-06-07 09:59:57.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (760, 'C1a2sNfVw1', '301 Columbia St', '正常', '正常', '邱詩涵', 'e7K7qZkCjA', '2016-08-19 00:58:07.000', '2016-04-16 15:39:41.000', '2012-03-20 14:42:30.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (761, 'NF46FfJBqG', '607 Shanhu Rd', '正常', '异常', '周安琪', '1BGg7KGgZm', '2000-11-10 18:31:36.000', '2018-07-03 11:07:45.000', '2001-02-25 11:23:15.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (762, 'SsSAc3MHKD', '630 Edward Ave, Braunstone Town', '维护', '异常', '方子韬', 'hLDMnFlq1O', '2014-05-30 06:08:40.000', '2010-09-18 17:18:42.000', '2007-09-14 15:13:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (763, '51aCHFyAfH', '313 Trafalgar Square, Charing Cross', '正常', '异常', '金晓明', 'hjiqtJZVpx', '2021-07-21 07:23:39.000', '2018-10-09 12:25:04.000', '2000-11-14 05:23:26.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (764, '3TINxcUp1r', '15 3-803 Kusunokiajima, Kita Ward', '正常', '异常', '黎秀英', 'wKCp65EVVY', '2004-05-21 04:22:38.000', '2024-10-02 03:56:56.000', '2024-06-03 00:38:45.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (765, 'iufrHGcs4V', '15 1-1 Honjocho, Yamatokoriyama', '维护', '正常', '吕岚', 'B17GaqeDgk', '2023-01-09 22:00:39.000', '2004-08-27 15:37:35.000', '2009-02-04 13:06:31.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (766, '8uTVoxeC9C', '158 Bank Street', '维护', '异常', '韩杰宏', '0jx8DqgCEr', '2024-07-14 19:18:00.000', '2009-10-30 13:06:52.000', '2010-07-03 23:09:32.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (767, 'H9g30pg94d', '14 1-1 Honjocho, Yamatokoriyama', '正常', '维护', '冯云熙', 'm2PCAPTvmL', '2018-01-09 02:29:42.000', '2023-02-04 01:58:20.000', '2010-02-20 22:06:12.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (768, 'YhfaQDiAFq', '812 Dong Zhi Men, Dongcheng District', '维护', '维护', '丁子异', 'rrnXzL1j6y', '2013-09-21 13:08:31.000', '2009-02-02 05:19:39.000', '2016-06-17 18:40:11.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (769, 'bZgubJW7IV', '388 FuXingMenNei Street, XiCheng District', '维护', '正常', '江詩涵', 'ldbQxb525h', '2021-08-31 21:49:20.000', '2008-11-09 12:14:34.000', '2023-02-25 09:36:56.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (770, 'P1d4pC52Wm', '11 Cyril St, Braunstone Town', '维护', '异常', '袁睿', 'WOGAjvgiF4', '2000-12-20 14:43:56.000', '2002-06-10 15:12:01.000', '2023-07-07 01:28:36.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (771, 'GpnvCyT3Ra', '291 Hanover Street', '维护', '正常', '贺宇宁', 'ql5VexcCSd', '2002-10-11 13:39:12.000', '2023-07-30 04:16:38.000', '2004-07-13 14:41:40.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (772, 'P6jeIkHGWH', 'No.748, Dongsan Road, Erxianqiao, Chenghua District', '异常', '维护', '潘睿', 'V7ixayaimR', '2014-04-07 11:41:25.000', '2011-12-24 13:57:26.000', '2019-04-23 18:53:58.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (773, 'SH98ZdYVah', '260 Diplomacy Drive', '维护', '正常', '孙安琪', 'pPhJmW7shT', '2017-06-11 12:52:10.000', '2002-02-16 03:06:09.000', '2019-02-08 14:33:14.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (774, 'VEs2b28Vj6', '528 Riverview Road', '正常', '异常', '周秀英', 'pSycznmWbY', '2024-07-14 20:20:12.000', '2007-06-06 13:51:39.000', '2010-11-13 16:35:13.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (775, 'wwA0ZKCnZ4', '1-7-20 Saidaiji Akodacho', '维护', '异常', '黄晓明', 'aGGfSLwbR7', '2021-03-12 11:21:11.000', '2022-02-26 17:30:39.000', '2016-08-17 18:23:23.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (776, 'sC9nFT46bT', '615 Lower Temple Street', '正常', '维护', '崔杰宏', '7akGy9djzY', '2005-10-02 18:27:17.000', '2016-07-31 04:42:25.000', '2021-12-02 17:21:51.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (777, 'EfGK9Y9iVJ', '627 2nd Zhongshan Road, Yuexiu District', '维护', '维护', '钟致远', 'p7JmxQW6xw', '2012-10-18 16:38:45.000', '2012-03-12 10:33:30.000', '2002-08-11 17:21:06.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (778, 'XdE9BrfjB7', '3-27-2 Higashitanabe, Higashisumiyoshi Ward', '异常', '维护', '赵杰宏', 'sPZJAkytf0', '2005-10-26 17:28:58.000', '2002-03-14 02:28:16.000', '2012-06-09 15:22:26.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (779, 'M0TsnBiBpQ', '599 The Pavilion, Lammas Field, Driftway', '异常', '正常', '潘睿', '8aj0XxIIQs', '2019-03-20 18:11:05.000', '2021-08-09 01:57:35.000', '2022-10-14 22:49:10.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (780, 'RzRqlsongE', '3-27-4 Higashitanabe, Higashisumiyoshi Ward', '维护', '异常', '曹致远', '5s1N7evwP1', '2021-07-23 03:39:01.000', '2013-02-06 05:10:40.000', '2017-08-26 19:06:11.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (781, 'O2SDhwwmsf', '960 West Chang\'an Avenue, Xicheng District', '正常', '维护', '陈子异', '6JsgOMcWsu', '2019-06-25 10:42:15.000', '2021-08-24 09:58:49.000', '2007-12-03 22:56:04.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (782, 'FAZk70REa1', '843 S Broadway', '异常', '维护', '傅睿', 'XSnhfVwwrO', '2003-08-30 01:55:27.000', '2019-08-07 07:29:10.000', '2000-05-07 03:34:42.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (783, 'bL2mRpSJFw', '534 Grape Street', '异常', '正常', '江岚', 'F9i8B8w8wx', '2001-02-23 08:08:25.000', '2014-01-05 22:49:19.000', '2020-03-27 12:53:20.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (784, 'asNTPRSQ2f', '863 Volac Park, Grantchester Rd', '正常', '正常', '苏宇宁', 'fUNmpdNIZb', '2009-11-07 02:10:00.000', '2018-10-03 17:39:41.000', '2019-06-17 14:30:43.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (785, 'TTssa47evo', '2 3-803 Kusunokiajima, Kita Ward', '异常', '维护', '毛岚', 'Yh9UMWvlKt', '2016-06-17 04:26:47.000', '2006-03-03 01:24:22.000', '2004-06-15 19:21:48.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (786, '6e0FAN8WWA', 'No. 937, Shuangqing Rd, Chenghua District', '维护', '正常', '魏安琪', 'v7c9N4bJVh', '2013-05-06 21:25:13.000', '2017-10-15 02:30:38.000', '2007-10-11 05:46:07.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (787, 'dSsf8dkWKw', '9 1-1715 Sekohigashi, Moriyama Ward', '维护', '正常', '丁安琪', 'M6LthYhWrl', '2006-12-27 15:46:13.000', '2021-03-25 20:55:56.000', '2003-01-25 18:40:50.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (788, 'vmJdRpbG5U', '165 Pedway', '异常', '维护', '吴子韬', '17aeVewgjf', '2012-09-13 21:49:01.000', '2006-12-01 02:56:55.000', '2012-11-22 13:01:53.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (789, 'PBZueihVLP', '231 Spring Gardens', '正常', '异常', '谭致远', 'L168waawau', '2024-04-13 05:22:38.000', '2020-04-15 20:36:32.000', '2012-11-22 18:38:38.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (790, 'dF3oVPGFf1', '87 Canal Street', '正常', '异常', '郭子韬', 'SWOm6j1xVw', '2019-06-03 05:17:01.000', '2003-07-05 18:47:02.000', '2003-03-22 01:04:05.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (791, 'WfNyfaVie9', '693 North Michigan Ave', '维护', '异常', '袁云熙', 'jk6hXPnQE6', '2001-08-30 00:16:35.000', '2022-09-26 07:26:18.000', '2009-03-04 07:31:46.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (792, 'eQrm9CVTSH', '665 Lodge Ln, Toxteth', '正常', '正常', '董子异', 'sP5vaLL39Q', '2020-04-25 01:20:17.000', '2014-09-29 19:03:39.000', '2010-07-05 07:41:19.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (793, 'F6jYy6aVtR', '504 Hanover St', '维护', '正常', '陶璐', 'PdVwfAkW3L', '2017-02-28 17:48:37.000', '2017-02-21 03:34:03.000', '2003-04-22 03:08:45.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (794, 'W0OF9V8mwd', '6 1-1 Honjocho, Yamatokoriyama', '维护', '维护', '龚云熙', 'YyoLW5aT87', '2022-03-11 23:52:45.000', '2021-10-12 19:15:17.000', '2003-03-25 06:38:48.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (795, 'yp1mGFV2pe', '1-5-19, Higashi-Shimbashi, Minato-ku', '正常', '正常', '吴晓明', '8lUv5hyY8R', '2015-10-22 06:35:22.000', '2025-04-14 08:47:35.632', '2025-04-05 14:37:57.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (796, 'HfsVEPpk4W', 'No. 331, Shuangqing Rd, Chenghua District', '正常', '维护', '曹嘉伦', 'UUoSEEOgQw', '2015-02-18 08:14:01.000', '2025-01-06 21:33:29.000', '2012-10-11 21:39:28.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (797, '03mHUoqIZ4', '5-2-12 Kikusui 3 Jo, Shiroishi Ward', '异常', '异常', '曾岚', 'dUh03Go0ET', '2007-06-21 08:35:19.000', '2015-03-06 18:13:54.000', '2023-05-20 22:36:25.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (798, 'hgKKOFQ3KH', '99 Hanover St', '异常', '维护', '彭震南', '3LCPSJ8pG3', '2010-06-06 21:01:42.000', '2003-03-05 17:20:55.000', '2003-08-28 00:48:01.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (799, 'aq6PDtBdaR', '831 Portland St', '维护', '异常', '侯云熙', 'XPtO5dqKTD', '2014-02-11 15:16:23.000', '2004-08-01 05:40:09.000', '2015-07-10 08:56:25.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (800, '14OtA1OVQY', '5-2-4 Kikusui 3 Jo, Shiroishi Ward', '维护', '正常', '姚宇宁', 'qE9R7NgiXM', '2022-02-20 00:04:01.000', '2021-01-17 17:25:44.000', '2012-05-29 20:48:15.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (801, '6FN9ek6Ixu', '525 Daxin S Rd, Daxin Shangquan, Tianhe Qu', '正常', '正常', '石子异', 'M2rxxADzJM', '2020-09-24 13:55:27.000', '2010-08-04 03:42:29.000', '2022-09-22 10:52:50.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (802, 'xVhKcRokfB', '5-4-15 Kikusui 3 Jo, Shiroishi Ward,', '异常', '异常', '毛秀英', 'N6ihns9a4F', '2024-03-22 22:13:25.000', '2021-01-15 19:12:53.000', '2014-07-19 15:11:47.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (803, 'luMFmW91fQ', '223 Abingdon Rd, Cumnor', '异常', '正常', '金子韬', 'buT2mkN6Px', '2013-02-25 14:12:41.000', '2013-01-11 00:10:05.000', '2020-09-20 08:34:38.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (804, 'h4MQ5IfZ5I', '557 4th Section  Renmin South Road, Jinjiang District', '维护', '异常', '孙岚', 'vtvbBNtSDn', '2007-07-09 10:31:49.000', '2001-10-13 19:21:01.000', '2010-01-21 05:56:04.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (805, 'azloq4VIaY', '115 Stephenson Street', '维护', '异常', '陆子韬', 'dUBVZYMOaN', '2020-07-09 21:38:07.000', '2018-11-09 08:05:27.000', '2021-02-10 00:42:05.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (806, '3rIGd4Iq6C', '274 Lark Street', '异常', '异常', '陆杰宏', 'VMjX35f73k', '2018-03-20 14:05:59.000', '2008-12-20 06:02:03.000', '2024-03-20 16:37:47.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (807, 'RWJ7I2L2Vc', '585 Hanover St', '正常', '维护', '侯岚', '1GSaUflykj', '2022-01-08 10:39:35.000', '2024-10-04 13:47:42.000', '2024-07-04 20:20:18.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (808, 'cgqrJ63qkQ', '309 Zhongshan 5th Rd, Zimaling Shangquan', '正常', '维护', '孔岚', 'annU3peqhR', '2006-04-05 07:43:14.000', '2009-04-09 01:27:10.000', '2018-06-24 18:53:52.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (809, '2gqvhLhN2t', '1-7-4 Omido, Higashiosaka', '异常', '维护', '沈震南', '5i6bV3tU2U', '2008-02-13 01:32:37.000', '2018-10-09 08:43:06.000', '2004-08-14 11:49:28.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (810, 'SAion5m6GB', '141 Ridgewood Road', '维护', '正常', '杨震南', 'uj2eKUetxg', '2004-05-28 11:21:57.000', '2022-10-27 00:20:03.000', '2001-07-31 23:29:34.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (811, 'nmt2qzjlsz', '656 Sackville St', '异常', '正常', '赵宇宁', 'Xb3Ny9y3II', '2016-12-16 14:57:37.000', '2024-02-07 14:48:32.000', '2020-04-17 06:19:53.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (812, '7rheCWkgwo', '212 Fern Street', '维护', '维护', '郑璐', '17BT1zE381', '2025-01-22 06:24:23.000', '2021-02-24 04:55:20.000', '2009-09-08 16:22:28.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (813, 'a6QbO6ZgqB', '922 Central Avenue', '正常', '正常', '毛詩涵', 'M3d2uiBkIR', '2018-02-28 05:12:41.000', '2007-03-13 19:21:02.000', '2003-03-07 08:01:43.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (814, 'YfJnj6lpwa', '839 East Wangfujing Street, Dongcheng District ', '正常', '异常', '蒋宇宁', 'U38k6jjCf9', '2012-05-14 21:17:37.000', '2021-11-01 20:19:39.000', '2016-07-11 07:39:04.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (815, '8NUc5F4PXA', '336 Grape Street', '异常', '维护', '蒋子韬', 'nRlSndWnPn', '2019-03-14 10:29:09.000', '2020-05-26 09:56:09.000', '2016-11-26 08:22:01.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (816, '6bpPDeXZI2', '399 Sackville St', '维护', '正常', '姜嘉伦', 'XqUCvoBUh6', '2024-05-28 10:59:50.000', '2000-03-13 09:58:53.000', '2017-09-18 06:35:04.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (817, '3FGr5r8DqE', '184 Shennan E Rd, Cai Wu Wei, Luohu District', '异常', '异常', '钟安琪', 'escjHYUVAO', '2020-04-20 06:33:26.000', '2000-05-12 17:19:46.000', '2020-02-13 17:23:12.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (818, 'cjWiwYJtSh', '513 1st Ave', '正常', '维护', '李宇宁', 'oq8oEwFBv8', '2009-05-01 09:17:43.000', '2018-01-18 01:10:46.000', '2017-11-15 21:03:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (819, '50uRxuNE24', '778 Maddox Street', '正常', '正常', '杨子异', 'vFegwVkPER', '2009-03-10 13:23:16.000', '2011-01-28 20:58:25.000', '2010-05-27 01:40:15.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (820, 'GIt1ObtZe2', '570 North Michigan Ave', '异常', '维护', '王秀英', 'iMlxq7SUij', '2010-06-23 06:23:37.000', '2002-08-31 04:30:06.000', '2014-07-16 10:58:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (821, 'UYCKMZNne1', '738 Flatbush Ave', '正常', '异常', '徐子异', 'z1TEp0Zxqi', '2009-02-10 01:16:09.000', '2004-06-13 18:17:52.000', '2018-04-27 20:53:35.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (822, 'nXTxaue8k1', '232 Spring Gardens', '维护', '异常', '姚秀英', 'J8l73szNzS', '2008-02-01 10:12:23.000', '2016-11-15 02:10:40.000', '2014-06-11 00:43:41.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (823, 'KljjoIm1Lk', '965 Wyngate Dr', '异常', '正常', '贺嘉伦', 'P9WQshfdVX', '2016-11-07 02:01:06.000', '2010-01-02 17:42:58.000', '2007-05-19 17:11:14.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (824, 'm3SB3ZKJZP', '83 Wicklow Road', '异常', '异常', '姚嘉伦', 'XBiqISME2X', '2000-12-26 20:23:44.000', '2017-07-18 18:28:55.000', '2001-07-22 04:40:44.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (825, 'Z7L4xUq2rl', '13-3-9 Toyohira 3 Jo, Toyohira Ward', '维护', '正常', '叶睿', 'sGvYoAa0aU', '2003-08-08 19:10:04.000', '2010-11-29 04:47:15.000', '2016-04-05 07:42:31.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (826, 'j84V3EEDwC', '486 West Market Street', '维护', '维护', '曹云熙', 'p4k86peDdC', '2010-09-10 02:01:23.000', '2006-04-24 18:09:20.000', '2015-05-13 20:46:52.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (827, 'HprscQ4Fnw', '539 Aigburth Rd, Aigburth', '异常', '异常', '孙致远', 'w5mttwf9Zm', '2024-01-06 00:50:24.000', '2020-07-01 18:13:06.000', '2021-12-04 10:04:25.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (828, 'Psrx1F0LnL', '821 Tianbei 1st Rd, Luohu District', '异常', '异常', '崔致远', 'eVeurP8vzA', '2022-05-18 10:36:17.000', '2020-02-25 23:31:38.000', '2012-11-14 22:35:10.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (829, 'lhdPuUjc2g', '423 Tianbei 1st Rd, Luohu District', '维护', '异常', '韦子异', 'EoZbRYI0uC', '2018-05-26 03:02:09.000', '2003-01-11 22:52:35.000', '2003-05-20 12:12:14.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (830, 'wYbVYn3cgf', '18 3-803 Kusunokiajima, Kita Ward', '正常', '异常', '顾岚', 'UcbNzlWZyx', '2001-02-09 07:16:12.000', '2021-02-28 10:58:54.000', '2019-01-07 08:47:21.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (831, 'p68ksixhPY', '5-2-1 Kikusui 3 Jo, Shiroishi Ward', '正常', '正常', '曹宇宁', 'mKzFBKRIQF', '2020-08-08 19:15:21.000', '2018-07-31 19:28:48.000', '2016-09-23 17:15:53.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (832, 'me6XLDpGTC', '58 Jiangnan West Road, Haizhu District', '正常', '维护', '钱震南', 'yECiHXQazp', '2019-04-25 05:07:19.000', '2000-12-05 05:14:20.000', '2022-02-06 06:35:38.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (833, 'g5dZqzIbdT', '2-1-17 Kaminopporo 1 Jo, Atsubetsu Ward', '正常', '维护', '程璐', 'gBHmWtjf7p', '2018-09-13 21:30:19.000', '2021-08-19 11:42:02.000', '2003-02-12 10:45:19.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (834, 'QMdkFoX89c', '790 Binchuan Rd, Minhang District', '异常', '正常', '贺晓明', '2cbhAEwwpi', '2005-06-19 12:09:26.000', '2007-11-08 16:28:22.000', '2000-02-16 01:10:02.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (835, 'bNrYDh8sL5', '635 Columbia St', '异常', '维护', '田安琪', '9QuC6gwoJt', '2011-08-26 10:29:39.000', '2006-07-10 15:13:21.000', '2014-06-02 17:54:00.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (836, 'AW7Q9F3GBo', '23 Tianhe Road, Tianhe District', '异常', '正常', '魏睿', 'uhho50f7wK', '2023-07-11 12:27:08.000', '2000-07-15 11:54:30.000', '2017-04-06 18:58:52.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (837, 'G2zP27lUsr', '6-1-17, Miyanomori 4 Jō, Chuo Ward', '正常', '正常', '贾宇宁', 'qkSibWqgS4', '2004-09-19 09:40:27.000', '2004-02-09 21:48:23.000', '2018-07-21 17:49:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (838, '9TvyLkCY5t', '236 Qingshuihe 1st Rd, Luohu District', '异常', '异常', '何詩涵', 'ZdlyeJJTDB', '2005-07-02 11:57:45.000', '2014-07-03 19:28:23.000', '2004-08-06 00:41:11.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (839, 'IKkEhuCHlu', '6-1-4, Miyanomori 4 Jō, Chuo Ward', '正常', '维护', '郭子异', '5S5Nx0FMwE', '2015-02-24 11:46:16.000', '2016-07-06 04:09:04.000', '2007-06-09 23:07:43.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (840, 'lMH1tyOR5H', 'No. 452, Shuangqing Rd, Chenghua District', '异常', '正常', '方子韬', 'wsD01BhHmx', '2001-07-24 18:15:42.000', '2014-03-22 11:10:54.000', '2013-05-21 13:54:56.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (841, 'ssyik20eUZ', '950 West Chang\'an Avenue, Xicheng District', '异常', '异常', '常杰宏', '82Yj37Yj4R', '2011-08-21 23:05:33.000', '2002-12-01 08:41:59.000', '2023-05-07 22:06:45.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (842, 'RHmuzXTepK', '947 Tianhe Road, Tianhe District', '维护', '正常', '史杰宏', 'p5G5hBmmZU', '2019-11-08 16:04:38.000', '2015-05-26 03:52:49.000', '2018-06-20 06:23:51.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (843, 'HRkSD1LaUb', '502 Fern Street', '维护', '异常', '龙安琪', 'lLkPZCAXRm', '2010-06-20 03:51:30.000', '2021-07-18 11:08:30.000', '2016-10-03 04:55:38.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (844, 'yNBXAEwS4e', '985 Figueroa Street', '维护', '异常', '郝睿', 'cncukaap9q', '2013-08-23 09:37:39.000', '2009-06-19 02:45:01.000', '2015-01-10 21:12:04.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (845, 'utgCSJzLH1', '20 3-803 Kusunokiajima, Kita Ward', '维护', '异常', '姚云熙', 'i301erBmGb', '2013-01-20 15:44:59.000', '2023-11-20 13:53:40.000', '2015-06-29 04:04:09.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (846, 'byA8lA1tjl', '6 4-20 Kawagishicho, Mizuho Ward', '正常', '异常', '严宇宁', 'Q0b8q5oACH', '2002-08-28 22:27:49.000', '2006-10-14 05:54:15.000', '2005-06-21 10:29:12.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (847, 'hYoJwafeji', '707 Wall Street', '维护', '异常', '江云熙', 'FxqDLhZkjp', '2022-12-01 14:20:10.000', '2007-05-19 08:38:01.000', '2017-09-29 11:49:34.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (848, '535ZT2EFF3', '243 Rush Street', '维护', '正常', '刘致远', 'Octbx7eSYw', '2021-06-24 09:24:41.000', '2019-01-22 15:00:10.000', '2010-09-12 07:14:27.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (849, '7RYu7XahD0', '931 Rush Street', '维护', '正常', '崔致远', 'xiXjYYSSa1', '2023-05-18 08:56:28.000', '2005-01-02 04:43:02.000', '2005-08-14 21:43:21.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (850, 'UxbUFUuKeT', '320 Hanover Street', '正常', '异常', '谭晓明', 'qnCSIf0YRG', '2022-04-29 12:47:24.000', '2012-10-12 14:14:58.000', '2011-08-26 05:01:33.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (851, 'hgFzdrHqEw', '5-2-12 Kikusui 3 Jo, Shiroishi Ward', '异常', '维护', '周震南', 'HLfCqdAXab', '2014-06-03 19:30:58.000', '2000-08-20 19:27:47.000', '2014-06-29 20:31:13.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (852, 'kKRl0hhV13', '2-3-4 Yoyogi, Shibuya-ku', '维护', '维护', '田睿', 'jEOLRgJvHh', '2005-11-08 22:50:34.000', '2004-04-27 10:38:18.000', '2018-04-13 06:42:34.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (853, 'jsei9lhOhk', '24 Kengmei 15th Alley', '异常', '正常', '罗璐', 'iskX8mjegM', '2007-12-10 00:38:57.000', '2014-06-12 17:15:29.000', '2009-11-28 01:56:36.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (854, 'xro8DrzcO8', '759 Osney Mead', '维护', '正常', '程睿', '7Fc3nw3YDf', '2015-10-25 06:26:49.000', '2004-10-06 07:54:20.000', '2013-06-13 00:31:54.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (855, 'JuJEoxd171', '237 Hinckley Rd', '正常', '正常', '叶云熙', 'MCZRX7WbZ2', '2021-03-04 23:20:18.000', '2013-02-09 21:02:20.000', '2014-03-11 21:45:27.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (856, 'nDhXEqe637', '606 Ridgewood Road', '异常', '维护', '陆睿', 'y8mvW2P4Ab', '2000-03-15 10:49:31.000', '2006-06-04 22:31:16.000', '2017-06-07 20:54:58.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (857, 'enYvs7jtOt', '923 39 William IV St, Charing Cross', '正常', '正常', '顾震南', 'wTGQ5Df2Rr', '2001-11-15 21:41:26.000', '2001-05-02 17:35:21.000', '2015-07-01 03:30:39.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (858, 'd18hxgX78x', '1-1-15 Deshiro, Nishinari Ward', '维护', '异常', '许宇宁', 'UljSwZLG8h', '2005-07-13 04:59:49.000', '2003-03-20 11:37:38.000', '2006-09-23 07:35:54.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (859, 'hj80faODGn', '498 Whitehouse Lane, Huntingdon Rd', '正常', '异常', '贾云熙', 'eARGmBVgyF', '2014-10-09 00:36:32.000', '2021-07-10 08:29:16.000', '2017-01-19 12:26:00.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (860, 'qj0gqHWzwl', '797 Papworth Rd, Trumpington', '维护', '维护', '钱安琪', 'OqPSNNFxsB', '2011-07-12 05:02:56.000', '2005-03-16 22:44:19.000', '2005-02-14 11:57:53.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (861, '9FlKSfUp9z', '4-9-14 Kamihigashi, Hirano Ward', '异常', '异常', '陶云熙', 'URw7ftnDaS', '2012-12-11 17:56:58.000', '2018-08-05 21:58:24.000', '2011-06-26 15:17:17.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (862, 'T5V5oC3oqz', '2-1-4 Tenjinnomori, Nishinari Ward', '维护', '异常', '薛晓明', '25q1KXmWQx', '2024-07-20 20:17:35.000', '2022-11-15 05:35:45.000', '2015-03-27 04:02:04.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (863, 'GEg4EdQ2sj', '74 Sanlitun Road, Chaoyang District', '异常', '异常', '薛杰宏', 'UNqSg7Shwu', '2021-09-12 06:47:58.000', '2025-04-05 03:16:56.000', '2017-03-28 03:52:46.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (864, '9de9zpR3Fu', '2-3-19 Yoyogi, Shibuya-ku', '维护', '维护', '严子韬', 'TPzE6mxh26', '2020-05-26 16:35:03.000', '2003-10-30 12:53:24.000', '2002-07-15 20:45:36.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (865, 'galN3HxCOl', '13-3-1 Toyohira 3 Jo, Toyohira Ward', '维护', '维护', '秦璐', '9flXbKvmay', '2021-06-09 17:45:17.000', '2009-12-20 01:41:00.000', '2016-10-23 11:05:01.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (866, 'CFo0c6RV9z', '903 Flatbush Ave', '正常', '维护', '姜致远', 'Vcem4rceB1', '2021-03-30 02:50:07.000', '2015-10-15 11:56:20.000', '2003-02-18 21:14:51.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (867, '7Lj4uFPB7H', '162 East Alley', '维护', '维护', '武詩涵', 'i3NOLbMKF8', '2009-09-16 21:17:36.000', '2003-05-21 07:06:40.000', '2022-05-16 22:48:13.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (868, 'PlLVlNxTm7', '493 Lodge Ln, Toxteth', '维护', '异常', '曹宇宁', 'IPjVJd8bOP', '2021-01-14 02:13:33.000', '2024-05-30 21:45:35.000', '2002-05-30 03:27:31.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (869, 'XGf8A8XcHk', '5-2-15 Higashi Gotanda, Shinagawa-ku ', '维护', '异常', '杨震南', '7zQJispyN7', '2012-01-23 05:41:18.000', '2018-09-18 07:58:50.000', '2017-10-28 23:41:28.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (870, '4IlH5D9uVz', '489 Dong Zhi Men, Dongcheng District', '维护', '正常', '陶岚', 'ipBzt9F1IE', '2020-11-23 02:35:39.000', '2004-11-05 09:23:05.000', '2021-12-31 10:01:04.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (871, 'It7bikjka9', '387 Redfern St', '正常', '正常', '郝杰宏', 'yHT0YDiI3Y', '2017-06-20 02:57:05.000', '2017-03-10 00:25:23.000', '2015-07-09 22:01:37.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (872, 'LR33NAiDfd', '3-19-5 Shimizu, Kita Ward', '异常', '正常', '侯宇宁', 'GOwj25fPWS', '2017-09-17 06:34:56.000', '2014-02-06 12:00:52.000', '2023-08-02 13:27:21.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (873, 'yKW5EPErXC', '500 Wall Street', '异常', '异常', '邵安琪', 'pB7zX2N6or', '2022-02-22 17:51:22.000', '2002-09-23 05:31:51.000', '2000-04-17 17:27:05.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (874, 'AIqvYloAjn', '399 Portland St', '维护', '维护', '侯震南', 'Cyml5QsgyS', '2015-12-13 20:03:01.000', '2020-08-03 20:30:54.000', '2004-05-19 05:32:11.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (875, 'seDeETkia2', '301 New Wakefield St', '维护', '异常', '雷嘉伦', 'HT0zJVdQnB', '2015-07-14 06:28:32.000', '2003-11-29 12:26:56.000', '2004-05-11 04:42:59.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (876, 'fesYlogcJl', '1-7-10 Saidaiji Akodacho', '正常', '维护', '熊睿', 'vuR5b9oArt', '2012-01-17 06:02:16.000', '2014-04-09 03:50:08.000', '2016-02-04 15:53:23.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (877, 'skj6JCa3Fl', '524 68 Qinghe Middle St, Haidian District', '异常', '正常', '程詩涵', 'gQhlQMO5Be', '2019-02-18 07:45:58.000', '2001-07-22 04:15:27.000', '2014-04-28 17:11:22.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (878, 'yiQTUqBE8L', '300 Regent Street', '正常', '正常', '赵致远', 'RFlZYE0Iby', '2010-08-17 21:48:19.000', '2012-11-07 23:24:15.000', '2001-06-04 09:40:17.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (879, 'WkbEc1DA2o', '981 Ganlan Rd, Pudong', '异常', '正常', '汤致远', 'axGEJ87qI6', '2014-02-08 05:49:45.000', '2003-02-02 15:10:50.000', '2008-06-27 01:58:16.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (880, 'HhToegNWM6', '601 Broadway', '正常', '异常', '孔睿', 'A4cSObVXRE', '2004-01-02 17:43:22.000', '2019-08-08 05:14:01.000', '2002-10-06 15:40:41.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (881, 'X9D18WJzVs', '694 Diplomacy Drive', '正常', '正常', '周安琪', 'XImVRbyoi8', '2015-03-11 17:51:37.000', '2014-01-18 02:53:36.000', '2005-10-06 04:42:17.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (882, 'a8YekhAih7', '22 Canal Street', '维护', '正常', '陈安琪', 'VSQpHhDm9L', '2016-01-19 00:15:03.000', '2003-10-19 21:43:58.000', '2008-03-16 05:07:46.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (883, 'bCI0JlazLf', '224 Portland St', '维护', '正常', '林睿', 'WZQ4CPMQSo', '2003-01-06 19:35:04.000', '2003-07-05 17:52:00.000', '2021-06-30 12:48:18.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (884, 'piFankt5sp', '2-3-10 Yoyogi, Shibuya-ku', '维护', '正常', '钱云熙', 'npgQwMLRZB', '2013-11-28 08:03:56.000', '2022-08-13 15:19:18.000', '2003-02-14 16:03:37.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (885, 'njTWafZCTw', '895 Wooster Street', '正常', '维护', '韦震南', 'wxv4JP2ggi', '2006-04-21 03:17:13.000', '2008-01-02 05:16:37.000', '2021-03-20 03:36:18.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (886, 'pj1SFg7k4e', '8 Central Avenue', '异常', '正常', '韩致远', 'Fxow0KI8zj', '2002-12-10 07:10:37.000', '2025-04-14 08:41:38.785', '2025-04-09 16:56:09.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (887, 'TKLvPo9oYU', '82 Tianbei 1st Rd, Luohu District', '维护', '维护', '马杰宏', 'nCXNC3YKbR', '2022-03-26 16:36:37.000', '2004-01-14 22:50:40.000', '2000-06-03 21:56:04.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (888, 'j1BuP6zX2U', '944 Zhongshan 5th Rd, Zimaling Shangquan', '异常', '维护', '韩晓明', 'WFid8ZLLcA', '2011-02-24 14:13:01.000', '2015-07-23 22:25:10.000', '2005-07-28 19:47:15.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (889, 'AwTcLDIQUS', '691 Portland St', '维护', '正常', '雷詩涵', '17m4ehC4sh', '2005-04-16 18:28:04.000', '2000-04-07 17:42:36.000', '2004-03-01 06:56:53.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (890, 'pSMYzCMzWW', '413 Lower Temple Street', '维护', '异常', '薛云熙', '2VKXv2klb9', '2013-06-07 23:14:00.000', '2013-03-16 08:12:06.000', '2017-01-20 13:35:48.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (891, 'iK3D0Kgv1k', '2-1-4 Kaminopporo 1 Jo, Atsubetsu Ward', '维护', '维护', '龚云熙', 'SEqLWhEYIa', '2019-02-13 07:58:18.000', '2011-01-30 01:39:58.000', '2016-06-04 14:44:57.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (892, 'Ia0o9uOJf7', '204 Broadway', '异常', '正常', '李璐', 'vvzRRUX98U', '2018-03-03 12:42:12.000', '2007-10-12 10:30:13.000', '2013-04-15 17:01:44.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (893, 'sBLFI7C6de', '522 North Michigan Ave', '异常', '正常', '顾睿', 'wFRzagQ8nv', '2016-07-20 21:33:33.000', '2004-01-15 07:54:02.000', '2018-09-12 18:53:54.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (894, 'JlaO2Dg6lT', '520 Silver St, Newnham', '正常', '维护', '常嘉伦', 'ZSzkXcQyGQ', '2012-06-27 19:59:34.000', '2021-07-24 16:46:03.000', '2009-12-20 13:54:09.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (895, 'o7JnzfYWz7', '402 State Street', '异常', '维护', '邵子异', 'fp8hnoicpH', '2018-06-17 01:26:32.000', '2004-03-09 20:48:18.000', '2005-06-05 03:23:41.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (896, 'LiGp6XEKwR', '1-1-5 Deshiro, Nishinari Ward', '异常', '维护', '傅璐', 'THVRoZa0IM', '2004-11-08 01:56:13.000', '2014-05-10 13:18:21.000', '2023-11-09 02:31:48.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (897, '0zjw08soKS', '346 Sky Way', '正常', '正常', '江安琪', 'juBREaB3be', '2008-07-07 16:49:14.000', '2018-05-10 20:49:30.000', '2020-09-07 19:14:18.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (898, 'e0YeCxT8B5', '294 Pollen Street', '异常', '维护', '莫詩涵', 'KsIZIsklHv', '2012-01-19 05:42:20.000', '2004-01-30 00:00:12.000', '2002-11-29 00:51:09.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (899, '45RaDFTKif', '4-9-3 Kamihigashi, Hirano Ward', '正常', '维护', '孙睿', 'fiGTw28Hdf', '2004-06-20 04:22:48.000', '2017-08-13 09:16:16.000', '2002-06-30 12:07:01.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (900, 'QGsUYzQ5vM', '5-2-4 Kikusui 3 Jo, Shiroishi Ward', '异常', '正常', '龙詩涵', 'PD291PDij1', '2012-08-26 14:34:56.000', '2011-10-13 14:17:51.000', '2003-09-07 16:21:55.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (901, 'pIFoD37zsj', '852 Jianxiang Rd, Pudong', '异常', '异常', '常杰宏', 'jOctyZbIEZ', '2001-12-07 16:42:31.000', '2014-02-12 17:27:37.000', '2004-05-22 10:38:38.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (902, 'KAHK8pYwky', '125 Xiaoping E Rd, Baiyun ', '异常', '异常', '武秀英', 'IWuM2K2nDx', '2012-02-21 11:44:09.000', '2012-02-09 03:12:17.000', '2002-01-10 16:52:35.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (903, 'gonQQ7lHXZ', '284 Central Avenue', '正常', '维护', '武震南', 'mrn0a2c7PS', '2002-01-26 02:33:41.000', '2008-12-15 16:48:18.000', '2018-12-09 17:53:12.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (904, 'SfajwIg2vv', '2-1-11 Tenjinnomori, Nishinari Ward', '维护', '维护', '常子韬', 'ec27vTedKi', '2004-11-26 10:51:52.000', '2011-03-23 12:07:35.000', '2004-12-30 04:33:36.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (905, 'vAxUr054vZ', '310 Spring Gardens', '正常', '维护', '赵詩涵', 'KqfoGAOP84', '2008-01-03 12:17:20.000', '2011-08-21 21:34:56.000', '2021-10-25 08:46:17.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (906, 'ANkTVohmdS', '894 Wyngate Dr', '正常', '异常', '叶子异', 'Ya7o212ozO', '2008-01-11 15:11:55.000', '2013-05-05 15:05:38.000', '2007-06-14 15:46:17.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (907, 'pUzxwGfpVY', '375 East Cooke Road', '维护', '维护', '段杰宏', 'l09hYoPIhf', '2016-10-04 07:01:37.000', '2003-07-01 02:58:23.000', '2008-10-01 01:59:50.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (908, 'IyaRF2CB7D', '405 The Pavilion, Lammas Field, Driftway', '异常', '异常', '蔡云熙', 'K1XSYMEXOv', '2018-07-17 17:19:35.000', '2003-12-12 00:06:03.000', '2001-12-17 02:42:57.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (909, '7usxsXBFbo', '58 Tremont Road', '维护', '维护', '廖晓明', 'vDMd6dfJ3Q', '2013-11-06 03:17:11.000', '2006-03-25 14:54:13.000', '2013-04-11 07:18:34.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (910, '89QnazxjZ8', '3-27-5 Higashitanabe, Higashisumiyoshi Ward', '维护', '维护', '薛云熙', 'unT46eF855', '2021-09-11 15:55:13.000', '2011-12-03 09:18:30.000', '2017-12-23 20:42:32.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (911, 'NfjiHtSy6A', '911 Zhongshan 5th Rd, Zimaling Shangquan', '异常', '异常', '毛杰宏', 'mCSHbWszVK', '2013-02-07 15:03:13.000', '2025-03-04 18:55:55.000', '2005-08-22 04:30:29.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (912, 'twqoXrHSLR', '728 Tianbei 1st Rd, Luohu District', '异常', '异常', '冯秀英', 'LNB90RhEIN', '2021-03-13 05:26:36.000', '2021-12-27 18:25:54.000', '2008-07-30 20:56:04.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (913, '6UkMyddjSD', '144 West Chang\'an Avenue, Xicheng District', '维护', '维护', '夏宇宁', 'PITPY9jsmw', '2022-05-12 09:58:21.000', '2022-07-22 21:00:32.000', '2012-12-04 21:14:18.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (914, 'caIlhh2LmP', '142 Tremont Road', '维护', '异常', '江璐', 'ilmf6QmUHJ', '2018-07-16 11:50:47.000', '2008-12-03 16:22:34.000', '2001-05-10 09:21:01.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (915, 'B8nwA3g2nr', '14 1-1715 Sekohigashi, Moriyama Ward', '维护', '维护', '沈杰宏', 'sgg4x03rVT', '2020-08-11 07:28:02.000', '2002-02-26 03:07:58.000', '2011-04-22 03:54:38.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (916, 'jtK2G5i9VW', '171 Narborough Rd', '维护', '正常', '韦睿', 'pMcMPAVKou', '2021-02-18 22:21:32.000', '2018-02-13 20:21:42.000', '2001-08-12 22:34:21.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (917, 'bj6SCAE2mL', '386 Bergen St', '异常', '异常', '向嘉伦', 'imqcU2CEKD', '2002-07-27 06:01:23.000', '2018-03-11 13:06:05.000', '2001-12-02 05:18:29.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (918, '9YKti01lBt', '969 East Alley', '正常', '正常', '于安琪', 'yYvSHfkkvw', '2012-05-01 14:51:56.000', '2003-11-23 02:07:01.000', '2004-09-22 11:17:17.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (919, 'mQ0xOhWYi9', '189 West Market Street', '维护', '正常', '范子异', 'JEgC2YAvON', '2017-04-10 11:11:26.000', '2004-03-08 02:25:19.000', '2000-08-03 15:03:52.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (920, 'hcvpKkrXcD', '3-9-20 Gakuenminami', '正常', '异常', '龚子异', 'oJjSYWXH4T', '2023-04-13 22:42:33.000', '2012-10-29 12:43:05.000', '2017-12-09 09:54:38.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (921, '7rAQzUNsi5', '766 Riverview Road', '异常', '维护', '戴云熙', 'Y27z3sMyNM', '2024-05-06 22:25:59.000', '2021-11-15 21:27:38.000', '2007-12-23 23:26:18.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (922, 'bl8FYoAGWd', '249 Bank Street', '维护', '异常', '薛嘉伦', '0mMf3m1DDy', '2011-09-24 22:06:32.000', '2014-06-22 23:00:38.000', '2009-09-29 08:16:50.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (923, 'mjJgQnyFBa', '5-4-12 Kikusui 3 Jo, Shiroishi Ward,', '正常', '维护', '邓致远', 'zVRgaOIqtO', '2005-01-29 04:30:49.000', '2019-02-09 22:23:22.000', '2021-05-27 06:42:34.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (924, 'CoewrQGYLL', '696 Middle Huaihai Road, Huangpu District', '异常', '正常', '许秀英', 'VDRLLsmInd', '2004-04-15 01:28:43.000', '2024-12-05 12:56:44.000', '2014-01-28 06:18:13.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (925, 'hNGJU1kf8d', '307 Middle Huaihai Road, Huangpu District', '正常', '异常', '许嘉伦', '2q65K5ipJr', '2010-02-18 10:58:49.000', '2021-03-05 05:21:22.000', '2018-02-19 08:01:43.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (926, '3Xz4PH8pV3', '824 Hanover Street', '异常', '正常', '张子异', 'aOtW8pFKhD', '2001-02-15 22:19:45.000', '2014-02-18 06:19:17.000', '2015-05-27 05:05:11.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (927, 'DzaXv4b5G6', '334 North Michigan Ave', '异常', '异常', '邵安琪', 'RgEC4wDc4y', '2001-09-24 23:19:24.000', '2011-11-23 20:27:34.000', '2000-03-12 19:08:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (928, 'ZFx8eYKDOt', '5-4-3 Kikusui 3 Jo, Shiroishi Ward,', '异常', '维护', '薛秀英', 'tvgtwsmEEe', '2017-09-01 00:07:33.000', '2021-05-13 05:18:45.000', '2010-12-14 05:47:25.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (929, 'eELMVGyKH6', '377 Zhongshan 5th Rd, Zimaling Shangquan', '正常', '异常', '钱宇宁', 'bAtDBdaAmV', '2000-08-01 08:03:04.000', '2016-04-01 08:15:37.000', '2024-06-09 16:43:57.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (930, 'yexZr4fKTI', '773 Dongtai 5th St', '正常', '正常', '廖璐', 'aG1firMYF0', '2025-01-28 02:36:29.000', '2003-10-29 09:33:11.000', '2002-09-03 09:52:25.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (931, 'yc94yAERYE', '738 Pedway', '维护', '正常', '郭杰宏', 'Lsc9b9qnbW', '2020-12-05 15:09:58.000', '2022-06-26 13:10:18.000', '2015-02-23 00:24:23.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (932, 'dblvcFduEV', '563 East Wangfujing Street, Dongcheng District ', '正常', '维护', '夏晓明', 'n9Fj6gf9DX', '2019-09-16 14:09:13.000', '2003-07-21 22:56:16.000', '2012-09-02 15:45:33.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (933, 'aXkTZPW4pU', '75 East Cooke Road', '正常', '正常', '潘岚', 'phBPzFfMl3', '2005-02-12 00:53:02.000', '2007-06-04 21:04:08.000', '2011-08-27 09:13:07.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (934, 'AdqRUw6eYP', '542 Elms Rd, Botley', '维护', '维护', '金致远', 'LyQZfECmNQ', '2015-10-03 05:46:01.000', '2002-12-23 11:56:10.000', '2005-05-12 12:17:22.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (935, 'rfIVMq7a6O', '1-5-6, Higashi-Shimbashi, Minato-ku', '正常', '异常', '谢杰宏', 'bpo2LF9rzJ', '2001-12-04 08:04:33.000', '2024-10-27 03:19:51.000', '2024-11-18 05:54:54.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (936, 'jHSFEhnoiy', '10 4-20 Kawagishicho, Mizuho Ward', '正常', '正常', '邱嘉伦', 'Q0SDX2SfpL', '2010-03-17 17:15:45.000', '2002-05-10 01:01:59.000', '2022-01-06 23:36:39.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (937, '5ypZp35BfA', '1-6-10, Marunouchi, Chiyoda-ku', '正常', '维护', '徐云熙', 'NzRKIw6ayx', '2023-01-31 23:53:16.000', '2017-12-14 13:29:41.000', '2023-08-11 23:17:07.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (938, 'IeDxyRIl35', '295 Lark Street', '正常', '异常', '韩秀英', 'KC5j7bKNoo', '2010-06-15 22:43:56.000', '2018-05-04 03:05:26.000', '2004-08-22 01:49:21.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (939, 'BgUlOUCBSj', '5-19-4 Shinei 4 Jo, Kiyota Ward', '正常', '正常', '余子韬', 'KIA2TZOLKV', '2004-06-11 13:54:14.000', '2020-04-16 05:07:50.000', '2021-09-26 02:57:27.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (940, 'wZkFD2lpct', '270 Fern Street', '维护', '维护', '谭致远', 'KSQasE1jsy', '2007-09-14 06:42:07.000', '2023-08-18 09:07:47.000', '2023-11-07 19:32:47.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (941, 'KMF5DIn8UO', '953 The Pavilion, Lammas Field, Driftway', '正常', '正常', '袁安琪', 'uCw461oiey', '2009-08-16 09:57:57.000', '2009-08-16 09:19:45.000', '2004-08-10 10:25:55.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (942, 'j8PA5cxEIe', '681 Little Clarendon St', '正常', '正常', '袁宇宁', 'phm9WbrOMD', '2012-12-03 04:07:25.000', '2001-11-06 21:22:22.000', '2004-04-22 13:04:36.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (943, '4kxrwgKxNZ', '819 Park End St', '维护', '正常', '魏子异', 'WvOjWhB64x', '2001-09-23 14:18:01.000', '2001-02-08 03:58:30.000', '2005-02-15 21:13:14.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (944, 'OP11mgoXba', '180 NO.6, YuShuang Road, ChengHua Distric', '维护', '维护', '唐云熙', '7pt0pYgDt5', '2000-09-20 07:10:40.000', '2008-12-17 05:51:32.000', '2021-03-12 01:52:09.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (945, 'b4uuIE5u6n', '587 Pollen Street', '维护', '异常', '袁安琪', 'oPc7wIoMbm', '2011-01-11 02:27:43.000', '2022-01-02 13:30:10.000', '2014-10-28 16:50:33.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (946, 'BQo3UauozT', '765 Shanhu Rd', '正常', '异常', '孙震南', 'XNn2PsHiEK', '2005-07-23 14:18:55.000', '2016-08-27 10:09:45.000', '2001-05-22 15:51:34.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (947, '8Rg610WNjs', '412 Central Avenue', '正常', '正常', '赵詩涵', 'TiSZvzNW77', '2006-02-16 17:13:54.000', '2010-07-07 05:09:37.000', '2004-04-30 21:00:50.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (948, 'ZKkePoIuhC', '552 Nostrand Ave', '维护', '异常', '钟秀英', 'JqUojFpjfY', '2010-01-13 01:24:02.000', '2014-07-13 23:04:57.000', '2017-06-12 19:26:06.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (949, 'lwXMZ6UqSt', '1-7-14 Omido, Higashiosaka', '正常', '异常', '夏岚', 'uClO3xILG1', '2007-12-30 12:08:02.000', '2006-05-22 11:26:01.000', '2005-03-20 08:48:01.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (950, '0Fmgi3LE0B', '59 Trafalgar Square, Charing Cross', '正常', '正常', '毛子异', 'EmCZqCvO1L', '2016-03-14 06:03:41.000', '2010-03-23 18:40:16.000', '2015-04-29 03:23:27.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (951, 'PQc1TDeol5', '13-3-6 Toyohira 3 Jo, Toyohira Ward', '异常', '异常', '蒋安琪', 'mPsIsLJaTa', '2001-04-13 16:07:56.000', '2022-03-11 11:42:47.000', '2001-05-01 00:51:47.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (952, '8HnYZOV6Kw', '117 New Street', '维护', '正常', '董璐', '4ER03UE9Lw', '2011-11-09 22:45:11.000', '2024-08-12 16:26:36.000', '2009-04-27 18:40:59.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (953, 'G5cESRaW1x', '856 Huaxia St, Jinghua Shangquan', '维护', '异常', '邱岚', 'quvulMA7qi', '2008-08-11 15:56:03.000', '2010-10-17 10:07:33.000', '2004-04-03 08:22:15.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (954, 'xf9bZefphX', '267 Regent Street', '正常', '异常', '秦致远', 'HyfxaSG0NR', '2019-07-25 05:22:35.000', '2018-03-12 07:39:30.000', '2019-04-08 17:41:34.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (955, '2JfRt8NTQq', '517 Sackville St', '维护', '正常', '向震南', 'vFK9Pxg3wh', '2025-03-04 19:01:20.000', '2015-11-03 06:11:07.000', '2020-05-24 13:27:25.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (956, 'AN64evTuSh', '532 028 County Rd, Yanqing District', '维护', '维护', '龚嘉伦', 'mGjK7tCi5V', '2007-10-12 21:52:02.000', '2011-09-04 22:41:20.000', '2007-01-05 16:06:21.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (957, 'E7oosyA9o3', '729 Spring Gardens', '正常', '异常', '向詩涵', '4IMYKn1zH8', '2023-09-21 09:58:21.000', '2016-11-18 08:17:03.000', '2024-06-13 05:10:26.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (958, 'wmkbaPXTMn', '5-2-17 Higashi Gotanda, Shinagawa-ku ', '正常', '正常', '潘震南', '3Nhjqt8QAa', '2009-03-08 13:36:30.000', '2020-02-09 12:00:28.000', '2022-11-20 11:24:38.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (959, 'p2pUNl9JLv', '868 Nostrand Ave', '正常', '异常', '何璐', 'nJmH5hBKwV', '2013-12-16 22:51:15.000', '2017-10-04 17:58:16.000', '2024-03-15 05:26:32.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (960, '696nG0QizI', '638 Xiaoping E Rd, Baiyun ', '维护', '正常', '孔安琪', '8UjjfgSTic', '2001-11-27 07:11:55.000', '2022-05-04 15:17:06.000', '2023-01-23 19:23:35.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (961, '8EtD3V8x2D', '178 Jianxiang Rd, Pudong', '维护', '正常', '吴子韬', 'M1BGsTKfgW', '2022-04-07 06:45:31.000', '2016-01-04 00:11:27.000', '2007-02-19 14:22:47.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (962, 'TjtvacyUdf', '134 Osney Mead', '正常', '正常', '田安琪', 'V8LNR8PdiT', '2010-08-24 01:52:05.000', '2016-02-10 13:23:37.000', '2014-07-31 05:45:43.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (963, 'bqrzg88VGq', '632 Wicklow Road', '异常', '维护', '赵云熙', 'uLgame03s4', '2022-11-01 11:27:52.000', '2002-08-25 19:51:17.000', '2003-05-25 16:46:47.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (964, 'v4XSwwUkID', '538 Volac Park, Grantchester Rd', '正常', '异常', '刘子韬', '8quevjiheU', '2008-04-06 04:34:04.000', '2005-01-17 16:54:41.000', '2016-12-13 09:11:20.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (965, 'RgDi9Fhxvz', '6-1-19, Miyanomori 4 Jō, Chuo Ward', '维护', '异常', '丁嘉伦', 'vwymSaRG7m', '2017-06-30 11:27:38.000', '2021-11-08 20:11:06.000', '2021-09-20 16:10:37.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (966, 'zgEl80RpWQ', '13-3-1 Toyohira 3 Jo, Toyohira Ward', '异常', '正常', '阎宇宁', 'yZtNSUMDmU', '2004-08-03 02:46:57.000', '2015-09-19 12:52:05.000', '2024-07-30 11:36:09.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (967, 'hUobTbSaqC', '66 Lefeng 6th Rd', '正常', '异常', '龚岚', 'Vh4vVHCVFC', '2017-11-15 00:39:13.000', '2022-04-15 10:38:37.000', '2017-09-02 01:21:58.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (968, '18CGlE2qPZ', '138 Papworth Rd, Trumpington', '正常', '异常', '黎子韬', 'cbZQuJW6UH', '2000-03-14 12:23:34.000', '2005-01-18 02:20:22.000', '2010-05-13 00:47:34.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (969, 'BVx8Q0NUpX', '291 Broadway', '正常', '维护', '卢云熙', 'VhVCRrHLDy', '2006-08-29 04:53:35.000', '2024-11-30 12:35:52.000', '2022-03-27 00:39:59.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (970, '4C230iMKr9', '3-19-1 Shimizu, Kita Ward', '异常', '异常', '孔詩涵', 'NjaBbGyHgL', '2002-12-09 13:18:22.000', '2019-12-25 08:41:40.000', '2017-05-01 07:02:35.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (972, 'uJ8POZKM3a', '373 Edward Ave, Braunstone Town', '维护', '维护', '郝致远', 'FntjK51dru', '2017-12-15 00:40:04.000', '2016-09-21 11:53:45.000', '2005-02-27 16:41:22.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (973, 'k4JrJz5dsf', '237 Qingshuihe 1st Rd, Luohu District', '正常', '异常', '蒋晓明', 'DQN1F8PAYK', '2022-12-01 06:49:50.000', '2011-10-14 23:34:53.000', '2008-08-15 17:47:14.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (974, 'MFsHwHNCAW', '338 West Chang\'an Avenue, Xicheng District', '正常', '异常', '马秀英', 'zYSWwqjqww', '2019-06-11 21:52:05.000', '2017-07-15 02:38:01.000', '2002-01-01 16:54:08.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (975, 'AQEBl9yEQy', '2-3-7 Yoyogi, Shibuya-ku', '维护', '维护', '任宇宁', '3B2lXHqf3w', '2012-07-04 09:49:02.000', '2010-05-27 11:08:55.000', '2016-09-15 05:21:53.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (976, 'DxN9HWKIBd', '679 Osney Mead', '异常', '维护', '马杰宏', 'uxMjsWlilp', '2001-11-30 13:22:36.000', '2018-07-03 01:05:25.000', '2005-01-26 20:12:32.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (977, '9akeCdcj1F', '939 Rush Street', '正常', '正常', '孔震南', 'KgbJm0ZVIX', '2023-06-01 08:34:33.000', '2011-03-19 23:02:06.000', '2018-09-20 14:08:53.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (978, 'onXgLG1ESQ', '6 1-1715 Sekohigashi, Moriyama Ward', '维护', '正常', '程嘉伦', 'mc3lAJ3iJO', '2009-05-12 03:05:00.000', '2013-02-10 04:07:45.000', '2007-11-11 13:35:42.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (979, 'XRAG2LFqr3', '720 Figueroa Street', '维护', '正常', '姚宇宁', '4HdrNjPHXP', '2013-06-15 14:24:05.000', '2020-06-12 17:06:09.000', '2016-11-20 14:41:12.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (980, '56DH0g4qbR', '1 1-1715 Sekohigashi, Moriyama Ward', '正常', '维护', '钟秀英', 'd8AJLyDLBz', '2015-03-27 18:50:36.000', '2018-08-03 02:05:59.000', '2025-02-23 13:08:01.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (981, 'yqubLJSXbE', '965 Mosley St', '正常', '维护', '杨岚', 'SlGPxo4BGZ', '2022-03-17 20:16:23.000', '2003-12-15 06:19:51.000', '2015-02-20 17:50:34.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (982, '2sHzAVhQSM', '2-1-17 Kaminopporo 1 Jo, Atsubetsu Ward', '维护', '维护', '石杰宏', 'XpiP5mJfuZ', '2020-12-06 05:29:54.000', '2005-10-05 11:52:07.000', '2016-07-26 02:42:04.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (983, 'k5al6KRoKy', '2-3-13 Yoyogi, Shibuya-ku', '维护', '维护', '贺子韬', 'uU6hGlYLNG', '2001-09-03 23:53:00.000', '2021-03-01 11:03:13.000', '2005-05-11 16:46:11.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (984, 'guy63CpYm7', '4 3-803 Kusunokiajima, Kita Ward', '正常', '维护', '夏秀英', 'xdv0TIp3Gf', '2008-04-30 02:46:07.000', '2006-09-05 15:37:03.000', '2013-09-18 20:07:47.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (985, '8uf39HuY1b', '5-4-8 Kikusui 3 Jo, Shiroishi Ward,', '正常', '正常', '任宇宁', 'OwZOMPqlg7', '2005-12-06 18:30:44.000', '2021-06-06 19:36:33.000', '2021-09-11 17:20:41.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (986, 'ECkoNTXcP1', '99 Trafalgar Square, Charing Cross', '维护', '维护', '龙云熙', 'ARRx5JsDnZ', '2005-05-09 04:55:37.000', '2000-08-16 20:13:16.000', '2007-03-04 19:24:32.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (987, '3DGNDUKzX7', '45 Riverview Road', '正常', '异常', '熊詩涵', 'Sz4VlnDidb', '2009-05-31 18:34:50.000', '2013-02-28 12:03:53.000', '2023-09-18 01:08:20.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (988, 'BEciDjGfh0', '68 Tremont Road', '正常', '维护', '张子异', 's0VMWjtftx', '2011-12-29 06:25:51.000', '2023-11-04 22:15:00.000', '2011-03-21 16:49:45.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (989, 'bgnc5rTl6v', '6-1-12, Miyanomori 4 Jō, Chuo Ward', '正常', '异常', '韦致远', 'vrlM8rPpSP', '2021-11-14 01:33:37.000', '2011-05-17 07:42:10.000', '2002-12-12 14:08:04.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (990, 'F01vG6kT7p', '2-1-3 Tenjinnomori, Nishinari Ward', '正常', '正常', '丁詩涵', 'ixYBrvzgfU', '2000-01-09 01:36:51.000', '2012-10-26 02:19:02.000', '2015-07-03 21:03:52.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (991, 'TrQCu2ry8D', '807 2nd Zhongshan Road, Yuexiu District', '异常', '正常', '龚宇宁', '0mfZqeUR8x', '2012-09-13 19:28:41.000', '2015-03-13 10:15:34.000', '2022-11-05 12:02:38.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (992, 'qHsq8lTgv3', '357 Aigburth Rd, Aigburth', '正常', '异常', '崔秀英', 'kABZ5ZAgCT', '2000-09-24 04:57:04.000', '2012-03-30 05:08:26.000', '2018-03-22 18:34:43.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (993, 'cjkc0SubtT', '943 Ganlan Rd, Pudong', '正常', '正常', '董晓明', 'm8hW5X0AGk', '2017-01-11 00:08:01.000', '2021-09-21 09:45:06.000', '2005-02-08 09:49:14.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (994, 'XZqEuq8ew7', '598 Wicklow Road', '正常', '正常', '姚睿', 'CJZoAxyBtf', '2019-08-02 13:16:03.000', '2023-07-05 15:17:03.000', '2013-07-02 09:57:32.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (995, 'HcQuTAt9CO', '16 1-1715 Sekohigashi, Moriyama Ward', '维护', '正常', '王致远', 'PkCSxMDuQW', '2013-03-01 10:44:46.000', '2003-01-06 18:39:35.000', '2012-07-01 13:20:49.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (996, 'aev336WLgV', '752 Shennan Ave, Futian District', '正常', '正常', '丁嘉伦', 'q2u1B3ZDC5', '2025-02-03 00:00:00.000', '2010-12-23 17:47:04.000', '2024-02-03 10:16:23.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (997, 'hvdJM9INJ4', '642 4th Section  Renmin South Road, Jinjiang District', '维护', '维护', '张子韬', 'fxEc3drzac', '2009-12-20 15:44:15.000', '2016-12-27 18:54:49.000', '2019-07-14 14:08:14.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (998, 'nBOhlGEzoO', '509 Central Avenue', '正常', '异常', '贺宇宁', 'JUkRGFLvTD', '2007-11-17 04:37:09.000', '2015-06-02 21:54:18.000', '2003-06-14 00:39:31.000', '正常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (999, 'wErUrIvfae', '111 Jiangnan West Road, Haizhu District', '正常', '异常', '吕詩涵', 'PCJfKx5iUe', '2001-12-01 01:43:55.000', '2008-04-13 11:54:28.000', '2014-04-02 13:39:23.000', '维护', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (1000, '1EUmVBS6mW', '376 East Wangfujing Street, Dongcheng District ', '异常', '正常', '侯云熙', 'gOLAqnHOpB', '2007-06-05 00:16:11.000', '2003-02-08 10:02:49.000', '2024-11-07 06:43:35.000', '异常', 20, NULL, 1);
INSERT INTO `firefighting` VALUES (1001, '13212', '3124124', '正常', '正常', '41241', NULL, '2025-04-14 08:32:48.418', '2025-04-25 06:18:28.432', '2025-04-14 08:32:47.000', '正常', 20, NULL, 1);

-- ----------------------------
-- Table structure for image
-- ----------------------------
DROP TABLE IF EXISTS `image`;
CREATE TABLE `image`  (
  `img_id` int NOT NULL AUTO_INCREMENT,
  `img_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `hash` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_time` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`img_id`) USING BTREE,
  UNIQUE INDEX `image_hash_key`(`hash` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 65 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of image
-- ----------------------------
INSERT INTO `image` VALUES (1, 'https://next.antdv.com/assets/logo.1ef800a8.svg', '123', '2025-04-15 16:03:24.656', '2025-04-15 16:03:22.000');
INSERT INTO `image` VALUES (2, '/assets/微信图片_20250320150833.jpg', '4124', '2025-04-15 16:45:50.753', NULL);
INSERT INTO `image` VALUES (3, '/assets/微信图片_20250320150846.jpg', '12415', '2025-04-15 16:46:00.942', NULL);
INSERT INTO `image` VALUES (4, 'https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp', '51241', '2025-04-15 16:46:07.843', NULL);
INSERT INTO `image` VALUES (59, '/uploads/屏幕截图 2025-03-17 115208 - 副本 (2).1745891432340.png', 'e9faf8ff11361f9cc8fae30478275a0a1f644ff0817ef27f0defa52b820f0895', '2025-04-29 01:50:32.343', '2025-04-29 01:50:32.343');
INSERT INTO `image` VALUES (60, '/uploads/屏幕截图 2025-03-12 165141.1745891652154.png', '9fd0d2bf95facfd8018f9cae16b4f6593657b7ddf6caf2578362ecdfd91b3347', '2025-04-29 01:54:12.155', '2025-04-29 01:54:12.155');
INSERT INTO `image` VALUES (61, '/uploads/屏幕截图 2025-03-17 141303.1745891763440.png', '1e836a4275bf8f74487e364f86d9168e9510bc065b5a485a1ebc3fc0a8050d0d', '2025-04-29 01:56:03.441', '2025-04-29 01:56:03.441');
INSERT INTO `image` VALUES (63, '/uploads/3efc5ce1-b977-40f2-941b-1f8d4d51d18c.1745898286981.90edcf.png', '850a415120a909925ec62641d56dac8ea6ab2edb8920531c62c7b6c46b96e6b1', '2025-04-29 03:44:46.983', '2025-04-29 03:44:46.983');
INSERT INTO `image` VALUES (64, '/uploads/微信图片_20250315094913.1745912571553.0fe7ff.jpg', '844b03df9ea0a2e212df0c187a8a3cf357bece2ebcb59397523e11648b616a49', '2025-04-29 07:42:51.555', '2025-04-29 07:42:51.555');

-- ----------------------------
-- Table structure for investment
-- ----------------------------
DROP TABLE IF EXISTS `investment`;
CREATE TABLE `investment`  (
  `investment_id` int NOT NULL AUTO_INCREMENT,
  `agent_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `intent_level` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `intent_area` int NOT NULL,
  `progress` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(11) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `meeting_time` datetime(3) NOT NULL,
  `remark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `park_id` int NULL DEFAULT NULL,
  PRIMARY KEY (`investment_id`) USING BTREE,
  INDEX `investment_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1004 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of investment
-- ----------------------------
INSERT INTO `investment` VALUES (3, 'Pan Anqi', 'Pan Anqi', '1YPNfLNYwo', 606, '1SSqk5FObj', '14119329589', '2002-12-01 02:38:37.000', 'Ir31zr6gHj', '2012-10-22 06:43:34.000', '2016-12-06 10:52:11.000', 1);
INSERT INTO `investment` VALUES (4, 'Sakamoto Mai', 'Sakamoto Mai', 'ENi8EFSe3z', 601, 'sbbcS3P0YQ', '17639093836', '2015-02-27 02:08:04.000', 'YgJ7KsCIL5', '2012-10-25 19:11:15.000', '2025-01-21 03:20:24.000', 1);
INSERT INTO `investment` VALUES (5, 'Ho Ka Man', 'Ho Ka Man', 'm7VcsYimIL', 244, 'bgdsyKwTA0', '14162518049', '2005-09-01 09:23:49.000', '5ZS5Yi0mza', '2012-06-24 12:31:55.000', '2002-05-03 12:58:26.000', 1);
INSERT INTO `investment` VALUES (6, 'Watanabe Miu', 'Watanabe Miu', 'WK7ctOeUMZ', 292, 'y7HcbrhKwV', '16862420296', '2016-03-06 11:00:32.000', 'vCpJYe5sQ6', '2018-11-13 10:30:04.000', '2008-04-17 01:02:55.000', 1);
INSERT INTO `investment` VALUES (7, 'Yan Lu', 'Yan Lu', 'BDdyp7RHWT', 359, 'irBDPduFgG', '13762615959', '2012-07-12 03:02:53.000', 'sEnlVU0WjG', '2025-04-07 10:40:14.000', '2022-06-27 10:34:41.000', 1);
INSERT INTO `investment` VALUES (8, 'Masuda Momoe', 'Masuda Momoe', 'SAItXJ0cMD', 550, 'U1ZeXQpUdd', '18104708479', '2024-10-08 03:14:38.000', 'puZ9qRaOqS', '2005-02-15 02:11:14.000', '2005-12-01 11:41:28.000', 1);
INSERT INTO `investment` VALUES (9, 'Tanaka Yuito', 'Tanaka Yuito', 'anXWLgXeGu', 325, '01UHgVfhcj', '18482337153', '2010-12-12 15:46:45.000', 'EApbhuiAQY', '2018-07-29 12:32:56.000', '2022-12-29 09:15:33.000', 1);
INSERT INTO `investment` VALUES (10, 'Liao Yun Fat', 'Liao Yun Fat', 'rnygrS2MCJ', 953, 'erLiEkMuF4', '13682341723', '2019-06-01 19:26:35.000', 'nUoQlwW192', '2022-01-25 16:08:08.000', '2003-02-24 14:25:17.000', 1);
INSERT INTO `investment` VALUES (11, 'Xu Lan', 'Xu Lan', 'dFY9aa5vSu', 329, 'Ysb7k1l5e5', '15289604930', '2021-09-30 23:04:25.000', '7ILp1rBjCr', '2003-12-20 14:36:51.000', '2015-11-25 22:05:33.000', 1);
INSERT INTO `investment` VALUES (12, 'Gary Harrison', 'Gary Harrison', 'TS1hUAqGuh', 688, 'xoXyn4Ou4Y', '201764439', '2000-02-23 18:14:08.000', '6dvLz32Bey', '2021-04-03 12:35:04.000', '2022-01-17 02:43:14.000', 1);
INSERT INTO `investment` VALUES (13, 'Kam Yun Fat', 'Kam Yun Fat', '3POq1XBAX9', 510, 's8uG2JPA72', '15203172896', '2009-05-12 03:46:32.000', 'Cmz9LL6bVd', '2015-07-17 06:39:26.000', '2006-08-18 21:34:16.000', 1);
INSERT INTO `investment` VALUES (14, 'Xu Lan', 'Xu Lan', 'ZFbcZQfiJR', 461, 'A7a3CqLo8c', '202188978', '2012-05-24 17:03:11.000', 'WsHmsH4Uze', '2011-04-21 09:09:28.000', '2018-06-12 05:32:27.000', 1);
INSERT INTO `investment` VALUES (15, 'Cheng Lu', 'Cheng Lu', 'BLdzecpmau', 124, 'IdYacoYJ66', '16563940335', '2016-11-02 20:17:07.000', 'flZ1cqCYZH', '2014-07-20 13:40:24.000', '2000-07-06 19:55:15.000', 1);
INSERT INTO `investment` VALUES (16, 'Sean Henderson', 'Sean Henderson', 'RPc8xfZ8q8', 601, 'r4NRFCIrDE', '1096393243', '2000-03-23 19:54:40.000', 'LBVav5bjWh', '2020-05-17 18:47:17.000', '2015-02-12 05:19:36.000', 1);
INSERT INTO `investment` VALUES (17, 'Heung Wing Suen', 'Heung Wing Suen', 'mhARfJvc9C', 804, '2NejvpOLa8', '14663901463', '2023-05-06 13:13:38.000', '9c5gDBa3v1', '2014-01-18 22:05:14.000', '2013-12-21 15:36:15.000', 1);
INSERT INTO `investment` VALUES (18, 'Willie Bell', 'Willie Bell', '1jWlzlNxvx', 850, 'zFdVyqh9GH', '18359546720', '2015-05-08 19:04:26.000', 'KOQvF16JWE', '2000-12-01 12:45:50.000', '2023-10-24 19:40:34.000', 1);
INSERT INTO `investment` VALUES (19, 'Yeow Ka Man', 'Yeow Ka Man', '2xAbSEZW3z', 225, 'In74sGBbx4', '17132934237', '2006-10-27 21:28:55.000', 'wQOBVJMDF1', '2020-06-10 17:09:51.000', '2006-02-12 12:59:45.000', 1);
INSERT INTO `investment` VALUES (20, 'Kwan Suk Yee', 'Kwan Suk Yee', '4vUJbTLXBG', 961, '95gK9u0TMw', '19988719250', '2001-01-31 08:06:37.000', '5VKuIMCDSo', '2020-03-01 20:38:53.000', '2010-04-01 04:59:05.000', 1);
INSERT INTO `investment` VALUES (21, 'Frances Porter', 'Frances Porter', 'YgAXunlGW8', 861, 'x63BXXIqxN', '17616563537', '2011-12-03 10:55:13.000', 'LhdlpHSmg0', '2017-04-14 08:31:57.000', '2019-11-23 03:53:05.000', 1);
INSERT INTO `investment` VALUES (22, 'Sara Rogers', 'Sara Rogers', 'dRbwkHSrXk', 539, 'E0onkvgW7q', '13192316407', '2023-08-02 01:04:29.000', 'OkwzYviXgp', '2017-04-09 23:07:21.000', '2002-09-06 08:12:23.000', 1);
INSERT INTO `investment` VALUES (23, 'Qian Lu', 'Qian Lu', 'SA7NP34IQ2', 926, 'S8oC4kpacN', '18895056277', '2010-10-11 14:42:26.000', 'ciMdmwlCuj', '2005-04-05 05:10:13.000', '2018-03-31 12:30:46.000', 1);
INSERT INTO `investment` VALUES (24, 'Andrew Miller', 'Andrew Miller', '4bE9BtyzMf', 717, 'cZ3kJpHRHi', '7692703336', '2017-02-17 14:19:54.000', 'PaDmyIigjQ', '2012-07-06 18:05:03.000', '2017-12-06 04:07:53.000', 1);
INSERT INTO `investment` VALUES (25, 'Lei Ziyi', 'Lei Ziyi', 'Ur7Y4NHSQl', 963, 'a44S5jVyDg', '280573539', '2002-08-16 23:29:20.000', '1N41EeoW7F', '2001-05-12 04:46:38.000', '2009-05-24 13:41:25.000', 1);
INSERT INTO `investment` VALUES (26, 'Yoshida Eita', 'Yoshida Eita', 'fGMA45Mkva', 804, '3SZAi6qI7V', '212750507', '2015-05-01 02:28:49.000', 'XqiZWmzdTv', '2014-09-28 14:40:33.000', '2006-11-06 08:13:27.000', 1);
INSERT INTO `investment` VALUES (27, 'Curtis Moore', 'Curtis Moore', 'XLLE2K3mFv', 620, 'oZscDkO0MO', '76075471493', '2003-03-29 18:24:20.000', 'ujIK7U7kTo', '2008-02-17 19:53:16.000', '2011-04-23 19:43:53.000', 1);
INSERT INTO `investment` VALUES (28, 'Ye Jialun', 'Ye Jialun', 'uZg1rc4Gxa', 639, 'N4guU9A95I', '14224631565', '2007-03-12 19:41:11.000', '45hC1mhdUQ', '2015-03-12 22:10:52.000', '2003-08-29 12:59:50.000', 1);
INSERT INTO `investment` VALUES (29, 'Vincent Morgan', 'Vincent Morgan', 'jjLUGSzrQo', 312, 'IzGa4yzzCF', '17283315195', '2022-09-22 07:38:11.000', 'MCsLpqlcMs', '2016-11-02 15:00:28.000', '2007-09-18 03:56:57.000', 1);
INSERT INTO `investment` VALUES (30, 'Cho On Na', 'Cho On Na', 'lGhWX5tvNR', 762, 'DK5rIE6VzJ', '1067928767', '2006-04-26 01:55:57.000', '3RxdGZ4bTR', '2018-11-04 02:06:04.000', '2020-02-16 10:29:21.000', 1);
INSERT INTO `investment` VALUES (31, 'Kam Wing Sze', 'Kam Wing Sze', 'wzLNFnMPMB', 567, 'ahsOv0R5nk', '13866472513', '2009-08-29 08:44:04.000', 'BfTf2j2e7K', '2024-07-13 23:31:22.000', '2005-12-01 17:25:03.000', 1);
INSERT INTO `investment` VALUES (32, 'Inoue Ryota', 'Inoue Ryota', 'ViDaAbiWRI', 327, 'OA6cN6Aywg', '280556171', '2007-03-02 10:25:29.000', 'QjwGWnAoK0', '2016-07-19 18:33:47.000', '2018-05-04 23:07:23.000', 1);
INSERT INTO `investment` VALUES (33, 'Mori Hana', 'Mori Hana', 'F9M3xfeRO5', 169, 'Lo74iWgI2a', '1035817539', '2020-09-22 23:22:37.000', 'fcrTT76ZqM', '2004-10-28 03:53:34.000', '2005-12-09 16:02:02.000', 1);
INSERT INTO `investment` VALUES (34, 'Yeow Wing Sze', 'Yeow Wing Sze', 'x9vdkkmtTo', 429, '9rN7QNAgnO', '18324481843', '2003-03-04 12:52:17.000', 'peVT7hevxc', '2004-02-12 12:58:04.000', '2024-01-13 03:17:42.000', 1);
INSERT INTO `investment` VALUES (35, 'Nishimura Yota', 'Nishimura Yota', 'tUJcyGsTYk', 609, 'mg01encfi1', '17841167261', '2004-07-05 09:54:16.000', 'roD3it1VWo', '2016-08-11 16:32:26.000', '2009-01-31 13:23:41.000', 1);
INSERT INTO `investment` VALUES (36, 'Cai Zhennan', 'Cai Zhennan', 'VgPBT7urHT', 259, 'TQ3NCQRIwZ', '2163986086', '2021-08-24 13:59:45.000', '6Jp0ouNr6f', '2000-03-28 15:59:19.000', '2003-12-07 04:05:31.000', 1);
INSERT INTO `investment` VALUES (37, 'Raymond Davis', 'Raymond Davis', 'L3Y91SBRzz', 7, 'bJcFqe908X', '14306787028', '2004-07-15 00:21:59.000', 'yOMEM7OJQA', '2003-07-29 22:51:07.000', '2015-03-07 07:50:16.000', 1);
INSERT INTO `investment` VALUES (38, 'Zeng Ziyi', 'Zeng Ziyi', 'MgJOR9BvN0', 377, 'vd5ijPntct', '2846339079', '2010-08-18 04:56:18.000', 'QmkSp9Yfsq', '2022-05-29 07:54:49.000', '2013-07-10 17:22:16.000', 1);
INSERT INTO `investment` VALUES (39, 'Joanne Kelley', 'Joanne Kelley', 'Dalfw4odCp', 906, '90nDr9tpT3', '76933378907', '2019-11-18 19:17:48.000', 'zl4Db5J2m8', '2013-07-22 14:59:10.000', '2002-07-21 06:54:59.000', 1);
INSERT INTO `investment` VALUES (40, 'Margaret Patterson', 'Margaret Patterson', 'KaqVe9zQ8m', 623, 'jllwGFJO2j', '17134933726', '2004-10-17 13:23:43.000', 'Cwljl3U6Ky', '2017-04-14 19:36:37.000', '2015-11-14 00:34:58.000', 1);
INSERT INTO `investment` VALUES (41, 'Adam Alexander', 'Adam Alexander', 'YPvxfZb9Hh', 792, 'LI7timKlq7', '76071475020', '2023-03-09 09:51:24.000', 'hBL2JupJAh', '2017-06-16 21:05:18.000', '2016-02-08 10:32:59.000', 1);
INSERT INTO `investment` VALUES (42, 'Frederick Gordon', 'Frederick Gordon', '93hXNWEeHK', 297, 'CLFLHq7kRb', '76923664850', '2015-08-10 15:42:08.000', 'EZYu2UybdP', '2010-03-08 06:34:09.000', '2018-08-27 13:36:27.000', 1);
INSERT INTO `investment` VALUES (43, 'Song Anqi', 'Song Anqi', '0rJ99M1MzQ', 283, 'HU5f8cVLbw', '17131434751', '2021-05-28 18:00:51.000', 'fvYqOGMvyS', '2020-01-29 01:26:59.000', '2020-02-09 22:56:50.000', 1);
INSERT INTO `investment` VALUES (44, 'Yuen Ka Fai', 'Yuen Ka Fai', 'jg7AiHo6Es', 406, 'zoEWC3CBQJ', '14536317483', '2004-05-31 07:03:08.000', 'Gpj16jMxqv', '2011-02-14 05:21:31.000', '2017-08-03 17:38:25.000', 1);
INSERT INTO `investment` VALUES (45, 'Wong Ka Fai', 'Wong Ka Fai', 'il3ybCWOGO', 556, '4wvGin85Mj', '17378070618', '2002-12-03 22:13:38.000', 'ngmWv0RcnZ', '2004-07-07 21:14:36.000', '2010-01-23 16:04:30.000', 1);
INSERT INTO `investment` VALUES (46, 'Ishikawa Kenta', 'Ishikawa Kenta', 'MaMbssKNMd', 284, 'U1Me864ifu', '75513211928', '2011-01-07 03:02:16.000', '0BFpsjqMd4', '2009-09-05 22:11:56.000', '2020-12-16 13:01:57.000', 1);
INSERT INTO `investment` VALUES (47, 'Xiong Xiuying', 'Xiong Xiuying', 'naYmFw3hJW', 410, 'blRwxLFbhb', '18209266232', '2000-10-27 00:41:59.000', 'bPp4vPEOMR', '2021-08-25 11:51:03.000', '2018-01-17 03:17:47.000', 1);
INSERT INTO `investment` VALUES (48, 'Shao Lan', 'Shao Lan', 'XtmKfvMCPQ', 626, 'lQ2sE34Grc', '7601404321', '2017-10-24 08:25:25.000', 'xZx6zDam90', '2013-04-23 04:41:30.000', '2016-03-02 04:37:46.000', 1);
INSERT INTO `investment` VALUES (49, 'Wei Ziyi', 'Wei Ziyi', 'BOIwFhERSX', 10, 'DU2c7mgVOZ', '1095142356', '2017-05-10 04:19:42.000', 'YXA4anJh9J', '2010-05-29 03:12:36.000', '2022-03-01 03:26:41.000', 1);
INSERT INTO `investment` VALUES (50, 'Mo Wai San', 'Mo Wai San', '3EaJBZyChi', 705, 'gHcCV0gNy8', '13961636634', '2001-08-29 01:13:03.000', 'n4O57iKBep', '2005-11-04 17:53:36.000', '2007-06-27 01:33:37.000', 1);
INSERT INTO `investment` VALUES (51, 'Yang Yuning', 'Yang Yuning', '9U2RwUFh1x', 834, 'y0m7Tgnr4I', '17672956400', '2013-10-15 14:25:29.000', 'b6YRmbZkQD', '2019-08-22 00:45:54.000', '2016-06-29 06:39:07.000', 1);
INSERT INTO `investment` VALUES (52, 'Ti Sze Kwan', 'Ti Sze Kwan', 'HRC70qql2q', 701, 'yDGA64Sx8L', '19149880341', '2020-07-12 11:28:57.000', 'y2glyGbvD2', '2020-07-08 21:27:29.000', '2015-05-23 15:28:48.000', 1);
INSERT INTO `investment` VALUES (53, 'Kudo Sakura', 'Kudo Sakura', 'ZFmqPKTp21', 952, 'OfuyHG8CCT', '13827130846', '2020-07-03 00:54:39.000', 'a8aKygFUjG', '2008-05-18 00:57:16.000', '2007-11-16 18:34:55.000', 1);
INSERT INTO `investment` VALUES (54, 'Kondo Minato', 'Kondo Minato', 'ZwTXXaHdoP', 788, '61Ob3vGzWK', '2883911785', '2001-09-04 22:18:16.000', 'M1jhxrXn4m', '2019-05-01 01:36:04.000', '2001-05-02 06:07:33.000', 1);
INSERT INTO `investment` VALUES (55, 'Xu Zhiyuan', 'Xu Zhiyuan', 'cqG6BGyvjC', 260, 'K8WjKARs6I', '16874462567', '2002-03-03 22:21:35.000', 'jal53Z0fCs', '2023-04-06 04:18:33.000', '2006-01-07 04:33:30.000', 1);
INSERT INTO `investment` VALUES (56, 'Fukuda Yuto', 'Fukuda Yuto', 'ozrGwGh35d', 763, 'x23j3VinZR', '19031988262', '2018-05-12 11:01:34.000', 'JG6JwVCf6z', '2019-04-30 07:33:42.000', '2015-12-24 20:09:30.000', 1);
INSERT INTO `investment` VALUES (57, 'Koo Hok Yau', 'Koo Hok Yau', '2oXT4obgpk', 661, 'n5MvmRyJUL', '1004674184', '2017-03-05 01:49:24.000', 'Wg7twiP6WZ', '2020-11-20 10:43:02.000', '2018-03-25 13:42:38.000', 1);
INSERT INTO `investment` VALUES (58, 'Monica Kim', 'Monica Kim', 'wfYzv2Te2k', 892, 'HHrxIOIgEx', '76901785878', '2011-04-23 16:01:45.000', 'XAiI77WrHr', '2019-07-26 12:26:45.000', '2020-04-03 14:51:00.000', 1);
INSERT INTO `investment` VALUES (59, 'Koo Wai San', 'Koo Wai San', 'JnY3T0Sm0J', 225, '5ocIOrg8x8', '76048470700', '2021-09-04 21:31:31.000', 'lVPZkQUwDQ', '2014-03-03 17:34:23.000', '2023-11-24 17:17:41.000', 1);
INSERT INTO `investment` VALUES (60, 'Okada Hikari', 'Okada Hikari', 'leOS41U2Um', 644, 'e8jbpjLrBv', '2181570144', '2002-01-18 16:42:01.000', 'FdiDjudGqk', '2008-05-22 22:56:46.000', '2012-12-02 17:06:18.000', 1);
INSERT INTO `investment` VALUES (61, 'Jia Lan', 'Jia Lan', 'wL3jW7ohq8', 664, 'dHCKtODV7M', '105992578', '2013-09-08 20:16:49.000', 'OxOM3BPt0u', '2002-09-16 23:13:37.000', '2007-06-25 15:48:14.000', 1);
INSERT INTO `investment` VALUES (62, 'Nicholas Crawford', 'Nicholas Crawford', '3ul4ulW1sv', 702, '0hFs0QDM89', '15245789566', '2011-10-04 21:54:57.000', 'fMy3ty64Lq', '2017-01-10 22:31:26.000', '2005-02-01 10:48:09.000', 1);
INSERT INTO `investment` VALUES (63, 'Hara Nanami', 'Hara Nanami', 'dKQ6C1nQIW', 660, 'RImR0UaDsM', '16045602647', '2018-04-13 15:09:40.000', 'ZhWltP9dnR', '2013-11-26 23:50:55.000', '2013-01-01 20:08:57.000', 1);
INSERT INTO `investment` VALUES (64, 'Kono Seiko', 'Kono Seiko', 'jkevHTbBR6', 973, 'H01xCBn7Nl', '13691784176', '2018-01-21 19:28:44.000', 'wXe6AtlATF', '2014-09-07 11:30:01.000', '2008-11-17 16:57:07.000', 1);
INSERT INTO `investment` VALUES (65, 'Miu Wing Sze', 'Miu Wing Sze', '61RJnIPEBE', 696, 'jLGXaZqKP5', '76967251960', '2022-03-14 00:48:50.000', 'TdRtLQsKPO', '2023-05-30 01:48:04.000', '2005-04-08 15:42:47.000', 1);
INSERT INTO `investment` VALUES (66, 'Fung Ching Wan', 'Fung Ching Wan', 'oPj9x6Pvjr', 302, 'BOXQGVbKJ6', '75593140600', '2016-05-09 19:13:35.000', 'HM9cYgsC9h', '2022-11-23 08:32:56.000', '2010-03-17 08:40:39.000', 1);
INSERT INTO `investment` VALUES (67, 'Manuel Hawkins', 'Manuel Hawkins', 'VwTMjBfvWg', 501, 'Lx8Hc29t13', '7608671684', '2018-06-30 05:28:17.000', 'c4CNscUmQc', '2020-08-18 03:26:31.000', '2001-02-24 12:10:35.000', 1);
INSERT INTO `investment` VALUES (68, 'Ichikawa Sakura', 'Ichikawa Sakura', 'e8F3e7Apnb', 502, '5DdtIlnLOR', '17664040397', '2016-10-30 10:43:20.000', 'z6leEG1RJN', '2019-06-16 12:39:17.000', '2001-03-08 21:20:51.000', 1);
INSERT INTO `investment` VALUES (69, 'Johnny Chavez', 'Johnny Chavez', 'vbhd50JY1K', 230, '97ln0LCyfk', '14897216072', '2001-11-11 02:40:28.000', '8dNiSfyjIx', '2016-05-20 09:26:45.000', '2007-05-05 22:39:28.000', 1);
INSERT INTO `investment` VALUES (70, 'Jose Torres', 'Jose Torres', '2si885AjBn', 568, 'WQrrEG5sNx', '14984602017', '2015-08-30 05:43:32.000', 'XkgxgHlC0O', '2011-11-17 20:38:53.000', '2001-01-10 03:49:28.000', 1);
INSERT INTO `investment` VALUES (71, 'Yung Lik Sun', 'Yung Lik Sun', 'bsBFYGjUIU', 297, 'ZKL6vuQYcx', '17414065381', '2022-03-11 06:59:06.000', 'I6IlfLCHXi', '2022-06-08 13:45:22.000', '2014-03-31 02:42:18.000', 1);
INSERT INTO `investment` VALUES (72, 'Grace Gordon', 'Grace Gordon', 'DXIibcItK7', 209, '9y77DAn7HD', '18790175995', '2012-07-15 20:40:20.000', 'tRCD04QxAi', '2022-04-06 15:21:01.000', '2010-12-05 19:45:50.000', 1);
INSERT INTO `investment` VALUES (73, 'Cindy Price', 'Cindy Price', 'ms8GFipnRx', 482, 'vWTDIoenhp', '2192711326', '2023-04-30 09:33:37.000', 'dMW3jLG5SA', '2011-03-26 22:09:32.000', '2011-01-13 17:51:08.000', 1);
INSERT INTO `investment` VALUES (74, 'Theresa Martinez', 'Theresa Martinez', 'ugxnhEsTuP', 514, 'H6a5HbvaAL', '13467830657', '2021-05-19 01:13:33.000', 'vbM212EY0H', '2016-01-14 04:02:12.000', '2012-01-14 01:54:38.000', 1);
INSERT INTO `investment` VALUES (75, 'Lois Hunt', 'Lois Hunt', 'DjtLeGWRZW', 991, '1StabMHaX3', '16049173342', '2016-12-19 17:45:19.000', 'HEAoofDjo8', '2008-10-18 09:35:42.000', '2005-05-06 15:38:08.000', 1);
INSERT INTO `investment` VALUES (76, 'Xie Lu', 'Xie Lu', 'Kb1y0pbz31', 907, 'o4RCQWLbwS', '14072372172', '2013-10-07 02:35:57.000', 'SIyq0OvyGK', '2001-06-25 07:40:33.000', '2016-08-25 04:03:15.000', 1);
INSERT INTO `investment` VALUES (77, 'Harada Nanami', 'Harada Nanami', 'HHhwp7yrjT', 965, '8XM3F98hCI', '14241830882', '2003-08-21 12:38:59.000', 'b5GgBpkt6x', '2016-10-05 12:39:43.000', '2024-04-14 21:22:07.000', 1);
INSERT INTO `investment` VALUES (78, 'Sakamoto Shino', 'Sakamoto Shino', 'owCzUX7xCk', 493, 'beF7qencvJ', '287311764', '2020-10-15 09:14:33.000', 'VDXRswxPvZ', '2011-05-05 04:34:25.000', '2019-01-06 22:04:53.000', 1);
INSERT INTO `investment` VALUES (79, 'Gerald Reyes', 'Gerald Reyes', '1EmK65pK5u', 381, 'PSDWukXFxY', '13379951323', '2005-04-28 15:26:18.000', 'BMWTOV9UWu', '2016-09-22 19:06:45.000', '2000-01-13 01:42:33.000', 1);
INSERT INTO `investment` VALUES (80, 'Shen Xiaoming', 'Shen Xiaoming', 'q3iXAFf0R0', 800, 'Sf9dPgTRo5', '2886476793', '2013-10-13 19:34:05.000', 'bSHp8vLUg2', '2012-09-07 07:09:14.000', '2017-04-01 16:12:06.000', 1);
INSERT INTO `investment` VALUES (81, 'Walter Hawkins', 'Walter Hawkins', 'c2GRlNZ80W', 79, 'HxKO8nd6wN', '15600171005', '2007-11-25 08:50:46.000', 'R6WEJlOQlS', '2013-03-12 15:41:53.000', '2014-10-15 18:26:11.000', 1);
INSERT INTO `investment` VALUES (82, 'Nicole Gray', 'Nicole Gray', 'VQ81sVLyse', 890, '9IbEcERmqr', '15595161042', '2006-03-23 01:44:03.000', 'twl1BJYUVd', '2017-09-29 01:04:21.000', '2022-03-02 05:34:42.000', 1);
INSERT INTO `investment` VALUES (83, 'Koyama Daichi', 'Koyama Daichi', 'IhUuoih1wB', 790, 'rJEw4DYK7F', '19543040001', '2004-09-13 14:50:12.000', 'ZPGAPyMFRY', '2019-02-10 03:06:06.000', '2007-05-13 06:51:17.000', 1);
INSERT INTO `investment` VALUES (84, 'Otsuka Eita', 'Otsuka Eita', 'fhjExezktg', 622, 'wOJDre0IcC', '76956354979', '2023-02-20 03:36:03.000', 'oGnvRj9ih9', '2019-07-26 07:14:55.000', '2011-12-22 17:22:18.000', 1);
INSERT INTO `investment` VALUES (85, 'Gladys Jones', 'Gladys Jones', 'ZErPKAD03C', 440, 'XlxxZsjmcb', '2068010889', '2024-01-13 09:21:48.000', 'wdCddOaKgO', '2000-07-26 15:57:58.000', '2000-04-02 05:51:55.000', 1);
INSERT INTO `investment` VALUES (86, 'Fujiwara Yuto', 'Fujiwara Yuto', '247cKUyva9', 771, 'KDRLAviA5m', '1030290859', '2012-09-16 23:10:08.000', 'omNYQGJ5qC', '2007-09-10 22:45:22.000', '2020-05-11 07:42:44.000', 1);
INSERT INTO `investment` VALUES (87, 'Lok Wing Fat', 'Lok Wing Fat', 'gcOOMOxEpC', 16, 'DDRFEJHLfr', '7698525271', '2006-07-11 03:33:37.000', 'enFcdGsnR8', '2012-10-02 23:19:37.000', '2019-08-21 08:14:15.000', 1);
INSERT INTO `investment` VALUES (88, 'Suzuki Kenta', 'Suzuki Kenta', 'nCZcXgXClo', 781, 'alclk85kH8', '19735735361', '2024-07-27 02:01:03.000', 'adCPH4gVAP', '2002-07-06 00:19:24.000', '2019-03-19 08:58:49.000', 1);
INSERT INTO `investment` VALUES (89, 'Shimada Ayato', 'Shimada Ayato', 'ptVRADRiTC', 63, 'GweExKIkeA', '18888446615', '2019-05-26 12:23:20.000', 'y0hNTXc55a', '2018-04-03 20:30:11.000', '2012-05-06 15:34:43.000', 1);
INSERT INTO `investment` VALUES (90, 'Sheila Holmes', 'Sheila Holmes', '8wIpO7EVww', 661, 'OmsK7xYrfH', '76944396714', '2016-01-11 11:46:15.000', 'GzOnSWal7z', '2022-09-16 21:36:23.000', '2020-12-31 12:10:34.000', 1);
INSERT INTO `investment` VALUES (91, 'Alice Perez', 'Alice Perez', '9igL4NyNqR', 838, 'VdN68Gv74m', '2076818698', '2010-07-06 16:25:33.000', 'sPUzEjMdLq', '2020-01-12 03:52:03.000', '2005-02-28 09:39:17.000', 1);
INSERT INTO `investment` VALUES (92, 'Ikeda Hikari', 'Ikeda Hikari', 'RttaskWD45', 221, '3MNAaWzIL3', '7693905949', '2012-05-01 10:16:08.000', 'z7lzg7MxEr', '2005-02-04 18:20:40.000', '2015-04-15 08:16:17.000', 1);
INSERT INTO `investment` VALUES (93, 'Du Jialun', 'Du Jialun', '9D16D6Liji', 267, 'z1f7vITYmn', '2889408095', '2025-03-02 14:41:39.000', 'mEPEjGbeWG', '2020-02-29 20:27:18.000', '2018-10-21 06:05:32.000', 1);
INSERT INTO `investment` VALUES (94, 'Li Ziyi', 'Li Ziyi', '3qsdU9tkd5', 814, 'CZpGD8sWJ2', '13096499664', '2007-07-05 20:44:35.000', 'iWp0q7tKoh', '2024-09-01 10:15:43.000', '2002-02-04 07:06:35.000', 1);
INSERT INTO `investment` VALUES (95, 'Ishikawa Kaito', 'Ishikawa Kaito', 'zbFA5II1mz', 238, '1pJYvC0Nfs', '102817203', '2009-12-05 08:51:06.000', 'TVpsyZYdix', '2016-04-07 13:43:28.000', '2018-08-26 12:23:12.000', 1);
INSERT INTO `investment` VALUES (96, 'Dennis Sanchez', 'Dennis Sanchez', 'UDuSBG1Mi6', 374, 'SQnqHqpJYG', '288722639', '2018-02-14 12:40:02.000', '5s0xSBVhwJ', '2003-06-13 18:48:54.000', '2011-06-09 08:43:44.000', 1);
INSERT INTO `investment` VALUES (97, 'Wu Wing Sze', 'Wu Wing Sze', 'i1fuSPxtKR', 483, '9aeFe9ouvE', '7552490483', '2017-10-10 05:28:56.000', 'LEAjYzPg7d', '2003-10-27 16:33:30.000', '2015-05-02 21:43:58.000', 1);
INSERT INTO `investment` VALUES (98, 'Du Yunxi', 'Du Yunxi', '92D7quwOz2', 494, 'xoO4brFUtS', '15704432631', '2013-02-18 02:05:29.000', 'DbP8JS8jDW', '2008-06-06 19:48:22.000', '2011-08-14 22:52:35.000', 1);
INSERT INTO `investment` VALUES (99, 'Yokoyama Minato', 'Yokoyama Minato', 'AbAFZgz3Jx', 379, 'Z6XbDDDGQ9', '19754798476', '2003-03-23 00:38:49.000', 'XoNTUZK1O0', '2014-01-30 08:35:56.000', '2023-07-06 10:11:52.000', 1);
INSERT INTO `investment` VALUES (100, 'Lam Wai Man', 'Lam Wai Man', 'ZVEGnZE889', 225, 'JNfwRAEaKE', '19968908686', '2013-04-01 09:04:48.000', 'o1SCFmstjE', '2013-04-09 15:28:30.000', '2022-12-25 07:09:30.000', 1);
INSERT INTO `investment` VALUES (101, 'Inoue Momoe', 'Inoue Momoe', 'wLMp7UBF74', 957, 'EZPlerr815', '16583121613', '2016-09-19 18:17:07.000', '5gYsmAxR0G', '2023-07-19 20:13:17.000', '2005-04-23 03:58:31.000', 1);
INSERT INTO `investment` VALUES (102, 'Yan Ziyi', 'Yan Ziyi', 'L6x85bcBAq', 948, 'NXOL4llbZC', '13278653809', '2017-05-01 13:13:35.000', '8sPkwMEucA', '2018-07-12 17:20:16.000', '2018-07-14 18:33:56.000', 1);
INSERT INTO `investment` VALUES (104, 'Lui Chun Yu', 'Lui Chun Yu', 'MlItSdoK4b', 188, 'awXlJbrP6s', '2817256142', '2007-07-14 12:54:28.000', 'TyBuzFqW2O', '2016-09-28 09:00:31.000', '2021-07-31 09:12:22.000', 1);
INSERT INTO `investment` VALUES (105, 'Kono Daisuke', 'Kono Daisuke', 'o0oaDImgad', 826, 'c9iFmc0iQK', '207797674', '2013-02-25 22:57:49.000', '4qe2ZefZg6', '2001-10-12 14:23:13.000', '2008-01-06 20:57:54.000', 1);
INSERT INTO `investment` VALUES (106, 'Koyama Ikki', 'Koyama Ikki', '6dwBleO9yd', 518, 'NSfq9Yfv0G', '13020022657', '2014-05-25 13:43:37.000', 'zbfxHDiUGE', '2018-03-11 08:15:13.000', '2012-06-13 11:24:44.000', 1);
INSERT INTO `investment` VALUES (107, 'Yue On Na', 'Yue On Na', '5MHdYVSd7F', 550, 'CGhGRROL0g', '17990595980', '2017-06-08 03:31:29.000', 'MCbjR08WL0', '2019-05-05 04:15:16.000', '2017-11-27 02:04:49.000', 1);
INSERT INTO `investment` VALUES (108, 'Ernest Ramirez', 'Ernest Ramirez', 'I4PbnGqCTM', 14, 'LNxK4wK95t', '284878339', '2003-10-12 12:13:33.000', 'f3ipwlm6LS', '2024-04-26 09:21:34.000', '2005-07-28 17:15:30.000', 1);
INSERT INTO `investment` VALUES (109, 'Lai Sze Kwan', 'Lai Sze Kwan', 'UTunccRW5L', 576, 'ki4TMYK4fV', '19922450720', '2020-12-26 12:36:30.000', 'cDsypmHiKN', '2005-05-01 03:19:51.000', '2016-09-05 22:42:15.000', 1);
INSERT INTO `investment` VALUES (110, 'Hirano Yuto', 'Hirano Yuto', 'fEvGHzpav5', 869, 'NakPCyb81Y', '16522116166', '2024-06-13 12:18:16.000', 'xwKpYuACYU', '2004-04-30 01:18:53.000', '2001-10-18 16:04:38.000', 1);
INSERT INTO `investment` VALUES (111, 'Nishimura Airi', 'Nishimura Airi', 'D0iTQrncX7', 534, 'ss4t9jgHd9', '14670002488', '2010-04-19 00:55:42.000', 'U7CufQljgL', '2018-01-05 10:38:27.000', '2020-08-04 01:30:19.000', 1);
INSERT INTO `investment` VALUES (112, 'Yuen Wai Man', 'Yuen Wai Man', 'oa5iv3LNFc', 173, 'AnuQ2yapPv', '13286197368', '2022-03-21 19:42:36.000', 'crb5aaNRQ3', '2002-06-21 16:56:14.000', '2007-04-22 04:30:33.000', 1);
INSERT INTO `investment` VALUES (113, 'Lau Ming Sze', 'Lau Ming Sze', 'LxavvAUVdh', 769, 'oULyUZC7Bp', '7692360374', '2020-09-23 15:25:07.000', '9jJes2hVIE', '2010-06-26 22:53:26.000', '2013-07-31 19:27:53.000', 1);
INSERT INTO `investment` VALUES (114, 'Joseph Wood', 'Joseph Wood', '4Mr5EepTCU', 8, 'cGNStsWz3j', '18928337611', '2024-01-05 08:21:19.000', 'sWlSTVkrDe', '2000-05-31 12:11:04.000', '2018-08-14 00:57:14.000', 1);
INSERT INTO `investment` VALUES (115, 'Noguchi Shino', 'Noguchi Shino', 'aXAZSKhAvm', 541, 'ullQCoKCwB', '19764590827', '2020-06-07 02:39:12.000', 'AvaVBuVXI1', '2016-06-11 03:22:56.000', '2019-06-01 19:12:11.000', 1);
INSERT INTO `investment` VALUES (116, 'Wei Zitao', 'Wei Zitao', 'Ycr8KmjAo2', 516, 'jXpPkqxwmA', '14156965989', '2014-11-15 11:07:04.000', 'QbAkoNY8uV', '2022-02-14 00:36:38.000', '2013-12-28 18:06:27.000', 1);
INSERT INTO `investment` VALUES (117, 'Choi Chiu Wai', 'Choi Chiu Wai', 'MZjDAsgTh3', 271, 'Hx18u1TEIZ', '18256183133', '2013-11-02 17:03:04.000', 'uoXI08S3E9', '2024-07-01 22:30:47.000', '2001-01-09 11:46:42.000', 1);
INSERT INTO `investment` VALUES (118, 'Sun Yunxi', 'Sun Yunxi', 'Xma9cSZD3v', 680, 'PbXXcxdBy6', '7695416672', '2013-03-15 12:02:29.000', 'ScYsqgbsNr', '2007-10-26 21:38:09.000', '2017-03-31 09:27:46.000', 1);
INSERT INTO `investment` VALUES (119, 'Todd Alvarez', 'Todd Alvarez', 'qRXfRuO5dB', 507, 'Bbuk07kazJ', '212088273', '2010-09-20 05:18:04.000', 'rOmHcQ2JLj', '2022-02-19 11:52:26.000', '2001-08-07 13:20:52.000', 1);
INSERT INTO `investment` VALUES (120, 'So Kwok Ming', 'So Kwok Ming', 'SaDYOY456d', 950, 'TpgiQThtsp', '14781777793', '2003-12-20 08:37:08.000', 't3lkRNlVal', '2014-07-08 02:09:53.000', '2010-11-13 14:56:30.000', 1);
INSERT INTO `investment` VALUES (121, 'Zhu Lu', 'Zhu Lu', 'FOHJSNTwhM', 840, 'EuWbUhb5RO', '13677716922', '2009-10-23 10:06:34.000', 'KsIZSAHg45', '2000-09-28 13:31:31.000', '2022-12-16 21:51:30.000', 1);
INSERT INTO `investment` VALUES (122, 'Murakami Itsuki', 'Murakami Itsuki', '728wkDkvjv', 747, 'RuR6nSYcQ8', '76942477749', '2002-03-02 23:03:00.000', '4qrEeYPJcN', '2000-02-19 20:17:21.000', '2020-08-19 16:50:00.000', 1);
INSERT INTO `investment` VALUES (123, 'Wei Xiuying', 'Wei Xiuying', 'hKmODEki8C', 29, 'v2XDfxCkxK', '15455121794', '2004-06-26 14:59:05.000', 'qNL50tgTWU', '2003-03-28 23:54:56.000', '2004-08-17 01:24:24.000', 1);
INSERT INTO `investment` VALUES (124, 'Alexander Thomas', 'Alexander Thomas', 'C6Y3oxpYkm', 784, 'l855w4nGtg', '289667787', '2024-09-21 15:52:07.000', 'XrllI3f7zY', '2018-11-21 22:33:42.000', '2010-07-27 06:25:40.000', 1);
INSERT INTO `investment` VALUES (125, 'Sakurai Ayato', 'Sakurai Ayato', 's35aISrNBN', 385, '3x7I6aOyl9', '1033476335', '2012-11-22 03:53:06.000', 'GUXVcCt25r', '2007-03-03 12:17:40.000', '2004-10-15 12:51:28.000', 1);
INSERT INTO `investment` VALUES (126, 'Long Shihan', 'Long Shihan', 'hxe12tiUM0', 313, 'ZC3LdTBoD6', '16007511045', '2019-01-23 19:47:23.000', 'rihBlGj7kI', '2014-07-23 23:28:26.000', '2015-05-16 06:59:05.000', 1);
INSERT INTO `investment` VALUES (127, 'Sean Herrera', 'Sean Herrera', 'XFmbDxPlYo', 848, 'Ccw5RS2HcA', '76920156588', '2018-05-21 15:40:41.000', 'wk5qtKhDYl', '2024-09-02 02:04:43.000', '2022-04-06 05:57:19.000', 1);
INSERT INTO `investment` VALUES (128, 'Yau Kwok Kuen', 'Yau Kwok Kuen', 'nBuqOJDXvT', 372, '9y0LOhZECe', '18367963315', '2009-07-16 12:15:08.000', 'X4RRPZaNYD', '2008-06-07 13:45:30.000', '2002-08-06 18:48:26.000', 1);
INSERT INTO `investment` VALUES (129, 'Duan Zhennan', 'Duan Zhennan', 'KwZiDfllFM', 279, 'Wq20vkL9bJ', '19192856712', '2013-02-15 03:25:55.000', 'u4hQfNTANE', '2012-08-02 06:20:50.000', '2021-09-23 07:38:57.000', 1);
INSERT INTO `investment` VALUES (130, 'Linda Moreno', 'Linda Moreno', 'rr0zioce1T', 327, 'kpCEbz07pU', '203362317', '2017-08-14 00:53:06.000', '3aMyGnp5TM', '2008-08-08 06:41:21.000', '2011-02-13 05:38:27.000', 1);
INSERT INTO `investment` VALUES (131, 'Tse Hui Mei', 'Tse Hui Mei', 'd1r1JgcYCG', 655, 'RMYq4xrfES', '7553113540', '2011-02-28 16:01:12.000', 'gqhnoaEawI', '2013-01-28 18:12:29.000', '2019-02-16 14:09:01.000', 1);
INSERT INTO `investment` VALUES (132, 'Peter Boyd', 'Peter Boyd', 'QAs2TimJiG', 906, 'yS4eDpx5Iz', '7690336221', '2020-03-09 17:36:42.000', 'oXNWuGQutj', '2023-07-11 08:30:55.000', '2022-11-24 10:12:54.000', 1);
INSERT INTO `investment` VALUES (133, 'Yip Kar Yan', 'Yip Kar Yan', '7bLz8FBrRC', 585, 'TlbL9E745A', '19317609185', '2020-12-16 03:59:56.000', 'Rx05EVzrkg', '2013-12-11 18:16:40.000', '2007-10-23 03:36:51.000', 1);
INSERT INTO `investment` VALUES (134, 'Elaine Garza', 'Elaine Garza', 'sulKQVgd1S', 457, 'xGL9emG4Dr', '13810134539', '2012-05-08 22:47:54.000', 'eRdkOOsFCx', '2002-12-06 15:37:22.000', '2001-03-16 20:45:17.000', 1);
INSERT INTO `investment` VALUES (135, 'Kwok On Kay', 'Kwok On Kay', '1us9nwSjXg', 324, 'AaXl5qdYLO', '16221467699', '2003-11-30 13:22:43.000', 'dhLywiKIG3', '2002-06-29 08:42:03.000', '2012-10-25 11:31:47.000', 1);
INSERT INTO `investment` VALUES (136, 'Mori Yamato', 'Mori Yamato', 'jD3WiteCp6', 158, 'q6zZVknDqi', '75599975579', '2005-10-21 12:36:02.000', 'DHZjB13kVf', '2010-06-05 15:44:29.000', '2011-09-05 14:25:54.000', 1);
INSERT INTO `investment` VALUES (137, 'Pak Wai Yee', 'Pak Wai Yee', 'k3f1Kz8Qpw', 544, 'ha4K3T9uV3', '75586952153', '2007-09-05 06:06:25.000', 'HAX64k5h1k', '2000-07-16 00:24:18.000', '2020-03-04 09:18:46.000', 1);
INSERT INTO `investment` VALUES (138, 'Yuen Tsz Hin', 'Yuen Tsz Hin', 'jYU5MU30u2', 722, 'fEKwQq2y4N', '14926055093', '2013-03-09 08:11:51.000', 'UnAiVGRFCV', '2021-07-21 10:17:06.000', '2016-07-19 10:01:15.000', 1);
INSERT INTO `investment` VALUES (139, 'Zheng Anqi', 'Zheng Anqi', 'N3hnIZBfPu', 556, 'QrNtV3ArKY', '14229564886', '2007-04-11 13:06:49.000', 'qEsW2lGn18', '2012-07-09 09:43:22.000', '2012-06-06 06:22:19.000', 1);
INSERT INTO `investment` VALUES (140, 'Kong Rui', 'Kong Rui', 'Rk5LrZT8BH', 270, 'TuHur6d9xD', '210003240', '2015-09-10 03:51:09.000', 'cTGEXnZXfQ', '2010-09-15 07:34:26.000', '2000-08-29 20:22:37.000', 1);
INSERT INTO `investment` VALUES (141, 'Murata Yota', 'Murata Yota', '8jUarBgf8S', 586, '4sMmL6t02P', '75553092318', '2014-05-07 21:40:18.000', 'WndZ44AAw0', '2001-04-18 14:56:58.000', '2020-09-06 00:34:21.000', 1);
INSERT INTO `investment` VALUES (142, 'Emily Simpson', 'Emily Simpson', 'o2m6XOmJp4', 731, '8upsSMJPrf', '18556181895', '2021-08-28 14:44:27.000', 'c3BEYRdvAj', '2019-07-29 22:27:01.000', '2004-06-12 13:59:24.000', 1);
INSERT INTO `investment` VALUES (143, 'Koo Hok Yau', 'Koo Hok Yau', 'fFCkaD9num', 61, 'AI3LGx9Rw9', '17812743599', '2004-10-14 09:13:44.000', 'qH2WAC2RL5', '2023-09-25 23:21:59.000', '2001-12-03 06:34:45.000', 1);
INSERT INTO `investment` VALUES (144, 'Harry Romero', 'Harry Romero', 'SQ3ONUrYS6', 12, 'qR75HUnxUx', '19295371875', '2009-05-16 05:37:29.000', 'o8FMQxuKv9', '2018-06-19 13:19:18.000', '2005-12-27 22:00:58.000', 1);
INSERT INTO `investment` VALUES (145, 'Long Jialun', 'Long Jialun', 'RGdjI0jWfU', 322, '90upBsSy8S', '7557037009', '2023-08-11 14:29:34.000', 'ZcsA3BDNJS', '2024-05-20 02:21:51.000', '2015-12-13 14:26:58.000', 1);
INSERT INTO `investment` VALUES (146, 'Andrea Collins', 'Andrea Collins', 'RWpfOnxbWy', 941, 'beIuG2j4oW', '15242949340', '2017-04-28 19:53:39.000', 'uP7zv1GSKD', '2012-11-29 22:56:00.000', '2011-03-29 09:20:17.000', 1);
INSERT INTO `investment` VALUES (147, 'Kondo Daisuke', 'Kondo Daisuke', 'D6FIzQ0xKO', 382, 'qjGSD4NkCL', '15544398518', '2020-08-28 13:47:41.000', 'h4TUV6Jcv5', '2006-12-05 11:45:45.000', '2017-08-05 22:35:18.000', 1);
INSERT INTO `investment` VALUES (148, 'Wanda Reynolds', 'Wanda Reynolds', '3NDcy77AOY', 606, '3OJGh5QLLZ', '18721854160', '2004-07-08 04:54:58.000', '3MnyQgkijz', '2019-04-19 21:02:19.000', '2010-12-16 07:07:17.000', 1);
INSERT INTO `investment` VALUES (149, 'Wei Lu', 'Wei Lu', 'JwZkt7mQmu', 972, 'nq43PvOaYO', '103048254', '2024-07-27 13:21:46.000', 'AK2ChX84RP', '2012-09-01 10:36:19.000', '2020-03-30 23:41:56.000', 1);
INSERT INTO `investment` VALUES (150, 'Gary Cook', 'Gary Cook', 'gn7lF3r3NI', 556, 'FNNBrkityV', '76948406842', '2010-07-13 14:21:52.000', 'TZSB7TodXG', '2006-06-16 12:52:28.000', '2000-11-22 04:23:06.000', 1);
INSERT INTO `investment` VALUES (151, 'Endo Misaki', 'Endo Misaki', 'F6kF2mSLwM', 775, 'lJei9U0rix', '2825558617', '2002-04-26 09:26:12.000', 'TMBh669C2n', '2003-11-11 09:57:20.000', '2005-02-07 02:12:19.000', 1);
INSERT INTO `investment` VALUES (152, 'Frederick Grant', 'Frederick Grant', 'hkooDLhtub', 380, 'x9nkDCY8yy', '76066694198', '2006-04-04 02:29:25.000', 'pr8XcaGvCr', '2008-06-23 05:36:10.000', '2023-12-13 03:51:21.000', 1);
INSERT INTO `investment` VALUES (153, 'Maeda Mio', 'Maeda Mio', '2hHWwIEPlr', 127, 'eFhGGTb5ob', '17218765828', '2015-08-05 19:45:42.000', '1pZG8b4B7K', '2024-11-20 07:26:43.000', '2017-01-17 07:00:51.000', 1);
INSERT INTO `investment` VALUES (154, 'Ye Yuning', 'Ye Yuning', 'oLxmzEGOM1', 396, 'UMQ8Jlz3rS', '15532630851', '2016-01-22 01:46:36.000', 'GF7Y0AMmUk', '2015-07-18 07:20:58.000', '2017-02-21 22:54:03.000', 1);
INSERT INTO `investment` VALUES (155, 'Roy Hunt', 'Roy Hunt', 'p8BAPTvpTn', 65, 'oHuxPc16rS', '14771708848', '2019-07-07 20:30:03.000', '1Dla05Edr9', '2013-03-08 17:01:54.000', '2015-11-13 08:54:00.000', 1);
INSERT INTO `investment` VALUES (156, 'Tanaka Mai', 'Tanaka Mai', 'QWoGKDEkRw', 881, 'kSiBVRYuKc', '75550177544', '2020-05-04 11:39:58.000', 'UMuEzvGP1N', '2009-04-08 13:11:03.000', '2006-11-29 15:42:13.000', 1);
INSERT INTO `investment` VALUES (157, 'Maria Fisher', 'Maria Fisher', '46YNMaCtTD', 598, 'UPMdV5sxKO', '7552551293', '2015-03-21 16:55:43.000', 'iSFhOQdEP4', '2011-07-10 13:37:51.000', '2013-10-27 01:38:37.000', 1);
INSERT INTO `investment` VALUES (158, 'Yung Ho Yin', 'Yung Ho Yin', 'XmbHX4obsu', 784, 'bdz79CVUuG', '2843476211', '2017-11-06 21:46:34.000', 'O6vuo9CqfY', '2014-02-07 20:18:26.000', '2019-10-17 23:35:16.000', 1);
INSERT INTO `investment` VALUES (159, 'Allen Stone', 'Allen Stone', '3di7VlHE42', 303, 'zlJj59ZjEk', '14514639483', '2017-07-23 14:50:06.000', '1pkVzCPEq6', '2009-04-08 19:44:03.000', '2023-12-27 04:00:01.000', 1);
INSERT INTO `investment` VALUES (160, 'Victoria Perez', 'Victoria Perez', 'lgwUSzNSNa', 556, 'BtZnBYTRsc', '16809669958', '2023-05-28 05:18:01.000', 'JiDvfWAFy8', '2017-12-20 10:46:47.000', '2016-04-02 11:18:15.000', 1);
INSERT INTO `investment` VALUES (161, 'Kojima Rena', 'Kojima Rena', '3FgYV7FBtS', 127, '6SzehuQbcv', '286233040', '2015-03-12 20:08:50.000', 'Vo791aMsus', '2003-07-17 21:02:09.000', '2008-10-30 18:27:04.000', 1);
INSERT INTO `investment` VALUES (162, 'Donna Mendoza', 'Donna Mendoza', '2ws4WnsK9j', 12, 'sFSYf0Mrrr', '2892249553', '2013-02-19 09:02:26.000', 'QKbehNrpkx', '2007-11-18 18:37:28.000', '2005-05-10 13:14:09.000', 1);
INSERT INTO `investment` VALUES (163, 'Lu Rui', 'Lu Rui', 'nqXPWeOpuu', 316, 'd0FLF8gQtn', '2009496627', '2010-07-02 11:20:27.000', 'ZcuZb6SXMc', '2012-01-23 10:03:40.000', '2004-09-25 16:58:13.000', 1);
INSERT INTO `investment` VALUES (164, 'Theresa Price', 'Theresa Price', 'zykdbCNd13', 810, 'ATt5vtYAgX', '19158543632', '2006-02-10 23:32:08.000', 'AJ7uTU39ls', '2001-09-28 10:11:51.000', '2019-02-22 05:31:06.000', 1);
INSERT INTO `investment` VALUES (165, 'Kaneko Daichi', 'Kaneko Daichi', 'LBH1BJUtb1', 975, 'yeg6ZUIFWY', '18234125934', '2018-09-16 15:01:00.000', 'WpFNfvXEX1', '2010-05-10 05:29:33.000', '2005-03-24 18:30:55.000', 1);
INSERT INTO `investment` VALUES (166, 'Robin Bryant', 'Robin Bryant', '8L8hUmaCoM', 669, 'CFbTECi4UE', '1017350207', '2010-12-23 13:02:17.000', '2mECiwfhLm', '2001-02-09 04:32:08.000', '2007-09-28 12:21:59.000', 1);
INSERT INTO `investment` VALUES (167, 'Shimada Kazuma', 'Shimada Kazuma', 'DjCRCL2CyL', 205, 'r6uUaLlyqu', '214714583', '2002-06-24 03:08:31.000', 'DctloTkE0t', '2022-03-20 12:36:16.000', '2021-05-24 06:19:19.000', 1);
INSERT INTO `investment` VALUES (168, 'Mori Miu', 'Mori Miu', 'S8qWs6Famr', 135, 'fvbsNMb5Hm', '7600866743', '2016-01-06 16:26:52.000', '7TtUg8aqKS', '2001-04-25 11:48:46.000', '2018-01-15 12:26:48.000', 1);
INSERT INTO `investment` VALUES (169, 'Kinoshita Nanami', 'Kinoshita Nanami', 'Pw10YhpzGE', 365, '1NF7cubqJj', '200551748', '2018-11-02 11:39:10.000', 'Ln9Maf9Kty', '2022-03-30 14:54:23.000', '2007-02-05 02:33:24.000', 1);
INSERT INTO `investment` VALUES (170, 'Lu Xiuying', 'Lu Xiuying', '5qujGzWdfH', 437, 'r4m9ohw6zt', '7604635600', '2004-08-02 12:33:00.000', 'apMfF7jsbc', '2001-04-09 19:41:11.000', '2015-11-13 09:38:30.000', 1);
INSERT INTO `investment` VALUES (171, 'Marie Woods', 'Marie Woods', 'SBDBtTQJ2Y', 268, 'FCXRbgFFqN', '15333364117', '2007-01-12 23:30:35.000', 'VUstj2NweR', '2003-10-02 18:56:02.000', '2011-03-28 23:27:12.000', 1);
INSERT INTO `investment` VALUES (172, 'Hu Lan', 'Hu Lan', 'Dk9VqVPEFt', 518, 'BW2D07bstI', '7551978857', '2016-01-08 15:12:09.000', 'AyFvM2KE9e', '2004-05-27 15:32:45.000', '2021-09-07 10:44:02.000', 1);
INSERT INTO `investment` VALUES (173, 'Takada Tsubasa', 'Takada Tsubasa', 'WU7H5pvPFv', 616, 'O5IwdUlMgW', '7551905886', '2012-06-29 15:25:26.000', '6AQLylCVuQ', '2015-01-03 07:58:51.000', '2023-12-21 04:20:27.000', 1);
INSERT INTO `investment` VALUES (174, 'Wu Wing Kuen', 'Wu Wing Kuen', 'Ow0xqJqy5i', 170, 'aZkMryyHgy', '1019482250', '2015-04-10 23:51:32.000', 'NCoyTbEY20', '2000-05-21 11:16:27.000', '2009-05-25 15:51:40.000', 1);
INSERT INTO `investment` VALUES (175, 'Danielle White', 'Danielle White', 'E6JSe1zz81', 257, 'GebUmUegoN', '14129779358', '2010-09-18 03:40:36.000', '92q8OXeBAR', '2002-08-03 22:59:54.000', '2013-03-12 07:06:09.000', 1);
INSERT INTO `investment` VALUES (176, 'Jane Cook', 'Jane Cook', 'IwSK3gm3KO', 246, 'UvufFZBFT3', '15594802132', '2022-03-19 18:54:33.000', 'PYLsTGBgna', '2003-12-07 14:43:34.000', '2001-08-07 03:47:33.000', 1);
INSERT INTO `investment` VALUES (177, 'Barry Lopez', 'Barry Lopez', 'zLbLbnklZz', 655, 'CwI6iIqNqm', '18655653920', '2012-02-29 15:53:26.000', '25F2Dlofqj', '2005-05-12 18:18:21.000', '2016-08-09 05:15:52.000', 1);
INSERT INTO `investment` VALUES (178, 'Hou Shihan', 'Hou Shihan', '4sHYBlTI0g', 904, 'OPFRkyMyjy', '13573098647', '2016-12-20 01:10:26.000', 'wYOp1OEFGD', '2013-01-14 01:13:35.000', '2012-12-29 09:23:45.000', 1);
INSERT INTO `investment` VALUES (179, 'Fung Sze Yu', 'Fung Sze Yu', 'mSAQI95tdj', 839, '08LYtHoNBo', '17276860708', '2010-07-20 16:02:10.000', 'xx5MqJhl7C', '2001-04-22 05:23:51.000', '2000-01-03 06:34:50.000', 1);
INSERT INTO `investment` VALUES (180, 'Ren Xiaoming', 'Ren Xiaoming', 'VM9kO6IxBz', 562, 'DQzz27utib', '17871259368', '2002-07-01 18:07:16.000', 'yRJYYjjx5c', '2002-09-04 23:04:39.000', '2007-05-07 15:34:14.000', 1);
INSERT INTO `investment` VALUES (181, 'Nicholas Gardner', 'Nicholas Gardner', 'hTBWIe4MC7', 986, '9kmd4YYJ4b', '16982293099', '2002-02-07 03:43:03.000', 'WRa7EmSbFG', '2007-07-24 11:08:43.000', '2021-11-18 09:56:18.000', 1);
INSERT INTO `investment` VALUES (182, 'Mok Kwok Ming', 'Mok Kwok Ming', 'Zyc7MagGxN', 906, '7Pn7nR2Mep', '7694287373', '2005-05-28 01:31:18.000', '3lg0bAfBiT', '2012-10-29 08:54:36.000', '2005-10-26 06:29:12.000', 1);
INSERT INTO `investment` VALUES (183, 'Chow Fu Shing', 'Chow Fu Shing', '1ykKaah6RP', 702, 'Vuwa5Yp5vf', '216553838', '2006-10-22 07:01:04.000', 'hPgKLm9W9P', '2020-04-19 05:55:30.000', '2007-04-18 22:39:21.000', 1);
INSERT INTO `investment` VALUES (184, 'Shen Jiehong', 'Shen Jiehong', 'ATHyK3csy6', 461, '7UUJYDwmrx', '2175498007', '2015-12-03 06:57:29.000', '9WKdPUxfgH', '2014-10-27 22:21:03.000', '2018-06-23 15:47:20.000', 1);
INSERT INTO `investment` VALUES (185, 'Tang Yuning', 'Tang Yuning', 'OHA8TtLVTt', 310, 'Swt7rhzVhC', '207110359', '2022-03-02 23:19:33.000', 'U8NSsyQYKe', '2011-02-25 00:08:30.000', '2008-08-11 00:24:44.000', 1);
INSERT INTO `investment` VALUES (186, 'Lo Sai Wing', 'Lo Sai Wing', 'YAgtxyY1rz', 156, 'ajaaS9KtDI', '16800314696', '2022-08-04 21:12:21.000', 'IJZeWZwZss', '2012-02-20 22:46:10.000', '2006-08-01 05:50:58.000', 1);
INSERT INTO `investment` VALUES (187, 'Wu Lan', 'Wu Lan', 'snqcolwjYL', 346, 'jyfrtlyCNj', '2892135077', '2016-12-03 10:01:25.000', 'x2eEIaAf8Y', '2003-02-03 03:56:58.000', '2016-01-29 09:40:04.000', 1);
INSERT INTO `investment` VALUES (188, 'Qin Shihan', 'Qin Shihan', 'SwCArYZjVN', 325, 'MzHxX6rgWB', '75509229186', '2018-12-20 13:30:03.000', 'emM9WHATeJ', '2001-12-13 03:19:06.000', '2015-02-03 10:57:13.000', 1);
INSERT INTO `investment` VALUES (189, 'Wong Chi Ming', 'Wong Chi Ming', 'F8IJk7o6p1', 500, 'k2BqOaNfI1', '217576028', '2004-09-09 00:59:24.000', 'VtyxB6xAvk', '2011-04-28 09:55:28.000', '2006-04-17 08:31:46.000', 1);
INSERT INTO `investment` VALUES (190, 'Paul Cole', 'Paul Cole', 'WGINohCqXm', 655, 'BqXiOgn8CQ', '14759147368', '2003-10-05 20:59:36.000', '3UjIMXgm36', '2004-11-20 21:41:04.000', '2010-09-14 07:01:00.000', 1);
INSERT INTO `investment` VALUES (191, 'Sakai Ayano', 'Sakai Ayano', 'siKNzrattg', 778, '0QjlvUo2DX', '2155193851', '2013-05-05 03:55:11.000', 'n5gqgWqbNo', '2019-07-06 06:55:12.000', '2025-03-13 11:57:25.000', 1);
INSERT INTO `investment` VALUES (192, 'Yan Rui', 'Yan Rui', 'y1JPEhvC3J', 650, 'ZNQ0KpwIL2', '16686100113', '2009-11-16 00:28:51.000', 'tAmyoNNAip', '2003-02-13 21:12:11.000', '2012-09-16 04:58:24.000', 1);
INSERT INTO `investment` VALUES (193, 'Choi Siu Wai', 'Choi Siu Wai', 'X5ScW1Xwk9', 706, '246ZmI83jh', '14175551949', '2001-08-24 18:21:58.000', '8gBelhyb8F', '2020-06-04 16:24:55.000', '2005-02-24 06:03:07.000', 1);
INSERT INTO `investment` VALUES (194, 'Xiao Shihan', 'Xiao Shihan', '7ztr28oxgo', 687, 'gGmd8nbnkN', '2833637496', '2000-04-08 02:47:31.000', 'JMd0Zz0sRl', '2024-03-20 12:11:57.000', '2000-01-16 15:24:20.000', 1);
INSERT INTO `investment` VALUES (195, 'Tsui Tin Lok', 'Tsui Tin Lok', 'pxrmZBfGyw', 105, 'jPxTw1A5pg', '7558706900', '2024-11-23 06:40:55.000', 'dj1XewZEyg', '2003-02-17 17:24:22.000', '2015-02-17 03:53:19.000', 1);
INSERT INTO `investment` VALUES (196, 'Morita Kenta', 'Morita Kenta', 'SvuuMXX8Qd', 567, 'BYjfEI5C7D', '19504774171', '2021-12-11 02:06:11.000', 'cW6V0OAwXf', '2019-07-18 15:51:08.000', '2021-09-02 14:00:43.000', 1);
INSERT INTO `investment` VALUES (197, 'He Yuning', 'He Yuning', 'Wiks9yhGpZ', 467, 'u5JHd3sKgl', '18023296051', '2011-11-09 03:58:10.000', 'PMGfHV9DQ8', '2003-09-14 14:20:56.000', '2003-06-24 10:12:03.000', 1);
INSERT INTO `investment` VALUES (198, 'Feng Shihan', 'Feng Shihan', 'Fu8M7qpcCn', 109, 'c53tmsTUJN', '16017903354', '2023-02-23 19:26:19.000', 'WowQnxMpO1', '2005-11-27 20:47:47.000', '2023-01-17 15:29:25.000', 1);
INSERT INTO `investment` VALUES (199, 'Du Lu', 'Du Lu', 'LISAFGFLUl', 178, 'CrUV9uEKaV', '7695477647', '2024-01-15 01:02:29.000', 'wQ0m95uAQp', '2018-07-26 23:32:16.000', '2002-12-21 03:05:52.000', 1);
INSERT INTO `investment` VALUES (200, 'Tsui Fat', 'Tsui Fat', 'hVE5K8T1NI', 987, 'EJ4jWCniKj', '17053577102', '2003-12-30 02:34:54.000', 'qyTu32LIz3', '2020-02-05 18:27:39.000', '2006-12-28 00:12:08.000', 1);
INSERT INTO `investment` VALUES (201, 'Nakamori Hikaru', 'Nakamori Hikaru', 'wXa5icldTh', 747, 'yzb95Mkwq6', '14460858115', '2023-09-06 18:01:22.000', 'kabmQVxIoY', '2013-09-04 13:30:16.000', '2000-01-03 18:33:53.000', 1);
INSERT INTO `investment` VALUES (202, 'Miyazaki Ryota', 'Miyazaki Ryota', '4NQdJ4xaEs', 703, 'vsFxxet94D', '75559245081', '2005-07-20 08:56:22.000', 'IqU3Pd9oFn', '2003-05-13 04:36:57.000', '2021-04-01 03:00:50.000', 1);
INSERT INTO `investment` VALUES (203, 'Wang Rui', 'Wang Rui', 'Hl2mU1AALV', 164, 'P8sLfCcxSS', '17712623215', '2019-04-10 12:56:30.000', '01g1ls73sT', '2019-03-26 03:25:36.000', '2006-08-28 11:23:33.000', 1);
INSERT INTO `investment` VALUES (204, 'Kwong Hiu Tung', 'Kwong Hiu Tung', 'DaMl80rcaF', 849, 'hRC6ivE8p4', '1006800178', '2020-05-19 02:40:02.000', 'VvGbL1ZRcm', '2014-09-15 21:26:02.000', '2021-06-02 08:46:24.000', 1);
INSERT INTO `investment` VALUES (205, 'Sakai Momoe', 'Sakai Momoe', 'dgGWr3M328', 15, 'rR19oJQ9AG', '15203600979', '2023-04-05 22:01:52.000', '6hHvAD55dU', '2015-08-29 15:37:17.000', '2021-08-11 19:31:10.000', 1);
INSERT INTO `investment` VALUES (206, 'Suzuki Rin', 'Suzuki Rin', 'zzixEBHihi', 386, 'EZjkYhWcn1', '76030155543', '2001-01-01 11:25:30.000', '0vlojECQkt', '2020-07-20 17:50:30.000', '2013-10-08 03:33:52.000', 1);
INSERT INTO `investment` VALUES (207, 'Ma Kar Yan', 'Ma Kar Yan', 'xonyPZ1rj6', 734, 'EFZpwzFATB', '15180354555', '2014-08-07 07:58:34.000', 'k70uPBIu4y', '2000-02-21 15:19:10.000', '2012-06-22 13:10:50.000', 1);
INSERT INTO `investment` VALUES (208, 'Lo Chieh Lun', 'Lo Chieh Lun', 'JtU0WbxKDe', 957, 'eH2m33AJqQ', '7696996697', '2008-06-16 10:23:34.000', 'nzaY5KAVyu', '2001-04-10 02:35:47.000', '2011-05-15 02:22:25.000', 1);
INSERT INTO `investment` VALUES (209, 'Heather West', 'Heather West', '8RHhODbQhj', 679, '3cslp2tPdp', '2067536604', '2001-11-21 18:13:44.000', 'VIjurFNDGw', '2017-11-27 00:40:33.000', '2017-09-28 00:01:33.000', 1);
INSERT INTO `investment` VALUES (210, 'Hou Zhiyuan', 'Hou Zhiyuan', 'kABnq85pmB', 225, '2VmjOsZgOu', '14506959720', '2003-01-11 02:03:29.000', 'yerFlcQlqT', '2023-11-09 23:36:17.000', '2013-04-04 07:11:29.000', 1);
INSERT INTO `investment` VALUES (211, 'Kathryn Garza', 'Kathryn Garza', '4MqebbfWl5', 48, 'El7RjKMLFz', '16977451211', '2004-04-28 00:14:24.000', 'zzCnhWgY6c', '2020-01-10 05:44:56.000', '2020-03-29 12:42:18.000', 1);
INSERT INTO `investment` VALUES (212, 'Tse Kwok Ming', 'Tse Kwok Ming', 'xuRY0P30tx', 532, 'IXz7kouglH', '15295027066', '2018-02-28 03:34:17.000', 'BRKZ5d1DsR', '2014-11-18 19:15:11.000', '2005-10-25 17:27:46.000', 1);
INSERT INTO `investment` VALUES (213, 'Meng Rui', 'Meng Rui', '7MpcryZ4Ft', 165, 'ZkLcUFLQjZ', '2112311246', '2020-02-18 07:38:40.000', 'PtMrj6H0eY', '2008-06-28 04:00:05.000', '2006-04-19 11:01:14.000', 1);
INSERT INTO `investment` VALUES (214, 'Qin Zitao', 'Qin Zitao', 'v8U20goXp7', 167, 'CNoaJcHEEW', '2147116528', '2016-07-23 23:10:12.000', 'RjrdDBzCtR', '2000-10-07 17:50:08.000', '2018-03-23 13:32:24.000', 1);
INSERT INTO `investment` VALUES (215, 'Scott Soto', 'Scott Soto', 'ehmk1nrXu7', 103, 'hmNIfT0gvM', '13867401620', '2018-11-02 23:22:56.000', 'ORNhbP4RU8', '2012-11-22 18:10:19.000', '2017-10-07 09:25:15.000', 1);
INSERT INTO `investment` VALUES (216, 'David Sanders', 'David Sanders', 'O6LtAtMFe5', 158, 'iJg0ADGHII', '16577787458', '2018-09-26 08:19:38.000', 'ZwD7NKaNIb', '2007-05-19 09:35:54.000', '2025-01-27 05:58:27.000', 1);
INSERT INTO `investment` VALUES (217, 'Kevin Salazar', 'Kevin Salazar', 'autccgNRfZ', 916, 'UhDHmmmbXV', '17723071320', '2006-05-11 22:43:14.000', 'aKnQnWgLxw', '2004-12-07 19:41:22.000', '2011-11-27 13:47:11.000', 1);
INSERT INTO `investment` VALUES (218, 'Curtis Black', 'Curtis Black', 'iSRa7Nppku', 682, 'neDQUvSVVp', '217931172', '2025-02-07 21:16:59.000', 'bwEPbbPqtb', '2005-07-30 05:43:11.000', '2025-03-10 06:55:02.000', 1);
INSERT INTO `investment` VALUES (219, 'Wong Wing Fat', 'Wong Wing Fat', 'OgrMzrO0sc', 353, 'U3ckogOrcT', '15134960113', '2014-12-25 05:33:43.000', 'A6BzMTowYc', '2004-03-29 16:38:58.000', '2017-09-30 22:10:44.000', 1);
INSERT INTO `investment` VALUES (220, 'Walter Garza', 'Walter Garza', 'wWiQae3LiV', 457, 'VbhdVMkdYH', '76949048477', '2006-06-04 04:46:42.000', '17Kahzj6gs', '2005-01-26 02:50:42.000', '2009-03-08 01:25:42.000', 1);
INSERT INTO `investment` VALUES (221, 'Walter Hicks', 'Walter Hicks', 'kPvd37s5LX', 546, 'v59mEGArPQ', '16125287496', '2011-07-28 12:30:59.000', 'trYzpHSSDl', '2015-06-02 03:35:06.000', '2006-03-31 00:52:30.000', 1);
INSERT INTO `investment` VALUES (222, 'Chiang Ka Keung', 'Chiang Ka Keung', 'Q50ITiRUta', 93, 'KMq2M36R2Z', '19847667349', '2018-02-15 06:52:20.000', 'zE3Il5rFTS', '2020-06-06 00:47:53.000', '2008-02-26 16:27:39.000', 1);
INSERT INTO `investment` VALUES (223, 'Yamashita Daisuke', 'Yamashita Daisuke', 'LFSPpJDCOk', 680, '8RXJWWZ6Ou', '13050320682', '2015-07-10 12:28:01.000', 'QmfR5TTIlJ', '2023-11-26 22:39:43.000', '2022-02-13 18:17:36.000', 1);
INSERT INTO `investment` VALUES (224, 'Clifford Powell', 'Clifford Powell', '1kgUurdENN', 69, '8EM2474B6A', '18540993655', '2017-10-25 01:43:41.000', 'o9NRePbmXx', '2005-08-07 08:54:52.000', '2011-07-05 15:49:14.000', 1);
INSERT INTO `investment` VALUES (225, 'Michael Perry', 'Michael Perry', 'OUixs90zcb', 276, '0DgjWNGzjw', '15253482260', '2011-11-05 11:01:50.000', 'FBeADjuGWT', '2024-08-22 05:20:41.000', '2008-02-26 12:06:39.000', 1);
INSERT INTO `investment` VALUES (226, 'Yin Yunxi', 'Yin Yunxi', 'Xoec9tHgjw', 701, 'akEjT1RsNu', '18963642040', '2022-03-18 14:57:36.000', 'wpa3WmLFl6', '2014-02-15 19:15:43.000', '2003-09-04 22:03:46.000', 1);
INSERT INTO `investment` VALUES (227, 'Fong Cho Yee', 'Fong Cho Yee', 'dtX6kSLYC3', 856, 'Qf6JPNOmAE', '7550789561', '2006-11-10 01:28:51.000', '8N0FKdTjBD', '2007-06-13 19:25:14.000', '2014-04-27 12:07:34.000', 1);
INSERT INTO `investment` VALUES (228, 'Anthony Robinson', 'Anthony Robinson', 'uB5T7t6ZBG', 837, 'vgNlu28e4w', '2806890153', '2009-06-29 00:34:40.000', 'QVmlkaotcG', '2007-09-29 14:27:37.000', '2016-02-29 11:34:41.000', 1);
INSERT INTO `investment` VALUES (229, 'Tong Sai Wing', 'Tong Sai Wing', '8Y98mHLy2Y', 418, 'A1ONrgw8rE', '1014674360', '2017-08-10 20:58:41.000', 'RfQHGMeMPC', '2024-06-21 20:47:40.000', '2014-02-12 22:37:58.000', 1);
INSERT INTO `investment` VALUES (230, 'Adam Evans', 'Adam Evans', 'otVs1a6Ska', 565, 'JHyBhEDC1X', '18305482404', '2019-04-02 00:13:02.000', '2kqBtsA6I4', '2023-11-07 00:04:28.000', '2021-04-20 06:00:01.000', 1);
INSERT INTO `investment` VALUES (231, 'Lee Freeman', 'Lee Freeman', 'VNlLhk7ocw', 131, 'Vrbcru3Gu4', '1081517238', '2020-02-20 11:14:44.000', 'E7p4f90qQT', '2014-06-09 10:25:13.000', '2000-09-27 15:32:02.000', 1);
INSERT INTO `investment` VALUES (232, 'Herbert Edwards', 'Herbert Edwards', 'F1DkJ944zJ', 687, 'X4R1l2jBxj', '13560757409', '2021-09-05 16:19:15.000', 'EUWJ5YHGT8', '2019-01-10 04:48:19.000', '2021-10-24 08:40:03.000', 1);
INSERT INTO `investment` VALUES (233, 'Jacob Silva', 'Jacob Silva', 'qIcG717g3l', 262, '4mldK4w0Ly', '15277586975', '2006-06-09 11:00:50.000', 'eZqjzkJMrd', '2019-10-13 07:01:44.000', '2004-04-16 22:36:03.000', 1);
INSERT INTO `investment` VALUES (234, 'Barry Castro', 'Barry Castro', '4hIAbv1pV6', 464, 'WUK9dSQL1L', '2833480442', '2022-05-22 01:38:38.000', 'LyQSOexfPP', '2015-03-07 12:45:44.000', '2006-11-09 09:53:17.000', 1);
INSERT INTO `investment` VALUES (235, 'Sakai Daichi', 'Sakai Daichi', 'MeiYhspk7v', 817, 'TKF9wRZSKn', '13564532303', '2010-07-09 10:22:47.000', 'fHoGW7GfDd', '2010-06-16 08:22:24.000', '2023-07-06 20:41:19.000', 1);
INSERT INTO `investment` VALUES (236, 'Gladys Dixon', 'Gladys Dixon', '36HrHC5w4n', 792, 'lgLbtWsJhe', '2192465241', '2023-08-30 08:50:40.000', 'azJTciHFao', '2019-10-18 13:23:40.000', '2008-06-05 13:38:28.000', 1);
INSERT INTO `investment` VALUES (237, 'Jiang Anqi', 'Jiang Anqi', 'wHR8gtroXF', 644, '4M6MnChhGp', '2115232989', '2024-05-04 23:45:38.000', 'BPD4WOOm12', '2007-10-30 19:18:20.000', '2013-04-27 22:37:39.000', 1);
INSERT INTO `investment` VALUES (238, 'Stephen Hayes', 'Stephen Hayes', 'zf3UGAA7lB', 787, 'p2BRPW7uE4', '14126642777', '2012-01-19 04:09:14.000', '1KBnGmFSGP', '2016-08-12 21:32:55.000', '2010-01-18 16:18:01.000', 1);
INSERT INTO `investment` VALUES (239, 'He Xiaoming', 'He Xiaoming', 'TjdvPcliPJ', 855, 'vwluX2bdWV', '76902435097', '2010-02-17 12:55:16.000', 'GtXadfwID3', '2001-02-07 21:37:02.000', '2021-03-09 07:06:51.000', 1);
INSERT INTO `investment` VALUES (240, 'Cheng Tsz Ching', 'Cheng Tsz Ching', 'WDsaxNOHKE', 982, 'EhV0CO77hv', '75537424618', '2008-08-14 13:04:57.000', 'JM36z2S25V', '2014-08-23 10:11:25.000', '2001-10-01 01:29:00.000', 1);
INSERT INTO `investment` VALUES (241, 'Yuen Wing Suen', 'Yuen Wing Suen', 'k9HudmB93a', 767, 'LtuapeL8s1', '76043402153', '2018-01-02 00:16:33.000', 'mnuofp5XTX', '2022-12-25 16:15:13.000', '2012-03-21 22:20:43.000', 1);
INSERT INTO `investment` VALUES (242, 'Kimura Kazuma', 'Kimura Kazuma', 'VS1SVAPVxQ', 377, 'MPwkUR9ypk', '214675439', '2013-02-06 07:42:16.000', 'lQvjgNuUsg', '2013-08-29 12:08:19.000', '2014-08-19 05:22:30.000', 1);
INSERT INTO `investment` VALUES (243, 'Zeng Xiuying', 'Zeng Xiuying', '5baSt25KNi', 173, 'eQZHCfE6St', '13500947338', '2024-02-26 04:57:40.000', 'vBAWvNM41m', '2014-12-22 02:01:07.000', '2011-04-10 17:12:09.000', 1);
INSERT INTO `investment` VALUES (244, 'Barbara Harrison', 'Barbara Harrison', 'x8W7xhp7LP', 510, '4fI9q13b55', '202907456', '2019-12-07 07:29:31.000', 'rttGqp55Oa', '2000-05-12 06:46:55.000', '2015-11-12 00:08:16.000', 1);
INSERT INTO `investment` VALUES (245, 'Imai Mitsuki', 'Imai Mitsuki', 'rZWQvcBySi', 964, '39Fqkgv25w', '2159451449', '2006-03-26 09:05:15.000', 'og0acTadZS', '2005-01-17 13:38:37.000', '2020-07-29 10:07:41.000', 1);
INSERT INTO `investment` VALUES (246, 'Nakayama Mitsuki', 'Nakayama Mitsuki', 'bO6p18LSLg', 102, '761POzxWeF', '7694071967', '2024-05-18 06:18:35.000', 'zb73zQFLta', '2004-09-05 16:30:52.000', '2009-06-03 06:32:30.000', 1);
INSERT INTO `investment` VALUES (247, 'Judy Davis', 'Judy Davis', '32U9c7bbwF', 317, 'UeKdF6U1jS', '7694649120', '2025-02-22 04:40:29.000', 'tXiYsGi1zd', '2011-07-07 12:41:20.000', '2005-11-25 11:18:42.000', 1);
INSERT INTO `investment` VALUES (248, 'Dorothy Adams', 'Dorothy Adams', '5DYH9bwBxx', 959, 'mtdlFvA8ne', '17655161983', '2011-07-02 10:06:05.000', 'rlUxUVzy0W', '2002-01-14 06:40:38.000', '2019-10-14 20:33:44.000', 1);
INSERT INTO `investment` VALUES (249, 'Liu Jialun', 'Liu Jialun', 'hE8Ozq2oYL', 889, 'CDCHte11iX', '13934628041', '2000-12-17 08:14:10.000', 'oeFWPVIrsu', '2025-01-06 01:17:29.000', '2023-03-31 07:11:27.000', 1);
INSERT INTO `investment` VALUES (250, 'Sato Minato', 'Sato Minato', 'tjvVH3nD8X', 852, '7F84omeDs2', '76051461023', '2005-08-08 07:18:57.000', 'rlhIYM0nYL', '2001-03-22 18:43:47.000', '2017-09-23 20:29:59.000', 1);
INSERT INTO `investment` VALUES (251, 'Liao Lu', 'Liao Lu', 'HPBSNyAaTf', 872, '5SCV23N3rX', '16848977562', '2016-02-16 07:46:52.000', 'EXKMRjSMSl', '2016-09-20 09:04:43.000', '2012-02-23 23:01:27.000', 1);
INSERT INTO `investment` VALUES (252, 'Miura Takuya', 'Miura Takuya', 'FXmakeQNk1', 30, 'i2FrrKOtpi', '7552571685', '2012-12-25 20:17:57.000', 'sMAz3wy7IW', '2016-02-22 21:56:38.000', '2017-06-10 13:14:58.000', 1);
INSERT INTO `investment` VALUES (253, 'Aoki Eita', 'Aoki Eita', 'XLMBnIKC8F', 396, 'dgJAIkFZWG', '2802951330', '2001-06-09 08:15:03.000', 'C2lF7VeLJc', '2001-04-30 04:47:01.000', '2012-12-21 17:24:30.000', 1);
INSERT INTO `investment` VALUES (254, 'Ikeda Sara', 'Ikeda Sara', 'm58BT44P6o', 195, 'GbvequdVKm', '101311955', '2024-07-28 04:53:06.000', 'dJ6X8tPGIY', '2010-02-13 12:30:20.000', '2024-06-29 21:11:22.000', 1);
INSERT INTO `investment` VALUES (255, 'Yin Lan', 'Yin Lan', 'y1DkBRHm2z', 112, '31ro0Jy7GN', '7693926301', '2004-07-07 04:09:33.000', 'ITKJb8kcOz', '2005-02-25 12:34:07.000', '2017-04-01 00:36:52.000', 1);
INSERT INTO `investment` VALUES (256, 'Yan Zhiyuan', 'Yan Zhiyuan', 'kNdZjYC5ys', 734, 'y4szYYVn4r', '7609434465', '2012-08-16 01:18:04.000', 'N2EvdQ8MG9', '2001-08-12 16:30:52.000', '2017-05-01 11:50:49.000', 1);
INSERT INTO `investment` VALUES (257, 'Tanaka Hikari', 'Tanaka Hikari', '9PypusnVdU', 368, 'Mpq4hT3Z3K', '2171809872', '2003-08-15 03:20:35.000', 'zYOggr6rVd', '2007-03-25 12:50:34.000', '2006-05-19 04:03:54.000', 1);
INSERT INTO `investment` VALUES (258, 'Steven Graham', 'Steven Graham', '1JLSFX8kRX', 358, '6nMG4XAeg6', '2839530882', '2011-03-05 00:35:36.000', 'gXGTZKu74f', '2019-03-20 13:31:19.000', '2001-11-27 14:38:52.000', 1);
INSERT INTO `investment` VALUES (259, 'Yin Sai Wing', 'Yin Sai Wing', 'To8BLtWKJe', 396, '11Hkau8baP', '214725185', '2006-11-12 00:09:01.000', '5mrmFBu3TC', '2009-12-09 19:47:01.000', '2013-05-12 21:38:56.000', 1);
INSERT INTO `investment` VALUES (260, 'Mao Yuning', 'Mao Yuning', 'HVCoeMbKsg', 79, '8v98cFi9ge', '75535650665', '2012-07-26 06:25:53.000', 'N7lIQpmgGa', '2015-07-20 14:21:33.000', '2022-07-13 14:55:13.000', 1);
INSERT INTO `investment` VALUES (261, 'Chang Sze Kwan', 'Chang Sze Kwan', 'YxJ7T0dd01', 254, 'cmlplfNQBe', '105948528', '2003-07-05 21:50:19.000', 'ydYJh3R0cf', '2014-08-15 10:04:50.000', '2013-04-08 03:36:09.000', 1);
INSERT INTO `investment` VALUES (262, 'James Myers', 'James Myers', '8AMRPB4aXg', 927, 'Q1ZEoZwh54', '1020428198', '2019-08-17 23:28:41.000', 'ih8EbMHWyT', '2008-12-25 23:21:08.000', '2013-05-29 14:42:02.000', 1);
INSERT INTO `investment` VALUES (263, 'Saito Daichi', 'Saito Daichi', 'Pojmheht5M', 86, 'km3aAMFf1Q', '76054952044', '2017-01-28 10:34:10.000', 'o5yuqaFkWZ', '2015-06-19 16:08:01.000', '2020-02-21 03:09:24.000', 1);
INSERT INTO `investment` VALUES (264, 'Ann Warren', 'Ann Warren', 'mkUYq3GIV0', 346, 'IzYTbfvv9i', '7600429400', '2001-09-25 09:26:41.000', 'kuHPSI5ePI', '2002-12-24 23:34:23.000', '2020-04-11 23:49:43.000', 1);
INSERT INTO `investment` VALUES (265, 'Qin Ziyi', 'Qin Ziyi', 'qu7NPKhGyI', 78, '65yK1Ltvkq', '15812752245', '2018-04-14 16:57:48.000', 'ckn3AykG2f', '2002-04-22 23:23:54.000', '2002-11-14 10:02:15.000', 1);
INSERT INTO `investment` VALUES (266, 'Takada Kenta', 'Takada Kenta', 'N0praTKu3H', 387, 'OfFJII7lpF', '1047568037', '2003-08-01 10:06:56.000', '8OpPBv9d6J', '2003-09-04 03:05:46.000', '2012-07-11 19:49:22.000', 1);
INSERT INTO `investment` VALUES (267, 'Jin Jialun', 'Jin Jialun', 'EusAkm1Hub', 275, '8EQHCUvDK3', '7601524625', '2022-08-31 02:07:35.000', 'T8zqQlJp3y', '2004-08-24 09:04:14.000', '2006-01-12 02:51:22.000', 1);
INSERT INTO `investment` VALUES (268, 'Shen Yuning', 'Shen Yuning', 'JUVhJbdpBN', 80, 'cCAtuVpIhp', '2065092987', '2001-01-27 06:57:03.000', 'gdXsVsxRv8', '2014-01-04 18:15:16.000', '2012-01-15 23:10:57.000', 1);
INSERT INTO `investment` VALUES (269, 'Miura Ren', 'Miura Ren', '9JQPQEEAHN', 730, 'nUSXqlyAfR', '7556345977', '2020-03-24 16:52:19.000', 'ExAB5oZbK1', '2018-11-01 17:01:16.000', '2013-03-28 11:06:53.000', 1);
INSERT INTO `investment` VALUES (270, 'Kong Wai Man', 'Kong Wai Man', 'DnPBtBbCEd', 10, 'xXKS2mBqQ1', '2822300601', '2010-06-03 19:06:59.000', 'PX2QsimMQ8', '2021-12-21 07:16:54.000', '2007-08-25 23:12:56.000', 1);
INSERT INTO `investment` VALUES (271, 'Okada Riku', 'Okada Riku', '64byZ2Kmq2', 719, 'roH7IWN4nM', '75554647193', '2011-12-02 01:18:52.000', 'KYSivdjZal', '2022-12-15 05:41:52.000', '2012-08-21 17:14:11.000', 1);
INSERT INTO `investment` VALUES (272, 'Xiang Zhennan', 'Xiang Zhennan', '5i20b0d8OW', 340, 'bVSdGdNIJn', '15699151367', '2004-07-23 23:30:14.000', 'o25Rg0IRNy', '2023-10-16 22:25:42.000', '2023-06-08 03:19:17.000', 1);
INSERT INTO `investment` VALUES (273, 'Carlos Bailey', 'Carlos Bailey', 'vifV7ktUhd', 943, 'CbNZ9FxzFv', '7697041233', '2016-03-17 20:52:01.000', 'jfMMvcY5rh', '2008-06-27 17:41:41.000', '2008-10-06 20:09:04.000', 1);
INSERT INTO `investment` VALUES (274, 'Randy Nichols', 'Randy Nichols', 'B3xLBjuvHe', 38, '9nWd1Vy9Gm', '288617848', '2018-06-26 07:01:37.000', 'jPKJ2uiT0c', '2012-09-06 03:10:27.000', '2002-05-06 15:52:14.000', 1);
INSERT INTO `investment` VALUES (275, 'Sakurai Shino', 'Sakurai Shino', '106gOn8p3E', 204, 'JWzfDS8XXF', '7602184334', '2003-02-22 19:03:15.000', 'wxTf2JAe7W', '2001-01-14 23:16:54.000', '2006-09-08 04:27:53.000', 1);
INSERT INTO `investment` VALUES (276, 'Sakamoto Ikki', 'Sakamoto Ikki', 'ZOag8wnZL2', 576, 'IWgRCYn6fy', '208416664', '2017-08-22 08:05:09.000', 'HrAe5pX8z5', '2005-04-24 17:56:01.000', '2015-10-14 09:56:53.000', 1);
INSERT INTO `investment` VALUES (277, 'Dennis Ortiz', 'Dennis Ortiz', 'IlvdxV3Vk1', 139, '0lZZAM9jMA', '76978246750', '2002-05-10 10:59:07.000', '9ebYjxjOkB', '2010-03-22 00:06:43.000', '2019-05-01 07:27:25.000', 1);
INSERT INTO `investment` VALUES (278, 'Ren Rui', 'Ren Rui', 'joSOpeFvi3', 37, 'ke8hHixfOz', '108573716', '2005-06-10 18:32:30.000', 'AU4mBvgxen', '2021-11-02 20:26:53.000', '2000-05-27 20:29:02.000', 1);
INSERT INTO `investment` VALUES (279, 'Che Yun Fat', 'Che Yun Fat', 'DiiaTx8Y8A', 748, 'vFbjc3jsvz', '76914410329', '2018-06-22 08:20:06.000', 'kGYEFCd38V', '2020-02-02 06:14:56.000', '2006-11-21 18:14:42.000', 1);
INSERT INTO `investment` VALUES (280, 'Emma Ramos', 'Emma Ramos', 'mjLxoG6eGp', 235, '7cnqyiOcUu', '19463964042', '2012-11-24 20:38:32.000', 'CpuOruHggr', '2022-09-12 00:49:06.000', '2020-05-25 22:42:44.000', 1);
INSERT INTO `investment` VALUES (281, 'Yan Zhennan', 'Yan Zhennan', 'AhwjzMrdYe', 417, 'sCbwfZ681H', '7602513316', '2003-03-02 07:18:25.000', 'gGiIq3zEUz', '2012-06-23 16:31:36.000', '2004-01-12 20:12:57.000', 1);
INSERT INTO `investment` VALUES (282, 'Saito Kaito', 'Saito Kaito', 'elqOQVnSHQ', 136, 'PBzTS59X5p', '14591448588', '2022-05-17 01:07:13.000', 'vi6xRCtsju', '2021-04-11 10:07:10.000', '2018-06-16 18:24:48.000', 1);
INSERT INTO `investment` VALUES (283, 'Jiang Xiuying', 'Jiang Xiuying', 'vksADWH6oI', 490, 'sxV5AU7AuM', '19795206633', '2024-07-29 22:29:03.000', 'oXlIkheisv', '2021-06-26 11:08:41.000', '2006-09-25 11:01:09.000', 1);
INSERT INTO `investment` VALUES (284, 'Cheryl Rogers', 'Cheryl Rogers', 'eyg98XllvP', 516, 'haimyvH0O6', '2158673125', '2007-03-01 04:10:54.000', 'rj9ifpQD6N', '2012-05-08 01:18:47.000', '2006-11-21 10:56:49.000', 1);
INSERT INTO `investment` VALUES (285, 'Ma Ming Sze', 'Ma Ming Sze', 'IJWWQeHAHM', 797, '2g8CISyzWf', '2821034498', '2018-05-29 15:10:30.000', 'WM1O2NrzFN', '2022-10-02 21:43:49.000', '2005-03-19 03:38:49.000', 1);
INSERT INTO `investment` VALUES (286, 'Carol Fox', 'Carol Fox', 'cwY6R3MTUN', 201, 'kz1ubPmc8o', '205403113', '2006-10-23 21:20:56.000', 'lUXGL5Jp7R', '2008-07-31 05:38:04.000', '2004-10-20 13:42:30.000', 1);
INSERT INTO `investment` VALUES (287, 'Phillip Powell', 'Phillip Powell', 'RgsltpwMhW', 214, 'sJeWMjhMW0', '14282127499', '2015-01-29 09:36:58.000', '2N03Onj8eK', '2006-09-25 11:14:30.000', '2006-12-31 22:31:07.000', 1);
INSERT INTO `investment` VALUES (288, 'Takahashi Itsuki', 'Takahashi Itsuki', 'OhZ8wDtvfh', 507, 'jelAN1HhRh', '14324097458', '2022-11-05 08:01:20.000', 'bFoLfmPe34', '2008-03-03 17:33:47.000', '2023-07-01 09:00:44.000', 1);
INSERT INTO `investment` VALUES (289, 'Kobayashi Yuna', 'Kobayashi Yuna', 'LchMSKJMe4', 228, 'J8U2UKYLWL', '19147549156', '2019-08-02 22:53:35.000', 'olzp9cECIO', '2021-08-21 00:53:43.000', '2021-10-19 16:42:23.000', 1);
INSERT INTO `investment` VALUES (290, 'Wong Ka Ling', 'Wong Ka Ling', 'B0WIPb9U3A', 402, 'fdFtmoowie', '207058338', '2019-04-05 11:48:51.000', 'RCJnEpGPCu', '2020-05-13 14:35:34.000', '2009-08-23 14:17:24.000', 1);
INSERT INTO `investment` VALUES (291, 'Lee Sze Kwan', 'Lee Sze Kwan', 'OZaPzkgQTZ', 627, 'ElqsIJM78a', '76006172595', '2024-11-07 16:17:17.000', 'PKG8vVxGak', '2009-08-08 09:00:15.000', '2019-02-14 09:35:33.000', 1);
INSERT INTO `investment` VALUES (292, 'Ng Yu Ling', 'Ng Yu Ling', 'IADSGdpytv', 753, 'dMA7KIn2lu', '19084530764', '2019-11-10 20:40:17.000', 'Of8ok96UPB', '2024-01-16 21:02:28.000', '2002-06-02 08:56:44.000', 1);
INSERT INTO `investment` VALUES (293, 'Loui Kwok Kuen', 'Loui Kwok Kuen', '9a6vKImxie', 41, 'ddFuqsdgL6', '7692543972', '2008-11-18 23:28:37.000', '6iTtqNHEq3', '2005-02-26 11:06:33.000', '2008-03-16 12:53:14.000', 1);
INSERT INTO `investment` VALUES (294, 'Kono Ayano', 'Kono Ayano', 'pq7GRmiyLE', 665, 'YM60qKaqvS', '18754216951', '2009-03-05 15:20:38.000', 'hzXOseS8Qv', '2021-12-31 00:37:56.000', '2022-11-10 06:33:59.000', 1);
INSERT INTO `investment` VALUES (295, 'Kinoshita Misaki', 'Kinoshita Misaki', 'alQBrzyjeH', 660, 'a6Rfs8UoSW', '18932804086', '2004-02-23 09:55:49.000', 'iPWikg0tC4', '2006-03-14 09:29:34.000', '2021-06-06 23:00:34.000', 1);
INSERT INTO `investment` VALUES (296, 'Paul Bryant', 'Paul Bryant', 'iMHG36zn2G', 423, 'u5is3OEyyZ', '14615465116', '2023-09-28 17:30:38.000', 'WXiLGfQb62', '2014-03-05 16:25:16.000', '2018-01-06 16:44:06.000', 1);
INSERT INTO `investment` VALUES (297, 'Takahashi Kaito', 'Takahashi Kaito', 'wbIawoTRuQ', 212, 'NwVojA7UnL', '19334612755', '2020-03-08 06:08:55.000', 'VpA7NhBEs1', '2005-07-17 06:04:02.000', '2004-08-02 05:57:02.000', 1);
INSERT INTO `investment` VALUES (298, 'Zheng Xiuying', 'Zheng Xiuying', 'WOJHruJFbp', 805, '3tavdNZeQu', '16898409613', '2020-01-28 12:24:45.000', '4DnbbfvWhU', '2018-06-27 02:53:30.000', '2006-03-04 05:22:33.000', 1);
INSERT INTO `investment` VALUES (299, 'Yau On Na', 'Yau On Na', 'lBZ9zea9rt', 332, '6aGFmM9Qui', '76047897160', '2008-07-05 10:27:25.000', 'Mosv8iCK3L', '2021-07-21 10:42:09.000', '2018-01-14 21:38:32.000', 1);
INSERT INTO `investment` VALUES (300, 'Ichikawa Momoe', 'Ichikawa Momoe', 'TFSgUsAY0i', 967, 'XNxMSnn3pC', '19009889047', '2006-05-01 23:01:13.000', '5yRUDPLcFS', '2015-05-18 09:53:34.000', '2010-11-05 05:19:55.000', 1);
INSERT INTO `investment` VALUES (301, 'Nomura Ayato', 'Nomura Ayato', 'ICWgzSprUV', 151, 'LmscqUQSsk', '105474315', '2004-06-22 04:43:06.000', 'dpfr4iTBuK', '2001-08-19 17:39:27.000', '2008-08-17 22:47:55.000', 1);
INSERT INTO `investment` VALUES (302, 'Zeng Lu', 'Zeng Lu', 'tyC3DhzWHZ', 791, 'r9NV2LO9fd', '288702069', '2007-05-30 07:01:27.000', '2bLbvEdutL', '2001-02-10 02:01:41.000', '2002-01-29 17:33:52.000', 1);
INSERT INTO `investment` VALUES (303, 'Mak Fu Shing', 'Mak Fu Shing', '1UMxffGsso', 626, 'BXCWdyJ4rW', '19690688100', '2002-01-05 11:38:05.000', 'QC0Po0sEDo', '2008-03-01 18:51:19.000', '2013-05-03 00:21:28.000', 1);
INSERT INTO `investment` VALUES (304, 'Fujiwara Sara', 'Fujiwara Sara', '6dDsBKVDD7', 988, 'DcZoa0UXJs', '7698098049', '2017-07-19 16:10:34.000', '7B2SR1Kmi6', '2019-08-24 15:37:13.000', '2023-02-04 23:49:17.000', 1);
INSERT INTO `investment` VALUES (305, 'Yan Jialun', 'Yan Jialun', 'uzwBNWOVAL', 698, 'uN4GZrSRbt', '14484602450', '2008-11-09 23:53:43.000', 'FeOTwKFZBK', '2022-05-22 20:03:45.000', '2004-07-31 07:13:26.000', 1);
INSERT INTO `investment` VALUES (306, 'Yoshida Daisuke', 'Yoshida Daisuke', 'myIABtX5IP', 735, 'mnEkD9gFIo', '15903398362', '2017-01-01 01:12:24.000', '5WnnOE2lyd', '2010-06-07 20:35:54.000', '2011-06-21 17:40:42.000', 1);
INSERT INTO `investment` VALUES (307, 'Hu Anqi', 'Hu Anqi', 'kwLjjYuXEI', 600, 'b1BXTiF6Z7', '76995326090', '2003-10-29 22:50:44.000', 'xMTKk70vJM', '2017-09-06 07:40:04.000', '2012-05-10 18:30:08.000', 1);
INSERT INTO `investment` VALUES (308, 'Siu Fat', 'Siu Fat', 'da5TfXW6j3', 538, 'TRygfDx3cr', '16900240838', '2016-08-04 21:59:27.000', '7Uu78B8rMM', '2003-10-31 13:24:05.000', '2016-11-22 05:19:38.000', 1);
INSERT INTO `investment` VALUES (309, 'Zhong Ziyi', 'Zhong Ziyi', 'PXoG14qQFE', 507, 'ZhqoLCaBvQ', '13106842994', '2020-04-04 07:52:46.000', 'ZMAD4DxJpt', '2010-08-06 11:33:58.000', '2001-04-01 07:31:40.000', 1);
INSERT INTO `investment` VALUES (310, 'Yuen Ming Sze', 'Yuen Ming Sze', 'QI0pwKrZIR', 350, 'Zn5ei2TYRS', '16473818527', '2008-01-10 17:26:42.000', 'p5IcpFMfRj', '2023-06-03 19:01:48.000', '2018-01-14 14:51:42.000', 1);
INSERT INTO `investment` VALUES (311, 'Yan Rui', 'Yan Rui', 'GzMZs4yJQG', 86, 'u6f7FLUqN6', '18414404435', '2021-08-25 18:41:10.000', 'fuIYAuYAgg', '2021-07-14 01:37:40.000', '2003-02-20 11:08:14.000', 1);
INSERT INTO `investment` VALUES (312, 'Diana Morgan', 'Diana Morgan', 'qHsThWrye4', 188, 'ap8CjLpXg1', '211910735', '2020-11-30 01:13:02.000', 'H44BZ0OlqP', '2014-07-21 19:11:40.000', '2013-02-26 01:58:04.000', 1);
INSERT INTO `investment` VALUES (313, 'Kikuchi Ayano', 'Kikuchi Ayano', 'dsqmaoSqnQ', 858, 'NNo6zvcx3k', '76908300292', '2007-12-25 01:32:16.000', 'Y7etXwzE4h', '2021-12-08 02:57:17.000', '2017-06-30 06:14:31.000', 1);
INSERT INTO `investment` VALUES (314, 'Chang Tsz Hin', 'Chang Tsz Hin', 'XaxV5CmSYt', 641, 'agb1yBSzrR', '14484975538', '2009-10-29 00:39:28.000', 'HNxt9oLgw2', '2015-08-07 04:08:37.000', '2016-04-10 23:51:56.000', 1);
INSERT INTO `investment` VALUES (315, 'Li Xiuying', 'Li Xiuying', 'QyxicgBEXA', 894, 'uVgxwM0G4x', '7603642697', '2024-08-04 22:51:31.000', 'BBoQHo2IsO', '2001-05-12 20:06:42.000', '2022-09-27 11:21:35.000', 1);
INSERT INTO `investment` VALUES (316, 'Elizabeth Flores', 'Elizabeth Flores', 'HlToT9z1WA', 814, 'V0eJnyJouE', '15879219480', '2020-04-15 23:37:23.000', 'ILmG6fAi39', '2006-01-24 08:59:02.000', '2019-02-24 20:23:24.000', 1);
INSERT INTO `investment` VALUES (317, 'Curtis Nelson', 'Curtis Nelson', 'XPqHJVKNsb', 130, 'tVkveGwVDY', '7694963522', '2003-08-29 23:59:41.000', '0ZoAE5JwmW', '2017-10-09 06:20:24.000', '2018-10-12 12:41:58.000', 1);
INSERT INTO `investment` VALUES (318, 'Hou Shihan', 'Hou Shihan', 'd5Ckn8FFc6', 562, 'gZNsEco6oa', '2158729118', '2010-11-26 16:29:30.000', 'zBqQcKrFJO', '2004-03-06 23:48:56.000', '2000-06-28 10:44:31.000', 1);
INSERT INTO `investment` VALUES (319, 'Chic Lai Yan', 'Chic Lai Yan', 'ACoBKbNSAj', 778, 'ETlomxFXxA', '16364297015', '2000-08-07 20:34:59.000', 'KleQL2xe6Z', '2010-12-19 01:41:27.000', '2016-01-26 06:23:00.000', 1);
INSERT INTO `investment` VALUES (320, 'Murakami Takuya', 'Murakami Takuya', '3SuAPqfCiB', 87, '1ghFH4VLbG', '13089709744', '2009-03-07 22:38:00.000', '64cR75TjaO', '2017-05-21 13:12:32.000', '2024-01-23 15:12:30.000', 1);
INSERT INTO `investment` VALUES (321, 'Harada Yuito', 'Harada Yuito', 'XkWgqgak7u', 936, '3XLODdjmEs', '18954950436', '2002-04-18 23:58:59.000', 'QYROo7isdI', '2011-08-13 19:55:53.000', '2003-09-22 05:57:01.000', 1);
INSERT INTO `investment` VALUES (322, 'Kudo Shino', 'Kudo Shino', 'qdiZeGmSgP', 520, 'ClUzIr0MG4', '76093364523', '2009-03-05 08:01:52.000', 'EoeIKLTsaV', '2024-01-08 17:07:34.000', '2021-04-15 04:14:33.000', 1);
INSERT INTO `investment` VALUES (323, 'Wei Xiuying', 'Wei Xiuying', 'af6REkcmNT', 97, 'ksxmVy6UPz', '19897311361', '2013-05-27 04:58:23.000', '21iK2SUFeR', '2006-01-29 02:47:22.000', '2002-11-29 16:33:54.000', 1);
INSERT INTO `investment` VALUES (324, 'Cheung Sze Kwan', 'Cheung Sze Kwan', 'QXdtucjjK1', 424, 's1qNaOB0V7', '76970613476', '2014-12-22 03:55:31.000', 'zoLoUTAgni', '2025-04-06 13:06:48.000', '2011-06-01 07:45:25.000', 1);
INSERT INTO `investment` VALUES (325, 'He Yunxi', 'He Yunxi', 'msJMW5iAXi', 750, '6W7koXCX87', '16316046029', '2023-02-27 01:15:18.000', 'ybyGJjcPxR', '2014-03-05 07:39:54.000', '2013-03-09 17:29:09.000', 1);
INSERT INTO `investment` VALUES (326, 'Matsui Eita', 'Matsui Eita', 'Vkg8SfeAoL', 717, 'Fsg5g2Z40e', '218844869', '2005-12-12 08:13:13.000', 'IvngEQOlV3', '2017-06-25 20:55:50.000', '2015-03-26 16:36:15.000', 1);
INSERT INTO `investment` VALUES (327, 'Maeda Miu', 'Maeda Miu', 'Dwa924GyA5', 771, 'mCXnrJfApd', '76954677007', '2009-03-31 11:10:43.000', 'zgjh5apSAL', '2019-03-28 23:48:13.000', '2007-09-27 12:30:18.000', 1);
INSERT INTO `investment` VALUES (328, 'Liu Zhiyuan', 'Liu Zhiyuan', 'qcEZikPwyP', 983, 'exovWZU6nx', '2099616956', '2016-08-29 15:29:14.000', 'rkRBdNGPBW', '2018-11-18 15:32:32.000', '2010-08-20 12:14:19.000', 1);
INSERT INTO `investment` VALUES (329, 'Tsui Hok Yau', 'Tsui Hok Yau', '5ipaeGnqtE', 474, 'AkmayBc8U8', '15347859112', '2001-09-29 00:15:07.000', 'whOLrSVDva', '2015-04-10 23:53:41.000', '2009-04-22 00:03:07.000', 1);
INSERT INTO `investment` VALUES (330, 'Miyazaki Riku', 'Miyazaki Riku', 'Of6RstAcHu', 531, 'bBOpXr45N2', '7551389347', '2018-09-23 08:06:09.000', 'KUqol10Azh', '2015-10-17 16:33:38.000', '2004-01-26 12:32:59.000', 1);
INSERT INTO `investment` VALUES (331, 'Loui Fu Shing', 'Loui Fu Shing', 'CFvfezWEST', 159, 'nSx0H1orIu', '17515238070', '2008-02-15 16:57:33.000', '4tX8vqB6b5', '2024-03-18 23:36:31.000', '2003-11-17 15:26:42.000', 1);
INSERT INTO `investment` VALUES (332, 'Roy Brown', 'Roy Brown', 'HRHzSNRrzg', 604, '3bAMuStI3d', '7694853974', '2014-11-21 01:01:25.000', 'nlbZbRpIcJ', '2012-02-15 20:52:58.000', '2010-11-19 21:47:48.000', 1);
INSERT INTO `investment` VALUES (333, 'Kam Hok Yau', 'Kam Hok Yau', 'Fy7q36gNLb', 897, 'SqSAmUcZZt', '76032601114', '2020-04-21 09:10:57.000', '9H7MFhc01r', '2004-01-02 04:40:45.000', '2010-12-06 23:28:53.000', 1);
INSERT INTO `investment` VALUES (334, 'Xie Jiehong', 'Xie Jiehong', 'Jd5eeD1Idu', 249, '2TL8jlm2Kg', '13004301517', '2003-09-07 01:57:11.000', 'dD3XQNLEX5', '2000-08-15 07:09:57.000', '2021-03-11 19:07:00.000', 1);
INSERT INTO `investment` VALUES (335, 'Mo Jiehong', 'Mo Jiehong', 'T67hKxc9x6', 641, 'c1D7Qddivd', '200066096', '2010-04-20 20:03:45.000', 'LSIX6XHwmL', '2001-03-13 11:53:13.000', '2011-11-15 07:13:16.000', 1);
INSERT INTO `investment` VALUES (336, 'Pang Tin Wing', 'Pang Tin Wing', 'fRxM8WZJDN', 123, '6vKSjQfCFn', '76023313188', '2007-05-15 21:42:57.000', 'dAAPrSqecv', '2012-01-01 21:31:02.000', '2003-11-08 19:11:04.000', 1);
INSERT INTO `investment` VALUES (337, 'Saito Daichi', 'Saito Daichi', 'b0vvsjRzod', 862, 'YNllpEcg7P', '18685736694', '2011-08-10 14:41:55.000', 'C6lCiDXYOa', '2005-05-14 13:02:49.000', '2013-02-09 18:23:38.000', 1);
INSERT INTO `investment` VALUES (338, 'Sugiyama Yuto', 'Sugiyama Yuto', 'sxFAFN4TLz', 721, '4XewUmeDuN', '7604558144', '2006-07-25 06:23:27.000', 'JJTavNqoaf', '2013-08-08 08:41:27.000', '2018-02-11 02:11:07.000', 1);
INSERT INTO `investment` VALUES (339, 'Yuen Ka Ling', 'Yuen Ka Ling', 'm97fVaWo3U', 561, 'epVgSi1mYI', '16416851225', '2021-12-18 10:04:32.000', '2z1Vh1jDtC', '2011-08-10 15:24:12.000', '2002-09-12 03:02:50.000', 1);
INSERT INTO `investment` VALUES (340, 'Connie Fernandez', 'Connie Fernandez', 'P156RwOHVM', 553, 'zDu1FmkIBA', '17718639460', '2010-07-18 07:10:54.000', 'p8q4ikAg1S', '2002-06-18 04:15:07.000', '2013-01-29 10:00:04.000', 1);
INSERT INTO `investment` VALUES (341, 'Francisco Wagner', 'Francisco Wagner', 'b0jjnMJFuW', 983, 'O2MXjgTuks', '16237872960', '2011-04-27 14:58:59.000', 'zFgk4ljwFi', '2017-09-04 18:04:52.000', '2020-02-26 23:42:06.000', 1);
INSERT INTO `investment` VALUES (342, 'Yamashita Ryota', 'Yamashita Ryota', 'lQDQwGAqUg', 277, 'B5PouECejF', '1027624055', '2010-02-05 19:29:41.000', '8FdMHt43H8', '2020-05-21 11:39:27.000', '2003-11-10 16:59:38.000', 1);
INSERT INTO `investment` VALUES (343, 'Chiba Mio', 'Chiba Mio', 'ucrvssOH6z', 53, 'AnML6GFI4P', '18471537955', '2013-11-27 14:59:46.000', 'pEqFV8OM9H', '2015-02-07 22:18:44.000', '2005-08-30 17:12:03.000', 1);
INSERT INTO `investment` VALUES (344, 'Chan Ho Yin', 'Chan Ho Yin', 'uEDmzkfmc6', 148, 'XEtojlsNl2', '18921907026', '2002-11-17 04:37:49.000', 'pUp2a1XVKI', '2017-11-26 06:44:41.000', '2006-01-13 13:54:54.000', 1);
INSERT INTO `investment` VALUES (345, 'Tong Sze Kwan', 'Tong Sze Kwan', 'ryML4BjZk6', 809, 'sBk7fgJnv1', '2002960568', '2018-12-10 11:07:16.000', 'bgMaFh3tj7', '2005-10-13 05:45:10.000', '2011-11-25 12:38:40.000', 1);
INSERT INTO `investment` VALUES (346, 'Kaneko Rena', 'Kaneko Rena', 'e1ez6JVtzt', 148, '78w2UAkaQz', '13255225479', '2003-01-09 12:16:51.000', '8Uxwaaf6k6', '2002-12-05 02:15:06.000', '2021-09-20 00:34:02.000', 1);
INSERT INTO `investment` VALUES (347, 'Leung Ka Man', 'Leung Ka Man', '7vDrqqJAUP', 954, '4YmVtffbX4', '1083523185', '2022-01-11 00:57:37.000', 'nCaXO6RN3u', '2005-02-05 09:53:02.000', '2018-07-17 16:35:46.000', 1);
INSERT INTO `investment` VALUES (348, 'Hayashi Hikari', 'Hayashi Hikari', 'XLzZM4JkQZ', 233, 'Qf4vNzbgmU', '200260568', '2005-05-27 19:47:41.000', 'RSuqlMe5PH', '2007-11-28 05:42:37.000', '2007-10-06 14:56:45.000', 1);
INSERT INTO `investment` VALUES (349, 'Daniel Aguilar', 'Daniel Aguilar', 'LnqwdBK5pK', 64, '75fpM1djQz', '7602846916', '2010-11-22 18:42:20.000', 's8LnvBzmRn', '2010-12-26 18:47:54.000', '2018-08-12 11:10:35.000', 1);
INSERT INTO `investment` VALUES (350, 'Mak Lik Sun', 'Mak Lik Sun', 'qTgW1ffflJ', 662, 'us0siG66SZ', '13246853418', '2018-10-06 19:24:15.000', 'xxdbXkNOtQ', '2014-08-07 07:27:37.000', '2011-03-19 02:59:23.000', 1);
INSERT INTO `investment` VALUES (351, 'Huang Rui', 'Huang Rui', 'IKy2SrQG9n', 524, 'WvYQeKmNzw', '19548645238', '2023-08-11 14:24:49.000', 'eh46Ibycxj', '2013-02-20 00:52:58.000', '2013-11-20 11:21:15.000', 1);
INSERT INTO `investment` VALUES (352, 'Jiang Lu', 'Jiang Lu', 'G9sQCKyW6N', 988, 'mWSSJVCmt0', '219070001', '2009-08-16 04:00:16.000', 'EIZh6lVvjH', '2019-02-21 18:47:31.000', '2014-12-28 03:18:37.000', 1);
INSERT INTO `investment` VALUES (353, 'Takada Itsuki', 'Takada Itsuki', '1oGXsIJ3FT', 852, 'EibCeHAse4', '2055650654', '2004-01-18 04:25:20.000', 'OkeBVCLzAt', '2008-11-14 05:33:01.000', '2016-09-24 09:50:46.000', 1);
INSERT INTO `investment` VALUES (354, 'Thomas Washington', 'Thomas Washington', 'U8WnwGOgWo', 697, 'BnK3xFAxB3', '2880744338', '2001-01-16 14:27:10.000', 'eg2KyD6oA8', '2024-03-14 04:38:41.000', '2010-06-28 08:31:37.000', 1);
INSERT INTO `investment` VALUES (355, 'Song Lan', 'Song Lan', 'isFCQglFEE', 369, 'jQY8wWjtRK', '7556439832', '2013-07-26 19:55:53.000', '5oBilWW6Vs', '2016-11-08 15:06:01.000', '2004-06-15 01:26:45.000', 1);
INSERT INTO `investment` VALUES (356, 'Martin Washington', 'Martin Washington', 'PskRWVVciO', 468, '5osFGZz8I1', '76966607119', '2014-05-15 21:15:30.000', 'G8tiI1NO3Y', '2021-01-26 09:51:17.000', '2015-07-10 15:09:37.000', 1);
INSERT INTO `investment` VALUES (357, 'Emily Romero', 'Emily Romero', 'qyk2sglUgT', 603, 'skj1ffIY2D', '2856296319', '2022-08-29 19:29:14.000', 'CGlNBV3YQQ', '2009-07-15 08:51:50.000', '2020-09-05 00:30:42.000', 1);
INSERT INTO `investment` VALUES (358, 'Tsang Chieh Lun', 'Tsang Chieh Lun', 'Qk5DuXxOma', 555, 'TVCelCRq2l', '212696591', '2018-07-03 07:57:38.000', 'IptybjQtcT', '2005-01-16 01:29:53.000', '2006-06-26 07:03:18.000', 1);
INSERT INTO `investment` VALUES (359, 'Gary Hill', 'Gary Hill', 'PFBg5rsmGG', 273, 'feRIrB29n7', '14564778579', '2005-02-25 22:49:55.000', 'fCCP8X3ZwQ', '2000-07-21 01:46:48.000', '2003-12-10 16:57:12.000', 1);
INSERT INTO `investment` VALUES (360, 'Chiang Wing Fat', 'Chiang Wing Fat', 'Nj5fZyz6vr', 440, '1CWF3CIuJY', '1058079723', '2011-09-19 03:46:37.000', '31AWa4cQLO', '2019-05-31 05:08:38.000', '2006-05-22 00:49:34.000', 1);
INSERT INTO `investment` VALUES (361, 'Ding Yuning', 'Ding Yuning', '3piNfxM5nk', 420, 'CHVVoflp32', '13639223319', '2000-11-24 22:35:36.000', 'b7Ey7quvTB', '2018-01-30 13:12:47.000', '2012-11-17 15:32:36.000', 1);
INSERT INTO `investment` VALUES (362, 'Pang Kwok Wing', 'Pang Kwok Wing', 'AERVZZNOr7', 378, '76ysHsp7Vt', '14780064789', '2000-08-31 01:25:45.000', 'dA8Rl7QDjA', '2010-11-17 03:08:37.000', '2013-06-26 21:47:42.000', 1);
INSERT INTO `investment` VALUES (363, 'Yuen Lik Sun', 'Yuen Lik Sun', 'imirZwDEDM', 677, 'sL9msElGwR', '18983916643', '2021-12-24 20:12:50.000', 'eQo7xj7Mcl', '2002-02-28 19:26:40.000', '2019-08-10 14:02:24.000', 1);
INSERT INTO `investment` VALUES (364, 'Danny Morgan', 'Danny Morgan', 'DxyH3mX6uT', 8, 'OZhVUFErYq', '16621110052', '2020-11-29 04:03:30.000', '5kPkEuYCyt', '2018-09-10 13:27:04.000', '2011-08-13 15:25:34.000', 1);
INSERT INTO `investment` VALUES (365, 'Leung Hiu Tung', 'Leung Hiu Tung', 'C24pooKy0B', 157, 'agQhUZTHV0', '16285031041', '2017-05-16 08:56:55.000', 'NhkGaJa2yl', '2002-02-28 05:06:49.000', '2012-02-04 01:31:33.000', 1);
INSERT INTO `investment` VALUES (366, 'Kong Sau Man', 'Kong Sau Man', 'gM0DUaht7E', 204, 'V7NeFfKLPu', '2116992557', '2003-09-07 05:17:06.000', 'gSUCxVmFFO', '2025-01-31 19:19:22.000', '2023-12-01 23:52:04.000', 1);
INSERT INTO `investment` VALUES (367, 'Zeng Lan', 'Zeng Lan', 'MFxGnxcZUb', 981, 'zn48DQY7Bw', '17706321266', '2013-07-16 22:56:06.000', 'MiDQKF1krb', '2010-09-02 17:04:42.000', '2016-03-15 10:05:07.000', 1);
INSERT INTO `investment` VALUES (368, 'Cai Jiehong', 'Cai Jiehong', 'wN020SNNCc', 452, '9dYqaY16G6', '19652098544', '2006-09-11 09:02:53.000', 'TMqwbYoJgA', '2009-04-07 18:50:03.000', '2000-11-08 13:40:52.000', 1);
INSERT INTO `investment` VALUES (369, 'Yeung Wai Man', 'Yeung Wai Man', 'XqcM2NcDIC', 757, '9RaJrtQ5A6', '7606506595', '2011-05-31 11:40:01.000', 'tLBP4EllJV', '2006-09-12 14:54:14.000', '2020-05-31 18:59:25.000', 1);
INSERT INTO `investment` VALUES (370, 'Cao Lu', 'Cao Lu', 'MKZ2ac6nMd', 195, 'Wm8uIgyoZk', '7604391598', '2017-01-18 04:07:37.000', '8teEJb7pp0', '2023-07-29 02:40:25.000', '2010-12-10 14:28:35.000', 1);
INSERT INTO `investment` VALUES (371, 'Tang Tsz Ching', 'Tang Tsz Ching', 'qvifs3A5er', 636, 'NtbTyHpYwK', '18476806229', '2014-09-10 09:53:04.000', 'TbTsfZADCC', '2003-07-27 05:18:23.000', '2020-11-11 19:46:52.000', 1);
INSERT INTO `investment` VALUES (372, 'Yuen Ming', 'Yuen Ming', 'qADxEBVT5Y', 121, 'BdMtJsy6CI', '284443083', '2002-04-30 20:19:54.000', 'OTmgaMBmVC', '2024-01-02 16:52:47.000', '2021-10-09 22:13:08.000', 1);
INSERT INTO `investment` VALUES (373, 'Danielle Howard', 'Danielle Howard', '0Jq12zZjw7', 361, 'uc55V8Wxas', '14006924959', '2013-08-23 03:20:53.000', 'QV6EjRtJok', '2001-04-27 17:43:21.000', '2023-12-03 14:08:15.000', 1);
INSERT INTO `investment` VALUES (374, 'Cheng Ka Ming', 'Cheng Ka Ming', 'NsBCe3F00r', 553, 'dpNziIpPOO', '204072824', '2006-10-29 19:57:25.000', 'NJ4KRS0yZT', '2018-06-23 14:57:16.000', '2016-01-29 12:45:13.000', 1);
INSERT INTO `investment` VALUES (375, 'Nakajima Momoe', 'Nakajima Momoe', '37szFafYkX', 207, 'BgWP2VjI20', '7605803260', '2014-10-29 02:11:18.000', 'LepZpoSmEJ', '2006-05-18 06:17:12.000', '2005-12-05 17:51:53.000', 1);
INSERT INTO `investment` VALUES (376, 'Shimizu Itsuki', 'Shimizu Itsuki', 'uRWhmKYphM', 987, 'nePjOevyvT', '7552244068', '2018-02-23 05:44:15.000', 'tZ8AX40FYs', '2001-03-12 20:59:29.000', '2013-06-02 11:39:44.000', 1);
INSERT INTO `investment` VALUES (377, 'Xia Yunxi', 'Xia Yunxi', 'zAHZgyqKca', 287, 'erU7Qni2io', '7553056786', '2017-07-22 02:53:28.000', 'apP7jYgRk3', '2005-12-17 00:40:43.000', '2023-10-02 09:19:47.000', 1);
INSERT INTO `investment` VALUES (378, 'Gary Mills', 'Gary Mills', 'YMQ8NwqPVv', 154, 'JFXvwxMOt3', '219808814', '2019-10-17 19:03:32.000', '5y51V5iH0H', '2022-03-28 20:34:05.000', '2000-08-26 09:57:02.000', 1);
INSERT INTO `investment` VALUES (379, 'So Lai Yan', 'So Lai Yan', '2ipmmf20gm', 349, 'ahpcaucYBD', '16911101209', '2024-03-29 03:54:58.000', 'e1D7LO8yOe', '2017-03-14 06:52:52.000', '2016-12-30 10:57:24.000', 1);
INSERT INTO `investment` VALUES (380, 'Hashimoto Shino', 'Hashimoto Shino', 'bKTHMBscOs', 76, 'AiGwCXwwpP', '288388096', '2009-09-29 16:20:18.000', '88LpI89sMO', '2000-05-25 12:15:57.000', '2022-02-23 20:32:05.000', 1);
INSERT INTO `investment` VALUES (381, 'Xie Shihan', 'Xie Shihan', '1AxOsnCk7J', 579, 'Hzxqd3Qwje', '215050569', '2004-02-21 06:01:47.000', 'ZhdrnsBLMn', '2012-04-18 14:01:06.000', '2016-03-29 10:44:17.000', 1);
INSERT INTO `investment` VALUES (382, 'Otsuka Yamato', 'Otsuka Yamato', '9EM6o0fs19', 641, 'ECCj2QfFno', '14456267670', '2007-08-19 20:03:37.000', 'ulky9qj2KE', '2021-06-07 06:48:09.000', '2020-01-02 10:07:52.000', 1);
INSERT INTO `investment` VALUES (383, 'Hara Momoka', 'Hara Momoka', '4ucRfKs9pZ', 741, 'O7fa63ApzM', '208121920', '2006-12-16 06:33:57.000', 'EcGe67UUhV', '2002-04-10 05:22:55.000', '2023-12-20 20:29:44.000', 1);
INSERT INTO `investment` VALUES (384, 'Manuel Nichols', 'Manuel Nichols', 'wmoqgiNJ7T', 364, 'ZUjQ3A4j05', '18658428031', '2009-08-06 16:36:36.000', 'y6o36zW6iK', '2020-10-15 15:28:17.000', '2011-01-10 10:33:52.000', 1);
INSERT INTO `investment` VALUES (385, 'Tanaka Eita', 'Tanaka Eita', 'RUcJBGnP1P', 398, 'joVrJLwEHC', '17253327390', '2004-11-15 19:20:17.000', 'cQzrMrlteB', '2012-07-22 19:44:03.000', '2006-11-22 22:09:47.000', 1);
INSERT INTO `investment` VALUES (386, 'Chang Yun Fat', 'Chang Yun Fat', 'O99g223Whh', 961, 'HH2tzuzPF0', '200339741', '2009-12-13 06:05:46.000', 'K2PPse4f71', '2022-10-06 14:22:54.000', '2003-07-07 22:57:47.000', 1);
INSERT INTO `investment` VALUES (387, 'Hung Wai San', 'Hung Wai San', 'gX4V2cwoxx', 588, 'X3mSNGYhBt', '18866937237', '2000-06-05 18:11:07.000', 'yn9nUJr1yq', '2014-06-28 16:44:57.000', '2022-06-14 16:02:10.000', 1);
INSERT INTO `investment` VALUES (388, 'Takagi Aoshi', 'Takagi Aoshi', 'mDJNS0udV8', 228, '4wR8PiMUzy', '14236925490', '2023-06-18 04:29:55.000', 'lByHMbADgd', '2021-09-07 03:51:38.000', '2005-10-09 15:25:17.000', 1);
INSERT INTO `investment` VALUES (389, 'Chan Sze Yu', 'Chan Sze Yu', '6fQzkAmz0R', 191, 'y9o3EdaAWQ', '210437629', '2006-05-16 19:11:08.000', 'e7DnZpQdWB', '2004-01-23 18:45:31.000', '2018-08-04 22:57:35.000', 1);
INSERT INTO `investment` VALUES (390, 'Fujita Ayano', 'Fujita Ayano', '74G9zIkWuS', 714, 'UWikiX7EyR', '7691309718', '2010-12-10 23:25:04.000', 'Osgj0vG7pL', '2021-09-30 09:55:22.000', '2000-02-16 16:16:22.000', 1);
INSERT INTO `investment` VALUES (391, 'Tao Ting Fung', 'Tao Ting Fung', 'g30s8pkouD', 927, 'eHC7mNhxZD', '15911697167', '2011-03-07 10:05:15.000', 'tASAyqqRT7', '2011-01-24 00:12:04.000', '2024-12-28 20:31:23.000', 1);
INSERT INTO `investment` VALUES (392, 'Hung Suk Yee', 'Hung Suk Yee', 'KlPnQBrEKl', 752, 'hYvoqMEm4S', '2196875424', '2006-04-20 17:25:18.000', '65voAVJaAc', '2000-10-04 02:27:16.000', '2000-11-21 02:50:46.000', 1);
INSERT INTO `investment` VALUES (393, 'Xiong Zitao', 'Xiong Zitao', 'y2RQcoS5CY', 391, 'LBQ0BwoPGa', '16516350380', '2000-03-25 09:01:54.000', '0XgD2aJRXI', '2000-10-05 10:48:54.000', '2013-08-11 15:17:54.000', 1);
INSERT INTO `investment` VALUES (394, 'Liao Xiuying', 'Liao Xiuying', 'e7WEfOe7T2', 527, 'BfBbGtK1Vd', '16664345832', '2011-12-25 00:53:09.000', 'e1713z6Osj', '2012-06-07 05:22:16.000', '2008-10-26 09:02:58.000', 1);
INSERT INTO `investment` VALUES (395, 'Yang Ziyi', 'Yang Ziyi', 'bdm482wlRD', 885, 'Nc4mIcM0cX', '14243704175', '2001-09-11 18:49:16.000', 'TYFiIpL9sM', '2018-04-02 21:41:37.000', '2008-11-15 18:02:45.000', 1);
INSERT INTO `investment` VALUES (396, 'Li Xiuying', 'Li Xiuying', 'qUtdPivxte', 723, 'NfUMntSPbZ', '16088466179', '2000-08-04 03:40:34.000', '2aqLSyL51A', '2022-05-27 23:37:27.000', '2003-10-14 22:48:13.000', 1);
INSERT INTO `investment` VALUES (397, 'Duan Yunxi', 'Duan Yunxi', '206Hxj4zr9', 294, 'MsDlxQeoHO', '16310319096', '2014-04-13 00:24:16.000', '7zs451ZEZx', '2002-01-10 18:26:07.000', '2008-01-23 12:18:32.000', 1);
INSERT INTO `investment` VALUES (398, 'Che Chi Yuen', 'Che Chi Yuen', '0udWfC3xUG', 977, 'LpjTfrsCSa', '16859849308', '2024-12-16 17:17:51.000', '3sGRicWlOA', '2023-02-20 06:02:14.000', '2009-05-27 01:14:40.000', 1);
INSERT INTO `investment` VALUES (399, 'Cao Zhiyuan', 'Cao Zhiyuan', 'DCGZygFO0F', 600, 'pDPLo5WlnH', '108600557', '2005-04-10 08:56:56.000', 'hVEkIMDFW7', '2025-03-14 10:19:08.000', '2018-11-24 10:26:40.000', 1);
INSERT INTO `investment` VALUES (400, 'Noguchi Tsubasa', 'Noguchi Tsubasa', 'wS1eVVcz9N', 785, 'uZwTrxNviS', '76941563498', '2004-12-11 22:10:13.000', '1AWqHCdL7L', '2024-01-23 10:50:42.000', '2008-09-24 18:25:12.000', 1);
INSERT INTO `investment` VALUES (401, 'Hung Yu Ling', 'Hung Yu Ling', 'b9L3U5h1TR', 45, 'LIwhNAIrda', '19841325175', '2004-12-22 01:06:58.000', 'IA3gtruUc3', '2015-02-02 18:17:46.000', '2018-07-26 06:57:17.000', 1);
INSERT INTO `investment` VALUES (402, 'Yan Zhiyuan', 'Yan Zhiyuan', 'T5bj0tuttk', 140, 'a7oUG1zTYo', '2122225479', '2010-08-20 21:53:53.000', 'f90JzpR4Hn', '2002-04-04 23:54:25.000', '2019-02-10 21:05:39.000', 1);
INSERT INTO `investment` VALUES (403, 'Zou Yunxi', 'Zou Yunxi', 'QdPvJ9KRBI', 776, 'cWWTLmxfaZ', '14494716984', '2021-11-21 03:45:54.000', 'pA8MxRly2b', '2013-11-28 03:02:42.000', '2008-06-21 15:16:45.000', 1);
INSERT INTO `investment` VALUES (404, 'Liu Rui', 'Liu Rui', 'wvkRAnGn1o', 644, 'kb3dQJfskx', '217873420', '2018-04-23 02:36:36.000', 'XOJF3cssz4', '2019-11-24 21:49:44.000', '2020-10-04 22:50:06.000', 1);
INSERT INTO `investment` VALUES (405, 'Liao Yunxi', 'Liao Yunxi', 'Zt3t8QiZGq', 822, 'qVKw0Pfk3S', '13448118426', '2007-02-07 09:31:01.000', 'qvnF8BOVpN', '2008-02-26 20:42:14.000', '2001-02-18 09:51:57.000', 1);
INSERT INTO `investment` VALUES (406, 'Bonnie Lewis', 'Bonnie Lewis', 'ZlV6qg8CLV', 15, '7FAKCdUiwM', '7553684136', '2005-03-19 00:15:45.000', 'ZH5OrHS1zY', '2025-02-05 16:52:07.000', '2007-02-01 22:34:44.000', 1);
INSERT INTO `investment` VALUES (407, 'Zhu Yuning', 'Zhu Yuning', 'IC4bSd7Ur4', 564, '6PpxFVJI8y', '210784577', '2011-10-20 12:57:55.000', 'kFl2Buidey', '2015-01-12 14:59:23.000', '2017-02-16 20:43:42.000', 1);
INSERT INTO `investment` VALUES (408, 'Thomas Ryan', 'Thomas Ryan', 'je2BlPfuqg', 432, '2i44X3fTxu', '76943458126', '2023-01-26 23:14:15.000', 'fUTqOtMH5H', '2010-12-25 03:00:41.000', '2022-06-07 02:16:53.000', 1);
INSERT INTO `investment` VALUES (409, 'Ng Wing Fat', 'Ng Wing Fat', 'm2ZYjPBY20', 881, 'koxS5NIrep', '15245903374', '2009-01-13 13:35:33.000', 'PyZrTjuGXM', '2017-10-17 17:03:23.000', '2001-01-06 23:57:25.000', 1);
INSERT INTO `investment` VALUES (410, 'Stanley Holmes', 'Stanley Holmes', 'yOVhIuH0KQ', 239, 'shhSkXm8Ot', '14000570317', '2014-07-06 12:39:19.000', 'gI1TH7PkEp', '2023-04-21 12:11:44.000', '2004-12-27 14:32:14.000', 1);
INSERT INTO `investment` VALUES (411, 'Lui Wai Han', 'Lui Wai Han', 'm4Ir9WBHG5', 239, 'tnG7ztBp5o', '76978229800', '2016-08-19 14:51:12.000', 'uUpqhIFfkZ', '2000-09-29 13:48:22.000', '2015-07-24 04:49:26.000', 1);
INSERT INTO `investment` VALUES (412, 'Maeda Takuya', 'Maeda Takuya', 'B163OPvCmM', 752, 'CsvDtym321', '17577445378', '2006-03-06 23:14:03.000', 'H0SzceA401', '2000-11-18 05:07:31.000', '2018-06-26 05:37:25.000', 1);
INSERT INTO `investment` VALUES (413, 'Murakami Yota', 'Murakami Yota', 'FvWQXxAHt5', 918, 'Ic6SzaErf1', '13707616689', '2006-02-17 16:43:24.000', '8w3l5UBcBF', '2007-03-15 05:05:02.000', '2006-02-15 22:25:12.000', 1);
INSERT INTO `investment` VALUES (414, 'Takeda Ren', 'Takeda Ren', 'DR5vszxVOb', 910, 'zdPgP2E2Hf', '19654739627', '2016-07-04 15:21:13.000', '1lXaKM3J2q', '2016-09-13 12:57:11.000', '2006-07-30 16:13:50.000', 1);
INSERT INTO `investment` VALUES (415, 'Ti Ting Fung', 'Ti Ting Fung', 'oPO8yyVuOa', 584, 'DbUivhvgpb', '7696661785', '2021-10-08 05:37:13.000', '2WJPrCth61', '2017-04-04 10:33:10.000', '2015-03-28 10:22:41.000', 1);
INSERT INTO `investment` VALUES (416, 'Gong Xiuying', 'Gong Xiuying', 'bGvrLnDfjn', 172, 'xMxyO2ZJCQ', '76980135578', '2010-01-27 07:44:27.000', 'sFHEzRacfX', '2016-04-23 19:17:14.000', '2020-08-24 00:05:15.000', 1);
INSERT INTO `investment` VALUES (417, 'Sato Miu', 'Sato Miu', '2rhc1jPHzX', 283, 'TOa3KznTuc', '17937347515', '2004-07-23 15:13:23.000', 'lAN7UqtmVy', '2000-10-24 21:49:14.000', '2024-03-15 04:19:23.000', 1);
INSERT INTO `investment` VALUES (418, 'Bobby Munoz', 'Bobby Munoz', 'hXyQfGBm8E', 667, 'isQjiTJilH', '287677753', '2008-08-19 11:27:04.000', 'Y00nVgjQDh', '2004-06-19 17:04:18.000', '2000-08-27 19:02:34.000', 1);
INSERT INTO `investment` VALUES (419, 'Cheng Ka Ming', 'Cheng Ka Ming', 'GyZKeK07I1', 258, 'YRsw0UKEr1', '7600925796', '2018-05-28 10:23:54.000', 'DpwtdHXLLA', '2010-07-30 20:49:22.000', '2001-10-07 23:45:50.000', 1);
INSERT INTO `investment` VALUES (420, 'Melissa Soto', 'Melissa Soto', 's1FUumi54n', 653, 'NM8EZqFgLl', '2048376959', '2002-05-17 02:48:35.000', 'PHSrENCLw1', '2015-08-17 11:37:09.000', '2018-08-05 18:14:21.000', 1);
INSERT INTO `investment` VALUES (421, 'Okamoto Misaki', 'Okamoto Misaki', 'zWXgW0d9Gw', 226, 'X0MIo6VLl8', '280981387', '2005-06-18 09:37:36.000', 'kf94TTB1bC', '2008-12-17 06:33:34.000', '2006-06-24 14:37:06.000', 1);
INSERT INTO `investment` VALUES (422, 'Ishii Seiko', 'Ishii Seiko', '0FG3XGivBV', 486, 'x0JRMrrvxt', '13466585399', '2019-03-16 09:24:10.000', 'cK00U5kc7K', '2007-04-18 10:01:10.000', '2023-06-14 12:12:42.000', 1);
INSERT INTO `investment` VALUES (423, 'William Ferguson', 'William Ferguson', 'K5h3crdjtZ', 56, 't04F3m0neh', '75583375205', '2013-02-04 03:19:30.000', 'C8xYQU9ZpB', '2020-06-07 14:19:35.000', '2012-09-10 11:30:13.000', 1);
INSERT INTO `investment` VALUES (424, 'Jiang Jialun', 'Jiang Jialun', 'nAY4lGPKuF', 701, 'lSwN2Dyosu', '211435782', '2010-10-09 04:59:50.000', 'D5MeXgAeiz', '2001-05-30 00:00:00.000', '2006-03-09 19:00:16.000', 1);
INSERT INTO `investment` VALUES (425, 'Murakami Hikaru', 'Murakami Hikaru', 'm8zah6JRo2', 332, 'au01iRW7U1', '103468921', '2013-05-31 23:51:54.000', 'nJvOsKvfqH', '2001-10-29 19:43:17.000', '2022-07-21 09:54:52.000', 1);
INSERT INTO `investment` VALUES (426, 'David Graham', 'David Graham', 'Pqa4yXuaf8', 790, 'Iu36GrxgvI', '18878587355', '2011-09-20 02:39:31.000', 'hEKx2ej1Sp', '2003-06-09 15:31:18.000', '2004-03-14 12:15:56.000', 1);
INSERT INTO `investment` VALUES (427, 'Tang Shihan', 'Tang Shihan', '1KVv5gWHpo', 212, 'QEoJqdKGry', '16321851393', '2013-02-09 21:57:48.000', 'L1qr57IQkB', '2007-11-14 22:39:27.000', '2007-07-30 06:00:19.000', 1);
INSERT INTO `investment` VALUES (428, 'Fujita Hikaru', 'Fujita Hikaru', 'muOnw8ZZrp', 716, 'OVkAJHEas1', '18547488032', '2018-09-02 15:33:53.000', 'RR3dzkRS2Z', '2011-02-10 23:58:39.000', '2022-01-14 01:26:16.000', 1);
INSERT INTO `investment` VALUES (429, 'Kato Daichi', 'Kato Daichi', 'OuJ2hOWv1Q', 970, 'f0nQY7upgt', '2142550312', '2021-01-15 21:38:06.000', '3QlEyZBiu6', '2002-03-25 22:42:39.000', '2006-11-03 22:03:15.000', 1);
INSERT INTO `investment` VALUES (430, 'Kimura Ayato', 'Kimura Ayato', 'KVG33lmkZE', 585, 'NOqvBewKiz', '16579273383', '2007-08-27 18:32:58.000', 'qoR7my7jw9', '2004-01-22 21:49:47.000', '2015-11-04 20:58:39.000', 1);
INSERT INTO `investment` VALUES (431, 'Wang Jialun', 'Wang Jialun', 'gbR8tVdURZ', 858, 'L83zMukqXw', '16168544999', '2014-06-07 17:25:33.000', 'Xdi3rN02XP', '2011-06-18 01:56:44.000', '2004-11-08 13:45:54.000', 1);
INSERT INTO `investment` VALUES (432, 'Cai Lan', 'Cai Lan', 'o7vEc3UQam', 303, 'nEdozX2rNr', '7551457117', '2017-06-13 09:21:19.000', 'YHqHI1joVa', '2022-04-14 07:09:04.000', '2019-12-14 21:13:11.000', 1);
INSERT INTO `investment` VALUES (433, 'Shi Rui', 'Shi Rui', 'YpV3F28mx8', 862, 'CWk82w6Rki', '17413568271', '2006-03-24 13:35:03.000', 'NkuWzt6v3T', '2009-09-07 15:43:58.000', '2006-10-12 03:52:21.000', 1);
INSERT INTO `investment` VALUES (434, 'Wang Zhiyuan', 'Wang Zhiyuan', 'qwFaPQKfSS', 648, '9HI8g6e2lc', '105926597', '2016-01-10 11:30:50.000', 'vGsXGF4hlu', '2025-03-04 00:40:35.000', '2017-07-16 13:47:11.000', 1);
INSERT INTO `investment` VALUES (435, 'Yue Ho Yin', 'Yue Ho Yin', 'gfG5Vstolh', 964, '2R9hAJ27Hu', '15970291120', '2004-04-01 07:16:36.000', 'Gbo9JiA0VI', '2002-03-19 03:41:50.000', '2005-11-29 03:34:59.000', 1);
INSERT INTO `investment` VALUES (436, 'Cheng Jiehong', 'Cheng Jiehong', '1CVx7gsYvC', 638, 'mXlNEeQMAC', '13831219252', '2013-07-13 21:29:35.000', 'BpLsqAevVS', '2003-10-14 01:57:17.000', '2019-10-17 19:17:32.000', 1);
INSERT INTO `investment` VALUES (437, 'Yan Jialun', 'Yan Jialun', '2hR7UUpclG', 45, 'zMfZIgKKBD', '102416465', '2024-03-16 00:48:46.000', '9ZrDfVq5zo', '2014-07-20 19:00:07.000', '2003-08-01 06:53:13.000', 1);
INSERT INTO `investment` VALUES (438, 'Man Fat', 'Man Fat', 'TzOa4jDMoC', 634, 'r7A5L9R2gZ', '7555018864', '2015-07-29 14:48:37.000', 'Dp2qph9YbW', '2014-06-15 21:01:01.000', '2024-12-15 19:42:07.000', 1);
INSERT INTO `investment` VALUES (439, 'Bryan Williams', 'Bryan Williams', 'LlqZJAIYGV', 987, 'meeYAWr0nv', '2819400813', '2021-04-24 22:56:33.000', 'WhgmtDuzjU', '2008-06-26 02:41:02.000', '2022-08-26 21:55:41.000', 1);
INSERT INTO `investment` VALUES (440, 'Fan Zhennan', 'Fan Zhennan', 'MJgt8mXscX', 894, 'GLG1w6NAVB', '18888551692', '2004-08-03 23:21:50.000', 'FMQXc6tbdW', '2024-01-30 13:07:22.000', '2017-09-16 05:01:30.000', 1);
INSERT INTO `investment` VALUES (441, 'Patrick Stephens', 'Patrick Stephens', 'mAJE7Qsifz', 146, 'BPjThXCmKD', '209416288', '2018-10-15 06:17:43.000', 'EjAgfAYwDS', '2022-05-19 04:42:13.000', '2020-08-07 14:01:40.000', 1);
INSERT INTO `investment` VALUES (442, 'Kato Daisuke', 'Kato Daisuke', 'zrimupFamY', 946, 'LVdapkL10q', '2865893921', '2019-01-17 06:09:19.000', 'WgxygAY0MX', '2024-04-05 08:27:15.000', '2015-02-10 01:25:37.000', 1);
INSERT INTO `investment` VALUES (443, 'Yamashita Yota', 'Yamashita Yota', 'qcgWLNy4sU', 203, 'vP9uXkHQCk', '1047241742', '2000-01-17 23:41:33.000', 'O7hTFAlVO5', '2002-03-15 08:52:32.000', '2005-07-27 07:29:58.000', 1);
INSERT INTO `investment` VALUES (444, 'Shen Lan', 'Shen Lan', 'sCSEW08NIN', 176, 'UGX9X5HO4u', '16202103130', '2022-05-08 15:56:46.000', 'pdQGdtxldq', '2009-04-03 09:24:31.000', '2006-05-31 06:00:00.000', 1);
INSERT INTO `investment` VALUES (445, 'Lin Rui', 'Lin Rui', 'mODeYOGV2x', 736, '5Ij4llNNER', '107481465', '2012-07-14 09:08:25.000', 'lL7TVGCQD7', '2014-05-25 20:57:55.000', '2000-03-24 18:51:28.000', 1);
INSERT INTO `investment` VALUES (446, 'Fu Zitao', 'Fu Zitao', 'DTvlL9goCe', 962, 'VeDnvpHmQ2', '75585967294', '2022-12-03 04:43:00.000', 'Fyayh59J2U', '2004-09-08 04:57:34.000', '2022-11-30 04:06:49.000', 1);
INSERT INTO `investment` VALUES (447, 'Fujii Hikari', 'Fujii Hikari', 'WXYU2MIeyh', 793, 'yiM2Rz5FR6', '219915768', '2016-02-15 08:05:32.000', 'TKnEvCjUGH', '2022-07-19 23:36:46.000', '2024-02-13 17:23:11.000', 1);
INSERT INTO `investment` VALUES (448, 'Christopher Gordon', 'Christopher Gordon', 'u2QAi1yFv0', 653, 'esIEZOYBjc', '17837463281', '2019-02-07 20:37:19.000', 'VA54H6ly7F', '2016-11-07 02:19:30.000', '2025-01-20 08:24:09.000', 1);
INSERT INTO `investment` VALUES (449, 'Xu Shihan', 'Xu Shihan', 'zo5cCAFagf', 6, 'xpagMjOkcd', '2021727993', '2008-05-06 14:33:11.000', '2GuQs9pE3d', '2006-07-23 11:27:16.000', '2017-07-10 21:40:28.000', 1);
INSERT INTO `investment` VALUES (450, 'Yuan Shihan', 'Yuan Shihan', 'RM7f53uWrD', 850, '4xqFvTS4YO', '18640112266', '2010-06-15 10:54:00.000', 'igDiQscBgT', '2000-11-22 23:45:13.000', '2007-08-10 22:32:59.000', 1);
INSERT INTO `investment` VALUES (451, 'Kong Ka Ling', 'Kong Ka Ling', 'u36lZzxaeV', 71, 'rEyVzsyZdh', '17181722087', '2008-10-09 19:08:46.000', 'GEHKeX8pv7', '2007-02-20 05:15:00.000', '2011-12-27 20:07:26.000', 1);
INSERT INTO `investment` VALUES (452, 'Wu Ching Wan', 'Wu Ching Wan', 'cpnJ7rmGPt', 316, 'wa9RGmMvJx', '16446774681', '2014-05-04 10:34:59.000', 'Vuaxm4Yu2G', '2020-07-11 06:45:50.000', '2015-05-05 19:50:09.000', 1);
INSERT INTO `investment` VALUES (453, 'Jiang Lan', 'Jiang Lan', 'Ggv3o9MuAd', 201, 'eoZWtRSuv8', '13238637777', '2020-08-28 02:06:32.000', 'S6sM0xrDDB', '2015-09-08 19:57:14.000', '2025-01-07 03:21:08.000', 1);
INSERT INTO `investment` VALUES (454, 'Thelma Jordan', 'Thelma Jordan', 'rTrJwJVARx', 913, 'mJKA2HUHN5', '14318980545', '2024-03-17 01:16:05.000', 'WOwDVeYchu', '2014-10-19 14:40:53.000', '2016-06-08 15:21:42.000', 1);
INSERT INTO `investment` VALUES (455, 'Francisco Schmidt', 'Francisco Schmidt', 'xr51doaZiH', 139, 'Ldp8dvzmdN', '18142971278', '2018-10-05 13:05:11.000', 'l78qMS1Fuj', '2010-06-06 02:13:22.000', '2002-07-05 20:07:28.000', 1);
INSERT INTO `investment` VALUES (456, 'Gladys Perez', 'Gladys Perez', 'ExkrV4eXEQ', 361, '8c39A87Q90', '200552401', '2022-09-17 13:43:37.000', 'xjubTLrxjd', '2013-08-11 03:46:35.000', '2023-09-11 01:15:18.000', 1);
INSERT INTO `investment` VALUES (457, 'Ng Wai Lam', 'Ng Wai Lam', 'k39blYMSnj', 257, 'FGcDW7ATRe', '19200127416', '2011-09-06 11:41:29.000', 'pa50H8Bilr', '2020-06-09 20:16:22.000', '2012-05-18 05:19:10.000', 1);
INSERT INTO `investment` VALUES (458, 'Kong Lan', 'Kong Lan', 'K9gHvcqsW5', 850, 'FiKzCqqIhq', '14693005525', '2015-07-20 11:13:06.000', '4yNmot28Fv', '2010-11-17 07:35:21.000', '2010-11-30 11:56:37.000', 1);
INSERT INTO `investment` VALUES (459, 'Han Lan', 'Han Lan', '9sAN7rktAt', 418, '0O2GfAt8rN', '7690676461', '2011-11-13 23:17:42.000', 'JNAwVjlXuH', '2009-06-26 17:17:22.000', '2018-08-30 03:38:13.000', 1);
INSERT INTO `investment` VALUES (460, 'Kobayashi Daichi', 'Kobayashi Daichi', 'ByOW7Apyam', 678, 'VAyVBUgXCK', '13057017938', '2012-11-25 06:39:42.000', 'OldER1gWkh', '2021-06-11 12:54:05.000', '2008-01-29 09:20:00.000', 1);
INSERT INTO `investment` VALUES (461, 'So Ka Fai', 'So Ka Fai', 'wKYtCuh6zv', 27, 'dx0sN7a1rR', '7606718954', '2009-10-09 09:23:42.000', 'EnlhUDAEy2', '2006-07-15 04:59:32.000', '2014-08-09 00:04:23.000', 1);
INSERT INTO `investment` VALUES (462, 'Qian Ziyi', 'Qian Ziyi', '2WRZQH51ak', 77, 'EWXCilY7f4', '7690878062', '2013-12-12 08:31:02.000', 'jG0WVhGYcf', '2013-06-24 06:06:40.000', '2000-08-08 11:51:43.000', 1);
INSERT INTO `investment` VALUES (463, 'Yau Wai San', 'Yau Wai San', 'z8845ZH0DD', 498, 'kR5iW5WoX2', '17233329381', '2003-05-12 05:00:38.000', 'mqbar49HcO', '2013-07-31 17:04:17.000', '2022-05-29 02:11:21.000', 1);
INSERT INTO `investment` VALUES (464, 'Alfred Reed', 'Alfred Reed', 'wX0sk7G0Nj', 970, 'Nk1v8iPt6Y', '210563792', '2019-06-12 17:33:54.000', 'CESTfyuGYt', '2005-08-31 10:36:25.000', '2013-11-23 08:34:48.000', 1);
INSERT INTO `investment` VALUES (465, 'Lin Zhiyuan', 'Lin Zhiyuan', 'VbcOcjA3Hh', 429, 'sp2j55NtLm', '281475671', '2003-06-29 23:12:54.000', 'WN4qcE9abn', '2014-07-05 16:52:02.000', '2019-02-24 16:34:36.000', 1);
INSERT INTO `investment` VALUES (466, 'Jiang Rui', 'Jiang Rui', 'AdfTCRA3qT', 642, 'FMiwxd3bkr', '18006676766', '2007-06-30 18:30:12.000', 'pclOvDzjpx', '2011-03-16 09:11:05.000', '2002-04-10 17:12:22.000', 1);
INSERT INTO `investment` VALUES (467, 'Au Siu Wai', 'Au Siu Wai', 'VR2ZYaF4p4', 486, 'BfEtkcHuww', '76024217303', '2009-12-27 03:54:02.000', 'BV7uYMx82k', '2021-03-02 02:53:25.000', '2023-04-21 18:22:24.000', 1);
INSERT INTO `investment` VALUES (468, 'Hao Ziyi', 'Hao Ziyi', 'VrJuwkbcob', 158, 'rEnBN4WDm5', '15471175855', '2014-02-12 19:44:51.000', 'ToZDSP2zoP', '2023-06-02 04:26:32.000', '2000-01-08 22:28:28.000', 1);
INSERT INTO `investment` VALUES (469, 'Eva Sanchez', 'Eva Sanchez', 'rVB1QABYAr', 113, 'rIEX1pDBas', '14274326529', '2008-05-24 00:54:34.000', '8J9BiUyQcB', '2003-02-27 23:48:04.000', '2005-03-14 16:16:55.000', 1);
INSERT INTO `investment` VALUES (470, 'Ichikawa Yuto', 'Ichikawa Yuto', 'IQpkAo1fc6', 698, 'oYLQ1vqywE', '15300931022', '2003-10-13 22:23:16.000', 'hsVmstJj8k', '2024-06-17 09:50:44.000', '2024-08-30 19:04:27.000', 1);
INSERT INTO `investment` VALUES (471, 'Richard Carter', 'Richard Carter', '6mwvlXAi0Y', 526, '8BCLgommFz', '7698645673', '2008-04-15 20:11:57.000', '99R2r95P8v', '2022-11-02 17:09:40.000', '2025-02-06 19:47:01.000', 1);
INSERT INTO `investment` VALUES (472, 'Sugiyama Rena', 'Sugiyama Rena', '59plhOqHQi', 674, '5rUAeOORW9', '2179775886', '2000-11-26 08:16:24.000', '2SAHX6x44r', '2019-04-29 00:43:26.000', '2022-03-25 10:08:53.000', 1);
INSERT INTO `investment` VALUES (473, 'Aoki Aoshi', 'Aoki Aoshi', 'vd9lMKLFVk', 794, 'SNhAxwbmOG', '18129384357', '2002-03-19 12:18:33.000', 'iXISaWK8fu', '2017-01-15 04:07:04.000', '2008-09-23 02:11:58.000', 1);
INSERT INTO `investment` VALUES (474, 'Yam Kwok Wing', 'Yam Kwok Wing', 'CaYIA4BPSn', 389, 'afoYjVvg9y', '18609719717', '2003-04-28 23:19:14.000', 'fKVgb4Pr2p', '2014-08-21 10:39:16.000', '2014-09-05 13:05:10.000', 1);
INSERT INTO `investment` VALUES (475, 'Nakamura Riku', 'Nakamura Riku', 'qNbsnsDVQ1', 399, 'yQoAyXSU9u', '100306239', '2024-12-19 23:37:52.000', '6z8lUD4seG', '2015-05-24 17:09:28.000', '2011-02-14 02:33:05.000', 1);
INSERT INTO `investment` VALUES (476, 'Larry Black', 'Larry Black', 'zL8RfIorQ1', 390, 'R2ZhWzoMQj', '75594700342', '2014-08-22 09:12:19.000', 'ZclB9pjagk', '2019-11-02 11:40:51.000', '2000-07-30 03:39:05.000', 1);
INSERT INTO `investment` VALUES (477, 'Qin Ziyi', 'Qin Ziyi', 'LPekd6GELZ', 773, 'FoE6vMER1F', '18440062263', '2008-11-28 05:27:00.000', 'AbU2pRqYc7', '2022-06-28 08:26:25.000', '2021-03-25 06:19:36.000', 1);
INSERT INTO `investment` VALUES (478, 'Fu Ming', 'Fu Ming', 'jQMNbAsPya', 472, 'vLkWP4etGo', '2044715742', '2025-02-04 06:51:18.000', 'Dl4F6owfeD', '2017-10-04 14:12:10.000', '2013-08-19 00:06:06.000', 1);
INSERT INTO `investment` VALUES (479, 'Hsuan Cho Yee', 'Hsuan Cho Yee', 't5pXponQzD', 399, '8v9rX0Q0kl', '15449244776', '2007-07-01 09:18:50.000', 'u3EbYQVpL5', '2006-09-07 18:54:00.000', '2016-06-20 13:42:26.000', 1);
INSERT INTO `investment` VALUES (480, 'Yamamoto Yota', 'Yamamoto Yota', 'm6Y8kMluZC', 678, 'e51vKVrRfG', '2163348448', '2000-07-10 15:51:11.000', 'dwXljLfxO5', '2007-08-26 04:45:15.000', '2008-02-22 13:37:08.000', 1);
INSERT INTO `investment` VALUES (481, 'Yuen Sum Wing', 'Yuen Sum Wing', 'McLZTC1dTf', 806, 'NXyXrBqAH0', '17846479483', '2014-05-11 08:42:10.000', 'qwOfTLLCm9', '2021-07-05 19:02:17.000', '2000-08-24 09:17:53.000', 1);
INSERT INTO `investment` VALUES (482, 'Cui Anqi', 'Cui Anqi', 'p4jJxVt4Rq', 993, 'Q75Ds4G70h', '76073312021', '2016-12-30 08:58:46.000', 'BmmATeuaxu', '2002-05-23 05:34:37.000', '2006-09-04 18:53:59.000', 1);
INSERT INTO `investment` VALUES (483, 'Amy Simmons', 'Amy Simmons', 'PlJbaiKG8J', 141, '34pRNKwyPF', '17201153946', '2012-06-22 01:57:58.000', 'jvgCOVzV2E', '2009-09-15 06:32:36.000', '2016-11-01 10:47:10.000', 1);
INSERT INTO `investment` VALUES (484, 'Taniguchi Aoshi', 'Taniguchi Aoshi', '0f5VdAlLUZ', 283, 'EfaDLJM2SU', '17262087443', '2015-05-18 13:04:16.000', 'bM92I4mxEE', '2016-09-03 10:38:55.000', '2007-12-23 07:32:25.000', 1);
INSERT INTO `investment` VALUES (485, 'Jeffery Collins', 'Jeffery Collins', 'ykmzcvinC4', 907, 'FAMYNrTztp', '7557839132', '2008-02-04 12:35:57.000', 'QrXVFK5m40', '2003-09-15 12:39:25.000', '2022-05-13 02:40:19.000', 1);
INSERT INTO `investment` VALUES (486, 'Yao Zhiyuan', 'Yao Zhiyuan', 'nzOW2thOp8', 487, 'lCzqjE1Ya2', '203115884', '2002-01-19 17:04:01.000', 'VQ0yyJ82u1', '2007-02-07 01:28:12.000', '2009-03-07 09:04:45.000', 1);
INSERT INTO `investment` VALUES (487, 'Tse Kwok Yin', 'Tse Kwok Yin', 'P1bO7JyKci', 102, '6v00Wseupe', '283675339', '2003-06-28 01:05:37.000', 'KbdALoXX1m', '2011-08-19 22:34:14.000', '2011-06-21 12:36:49.000', 1);
INSERT INTO `investment` VALUES (488, 'Hasegawa Rena', 'Hasegawa Rena', 'D8mow0c8zy', 642, 'ZLnHT0Jm8V', '18493855236', '2012-12-18 00:25:47.000', 'KnjFHLRKM7', '2003-03-01 00:12:17.000', '2011-06-05 00:23:45.000', 1);
INSERT INTO `investment` VALUES (489, 'Arimura Miu', 'Arimura Miu', '49jmhczlfh', 445, 'EU7Ce9suYZ', '19976496166', '2022-06-06 11:44:10.000', 'CkFgtLKfq2', '2002-10-15 17:51:34.000', '2003-06-30 00:24:23.000', 1);
INSERT INTO `investment` VALUES (490, 'Sherry Ellis', 'Sherry Ellis', 'hGR6sUj3Ax', 418, 'IY1CN19NFW', '1009683303', '2024-09-24 11:25:22.000', 'gTFtK6dhGu', '2002-02-24 06:51:52.000', '2011-03-18 19:35:49.000', 1);
INSERT INTO `investment` VALUES (491, 'Marvin Jordan', 'Marvin Jordan', 'uXL75ESU3W', 506, 'VqIjHFKijp', '18765681544', '2015-05-02 12:52:05.000', 'usOADuwlxl', '2019-10-14 04:32:59.000', '2007-10-26 00:13:44.000', 1);
INSERT INTO `investment` VALUES (492, 'Ikeda Kazuma', 'Ikeda Kazuma', 'oFYJmW1tXa', 462, 'DB8XM7OoO7', '281793172', '2004-09-27 23:31:36.000', 'WmpH7hoqxL', '2009-07-12 04:32:47.000', '2001-11-20 15:13:23.000', 1);
INSERT INTO `investment` VALUES (493, 'Imai Mio', 'Imai Mio', '4ydAJhIMTR', 562, 'wTVQpXY55z', '105779650', '2021-09-07 22:21:08.000', 'LBvVxzpjyx', '2016-08-29 19:28:04.000', '2025-02-19 02:54:02.000', 1);
INSERT INTO `investment` VALUES (494, 'Sugawara Ryota', 'Sugawara Ryota', 'YcV8z8svE3', 677, 'Rd3Ik10Lup', '13780873762', '2010-02-25 08:13:46.000', 'u2f4q2npRe', '2007-06-21 15:57:59.000', '2002-10-24 11:32:51.000', 1);
INSERT INTO `investment` VALUES (495, 'Tao Kwok Yin', 'Tao Kwok Yin', 'o8ntK16ACm', 641, 'm9v0g7cJDH', '2017296252', '2016-04-18 18:01:57.000', 'mnEBzXt6i2', '2008-06-03 13:32:38.000', '2022-05-07 09:46:02.000', 1);
INSERT INTO `investment` VALUES (496, 'Pang Ming', 'Pang Ming', 'Aa1KGzpFVK', 757, 'LzX2c0T2Qz', '13350705058', '2010-03-25 00:35:58.000', 'WwhL3i001J', '2021-07-05 04:17:45.000', '2021-11-22 21:17:38.000', 1);
INSERT INTO `investment` VALUES (497, 'Chiang Wai Yee', 'Chiang Wai Yee', 'zJwKnvM256', 512, '2J7n3QL6oV', '2080354632', '2003-10-11 10:40:18.000', 'Spn9625AsP', '2004-01-23 20:23:55.000', '2017-05-29 18:49:14.000', 1);
INSERT INTO `investment` VALUES (498, 'Ying Wing Suen', 'Ying Wing Suen', 'ffr6zjqRX7', 479, 'iwpxEf5Efa', '18436936216', '2017-05-31 03:03:40.000', 'tdN0MtuLpp', '2012-12-04 03:58:58.000', '2018-05-03 07:50:14.000', 1);
INSERT INTO `investment` VALUES (499, 'Julie Alexander', 'Julie Alexander', 'QTvB35NNHj', 538, '2uo7KJ9iZ1', '209481607', '2003-06-04 17:48:08.000', 'ZfFU0SRk3M', '2011-03-22 15:28:04.000', '2013-09-04 00:17:33.000', 1);
INSERT INTO `investment` VALUES (500, 'Yue Wai San', 'Yue Wai San', 'uxWvlQaIl5', 795, '4P3zUqwhE0', '7694482072', '2023-06-09 23:12:31.000', 'zyP9Uv0Sxs', '2007-06-06 12:51:22.000', '2001-05-19 20:33:26.000', 1);
INSERT INTO `investment` VALUES (501, 'Endo Tsubasa', 'Endo Tsubasa', '3auosz4pNu', 401, '6f7jZIuBwq', '7556903861', '2017-06-07 08:36:04.000', 'tXsvtNoeDQ', '2021-02-26 09:10:07.000', '2010-01-08 20:38:55.000', 1);
INSERT INTO `investment` VALUES (502, 'Victoria Torres', 'Victoria Torres', 'l3IBfyye22', 40, '1hKLSHB9Gq', '76935136620', '2019-02-14 08:00:00.000', 'ponuW7EkUQ', '2001-11-09 12:40:32.000', '2010-04-05 05:13:23.000', 1);
INSERT INTO `investment` VALUES (503, 'Gao Xiuying', 'Gao Xiuying', 'YRtRI53Chv', 805, 'VE3VbmP9iD', '201842018', '2023-09-05 19:01:06.000', 'JeUWahBueQ', '2014-08-09 07:05:51.000', '2001-11-27 16:50:09.000', 1);
INSERT INTO `investment` VALUES (504, 'Xie Jialun', 'Xie Jialun', 'mNnvpoRmOP', 855, 'uPrdLzjBPU', '16414578453', '2010-10-06 03:45:30.000', 'AFeVbcRb49', '2019-03-04 13:18:52.000', '2017-05-13 20:25:31.000', 1);
INSERT INTO `investment` VALUES (505, 'Ronald Green', 'Ronald Green', 'rgk2tPGVht', 236, 'vmg4KXv31B', '2887556901', '2019-04-18 17:18:58.000', '4P5o64mit8', '2007-02-11 21:10:06.000', '2023-04-25 11:01:31.000', 1);
INSERT INTO `investment` VALUES (506, 'Sato Seiko', 'Sato Seiko', '7V8RaMQ2QX', 170, '2i3qNnu44O', '14406654624', '2013-10-28 18:38:04.000', '7vEO5EpMu1', '2002-08-07 08:50:06.000', '2017-08-10 19:47:00.000', 1);
INSERT INTO `investment` VALUES (507, 'Hao Zhennan', 'Hao Zhennan', 'VyAt0KBUdO', 222, 'ioVboU59vx', '7603282706', '2022-08-09 12:51:09.000', '6KRUelW33t', '2001-05-31 08:59:53.000', '2007-02-26 17:55:21.000', 1);
INSERT INTO `investment` VALUES (508, 'Zhang Lan', 'Zhang Lan', 'HfEOQt1jLE', 352, 'lcqLgqjLPZ', '15297896704', '2014-07-29 18:10:54.000', '2whzpcIrCO', '2014-11-30 18:10:34.000', '2021-10-14 00:29:18.000', 1);
INSERT INTO `investment` VALUES (509, 'Yang Ziyi', 'Yang Ziyi', 'lHRmmEY2cK', 377, 'YZaodo0jF2', '7601936249', '2013-05-25 06:13:40.000', 'MTRTv8PBhs', '2019-11-30 20:37:41.000', '2019-03-21 12:08:10.000', 1);
INSERT INTO `investment` VALUES (510, 'Xia Zhiyuan', 'Xia Zhiyuan', 'jybnU60Q6M', 576, 'Q91bnfRTVd', '14353551191', '2006-06-29 06:03:45.000', 'PAkE3a2dpd', '2014-03-15 16:33:19.000', '2012-09-24 03:19:46.000', 1);
INSERT INTO `investment` VALUES (511, 'Choi Ming Sze', 'Choi Ming Sze', 'PiS5ndFuW1', 132, 'w2HuoCn82i', '17085912590', '2000-07-06 07:42:21.000', 'FMENxeO0Qa', '2016-05-21 18:40:28.000', '2019-11-17 16:12:59.000', 1);
INSERT INTO `investment` VALUES (512, 'Yue Tsz Ching', 'Yue Tsz Ching', 'srvUlFjjrS', 960, 'Gaknp4eyDV', '7554752502', '2002-05-20 17:50:16.000', 'JOrxVn38n7', '2022-03-23 19:53:28.000', '2005-07-20 01:28:58.000', 1);
INSERT INTO `investment` VALUES (513, 'Ku Yun Fat', 'Ku Yun Fat', 'hQ8Uy8Jcv9', 66, '5LzVzRynfn', '14397140569', '2008-01-28 02:53:20.000', 'eZj3qzWF58', '2014-08-29 06:17:59.000', '2005-01-17 23:44:31.000', 1);
INSERT INTO `investment` VALUES (514, 'Michelle Herrera', 'Michelle Herrera', 'dqN1LucNBa', 815, '76HQmWtDwG', '16371334620', '2006-04-22 18:08:53.000', '2VV2nBqIwk', '2000-03-28 03:36:48.000', '2006-01-28 02:55:41.000', 1);
INSERT INTO `investment` VALUES (515, 'Kong Xiaoming', 'Kong Xiaoming', 'FY1pEySRoF', 346, 'gnuFznqBTa', '18449101376', '2003-03-23 20:23:40.000', 'LkVO03I5gv', '2014-10-17 05:10:38.000', '2004-05-23 09:09:23.000', 1);
INSERT INTO `investment` VALUES (516, 'Gloria Coleman', 'Gloria Coleman', 'rjK9IJOc93', 390, 'OwiUKKgDiw', '13978651589', '2016-08-17 23:13:02.000', 'E1SLlzccKJ', '2023-08-21 22:47:50.000', '2004-12-21 16:06:14.000', 1);
INSERT INTO `investment` VALUES (517, 'Martha Mason', 'Martha Mason', 'zauvkmi6Sr', 304, '3PQTQuqfHC', '205149949', '2018-10-16 20:31:45.000', 'ejZMPP5pBp', '2008-05-15 18:23:28.000', '2005-06-28 07:53:38.000', 1);
INSERT INTO `investment` VALUES (518, 'Fujiwara Rena', 'Fujiwara Rena', 'Ucpf8ewEyP', 812, 'ZMtEnM2lWj', '18950126388', '2009-10-20 07:55:18.000', '2KEJ9shOdH', '2012-08-02 09:56:41.000', '2016-08-14 05:37:29.000', 1);
INSERT INTO `investment` VALUES (519, 'Yuen Tin Lok', 'Yuen Tin Lok', 'XY8AbYoNnW', 72, 'uNOIBAONNS', '2156615091', '2013-12-22 12:54:29.000', 'A7wLFx0iIa', '2016-08-01 06:07:12.000', '2020-09-10 10:35:53.000', 1);
INSERT INTO `investment` VALUES (520, 'Gladys Mcdonald', 'Gladys Mcdonald', 'CUpjYseS4F', 845, 'FUV8dyXVFF', '15988695934', '2001-08-15 10:14:58.000', 'qHx5LgpHSE', '2000-08-21 02:12:14.000', '2000-10-30 14:33:59.000', 1);
INSERT INTO `investment` VALUES (521, 'Christine Barnes', 'Christine Barnes', '49hHHfJPop', 332, 'uhFHS5FMik', '207461641', '2024-08-20 18:42:00.000', 'cWfVXwsIyO', '2019-07-13 20:22:27.000', '2016-09-16 11:00:05.000', 1);
INSERT INTO `investment` VALUES (522, 'Elizabeth Perez', 'Elizabeth Perez', '4ZCdgXxp3p', 431, '6T8Hj00P1z', '287098556', '2000-02-05 19:25:39.000', 'ig4ShhaYsM', '2024-06-18 23:27:37.000', '2019-01-25 21:24:06.000', 1);
INSERT INTO `investment` VALUES (523, 'Chiba Sara', 'Chiba Sara', 'EaZpB6eobg', 890, 'Jqky8F6wyJ', '13586224662', '2005-11-22 18:02:02.000', 'XgUXsz4Nvk', '2016-12-19 02:56:42.000', '2002-01-16 07:16:18.000', 1);
INSERT INTO `investment` VALUES (524, 'Sasaki Seiko', 'Sasaki Seiko', 'EyAgEtchVh', 183, 'JkoU9QKsut', '1069982113', '2024-09-16 10:06:59.000', 'TN8lHqCYu0', '2020-06-06 22:26:18.000', '2004-05-08 11:01:41.000', 1);
INSERT INTO `investment` VALUES (525, 'Xia Lu', 'Xia Lu', 'Z90USkT5Hs', 294, 'v16sDJ3CNu', '109965627', '2004-11-26 04:02:58.000', 'hVD9vFYFUa', '2007-07-19 11:57:02.000', '2023-10-30 16:15:42.000', 1);
INSERT INTO `investment` VALUES (526, 'Miura Riku', 'Miura Riku', 'hI3NYmtZMu', 44, '2gkwiAHz7Y', '19872514204', '2009-09-03 20:34:08.000', '2y3FVixtuK', '2020-09-08 06:11:28.000', '2018-02-23 14:08:08.000', 1);
INSERT INTO `investment` VALUES (527, 'Thelma Baker', 'Thelma Baker', 'Jv5oVwriqH', 540, 'kJWqc8PYCu', '16308328254', '2009-10-15 13:02:39.000', 'HGFVBkMJ7H', '2012-09-04 10:34:04.000', '2022-02-12 14:14:13.000', 1);
INSERT INTO `investment` VALUES (528, 'Clifford Spencer', 'Clifford Spencer', 'mCzkVPqJcQ', 250, 'LTo2seNESD', '2036032221', '2008-10-05 02:35:40.000', 'TlmXAZ8V7Z', '2017-05-29 02:59:36.000', '2005-07-30 22:14:32.000', 1);
INSERT INTO `investment` VALUES (530, 'Zheng Anqi', 'Zheng Anqi', 'amKmD4MfrD', 613, '6zwysjXCis', '18058034786', '2009-05-03 18:14:18.000', 'ipe9TW1IQW', '2001-12-02 03:43:39.000', '2018-12-10 22:06:27.000', 1);
INSERT INTO `investment` VALUES (531, 'Brandon Patterson', 'Brandon Patterson', 'D54kXOh1zB', 551, 'ryYTgSHBqW', '2185545624', '2011-10-26 08:33:33.000', 'PYUKP309kv', '2012-03-22 06:52:23.000', '2022-02-27 18:24:31.000', 1);
INSERT INTO `investment` VALUES (532, 'Aoki Kasumi', 'Aoki Kasumi', 'gANiyrVEMt', 847, 'ElGAyccRA3', '13877914805', '2004-01-01 10:23:47.000', 'yB0vZRfUVo', '2016-05-15 02:41:38.000', '2008-09-30 06:21:47.000', 1);
INSERT INTO `investment` VALUES (533, 'Maeda Eita', 'Maeda Eita', 'P7dbBv9opX', 351, '7C4paSgrxt', '208182095', '2018-05-02 15:57:49.000', '8y0oIGsRCb', '2024-07-07 21:06:09.000', '2015-12-10 02:49:24.000', 1);
INSERT INTO `investment` VALUES (534, 'Nakano Hikaru', 'Nakano Hikaru', '6MeAUMHPLo', 759, 'MvtxyVi5cX', '17841150810', '2004-04-27 19:03:53.000', 'JFL5YbBgcf', '2013-12-12 16:25:03.000', '2022-04-09 00:02:49.000', 1);
INSERT INTO `investment` VALUES (535, 'Mao Xiaoming', 'Mao Xiaoming', '3p0Rome8QA', 501, 'Ghrpu00gZ1', '19870814171', '2017-07-07 11:08:52.000', 'atwdeUx0Ty', '2004-02-24 19:05:36.000', '2015-06-29 18:22:36.000', 1);
INSERT INTO `investment` VALUES (536, 'He Zhiyuan', 'He Zhiyuan', 'Mkn7N7bCVK', 159, 'oUZIOQGWyo', '7601538757', '2015-09-28 06:09:49.000', 'LQyEDwRWGY', '2012-06-02 21:44:11.000', '2009-10-05 10:20:49.000', 1);
INSERT INTO `investment` VALUES (537, 'Lo Yun Fat', 'Lo Yun Fat', 'EDsYMCOfko', 383, 'jeTsCtByHx', '2197914627', '2020-11-24 18:03:42.000', 'jHwdtM0o9m', '2013-12-25 08:59:07.000', '2021-06-21 21:15:49.000', 1);
INSERT INTO `investment` VALUES (538, 'Julie Cooper', 'Julie Cooper', 'Sdlz5A3Sko', 520, '7DHm2jeHJQ', '280861744', '2023-12-26 18:33:17.000', 'qPMsDhzCZ0', '2008-01-19 04:45:05.000', '2015-10-29 01:34:37.000', 1);
INSERT INTO `investment` VALUES (539, 'Yoshida Mio', 'Yoshida Mio', 'vbxU7WHQff', 854, 'LzQbNJvdNr', '14151972467', '2008-12-16 12:42:31.000', 'alasUSH6Po', '2014-06-26 01:45:16.000', '2009-04-18 04:28:56.000', 1);
INSERT INTO `investment` VALUES (540, 'Zhu Xiuying', 'Zhu Xiuying', '12yGoGBD1L', 43, 'CFL2XW3Y2K', '76070934226', '2011-06-04 06:19:33.000', '7aQhXS6Ipk', '2025-02-01 06:48:48.000', '2023-12-09 20:51:40.000', 1);
INSERT INTO `investment` VALUES (541, 'Nakayama Takuya', 'Nakayama Takuya', 'dinmffuKtQ', 946, '5YGSiUejg4', '7551681065', '2012-02-09 05:35:07.000', '9OigfapJfe', '2010-10-25 16:09:21.000', '2020-06-15 06:05:13.000', 1);
INSERT INTO `investment` VALUES (542, 'Meng Wai San', 'Meng Wai San', '5X6EbIas61', 138, 'nWIzaJEBG1', '76053924460', '2014-11-22 16:32:23.000', 'njPVZAzZhx', '2021-05-01 12:58:38.000', '2012-04-28 12:15:10.000', 1);
INSERT INTO `investment` VALUES (543, 'Sugiyama Kenta', 'Sugiyama Kenta', 'BWVcPk78OK', 284, 'beG02pPzKw', '16194570065', '2004-04-07 22:23:01.000', 'T6FvycKJNO', '2010-08-06 17:23:11.000', '2010-10-15 13:02:28.000', 1);
INSERT INTO `investment` VALUES (544, 'Fukuda Takuya', 'Fukuda Takuya', 'yrPTfF8562', 521, '73WU5IR7GA', '18469320778', '2004-06-04 18:09:03.000', 'MAiJoPTUQE', '2024-10-15 17:16:54.000', '2021-01-05 17:35:44.000', 1);
INSERT INTO `investment` VALUES (545, 'Fukuda Rena', 'Fukuda Rena', 'UQUtpbemQO', 745, 'ov80xWy2Yf', '17693813512', '2024-03-03 05:32:42.000', 'fU75Tbq3VN', '2005-10-08 01:24:15.000', '2016-08-30 22:27:27.000', 1);
INSERT INTO `investment` VALUES (546, 'Kenneth Gardner', 'Kenneth Gardner', 'qYGSI1uX0V', 672, 'Z8AH6HMRfA', '2144923749', '2002-11-11 13:53:00.000', '7G0K4kyNyq', '2014-02-26 05:16:49.000', '2014-01-10 15:56:24.000', 1);
INSERT INTO `investment` VALUES (547, 'Ueno Yuto', 'Ueno Yuto', 'boYp5XvpBf', 139, 'ofwumJM8p8', '2030881287', '2010-05-12 09:44:23.000', 'XGCflbtLtg', '2016-12-24 20:21:30.000', '2007-02-17 13:15:00.000', 1);
INSERT INTO `investment` VALUES (548, 'Chung Tsz Hin', 'Chung Tsz Hin', 'zkYyVb9G7u', 984, '0GYp5abrNV', '13391306979', '2021-08-08 01:48:41.000', 'wzmog4BBLm', '2011-06-11 05:08:02.000', '2003-04-06 21:36:42.000', 1);
INSERT INTO `investment` VALUES (549, 'Christopher Garza', 'Christopher Garza', 'kAyMOpaqRf', 741, 'TxQin5nYhg', '76983725372', '2005-04-22 22:20:48.000', 'IUsAIp0hO6', '2015-05-02 16:25:14.000', '2014-10-08 15:35:57.000', 1);
INSERT INTO `investment` VALUES (550, 'Xiao Zhiyuan', 'Xiao Zhiyuan', '2bqoJEibfP', 97, 'Fg56CSHdNh', '15225972675', '2009-05-24 21:41:22.000', 'qMkZXrzybJ', '2004-01-04 02:07:38.000', '2012-01-30 04:48:38.000', 1);
INSERT INTO `investment` VALUES (551, 'Elaine James', 'Elaine James', 'qr8S6D5mSn', 569, 'yRqhWb59Zg', '76082698629', '2003-06-10 09:26:33.000', 'zHRoL5I259', '2001-01-04 07:48:06.000', '2017-12-15 23:33:46.000', 1);
INSERT INTO `investment` VALUES (552, 'Fong Sau Man', 'Fong Sau Man', '9KNUbP5oYE', 681, '181L4mp6Ts', '15737114267', '2008-01-06 08:48:52.000', '82Lxrmhwk8', '2003-02-12 23:37:14.000', '2008-08-31 12:19:21.000', 1);
INSERT INTO `investment` VALUES (553, 'Tony Vasquez', 'Tony Vasquez', 'L2GjecxbPl', 56, 'h0o1yTLXgT', '282288771', '2013-02-23 13:30:55.000', 'etDTmvEYoC', '2003-07-16 16:06:45.000', '2011-05-08 13:45:44.000', 1);
INSERT INTO `investment` VALUES (554, 'Shi Ziyi', 'Shi Ziyi', '3HrQLg9gLj', 971, 'sXc1301AHy', '13337379558', '2003-08-27 01:31:31.000', 'sc4drnd23C', '2010-10-21 11:43:11.000', '2005-12-22 03:39:01.000', 1);
INSERT INTO `investment` VALUES (555, 'Dai Chung Yin', 'Dai Chung Yin', 'FyTG9ix9OD', 339, 'QliSX9Fzb3', '75518714924', '2023-04-19 12:00:24.000', 'NIq4yhhaPr', '2022-01-01 16:09:30.000', '2005-11-24 21:11:15.000', 1);
INSERT INTO `investment` VALUES (556, 'Fan Chi Yuen', 'Fan Chi Yuen', 'eQv0cNuHsI', 394, 'mUgGlG5Wyi', '284826584', '2009-06-03 01:16:06.000', 'q5tSSmqwob', '2004-02-29 04:28:45.000', '2015-10-06 15:51:14.000', 1);
INSERT INTO `investment` VALUES (557, 'Kojima Aoi', 'Kojima Aoi', '0prfEPAeRS', 157, 'ZLN43YkR0i', '212487779', '2013-08-04 01:49:07.000', 'e6BIURKVbW', '2003-09-16 19:51:43.000', '2008-02-10 08:03:55.000', 1);
INSERT INTO `investment` VALUES (558, 'Huang Anqi', 'Huang Anqi', 'EEBIhUNJ23', 977, 'YOIZYUXOW6', '7609063944', '2018-02-07 21:09:43.000', 'HycmGNScGM', '2002-05-28 06:03:38.000', '2013-08-06 03:17:24.000', 1);
INSERT INTO `investment` VALUES (559, 'Tsui Kwok Kuen', 'Tsui Kwok Kuen', 'wd0ImaGW4r', 811, 'V6b8hFjgtl', '104961016', '2018-07-17 16:48:11.000', 'CXbpATIPqJ', '2005-02-13 16:41:55.000', '2011-08-26 02:40:09.000', 1);
INSERT INTO `investment` VALUES (560, 'Bruce Shaw', 'Bruce Shaw', 'JxDITBOqyn', 506, 'bFErWLBAEu', '107260517', '2001-10-12 21:02:13.000', 'QUTu5X2oT1', '2014-04-04 13:15:39.000', '2022-08-02 10:03:33.000', 1);
INSERT INTO `investment` VALUES (561, 'Karen Hall', 'Karen Hall', 'BvziCWLPeD', 509, 'RlLKZxHcxm', '75522242560', '2001-04-01 14:59:35.000', 'YPtbVclCD4', '2013-10-12 10:54:46.000', '2004-09-19 12:03:01.000', 1);
INSERT INTO `investment` VALUES (562, 'He Zhennan', 'He Zhennan', '2sRVBv8mdZ', 978, 'T45SSn1dkS', '100127462', '2023-07-15 21:51:35.000', 'TiDDqwSNyW', '2006-09-04 05:22:57.000', '2024-05-19 18:26:22.000', 1);
INSERT INTO `investment` VALUES (563, 'Kwan Ka Man', 'Kwan Ka Man', 'FxZIkSKoPW', 415, 'vgBFiMA5ed', '15699392418', '2021-05-09 16:22:20.000', 'Jsh1ayZCBx', '2018-04-12 15:11:26.000', '2007-11-17 16:30:24.000', 1);
INSERT INTO `investment` VALUES (564, 'Frederick Jenkins', 'Frederick Jenkins', 'zCun3vzbDu', 988, 'ANcP2pAkAR', '16771365759', '2006-03-02 22:24:40.000', 'U6eQFcBl8Q', '2009-06-26 13:44:40.000', '2020-01-04 09:22:41.000', 1);
INSERT INTO `investment` VALUES (565, 'Carmen Edwards', 'Carmen Edwards', 'VZRC4axY61', 295, 'frChOHMfXy', '1026912619', '2015-10-18 22:47:56.000', 'KKHqO2yVwx', '2000-12-04 15:20:01.000', '2024-03-20 19:08:23.000', 1);
INSERT INTO `investment` VALUES (566, 'Zhou Zitao', 'Zhou Zitao', 'fNdV8Nt1Gq', 194, '7QHKnXT4lC', '15632183932', '2000-01-01 09:27:44.000', 'SF6wJiDu60', '2006-06-16 13:53:59.000', '2008-04-14 16:48:18.000', 1);
INSERT INTO `investment` VALUES (567, 'Hara Ren', 'Hara Ren', 'aczbhfv7b2', 754, 'X6NE3u8mHJ', '19184182525', '2008-04-02 15:21:24.000', 'rgaM2Cnqpm', '2005-09-17 10:35:49.000', '2019-01-06 20:21:27.000', 1);
INSERT INTO `investment` VALUES (568, 'Wei Zitao', 'Wei Zitao', '5DuC9K3gLT', 534, 'OPnX2TatBh', '76023093882', '2024-06-13 16:23:20.000', 'VNmt6Jw2Pd', '2003-01-03 14:58:54.000', '2012-03-16 15:12:55.000', 1);
INSERT INTO `investment` VALUES (569, 'Hao Zitao', 'Hao Zitao', 'rGmnDbXzth', 711, 'qBwtfGr7cY', '13454100245', '2024-09-03 20:16:02.000', 'hw6tUTk4wm', '2010-03-19 21:02:12.000', '2012-06-12 17:20:24.000', 1);
INSERT INTO `investment` VALUES (570, 'Henry Diaz', 'Henry Diaz', 'qwUKWGtx5S', 242, 'M7Iz0j4nsH', '2058319324', '2022-11-21 13:10:48.000', 'JRQu8L3iDa', '2023-01-07 21:53:14.000', '2020-05-04 08:36:59.000', 1);
INSERT INTO `investment` VALUES (571, 'Kobayashi Rin', 'Kobayashi Rin', 'q6Hh3gXYhS', 103, 'du4JtjWQkw', '19822199837', '2000-06-21 04:16:04.000', 'E7QA48gh1D', '2013-06-01 21:49:17.000', '2012-07-04 19:45:11.000', 1);
INSERT INTO `investment` VALUES (572, 'Qin Lu', 'Qin Lu', 'p2adFFbP6y', 427, 'gSg2Faln8S', '15311870841', '2014-08-11 16:49:56.000', 'RYbo5YeP8U', '2020-11-22 07:50:15.000', '2010-01-29 22:16:30.000', 1);
INSERT INTO `investment` VALUES (573, 'Nomura Kenta', 'Nomura Kenta', 'Soh7TtcwF5', 311, 'c8SoI68MTV', '282813548', '2011-04-13 16:45:37.000', 'eq4k250zWH', '2009-08-08 22:38:13.000', '2000-10-24 16:42:07.000', 1);
INSERT INTO `investment` VALUES (574, 'He Xiuying', 'He Xiuying', 'sP80AiyocY', 776, 'AkgDzgxLXp', '100838542', '2014-10-20 03:49:14.000', 'lNBggLtO9u', '2019-03-30 21:26:14.000', '2012-05-11 21:58:42.000', 1);
INSERT INTO `investment` VALUES (575, 'Xu Jialun', 'Xu Jialun', 'HFxNFRIzSP', 35, 'qOndCUmy0d', '17759484238', '2011-09-03 07:11:45.000', 'hu0GhcDCgd', '2022-12-22 00:27:12.000', '2003-03-31 07:46:04.000', 1);
INSERT INTO `investment` VALUES (576, 'Yao Jiehong', 'Yao Jiehong', '0qYpZAn2ZN', 57, 'Xg7qpfuxSd', '1039461133', '2023-02-02 01:06:43.000', 'fQ29b0TJzS', '2018-05-05 15:11:57.000', '2023-03-19 09:20:12.000', 1);
INSERT INTO `investment` VALUES (577, 'Miura Minato', 'Miura Minato', 'E61tPyXY4c', 874, 'A7cpztPU6c', '18549218683', '2015-09-06 16:18:08.000', 'YwM8fpNDr8', '2023-06-06 07:17:39.000', '2013-07-10 22:24:51.000', 1);
INSERT INTO `investment` VALUES (578, 'Shao Xiuying', 'Shao Xiuying', 'pYX62JJbZY', 596, 'jngf8O1m8C', '13587434542', '2019-07-03 02:23:13.000', 'uHWu9cSDPC', '2006-11-07 08:55:38.000', '2013-05-03 16:35:54.000', 1);
INSERT INTO `investment` VALUES (579, 'Danielle Cooper', 'Danielle Cooper', '00ISxrikdM', 40, 'Spm99lEQFS', '7604202473', '2007-05-20 00:04:03.000', 'ntRI80okRk', '2014-10-27 15:43:39.000', '2003-12-19 17:35:19.000', 1);
INSERT INTO `investment` VALUES (580, 'Wendy Robertson', 'Wendy Robertson', '1xYo7gki39', 744, 'JQLPuvZjWt', '200344098', '2011-01-19 15:29:33.000', 'qDn9IY12aR', '2014-04-18 21:10:58.000', '2008-10-27 16:26:45.000', 1);
INSERT INTO `investment` VALUES (581, 'Nakano Yuto', 'Nakano Yuto', 'FyJJMLeOor', 748, '3hzzSa3U59', '76974870243', '2021-02-12 13:26:04.000', 'WdW3w5w8p5', '2003-09-21 21:06:58.000', '2009-06-29 00:36:01.000', 1);
INSERT INTO `investment` VALUES (582, 'Kyle Grant', 'Kyle Grant', 'rKoBDnAno4', 557, 'LSuFbya1TK', '13864106389', '2024-01-18 11:59:49.000', 'VPJK2eDxss', '2007-11-12 01:11:49.000', '2016-09-26 06:23:59.000', 1);
INSERT INTO `investment` VALUES (583, 'Guo Ziyi', 'Guo Ziyi', 'wT5fZ4Aoh3', 972, '2qH5Hn0hME', '13191086858', '2022-04-11 09:22:52.000', '2oLaSF9o4L', '2023-10-26 06:33:17.000', '2023-06-17 06:55:26.000', 1);
INSERT INTO `investment` VALUES (584, 'Yeung Siu Wai', 'Yeung Siu Wai', 'GqQEK3nhcP', 162, '50Wjksai8I', '7697694145', '2000-07-08 02:28:08.000', 'OFJpQP4AaM', '2018-01-27 18:27:43.000', '2017-12-14 12:13:41.000', 1);
INSERT INTO `investment` VALUES (585, 'Hsuan Lik Sun', 'Hsuan Lik Sun', 'v7jk1yX8WZ', 671, 'v2jrGQzxiD', '2147228364', '2014-05-31 22:50:31.000', 'OyObO6Emdm', '2011-01-19 07:12:42.000', '2024-01-04 12:51:17.000', 1);
INSERT INTO `investment` VALUES (586, 'Mike Romero', 'Mike Romero', '1WlrRlV2Nv', 614, 'vMwEz3VpiK', '2020236020', '2010-09-06 11:54:15.000', 'xQD3vUUH45', '2005-08-04 23:07:55.000', '2020-05-26 14:41:12.000', 1);
INSERT INTO `investment` VALUES (587, 'Henry Long', 'Henry Long', 'wHdueIIJO8', 759, 'rrZH3JUUGc', '2074167117', '2017-05-14 03:07:42.000', 'gxewJvazTO', '2016-08-21 06:39:42.000', '2021-03-27 10:01:59.000', 1);
INSERT INTO `investment` VALUES (588, 'Liu Anqi', 'Liu Anqi', 'OZ4SvkxKtQ', 734, 'BK8MOcSoPd', '75584951332', '2025-02-06 20:39:15.000', 'JHYLJkA49B', '2018-04-12 09:47:35.000', '2004-09-21 06:53:06.000', 1);
INSERT INTO `investment` VALUES (589, 'Man Hiu Tung', 'Man Hiu Tung', 'iPTxH03o3x', 853, 'F01DsKVKvW', '75534306887', '2009-05-20 16:50:47.000', '7XpVZC27lM', '2004-09-25 05:22:07.000', '2000-03-07 19:00:02.000', 1);
INSERT INTO `investment` VALUES (590, 'Nancy West', 'Nancy West', 'Hb5vemzcLY', 207, '9KMiOSy1nR', '13576027413', '2011-11-23 19:47:10.000', 'H3U6dGTmUB', '2003-05-31 17:21:50.000', '2022-07-29 03:56:55.000', 1);
INSERT INTO `investment` VALUES (591, 'Nathan Thomas', 'Nathan Thomas', '43yBlGMh98', 188, 'rCcooHK2B9', '18142338396', '2014-11-02 07:09:23.000', '2nIcKpbxwC', '2009-07-15 10:07:06.000', '2018-02-09 15:21:00.000', 1);
INSERT INTO `investment` VALUES (592, 'Craig Stone', 'Craig Stone', 'PjRXo2Lf26', 682, 'QvgpZC8ZRz', '19957770572', '2000-01-31 06:22:46.000', 'bhowO6hsQh', '2004-09-20 14:26:29.000', '2008-11-10 11:36:49.000', 1);
INSERT INTO `investment` VALUES (593, 'Su Zhiyuan', 'Su Zhiyuan', 'XN836yIZ8R', 992, 'd2yCCgsIIA', '2138022242', '2017-04-09 20:42:24.000', 'K4HT9vdVT0', '2003-06-18 19:50:03.000', '2025-03-26 08:39:22.000', 1);
INSERT INTO `investment` VALUES (594, 'Maria Vasquez', 'Maria Vasquez', 'wUKSvpt9f3', 133, 'VzdnmeWaaF', '214656107', '2006-05-11 02:59:11.000', 'fI63RrM5R5', '2001-11-21 06:19:31.000', '2022-04-14 14:56:11.000', 1);
INSERT INTO `investment` VALUES (595, 'Mary Rodriguez', 'Mary Rodriguez', 'z5d0RfZ6vP', 450, '5BMIHCTWRW', '7697054897', '2019-02-14 15:36:32.000', 'Ab9H2sb5TU', '2020-09-18 22:15:04.000', '2005-11-06 03:10:32.000', 1);
INSERT INTO `investment` VALUES (596, 'Tang Xiaoming', 'Tang Xiaoming', 'N2ujHgUa3r', 400, 'Do17EC2DGW', '17560994373', '2011-09-21 13:09:06.000', 'lyXU1JP3x8', '2017-01-15 12:42:37.000', '2016-01-24 05:33:13.000', 1);
INSERT INTO `investment` VALUES (597, 'Takada Ayato', 'Takada Ayato', 'jugluEP8X7', 646, '2YGSnE493E', '19439576483', '2024-11-02 05:28:34.000', 'wWZJCgb0tE', '2016-12-04 05:18:36.000', '2000-03-26 10:42:11.000', 1);
INSERT INTO `investment` VALUES (598, 'Joseph Price', 'Joseph Price', 'xB0aqP9eXU', 146, 'St7QCfcKWF', '18355415156', '2017-05-01 03:23:36.000', 'xQZ1x4YgaY', '2003-07-04 03:09:50.000', '2019-09-30 16:02:37.000', 1);
INSERT INTO `investment` VALUES (599, 'Lo Lai Yan', 'Lo Lai Yan', 'fEI9f7ifRH', 50, 'OYmoTvDrt2', '109130205', '2007-11-15 08:12:58.000', 'B198joctBO', '2015-08-05 01:45:03.000', '2013-03-24 08:26:02.000', 1);
INSERT INTO `investment` VALUES (600, 'Okada Kazuma', 'Okada Kazuma', 'AMST36Z2CV', 730, 'D1acLXLsTr', '14876046716', '2012-07-14 08:52:14.000', '3tkam6GPGp', '2017-06-22 18:30:00.000', '2009-11-16 05:53:56.000', 1);
INSERT INTO `investment` VALUES (601, 'Yung Wai Han', 'Yung Wai Han', 'tId14XTqX8', 441, 'WgejqHeOpb', '13627489477', '2011-05-16 04:22:45.000', '7OJyyjcnNf', '2011-08-29 19:41:23.000', '2002-06-08 06:04:04.000', 1);
INSERT INTO `investment` VALUES (602, 'Sato Yota', 'Sato Yota', 'salcxazBmm', 287, '2IGxG7GMpi', '7556145038', '2019-08-25 15:42:11.000', 'D1HlwVqjDh', '2024-03-29 14:57:45.000', '2020-08-08 17:15:29.000', 1);
INSERT INTO `investment` VALUES (603, 'Tiffany Holmes', 'Tiffany Holmes', 'Yr7E2ZS5HW', 868, '6VaWGO6Z06', '17082455753', '2020-07-20 16:11:05.000', '45XpYoC6ve', '2002-02-23 01:49:26.000', '2005-08-22 18:24:44.000', 1);
INSERT INTO `investment` VALUES (604, 'Kong Tsz Ching', 'Kong Tsz Ching', 'PuqGqvgRoR', 689, '6x32bgFTsQ', '76016225336', '2009-02-15 04:27:10.000', 'hEGxcdpkzy', '2007-11-05 15:04:22.000', '2007-02-17 08:35:46.000', 1);
INSERT INTO `investment` VALUES (605, 'Marie Mendez', 'Marie Mendez', 'oLZi2zY1YI', 888, 'dB1lc5e6nU', '19226035384', '2021-12-02 01:52:26.000', 'ZVwLsCe7MO', '2015-07-11 09:20:36.000', '2006-07-15 18:18:27.000', 1);
INSERT INTO `investment` VALUES (606, 'Ishikawa Ren', 'Ishikawa Ren', 'P2oHFaNesZ', 361, 'FCNRIVTkgW', '19401917672', '2020-05-23 01:56:38.000', 'Ta2iQmu6tG', '2021-12-22 07:45:15.000', '2016-03-07 06:20:27.000', 1);
INSERT INTO `investment` VALUES (607, 'Yeow Wai Lam', 'Yeow Wai Lam', 'VjKKBxP8DV', 611, 'OZFg5CWrqk', '76092244748', '2023-08-01 04:29:46.000', 'pwm8zbqX1K', '2007-07-15 03:42:20.000', '2017-11-15 15:48:46.000', 1);
INSERT INTO `investment` VALUES (608, 'Harada Mai', 'Harada Mai', '579luURIeO', 634, 'fu0JP3Rj8r', '2846387875', '2014-04-11 15:03:44.000', 'ZzQpyXnaD1', '2000-06-17 06:51:55.000', '2002-03-26 20:45:29.000', 1);
INSERT INTO `investment` VALUES (609, 'Kato Sara', 'Kato Sara', 'flEbCj3pxe', 840, 'Reqzoa65CG', '215786875', '2021-01-06 08:14:32.000', 'A3VWtjHImS', '2016-09-02 11:05:38.000', '2010-05-15 09:25:26.000', 1);
INSERT INTO `investment` VALUES (610, 'Adam Bennett', 'Adam Bennett', '6JfqhvnOxo', 821, '9q85vNMPoi', '7691623429', '2000-08-06 19:01:53.000', 'HyhKg4idnp', '2023-02-25 02:39:29.000', '2002-12-17 15:54:32.000', 1);
INSERT INTO `investment` VALUES (611, 'Fung Sai Wing', 'Fung Sai Wing', 'KpHx01Mmhj', 985, 'I0OJTrhs9X', '14100715399', '2007-10-20 19:36:57.000', 'gliNEpGZ7X', '2002-09-30 12:28:45.000', '2015-01-24 03:08:05.000', 1);
INSERT INTO `investment` VALUES (612, 'Craig Patterson', 'Craig Patterson', '9Qole4EVN4', 208, '5pefXDvNzt', '211245415', '2022-06-30 01:28:23.000', 'p14fBMwsgC', '2013-02-01 21:26:08.000', '2006-03-24 19:41:04.000', 1);
INSERT INTO `investment` VALUES (613, 'Cui Xiuying', 'Cui Xiuying', 'zneiMeYMMT', 731, '1ZkcKvMcSs', '75597821807', '2000-01-05 13:08:29.000', 'kD4MTzl49l', '2009-05-12 00:49:33.000', '2001-04-30 01:58:40.000', 1);
INSERT INTO `investment` VALUES (614, 'Bonnie Herrera', 'Bonnie Herrera', 'fIHDlNbGDo', 805, '48hVWAi7uq', '76029471005', '2011-03-31 17:59:58.000', 'sLaLFohmwO', '2017-12-22 11:14:30.000', '2024-09-20 18:36:22.000', 1);
INSERT INTO `investment` VALUES (615, 'Sheila Rivera', 'Sheila Rivera', '35imgd20xh', 882, 'I1DtFukAJa', '17843873368', '2008-10-12 01:33:18.000', '84DcQ3Gqjb', '2016-06-17 01:45:29.000', '2002-07-07 12:13:47.000', 1);
INSERT INTO `investment` VALUES (616, 'Gao Zhennan', 'Gao Zhennan', 'BxPb9OmGsR', 899, 'GsSNlc9q3H', '218915158', '2021-05-24 15:52:53.000', 'qDixx2DxE4', '2017-07-25 03:58:41.000', '2002-01-05 21:52:43.000', 1);
INSERT INTO `investment` VALUES (617, 'Siu Kwok Yin', 'Siu Kwok Yin', 'cizfvob7Fo', 136, 'xKExCxVdmF', '15964597969', '2017-02-25 05:50:02.000', 'tQ3Kmv5ic6', '2010-12-04 08:57:53.000', '2024-05-19 06:12:32.000', 1);
INSERT INTO `investment` VALUES (618, 'Liao Zhiyuan', 'Liao Zhiyuan', '6IHSjwgGsS', 185, 'PJrpgoro4i', '19998057736', '2006-08-12 14:34:01.000', 'yfxJi7Sva1', '2017-09-17 23:59:25.000', '2011-09-08 14:21:26.000', 1);
INSERT INTO `investment` VALUES (619, 'Lei Xiaoming', 'Lei Xiaoming', 'bOnDRdpjki', 586, 'JSkLs0nxv9', '2062588855', '2003-02-02 04:49:17.000', 'YybpaZ6Ik1', '2002-04-28 20:47:40.000', '2015-10-28 19:26:12.000', 1);
INSERT INTO `investment` VALUES (620, 'Eugene Edwards', 'Eugene Edwards', 'BZ6HcKWqkl', 952, 'MxAbwFrSTY', '100631309', '2009-03-10 16:38:50.000', 'ElVKo1g8Y3', '2001-03-19 09:16:21.000', '2005-09-19 10:50:12.000', 1);
INSERT INTO `investment` VALUES (621, 'Xia Lan', 'Xia Lan', 'U64kbKNIe9', 533, '1pPZECkwzr', '75597843075', '2019-02-08 04:28:49.000', '7BDppJdyty', '2009-11-07 06:41:30.000', '2012-04-04 09:50:16.000', 1);
INSERT INTO `investment` VALUES (622, 'Takahashi Airi', 'Takahashi Airi', 'vDXwKD89Pz', 501, 'pycTEGgS8z', '76907348692', '2024-11-06 07:56:04.000', 'ZuoAitfQtT', '2021-10-13 19:16:23.000', '2015-11-05 23:22:06.000', 1);
INSERT INTO `investment` VALUES (623, 'Takagi Hazuki', 'Takagi Hazuki', 'ZVmnHfHgFb', 418, 'vYK23FZ9nr', '13608985961', '2015-11-09 03:22:19.000', 'QT7CiSWaK9', '2005-08-14 10:19:45.000', '2010-10-05 01:21:40.000', 1);
INSERT INTO `investment` VALUES (624, 'He Shihan', 'He Shihan', '59knOO6mR1', 789, 'IQReMEJorE', '18873161730', '2004-05-31 16:30:47.000', 'iYVfbpywKb', '2013-04-24 03:59:01.000', '2017-08-26 22:28:00.000', 1);
INSERT INTO `investment` VALUES (625, 'Shen Yunxi', 'Shen Yunxi', 'PrnFrGLUQ1', 157, 'AD4jjzkCWL', '208755937', '2015-11-26 04:42:18.000', 'GzXaQZV7v3', '2002-03-26 21:24:17.000', '2013-07-10 09:41:35.000', 1);
INSERT INTO `investment` VALUES (626, 'Lo Sze Kwan', 'Lo Sze Kwan', 'CsPEfk6lCE', 689, 'SsbOfX9IFJ', '2868464938', '2004-07-04 04:01:29.000', 'Xuz1asSLTD', '2007-09-27 13:21:13.000', '2000-11-16 13:30:53.000', 1);
INSERT INTO `investment` VALUES (627, 'Steven Russell', 'Steven Russell', 'QdTIIq1Tfr', 275, 'GA3WyMFRCj', '13615776796', '2001-06-09 02:43:02.000', 'DEMg0BkaVh', '2012-05-15 03:48:06.000', '2010-03-21 09:15:13.000', 1);
INSERT INTO `investment` VALUES (628, 'Han Xiuying', 'Han Xiuying', 'rFWiFxHd5y', 625, 'h8P7Y4af2w', '7693930763', '2025-02-09 08:41:15.000', '0dTCuL7wq2', '2016-12-21 16:31:37.000', '2014-01-03 13:38:06.000', 1);
INSERT INTO `investment` VALUES (629, 'Shi Xiaoming', 'Shi Xiaoming', 'jGeB6CEDd2', 41, 'ph0wE2Kqfj', '76946721430', '2008-12-23 16:08:45.000', 'GF8SjooePl', '2002-11-30 06:58:40.000', '2019-11-25 18:29:58.000', 1);
INSERT INTO `investment` VALUES (630, 'Grace Green', 'Grace Green', 'vumyCMW6DR', 341, '6Ryqh7XZeC', '18858493805', '2025-01-06 02:10:03.000', 'sWLlybKXOG', '2022-12-03 13:38:21.000', '2015-07-05 09:14:52.000', 1);
INSERT INTO `investment` VALUES (631, 'Sakai Rin', 'Sakai Rin', '5KJiOqN9Dd', 316, 'TOhdT1BMtp', '203880367', '2014-07-18 05:22:34.000', 'xqiNOWT5At', '2020-11-04 03:30:39.000', '2019-07-10 02:27:42.000', 1);
INSERT INTO `investment` VALUES (632, 'Randall Howard', 'Randall Howard', 'rsaicXk9I1', 887, 'Hf6sU4Q6L7', '19680313630', '2007-08-24 18:07:24.000', 'A8dowu5Nw8', '2008-10-04 18:09:49.000', '2009-04-03 02:11:57.000', 1);
INSERT INTO `investment` VALUES (633, 'Ito Miu', 'Ito Miu', 'z6rvV16LHV', 262, 'Ur0fdkrbF3', '2044890248', '2007-12-25 04:57:29.000', 'wQ6ZO9f6CX', '2002-04-15 12:02:29.000', '2025-01-24 03:02:15.000', 1);
INSERT INTO `investment` VALUES (634, 'Shi Lu', 'Shi Lu', 'g0S3440yCE', 997, 'Y1HNbb1Xye', '2820292757', '2018-12-20 23:03:32.000', 'AjezVPeW2W', '2010-04-03 02:03:32.000', '2019-01-01 14:03:11.000', 1);
INSERT INTO `investment` VALUES (635, 'Bryan Shaw', 'Bryan Shaw', 'TwplwOm601', 947, 'xY8Teyv0tc', '13667540305', '2003-03-15 19:01:56.000', 'dJoBzqe315', '2013-02-13 05:36:09.000', '2003-02-28 08:14:35.000', 1);
INSERT INTO `investment` VALUES (636, 'Mori Itsuki', 'Mori Itsuki', '4bFQ1qSDGm', 75, 'ZV5A2nbnXf', '16412214336', '2024-10-29 10:16:58.000', 'ezAkuOoH8j', '2011-07-03 06:27:25.000', '2004-11-11 01:15:54.000', 1);
INSERT INTO `investment` VALUES (637, 'Au Fat', 'Au Fat', '0od720ckm6', 617, 'oJfwZFW5wB', '75504391783', '2011-09-16 22:38:27.000', 'k9ocuxJJIl', '2021-06-21 18:58:48.000', '2000-07-13 03:26:15.000', 1);
INSERT INTO `investment` VALUES (638, 'Tao Ziyi', 'Tao Ziyi', '9g55zjKyUT', 177, 'AhyhlHsqDx', '2805705425', '2024-03-05 23:26:47.000', 'PEr6vN1uii', '2010-02-22 11:15:16.000', '2022-05-30 04:32:48.000', 1);
INSERT INTO `investment` VALUES (639, 'Kwong Chung Yin', 'Kwong Chung Yin', 'ukk436HNVh', 566, '8OSafAgp4y', '7609744961', '2020-03-24 00:36:59.000', 'MibLXhCXci', '2004-06-05 19:59:49.000', '2019-03-01 17:15:11.000', 1);
INSERT INTO `investment` VALUES (640, 'Melissa Mitchell', 'Melissa Mitchell', 'mEbwakFqRL', 545, 'Pdc83B8fKz', '284805702', '2013-05-05 23:09:54.000', 'otPlJtpodP', '2021-07-15 23:31:35.000', '2005-12-12 21:27:08.000', 1);
INSERT INTO `investment` VALUES (641, 'Shing Sai Wing', 'Shing Sai Wing', 'FMqloGR88L', 933, 'PPRe3qfLdP', '215692057', '2003-01-02 19:36:52.000', 'EWZ16HMN1D', '2005-04-18 00:09:06.000', '2021-07-22 17:42:50.000', 1);
INSERT INTO `investment` VALUES (642, 'Che Chieh Lun', 'Che Chieh Lun', 'fT53E1bWxx', 543, 'Iv80iQ57P2', '76990426169', '2012-08-22 15:33:32.000', 'oPys65zsj9', '2007-07-16 17:06:50.000', '2014-09-29 16:22:41.000', 1);
INSERT INTO `investment` VALUES (643, 'Goto Airi', 'Goto Airi', 'DEQuYOGqXG', 575, 'ke76mhmiqu', '7608896630', '2003-08-30 10:30:46.000', 'Sw1cW70fun', '2004-12-15 10:19:26.000', '2015-09-06 04:36:14.000', 1);
INSERT INTO `investment` VALUES (644, 'Kwong Chi Ming', 'Kwong Chi Ming', 'TsgFqElOkk', 65, 'iy9DXneglT', '205963589', '2009-04-24 18:41:09.000', '4KII7F3bMn', '2004-02-01 19:28:21.000', '2020-11-06 12:04:13.000', 1);
INSERT INTO `investment` VALUES (645, 'Chu Wai Han', 'Chu Wai Han', '5e1vNjxQje', 248, 'wiGlyAXhLd', '75521244308', '2022-07-04 21:21:13.000', 'PUXcAErDiK', '2022-04-26 06:07:33.000', '2002-01-30 12:28:34.000', 1);
INSERT INTO `investment` VALUES (646, 'Wong Cho Yee', 'Wong Cho Yee', 'zEHMYVBxLr', 358, '3LAdQptsMs', '19582753360', '2020-05-03 01:24:26.000', 'XJtPYSee1h', '2006-09-21 13:57:21.000', '2013-04-02 23:06:38.000', 1);
INSERT INTO `investment` VALUES (647, 'Noguchi Mai', 'Noguchi Mai', '4hoF5nCz4M', 76, '0Upi5zY3x1', '17299069850', '2006-03-18 06:43:15.000', 'YhlBSBILH3', '2006-10-11 04:18:05.000', '2023-06-15 21:25:11.000', 1);
INSERT INTO `investment` VALUES (648, 'Chiang Kar Yan', 'Chiang Kar Yan', 'GUWa0PkKTe', 589, 'SOjtrWuOk1', '16854938164', '2007-04-16 18:16:05.000', 'rSiN6cDWFB', '2024-03-31 22:06:59.000', '2001-11-04 22:43:57.000', 1);
INSERT INTO `investment` VALUES (649, 'Victor Harris', 'Victor Harris', '4gTXEorbhG', 250, '8y5kwXzCmc', '104676012', '2001-06-23 01:04:01.000', 'FP0zJEwnvA', '2003-12-25 09:39:45.000', '2025-04-05 08:31:43.000', 1);
INSERT INTO `investment` VALUES (650, 'Maeda Akina', 'Maeda Akina', 'TuqfHuqfSw', 977, 'iDC0mazIfB', '19629774488', '2014-02-23 22:24:03.000', 'VdyntnyABz', '2020-12-01 19:41:43.000', '2018-04-13 11:46:08.000', 1);
INSERT INTO `investment` VALUES (651, 'Kao Sum Wing', 'Kao Sum Wing', 'EBYX6Xmxu7', 913, 'W53YS3ioBt', '2006505676', '2015-08-01 02:39:58.000', 'eVJyMlN9Wi', '2000-02-04 08:52:46.000', '2018-06-20 08:42:32.000', 1);
INSERT INTO `investment` VALUES (652, 'Ku Wai Man', 'Ku Wai Man', 'U40cIL6BJs', 628, 'DMDPfJID3m', '286087481', '2008-11-14 13:14:44.000', 'tJZvGSEqKk', '2015-12-30 06:03:27.000', '2022-03-21 05:48:03.000', 1);
INSERT INTO `investment` VALUES (653, 'Chow Ling Ling', 'Chow Ling Ling', 'pt0aYopbbC', 606, 'k7XLB3EHWN', '203034962', '2011-04-28 17:11:54.000', 'z5JFqnqiKp', '2021-12-24 11:33:44.000', '2005-12-22 04:58:43.000', 1);
INSERT INTO `investment` VALUES (654, 'Fujiwara Shino', 'Fujiwara Shino', 'penqoZQyDT', 603, 'cmuxBrmgDV', '7697160455', '2022-01-24 07:05:28.000', 'WVpfHqee5M', '2020-04-15 01:19:31.000', '2010-09-21 13:54:38.000', 1);
INSERT INTO `investment` VALUES (655, 'Sugawara Shino', 'Sugawara Shino', 'IRV1e1hqNa', 551, 'TJlFphghUs', '18784449891', '2014-08-29 03:38:28.000', 'lcIWWmqtuC', '2009-03-25 06:58:15.000', '2000-06-05 11:07:16.000', 1);
INSERT INTO `investment` VALUES (656, 'Loui Ling Ling', 'Loui Ling Ling', 'rcILAgYGH7', 239, 'lvm7WwhabG', '7690584552', '2005-10-27 10:25:51.000', 'AO6M6vRP1I', '2004-06-22 07:19:10.000', '2008-02-18 10:59:14.000', 1);
INSERT INTO `investment` VALUES (657, 'To Chiu Wai', 'To Chiu Wai', 'bMwQlZMYfB', 45, 'R1PksahcWm', '15451607003', '2015-12-25 20:49:11.000', 'wTUOzoaet3', '2016-10-01 16:13:10.000', '2023-06-09 12:16:30.000', 1);
INSERT INTO `investment` VALUES (658, 'Pak Yu Ling', 'Pak Yu Ling', 'iqbc1FfaZo', 499, '4KlP27eLAV', '15348278015', '2001-08-25 15:55:56.000', 'Bo6oKWWv2J', '2005-06-30 22:31:48.000', '2021-11-18 22:35:25.000', 1);
INSERT INTO `investment` VALUES (659, 'Ellen Phillips', 'Ellen Phillips', 'OJC4HlExR7', 178, 'A1UKcRo8QV', '217850222', '2023-01-31 03:37:13.000', 'QdtCyoGyTe', '2000-06-07 09:15:14.000', '2000-09-26 13:19:59.000', 1);
INSERT INTO `investment` VALUES (660, 'Kobayashi Itsuki', 'Kobayashi Itsuki', 'LOOTWuBqUf', 478, '7brJ9ALtF7', '1017445054', '2004-02-22 05:10:29.000', 'FxQv7KoAza', '2020-01-19 18:11:51.000', '2009-01-03 12:17:21.000', 1);
INSERT INTO `investment` VALUES (661, 'Lok Tin Wing', 'Lok Tin Wing', 'NE5PFg2VAG', 113, 'zt7a0TxjYu', '15597438276', '2008-01-29 11:58:02.000', 'YB5xdqxNCF', '2000-12-20 11:07:35.000', '2007-06-25 22:45:52.000', 1);
INSERT INTO `investment` VALUES (662, 'Xiao Rui', 'Xiao Rui', 'pdQVYJDhrn', 249, 'VjqqNFkdr6', '219418410', '2006-12-19 19:35:41.000', 'lNDFr8u47z', '2022-12-28 18:43:09.000', '2013-04-15 08:24:28.000', 1);
INSERT INTO `investment` VALUES (663, 'Wong Chun Yu', 'Wong Chun Yu', 'o0ekOauk8i', 438, 'bR4dGAdglT', '17758778047', '2009-08-27 06:04:58.000', 'RNFqCmOpqn', '2006-05-10 05:43:24.000', '2004-06-08 19:33:59.000', 1);
INSERT INTO `investment` VALUES (664, 'Murata Mai', 'Murata Mai', 'h1MCc5K0Yq', 575, 'K2PyTaMT3r', '18268290252', '2001-06-22 03:37:16.000', 'XH81mFBXuN', '2016-09-04 00:18:25.000', '2017-08-30 16:43:15.000', 1);
INSERT INTO `investment` VALUES (665, 'Ying Wai Man', 'Ying Wai Man', 'xXdNRCouAn', 469, 'qi62S1q1p6', '15785483419', '2008-06-15 09:32:08.000', '74CmMAvOM8', '2006-01-11 07:44:25.000', '2019-08-14 13:26:47.000', 1);
INSERT INTO `investment` VALUES (666, 'Tam Sze Kwan', 'Tam Sze Kwan', 'wKfNX8bBDq', 119, 'O09uZWkkms', '16220063797', '2009-12-09 09:39:09.000', 'eYH73GId8z', '2007-11-18 05:36:48.000', '2010-07-12 00:00:09.000', 1);
INSERT INTO `investment` VALUES (667, 'Tam Ling Ling', 'Tam Ling Ling', 'iex1i4tC9z', 909, '8YNNota5l0', '108367556', '2017-06-17 04:54:58.000', 'coy8fPz6ph', '2023-06-27 12:19:21.000', '2022-01-03 11:36:24.000', 1);
INSERT INTO `investment` VALUES (668, 'Shirley Wilson', 'Shirley Wilson', 'XPkc61i3Dz', 393, '5cfTwQCC0z', '76025322776', '2004-01-10 14:31:22.000', 'qcaJY9PJfN', '2000-04-20 23:22:12.000', '2002-09-02 06:36:44.000', 1);
INSERT INTO `investment` VALUES (669, 'Heung Siu Wai', 'Heung Siu Wai', 'K7kInKyyzx', 145, 'AlLY0uVE3T', '2138524476', '2005-01-21 08:35:21.000', 'aWi40OT8Yg', '2013-12-13 15:04:16.000', '2024-07-11 09:18:28.000', 1);
INSERT INTO `investment` VALUES (670, 'Xu Anqi', 'Xu Anqi', 'rwNQqNyBUg', 174, 'o3TI0EXSQR', '75517688407', '2010-04-11 18:49:19.000', 'qDT5XdCYic', '2005-08-30 10:19:39.000', '2009-02-07 03:03:58.000', 1);
INSERT INTO `investment` VALUES (671, 'Juanita Cox', 'Juanita Cox', 'TrN2tlNIUj', 714, 'hC2QiJiYbV', '14238282033', '2023-06-21 13:02:05.000', 'MATuYShL6D', '2017-02-26 00:22:12.000', '2025-01-25 18:13:17.000', 1);
INSERT INTO `investment` VALUES (672, 'Ye Jialun', 'Ye Jialun', 'CnazAIQS4e', 364, '1HU5G5l4IC', '76022123175', '2017-08-02 21:42:52.000', 'G96mVEqUsT', '2000-07-22 15:05:56.000', '2011-08-09 22:24:48.000', 1);
INSERT INTO `investment` VALUES (673, 'Hui Ming', 'Hui Ming', 'oFXEaL5MB8', 315, '3HrXeSJ07h', '13348704596', '2003-07-02 20:36:56.000', 'ivyU8Ymtc1', '2012-10-29 20:56:31.000', '2016-05-04 17:17:17.000', 1);
INSERT INTO `investment` VALUES (674, 'Dai Lan', 'Dai Lan', '0f7XCh00eh', 467, 'Hy0IqwC5Qk', '7694484792', '2023-11-17 15:17:51.000', 'jlMxG3DzF4', '2016-08-04 16:44:20.000', '2024-02-20 08:22:45.000', 1);
INSERT INTO `investment` VALUES (675, 'Chen Anqi', 'Chen Anqi', 'Ullxk5TN3M', 645, '30Gtlp4xdR', '15180611440', '2015-01-23 21:45:38.000', 'E4oyYNrSVL', '2007-12-10 10:57:46.000', '2017-02-19 19:47:33.000', 1);
INSERT INTO `investment` VALUES (676, 'Abe Kaito', 'Abe Kaito', 'qWOGx76juF', 635, '7xxRyWrpjj', '13741187438', '2023-07-27 01:56:35.000', 'hnLxw4ivnw', '2025-04-05 12:22:16.000', '2024-01-26 15:11:51.000', 1);
INSERT INTO `investment` VALUES (677, 'Wong Tsz Hin', 'Wong Tsz Hin', 'A6uy3nQubj', 530, 'Ff253KcF6L', '105937127', '2023-06-13 17:29:19.000', 'XIrQgWWKnO', '2017-10-31 05:04:22.000', '2013-05-14 06:24:31.000', 1);
INSERT INTO `investment` VALUES (678, 'Danny Mason', 'Danny Mason', 'IuGMuVTUIL', 785, 'PKSCrqOmRq', '75504348722', '2015-04-17 10:48:07.000', 'A7PUPFZQsg', '2019-06-25 15:15:15.000', '2016-11-14 08:15:14.000', 1);
INSERT INTO `investment` VALUES (679, 'Kong Shihan', 'Kong Shihan', 'LO9Pf2nvHN', 148, '7uqtVixNqQ', '75518610097', '2000-03-28 11:49:11.000', 'lYKF6kfXNy', '2017-05-24 11:59:00.000', '2008-09-02 19:57:10.000', 1);
INSERT INTO `investment` VALUES (680, 'Murata Aoi', 'Murata Aoi', '2iTUBlz8jU', 406, 'LcY2b1R5sX', '76092980014', '2012-08-17 04:20:01.000', 'rHzkgAW2Iu', '2007-11-25 10:58:25.000', '2011-08-06 08:57:07.000', 1);
INSERT INTO `investment` VALUES (681, 'Carol Jordan', 'Carol Jordan', '0HJmdQ4BOy', 230, 'J8le9mlMM9', '15641208510', '2001-09-13 14:23:44.000', '5Z3iChsnaa', '2012-03-11 01:04:29.000', '2004-04-11 12:16:56.000', 1);
INSERT INTO `investment` VALUES (682, 'Feng Ziyi', 'Feng Ziyi', 'JGqbKPiOgW', 692, '6RaNhL9Zsz', '17527343853', '2021-09-07 23:44:43.000', 'bm8DWWAWgt', '2017-10-03 11:15:13.000', '2009-03-08 02:25:21.000', 1);
INSERT INTO `investment` VALUES (683, 'Chan Ka Keung', 'Chan Ka Keung', '0Ozy89MwGn', 603, 'mKCvQRGxSv', '7556998213', '2025-02-28 03:45:20.000', 'ePqc1IHl10', '2012-05-18 13:22:48.000', '2012-05-02 12:26:29.000', 1);
INSERT INTO `investment` VALUES (684, 'Yin Sum Wing', 'Yin Sum Wing', 'dLbvSzSDDu', 288, 'Rdb51nw9Io', '75545085998', '2004-10-25 23:45:29.000', 'Dd3xhZYukd', '2022-08-10 20:12:04.000', '2017-01-07 17:17:48.000', 1);
INSERT INTO `investment` VALUES (685, 'Rhonda Hall', 'Rhonda Hall', '9nhspRSGXC', 40, 'Rxdkh0DPqB', '282957058', '2002-11-24 17:24:37.000', '7xiylwuDZo', '2004-03-23 06:05:10.000', '2002-05-20 10:40:30.000', 1);
INSERT INTO `investment` VALUES (686, 'Wu Lai Yan', 'Wu Lai Yan', 'zLMnZrclaX', 41, 'HHGTQD1JqJ', '19794818062', '2023-08-25 18:10:54.000', 'jotPfx3zcc', '2008-07-18 23:49:04.000', '2006-01-04 07:22:00.000', 1);
INSERT INTO `investment` VALUES (687, 'Nakayama Sara', 'Nakayama Sara', 'exRjSsAaEs', 696, 'kdpy0flnsR', '16522780902', '2019-04-14 02:22:55.000', 'a0otWgp2kP', '2009-05-22 09:00:25.000', '2003-01-20 23:51:28.000', 1);
INSERT INTO `investment` VALUES (688, 'Marcus Watson', 'Marcus Watson', 'AoNd5aSECp', 90, 'tiDzWvwFW3', '2849337851', '2021-09-29 22:39:20.000', 'zXieyJnGRj', '2021-02-09 01:25:22.000', '2004-01-27 10:17:28.000', 1);
INSERT INTO `investment` VALUES (689, 'Kwok Ka Ming', 'Kwok Ka Ming', '8gVZ8gIOud', 702, '4He6GEIEG9', '18344177116', '2015-07-10 15:12:27.000', 'TtpwD5LNhc', '2015-01-05 01:22:32.000', '2003-02-14 09:36:44.000', 1);
INSERT INTO `investment` VALUES (690, 'Luis White', 'Luis White', 'CFYbUf74xv', 818, 'CPbQ5kD7rc', '17815066968', '2004-02-01 01:05:18.000', 'CWJz8giN16', '2009-03-15 16:42:20.000', '2012-11-11 12:52:22.000', 1);
INSERT INTO `investment` VALUES (691, 'Zheng Yunxi', 'Zheng Yunxi', 'SgQkIxxPFt', 737, 'dPDN8B4XZ1', '2895332946', '2023-05-28 06:31:59.000', '8W8e0j9CMG', '2011-08-10 11:49:12.000', '2004-03-14 22:58:39.000', 1);
INSERT INTO `investment` VALUES (692, 'Hirano Kazuma', 'Hirano Kazuma', 'madDqubAqO', 676, 'kPIIcBe7SV', '284996370', '2000-04-29 18:02:23.000', 'pxlz1b29ZN', '2007-05-18 18:47:32.000', '2013-04-10 18:00:59.000', 1);
INSERT INTO `investment` VALUES (693, 'Koyama Airi', 'Koyama Airi', 'KHKmvzKxqC', 422, 'u0Sb0czqJa', '18326991047', '2006-06-15 06:31:53.000', '0sJsoGRq8U', '2015-11-25 22:04:54.000', '2010-05-18 22:17:44.000', 1);
INSERT INTO `investment` VALUES (694, 'Siu Kar Yan', 'Siu Kar Yan', 'M2jISHy9Yx', 771, 'xerLw3Q97y', '18037332808', '2003-03-08 10:33:00.000', 'Opv64te23d', '2006-04-23 15:58:30.000', '2018-06-23 07:26:38.000', 1);
INSERT INTO `investment` VALUES (695, 'Nishimura Momoe', 'Nishimura Momoe', 'uX2MWN9lMU', 323, 'YSxHef7Kci', '76023136298', '2001-06-11 22:11:33.000', 'kiT7QjZIjH', '2001-09-26 11:50:04.000', '2002-04-07 02:04:55.000', 1);
INSERT INTO `investment` VALUES (696, 'Yan Shihan', 'Yan Shihan', 'xenlHRgNun', 28, 'H7QfZiCbRP', '7603047204', '2012-09-15 02:13:03.000', '6Wt0ZSAjQB', '2017-09-30 18:44:37.000', '2003-07-06 11:08:59.000', 1);
INSERT INTO `investment` VALUES (697, 'Lo Sai Wing', 'Lo Sai Wing', 'e271yTUI3W', 568, 'a2TAtwbgxu', '17341279155', '2007-11-12 16:41:38.000', 'v9YBkjw2tF', '2018-11-16 02:06:09.000', '2020-01-15 13:44:32.000', 1);
INSERT INTO `investment` VALUES (698, 'Theodore Wallace', 'Theodore Wallace', 'FzKlh5Baer', 434, 'Qt2qqDxvb8', '15767966413', '2023-05-14 06:15:06.000', 'CeQz5ArByw', '2025-03-09 01:04:53.000', '2023-02-11 17:38:37.000', 1);
INSERT INTO `investment` VALUES (699, 'Nakamori Shino', 'Nakamori Shino', 'fbm25guuc7', 740, 'hP7JdxpRKV', '14780336367', '2020-10-15 23:03:45.000', 'YMTYcAHj34', '2015-03-05 08:59:44.000', '2005-08-06 03:36:54.000', 1);
INSERT INTO `investment` VALUES (700, 'Dong Lu', 'Dong Lu', 'zvELcun2Xk', 384, 'iecM5TT1mH', '7600682922', '2021-11-15 10:05:35.000', 'rFGgUV5oFH', '2016-10-19 07:07:35.000', '2021-03-22 16:51:34.000', 1);
INSERT INTO `investment` VALUES (701, 'Ando Kaito', 'Ando Kaito', 'M6B4LXPEHH', 538, '9yK4aOjRIj', '7602878389', '2011-01-21 15:25:23.000', 'o6ADOWpW4i', '2004-06-28 03:13:31.000', '2020-05-24 04:33:29.000', 1);
INSERT INTO `investment` VALUES (702, 'Yue Wai San', 'Yue Wai San', 'vuOhL4hiEN', 952, 'Yvin8TFQFm', '75583597320', '2014-02-19 09:53:41.000', 'wsNulg6GaF', '2025-01-15 17:19:00.000', '2011-04-10 03:56:08.000', 1);
INSERT INTO `investment` VALUES (703, 'Wu Ziyi', 'Wu Ziyi', 'y36ZhWteyN', 583, 'FiWwZc7Min', '75528388429', '2016-07-27 19:57:01.000', 'RLkZ7LaQbY', '2018-06-30 13:30:47.000', '2010-09-18 04:14:35.000', 1);
INSERT INTO `investment` VALUES (704, 'Takahashi Hina', 'Takahashi Hina', 'O8PbWDP7Mx', 584, 'to9lqeA88u', '281029917', '2009-09-02 17:50:24.000', 'mwzlT416xz', '2010-07-26 12:49:14.000', '2020-05-19 18:30:01.000', 1);
INSERT INTO `investment` VALUES (705, 'Sasaki Hina', 'Sasaki Hina', 'bJ9zozuuAw', 890, 'tsmVMetRsf', '204757858', '2025-01-09 01:16:21.000', 'HI2hiBRQCw', '2015-01-19 03:45:55.000', '2012-05-18 04:37:33.000', 1);
INSERT INTO `investment` VALUES (706, 'Liu Jiehong', 'Liu Jiehong', 'gBE9bHEuma', 893, '0F9HhwjGR6', '16152269951', '2005-06-02 16:59:30.000', 'DJysGTWEVi', '2018-09-05 02:52:21.000', '2006-07-14 22:01:23.000', 1);
INSERT INTO `investment` VALUES (707, 'Tsui Ming', 'Tsui Ming', 'tzDP4SwM5S', 597, '2CQYya47bF', '2051780087', '2020-08-04 08:21:04.000', 'HI61Tp6hKU', '2008-05-29 14:51:13.000', '2008-11-12 14:21:22.000', 1);
INSERT INTO `investment` VALUES (708, 'Maeda Ryota', 'Maeda Ryota', 'llAFJ5z8W3', 398, '8wvHpczf9l', '16352842281', '2009-04-25 09:46:16.000', 'mLkKfn3NDW', '2022-01-16 21:48:35.000', '2010-01-27 05:18:27.000', 1);
INSERT INTO `investment` VALUES (709, 'Yuen Tin Lok', 'Yuen Tin Lok', 'dpVl8KmZ22', 512, 'eFPl5XhEME', '7691899583', '2004-06-17 12:36:56.000', '8aSyvuQWvi', '2005-03-09 18:21:35.000', '2024-12-29 08:37:52.000', 1);
INSERT INTO `investment` VALUES (710, 'Sato Ayano', 'Sato Ayano', 'EpjpKrcq5g', 554, 'JQM6URAt0h', '15449527471', '2015-05-28 10:59:57.000', 'jJDpiGs01X', '2015-01-24 18:26:51.000', '2018-07-06 19:47:43.000', 1);
INSERT INTO `investment` VALUES (711, 'Nishimura Mio', 'Nishimura Mio', 'dz1nSYrNj9', 634, '49w6OG5opa', '210542613', '2011-11-02 17:25:06.000', 'xRJ2sd3AHE', '2015-05-16 15:57:45.000', '2015-06-16 17:09:19.000', 1);
INSERT INTO `investment` VALUES (712, 'Martin Moore', 'Martin Moore', 'aOaEEJoduh', 299, 'ChiUKN9yZ3', '109778561', '2024-11-29 04:29:10.000', 'qnl86B3xHa', '2008-05-04 04:46:49.000', '2016-03-03 22:43:03.000', 1);
INSERT INTO `investment` VALUES (713, 'Sun Jialun', 'Sun Jialun', 'UlGsGlSSAl', 215, '6oSDHdeheD', '19630524584', '2008-10-29 00:09:17.000', 'oA5iZnhFBq', '2016-09-09 03:32:37.000', '2024-04-29 13:07:15.000', 1);
INSERT INTO `investment` VALUES (714, 'Du Ziyi', 'Du Ziyi', '7aoa35vrKJ', 712, 'ayrAYUO2d1', '16376844352', '2019-02-26 15:55:53.000', 'dMacT9DlnW', '2009-09-26 08:49:48.000', '2015-02-01 02:21:59.000', 1);
INSERT INTO `investment` VALUES (715, 'Chung Ka Fai', 'Chung Ka Fai', 'ojeamUvMbI', 566, 'XrXAn8syR4', '2881316789', '2018-09-15 14:31:38.000', 'B8nHHFPAzM', '2002-01-16 05:33:04.000', '2008-11-07 17:14:02.000', 1);
INSERT INTO `investment` VALUES (716, 'Mary Martin', 'Mary Martin', 'e1v3djTEsg', 999, 'dyjc5rvsaE', '2002328919', '2002-07-01 17:30:51.000', 'SPY45W0PFV', '2011-08-19 10:08:37.000', '2017-07-27 11:15:37.000', 1);
INSERT INTO `investment` VALUES (717, 'Mui Kwok Kuen', 'Mui Kwok Kuen', 'eFxkRyY8NL', 652, 'DiQxVpmq8K', '17873673164', '2012-07-30 14:43:51.000', 'Yquge7sWKd', '2004-08-18 09:13:33.000', '2014-10-21 07:40:36.000', 1);
INSERT INTO `investment` VALUES (718, 'Yeung On Kay', 'Yeung On Kay', 'YTSNDdZurb', 272, 'dZWEm8HOVi', '16264295868', '2003-07-06 14:15:35.000', 'y98Bycjg3s', '2002-05-31 09:27:50.000', '2004-08-12 13:00:18.000', 1);
INSERT INTO `investment` VALUES (719, 'Nicholas Hayes', 'Nicholas Hayes', '7jcj0OEe2p', 449, 'Rc6u0GJxGk', '17560002447', '2012-04-30 20:13:03.000', 'vyMeTdnOPH', '2008-11-28 23:52:01.000', '2003-10-03 13:30:42.000', 1);
INSERT INTO `investment` VALUES (720, 'Cao Zhennan', 'Cao Zhennan', 'E1SGIhgdcb', 233, 'zj5SubIzFs', '2074647291', '2020-05-14 09:10:17.000', '4AMwxjNNyw', '2018-09-13 01:57:36.000', '2001-03-02 11:25:07.000', 1);
INSERT INTO `investment` VALUES (721, 'Mao Ziyi', 'Mao Ziyi', 'Afa348u2hq', 74, 'f1A3RQIHBC', '75559173179', '2011-02-08 18:13:59.000', 'R3RjqzUmoJ', '2002-07-13 23:26:53.000', '2018-05-22 15:23:09.000', 1);
INSERT INTO `investment` VALUES (722, 'Cheng Jiehong', 'Cheng Jiehong', 'frdem7snnu', 522, 'dIec1OimPX', '76068019919', '2020-08-30 07:25:00.000', 'Rhe5cMK90x', '2019-03-11 11:28:35.000', '2000-01-22 10:34:54.000', 1);
INSERT INTO `investment` VALUES (723, 'Xue Jialun', 'Xue Jialun', 'OorPSIZ9hW', 867, 'eKbHkMFvet', '16111910276', '2004-04-19 02:37:07.000', '8ymiY68yYn', '2000-03-06 19:21:13.000', '2016-12-18 21:17:09.000', 1);
INSERT INTO `investment` VALUES (724, 'Kwan Sum Wing', 'Kwan Sum Wing', 'gbV8HyiUzn', 950, 'DoT8sDQwY6', '14745744641', '2008-06-04 19:19:58.000', 'UIOkdhBWI9', '2020-11-06 07:47:57.000', '2012-12-29 00:48:37.000', 1);
INSERT INTO `investment` VALUES (725, 'Yuen Tsz Hin', 'Yuen Tsz Hin', '9qa74FfITA', 845, 'hefmrzEnd7', '75517763735', '2013-11-11 18:18:02.000', 'sQG0RUUOUb', '2024-06-25 07:39:17.000', '2015-11-28 10:26:38.000', 1);
INSERT INTO `investment` VALUES (726, 'Cheung Chun Yu', 'Cheung Chun Yu', 'LrsotbgTog', 575, 'qqBQQOeP8f', '7551590413', '2006-02-17 06:12:30.000', 'n4swxVLMtV', '2002-06-22 12:23:46.000', '2013-04-18 17:40:53.000', 1);
INSERT INTO `investment` VALUES (727, 'Shing Ka Keung', 'Shing Ka Keung', 'K5a0eHtn4d', 808, 'AToYhcwUS4', '17258887584', '2011-11-01 02:43:46.000', '9sUZLpyA4K', '2022-11-30 19:20:54.000', '2010-05-08 10:30:50.000', 1);
INSERT INTO `investment` VALUES (728, 'Han Lu', 'Han Lu', 'BkNK3Ro3X1', 568, '10ZvD1LnmH', '76076721502', '2021-01-02 23:29:34.000', 'd9n4MT7Mfu', '2008-12-01 11:17:43.000', '2006-06-12 18:14:07.000', 1);
INSERT INTO `investment` VALUES (729, 'Yau Wing Fat', 'Yau Wing Fat', 'TGbx5rvU5U', 647, 'PnpMgfSvYd', '17221443692', '2000-09-05 07:49:41.000', 'aLxlSY0vVb', '2005-09-03 06:47:49.000', '2008-10-19 14:10:20.000', 1);
INSERT INTO `investment` VALUES (730, 'Todd Wallace', 'Todd Wallace', 'FHf1vGl6ik', 435, 'QJvEEJc4tt', '13201363098', '2016-04-13 20:29:56.000', 'zpLlan7mdG', '2018-06-23 17:16:42.000', '2006-11-10 00:25:38.000', 1);
INSERT INTO `investment` VALUES (731, 'Takeuchi Yuna', 'Takeuchi Yuna', 'NGZeQilcC1', 779, 'eHlqdpCgBJ', '76074994056', '2018-05-26 15:00:11.000', 'TTKxQOHfL6', '2006-08-04 14:02:27.000', '2019-07-06 09:35:37.000', 1);
INSERT INTO `investment` VALUES (732, 'Judy Powell', 'Judy Powell', 'zYLWqOUgIk', 52, '9sxb1iFSEJ', '17129179338', '2020-06-13 17:54:17.000', 'k0jQp1fLhW', '2024-05-07 10:21:08.000', '2010-04-21 13:51:49.000', 1);
INSERT INTO `investment` VALUES (733, 'Ti Yun Fat', 'Ti Yun Fat', 'QgggROUmfI', 360, 'iLeO3vUzvU', '1033958975', '2024-03-03 23:48:03.000', 'PsRPhRKbks', '2010-09-21 16:28:06.000', '2001-10-06 06:26:09.000', 1);
INSERT INTO `investment` VALUES (734, 'Kong Wing Kuen', 'Kong Wing Kuen', 'YCCD9wwamY', 34, 'jPl5vmDlTO', '75547822316', '2004-06-05 00:18:19.000', 'z9OpBFIhJQ', '2024-11-05 23:06:05.000', '2021-12-13 11:52:51.000', 1);
INSERT INTO `investment` VALUES (735, 'Don Spencer', 'Don Spencer', '5EqdGRbpL6', 119, 'BQnxGYvCC4', '18519384536', '2022-03-31 03:34:07.000', 's5D7e7nPdQ', '2023-05-05 18:02:19.000', '2013-07-04 01:08:19.000', 1);
INSERT INTO `investment` VALUES (736, 'Chris Gibson', 'Chris Gibson', 'tpuqTlwiZN', 554, 'ggMoy3dIFh', '19220853946', '2008-12-02 02:48:04.000', 'tIJkQ2zZEH', '2010-11-19 15:47:20.000', '2024-10-27 05:06:05.000', 1);
INSERT INTO `investment` VALUES (737, 'Vincent Wood', 'Vincent Wood', 'Ho6QrUXgTs', 937, 'srqpJVOwy4', '219849783', '2011-05-21 00:09:15.000', 'mmsudzMMhk', '2005-10-24 18:01:21.000', '2018-11-13 09:22:49.000', 1);
INSERT INTO `investment` VALUES (738, 'Sasaki Yamato', 'Sasaki Yamato', 'XAYOmk1BDN', 661, 'DPYMZrGRnT', '7555125929', '2002-03-01 00:38:57.000', 'FIDzfPR4rP', '2016-02-11 10:53:55.000', '2002-04-25 11:51:24.000', 1);
INSERT INTO `investment` VALUES (739, 'Fan Zhennan', 'Fan Zhennan', 'KhSw4h23du', 215, 'kQsoCDyf3L', '76005342257', '2008-04-21 09:35:18.000', 'GRvfaabakq', '2020-01-11 05:37:36.000', '2019-02-19 16:04:47.000', 1);
INSERT INTO `investment` VALUES (740, 'Tsui Ho Yin', 'Tsui Ho Yin', 'fkBcHP6vbN', 395, 'Qzk9EiAS2i', '76908584840', '2018-10-08 06:21:35.000', 'Kjcuxv6NVI', '2001-07-08 06:39:57.000', '2013-09-28 04:34:08.000', 1);
INSERT INTO `investment` VALUES (741, 'Zheng Shihan', 'Zheng Shihan', '4eVJRY2RgZ', 505, '1kCd9v1SO8', '2000045112', '2006-06-11 12:07:08.000', '9l9sEZBKRj', '2005-09-06 00:47:57.000', '2013-09-30 06:18:08.000', 1);
INSERT INTO `investment` VALUES (742, 'Ma Zhennan', 'Ma Zhennan', 'dgUzW2TFsB', 885, 'YF9yDXk2D0', '18365696979', '2003-07-04 14:10:20.000', 'Y0xQ8ogubo', '2023-04-24 22:59:24.000', '2016-03-22 08:49:09.000', 1);
INSERT INTO `investment` VALUES (743, 'Shao Rui', 'Shao Rui', 'Lh6E4zn8Nt', 957, 'RUqcT8ZUVx', '17442766863', '2004-07-19 17:05:26.000', 'a13psNKOx0', '2020-08-23 08:50:02.000', '2022-03-30 12:37:46.000', 1);
INSERT INTO `investment` VALUES (744, 'Kaneko Yota', 'Kaneko Yota', '6GMUfDN9lo', 327, 'Gp5cnnMjR8', '2181879164', '2022-12-04 21:37:52.000', 'jMmflrzma6', '2008-08-10 14:19:13.000', '2003-01-30 01:42:52.000', 1);
INSERT INTO `investment` VALUES (745, 'Ogawa Rena', 'Ogawa Rena', 'NTl8pEJf8o', 871, 'wso2gYu1EP', '284790713', '2017-08-09 20:26:30.000', '6ja6c8dqGK', '2001-02-11 16:54:21.000', '2009-05-08 20:55:28.000', 1);
INSERT INTO `investment` VALUES (746, 'Wang Rui', 'Wang Rui', '1JcAEOrRpX', 749, 'vuCYLygW5e', '104607698', '2005-11-26 20:51:43.000', 'HkpCVLA6Ds', '2005-09-29 04:25:26.000', '2014-05-26 14:25:57.000', 1);
INSERT INTO `investment` VALUES (747, 'Ishii Rin', 'Ishii Rin', 'tMom8tPwlz', 602, 'Oi0Xdwyejh', '19592085142', '2006-04-28 20:14:13.000', 'miPOaNYvxO', '2016-11-03 10:03:46.000', '2009-10-12 11:04:24.000', 1);
INSERT INTO `investment` VALUES (748, 'Li Anqi', 'Li Anqi', 'tVdEauLl0Z', 922, 'vejCzkEzwm', '16788840121', '2023-11-04 20:42:07.000', 'bOwkpI6JPg', '2022-02-03 01:47:30.000', '2009-11-03 11:25:28.000', 1);
INSERT INTO `investment` VALUES (749, 'Connie Henderson', 'Connie Henderson', 'BEmL84MdPD', 743, 'Hm3PfipJw4', '13139821085', '2011-11-08 02:07:17.000', 'px7dL3bLtq', '2011-01-31 09:12:36.000', '2024-04-26 21:07:25.000', 1);
INSERT INTO `investment` VALUES (750, 'Yau Lik Sun', 'Yau Lik Sun', 'oTnsgS5R6j', 495, 'SZWanrAdOS', '13331829186', '2013-08-14 17:44:22.000', '5YOpyAR2V5', '2025-03-31 11:24:20.000', '2004-01-06 20:50:39.000', 1);
INSERT INTO `investment` VALUES (751, 'Fujii Ryota', 'Fujii Ryota', 'r5DOocA5w7', 632, 'MgLrcN1YkL', '287990105', '2023-04-26 21:35:24.000', '0YCQTyMjWc', '2008-05-10 11:04:54.000', '2000-04-14 16:54:47.000', 1);
INSERT INTO `investment` VALUES (752, 'Du Anqi', 'Du Anqi', 'KA1DbF8VsR', 115, 'r58COsGT9g', '15132949163', '2018-02-19 04:22:17.000', '8R1GKZiHBg', '2009-04-04 10:29:45.000', '2000-06-05 09:09:17.000', 1);
INSERT INTO `investment` VALUES (753, 'Lam Tsz Hin', 'Lam Tsz Hin', 'qULztG8mxo', 954, 'iDaOmvJ6lw', '76002648549', '2009-12-19 00:24:57.000', 'Nxu721Y8fR', '2023-01-05 03:24:24.000', '2019-07-08 13:47:38.000', 1);
INSERT INTO `investment` VALUES (754, 'Peng Zitao', 'Peng Zitao', 'K63VOstTBx', 188, 'FmDV7Wswfe', '103281698', '2017-06-14 00:42:06.000', 'tzTVhb13tt', '2004-06-19 08:11:53.000', '2021-05-19 22:52:33.000', 1);
INSERT INTO `investment` VALUES (755, 'Zeng Ziyi', 'Zeng Ziyi', 'x4aawRVv6w', 143, 'aWsylhoIcH', '15189226908', '2010-05-23 15:49:38.000', 'DrEU78fLAN', '2006-06-04 16:39:20.000', '2011-02-08 07:59:48.000', 1);
INSERT INTO `investment` VALUES (756, 'Meng Chi Ming', 'Meng Chi Ming', 'arTPFIGzuy', 164, '1zBS117TY5', '17853926422', '2019-12-23 05:48:13.000', 'Sg2PukholN', '2014-02-09 16:33:45.000', '2010-12-08 05:14:16.000', 1);
INSERT INTO `investment` VALUES (757, 'Anita Young', 'Anita Young', 'XfOdS0S7v7', 471, 'CqDmzdWcz0', '2119695935', '2022-01-31 03:48:49.000', 'PG1T3DVYTI', '2013-01-03 11:57:37.000', '2024-10-19 05:44:26.000', 1);
INSERT INTO `investment` VALUES (758, 'Russell Weaver', 'Russell Weaver', 'RJSGJvhOZX', 816, '6S7jJn36YU', '7607792275', '2008-06-08 00:06:10.000', 'kb57oM2A7u', '2010-05-18 02:58:14.000', '2007-09-19 20:51:15.000', 1);
INSERT INTO `investment` VALUES (759, 'Choi Hok Yau', 'Choi Hok Yau', 'Hntk9CUtXf', 184, 'SRsoKfJz0s', '19774172413', '2018-12-01 18:04:08.000', 'pGPO4jMKBE', '2008-09-18 21:18:15.000', '2015-03-07 20:32:57.000', 1);
INSERT INTO `investment` VALUES (760, 'Endo Sara', 'Endo Sara', 'LiB8EKghPZ', 165, '81eIOQhbUd', '19192211479', '2016-10-27 20:17:37.000', 'bg44GK7mt0', '2014-12-02 16:13:01.000', '2004-05-13 03:29:04.000', 1);
INSERT INTO `investment` VALUES (761, 'Ti Wing Fat', 'Ti Wing Fat', 'Nb8LGIpzWF', 529, 'eqW9skf4nS', '16248440564', '2013-06-28 07:42:59.000', 'H4V2jkFP5M', '2016-11-12 21:44:53.000', '2014-01-29 12:26:36.000', 1);
INSERT INTO `investment` VALUES (762, 'Melvin Peterson', 'Melvin Peterson', 'm4ot0prUxU', 328, '04oAbbaWpX', '13037051929', '2019-01-11 11:22:47.000', '7lVCY8SnUw', '2022-12-30 14:13:44.000', '2013-10-18 22:31:54.000', 1);
INSERT INTO `investment` VALUES (763, 'Pauline Robertson', 'Pauline Robertson', 'YnnodXhY0g', 579, 'KOhPMbdkAZ', '211529738', '2009-03-17 15:00:18.000', '7EsWMt9TQM', '2010-10-18 08:57:01.000', '2018-07-11 07:48:31.000', 1);
INSERT INTO `investment` VALUES (764, 'Sharon Rivera', 'Sharon Rivera', 'H6rOih6P3m', 338, 'PODFy78YRY', '16523089469', '2013-06-30 04:27:24.000', '6IwRImbexr', '2007-10-09 04:21:18.000', '2009-02-07 07:10:58.000', 1);
INSERT INTO `investment` VALUES (765, 'Fujiwara Takuya', 'Fujiwara Takuya', 'CB4TBPdPJw', 464, 'did2K07Sfi', '218650602', '2023-04-11 07:17:01.000', 'IHNjaeR8U6', '2012-03-03 20:30:52.000', '2021-08-16 10:49:23.000', 1);
INSERT INTO `investment` VALUES (766, 'Cui Yunxi', 'Cui Yunxi', 'hCh1jLqDsf', 689, '8RPSF9QOgD', '14078404075', '2023-10-20 10:16:04.000', 'Ki3xgSkTSy', '2016-06-17 02:58:11.000', '2000-09-30 01:45:25.000', 1);
INSERT INTO `investment` VALUES (767, 'Yamashita Eita', 'Yamashita Eita', 'ql5ddWJrNL', 551, 'xPFtvESuyw', '13647565733', '2013-06-19 19:53:11.000', 'rYpmZWcoL7', '2023-11-05 18:12:06.000', '2010-12-18 22:22:23.000', 1);
INSERT INTO `investment` VALUES (768, 'Jack Ward', 'Jack Ward', 'dqzp7BkQ1D', 511, 'q53flYimja', '2884183495', '2016-05-25 00:11:30.000', '5kCidDHXNP', '2000-02-19 10:48:11.000', '2010-12-17 01:50:49.000', 1);
INSERT INTO `investment` VALUES (769, 'Yokoyama Kasumi', 'Yokoyama Kasumi', 'W2AgV1YLOP', 757, 'XlzlaUMfaw', '215990603', '2004-03-07 03:51:49.000', 'jVTNPXLoKM', '2019-02-17 23:54:50.000', '2003-05-21 07:47:01.000', 1);
INSERT INTO `investment` VALUES (770, 'Nicole Cox', 'Nicole Cox', 'w6cXoyVZa9', 636, 'Vp56qWTkLK', '19062704608', '2005-07-21 02:31:08.000', 'jgf0GCCE7m', '2017-02-22 01:08:35.000', '2001-10-04 16:54:15.000', 1);
INSERT INTO `investment` VALUES (771, 'Nomura Shino', 'Nomura Shino', '4lR0Z6eqpr', 273, 'LqMTRXmZ3H', '2089302097', '2014-10-19 08:14:51.000', 'Oi2rKCv48u', '2015-09-13 23:21:24.000', '2017-09-26 20:39:29.000', 1);
INSERT INTO `investment` VALUES (772, 'Ueno Misaki', 'Ueno Misaki', 'mZGnqmZFZR', 734, 'fYEBV4sk6J', '75510927199', '2008-01-02 22:33:31.000', 'HkUrZGtPGP', '2011-08-13 08:05:55.000', '2013-03-15 13:22:21.000', 1);
INSERT INTO `investment` VALUES (773, 'Tao Hui Mei', 'Tao Hui Mei', 'PCZfMTPvDp', 58, 'wXUzq1ruZ6', '7557943222', '2022-05-27 03:29:09.000', 'b13C2lJeHY', '2001-06-15 02:53:50.000', '2018-11-04 13:53:15.000', 1);
INSERT INTO `investment` VALUES (774, 'Dong Jiehong', 'Dong Jiehong', 'UYPTTmBzLu', 600, 'dglcNajYqC', '16362589937', '2020-09-05 22:47:56.000', 'Y2bDDXqk6H', '2010-03-23 15:57:44.000', '2019-01-21 21:13:16.000', 1);
INSERT INTO `investment` VALUES (775, 'Jiang Xiaoming', 'Jiang Xiaoming', 'uFTySM1bDI', 881, 's0ilEhfb5k', '287067281', '2012-12-24 16:50:20.000', 'u3W8Yp46e8', '2006-01-01 05:39:04.000', '2000-11-30 03:41:15.000', 1);
INSERT INTO `investment` VALUES (776, 'Yung Lai Yan', 'Yung Lai Yan', 'b4HDVKUNf2', 19, 'YhEUsdxBGE', '7607183529', '2008-11-08 01:03:15.000', 'y5YKuy6SX8', '2000-03-21 10:40:23.000', '2013-11-10 17:57:52.000', 1);
INSERT INTO `investment` VALUES (777, 'Tang Ziyi', 'Tang Ziyi', 'koodHwm6en', 104, 'qjXTVQuo5a', '76032176286', '2010-05-30 04:51:30.000', 'F5FbwfnAOc', '2007-03-08 13:25:48.000', '2011-06-01 19:29:10.000', 1);
INSERT INTO `investment` VALUES (778, 'Wu Xiuying', 'Wu Xiuying', 'taz0iZYubD', 217, '0zbCI4v24M', '2865913872', '2003-04-11 06:22:31.000', 'Kd7V6EiUXJ', '2013-06-16 16:12:21.000', '2020-03-06 14:42:09.000', 1);
INSERT INTO `investment` VALUES (779, 'Ren Yuning', 'Ren Yuning', 'JOnFiAfdFe', 217, 'd4kYS8dARV', '16124820178', '2002-06-18 04:45:03.000', 'vL5KgAz0bl', '2011-01-12 21:53:33.000', '2022-09-26 07:52:29.000', 1);
INSERT INTO `investment` VALUES (780, 'Susan Jordan', 'Susan Jordan', 'EjBOHrGHNu', 133, 'MfFOgMoA2T', '13119291761', '2024-06-23 18:36:57.000', '33ksKXnMy8', '2010-11-11 14:49:35.000', '2005-06-20 09:11:19.000', 1);
INSERT INTO `investment` VALUES (781, 'Miyamoto Kenta', 'Miyamoto Kenta', 'yz48kuonZ9', 62, '38Puv1aRk4', '14064144806', '2006-12-06 22:50:16.000', 'xGA6NFko2x', '2012-11-13 12:39:04.000', '2023-03-25 20:25:53.000', 1);
INSERT INTO `investment` VALUES (782, 'Tao Zitao', 'Tao Zitao', 'kjXqt8LseL', 268, 'yLDIHQHwfx', '210214796', '2020-05-12 13:27:54.000', 'Y62TiRhKMS', '2017-05-01 11:59:43.000', '2005-04-08 21:13:56.000', 1);
INSERT INTO `investment` VALUES (783, 'Saito Akina', 'Saito Akina', 'ME5eNHLceo', 706, 'lhBLNVS2w2', '7552550124', '2024-01-02 00:00:33.000', 'ct3hVHgM21', '2019-08-17 15:53:51.000', '2012-07-11 20:31:01.000', 1);
INSERT INTO `investment` VALUES (784, 'Ma Lan', 'Ma Lan', 'bMIW9hq0xo', 249, 'vrREVp8a9S', '75526770034', '2019-03-31 18:41:15.000', 'TThFVQAIjp', '2003-04-07 08:40:05.000', '2008-10-25 06:27:51.000', 1);
INSERT INTO `investment` VALUES (785, 'Shimada Seiko', 'Shimada Seiko', 'n1fCbLJ7iG', 253, 'Ba7ovCWIMU', '19691082518', '2020-02-10 22:29:30.000', 'QOfVMjxVZE', '2023-04-10 00:27:49.000', '2007-03-19 06:50:48.000', 1);
INSERT INTO `investment` VALUES (786, 'Yue Fat', 'Yue Fat', 'aoEJGUFnRf', 369, 'I06yL0rSXi', '287404368', '2014-05-21 07:21:32.000', 'qAyNgaonUx', '2003-08-31 19:23:53.000', '2017-11-05 05:28:33.000', 1);
INSERT INTO `investment` VALUES (787, 'Stephanie Jordan', 'Stephanie Jordan', 'SMnIxLCtMz', 299, 'eINqow2EpK', '102139718', '2012-04-28 09:14:03.000', '4HDVrhmBqi', '2001-11-12 07:58:06.000', '2023-09-07 03:38:18.000', 1);
INSERT INTO `investment` VALUES (788, 'Liao Jialun', 'Liao Jialun', 'fwaOsLH9Cs', 148, '8U2wmRfh05', '16146289340', '2001-03-18 11:13:11.000', 'Ux1dpi9a6K', '2012-01-24 02:53:06.000', '2006-09-16 03:11:55.000', 1);
INSERT INTO `investment` VALUES (789, 'Sato Aoi', 'Sato Aoi', 'o7Tp2NkNni', 203, 'F9GisTp0zM', '18540639643', '2015-08-06 06:38:25.000', 'KrxTxRhh7Z', '2023-02-27 20:06:51.000', '2012-06-02 20:26:48.000', 1);
INSERT INTO `investment` VALUES (790, 'Wang Jialun', 'Wang Jialun', 'Q0CRKQzFvm', 807, 'Os6JMSVpsq', '13949495463', '2009-12-12 13:58:30.000', 'RM6CCR11WB', '2014-06-27 21:02:47.000', '2002-11-19 13:02:59.000', 1);
INSERT INTO `investment` VALUES (791, 'Stephen James', 'Stephen James', 'aJAt7KAhHm', 504, '8SfT8unCmD', '76939456148', '2009-01-20 08:35:32.000', '2XtBejT5Vj', '2011-04-13 00:23:10.000', '2009-01-22 07:59:36.000', 1);
INSERT INTO `investment` VALUES (792, 'Nishimura Kaito', 'Nishimura Kaito', 'LDhu8YYXPq', 247, 'UaYnz05Ron', '75584479716', '2009-11-17 04:09:30.000', 'JYU9ac3yBH', '2019-03-04 09:38:01.000', '2002-11-28 13:52:56.000', 1);
INSERT INTO `investment` VALUES (793, 'Annie Price', 'Annie Price', 'QukXu1uqKa', 2, '2T5gDwJZK6', '75524848905', '2016-06-21 06:31:43.000', 'YEzfNG4RNv', '2015-07-24 21:22:39.000', '2016-11-28 08:17:55.000', 1);
INSERT INTO `investment` VALUES (794, 'Mak Tin Wing', 'Mak Tin Wing', '6aWm7qvlFt', 696, '6PRJROD6dl', '102822990', '2008-05-01 11:46:00.000', 'tvXrwwlSdG', '2023-11-26 21:08:39.000', '2011-12-01 21:14:38.000', 1);
INSERT INTO `investment` VALUES (795, 'Ono Ren', 'Ono Ren', '63Bzgi82zO', 968, 'NK6SKypar9', '7552578391', '2003-03-24 02:06:18.000', 'Rf2d2k9OM6', '2008-05-15 23:27:01.000', '2009-04-30 14:10:52.000', 1);
INSERT INTO `investment` VALUES (796, 'Kao Chun Yu', 'Kao Chun Yu', 'WyR8BfObDD', 12, 'FeTdmaTewA', '14721955511', '2002-04-20 10:36:10.000', 'fGEXVBl311', '2007-11-06 19:38:39.000', '2005-03-24 12:31:50.000', 1);
INSERT INTO `investment` VALUES (797, 'Miu Chun Yu', 'Miu Chun Yu', '9eaW0iVPpZ', 708, '4Nxv327bQ3', '13864069766', '2009-10-11 20:12:22.000', 'wEpOCSlnLy', '2012-11-12 02:42:20.000', '2013-02-13 18:28:48.000', 1);
INSERT INTO `investment` VALUES (798, 'Kaneko Kazuma', 'Kaneko Kazuma', '1HwUFn7TxF', 81, '4GevxHaGa4', '7559941002', '2006-04-20 22:13:42.000', 'CLZwLxX4OD', '2008-10-05 01:23:28.000', '2010-05-07 13:33:29.000', 1);
INSERT INTO `investment` VALUES (799, 'Joel Baker', 'Joel Baker', 'XEm2K6ZAbn', 859, 'IKgL8j1V2e', '13281061380', '2018-12-08 06:33:00.000', 'NdEySrel2F', '2011-12-07 14:45:02.000', '2023-03-06 16:06:32.000', 1);
INSERT INTO `investment` VALUES (800, 'Lok Fu Shing', 'Lok Fu Shing', '8h5JPSRekg', 295, 'vsVsfTmADo', '19625180738', '2003-08-07 16:07:57.000', 'AVgBVK5jcQ', '2009-11-15 02:27:59.000', '2005-05-27 23:36:30.000', 1);
INSERT INTO `investment` VALUES (801, 'Pang Yu Ling', 'Pang Yu Ling', 'Pe4XoQ9yML', 709, 'ap8pVMKKGh', '286390082', '2002-02-21 16:52:01.000', 'm9N7oOzZIv', '2016-08-04 00:39:16.000', '2018-02-21 02:08:15.000', 1);
INSERT INTO `investment` VALUES (802, 'Tang Ka Fai', 'Tang Ka Fai', 'nDPcS8E1ps', 870, 'iiTrqiByIp', '205377304', '2001-02-04 08:04:50.000', 'aOrSlBtntz', '2004-06-12 19:57:45.000', '2017-02-27 13:51:29.000', 1);
INSERT INTO `investment` VALUES (803, 'Qiu Xiuying', 'Qiu Xiuying', 'qhAkIkOvbM', 656, 'pvsDSvfIIg', '7601183889', '2009-11-13 16:23:34.000', '6kzczzjvlq', '2017-07-14 05:13:45.000', '2004-12-13 19:31:32.000', 1);
INSERT INTO `investment` VALUES (804, 'Charles Diaz', 'Charles Diaz', 'qFjorEZHjf', 477, '3fUAgz6Faz', '15379443992', '2003-02-28 06:26:36.000', 'n1hnBKTfcw', '2007-07-25 18:24:48.000', '2021-12-30 09:30:37.000', 1);
INSERT INTO `investment` VALUES (805, 'Glenn Simpson', 'Glenn Simpson', 'iRzviCvCXT', 243, 'sVFrfwtXAV', '210364420', '2019-09-15 13:01:46.000', 'MUN5jJoGVb', '2004-08-23 18:19:48.000', '2000-10-11 07:42:19.000', 1);
INSERT INTO `investment` VALUES (806, 'Christine Black', 'Christine Black', 'FJP0xU0Cvz', 439, 'Kg7SYHC7ZE', '16282349614', '2005-04-03 17:57:30.000', 'KWHEHLkmTH', '2012-01-27 12:53:02.000', '2004-06-03 17:16:26.000', 1);
INSERT INTO `investment` VALUES (807, 'Hirano Nanami', 'Hirano Nanami', 'xcWw65pnOX', 44, 'EffPnl5LaD', '16667385549', '2009-11-04 22:15:58.000', 'L0ckH0YrMt', '2020-11-04 08:55:38.000', '2006-03-04 13:23:30.000', 1);
INSERT INTO `investment` VALUES (808, 'Sugawara Rena', 'Sugawara Rena', 'lGbGBf8Bfo', 892, 'lz1sExCDBY', '75578727020', '2008-06-10 00:27:15.000', 'VqvHGgPjVa', '2017-06-15 19:34:51.000', '2013-09-16 08:17:28.000', 1);
INSERT INTO `investment` VALUES (809, 'Takeda Minato', 'Takeda Minato', 'i4FsJQM86o', 802, 'bbTfS8LXOc', '13183255963', '2016-08-09 16:26:35.000', 'AU0X2GvfqL', '2000-10-31 05:12:58.000', '2009-10-27 02:09:55.000', 1);
INSERT INTO `investment` VALUES (810, 'Au Kar Yan', 'Au Kar Yan', 'cbkHMs8aDp', 933, 'GszoC9YM6c', '203604068', '2002-12-16 20:59:50.000', 'ZfGgczoVwy', '2015-02-07 10:40:20.000', '2002-10-23 13:37:59.000', 1);
INSERT INTO `investment` VALUES (811, 'Mok Wing Sze', 'Mok Wing Sze', '8OeBqTn10V', 619, 'ugC8o5eg9p', '287439605', '2013-02-01 12:34:25.000', 'y4IDeAuYuh', '2013-09-10 21:26:41.000', '2006-09-06 02:45:35.000', 1);
INSERT INTO `investment` VALUES (812, 'Zhang Yunxi', 'Zhang Yunxi', 'N5dtKNV4Yb', 464, 'eOXfKpqBf9', '17323070208', '2006-01-07 05:44:32.000', 'guS5E28deB', '2007-04-13 08:56:39.000', '2014-10-02 23:48:18.000', 1);
INSERT INTO `investment` VALUES (813, 'Yan Shihan', 'Yan Shihan', 'OuzAeaB27n', 79, 'xHeTYMh8ol', '219911963', '2015-09-24 19:49:22.000', '7qDEXkxU5U', '2007-04-29 00:32:16.000', '2004-10-13 00:40:18.000', 1);
INSERT INTO `investment` VALUES (814, 'Pan Shihan', 'Pan Shihan', 'oIQDkTyjJv', 625, '4lb9JLwba4', '13905360720', '2015-05-02 12:56:45.000', '0lqT2DXP5T', '2013-05-29 07:46:22.000', '2022-09-16 15:38:02.000', 1);
INSERT INTO `investment` VALUES (815, 'Kinoshita Yuto', 'Kinoshita Yuto', 'TOQKX65j0k', 38, 'XKj4lD6lCl', '211935385', '2010-11-18 14:05:36.000', 'MVBHKxDbPp', '2004-01-11 23:20:45.000', '2021-03-24 05:14:20.000', 1);
INSERT INTO `investment` VALUES (816, 'Tong Chi Yuen', 'Tong Chi Yuen', 'VyNuzKbLjf', 960, 'xrlzEBV4wQ', '76982888124', '2006-07-31 08:38:17.000', 'D8XKrcLWlM', '2024-05-26 10:51:47.000', '2017-07-20 04:18:59.000', 1);
INSERT INTO `investment` VALUES (817, 'Carlos Olson', 'Carlos Olson', 'iSSTV511IF', 487, '1OLCcWKVFH', '76922382461', '2014-01-07 05:59:23.000', 'zgDHn7B1X3', '2004-02-22 14:21:40.000', '2004-06-20 10:15:31.000', 1);
INSERT INTO `investment` VALUES (818, 'Joyce Ross', 'Joyce Ross', 'v7mz6ul2QB', 112, 'uaDqyfYITZ', '14452980220', '2016-07-19 07:04:20.000', 'UHcEddg3pD', '2016-10-14 18:58:19.000', '2012-10-03 02:39:16.000', 1);
INSERT INTO `investment` VALUES (819, 'Lisa Cook', 'Lisa Cook', 'EBdS1Cyd9Y', 575, 'rRpQLDECCS', '19802139845', '2021-05-13 17:09:34.000', 'b6HrjnsGru', '2016-06-06 02:05:42.000', '2009-11-26 20:45:28.000', 1);
INSERT INTO `investment` VALUES (820, 'Yin On Na', 'Yin On Na', '9fxCFHLYqu', 147, '1uDzFoxH0R', '202805625', '2000-03-08 14:55:46.000', 'dueIPKJPIh', '2005-09-14 10:09:28.000', '2023-10-10 17:20:33.000', 1);
INSERT INTO `investment` VALUES (821, 'Miyamoto Ryota', 'Miyamoto Ryota', 'TUtyk84ynl', 807, '3KqFTGpCJQ', '1024385882', '2010-06-27 10:53:16.000', 'cQ91wQMeSB', '2005-08-01 01:31:50.000', '2023-04-14 02:02:41.000', 1);
INSERT INTO `investment` VALUES (822, 'Fujii Kazuma', 'Fujii Kazuma', 'eCp2RvFz71', 216, 'ywQxT8hz1T', '18493135683', '2002-01-20 22:55:06.000', '403h5a2Ug6', '2001-11-17 21:35:11.000', '2008-10-21 12:05:08.000', 1);
INSERT INTO `investment` VALUES (823, 'Jin Yunxi', 'Jin Yunxi', 'mTDuxIs3VI', 30, 'onQBeYMld5', '2072961477', '2016-02-02 10:28:25.000', 'JPez2DuoJ6', '2013-02-26 23:48:58.000', '2013-02-21 19:00:04.000', 1);
INSERT INTO `investment` VALUES (824, 'Hirano Ayato', 'Hirano Ayato', 'fDbYTfVVnr', 479, 'UPuVMB1IWT', '16150344396', '2008-11-28 02:17:06.000', 'aBXiPMH1Z2', '2024-03-04 19:48:10.000', '2004-08-18 10:34:34.000', 1);
INSERT INTO `investment` VALUES (825, 'Ruth Roberts', 'Ruth Roberts', 'ZNqgz73zZc', 2, 'ghC5LYWwze', '16640269504', '2011-10-08 01:35:18.000', 'XAL97iFu1a', '2023-12-04 16:51:51.000', '2012-11-12 12:43:15.000', 1);
INSERT INTO `investment` VALUES (826, 'Ueda Ikki', 'Ueda Ikki', 'wZBbJPmnCS', 398, 'e4BLiI39n3', '100019322', '2013-08-26 07:44:54.000', 'UuzTmTdRF4', '2013-05-21 05:50:50.000', '2009-02-25 12:45:19.000', 1);
INSERT INTO `investment` VALUES (827, 'Ando Hikaru', 'Ando Hikaru', 'LmUqjjb3Lz', 773, 'mraxVN2tqf', '19828092852', '2001-05-05 17:20:06.000', 'EEgwby1cEv', '2016-04-08 15:34:00.000', '2022-06-10 14:55:02.000', 1);
INSERT INTO `investment` VALUES (828, 'Yuen Suk Yee', 'Yuen Suk Yee', 'chGzRRR1zF', 748, '4BGkqy20P4', '18036099485', '2005-08-05 01:01:21.000', 'ABgr8W7OmM', '2018-09-12 03:13:13.000', '2003-04-30 11:27:27.000', 1);
INSERT INTO `investment` VALUES (829, 'Otsuka Misaki', 'Otsuka Misaki', 'txqAO0QGs8', 685, 'pvo3vlyf6A', '14161488898', '2025-02-02 22:29:11.000', 'x4yLf9xBiv', '2012-03-26 00:53:21.000', '2015-04-20 05:03:12.000', 1);
INSERT INTO `investment` VALUES (830, 'Shibata Kazuma', 'Shibata Kazuma', 'DTQJsinmUE', 41, 'xqHK94APey', '13627620014', '2016-03-03 07:43:51.000', 'QPpolHZkCh', '2008-08-15 10:43:20.000', '2003-04-24 23:06:16.000', 1);
INSERT INTO `investment` VALUES (831, 'Murata Riku', 'Murata Riku', 'XbCytA40PM', 105, 'FtMH4rvMaV', '18206935717', '2022-01-30 02:41:46.000', 'rlStwPE87V', '2005-11-10 04:10:38.000', '2005-07-03 11:39:59.000', 1);
INSERT INTO `investment` VALUES (832, 'Choi Lik Sun', 'Choi Lik Sun', 'fBirQYgosK', 669, 'BzzT3ZQmKt', '15944134575', '2012-07-16 22:28:54.000', 'vOVr9De9Kx', '2019-08-12 01:52:24.000', '2019-01-03 11:06:44.000', 1);
INSERT INTO `investment` VALUES (833, 'Choi Wai Lam', 'Choi Wai Lam', 'm3CkYP1twF', 820, 'Gt4i2Q4HsB', '15041305406', '2008-03-04 06:57:30.000', 'bWBE1ZX6fL', '2000-11-14 17:23:10.000', '2024-09-21 09:46:35.000', 1);
INSERT INTO `investment` VALUES (834, 'Miyazaki Itsuki', 'Miyazaki Itsuki', 'kuhUfiFAwT', 831, 'OkE1fw7h5L', '16347258516', '2009-03-12 11:12:24.000', 'Jq5cpVuW02', '2010-10-27 18:19:19.000', '2015-03-06 00:58:34.000', 1);
INSERT INTO `investment` VALUES (835, 'Pang On Kay', 'Pang On Kay', '0izptr8uSw', 201, 'jhxFiHOnWh', '14881082935', '2009-07-31 16:52:44.000', 'EToY0ssMVj', '2007-02-17 23:20:26.000', '2004-01-12 23:01:17.000', 1);
INSERT INTO `investment` VALUES (836, 'Lok Wing Sze', 'Lok Wing Sze', 'kERegBgvP2', 763, 'pvMciclaBQ', '284229260', '2014-03-02 00:05:28.000', 'v823euRJGv', '2017-12-28 14:15:05.000', '2018-03-01 21:28:39.000', 1);
INSERT INTO `investment` VALUES (837, 'Ueda Daichi', 'Ueda Daichi', 'zZqJZVjHaC', 436, 'VlrBLMP3z8', '14103614786', '2004-04-27 21:32:07.000', '9kRBHMvWhj', '2004-11-05 00:20:54.000', '2003-04-20 10:33:14.000', 1);
INSERT INTO `investment` VALUES (838, 'Fan Ling Ling', 'Fan Ling Ling', '3aXp681OCm', 279, 'IJ23OrxTeX', '17992323146', '2023-09-30 21:39:51.000', 'r9XLOHsF6H', '2017-01-29 19:59:04.000', '2012-02-21 07:05:34.000', 1);
INSERT INTO `investment` VALUES (839, 'Tin Suk Yee', 'Tin Suk Yee', 'A6rT2XfzPF', 680, 'tHvW0FBAFb', '14884345876', '2009-08-15 11:23:21.000', 'n3RyWWxghd', '2015-12-06 23:56:58.000', '2007-05-31 03:23:32.000', 1);
INSERT INTO `investment` VALUES (840, 'Nakamura Yuto', 'Nakamura Yuto', 'JTzWZQz8DE', 971, '2XutLH7I4i', '7601279642', '2012-05-09 10:49:04.000', 'p637Kfez7A', '2000-07-19 19:23:18.000', '2016-04-26 09:15:55.000', 1);
INSERT INTO `investment` VALUES (841, 'William Woods', 'William Woods', 'r2UAsLGqfZ', 600, 'l5Mw7z8M4b', '2054851569', '2024-12-23 10:45:48.000', 'GWwceT2rY7', '2022-04-16 16:15:02.000', '2010-06-06 15:32:55.000', 1);
INSERT INTO `investment` VALUES (842, 'Matsuda Yuna', 'Matsuda Yuna', 'MltI5DmLeg', 467, 'VcAPxLOsXU', '18873364182', '2024-02-04 04:21:45.000', 'FAVxjpmZDj', '2020-04-23 14:48:51.000', '2002-08-15 07:28:16.000', 1);
INSERT INTO `investment` VALUES (843, 'Goto Hikari', 'Goto Hikari', 'TQK4YPGKal', 915, 'zCMgzQSN6z', '2024010396', '2013-07-01 14:04:42.000', 'auE2BHLBrL', '2017-02-13 21:28:07.000', '2014-11-13 04:22:12.000', 1);
INSERT INTO `investment` VALUES (844, 'Sun Xiaoming', 'Sun Xiaoming', '9cq9YmIA40', 180, 'NAhvhM5lH0', '202506180', '2020-12-25 17:42:35.000', '9xI66JU69g', '2003-06-24 06:59:10.000', '2021-01-08 23:03:42.000', 1);
INSERT INTO `investment` VALUES (845, 'Nakagawa Itsuki', 'Nakagawa Itsuki', 'ZOrV6NGxnb', 473, 'D9MOJ5dvmL', '18625703863', '2022-10-20 04:45:14.000', 'ptFMXgqGGY', '2017-12-16 15:47:56.000', '2018-07-16 09:38:56.000', 1);
INSERT INTO `investment` VALUES (846, 'Gao Jialun', 'Gao Jialun', 'g13KUNaPR0', 730, '0q9GYt6zxB', '13539351450', '2023-03-23 00:55:33.000', '90RMvx63HK', '2016-04-16 18:45:12.000', '2011-06-11 08:36:41.000', 1);
INSERT INTO `investment` VALUES (847, 'Meng Chieh Lun', 'Meng Chieh Lun', 'zedccwVA8v', 537, 'BFfQDov8mi', '76908544379', '2017-10-06 05:03:18.000', 'NAfKcagrSS', '2024-05-19 22:13:31.000', '2018-11-27 16:28:57.000', 1);
INSERT INTO `investment` VALUES (848, 'Yin Xiuying', 'Yin Xiuying', 'keBk4hFlWi', 315, 'wHrYZRYkbO', '19750908472', '2008-12-26 01:26:34.000', 'sTxPnRzl9b', '2024-09-17 08:56:15.000', '2015-10-06 04:12:25.000', 1);
INSERT INTO `investment` VALUES (849, 'Fujita Airi', 'Fujita Airi', 'u8aUHsutSf', 604, 'jEe1b7ulPu', '2164893522', '2010-04-11 17:30:36.000', '2L6FUQp0QQ', '2018-06-30 06:33:37.000', '2022-11-19 07:40:48.000', 1);
INSERT INTO `investment` VALUES (850, 'Tong Kwok Kuen', 'Tong Kwok Kuen', 'TKp3GYWwlL', 93, '9o4C7pZAj9', '13885766614', '2023-04-02 18:45:52.000', 'vz1PpTai22', '2003-05-09 23:57:02.000', '2009-03-31 08:06:42.000', 1);
INSERT INTO `investment` VALUES (851, 'Howard Kelley', 'Howard Kelley', 'iRCoHKSkUv', 316, 'XtDmhgpu8X', '1080066307', '2012-06-05 21:13:12.000', '5hsvK77Nww', '2006-07-11 07:09:14.000', '2018-10-18 00:25:21.000', 1);
INSERT INTO `investment` VALUES (852, 'Xu Shihan', 'Xu Shihan', 'u08rlExyph', 23, 'uM3bsfrjdD', '7696665053', '2013-03-04 23:25:27.000', 'gnd7EoaQY9', '2014-07-26 03:37:36.000', '2009-09-19 21:55:25.000', 1);
INSERT INTO `investment` VALUES (853, 'Heather Webb', 'Heather Webb', '8qDFRTw9oc', 200, 'QBklyBjsKt', '15647057402', '2017-06-27 19:48:14.000', 'RS6DwTEEzA', '2017-12-21 17:14:45.000', '2005-04-03 04:43:39.000', 1);
INSERT INTO `investment` VALUES (854, 'Yin Rui', 'Yin Rui', 'zv8sLtTuph', 275, '8YzpasBDim', '104825943', '2025-01-24 05:08:42.000', 'WPkmPNRTBL', '2015-07-27 11:21:19.000', '2015-12-08 22:55:01.000', 1);
INSERT INTO `investment` VALUES (855, 'Okada Kazuma', 'Okada Kazuma', 'BVxKzieWut', 686, 'oCkKO9CcoN', '17328859899', '2001-07-19 10:23:12.000', 'IyU2gADTQH', '2009-09-05 09:48:51.000', '2015-12-03 12:30:38.000', 1);
INSERT INTO `investment` VALUES (856, 'Deborah Vargas', 'Deborah Vargas', 'dbPzadSKMP', 768, 'L5skqPhgNk', '15804336073', '2004-06-04 17:05:37.000', 'CFIYBN77Vy', '2000-04-03 21:41:52.000', '2023-06-14 00:23:28.000', 1);
INSERT INTO `investment` VALUES (857, 'Susan Weaver', 'Susan Weaver', 'iFlaq1KavO', 926, 'apF75zM3OY', '18444672998', '2015-01-02 08:09:42.000', 'CDfaenIQWn', '2018-08-10 13:12:46.000', '2024-09-21 14:21:13.000', 1);
INSERT INTO `investment` VALUES (858, 'Debbie Reyes', 'Debbie Reyes', 'AnqokwyPXN', 551, 'WYpioUrPgq', '17795302840', '2017-10-31 07:22:32.000', 'flyLoxkfKc', '2012-11-05 17:13:14.000', '2007-02-02 07:29:38.000', 1);
INSERT INTO `investment` VALUES (859, 'Fujiwara Riku', 'Fujiwara Riku', '1sKwp8T7LU', 722, 'pCOwHKhz8P', '75551787160', '2014-06-03 03:24:00.000', 'QQEV3zb2By', '2012-05-30 19:38:38.000', '2005-07-15 20:00:25.000', 1);
INSERT INTO `investment` VALUES (860, 'Tin Wing Sze', 'Tin Wing Sze', 'TP6rsPpjGs', 406, 'WDONeQ0FsF', '17981374487', '2000-02-20 15:28:50.000', 'U5TmGu90pG', '2002-12-14 21:25:19.000', '2016-10-16 17:42:56.000', 1);
INSERT INTO `investment` VALUES (861, 'Jonathan Collins', 'Jonathan Collins', 'EN1L2ykp8o', 511, 'BoVnHu1RnK', '17393542608', '2003-09-28 10:07:08.000', 'Yupy56cYlB', '2007-07-08 14:56:14.000', '2000-12-17 11:22:45.000', 1);
INSERT INTO `investment` VALUES (862, 'Ying Wing Fat', 'Ying Wing Fat', 'QeqZqWWrfL', 181, 'yDRXxRYORX', '76002035719', '2001-08-27 15:40:35.000', '4Shz0qn6kl', '2011-02-13 13:27:42.000', '2007-12-25 03:54:17.000', 1);
INSERT INTO `investment` VALUES (863, 'Luis Ross', 'Luis Ross', 'sn1KKXxtOp', 767, 'ewr4AeD9gY', '76930568003', '2016-08-30 08:47:59.000', 'dCxSAyP9Mq', '2000-08-11 20:44:01.000', '2000-04-13 11:38:56.000', 1);
INSERT INTO `investment` VALUES (864, 'Eugene Morales', 'Eugene Morales', 'Opnnb0Xair', 788, '8FPQrF6kcl', '75536500903', '2025-02-23 00:31:53.000', 'LzVsYCQD0v', '2006-05-31 15:24:59.000', '2010-12-21 18:14:43.000', 1);
INSERT INTO `investment` VALUES (865, 'Lok Wing Kuen', 'Lok Wing Kuen', '9z2E9pRCkZ', 161, 'Wk64BicG07', '18341857705', '2016-03-16 15:45:59.000', '1HNSzUjjFj', '2010-07-12 18:47:02.000', '2011-09-04 01:53:00.000', 1);
INSERT INTO `investment` VALUES (866, 'Andrew Stone', 'Andrew Stone', 'Xg53mBeSxH', 251, 'EAvU8IBSfd', '76914005108', '2004-01-07 12:58:50.000', 'Gj7wuKvTwj', '2015-06-18 02:57:50.000', '2004-04-24 03:15:50.000', 1);
INSERT INTO `investment` VALUES (867, 'Tony Hall', 'Tony Hall', 'o49Jfiiium', 557, 'iLa9DReieV', '76098109456', '2013-11-14 16:22:48.000', 'LBLZY4stSY', '2002-08-25 20:36:07.000', '2020-10-11 04:25:41.000', 1);
INSERT INTO `investment` VALUES (868, 'Tsang Chiu Wai', 'Tsang Chiu Wai', 'QslQaxAhej', 776, '67rDJLblfq', '1083176473', '2000-07-22 14:55:28.000', 'tmqeWMORO9', '2017-08-08 11:46:51.000', '2020-08-23 11:54:02.000', 1);
INSERT INTO `investment` VALUES (869, 'Wei Anqi', 'Wei Anqi', '1nfRU30Ldj', 112, 'JJhGtfbBH5', '18532164860', '2018-04-23 00:18:52.000', 'dOxjgplXuI', '2007-07-22 03:22:20.000', '2011-07-07 16:51:21.000', 1);
INSERT INTO `investment` VALUES (870, 'Tao Sau Man', 'Tao Sau Man', 'ff1B1BFQqt', 675, 'kLk0eVK3e8', '15784077569', '2018-09-13 12:39:03.000', 'UjqoeUqvlA', '2018-03-14 21:09:07.000', '2003-07-10 03:14:59.000', 1);
INSERT INTO `investment` VALUES (871, 'Shibata Rin', 'Shibata Rin', 'VHRfGu3mk2', 312, '1IDDNKjDkk', '7553803747', '2010-07-08 10:43:02.000', 's22x1DvbLo', '2008-11-03 17:56:44.000', '2008-03-05 20:08:53.000', 1);
INSERT INTO `investment` VALUES (872, 'Tang Ziyi', 'Tang Ziyi', 'LmLXDOY6i5', 743, 'q2HG8TeyMj', '16944921348', '2003-06-14 20:57:43.000', '00CqQityx9', '2002-01-14 08:58:27.000', '2024-01-19 20:31:13.000', 1);
INSERT INTO `investment` VALUES (873, 'Matsumoto Sara', 'Matsumoto Sara', 'X8PklhOsPI', 628, 'rwJowQTgZO', '104418712', '2000-12-31 08:50:48.000', '6wE2TRC8uW', '2009-03-17 19:37:19.000', '2013-02-23 21:58:34.000', 1);
INSERT INTO `investment` VALUES (874, 'Ye Jiehong', 'Ye Jiehong', 'tt10JspZaf', 339, 'yCCG9PaFeH', '286165465', '2015-10-27 02:07:15.000', '5f1nT1C2BT', '2002-07-06 22:35:52.000', '2018-02-10 14:45:59.000', 1);
INSERT INTO `investment` VALUES (875, 'Nakagawa Aoi', 'Nakagawa Aoi', '4ZvRqla8sN', 104, 'dciQqs7GeA', '2845266300', '2013-08-20 02:37:25.000', 'eXbZIrvhVX', '2008-03-12 16:07:17.000', '2021-11-04 00:10:50.000', 1);
INSERT INTO `investment` VALUES (876, 'Philip Martin', 'Philip Martin', 'jntvqN2lKa', 72, 'u4QNx9FhZm', '19300916162', '2023-12-26 16:58:24.000', '3jP2vRA7Aa', '2000-01-10 14:52:13.000', '2017-10-09 12:55:21.000', 1);
INSERT INTO `investment` VALUES (877, 'Catherine Freeman', 'Catherine Freeman', 'dInNGylkJM', 886, 'upTDUP7uCh', '7604145176', '2018-11-06 11:02:38.000', 'IypFyoL6qk', '2006-10-31 07:41:43.000', '2020-09-22 05:38:11.000', 1);
INSERT INTO `investment` VALUES (878, 'Sakai Takuya', 'Sakai Takuya', 'rSGBeTYAaH', 389, '1Xc6JfZi1v', '19115947887', '2010-09-11 03:40:23.000', '2N1uiaXzlc', '2008-02-24 00:58:57.000', '2017-12-10 07:13:23.000', 1);
INSERT INTO `investment` VALUES (879, 'Fan Yuning', 'Fan Yuning', 'DCPnKkVLmF', 143, 'k5QCLeBcRE', '14587869152', '2011-04-11 17:42:33.000', '4EyK3pHTzQ', '2005-08-06 16:06:12.000', '2011-07-30 17:11:37.000', 1);
INSERT INTO `investment` VALUES (880, 'Li Xiuying', 'Li Xiuying', '3rWJ5v1ufX', 672, 'o377nkJfhA', '16028486503', '2017-08-26 19:30:50.000', 'xJ9MOYaUMQ', '2014-08-12 15:23:48.000', '2006-11-04 00:42:42.000', 1);
INSERT INTO `investment` VALUES (881, 'Frank Robinson', 'Frank Robinson', 'Oy7DBaYQEX', 894, 'NkEQvge3CN', '100282336', '2002-03-17 06:59:06.000', 'BzsIzxLk0U', '2012-10-28 09:59:12.000', '2000-08-19 19:14:27.000', 1);
INSERT INTO `investment` VALUES (882, 'Lok Wai Yee', 'Lok Wai Yee', 'cgcSn0IcIJ', 443, 'g3WMJUnYEo', '76039706480', '2015-01-07 18:03:15.000', 'YRlydcQBba', '2003-12-24 05:12:46.000', '2004-05-15 19:37:37.000', 1);
INSERT INTO `investment` VALUES (883, 'Song Lan', 'Song Lan', 'qNh21SDIba', 685, 'n09HINt8z2', '283843264', '2023-06-14 14:25:38.000', 'qyALOMndt4', '2001-11-27 16:41:15.000', '2004-01-11 10:51:13.000', 1);
INSERT INTO `investment` VALUES (884, 'Wei Yuning', 'Wei Yuning', 'kZT22uScL5', 685, 'OpsqFQNlBc', '218237549', '2019-04-02 23:35:14.000', '8qrDTUtJsF', '2022-11-09 07:12:24.000', '2000-08-06 17:04:51.000', 1);
INSERT INTO `investment` VALUES (885, 'Yoshida Kasumi', 'Yoshida Kasumi', 'ybLQozPKAX', 759, 'Ij6tsR3wFO', '14203241503', '2011-08-19 19:37:05.000', '02UwoIiFtj', '2009-02-18 18:41:16.000', '2017-12-15 04:02:28.000', 1);
INSERT INTO `investment` VALUES (886, 'Troy Moreno', 'Troy Moreno', 'gZicym2ZOJ', 989, 'sI4vEb95NM', '76923791364', '2005-10-03 21:54:01.000', 'NZACIyl1F3', '2009-12-20 21:39:55.000', '2022-06-09 22:06:50.000', 1);
INSERT INTO `investment` VALUES (887, 'Kono Yota', 'Kono Yota', 'tVY02IzXaO', 906, 'tRwzZiPbWp', '15789157507', '2005-09-22 22:30:02.000', 'eIGZidyLQx', '2003-09-27 10:04:39.000', '2024-03-09 15:44:14.000', 1);
INSERT INTO `investment` VALUES (888, 'Au Wai Yee', 'Au Wai Yee', 'Vl6eDnIsRz', 666, '4D7qdFZMhz', '18468038697', '2004-03-14 13:19:17.000', 'hEsXGFtMyY', '2018-01-06 02:22:48.000', '2011-01-03 15:02:37.000', 1);
INSERT INTO `investment` VALUES (889, 'Mao Rui', 'Mao Rui', 'EMA7aRPtvz', 815, 'HNO7lT6Clr', '107784977', '2009-09-28 20:25:33.000', '3X5wXaTpkf', '2010-04-01 03:30:23.000', '2006-01-21 07:13:01.000', 1);
INSERT INTO `investment` VALUES (890, 'Victor Wood', 'Victor Wood', '6d7OX8ZZEj', 901, 'mMAFVIpbsc', '2142180149', '2011-05-23 18:32:25.000', '08Ugujb2Ec', '2020-09-22 15:03:36.000', '2024-04-12 22:35:14.000', 1);
INSERT INTO `investment` VALUES (891, 'Yin Rui', 'Yin Rui', 'QyNF9T48iu', 19, 'cLXLve6KF0', '18208594537', '2002-04-03 16:01:30.000', 'zSjMyLO11L', '2019-07-31 18:15:38.000', '2020-10-18 13:03:54.000', 1);
INSERT INTO `investment` VALUES (892, 'Xue Zhennan', 'Xue Zhennan', 'NhsW8rNOpi', 984, '4jQNNVOAx9', '76993100108', '2023-10-18 05:20:10.000', 'igmXYR7qv5', '2000-10-19 22:32:50.000', '2008-06-24 13:38:41.000', 1);
INSERT INTO `investment` VALUES (893, 'Ogawa Miu', 'Ogawa Miu', 'JLDNve127C', 187, '79flMwBUiH', '7559173766', '2018-09-19 19:58:34.000', 'jE6nvJo6ma', '2010-03-27 13:52:03.000', '2022-06-15 12:18:13.000', 1);
INSERT INTO `investment` VALUES (894, 'Kudo Momoe', 'Kudo Momoe', 'G83P3zcUjh', 987, 'QlMJofMTXe', '16518030128', '2013-07-10 03:25:36.000', 'z0MkE6GN1q', '2005-09-08 19:39:25.000', '2014-05-29 02:42:06.000', 1);
INSERT INTO `investment` VALUES (895, 'Hashimoto Yuto', 'Hashimoto Yuto', 'hUBDmw5UPP', 464, 'nViZUJbv0T', '16144833779', '2010-01-30 17:34:38.000', '0zybzVsCKH', '2010-07-10 21:09:01.000', '2021-08-23 00:43:08.000', 1);
INSERT INTO `investment` VALUES (896, 'Glenn Scott', 'Glenn Scott', 'ySV9y8oFXP', 782, 'bPkybltJEu', '17139701395', '2004-02-12 07:22:08.000', 'qqHTiaNad6', '2009-12-09 07:09:01.000', '2024-10-28 14:54:52.000', 1);
INSERT INTO `investment` VALUES (897, 'Hirano Hikaru', 'Hirano Hikaru', 'DJChbSF27J', 3, 'Xg0DvWiS6j', '7697329480', '2005-02-14 20:28:32.000', 'F50HBzgCbv', '2023-12-27 16:03:24.000', '2017-05-26 00:45:16.000', 1);
INSERT INTO `investment` VALUES (898, 'Zhang Zhennan', 'Zhang Zhennan', '13XDHfOOqI', 201, 'Mr8O21BsXk', '2181446579', '2023-01-18 12:29:42.000', 'GfmxFpXCex', '2021-06-29 18:12:44.000', '2012-05-20 20:38:18.000', 1);
INSERT INTO `investment` VALUES (899, 'Yuen Ching Wan', 'Yuen Ching Wan', '8PeHOr8898', 324, 'xE3nQ31wG6', '13257777957', '2001-09-06 07:43:16.000', 'hnK3ma0puO', '2004-03-23 01:14:17.000', '2001-11-21 13:13:53.000', 1);
INSERT INTO `investment` VALUES (900, 'Huang Lan', 'Huang Lan', 'Og8tmikquF', 367, 'r6dJfEqY3H', '13899720293', '2007-02-16 03:21:22.000', 'MXQDeqnEtH', '2024-03-23 05:35:52.000', '2008-04-04 02:50:46.000', 1);
INSERT INTO `investment` VALUES (901, 'Ono Misaki', 'Ono Misaki', 'gkYIX0NibQ', 265, 'WJjdsg94VC', '17364993026', '2004-04-29 16:30:15.000', '7W5okSaFgm', '2023-03-28 03:40:16.000', '2011-05-15 15:24:24.000', 1);
INSERT INTO `investment` VALUES (902, 'Amanda Cook', 'Amanda Cook', 'Sbsv5aqXti', 871, '6zj7I5Jaxm', '15443029320', '2012-08-30 17:58:37.000', 'JWiJo0gKUw', '2004-10-18 13:58:17.000', '2016-09-15 14:06:56.000', 1);
INSERT INTO `investment` VALUES (903, 'Joshua Bennett', 'Joshua Bennett', 'IJ1AGHQko3', 229, 'm4QAFHvw36', '105612691', '2013-03-18 22:19:01.000', '3e9XXT3gQL', '2020-08-30 10:48:43.000', '2012-09-28 21:51:05.000', 1);
INSERT INTO `investment` VALUES (904, 'Long Jialun', 'Long Jialun', 'ZNwLv1DKI1', 837, 'eSVuIK6oFF', '19294895810', '2008-06-19 03:51:04.000', 'h2B4k3qVcI', '2008-03-24 12:55:52.000', '2006-06-02 09:42:36.000', 1);
INSERT INTO `investment` VALUES (905, 'Koyama Kenta', 'Koyama Kenta', '570DAbgrYE', 581, '4XSvDoRmzC', '208772076', '2010-10-23 09:03:34.000', 'd03pE7xEyD', '2015-07-09 05:30:45.000', '2005-09-08 03:12:59.000', 1);
INSERT INTO `investment` VALUES (906, 'Saito Yamato', 'Saito Yamato', 'kkxgyHPZbg', 661, 'cPnevRp0V6', '14737920094', '2011-12-03 01:07:42.000', '8wYTKb8l6f', '2014-07-22 00:31:05.000', '2012-09-04 13:44:32.000', 1);
INSERT INTO `investment` VALUES (907, 'Chow Hok Yau', 'Chow Hok Yau', 'h9lRhXSVaE', 403, 'aZ0TB3q9Pp', '16271992072', '2017-06-25 03:01:27.000', '9PwNZib7iB', '2005-10-27 02:08:30.000', '2002-01-01 08:49:53.000', 1);
INSERT INTO `investment` VALUES (908, 'Zhao Lu', 'Zhao Lu', 'X1cUN6eACP', 107, 'S80x16qHzV', '75597897890', '2001-05-30 02:32:51.000', 'CArNPKZJcC', '2018-04-15 04:20:07.000', '2005-02-27 22:55:01.000', 1);
INSERT INTO `investment` VALUES (909, 'Chang Zitao', 'Chang Zitao', '3zWv1ZZdSJ', 297, 'nKPb0MvI0S', '14443413992', '2002-01-18 21:42:36.000', 'KC9oOAWdXF', '2010-06-03 12:53:13.000', '2011-05-28 15:17:08.000', 1);
INSERT INTO `investment` VALUES (910, 'Wan Wing Fat', 'Wan Wing Fat', 'zHRib4skdh', 157, 'MyDKtiz5Fv', '7604698966', '2015-07-01 07:08:20.000', 'aI2Z1VpDBo', '2020-03-07 17:28:23.000', '2022-01-21 08:48:58.000', 1);
INSERT INTO `investment` VALUES (911, 'Wan Ho Yin', 'Wan Ho Yin', 'DcVLYWLoFj', 199, 'cq4Ol1m3HW', '15364775093', '2008-11-08 01:17:42.000', 'OdMLdk0NcY', '2013-11-30 17:45:49.000', '2004-02-25 06:57:34.000', 1);
INSERT INTO `investment` VALUES (912, 'Fang Shihan', 'Fang Shihan', '3KBr7tCUEz', 728, '6jwIcNizGV', '1053939898', '2009-02-01 20:23:31.000', 'QwKS9GtFV2', '2009-12-04 02:46:56.000', '2021-10-07 00:18:12.000', 1);
INSERT INTO `investment` VALUES (913, 'Ando Mitsuki', 'Ando Mitsuki', 'TWOfEsjrlZ', 260, 'UGjKFm6H6t', '7555980274', '2010-10-21 11:26:10.000', 'dOcUDywHlk', '2020-01-25 20:28:43.000', '2010-07-01 09:04:12.000', 1);
INSERT INTO `investment` VALUES (914, 'Chan Ka Fai', 'Chan Ka Fai', 'fAons5rUF1', 555, 'cmJKkHcJ9V', '15243859293', '2014-09-06 07:00:06.000', '6BUhM6K2qd', '2024-03-09 06:22:02.000', '2001-11-12 17:09:18.000', 1);
INSERT INTO `investment` VALUES (915, 'Fan Zhennan', 'Fan Zhennan', 'poPeR392h9', 239, 'KU8GmYC9uF', '280214260', '2014-03-01 15:04:08.000', '5Y8bR2FVNx', '2016-03-28 09:50:24.000', '2007-04-17 06:15:06.000', 1);
INSERT INTO `investment` VALUES (916, 'Meng Jialun', 'Meng Jialun', '5BrlcrDm9C', 386, 'fBrsbL7YKc', '2178689753', '2017-10-04 08:09:01.000', 'JzE9gTajV9', '2013-02-20 13:23:34.000', '2014-07-11 04:22:50.000', 1);
INSERT INTO `investment` VALUES (917, 'Kao Wai Man', 'Kao Wai Man', 'U3BHlTpV30', 857, 'sqdkRE8hnD', '7601998978', '2009-06-07 05:01:40.000', 'emYNkYSHdS', '2022-05-04 07:27:30.000', '2023-09-07 03:23:08.000', 1);
INSERT INTO `investment` VALUES (918, 'Zhong Yunxi', 'Zhong Yunxi', 'bTpkJkM0Eo', 745, 'x5lpRS782C', '75542470056', '2019-08-17 06:07:45.000', 'HmzPQQRuoQ', '2020-01-03 03:18:34.000', '2010-02-25 06:23:12.000', 1);
INSERT INTO `investment` VALUES (919, 'Sheh Kar Yan', 'Sheh Kar Yan', 'ho1LKFrWG8', 37, 'olaSxPWeXM', '7559463816', '2005-12-13 02:07:23.000', '6zkGhmAPt5', '2014-01-15 21:28:25.000', '2011-11-27 03:46:30.000', 1);
INSERT INTO `investment` VALUES (920, 'Fan On Na', 'Fan On Na', 'DnzH5hPixg', 604, '0TLHm2qsIu', '109092577', '2002-10-30 08:44:16.000', '0KoF986NVa', '2021-07-21 00:22:37.000', '2021-02-25 07:44:50.000', 1);
INSERT INTO `investment` VALUES (921, 'Carmen Moore', 'Carmen Moore', 'DUxWr90Us0', 908, 'BFco26TQdw', '17543140315', '2000-12-27 16:01:07.000', 'U1UMMVb7zP', '2011-06-07 21:38:47.000', '2001-01-18 01:55:44.000', 1);
INSERT INTO `investment` VALUES (922, 'Leung Chun Yu', 'Leung Chun Yu', 'dYwjfOWZ9L', 79, 'TVRq0S3Isr', '7550903926', '2010-07-03 03:01:48.000', 'Vhj6lg3LU0', '2014-12-23 09:09:47.000', '2016-12-07 08:15:34.000', 1);
INSERT INTO `investment` VALUES (923, 'Harada Rin', 'Harada Rin', 'GIUiRpcsJ6', 713, '5F6ViWfj68', '14394069845', '2020-06-10 18:07:24.000', 'qNGPQJYjDO', '2000-01-11 11:01:30.000', '2017-01-31 08:14:42.000', 1);
INSERT INTO `investment` VALUES (924, 'Okada Yamato', 'Okada Yamato', '5DOpAKAvCu', 82, 'h547FRr1bs', '7690095488', '2002-02-13 01:26:27.000', 'tzQvsfBxE0', '2003-08-03 21:44:04.000', '2013-01-31 20:38:14.000', 1);
INSERT INTO `investment` VALUES (925, 'Yuen Ka Ling', 'Yuen Ka Ling', 'e6anvlw91W', 78, 'kbEXcMp0VN', '17822426382', '2022-01-03 16:27:50.000', 'tu2E8mCfLa', '2002-08-15 04:30:27.000', '2009-02-14 21:18:48.000', 1);
INSERT INTO `investment` VALUES (926, 'Pang Ka Fai', 'Pang Ka Fai', 'm4J8kVSjL4', 171, 'RH1Qz7YI6D', '7691050787', '2016-05-15 11:07:30.000', 'a5ZXvY3DcT', '2011-07-06 01:47:38.000', '2016-02-05 13:02:09.000', 1);
INSERT INTO `investment` VALUES (927, 'Fujiwara Rin', 'Fujiwara Rin', 'wzecwIxxP2', 944, 'pqRlBOQXwE', '18753828116', '2020-02-15 12:39:02.000', '7zW44Oim2M', '2015-10-23 13:20:33.000', '2008-11-22 04:36:30.000', 1);
INSERT INTO `investment` VALUES (928, 'Julia Rodriguez', 'Julia Rodriguez', 'J8H7IHkIEK', 570, 'CNOKaRyXq5', '14980241502', '2011-04-12 06:43:42.000', 'GabhrWKMN8', '2013-04-13 07:47:54.000', '2016-06-30 01:01:08.000', 1);
INSERT INTO `investment` VALUES (929, 'Meng Wai San', 'Meng Wai San', 'bOw08kNL5L', 438, 'T4Xvv6bzWc', '15211841267', '2024-04-02 11:46:52.000', 'OCYDHfzd2S', '2009-06-20 14:52:06.000', '2017-12-04 22:55:58.000', 1);
INSERT INTO `investment` VALUES (930, 'Steve Medina', 'Steve Medina', 'RKzPUSYgyt', 826, 'bFM6OvMxtf', '7608294135', '2014-06-13 09:44:15.000', 'azKIv6yDDl', '2010-03-13 20:58:35.000', '2016-11-01 06:45:23.000', 2);
INSERT INTO `investment` VALUES (931, 'Tsui Ho Yin', 'Tsui Ho Yin', 'nmv4QvxWav', 249, 'jYZsb3hpxz', '2897641175', '2024-02-12 15:20:03.000', 'OfEknI6C1B', '2009-08-09 10:45:17.000', '2009-11-28 20:07:35.000', 2);
INSERT INTO `investment` VALUES (932, 'Yang Lan', 'Yang Lan', 'VDqgboBAGq', 507, 'LqApPXPgqx', '76094457565', '2004-05-21 10:20:32.000', 'IJ1VpxlXiC', '2014-06-09 23:21:53.000', '2005-11-22 02:00:49.000', 2);
INSERT INTO `investment` VALUES (933, 'Ricky Garza', 'Ricky Garza', 'l68xIA8ULv', 445, 'LdUvIYKbbu', '13344148449', '2010-06-30 14:35:37.000', 'asA3xRsL9b', '2022-08-15 04:00:27.000', '2008-01-12 11:48:29.000', 2);
INSERT INTO `investment` VALUES (934, 'Takahashi Hazuki', 'Takahashi Hazuki', 'BuepuiEI9m', 310, 'yeDWcZFBaq', '2090292042', '2008-05-21 06:51:39.000', 'V1nfoax9zP', '2017-01-25 15:37:19.000', '2010-04-20 21:42:47.000', 2);
INSERT INTO `investment` VALUES (935, 'Kathy Morgan', 'Kathy Morgan', 'rmgdpwsja7', 472, '76PWmt0f9P', '19755639515', '2000-07-05 16:58:41.000', 'hpRaDpnmvi', '2006-02-28 07:07:55.000', '2007-09-14 07:55:27.000', 2);
INSERT INTO `investment` VALUES (936, 'Luo Shihan', 'Luo Shihan', 'Bf7ZQDNOCG', 380, 'Hz9wKCODra', '287453053', '2012-10-10 06:08:52.000', 'jpbxYO8qrV', '2022-09-19 03:25:25.000', '2002-05-16 11:30:03.000', 2);
INSERT INTO `investment` VALUES (937, 'Okada Kasumi', 'Okada Kasumi', 'NNRGrfp9G4', 619, 'RAnHGKPb6v', '14791367207', '2005-11-27 12:44:02.000', 'SvVHPDbyCg', '2005-08-10 15:25:40.000', '2011-03-29 06:02:25.000', 2);
INSERT INTO `investment` VALUES (938, 'Hayashi Seiko', 'Hayashi Seiko', 'dHVi5OOK61', 118, 'G4kIDiKzYl', '17096371601', '2000-06-03 01:52:04.000', 'FVL2FHWx8i', '2007-08-25 10:53:21.000', '2008-04-12 02:19:34.000', 2);
INSERT INTO `investment` VALUES (939, 'Ishikawa Yuto', 'Ishikawa Yuto', 'xnwkxq6q6g', 977, 'XYYoCfnrQv', '76983518490', '2017-01-02 17:58:43.000', 'LrqR5ZewwK', '2014-04-07 02:53:53.000', '2005-04-18 11:23:31.000', 2);
INSERT INTO `investment` VALUES (940, 'Wada Yuito', 'Wada Yuito', 'jhgMIzZrzV', 703, 'o2wQkQiDrg', '2013019823', '2012-06-10 15:59:44.000', 'bayFQihDvX', '2011-02-06 03:32:20.000', '2012-02-20 12:40:30.000', 2);
INSERT INTO `investment` VALUES (941, 'Sato Rena', 'Sato Rena', 'mJ3pVuh1Vc', 773, 'CdN59Q0GPP', '18950611237', '2014-12-02 16:25:03.000', 'jZtTKwSSFR', '2000-07-21 03:29:14.000', '2019-08-07 06:35:44.000', 2);
INSERT INTO `investment` VALUES (942, 'Kobayashi Kenta', 'Kobayashi Kenta', 'KE15eQ5QEM', 169, 'hzJ3YjAmb4', '207401111', '2009-03-13 03:19:05.000', 'vZd4oZYXdJ', '2005-09-01 03:49:27.000', '2003-08-29 09:49:49.000', 2);
INSERT INTO `investment` VALUES (943, 'Tse Tsz Ching', 'Tse Tsz Ching', 'ul36kjkn3F', 795, 'E0YSj6GXMu', '211105678', '2016-08-12 14:17:42.000', 'gx20rz3TRc', '2006-02-11 15:29:28.000', '2015-10-02 16:45:02.000', 2);
INSERT INTO `investment` VALUES (944, 'Miyazaki Ryota', 'Miyazaki Ryota', 'CBMdfnHIwm', 236, '2TyInxPNKY', '18469702028', '2008-11-27 16:57:43.000', 'QNNVlx0WvL', '2001-04-13 13:56:49.000', '2012-10-11 10:12:00.000', 2);
INSERT INTO `investment` VALUES (945, 'Ren Zhiyuan', 'Ren Zhiyuan', 'vacZG5K3cr', 233, 'uIsv9A5r91', '76973167126', '2004-04-02 04:20:45.000', 'dyw0u4SPWr', '2004-10-26 09:57:36.000', '2007-10-25 17:02:50.000', 2);
INSERT INTO `investment` VALUES (946, 'Mui Hui Mei', 'Mui Hui Mei', 'lxDX4lYkIF', 20, 'JWkv3WIjSf', '16926198698', '2001-04-30 11:39:23.000', 'FBhtJOX1f0', '2009-06-12 01:39:11.000', '2023-02-27 04:40:30.000', 2);
INSERT INTO `investment` VALUES (947, 'Cheung Cho Yee', 'Cheung Cho Yee', 'eVTSRy9hA7', 839, 'iFlTH6GPlr', '15469847945', '2000-02-05 09:06:01.000', 'ORDoKW76kT', '2002-12-28 13:33:29.000', '2006-11-30 14:20:41.000', 2);
INSERT INTO `investment` VALUES (948, 'Kojima Mai', 'Kojima Mai', 'KHXQBRv8Mc', 613, '0mOoKRVwn8', '15666496319', '2016-08-01 07:45:18.000', 'P2opdAsZZi', '2000-12-05 23:44:05.000', '2005-02-16 07:54:18.000', 2);
INSERT INTO `investment` VALUES (949, 'Kondo Kenta', 'Kondo Kenta', 'PtUiOcLUb9', 487, '1fhCT3nBIR', '76001301464', '2007-05-19 10:15:05.000', 'KFw83ltL34', '2015-08-17 10:46:39.000', '2007-06-10 10:08:26.000', 2);
INSERT INTO `investment` VALUES (950, 'Sakamoto Kaito', 'Sakamoto Kaito', 'Pb6NQXR5BE', 72, 'vhRbuFmJju', '2806522736', '2005-12-31 14:38:01.000', 'GXU0ql2O1i', '2020-08-26 02:30:42.000', '2020-02-08 13:28:44.000', 1);
INSERT INTO `investment` VALUES (951, 'Han Xiaoming', 'Han Xiaoming', 'kMO12zvSZ3', 802, 'lMhIL2oFdP', '17899763025', '2023-10-29 10:26:41.000', 'fwrsFWFcXa', '2012-04-11 02:41:55.000', '2006-07-17 11:10:36.000', 1);
INSERT INTO `investment` VALUES (952, 'Goto Akina', 'Goto Akina', 'Irv9X7ylqU', 145, 'xCNP3YvRjJ', '17063762790', '2020-12-18 03:45:08.000', 'pZ9GIcLyQs', '2021-10-12 14:21:30.000', '2015-10-27 12:48:09.000', 1);
INSERT INTO `investment` VALUES (953, 'Zhong Rui', 'Zhong Rui', 'rSlA6gz3BU', 565, 'sXmo6ghYgg', '76957384049', '2016-05-28 10:01:09.000', 'wPEIHXJNBj', '2013-09-11 06:46:08.000', '2025-04-09 23:39:55.000', 1);
INSERT INTO `investment` VALUES (954, 'Miura Ryota', 'Miura Ryota', 'HT3Z8XNkiR', 596, '2WMUiLTut2', '17390320154', '2008-05-25 15:24:59.000', 'n0X8IF3oAS', '2013-04-09 19:53:31.000', '2021-03-04 02:55:39.000', 1);
INSERT INTO `investment` VALUES (955, 'Han Sze Yu', 'Han Sze Yu', 'aQzOo7ZaGt', 921, '0hWTOuiGBh', '17189481931', '2022-01-16 14:08:25.000', 'wkAHIfU9L5', '2021-11-30 18:19:04.000', '2021-12-23 20:59:58.000', 1);
INSERT INTO `investment` VALUES (956, 'Pak Tak Wah', 'Pak Tak Wah', 'kq6t8XeulO', 672, 'XwZl24XIOM', '13396936701', '2020-01-31 13:12:14.000', 'OQzIfCu5qT', '2001-08-22 17:01:54.000', '2014-12-30 13:15:24.000', 1);
INSERT INTO `investment` VALUES (957, 'Hara Yuna', 'Hara Yuna', 'vH8KdhtLXb', 742, 'JoPoiQhqeq', '13389170971', '2023-01-22 17:01:07.000', 'yA2SDEclVH', '2009-07-21 23:48:48.000', '2005-10-16 22:47:29.000', 1);
INSERT INTO `investment` VALUES (958, 'Loui Chieh Lun', 'Loui Chieh Lun', 'FTa04RPqjn', 532, 'kbDrZlhHhd', '76995405006', '2016-05-26 23:30:57.000', 'Mu4mOW3Ivn', '2004-02-05 09:17:44.000', '2021-12-08 19:44:45.000', 1);
INSERT INTO `investment` VALUES (959, 'Debbie Castillo', 'Debbie Castillo', 'OTGnI7J0eq', 474, '8c1JUK3n1W', '15121739200', '2008-08-30 10:49:58.000', 'X2igH87O3l', '2013-08-31 04:56:14.000', '2022-03-10 21:50:07.000', 1);
INSERT INTO `investment` VALUES (960, 'Yoshida Ayano', 'Yoshida Ayano', 'jKL8jSs5yP', 46, 'K5g5QkfUkV', '18772675039', '2000-05-13 22:08:15.000', '6g5X7jyPui', '2024-06-02 19:36:15.000', '2009-07-31 23:38:30.000', 1);
INSERT INTO `investment` VALUES (961, 'Eleanor Castillo', 'Eleanor Castillo', '377uHKceFQ', 500, 'GlQeZwO31W', '16212127643', '2003-07-23 02:48:22.000', 'f18m92V5yl', '2017-11-30 17:15:48.000', '2010-05-26 06:31:30.000', 1);
INSERT INTO `investment` VALUES (962, 'Sheh Sze Yu', 'Sheh Sze Yu', 'YjhgoFXc4a', 786, 'tVgIyW8r7Y', '2040257432', '2007-03-21 22:24:55.000', 'nXGYvgyuVB', '2008-12-10 14:50:22.000', '2020-03-12 22:23:14.000', 1);
INSERT INTO `investment` VALUES (963, 'Kato Aoshi', 'Kato Aoshi', 'zbAf45JdWs', 555, 'hHApRxK0k1', '7606483246', '2015-10-25 13:56:14.000', '2dstqZqfZ3', '2000-11-22 03:22:20.000', '2008-11-01 00:42:40.000', 1);
INSERT INTO `investment` VALUES (964, 'Raymond Foster', 'Raymond Foster', 'hcpEmY9TdZ', 595, 'nxukqCiDj4', '15231275051', '2014-05-08 18:15:57.000', 'S4T5vONtJU', '2017-11-10 04:16:01.000', '2011-09-21 03:31:15.000', 1);
INSERT INTO `investment` VALUES (965, 'Chen Rui', 'Chen Rui', '5wibiZ9Mv2', 568, 'kNzvraWPyI', '2838518429', '2013-03-03 07:24:01.000', 'GZHmRXbZyJ', '2002-09-20 09:56:58.000', '2005-12-15 21:12:56.000', 1);
INSERT INTO `investment` VALUES (966, 'Feng Shihan', 'Feng Shihan', 'NMO4c7gkEJ', 138, 'b6EE3DWqhU', '18504092939', '2010-06-15 20:27:05.000', 'Y13CkgqwU1', '2017-09-08 20:08:25.000', '2008-02-20 19:18:27.000', 1);
INSERT INTO `investment` VALUES (967, 'Tao Suk Yee', 'Tao Suk Yee', 'NoaKm4pUJy', 684, '3Psc7Tci6U', '1046832953', '2013-10-15 01:34:59.000', 'zrHImL9Nmw', '2015-01-18 09:11:00.000', '2002-09-24 22:47:19.000', 1);
INSERT INTO `investment` VALUES (968, 'Ku Ka Fai', 'Ku Ka Fai', 'H37NiiXwHm', 857, 'lZIlISDsj2', '2815241127', '2009-10-01 09:09:00.000', 'qsdzXm8igw', '2011-08-02 08:21:56.000', '2018-08-10 15:23:13.000', 1);
INSERT INTO `investment` VALUES (969, 'Norman Campbell', 'Norman Campbell', 'byD47Aepdt', 739, 'yE65dIAY3Z', '13186635419', '2022-01-26 21:57:48.000', 'pWKjhAN9wf', '2019-07-21 10:02:14.000', '2016-12-30 10:10:58.000', 1);
INSERT INTO `investment` VALUES (970, 'Chang Yunxi', 'Chang Yunxi', '41NOiX2om9', 692, 'aue84KGmy6', '76977623541', '2005-07-26 17:52:11.000', 'm0xamb9vqr', '2006-06-29 20:34:00.000', '2000-05-04 06:39:51.000', 1);
INSERT INTO `investment` VALUES (971, 'Siu Ho Yin', 'Siu Ho Yin', 'juVfO4qjKh', 763, 'Sth2eetF6K', '1099090472', '2010-09-19 06:45:44.000', 'I5zsjt06ca', '2008-10-23 18:41:54.000', '2018-09-17 13:20:26.000', 1);
INSERT INTO `investment` VALUES (972, 'Joan Owens', 'Joan Owens', 'SEygZtmnel', 954, 'hMOKrDVKQn', '76944424564', '2002-05-29 01:32:55.000', 'ZPhUJSCmjv', '2021-10-22 18:40:41.000', '2007-05-23 02:36:26.000', 1);
INSERT INTO `investment` VALUES (973, 'Marjorie Richardson', 'Marjorie Richardson', 'PY714Wzbjt', 900, 'L3yFhQe9TN', '14463291389', '2020-01-28 09:50:47.000', 'UNPzZ7qew1', '2010-05-29 05:28:33.000', '2001-07-09 00:34:13.000', 1);
INSERT INTO `investment` VALUES (974, 'Lu Xiaoming', 'Lu Xiaoming', 'zB1xA4omZ7', 232, 'ieP4XSkM45', '217262080', '2016-07-26 05:45:51.000', 'qlL0Lc9LnT', '2014-08-31 18:38:01.000', '2008-05-10 23:10:01.000', 1);
INSERT INTO `investment` VALUES (975, 'Ye Yunxi', 'Ye Yunxi', 'NWsECMYbaZ', 454, 'paSEb5f4uf', '18324114376', '2014-08-25 12:15:14.000', 'ihoGupTjFe', '2016-07-18 19:57:43.000', '2010-08-27 16:56:47.000', 1);
INSERT INTO `investment` VALUES (976, 'Yamazaki Ayato', 'Yamazaki Ayato', 'NHB33Swlok', 474, 'cGkBQb6gjY', '13689454701', '2008-11-01 14:14:47.000', '5bImxlrdFb', '2019-09-23 19:18:54.000', '2004-03-11 11:04:45.000', 1);
INSERT INTO `investment` VALUES (977, 'Luo Xiaoming', 'Luo Xiaoming', 'KxjaAwvCCX', 255, 'PBSTYZSik4', '19726812561', '2022-11-27 06:42:29.000', 'dmAkobnDhO', '2008-01-16 14:20:10.000', '2018-05-22 02:04:28.000', 1);
INSERT INTO `investment` VALUES (978, 'Cui Lu', 'Cui Lu', 'AKjzVVYt49', 56, 'UdlkLWfmID', '75504715778', '2003-03-11 19:00:51.000', 'b2TyJ5qWGu', '2019-09-22 08:36:48.000', '2004-10-14 00:12:30.000', 1);
INSERT INTO `investment` VALUES (979, 'Christina Patterson', 'Christina Patterson', 'bKINVYKJ6n', 861, 'v7oX4e4D0X', '19509439934', '2015-12-10 10:57:09.000', '61ReEg5R1Q', '2004-06-10 01:53:41.000', '2001-02-03 17:43:22.000', 1);
INSERT INTO `investment` VALUES (980, 'Wei Zitao', 'Wei Zitao', 'XZrGz503eK', 207, 'zKFFXtrnVc', '19873363726', '2021-12-17 17:53:40.000', 'fdC24psJOa', '2010-02-08 14:41:34.000', '2017-09-06 13:51:52.000', 1);
INSERT INTO `investment` VALUES (981, 'Che Sze Kwan', 'Che Sze Kwan', '1c4rfdaxSD', 404, 'eKJDRzOpT2', '214171902', '2013-12-26 03:54:37.000', 'q2fNk3f3K7', '2006-11-05 12:58:23.000', '2000-10-05 18:32:08.000', 1);
INSERT INTO `investment` VALUES (982, 'Chad Aguilar', 'Chad Aguilar', 'WjYNZas8UI', 329, 'GKbFXjIFLs', '13065464844', '2014-12-07 05:13:37.000', 'U5RphN2lyK', '2024-02-17 03:21:56.000', '2012-07-23 22:45:41.000', 1);
INSERT INTO `investment` VALUES (983, 'Wan Hiu Tung', 'Wan Hiu Tung', 'wJTiul5oJT', 632, 'vLpt3pg6js', '16100664662', '2002-03-06 07:43:31.000', 'bLZavXiGRB', '2003-05-16 14:43:38.000', '2007-10-08 23:39:20.000', 1);
INSERT INTO `investment` VALUES (984, 'Irene Shaw', 'Irene Shaw', 'xKDnCYRs4l', 520, 'NTY6uT4EA5', '14474812762', '2024-03-04 04:35:43.000', 'Kg6dxU3FFf', '2020-08-15 05:38:06.000', '2022-07-03 05:09:28.000', 1);
INSERT INTO `investment` VALUES (985, 'Saito Miu', 'Saito Miu', '8sd6Oajyb4', 179, 'OvWLPKWgCy', '16610069829', '2012-10-21 04:40:16.000', '5t99ioqePD', '2012-10-23 13:49:56.000', '2017-06-20 05:04:32.000', 1);
INSERT INTO `investment` VALUES (986, 'Kojima Hikari', 'Kojima Hikari', '7LuTnbjgP3', 499, 'IUU2JC2Ilg', '15494602401', '2013-02-23 13:21:39.000', 'eAJZ9L2vIA', '2015-08-10 11:44:45.000', '2000-02-19 09:59:01.000', 1);
INSERT INTO `investment` VALUES (987, 'James Perry', 'James Perry', 'rocnW2UhNS', 561, 'cjBPddAJAL', '18078235364', '2009-09-04 09:33:29.000', '9wkkZubPPk', '2022-01-02 14:35:28.000', '2023-05-30 08:38:24.000', 1);
INSERT INTO `investment` VALUES (988, 'Cao Zhiyuan', 'Cao Zhiyuan', 'suw8hFGWTt', 439, 'UQWosKQuDW', '76075810783', '2000-04-19 09:22:58.000', 'cnwK7U5IXF', '2003-01-30 14:59:21.000', '2015-02-20 01:05:35.000', 1);
INSERT INTO `investment` VALUES (989, 'Marjorie Lee', 'Marjorie Lee', 'oHmqoFdPWK', 294, '0lRBp3iyCm', '2140739354', '2013-02-02 00:19:44.000', 'D3H2Fgrdsc', '2010-09-15 09:07:21.000', '2013-11-25 04:08:16.000', 1);
INSERT INTO `investment` VALUES (990, 'Margaret Wallace', 'Margaret Wallace', 'Tzk4nWTmq6', 599, 'dzINDB34xy', '17815255714', '2004-04-25 08:08:56.000', 'UWG0RyrrS6', '2005-08-12 15:15:35.000', '2017-09-04 12:20:43.000', 1);
INSERT INTO `investment` VALUES (991, 'Mary Tran', 'Mary Tran', 'Oea1NAwJU5', 62, 'OyRrnuH7gd', '212457848', '2009-10-04 21:11:43.000', 'hbQQbmrzbF', '2007-12-29 03:16:38.000', '2022-01-19 02:14:59.000', 1);
INSERT INTO `investment` VALUES (992, 'Liao Tak Wah', 'Liao Tak Wah', 'KXu7oHd41B', 838, 'BvLnyB5lNO', '75571342010', '2023-05-29 13:52:40.000', 'tTihp0zIVf', '2014-02-24 17:20:59.000', '2016-02-15 18:14:46.000', 1);
INSERT INTO `investment` VALUES (993, 'Wang Xiuying', 'Wang Xiuying', 'YX6C9BYGtR', 168, '7zodAskm0G', '15738696478', '2011-04-27 16:11:15.000', 'W2uNRBfXrs', '2019-01-14 02:55:58.000', '2017-10-04 11:26:21.000', 1);
INSERT INTO `investment` VALUES (994, 'Dai Cho Yee', 'Dai Cho Yee', 'aEdyKH6kFn', 965, 'Cnqgx3yreU', '7557691556', '2011-08-25 02:14:02.000', '4cnXCARnUE', '2013-12-12 04:54:20.000', '2000-05-04 20:54:38.000', 1);
INSERT INTO `investment` VALUES (995, 'Alan Porter', 'Alan Porter', 'OI9QnG3CTq', 175, 'VFq7qjYac1', '19586416630', '2013-06-01 17:30:42.000', 'ama9U6WX4b', '2004-05-30 15:17:29.000', '2011-01-28 22:55:50.000', 1);
INSERT INTO `investment` VALUES (996, 'Tang Lan', 'Tang Lan', 'ReBZv6N4og', 464, '84BP7iKmDE', '16871278974', '2004-11-03 07:06:26.000', 'y48MII1Cqu', '2007-04-29 10:42:36.000', '2003-09-01 22:12:19.000', 1);
INSERT INTO `investment` VALUES (997, 'Shing Fat', 'Shing Fat', 'EPG7Ig27aH', 103, 'nRg81Lj89O', '15061030515', '2003-10-14 23:31:57.000', '9kQT5dy5nF', '2021-11-19 09:48:36.000', '2017-10-31 15:49:33.000', 1);
INSERT INTO `investment` VALUES (998, 'Gao Yuning', 'Gao Yuning', '582cT486wO', 398, 'FeRzUDVEiM', '7694967708', '2006-04-22 18:54:18.000', 'Zj7XXM3ZXb', '2003-12-17 20:18:24.000', '2015-11-25 17:03:10.000', 1);
INSERT INTO `investment` VALUES (999, 'Fujita Mio', 'Fujita Mio', 'gXNJocpI5N', 425, '6kpfEJEztC', '16948863180', '2004-09-30 20:04:40.000', 'qsjJykdbZw', '2004-01-30 00:50:33.000', '2002-10-04 22:06:55.000', 1);
INSERT INTO `investment` VALUES (1000, 'Wada Rena', 'Wada Rena', 'ObzVqFEpUZ', 181, 'LmfHbcfqHO', '15956037500', '2024-05-26 20:05:15.000', 'L8xhvnpPRr', '2009-05-18 15:02:19.000', '2002-12-13 01:40:49.000', 1);
INSERT INTO `investment` VALUES (1001, 'Esther Medina', 'Esther Medina', 'WthvWPWchW', 333, '9NFgMrYazZ', '17199727182', '2020-03-12 20:05:52.000', 'VT1Czdziyt', '2020-03-06 17:21:30.000', '2022-08-16 20:55:07.000', 1);
INSERT INTO `investment` VALUES (1002, 'Andrea Perez', 'Andrea Perez', 'YsRVuUXlkv', 367, 'kDlDF8F1wA', '15024241051', '2007-04-06 08:40:21.000', '7L0y2dD9rO', '2023-12-07 17:41:08.000', '2007-05-10 08:28:47.000', 1);
INSERT INTO `investment` VALUES (1003, '31241', '1231', '很高', 3, '初步接洽', '41241', '2025-04-12 06:27:32.000', '准备交定金，交押金', '2025-04-12 06:27:33.277', '2025-04-25 06:07:58.995', 1);

-- ----------------------------
-- Table structure for investment_image
-- ----------------------------
DROP TABLE IF EXISTS `investment_image`;
CREATE TABLE `investment_image`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `investment_id` int NOT NULL,
  `img_id` int NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `investment_image_investment_id_idx`(`investment_id` ASC) USING BTREE,
  INDEX `investment_image_img_id_idx`(`img_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of investment_image
-- ----------------------------
INSERT INTO `investment_image` VALUES (1, 1003, 2, '2025-04-15 16:02:53.786', NULL);
INSERT INTO `investment_image` VALUES (2, 1003, 3, '2025-04-15 16:46:32.951', NULL);
INSERT INTO `investment_image` VALUES (3, 1003, 4, '2025-04-15 16:46:45.841', NULL);

-- ----------------------------
-- Table structure for investment_tenant
-- ----------------------------
DROP TABLE IF EXISTS `investment_tenant`;
CREATE TABLE `investment_tenant`  (
  `tenant_id` int NOT NULL AUTO_INCREMENT,
  `bill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `bill_category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10, 2) NOT NULL,
  `transaction_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `transaction_time` datetime(3) NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`tenant_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of investment_tenant
-- ----------------------------

-- ----------------------------
-- Table structure for menu
-- ----------------------------
DROP TABLE IF EXISTS `menu`;
CREATE TABLE `menu`  (
  `menu_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` int NOT NULL DEFAULT 1,
  `path` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `active_path` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `redirect` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `component` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `pid` int NULL DEFAULT NULL,
  `auth_code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  PRIMARY KEY (`menu_id`) USING BTREE,
  INDEX `menu_pid_idx`(`pid` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 44 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of menu
-- ----------------------------
INSERT INTO `menu` VALUES (10, 'System', 'catalog', 1, '/system', NULL, NULL, NULL, NULL, NULL);
INSERT INTO `menu` VALUES (11, 'SystemMenu', 'menu', 1, '/system/menu', NULL, NULL, '/system/menu/list', 10, NULL);
INSERT INTO `menu` VALUES (12, 'Access', 'catalog', 1, '/access', NULL, NULL, NULL, NULL, NULL);
INSERT INTO `menu` VALUES (13, 'CarAccess', 'menu', 1, '/access/car', NULL, NULL, '/access/car/list', 12, NULL);
INSERT INTO `menu` VALUES (14, 'VisitorAccess', 'menu', 1, '/access/visitor', NULL, NULL, '/access/visitor/list', 12, NULL);
INSERT INTO `menu` VALUES (15, 'Bill', 'menu', 1, '/bill', NULL, NULL, '/bill/amount/list', NULL, NULL);
INSERT INTO `menu` VALUES (16, 'Dashboard', 'catalog', 1, '/dashboard', NULL, NULL, '', NULL, NULL);
INSERT INTO `menu` VALUES (17, 'SystemRole', 'menu', 1, '/system/role', NULL, NULL, '/system/role/list', 10, NULL);
INSERT INTO `menu` VALUES (18, 'Analytics', 'menu', 1, '/analytics', NULL, NULL, '/dashboard/analytics/index', 16, NULL);
INSERT INTO `menu` VALUES (20, 'Workspace', 'menu', 1, '/workspace', NULL, NULL, '/dashboard/workspace/index', 16, NULL);
INSERT INTO `menu` VALUES (21, 'FinanceManage', 'menu', 1, '/finance/manage', NULL, NULL, '/finance/manage/list', NULL, NULL);
INSERT INTO `menu` VALUES (22, 'Investment', 'menu', 1, '/investment', NULL, NULL, '/investment/agent/list', NULL, NULL);
INSERT INTO `menu` VALUES (23, 'Maintenance', 'catalog', 1, '/maintenance', NULL, NULL, NULL, NULL, NULL);
INSERT INTO `menu` VALUES (24, 'Firefighting', 'menu', 1, '/maintenance/firefighting', NULL, NULL, '/maintenance/firefighting/list', 23, NULL);
INSERT INTO `menu` VALUES (25, 'Transformer', 'menu', 1, '/maintenance/transformer', NULL, NULL, '/maintenance/transformer/list', 23, NULL);
INSERT INTO `menu` VALUES (26, 'Rental', 'catalog', 1, '/rental', NULL, NULL, NULL, NULL, NULL);
INSERT INTO `menu` VALUES (27, 'TenantManage', 'menu', 1, '/rental/tenant/', NULL, NULL, '/rental/tenant/list', 26, NULL);
INSERT INTO `menu` VALUES (28, 'RentalManage', 'menu', 1, '/rental/manage/', NULL, NULL, '/rental/manage/list', 26, NULL);
INSERT INTO `menu` VALUES (29, 'RentalList', 'menu', 1, '/rental/list', NULL, NULL, '/rental/list/index', 26, NULL);
INSERT INTO `menu` VALUES (30, 'RentalDetail', 'menu', 1, '/rental/detail/:id', NULL, NULL, '/rental/list/detail', 26, NULL);
INSERT INTO `menu` VALUES (31, 'Tools', 'menu', 1, '/tools', NULL, NULL, '/tools/webtools', NULL, NULL);
INSERT INTO `menu` VALUES (32, 'VisitorRegister', 'menu', 1, '/access/visitor/register', NULL, NULL, '/access/visitor/modules/register', 12, NULL);
INSERT INTO `menu` VALUES (34, 'Test', 'catalog', 1, '/test', NULL, NULL, '', NULL, NULL);
INSERT INTO `menu` VALUES (35, 'TestTenantManage', 'menu', 1, '/test/tenant', NULL, NULL, '/test/tenant/list', 34, NULL);
INSERT INTO `menu` VALUES (36, 'TestFinance', 'menu', 1, '/test/finance', NULL, NULL, '/test/finance/list', 34, NULL);
INSERT INTO `menu` VALUES (37, 'SystemPark', 'menu', 1, '/system/park', NULL, NULL, '/system/park/list', 10, NULL);
INSERT INTO `menu` VALUES (38, 'TestTransformer', 'menu', 1, '/test/transformer', NULL, NULL, '/test/transformer/list', 34, NULL);
INSERT INTO `menu` VALUES (39, 'Reimbursement', 'catalog', 1, '/reimbursement', NULL, NULL, '', NULL, NULL);
INSERT INTO `menu` VALUES (40, 'ReimbursementAudit', 'menu', 1, '/audit', NULL, NULL, '/reimbursement/audit/Audit', 39, NULL);
INSERT INTO `menu` VALUES (41, 'PrintPage', 'menu', 1, '/bill/amount/print', NULL, NULL, '/bill/amount/modules/BillPrintPage', 34, NULL);
INSERT INTO `menu` VALUES (42, 'TestRentalManage', 'menu', 1, '/test/manage', NULL, NULL, '/test/manage/list', 34, NULL);
INSERT INTO `menu` VALUES (43, 'ReimbursementApplication', 'menu', 1, '/reimbursement/application', NULL, NULL, '/reimbursement/application/application', 39, NULL);

-- ----------------------------
-- Table structure for menu_meta
-- ----------------------------
DROP TABLE IF EXISTS `menu_meta`;
CREATE TABLE `menu_meta`  (
  `meta_id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `order` int NULL DEFAULT 1,
  `active_icon` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `active_path` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `affix_tab` tinyint(1) NULL DEFAULT NULL,
  `affix_tab_order` int NULL DEFAULT NULL,
  `badge_content` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `badge_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `badge_variants` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `hide_children_in_menu` tinyint(1) NULL DEFAULT NULL,
  `hide_in_breadcrumb` tinyint(1) NULL DEFAULT NULL,
  `hide_in_menu` tinyint(1) NULL DEFAULT NULL,
  `hide_in_tab` tinyint(1) NULL DEFAULT NULL,
  `iframe_src` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `keep_alive` tinyint(1) NULL DEFAULT NULL,
  `link` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `max_num_of_open_tab` int NULL DEFAULT NULL,
  `no_basic_layout` tinyint(1) NULL DEFAULT NULL,
  `open_in_new_window` tinyint(1) NULL DEFAULT NULL,
  `menu_id` int NOT NULL,
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  PRIMARY KEY (`meta_id`) USING BTREE,
  UNIQUE INDEX `menu_meta_menu_id_key`(`menu_id` ASC) USING BTREE,
  INDEX `menu_meta_menu_id_idx`(`menu_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 44 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of menu_meta
-- ----------------------------
INSERT INTO `menu_meta` VALUES (10, 'system.title', 'ion:settings-outline', 9999, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, NULL);
INSERT INTO `menu_meta` VALUES (11, 'system.menu.title', 'mdi:menu', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 11, NULL);
INSERT INTO `menu_meta` VALUES (12, 'page.access.title', 'lucide:key-square', 100, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 12, NULL);
INSERT INTO `menu_meta` VALUES (13, '车辆出入管理', 'carbon:car', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 13, NULL);
INSERT INTO `menu_meta` VALUES (14, '访客管理', 'carbon:user-profile', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 14, NULL);
INSERT INTO `menu_meta` VALUES (15, 'page.bill.title', 'mdi:file-document-multiple', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 15, NULL);
INSERT INTO `menu_meta` VALUES (16, 'page.dashboard.title', 'lucide:layout-dashboard', -9999, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 16, NULL);
INSERT INTO `menu_meta` VALUES (17, 'system.role.title', 'mdi:account-group', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 17, NULL);
INSERT INTO `menu_meta` VALUES (18, 'page.dashboard.analytics', 'lucide:area-chart', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 18, NULL);
INSERT INTO `menu_meta` VALUES (20, 'page.dashboard.workspace', 'carbon:workspace', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 20, NULL);
INSERT INTO `menu_meta` VALUES (21, 'page.finance.title', 'mdi:currency-usd', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 21, NULL);
INSERT INTO `menu_meta` VALUES (22, 'page.Investment.title', 'mdi:chart-line', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 22, NULL);
INSERT INTO `menu_meta` VALUES (23, 'page.maintenance.title', 'mdi:tools', 101, 'mdi:tools', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 23, NULL);
INSERT INTO `menu_meta` VALUES (24, 'page.maintenance.firefighting', 'mdi:fire-extinguisher', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 24, NULL);
INSERT INTO `menu_meta` VALUES (25, 'page.maintenance.transformer', 'mdi:lightning-bolt', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 25, NULL);
INSERT INTO `menu_meta` VALUES (26, 'page.rental.title', 'mdi:home-city-outline', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 26, NULL);
INSERT INTO `menu_meta` VALUES (27, 'page.rental.tenant', 'mdi:account-group', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 27, NULL);
INSERT INTO `menu_meta` VALUES (28, 'page.rental.management', 'mdi:clipboard-list', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 28, NULL);
INSERT INTO `menu_meta` VALUES (29, 'page.rental.list', 'mdi:view-list', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 29, NULL);
INSERT INTO `menu_meta` VALUES (30, 'page.rental.detail', 'mdi:file-document-outline', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, 0, NULL, NULL, NULL, NULL, 30, NULL);
INSERT INTO `menu_meta` VALUES (31, 'page.tools.title', 'lucide:bot', 99999, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 31, NULL);
INSERT INTO `menu_meta` VALUES (32, '访客登记', 'carbon:user-profile-alt', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 32, NULL);
INSERT INTO `menu_meta` VALUES (34, '测试', 'carbon:test-tool', 999999, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 34, NULL);
INSERT INTO `menu_meta` VALUES (35, '合同管理', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 35, NULL);
INSERT INTO `menu_meta` VALUES (36, '财务管理', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 36, NULL);
INSERT INTO `menu_meta` VALUES (37, 'system.park.title', 'carbon:building', 999, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 37, NULL);
INSERT INTO `menu_meta` VALUES (38, '变压器管理', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 38, NULL);
INSERT INTO `menu_meta` VALUES (39, '报销管理', 'mdi:cash-multiple', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 39, NULL);
INSERT INTO `menu_meta` VALUES (40, '报销审核', 'mdi:clipboard-check-outline', 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 40, NULL);
INSERT INTO `menu_meta` VALUES (41, '打印页', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 41, NULL);
INSERT INTO `menu_meta` VALUES (42, '园区管理', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 42, NULL);
INSERT INTO `menu_meta` VALUES (43, '报销申请', 'mdi:file-document-edit-outline', 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, 43, NULL);

-- ----------------------------
-- Table structure for park
-- ----------------------------
DROP TABLE IF EXISTS `park`;
CREATE TABLE `park`  (
  `park_id` int NOT NULL AUTO_INCREMENT,
  `park_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `area` decimal(10, 2) NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `contact` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `manager` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`park_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of park
-- ----------------------------
INSERT INTO `park` VALUES (1, '十一产业园（东莞）', '东莞高埗', 1.00, NULL, '1', '2025-04-12 10:38:42.196', '2025-05-05 03:17:27.028', '123', '31', 0);
INSERT INTO `park` VALUES (2, '十一产业园（广州）', '广州', 100.00, NULL, '1', '2025-04-12 11:38:18.790', '2025-04-28 09:26:24.489', '12412', '143241', 0);
INSERT INTO `park` VALUES (3, '十一产业园（深圳）', '深圳', 223.00, NULL, '1', '2025-04-14 15:45:28.000', '2025-04-30 07:38:01.913', '123', '123', 0);
INSERT INTO `park` VALUES (8, '十一产业园（深圳）', '123', 12312.00, NULL, NULL, '2025-04-30 06:38:22.706', '2025-04-30 06:38:26.399', '123213', '123', 1);
INSERT INTO `park` VALUES (9, '312', '123', 123.00, NULL, NULL, '2025-04-30 08:25:27.774', '2025-05-05 01:14:02.933', '123', '123', 1);

-- ----------------------------
-- Table structure for reimbursement
-- ----------------------------
DROP TABLE IF EXISTS `reimbursement`;
CREATE TABLE `reimbursement`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `purpose` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10, 2) NOT NULL,
  `department` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payee` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` datetime(3) NOT NULL,
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `status` int NOT NULL DEFAULT 0,
  `userName` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 27 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of reimbursement
-- ----------------------------
INSERT INTO `reimbursement` VALUES (26, 'asd', 123.00, 'tech', 'asd', '2025-05-05 02:46:44.250', NULL, '2025-05-05 02:46:44.292', '2025-05-05 02:46:44.292', 0, 'vben');

-- ----------------------------
-- Table structure for rental_tenant
-- ----------------------------
DROP TABLE IF EXISTS `rental_tenant`;
CREATE TABLE `rental_tenant`  (
  `rental_tenant_id` int NOT NULL AUTO_INCREMENT,
  `tenant_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `increase_date` datetime(3) NOT NULL,
  `increase_rate` decimal(5, 2) NOT NULL,
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `park_id` int NULL DEFAULT NULL,
  `contract_end` datetime(3) NULL DEFAULT NULL,
  `contract_start` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`rental_tenant_id`) USING BTREE,
  INDEX `rental_tenant_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 101 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of rental_tenant
-- ----------------------------
INSERT INTO `rental_tenant` VALUES (1, 'Masuda Misaki', '213-769-6958', 'bhMIeHKSdz', '2014-06-24 05:47:49.000', 793.11, '424 Figueroa Street', '2018-12-14 02:33:44.000', '2010-08-20 19:57:12.000', 427, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (2, 'So Tin Lok', '193-6404-0744', 'eFYRpQm85I', '2015-04-11 11:04:38.000', 293.83, '891 Xiaoping E Rd, Baiyun ', '2011-07-11 16:43:48.000', '2022-12-19 09:57:24.000', 638, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (3, 'Dong Jialun', '769-140-1792', '34c4QqhEdP', '2025-01-25 14:20:17.000', 554.68, '787 Dongtai 5th St', '2004-01-30 20:39:08.000', '2001-12-19 19:47:06.000', 617, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (4, 'Yau Ho Yin', '614-532-1357', '58K0qIMTFH', '2000-04-22 15:58:26.000', 959.95, '202 East Cooke Road', '2021-07-11 07:29:10.000', '2007-04-23 07:01:57.000', 346, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (5, 'Marcus Carter', '330-632-8107', 'cs8OgUXZWK', '2008-05-18 08:23:28.000', 993.27, '277 Collier Road', '2003-11-29 08:40:46.000', '2006-09-01 00:01:38.000', 142, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (6, 'Wu Rui', '21-292-3545', 'm0VceJVPwD', '2023-11-27 20:30:04.000', 171.91, '773 Hongqiao Rd., Xu Hui District', '2002-06-06 22:45:15.000', '2010-08-30 08:05:24.000', 551, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (7, 'Allen Barnes', '(151) 829 4911', 'UUi2Ns1a9d', '2010-04-01 05:01:42.000', 253.23, '985 Earle Rd', '2002-08-20 19:00:41.000', '2005-10-01 02:43:06.000', 189, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (8, 'Sakurai Eita', '(121) 232 3828', 'i8GaFt1sFj', '2001-05-08 21:52:54.000', 883.84, '24 Lower Temple Street', '2004-06-01 20:54:31.000', '2005-10-08 14:05:35.000', 470, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (9, 'Xiao Zhiyuan', '312-218-3192', 'PguHRtNbpo', '2014-02-13 23:08:42.000', 129.00, '676 Rush Street', '2006-03-22 00:44:05.000', '2000-05-04 14:06:29.000', 432, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (10, 'Murata Tsubasa', '760-9433-5784', 'JOGPwYTUGi', '2017-08-03 15:14:40.000', 326.67, '679 Huaxia St, Jinghua Shangquan', '2008-04-25 05:13:08.000', '2001-11-30 17:43:18.000', 63, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (11, 'Dai Rui', '769-4814-1531', 'WnsQGRORbx', '2018-08-03 15:12:47.000', 655.09, '141 Huanqu South Street 2nd Alley', '2006-08-24 18:31:24.000', '2021-06-18 00:25:55.000', 823, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (12, 'Chic Ching Wan', '(20) 5793 8783', 'ndZNzMHhM6', '2002-12-20 15:41:24.000', 381.03, '735 Pollen Street', '2024-09-04 00:03:44.000', '2022-06-27 20:20:57.000', 828, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (13, 'Maria Gordon', '330-897-0838', 'mCIyU4z8wO', '2013-08-03 17:20:20.000', 0.92, '630 Fern Street', '2023-03-17 06:03:00.000', '2003-03-03 20:36:50.000', 786, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (14, 'Feng Yuning', '130-6496-6718', '5aQYlRAPMr', '2012-08-23 00:37:41.000', 956.87, '528 FuXingMenNei Street, XiCheng District', '2005-02-12 01:34:15.000', '2005-05-30 13:26:37.000', 979, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (15, 'Frank Herrera', '7944 609444', '9cXMudiP1j', '2014-05-14 16:53:20.000', 156.01, '875 39 William IV St, Charing Cross', '2010-06-25 15:11:49.000', '2023-03-21 00:26:22.000', 890, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (16, 'Antonio Romero', '718-916-4417', 'jddtY0i4ul', '2005-07-01 23:25:05.000', 674.61, '947 Bergen St', '2014-08-17 06:27:17.000', '2014-06-07 12:31:47.000', 372, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (17, 'Charles White', '330-678-1874', 'Tzshaxu9v3', '2020-09-10 15:32:03.000', 69.37, '400 West Market Street', '2001-07-28 07:45:18.000', '2006-02-18 10:50:20.000', 958, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (20, 'Sarah Patel', '66-813-0716', 'KNH6TUFl7H', '2007-09-06 17:52:23.000', 427.28, '1-1-8 Deshiro, Nishinari Ward', '2013-07-28 12:16:30.000', '2023-12-24 03:54:06.000', 72, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (21, 'Kam Ka Man', '(20) 4370 1544', 'wXD4ZxvoLD', '2013-02-28 05:38:33.000', 953.80, '48 Hanover Street', '2004-06-07 08:35:04.000', '2015-08-31 01:01:45.000', 192, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (22, 'Robert Ryan', '21-714-8746', 'BV3AcvDv4g', '2016-07-14 13:03:33.000', 666.03, '579 Middle Huaihai Road, Huangpu District', '2021-05-06 14:11:27.000', '2010-03-13 00:19:42.000', 364, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (23, 'Tang Zhiyuan', '137-7574-5336', 'AWxz1gOsVn', '2009-12-24 01:27:56.000', 962.64, '895 Huanqu South Street 2nd Alley', '2024-01-18 03:56:24.000', '2004-01-14 01:16:35.000', 827, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (24, 'Pak Suk Yee', '(151) 386 9126', 'xoJS2keLkr', '2003-01-08 13:31:12.000', 210.98, '473 Earle Rd', '2021-02-01 06:34:11.000', '2020-10-22 03:11:41.000', 297, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (25, 'Nakagawa Mai', '7694 777319', 'Wk66sFFffB', '2015-02-21 11:46:34.000', 360.15, '16 Papworth Rd, Trumpington', '2014-05-16 10:40:12.000', '2021-11-24 00:32:27.000', 465, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (26, 'Noguchi Kasumi', '769-9385-7721', 'OdQGA0U2DF', '2001-03-18 21:38:25.000', 654.13, '47 Shanhu Rd', '2006-02-11 18:41:36.000', '2019-02-24 00:23:04.000', 600, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (27, 'Chang Kar Yan', '213-603-1818', 'sa0jI0KTSF', '2017-05-20 09:16:32.000', 978.96, '959 Sky Way', '2012-09-02 15:03:31.000', '2003-09-08 23:11:42.000', 629, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (28, 'Mak Kwok Kuen', '74-394-0565', 'jRTh4ft6uC', '2023-04-18 22:39:10.000', 601.09, '3-9-8 Gakuenminami', '2014-03-18 17:17:11.000', '2017-12-23 17:25:19.000', 88, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (29, 'Yamada Momoka', '70-3777-0318', 'gMQJUk3X3S', '2008-08-16 17:08:34.000', 367.43, '1-7-8 Omido, Higashiosaka', '2015-11-20 15:25:55.000', '2005-04-25 13:25:15.000', 56, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (30, 'Chung Chi Ming', '90-2411-7944', 'jdY91lrnSh', '2017-01-11 21:48:39.000', 195.52, '12 3-803 Kusunokiajima, Kita Ward', '2021-06-15 14:48:43.000', '2007-04-24 21:47:32.000', 607, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (31, 'Ye Shihan', '74-396-5924', 'DXban5f6aQ', '2011-08-23 06:26:50.000', 537.58, '1-7-16 Saidaiji Akodacho', '2016-03-22 07:51:26.000', '2019-11-11 16:42:17.000', 298, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (32, 'Ying Kwok Wing', '5895 053476', 'KqhCMuFHEy', '2019-04-05 12:47:37.000', 799.78, '182 New Wakefield St', '2006-06-14 12:00:23.000', '2014-09-27 09:47:11.000', 245, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (33, 'Bernard Lopez', '212-805-0479', 'g0evuoQwxK', '2009-07-13 14:09:03.000', 284.98, '697 Wooster Street', '2002-05-31 22:21:22.000', '2002-08-09 01:56:44.000', 107, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (34, 'Wu Ming Sze', '7770 755592', 'KAtqJsGufX', '2017-11-23 16:15:11.000', 756.10, '32 Hinckley Rd', '2007-03-11 17:05:08.000', '2008-09-29 10:02:51.000', 142, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (35, 'Takagi Yuito', '70-7709-6794', 'rqbKxg3APi', '2008-03-18 15:39:21.000', 791.43, '5-19-16 Shinei 4 Jo, Kiyota Ward', '2018-01-12 04:49:01.000', '2010-10-01 13:35:07.000', 400, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (36, 'Han Zitao', '191-0594-0435', 'zEt7vyZnAW', '2020-11-24 09:27:10.000', 214.58, '425 Jiangnan West Road, Haizhu District', '2017-02-09 18:15:50.000', '2013-10-31 08:40:05.000', 464, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (37, 'Lee Tsz Ching', '20-374-0530', '93hxXM2hHJ', '2007-12-27 15:35:52.000', 796.77, '115 Xiaoping E Rd, Baiyun ', '2023-09-25 05:14:02.000', '2007-03-13 19:44:06.000', 260, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (38, 'Yam Lik Sun', '66-729-0348', 'WDJd0gpcxQ', '2004-12-02 04:52:19.000', 106.11, '3-27-4 Higashitanabe, Higashisumiyoshi Ward', '2011-01-12 11:03:20.000', '2012-12-26 00:20:03.000', 506, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (39, 'Fred Ryan', '7176 167133', 'mE6JxzgiYi', '2003-02-10 14:34:40.000', 369.37, '605 Elms Rd, Botley', '2015-05-12 08:20:33.000', '2002-10-14 23:11:20.000', NULL, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (40, 'Pamela Webb', '312-494-5658', 'JhRuaqVsYY', '2009-03-28 20:42:39.000', 889.39, '698 Pedway', '2001-06-10 21:09:23.000', '2006-07-20 01:09:06.000', 230, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (41, 'Kathryn Jenkins', '(1865) 82 7292', 'htgO7942f3', '2004-05-14 06:51:41.000', 453.87, '246 Osney Mead', '2016-01-23 01:29:41.000', '2023-07-11 09:20:46.000', 204, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (42, 'Wu Shihan', '80-2986-5168', 'HQErWNzXnv', '2023-02-11 18:22:17.000', 756.22, '5-2-8 Higashi Gotanda, Shinagawa-ku ', '2009-12-30 06:21:22.000', '2013-11-06 08:23:52.000', 400, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (43, 'Hsuan Wing Fat', '183-0717-5846', 'N8BHxDlg03', '2025-01-27 11:57:20.000', 12.35, '440 Hongqiao Rd., Xu Hui District', '2021-04-13 23:18:57.000', '2018-02-18 07:01:15.000', 318, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (44, 'Andrew Mitchell', '70-0680-3360', 'ZmQBaBqPMp', '2010-10-05 07:59:46.000', 828.33, '5-2-11 Kikusui 3 Jo, Shiroishi Ward', '2016-06-28 16:26:26.000', '2015-03-05 18:05:57.000', 587, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (45, 'Guo Ziyi', '5931 387511', 'DcnOv6imto', '2009-12-28 02:47:22.000', 817.97, '80 Volac Park, Grantchester Rd', '2021-02-04 05:14:47.000', '2008-05-19 23:38:23.000', 567, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (46, 'Zeng Lan', '(116) 863 7642', 'An0SnUVDMJ', '2014-06-28 12:11:27.000', 911.00, '539 Cyril St, Braunstone Town', '2013-07-08 10:31:37.000', '2001-10-04 20:19:39.000', 890, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (47, 'Mak Sum Wing', '755-293-7071', 'duadtBNKDZ', '2005-03-28 04:21:02.000', 978.46, '812 Shennan E Rd, Cai Wu Wei, Luohu District', '2013-09-20 04:32:23.000', '2003-05-15 19:00:39.000', 781, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (48, 'Ruth King', '7662 685254', 'dN4wRngkCe', '2003-07-27 15:47:42.000', 690.48, '115 The Pavilion, Lammas Field, Driftway', '2012-11-10 20:28:46.000', '2006-08-30 17:09:05.000', 749, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (49, 'Otsuka Sara', '212-396-8188', 'sfvuugtRvI', '2021-02-11 05:12:18.000', 523.79, '587 Fifth Avenue', '2006-06-02 08:30:42.000', '2007-01-05 21:54:18.000', 692, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (50, 'Leroy Mason', '7421 608388', 'MFCe9uz81z', '2017-04-17 16:09:38.000', 405.41, '221 Maddox Street', '2024-07-02 02:56:03.000', '2012-01-30 02:05:45.000', 410, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (51, 'Watanabe Mitsuki', '7976 214445', 'caTf4P2FCk', '2016-05-01 15:05:03.000', 266.70, '950 Earle Rd', '2020-02-14 17:45:40.000', '2010-09-30 15:23:42.000', 488, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (52, 'Xiong Lan', '7481 097230', 'IyvMR0sYNG', '2002-12-25 19:16:18.000', 511.98, '253 Mosley St', '2014-05-07 23:29:08.000', '2015-03-31 06:46:11.000', 503, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (53, 'Hao Xiaoming', '213-821-0354', 'tt0fp6hfjW', '2016-03-05 05:37:52.000', 97.65, '611 Wall Street', '2017-09-18 09:31:30.000', '2005-10-27 14:58:21.000', NULL, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (54, 'Feng Yunxi', '189-5767-3645', 'u00jkZw1zd', '2009-12-03 03:52:04.000', 100.76, '256 Hongqiao Rd., Xu Hui District', '2020-01-11 16:05:13.000', '2024-05-02 20:14:54.000', 958, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (55, 'Yan Jiehong', '213-704-2191', '78hc1lOAFZ', '2008-08-28 21:23:30.000', 151.51, '16 Grape Street', '2007-02-26 04:59:35.000', '2014-11-16 01:45:10.000', 302, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (56, 'Arimura Momoka', '70-3364-9095', 'VgIEU3bLa1', '2001-03-28 13:52:00.000', 812.09, '4 1-1715 Sekohigashi, Moriyama Ward', '2008-12-23 01:56:41.000', '2016-07-14 17:31:55.000', 259, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (57, 'Kao On Na', '7852 120600', '070c0MDbd0', '2018-11-20 10:53:53.000', 128.40, '552 The Pavilion, Lammas Field, Driftway', '2010-08-27 08:32:20.000', '2022-06-08 14:41:25.000', 651, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (58, 'Duan Jialun', '5814 949530', 'gxfQrFQ3TV', '2022-08-21 01:22:34.000', 216.56, '790 Lower Temple Street', '2014-08-31 20:10:57.000', '2017-07-14 00:42:57.000', 276, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (59, 'Beverly Olson', '5957 471624', 'ldC55gRKRf', '2003-10-13 21:42:58.000', 389.32, '245 Elms Rd, Botley', '2000-12-24 21:11:38.000', '2015-02-23 20:49:22.000', 750, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (60, 'Sasaki Akina', '28-017-7263', 'DzE0PhKQts', '2003-05-26 07:53:51.000', 712.11, '29 4th Section  Renmin South Road, Jinjiang District', '2013-09-01 06:47:25.000', '2014-12-22 02:57:14.000', 494, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (61, 'Yuen Hok Yau', '718-969-3870', 'Fv4g4gnP4L', '2011-09-13 22:12:14.000', 511.80, '551 Flatbush Ave', '2000-12-25 23:50:44.000', '2018-08-02 08:43:01.000', 151, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (62, 'Shing Wing Sze', '755-0518-9612', 'BJ7fck2oSv', '2014-07-13 06:07:52.000', 665.43, '856 Jingtian East 1st St, Futian District', '2012-11-28 07:46:51.000', '2014-06-16 10:18:14.000', 691, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (63, 'Xu Jiehong', '21-474-9695', 'By1B6wJMem', '2016-09-30 11:10:32.000', 643.91, '391 Jianxiang Rd, Pudong', '2008-02-21 05:49:09.000', '2001-12-31 08:03:04.000', 693, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (64, 'Duan Shihan', '184-7324-2848', '8OFGXuHA3v', '2001-06-19 23:42:01.000', 814.10, '978 FuXingMenNei Street, XiCheng District', '2017-06-20 09:12:51.000', '2019-04-11 21:58:45.000', 554, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (65, 'Tang Ka Ling', '155-8231-9735', 'JkHFytzuzU', '2015-12-20 13:15:26.000', 384.60, '372 Shennan E Rd, Cai Wu Wei, Luohu District', '2010-11-16 21:00:02.000', '2009-03-16 23:09:29.000', 121, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (66, 'Dai Jiehong', '28-3598-3405', 'CX4wkpQdEE', '2007-09-18 00:49:50.000', 730.55, '618 4th Section  Renmin South Road, Jinjiang District', '2009-05-24 22:07:35.000', '2020-10-30 06:05:12.000', 111, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (67, 'Matsui Ayato', '3-6452-3369', 'n1F0RyH5o6', '2008-08-05 03:32:31.000', 840.24, '5-2-11 Higashi Gotanda, Shinagawa-ku ', '2008-10-24 12:37:06.000', '2018-04-19 05:56:09.000', 967, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (68, 'Murakami Mitsuki', '(1223) 03 2839', '2VKT8d0avn', '2008-02-12 12:52:31.000', 325.79, '16 Silver St, Newnham', '2007-11-09 08:04:59.000', '2001-07-03 22:19:27.000', 11, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (69, 'Chiang Wai Lam', '(1223) 60 9670', '5d2Czul9G8', '2002-10-23 00:00:39.000', 760.94, '333 Silver St, Newnham', '2004-02-03 19:11:31.000', '2011-04-25 23:35:03.000', 382, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (70, 'Chiba Daichi', '11-553-8170', 'YHaalneu1O', '2002-01-10 09:03:12.000', 737.99, '5-19-19 Shinei 4 Jo, Kiyota Ward', '2022-03-18 14:44:17.000', '2012-11-15 04:04:19.000', 483, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (71, 'Tang Xiaoming', '614-656-5587', 'eDOpKw0BIs', '2009-06-24 23:36:11.000', 588.01, '134 East Cooke Road', '2010-11-16 14:22:36.000', '2019-03-25 04:46:48.000', 257, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (72, 'Cheng Yunxi', '213-226-2472', 'egBarC9oSC', '2001-02-20 19:30:17.000', 945.56, '491 Grape Street', '2011-04-30 09:14:33.000', '2013-10-18 14:15:56.000', 322, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (73, 'Liao Ziyi', '755-672-8887', 'NWRcwo8dj2', '2020-04-27 06:12:15.000', 490.14, '224 W Ring Rd, Buji Town, Longgang', '2016-08-27 23:29:09.000', '2013-08-17 11:56:50.000', 764, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (74, 'Tang Yu Ling', '718-322-3298', 'Q0q1JCU0pC', '2016-03-08 13:20:42.000', 162.04, '33 Columbia St', '2021-11-13 20:19:13.000', '2011-08-09 12:05:07.000', 711, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (75, 'Kwok Hiu Tung', '614-017-3621', 'EqlFq9kz8D', '2015-08-24 20:12:17.000', 79.74, '82 East Cooke Road', '2019-03-17 03:28:10.000', '2009-05-14 05:11:43.000', 991, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (76, 'Juan Hill', '159-5953-6725', 'o3lUZOdb5R', '2005-09-16 03:33:05.000', 796.28, '252 Tianhe Road, Tianhe District', '2010-11-29 13:59:16.000', '2016-01-03 18:58:37.000', 209, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (77, 'Bryan Ford', '718-661-4926', 'WDDJnWZhxI', '2011-12-26 20:54:26.000', 373.06, '525 Bergen St', '2017-07-10 04:36:12.000', '2002-07-20 22:38:34.000', 116, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (78, 'Saito Daichi', '614-427-4619', 'DnOIOH13W2', '2005-04-14 14:14:09.000', 217.14, '114 East Alley', '2000-07-14 01:42:18.000', '2017-02-01 12:01:37.000', 987, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (79, 'Amanda Grant', '176-8005-0973', 'LHRMSeoKiT', '2013-07-10 01:48:37.000', 395.22, '922 East Wangfujing Street, Dongcheng District ', '2013-05-12 19:59:22.000', '2022-11-01 21:26:40.000', 147, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (80, 'Shirley Romero', '7240 193725', 'WdAYmuYRs4', '2012-07-19 12:27:43.000', 583.63, '611 Trafalgar Square, Charing Cross', '2000-10-20 02:48:05.000', '2008-11-24 01:01:52.000', 829, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (81, 'Wong Chun Yu', '(161) 563 1395', 'OS5V9osa8g', '2011-07-25 08:47:35.000', 949.02, '40 Spring Gardens', '2018-12-13 17:25:18.000', '2011-11-18 23:27:44.000', 879, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (82, 'Mario Miller', '10-405-3329', 'tuvEbMlIwf', '2005-07-18 05:35:02.000', 138.15, '187 Sanlitun Road, Chaoyang District', '2017-08-15 09:02:52.000', '2008-07-26 15:36:32.000', 9, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (83, 'Yu Shihan', '755-5075-4530', 'IQ1Sa46r7z', '2005-06-18 03:00:38.000', 216.95, '734 Shennan E Rd, Cai Wu Wei, Luohu District', '2009-12-29 03:37:00.000', '2025-01-31 23:26:55.000', 860, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (84, 'Zeng Zitao', '7124 967779', '当期', '2013-11-24 00:00:00.000', 180.62, '463 New Wakefield St', '2025-02-10 11:59:44.000', '2025-05-05 03:21:15.845', 2, '2025-06-06 00:00:00.000', '2025-05-01 00:00:00.000');
INSERT INTO `rental_tenant` VALUES (85, 'Denise Flores', '136-5841-7470', 'LS0Ga1LM22', '2017-10-01 21:36:14.000', 1.82, '155 Kengmei 15th Alley', '2021-04-11 03:02:10.000', '2008-09-25 07:29:50.000', 176, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (86, 'Liang Ziyi', '212-488-7131', 'bTDht2ylLF', '2023-02-02 00:00:00.000', 3.48, '976 Bank Street', '2024-02-09 05:37:13.000', '2025-05-05 03:26:40.586', 1, '2025-05-30 00:00:00.000', '2025-05-09 00:00:00.000');
INSERT INTO `rental_tenant` VALUES (87, 'Shi Zhennan', '21-258-3776', '4M4ssyranG', '2003-07-13 20:48:19.000', 560.05, '115 Binchuan Rd, Minhang District', '2001-12-01 08:21:17.000', '2015-09-27 04:54:31.000', 541, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (88, 'Wan Sze Yu', '183-7655-8054', 'YhzOViDGYb', '2013-12-17 01:39:23.000', 960.40, '19 Xiaoping E Rd, Baiyun ', '2008-08-08 08:21:41.000', '2005-02-03 09:24:36.000', 663, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (89, 'Lok Sze Kwan', '330-175-6373', 'TpD1WDzTbf', '2021-08-30 09:06:18.000', 866.19, '434 Ridgewood Road', '2017-08-23 17:32:17.000', '2019-08-19 05:46:02.000', 297, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (90, 'Siu Ka Ming', '10-917-3551', '1o8Ni7FeXx', '2019-10-24 19:14:12.000', 998.72, '7 Dong Zhi Men, Dongcheng District', '2000-05-21 08:16:11.000', '2018-04-02 02:52:57.000', 730, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (91, 'Kudo Hina', '330-567-7707', 'oLWeNgM2hy', '2023-07-13 11:36:52.000', 573.24, '940 Ridgewood Road', '2018-02-09 16:16:38.000', '2020-02-11 15:37:52.000', 565, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (92, 'To Wai Yee', '149-9923-1193', 'Hvv8DhKRCE', '2007-02-24 02:27:36.000', 800.35, '735 Yueliu Rd, Fangshan District', '2014-09-23 16:05:54.000', '2016-09-19 17:14:43.000', 536, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (93, 'Murakami Yota', '718-506-3289', '22ATADc2kE', '2022-12-22 23:52:09.000', 308.55, '420 Flatbush Ave', '2020-04-02 13:29:55.000', '2022-05-21 19:18:48.000', 544, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (94, 'Han Jialun', '3-8850-7023', 'CrWKcH0fi1', '2006-02-08 01:24:05.000', 666.82, '1-6-11, Marunouchi, Chiyoda-ku', '2024-04-23 15:54:46.000', '2019-05-26 21:21:56.000', 494, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (95, 'Kono Ayano', '330-468-9990', 'vGFowpFIxh', '2003-10-08 19:44:22.000', 643.89, '957 Riverview Road', '2024-09-26 04:59:34.000', '2010-08-04 16:10:40.000', 499, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (96, 'Matsui Sakura', '74-534-7091', '0gyHd9Zwl3', '2001-03-30 02:58:49.000', 276.92, '3-9-19 Gakuenminami', '2000-08-05 15:08:01.000', '2005-01-08 12:41:35.000', 561, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (97, 'Tang Rui', '(1223) 56 6843', 'OMMZbrtJ0V', '2001-07-01 13:35:04.000', 200.39, '131 Whitehouse Lane, Huntingdon Rd', '2024-06-21 22:19:21.000', '2002-10-20 08:56:12.000', 836, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (98, 'Edwin Meyer', '7983 490600', 'gXUFMdC9YU', '2021-03-29 06:04:57.000', 49.67, '422 Narborough Rd', '2017-10-07 06:34:41.000', '2012-10-17 00:46:15.000', 69, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (99, 'Kato Kenta', '718-686-5094', 'lCJRPY8ox4', '2020-08-13 21:39:53.000', 197.31, '4 Flatbush Ave', '2007-08-04 11:28:09.000', '2018-05-04 15:51:35.000', 824, NULL, NULL);
INSERT INTO `rental_tenant` VALUES (100, 'Pauline Kelly', '(116) 916 9078', '2nJIiw3F2h', '2008-03-26 19:14:44.000', 940.11, '195 Cyril St, Braunstone Town', '2010-11-24 16:45:16.000', '2006-11-01 21:49:33.000', 42, NULL, NULL);

-- ----------------------------
-- Table structure for role
-- ----------------------------
DROP TABLE IF EXISTS `role`;
CREATE TABLE `role`  (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `remark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `status` tinyint(1) NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`role_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of role
-- ----------------------------
INSERT INTO `role` VALUES (1, 'Super', NULL, 1, '2025-04-12 10:22:09.885', '2025-04-15 09:26:36.083');
INSERT INTO `role` VALUES (3, 'Test', NULL, 1, '2025-04-15 09:12:53.773', '2025-04-28 03:14:13.603');
INSERT INTO `role` VALUES (4, '普通账户', NULL, 1, '2025-04-28 02:22:58.908', '2025-04-29 09:18:08.996');
INSERT INTO `role` VALUES (5, '财务', NULL, 1, '2025-04-29 09:19:00.204', '2025-04-29 09:19:00.204');

-- ----------------------------
-- Table structure for role_menu
-- ----------------------------
DROP TABLE IF EXISTS `role_menu`;
CREATE TABLE `role_menu`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `menu_id` int NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `role_menu_role_id_idx`(`role_id` ASC) USING BTREE,
  INDEX `role_menu_menu_id_idx`(`menu_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 85 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of role_menu
-- ----------------------------
INSERT INTO `role_menu` VALUES (1, 1, 10, '2025-04-12 10:21:55.931', NULL, 0);
INSERT INTO `role_menu` VALUES (2, 1, 11, '2025-04-12 10:22:00.212', NULL, 0);
INSERT INTO `role_menu` VALUES (3, 1, 17, '2025-04-12 10:35:43.365', NULL, 0);
INSERT INTO `role_menu` VALUES (4, 1, 12, '2025-04-12 02:35:51.110', '2025-04-12 02:35:51.110', 0);
INSERT INTO `role_menu` VALUES (5, 1, 13, '2025-04-12 02:35:51.110', '2025-04-12 02:35:51.110', 0);
INSERT INTO `role_menu` VALUES (6, 1, 14, '2025-04-12 02:35:51.110', '2025-04-12 02:35:51.110', 0);
INSERT INTO `role_menu` VALUES (7, 1, 15, '2025-04-12 02:35:51.110', '2025-04-12 02:35:51.110', 0);
INSERT INTO `role_menu` VALUES (8, 1, 16, '2025-04-12 02:35:51.110', '2025-04-12 02:35:51.110', 0);
INSERT INTO `role_menu` VALUES (10, 1, 18, '2025-04-12 02:37:14.110', '2025-04-12 02:37:14.110', 0);
INSERT INTO `role_menu` VALUES (11, 1, 20, '2025-04-12 02:42:05.694', '2025-04-12 02:42:05.694', 0);
INSERT INTO `role_menu` VALUES (12, 1, 21, '2025-04-12 02:42:05.694', '2025-04-12 02:42:05.694', 0);
INSERT INTO `role_menu` VALUES (13, 1, 22, '2025-04-12 02:42:05.694', '2025-04-12 02:42:05.694', 0);
INSERT INTO `role_menu` VALUES (14, 1, 23, '2025-04-12 02:42:05.694', '2025-04-12 02:42:05.694', 0);
INSERT INTO `role_menu` VALUES (15, 1, 24, '2025-04-12 02:42:05.694', '2025-04-12 02:42:05.694', 0);
INSERT INTO `role_menu` VALUES (16, 1, 26, '2025-04-12 02:44:18.056', '2025-04-12 02:44:18.056', 0);
INSERT INTO `role_menu` VALUES (17, 1, 27, '2025-04-12 02:44:18.056', '2025-04-12 02:44:18.056', 0);
INSERT INTO `role_menu` VALUES (18, 1, 25, '2025-04-12 02:44:18.056', '2025-04-12 02:44:18.056', 0);
INSERT INTO `role_menu` VALUES (19, 1, 28, '2025-04-12 02:49:39.969', '2025-04-12 02:49:39.969', 0);
INSERT INTO `role_menu` VALUES (20, 1, 29, '2025-04-12 02:49:39.969', '2025-04-12 02:49:39.969', 0);
INSERT INTO `role_menu` VALUES (21, 1, 30, '2025-04-12 02:49:39.969', '2025-04-12 02:49:39.969', 0);
INSERT INTO `role_menu` VALUES (22, 1, 31, '2025-04-12 02:49:39.969', '2025-04-12 02:49:39.969', 0);
INSERT INTO `role_menu` VALUES (23, 1, 32, '2025-04-14 02:56:18.660', '2025-04-14 02:56:18.660', 0);
INSERT INTO `role_menu` VALUES (25, 1, 34, '2025-04-14 07:35:56.048', '2025-04-14 07:35:56.048', 0);
INSERT INTO `role_menu` VALUES (26, 1, 35, '2025-04-14 07:39:36.333', '2025-04-14 07:39:36.333', 0);
INSERT INTO `role_menu` VALUES (27, 1, 36, '2025-04-14 07:53:39.842', '2025-04-14 07:53:39.842', 0);
INSERT INTO `role_menu` VALUES (28, 1, 38, '2025-04-15 00:58:18.368', '2025-04-15 00:58:18.368', 0);
INSERT INTO `role_menu` VALUES (29, 1, 39, '2025-04-15 03:59:14.771', '2025-04-15 03:59:14.771', 0);
INSERT INTO `role_menu` VALUES (30, 1, 40, '2025-04-15 07:04:25.957', '2025-04-15 07:04:25.957', 0);
INSERT INTO `role_menu` VALUES (34, 3, 16, '2025-04-15 09:18:44.541', '2025-04-15 09:18:44.541', 0);
INSERT INTO `role_menu` VALUES (35, 3, 18, '2025-04-15 09:18:44.541', '2025-04-28 03:14:13.649', 0);
INSERT INTO `role_menu` VALUES (36, 3, 20, '2025-04-15 09:18:44.541', '2025-04-28 03:14:13.614', 1);
INSERT INTO `role_menu` VALUES (37, 3, 15, '2025-04-15 09:18:44.541', '2025-04-15 09:18:44.541', 0);
INSERT INTO `role_menu` VALUES (38, 3, 22, '2025-04-15 09:18:44.541', '2025-04-15 09:18:44.541', 0);
INSERT INTO `role_menu` VALUES (39, 3, 26, '2025-04-15 09:18:44.541', '2025-04-15 09:18:44.541', 0);
INSERT INTO `role_menu` VALUES (40, 3, 27, '2025-04-15 09:18:44.541', '2025-04-15 09:18:44.541', 0);
INSERT INTO `role_menu` VALUES (41, 3, 28, '2025-04-15 09:18:44.541', '2025-04-15 09:18:44.541', 0);
INSERT INTO `role_menu` VALUES (42, 3, 29, '2025-04-15 09:18:44.541', '2025-04-15 09:18:44.541', 0);
INSERT INTO `role_menu` VALUES (43, 3, 30, '2025-04-15 09:18:44.541', '2025-04-15 09:18:44.541', 0);
INSERT INTO `role_menu` VALUES (44, 3, 39, '2025-04-17 07:44:27.190', '2025-04-17 07:44:27.190', 0);
INSERT INTO `role_menu` VALUES (45, 3, 43, '2025-04-18 06:54:47.954', '2025-04-18 06:54:47.954', 0);
INSERT INTO `role_menu` VALUES (46, 4, 22, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (47, 4, 29, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (48, 4, 30, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (49, 4, 27, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (50, 4, 28, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (51, 4, 26, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (52, 4, 27, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (53, 4, 28, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (54, 4, 29, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (55, 4, 30, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (56, 4, 39, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (57, 4, 43, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (58, 4, 12, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (59, 4, 13, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (60, 4, 14, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (61, 4, 32, '2025-04-28 02:24:04.170', '2025-04-29 09:18:09.017', 1);
INSERT INTO `role_menu` VALUES (62, 4, 23, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (63, 4, 24, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (64, 4, 25, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (65, 4, 31, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (66, 4, 41, '2025-04-28 02:24:04.170', '2025-04-28 02:24:04.170', 0);
INSERT INTO `role_menu` VALUES (67, 4, 16, '2025-04-28 03:14:28.096', '2025-04-28 03:14:28.096', 0);
INSERT INTO `role_menu` VALUES (68, 4, 18, '2025-04-28 03:14:28.096', '2025-04-29 09:18:09.017', 1);
INSERT INTO `role_menu` VALUES (69, 4, 20, '2025-04-29 09:18:09.042', '2025-04-29 09:18:09.042', 0);
INSERT INTO `role_menu` VALUES (70, 5, 16, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (71, 5, 18, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (72, 5, 15, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (73, 5, 21, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (74, 5, 40, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (75, 5, 39, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (76, 5, 40, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (77, 5, 27, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (78, 5, 26, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (79, 5, 27, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (80, 5, 28, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (81, 5, 29, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (82, 5, 30, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (83, 5, 22, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);
INSERT INTO `role_menu` VALUES (84, 5, 43, '2025-04-29 09:19:00.205', '2025-04-29 09:19:00.205', 0);

-- ----------------------------
-- Table structure for role_park
-- ----------------------------
DROP TABLE IF EXISTS `role_park`;
CREATE TABLE `role_park`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `park_id` int NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `role_park_role_id_idx`(`role_id` ASC) USING BTREE,
  INDEX `role_park_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 14 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of role_park
-- ----------------------------
INSERT INTO `role_park` VALUES (1, 3, 1, '2025-04-15 09:12:53.775', '2025-04-15 09:12:53.775', 0);
INSERT INTO `role_park` VALUES (2, 3, 2, '2025-04-15 09:24:14.637', '2025-04-15 09:26:24.711', 0);
INSERT INTO `role_park` VALUES (3, 3, 3, '2025-04-15 09:26:24.712', '2025-04-15 09:26:44.681', 1);
INSERT INTO `role_park` VALUES (4, 1, 1, '2025-04-15 09:26:36.086', '2025-04-15 09:26:36.086', 0);
INSERT INTO `role_park` VALUES (5, 1, 2, '2025-04-15 09:26:36.086', '2025-04-15 09:26:36.086', 0);
INSERT INTO `role_park` VALUES (6, 1, 3, '2025-04-15 09:26:36.086', '2025-04-15 09:26:36.086', 0);
INSERT INTO `role_park` VALUES (7, 4, 1, '2025-04-28 02:22:58.913', '2025-04-28 02:22:58.913', 0);
INSERT INTO `role_park` VALUES (8, 4, 2, '2025-04-28 02:22:58.913', '2025-04-28 02:22:58.913', 0);
INSERT INTO `role_park` VALUES (9, 4, 3, '2025-04-28 02:22:58.913', '2025-04-28 02:22:58.913', 0);
INSERT INTO `role_park` VALUES (10, 5, 1, '2025-04-29 09:19:00.206', '2025-04-29 09:19:00.206', 0);
INSERT INTO `role_park` VALUES (11, 5, 2, '2025-04-29 09:19:00.206', '2025-04-29 09:19:00.206', 0);
INSERT INTO `role_park` VALUES (12, 5, 3, '2025-04-29 09:19:00.206', '2025-04-29 09:19:00.206', 0);

-- ----------------------------
-- Table structure for transformer
-- ----------------------------
DROP TABLE IF EXISTS `transformer`;
CREATE TABLE `transformer`  (
  `transformer_id` int NOT NULL AUTO_INCREMENT,
  `transformer_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `specifications` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `remark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `create_time` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `check_time` datetime(3) NOT NULL,
  `factory_id` int NOT NULL DEFAULT 20,
  `img_url` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `park_id` int NOT NULL,
  PRIMARY KEY (`transformer_id`) USING BTREE,
  INDEX `transformer_factory_id_idx`(`factory_id` ASC) USING BTREE,
  INDEX `transformer_park_id_idx`(`park_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of transformer
-- ----------------------------

-- ----------------------------
-- Table structure for user
-- ----------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `real_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `home_path` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `user_username_key`(`username` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of user
-- ----------------------------
INSERT INTO `user` VALUES (1, 'Vben', 'vben', '123456', '/', '2025-03-31 15:27:42.386', NULL, NULL);
INSERT INTO `user` VALUES (2, 'Test', 'test', '123456', NULL, '2025-04-15 17:27:07.376', NULL, NULL);
INSERT INTO `user` VALUES (3, 'Jack', 'jack', '456789', NULL, '2025-04-17 15:27:26.000', NULL, NULL);
INSERT INTO `user` VALUES (4, 'Vivi', 'vivi', '456789', NULL, '2025-04-26 10:44:15.591', NULL, NULL);

-- ----------------------------
-- Table structure for user_code
-- ----------------------------
DROP TABLE IF EXISTS `user_code`;
CREATE TABLE `user_code`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `user_code_user_id_idx`(`user_id` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of user_code
-- ----------------------------

-- ----------------------------
-- Table structure for user_role
-- ----------------------------
DROP TABLE IF EXISTS `user_role`;
CREATE TABLE `user_role`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `update_time` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `user_role_user_id_idx`(`user_id` ASC) USING BTREE,
  INDEX `user_role_role_id_idx`(`role_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of user_role
-- ----------------------------
INSERT INTO `user_role` VALUES (1, 1, 1, '2025-04-12 10:22:42.628', NULL);
INSERT INTO `user_role` VALUES (2, 3, 3, '2025-04-17 15:28:08.000', NULL);
INSERT INTO `user_role` VALUES (3, 2, 3, '2025-04-15 17:27:22.015', NULL);

-- ----------------------------
-- Table structure for water_bill
-- ----------------------------
DROP TABLE IF EXISTS `water_bill`;
CREATE TABLE `water_bill`  (
  `water_id` int NOT NULL AUTO_INCREMENT,
  `bill_id` int NOT NULL,
  `meter_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_reading` decimal(10, 2) NULL DEFAULT 0.00,
  `current_reading` decimal(10, 2) NULL DEFAULT 0.00,
  `monthly_usage` decimal(10, 2) NULL DEFAULT 0.00,
  `multiplier` decimal(10, 2) NULL DEFAULT 0.00,
  `total_usage` decimal(10, 2) NULL DEFAULT 0.00,
  `unit_price` decimal(10, 8) NULL DEFAULT 0.00000000,
  `amount` decimal(10, 2) NULL DEFAULT 0.00,
  `create_time` datetime(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `receipt_time` datetime(3) NOT NULL,
  `remark` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `update_time` datetime(3) NULL DEFAULT NULL,
  PRIMARY KEY (`water_id`) USING BTREE,
  INDEX `water_bill_bill_id_idx`(`bill_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of water_bill
-- ----------------------------
INSERT INTO `water_bill` VALUES (1, 1, '', 0.00, 1.00, 1.00, 1.00, 1.00, 1.00000000, 1.00, '2025-04-14 01:18:33.920', '2025-04-14 01:18:17.416', '', '2025-04-14 01:18:33.920');
INSERT INTO `water_bill` VALUES (2, 2, '厂房用水', 2491.00, 2558.00, 67.00, 1.00, 67.00, 3.50000000, 234.50, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `water_bill` VALUES (3, 2, '办公室用水', 219.00, 224.00, 5.00, 1.00, 5.00, 3.50000000, 17.50, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `water_bill` VALUES (4, 2, '新增水表', 9.00, 15.00, 6.00, 1.00, 6.00, 3.50000000, 21.00, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `water_bill` VALUES (5, 2, '宿舍用水（冷水）', 1765.00, 1802.00, 37.00, 1.00, 37.00, 3.50000000, 129.50, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `water_bill` VALUES (6, 2, '宿舍用水（热水）', 296.00, 305.00, 9.00, 1.00, 9.00, 4.50000000, 40.50, '2025-04-16 08:02:38.551', '2025-04-16 07:56:41.769', '', '2025-04-16 08:02:38.551');
INSERT INTO `water_bill` VALUES (7, 2, '公共用水', 0.00, 0.00, 2800.00, 1.00, 2800.00, 0.10000000, 280.00, '2025-04-16 08:16:52.165', '2025-04-16 07:56:41.769', '', '2025-04-16 08:16:52.165');
INSERT INTO `water_bill` VALUES (8, 2, '合计', 0.00, 0.00, 0.00, 1.00, 124.00, 0.00000000, 723.00, '2025-04-16 08:42:38.402', '2025-04-16 07:56:41.769', '', '2025-04-16 08:42:38.402');

SET FOREIGN_KEY_CHECKS = 1;
