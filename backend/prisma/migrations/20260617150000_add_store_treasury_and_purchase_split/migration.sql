-- CreateTable
CREATE TABLE `store_treasuries` (
    `id` INTEGER NOT NULL,
    `balance_cents` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `store_treasuries` (`id`, `balance_cents`, `created_at`, `updated_at`)
VALUES (1, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- AlterTable
ALTER TABLE `purchases`
    ADD COLUMN `gross_cents` INTEGER NULL,
    ADD COLUMN `fee_cents` INTEGER NULL,
    ADD COLUMN `cashback_cents` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `seller_net_cents` INTEGER NULL;

UPDATE `purchases`
SET
    `gross_cents` = `amount_cents`,
    `fee_cents` = 0,
    `cashback_cents` = 0,
    `seller_net_cents` = `amount_cents`
WHERE `gross_cents` IS NULL;

ALTER TABLE `purchases`
    MODIFY `gross_cents` INTEGER NOT NULL,
    MODIFY `fee_cents` INTEGER NOT NULL,
    MODIFY `seller_net_cents` INTEGER NOT NULL;

ALTER TABLE `purchases` DROP COLUMN `amount_cents`;
