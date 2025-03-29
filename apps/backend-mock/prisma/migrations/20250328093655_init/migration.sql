-- CreateTable
CREATE TABLE `amount_bill` (
    `bill_id` INTEGER NOT NULL AUTO_INCREMENT,
    `ele_fee` DECIMAL(10, 2) NULL,
    `water_fee` DECIMAL(10, 2) NULL,
    `factory_rent` DECIMAL(10, 2) NULL,
    `management_fee` DECIMAL(10, 2) NULL,
    `service_fee` DECIMAL(10, 2) NULL,
    `invoice_tax` DECIMAL(10, 2) NULL,
    `total_fee` DECIMAL(10, 2) NULL,
    `create_time` DATETIME(3) NULL,
    `receipt_time` DATETIME(3) NULL,
    `tenant_id` INTEGER NOT NULL,

    PRIMARY KEY (`bill_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car` (
    `car_id` INTEGER NOT NULL,
    `car_num` LONGTEXT NOT NULL,
    `status` INTEGER NOT NULL,
    `time` INTEGER NOT NULL,
    `remark` LONGTEXT NULL,

    PRIMARY KEY (`car_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ele_bill` (
    `ele_id` INTEGER NOT NULL AUTO_INCREMENT,
    `bill_id` INTEGER NOT NULL,
    `meter_name` VARCHAR(191) NULL,
    `previous_reading` DECIMAL(10, 2) NULL,
    `current_reading` DECIMAL(10, 2) NULL,
    `monthly_usage` DECIMAL(10, 2) NULL,
    `multiplier` DECIMAL(10, 2) NULL,
    `total_usage` DECIMAL(10, 2) NULL,
    `unit_price` FLOAT NULL,
    `amount` DECIMAL(10, 2) NULL,
    `remarks` VARCHAR(191) NULL,
    `create_time` DATETIME(3) NULL,
    `receipt_time` DATETIME(3) NULL,

    PRIMARY KEY (`ele_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant` (
    `tenant_id` INTEGER NOT NULL,
    `tenant_name` VARCHAR(30) NULL,

    PRIMARY KEY (`tenant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_code` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(100) NOT NULL,
    `user_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL,
    `real_name` VARCHAR(30) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `roles` VARCHAR(20) NOT NULL,
    `home_path` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `water_bill` (
    `water_id` INTEGER NOT NULL AUTO_INCREMENT,
    `bill_id` INTEGER NULL,
    `meter_name` VARCHAR(191) NULL,
    `previous_reading` DECIMAL(10, 2) NULL,
    `current_reading` DECIMAL(10, 2) NULL,
    `monthly_usage` DECIMAL(10, 2) NULL,
    `multiplier` DECIMAL(10, 2) NULL,
    `total_usage` DECIMAL(10, 2) NULL,
    `unit_price` FLOAT NULL,
    `amount` DECIMAL(10, 2) NULL,
    `remarks` VARCHAR(191) NULL,
    `create_time` DATETIME(3) NULL,
    `receipt_time` DATETIME(3) NULL,

    PRIMARY KEY (`water_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `amount_bill` ADD CONSTRAINT `tenant_no_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`tenant_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ele_bill` ADD CONSTRAINT `ele_bill_no_fk` FOREIGN KEY (`bill_id`) REFERENCES `amount_bill`(`bill_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_code` ADD CONSTRAINT `user_code_no_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_bill` ADD CONSTRAINT `water_bill_no_fk` FOREIGN KEY (`bill_id`) REFERENCES `amount_bill`(`bill_id`) ON DELETE SET NULL ON UPDATE CASCADE;
