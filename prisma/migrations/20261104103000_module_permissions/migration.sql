CREATE TABLE `permissions_modules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `utilisateur_id` INTEGER NOT NULL,
    `module_key` VARCHAR(64) NOT NULL,
    `cree_le` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `permissions_modules_utilisateur_module_key_key`(`utilisateur_id`, `module_key`),
    INDEX `permissions_modules_module_key_idx`(`module_key`),
    PRIMARY KEY (`id`),
    CONSTRAINT `permissions_modules_utilisateur_id_fkey`
      FOREIGN KEY (`utilisateur_id`) REFERENCES `Utilisateur`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `permissions_modules` (`utilisateur_id`, `module_key`)
SELECT `id`, 'dashboard' FROM `Utilisateur` WHERE `role` <> 'ADMIN';
INSERT INTO `permissions_modules` (`utilisateur_id`, `module_key`)
SELECT `id`, 'transactions' FROM `Utilisateur` WHERE `role` <> 'ADMIN';
INSERT INTO `permissions_modules` (`utilisateur_id`, `module_key`)
SELECT `id`, 'dimes' FROM `Utilisateur` WHERE `role` <> 'ADMIN';
INSERT INTO `permissions_modules` (`utilisateur_id`, `module_key`)
SELECT `id`, 'categories' FROM `Utilisateur` WHERE `role` <> 'ADMIN';
INSERT INTO `permissions_modules` (`utilisateur_id`, `module_key`)
SELECT `id`, 'evenements' FROM `Utilisateur` WHERE `role` <> 'ADMIN';
INSERT INTO `permissions_modules` (`utilisateur_id`, `module_key`)
SELECT `id`, 'paudium' FROM `Utilisateur` WHERE `role` <> 'ADMIN';
INSERT INTO `permissions_modules` (`utilisateur_id`, `module_key`)
SELECT `id`, 'rapports' FROM `Utilisateur` WHERE `role` <> 'ADMIN';
