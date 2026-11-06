ALTER TABLE `champs_templates`
  ADD COLUMN `modifiable_par` VARCHAR(32) NOT NULL DEFAULT 'SECRETAIRE';

CREATE TABLE `programmes_semaine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_template_id` INTEGER NOT NULL,
    `date_debut` DATE NOT NULL,
    `date_fin` DATE NOT NULL,
    `version_template` INTEGER NOT NULL,
    `structure` JSON NOT NULL,
    `valeurs` JSON NOT NULL,
    `statut` VARCHAR(32) NOT NULL DEFAULT 'EN_PREPARATION',
    `cree_par_id` INTEGER NOT NULL,
    `cree_le` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modifie_le` DATETIME(3) NOT NULL,

    UNIQUE INDEX `programmes_semaine_type_template_date_debut_key`(`type_template_id`, `date_debut`),
    INDEX `programmes_semaine_date_debut_idx`(`date_debut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `programmes_semaine`
  ADD CONSTRAINT `programmes_semaine_type_template_id_fkey`
  FOREIGN KEY (`type_template_id`) REFERENCES `types_templates`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
