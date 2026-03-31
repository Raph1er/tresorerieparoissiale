-- RPC atomiques pour le module Dimes
-- A executer dans SQL Editor Supabase.

CREATE OR REPLACE FUNCTION rpc_dime_create_repartition(
  p_montant DOUBLE PRECISION,
  p_description TEXT,
  p_date_operation TIMESTAMP,
  p_mode_paiement TEXT,
  p_evenement_id INT,
  p_utilisateur_id INT,
  p_categorie_entree_id INT,
  p_categorie_paroisse_id INT,
  p_categorie_responsable_id INT,
  p_categorie_levites_id INT,
  p_part_paroisse_mere DOUBLE PRECISION,
  p_part_caisse_locale DOUBLE PRECISION,
  p_part_responsable DOUBLE PRECISION,
  p_part_levites DOUBLE PRECISION,
  p_description_base TEXT
)
RETURNS TABLE (
  repartition_id INT,
  transaction_entree_id INT,
  trans_paroisse_id INT,
  trans_responsable_id INT,
  trans_levites_id INT,
  repartition_cree_le TIMESTAMP
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_entree_id INT;
  v_trans_paroisse_id INT;
  v_trans_responsable_id INT;
  v_trans_levites_id INT;
  v_repartition_id INT;
  v_repartition_cree_le TIMESTAMP;
BEGIN
  INSERT INTO transactions (
    type,
    montant,
    description,
    date_operation,
    mode_paiement,
    categorie_id,
    utilisateur_id,
    evenement_id,
    est_supprime
  )
  VALUES (
    'ENTREE',
    p_montant,
    p_description,
    p_date_operation,
    p_mode_paiement,
    p_categorie_entree_id,
    p_utilisateur_id,
    p_evenement_id,
    FALSE
  )
  RETURNING id INTO v_transaction_entree_id;

  INSERT INTO transactions (
    type,
    montant,
    description,
    date_operation,
    categorie_id,
    utilisateur_id,
    evenement_id,
    est_supprime
  )
  VALUES (
    'SORTIE',
    p_part_paroisse_mere,
    p_description_base || ' - Paroisse Mere',
    p_date_operation,
    p_categorie_paroisse_id,
    p_utilisateur_id,
    p_evenement_id,
    FALSE
  )
  RETURNING id INTO v_trans_paroisse_id;

  INSERT INTO transactions (
    type,
    montant,
    description,
    date_operation,
    categorie_id,
    utilisateur_id,
    evenement_id,
    est_supprime
  )
  VALUES (
    'SORTIE',
    p_part_responsable,
    p_description_base || ' - Responsable',
    p_date_operation,
    p_categorie_responsable_id,
    p_utilisateur_id,
    p_evenement_id,
    FALSE
  )
  RETURNING id INTO v_trans_responsable_id;

  INSERT INTO transactions (
    type,
    montant,
    description,
    date_operation,
    categorie_id,
    utilisateur_id,
    evenement_id,
    est_supprime
  )
  VALUES (
    'SORTIE',
    p_part_levites,
    p_description_base || ' - Levites',
    p_date_operation,
    p_categorie_levites_id,
    p_utilisateur_id,
    p_evenement_id,
    FALSE
  )
  RETURNING id INTO v_trans_levites_id;

  INSERT INTO repartition_dimes (
    transaction_id,
    total_dime,
    part_paroisse_mere,
    part_caisse_locale,
    part_responsable,
    part_levites
  )
  VALUES (
    v_transaction_entree_id,
    p_montant,
    p_part_paroisse_mere,
    p_part_caisse_locale,
    p_part_responsable,
    p_part_levites
  )
  RETURNING id, cree_le INTO v_repartition_id, v_repartition_cree_le;

  RETURN QUERY
  SELECT
    v_repartition_id,
    v_transaction_entree_id,
    v_trans_paroisse_id,
    v_trans_responsable_id,
    v_trans_levites_id,
    v_repartition_cree_le;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_dime_sync_repartition(
  p_repartition_id INT,
  p_transaction_entree_id INT,
  p_montant DOUBLE PRECISION,
  p_description TEXT,
  p_date_operation TIMESTAMP,
  p_mode_paiement TEXT,
  p_evenement_id INT,
  p_part_paroisse_mere DOUBLE PRECISION,
  p_part_caisse_locale DOUBLE PRECISION,
  p_part_responsable DOUBLE PRECISION,
  p_part_levites DOUBLE PRECISION,
  p_generated_description_base TEXT,
  p_generated_paroisse_id INT,
  p_generated_responsable_id INT,
  p_generated_levites_id INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE transactions
  SET
    montant = p_montant,
    description = p_description,
    date_operation = p_date_operation,
    mode_paiement = p_mode_paiement,
    evenement_id = p_evenement_id
  WHERE id = p_transaction_entree_id;

  IF p_generated_paroisse_id IS NOT NULL THEN
    UPDATE transactions
    SET
      montant = p_part_paroisse_mere,
      date_operation = p_date_operation,
      evenement_id = p_evenement_id,
      description = p_generated_description_base || ' - Paroisse Mere'
    WHERE id = p_generated_paroisse_id;
  END IF;

  IF p_generated_responsable_id IS NOT NULL THEN
    UPDATE transactions
    SET
      montant = p_part_responsable,
      date_operation = p_date_operation,
      evenement_id = p_evenement_id,
      description = p_generated_description_base || ' - Responsable'
    WHERE id = p_generated_responsable_id;
  END IF;

  IF p_generated_levites_id IS NOT NULL THEN
    UPDATE transactions
    SET
      montant = p_part_levites,
      date_operation = p_date_operation,
      evenement_id = p_evenement_id,
      description = p_generated_description_base || ' - Levites'
    WHERE id = p_generated_levites_id;
  END IF;

  UPDATE repartition_dimes
  SET
    total_dime = p_montant,
    part_paroisse_mere = p_part_paroisse_mere,
    part_caisse_locale = p_part_caisse_locale,
    part_responsable = p_part_responsable,
    part_levites = p_part_levites
  WHERE id = p_repartition_id;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_dime_delete_repartition(
  p_repartition_id INT,
  p_transaction_ids INT[]
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM repartition_dimes WHERE id = p_repartition_id;

  UPDATE transactions
  SET est_supprime = TRUE
  WHERE id = ANY(p_transaction_ids);
END;
$$;
