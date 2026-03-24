-- DropForeignKey
ALTER TABLE `transaction` DROP FOREIGN KEY `Transaction_categorieId_fkey`;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_categorieId_fkey` FOREIGN KEY (`categorieId`) REFERENCES `Categorie`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
