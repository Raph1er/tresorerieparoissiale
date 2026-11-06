ALTER TABLE `Utilisateur`
  MODIFY `role` ENUM('ADMIN', 'TRESORIER', 'RESPONSABLE', 'AUDITEUR', 'SECRETAIRE') NOT NULL;

CREATE TABLE `types_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cle` VARCHAR(64) NOT NULL,
    `nom` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `cree_le` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modifie_le` DATETIME(3) NOT NULL,

    UNIQUE INDEX `types_templates_cle_key`(`cle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sections_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_template_id` INTEGER NOT NULL,
    `cle` VARCHAR(64) NOT NULL,
    `libelle` VARCHAR(120) NOT NULL,
    `ordre` INTEGER NOT NULL,
    `jour_decalage` INTEGER NULL,
    `heure` VARCHAR(5) NULL,

    UNIQUE INDEX `sections_templates_type_template_id_cle_key`(`type_template_id`, `cle`),
    INDEX `sections_templates_type_template_id_idx`(`type_template_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `champs_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section_id` INTEGER NOT NULL,
    `cle` VARCHAR(64) NOT NULL,
    `libelle` VARCHAR(120) NOT NULL,
    `type_donnee` VARCHAR(32) NOT NULL DEFAULT 'TEXTE',
    `ordre` INTEGER NOT NULL,
    `obligatoire` BOOLEAN NOT NULL DEFAULT false,
    `calcule` BOOLEAN NOT NULL DEFAULT false,
    `calcul` VARCHAR(64) NULL,

    UNIQUE INDEX `champs_templates_section_id_cle_key`(`section_id`, `cle`),
    INDEX `champs_templates_section_id_idx`(`section_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sections_templates`
  ADD CONSTRAINT `sections_templates_type_template_id_fkey`
  FOREIGN KEY (`type_template_id`) REFERENCES `types_templates`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `champs_templates`
  ADD CONSTRAINT `champs_templates_section_id_fkey`
  FOREIGN KEY (`section_id`) REFERENCES `sections_templates`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
