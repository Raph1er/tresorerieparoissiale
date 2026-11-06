CREATE TABLE `programmes_semaine_assignations` (
    `date_debut` DATE NOT NULL,
    `programme_id` INTEGER NOT NULL,
    `associe_par_id` INTEGER NOT NULL,
    `associe_le` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `programmes_semaine_assignations_programme_id_key`(`programme_id`),
    PRIMARY KEY (`date_debut`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `programmes_semaine_assignations`
  ADD CONSTRAINT `programmes_semaine_assignations_programme_id_fkey`
  FOREIGN KEY (`programme_id`) REFERENCES `programmes_semaine`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `programmes_semaine_assignations_associe_par_id_fkey`
  FOREIGN KEY (`associe_par_id`) REFERENCES `utilisateurs`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `programmes_semaine_assignations` (`date_debut`, `programme_id`, `associe_par_id`, `associe_le`)
SELECT `date_debut`, `id`, `cree_par_id`, `modifie_le`
FROM `programmes_semaine` AS programme
WHERE NOT EXISTS (
  SELECT 1
  FROM `programmes_semaine` AS plus_recent
  WHERE plus_recent.`date_debut` = programme.`date_debut`
    AND (
      plus_recent.`modifie_le` > programme.`modifie_le`
      OR (
        plus_recent.`modifie_le` = programme.`modifie_le`
        AND plus_recent.`id` > programme.`id`
      )
    )
);
