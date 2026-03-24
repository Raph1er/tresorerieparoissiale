-- Allow transactions to reference either a category or an event (exclusive in app logic).
ALTER TABLE `Transaction`
  MODIFY `categorieId` INTEGER NULL;
