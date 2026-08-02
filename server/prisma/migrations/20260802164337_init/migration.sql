-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(30) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `birthDate` DATE NULL,
    `activityLevel` ENUM('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE') NOT NULL DEFAULT 'SEDENTARY',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `body_records` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `heightCm` DECIMAL(5, 2) NOT NULL,
    `weightKg` DECIMAL(5, 2) NOT NULL,
    `bmr` INTEGER NOT NULL,
    `tdee` INTEGER NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `body_records_userId_recordedAt_idx`(`userId`, `recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meals` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `mealType` ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK') NOT NULL,
    `eatenAt` DATETIME(3) NOT NULL,
    `imageUrl` VARCHAR(500) NULL,
    `imageKey` VARCHAR(255) NULL,
    `memo` TEXT NULL,
    `totalCalories` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `meals_userId_eatenAt_idx`(`userId`, `eatenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meal_items` (
    `id` VARCHAR(191) NOT NULL,
    `mealId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `quantity` VARCHAR(50) NULL,
    `calories` INTEGER NOT NULL,
    `carbsG` DECIMAL(6, 2) NOT NULL,
    `proteinG` DECIMAL(6, 2) NOT NULL,
    `fatG` DECIMAL(6, 2) NOT NULL,
    `confidence` DECIMAL(4, 3) NULL,
    `isEdited` BOOLEAN NOT NULL DEFAULT false,

    INDEX `meal_items_mealId_idx`(`mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_analysis_logs` (
    `id` VARCHAR(191) NOT NULL,
    `mealId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `rawResponse` JSON NOT NULL,
    `latencyMs` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_analysis_logs_mealId_idx`(`mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `body_records` ADD CONSTRAINT `body_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meals` ADD CONSTRAINT `meals_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meal_items` ADD CONSTRAINT `meal_items_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `meals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_analysis_logs` ADD CONSTRAINT `ai_analysis_logs_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `meals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
