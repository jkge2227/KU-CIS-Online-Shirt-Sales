-- AlterTable
ALTER TABLE `order` ADD COLUMN `cancelNote` VARCHAR(191) NULL,
    ADD COLUMN `cancelReason` VARCHAR(191) NULL,
    ADD COLUMN `canceledAt` DATETIME(3) NULL,
    ADD COLUMN `canceledById` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Order_orderStatus_idx` ON `Order`(`orderStatus`);

-- CreateIndex
CREATE INDEX `Order_canceledAt_idx` ON `Order`(`canceledAt`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_canceledById_fkey` FOREIGN KEY (`canceledById`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
