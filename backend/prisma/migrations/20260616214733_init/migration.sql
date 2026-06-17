-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `password_digest` VARCHAR(191) NOT NULL,
    `payment_key` VARCHAR(191) NOT NULL,
    `balance_cents` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    UNIQUE INDEX `users_payment_key_key`(`payment_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `account_type` VARCHAR(191) NOT NULL,
    `account_id` INTEGER NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `amount_cents` INTEGER NOT NULL,
    `balance_after_cents` INTEGER NOT NULL,
    `idempotency_key` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `reference_type` VARCHAR(191) NULL,
    `reference_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ledger_entries_account_type_account_id_idx`(`account_type`, `account_id`),
    INDEX `ledger_entries_created_at_idx`(`created_at`),
    INDEX `ledger_entries_idempotency_key_idx`(`idempotency_key`),
    INDEX `ledger_entries_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
