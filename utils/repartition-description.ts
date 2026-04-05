const NOMS_CATEGORIES_DIMES = new Set([
    'Dîme totale Décaissée',
    'Dîme pour Paroisse Mère',
    'Dîme au Chargé paroissial',
    'Dîme aux Lévites',
]);

export function nettoyerDescriptionRepartition(
    description: string | null | undefined,
    categorieNom?: string | null
): string | null {
    const valeur = description?.trim();
    if (!valeur) {
        return null;
    }

    if (
        categorieNom &&
        NOMS_CATEGORIES_DIMES.has(categorieNom) &&
        /^Repartition\b/i.test(valeur)
    ) {
        return null;
    }

    return valeur;
}