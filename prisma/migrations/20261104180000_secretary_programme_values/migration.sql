CREATE TABLE `programmes_semaine_secretaires` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `programme_id` INTEGER NOT NULL,
    `utilisateur_id` INTEGER NOT NULL,
    `valeurs` JSON NOT NULL,
    `modifie_le` DATETIME(3) NOT NULL,

    UNIQUE INDEX `programmes_semaine_secretaires_programme_utilisateur_key`(`programme_id`, `utilisateur_id`),
    INDEX `programmes_semaine_secretaires_utilisateur_idx`(`utilisateur_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `programmes_semaine_secretaires`
  ADD CONSTRAINT `programmes_semaine_secretaires_programme_id_fkey`
  FOREIGN KEY (`programme_id`) REFERENCES `programmes_semaine`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `programmes_semaine_secretaires_utilisateur_id_fkey`
  FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
