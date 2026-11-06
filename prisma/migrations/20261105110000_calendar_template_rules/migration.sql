CREATE TABLE `regles_calendrier_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_template_id` INTEGER NOT NULL,
    `section_id` INTEGER NOT NULL,
    `cle` VARCHAR(64) NOT NULL,
    `type_regle` VARCHAR(48) NOT NULL,
    `mois_debut` SMALLINT NOT NULL,
    `jour_debut` SMALLINT NOT NULL,
    `mois_fin` SMALLINT NOT NULL,
    `jour_fin` SMALLINT NOT NULL,
    `recurrence` VARCHAR(24) NOT NULL,

    UNIQUE INDEX `regles_calendrier_templates_type_cle_key`(`type_template_id`, `cle`),
    UNIQUE INDEX `regles_calendrier_templates_section_key`(`section_id`),
    INDEX `regles_calendrier_templates_type_template_idx`(`type_template_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `regles_calendrier_templates`
  ADD CONSTRAINT `regles_calendrier_templates_type_template_id_fkey`
  FOREIGN KEY (`type_template_id`) REFERENCES `types_templates`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `regles_calendrier_templates_section_id_fkey`
  FOREIGN KEY (`section_id`) REFERENCES `sections_templates`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
