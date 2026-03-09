-- CreateTable
CREATE TABLE `Utilisateur` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `motDePasse` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'TRESORIER', 'RESPONSABLE', 'AUDITEUR') NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `creeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modifieLe` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Utilisateur_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Categorie` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `type` ENUM('ENTREE', 'SORTIE') NOT NULL,
    `description` VARCHAR(191) NULL,
    `estSysteme` BOOLEAN NOT NULL DEFAULT false,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `creeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `parentId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evenement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `dateDebut` DATETIME(3) NOT NULL,
    `dateFin` DATETIME(3) NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `creeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('ENTREE', 'SORTIE') NOT NULL,
    `montant` DOUBLE NOT NULL,
    `description` VARCHAR(191) NULL,
    `dateOperation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modePaiement` VARCHAR(191) NULL,
    `pieceJustificative` VARCHAR(191) NULL,
    `estSupprime` BOOLEAN NOT NULL DEFAULT false,
    `creeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modifieLe` DATETIME(3) NOT NULL,
    `categorieId` INTEGER NOT NULL,
    `utilisateurId` INTEGER NOT NULL,
    `evenementId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ValidationDepense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transactionId` INTEGER NOT NULL,
    `validateurId` INTEGER NOT NULL,
    `statut` ENUM('BROUILLON', 'EN_ATTENTE', 'VALIDEE', 'REJETEE') NOT NULL,
    `commentaire` VARCHAR(191) NULL,
    `valideLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RepartitionDime` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transactionId` INTEGER NOT NULL,
    `totalDime` DOUBLE NOT NULL,
    `partParoisseMere` DOUBLE NOT NULL,
    `partCaisseLocale` DOUBLE NOT NULL,
    `partResponsable` DOUBLE NOT NULL,
    `partLevites` DOUBLE NOT NULL,
    `creeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RepartitionDime_transactionId_key`(`transactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegleRepartitionDime` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pourcentageParoisseMere` DOUBLE NOT NULL,
    `pourcentageCaisseLocale` DOUBLE NOT NULL,
    `pourcentageResponsable` DOUBLE NOT NULL,
    `pourcentageLevites` DOUBLE NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `creeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalAction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `utilisateurId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `adresseIP` VARCHAR(191) NULL,
    `creeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Categorie` ADD CONSTRAINT `Categorie_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Categorie`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_categorieId_fkey` FOREIGN KEY (`categorieId`) REFERENCES `Categorie`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_utilisateurId_fkey` FOREIGN KEY (`utilisateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_evenementId_fkey` FOREIGN KEY (`evenementId`) REFERENCES `Evenement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValidationDepense` ADD CONSTRAINT `ValidationDepense_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValidationDepense` ADD CONSTRAINT `ValidationDepense_validateurId_fkey` FOREIGN KEY (`validateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepartitionDime` ADD CONSTRAINT `RepartitionDime_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalAction` ADD CONSTRAINT `JournalAction_utilisateurId_fkey` FOREIGN KEY (`utilisateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
