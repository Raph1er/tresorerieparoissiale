/**
 * Adaptateur de compatibilite Prisma -> Supabase.
 *
 * Prisma n'est pas supprime du projet, mais son usage runtime est desactive
 * temporairement pour pointer vers Supabase.
 */

import { supabaseServer } from './supabase';

type AnyRecord = Record<string, any>;

type OrderInput = Record<string, 'asc' | 'desc'> | undefined;

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, g: string) => g.toUpperCase());
}

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value);
}

function parseDateInput(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Keep date-only values in local time to avoid UTC day shifts.
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      return Number.isNaN(localDate.getTime()) ? null : localDate;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatDateForDb(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  const milliseconds = `${date.getMilliseconds()}`.padStart(3, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function toDbTimestamp(value: unknown): string | null {
  const parsed = parseDateInput(value);
  if (!parsed) return null;
  return formatDateForDb(parsed);
}

function applyDateRangeFilter(query: any, column: string, range: AnyRecord | undefined): any {
  if (!range || typeof range !== 'object') {
    return query;
  }

  let out = query;

  const gte = toDbTimestamp(range.gte);
  const lte = toDbTimestamp(range.lte);

  if (gte) out = out.gte(column, gte);
  if (lte) out = out.lte(column, lte);

  return out;
}

function applySelect<T = AnyRecord>(row: AnyRecord, select?: AnyRecord): T {
  if (!select) {
    return row as T;
  }

  const out: AnyRecord = {};

  for (const [key, spec] of Object.entries(select)) {
    if (spec === false) {
      continue;
    }

    if (spec === true) {
      out[key] = row[key];
      continue;
    }

    if (spec && typeof spec === 'object' && 'select' in (spec as AnyRecord)) {
      const nested = row[key];
      const nestedSelect = (spec as AnyRecord).select;

      if (Array.isArray(nested)) {
        out[key] = nested.map((item) => applySelect(item, nestedSelect));
      } else if (nested === null || nested === undefined) {
        out[key] = null;
      } else {
        out[key] = applySelect(nested, nestedSelect);
      }
      continue;
    }

    out[key] = row[key];
  }

  return out as T;
}

function normalizeOrderBy(orderBy: OrderInput): { field: string; ascending: boolean } | null {
  if (!orderBy) return null;
  const entries = Object.entries(orderBy);
  if (entries.length === 0) return null;

  const [field, direction] = entries[0];
  return {
    field: toSnakeCase(field),
    ascending: direction === 'asc',
  };
}

function normalizeUtilisateur(row: AnyRecord): AnyRecord {
  return {
    id: row.id,
    nom: row.nom,
    email: row.email,
    motDePasse: row.mot_de_passe,
    role: row.role,
    actif: row.actif,
    creeLe: toDateOrNull(row.cree_le),
    modifieLe: toDateOrNull(row.modifie_le),
  };
}

function normalizeCategorie(row: AnyRecord): AnyRecord {
  return {
    id: row.id,
    nom: row.nom,
    type: row.type,
    description: row.description,
    estSysteme: row.est_systeme,
    actif: row.actif,
    parentId: row.parent_id,
    parent: row.parent
      ? {
        id: row.parent.id,
        nom: row.parent.nom,
        type: row.parent.type,
      }
      : null,
    creeLe: toDateOrNull(row.cree_le),
  };
}

function normalizeEvenement(row: AnyRecord): AnyRecord {
  return {
    id: row.id,
    nom: row.nom,
    description: row.description,
    dateDebut: toDateOrNull(row.date_debut),
    dateFin: toDateOrNull(row.date_fin),
    actif: row.actif,
    creeLe: toDateOrNull(row.cree_le),
  };
}

function normalizeTransaction(row: AnyRecord): AnyRecord {
  return {
    id: row.id,
    type: row.type,
    montant: row.montant,
    description: row.description,
    dateOperation: toDateOrNull(row.date_operation),
    modePaiement: row.mode_paiement,
    pieceJustificative: row.piece_justificative,
    estSupprime: row.est_supprime,
    creeLe: toDateOrNull(row.cree_le),
    modifieLe: toDateOrNull(row.modifie_le),
    categorieId: row.categorie_id,
    categorie: row.categorie
      ? {
        id: row.categorie.id,
        nom: row.categorie.nom,
        type: row.categorie.type,
      }
      : null,
    utilisateurId: row.utilisateur_id,
    utilisateur: row.utilisateur
      ? {
        id: row.utilisateur.id,
        nom: row.utilisateur.nom,
        email: row.utilisateur.email,
      }
      : null,
    evenementId: row.evenement_id,
    evenement: row.evenement
      ? {
        id: row.evenement.id,
        nom: row.evenement.nom,
      }
      : null,
  };
}

function normalizeRepartitionDime(row: AnyRecord): AnyRecord {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    totalDime: row.total_dime,
    partParoisseMere: row.part_paroisse_mere,
    partCaisseLocale: row.part_caisse_locale,
    partResponsable: row.part_responsable,
    partLevites: row.part_levites,
    creeLe: toDateOrNull(row.cree_le),
    transaction: row.transaction
      ? {
        id: row.transaction.id,
        montant: row.transaction.montant,
        type: row.transaction.type,
        description: row.transaction.description,
        dateOperation: toDateOrNull(row.transaction.date_operation),
      }
      : null,
  };
}

function parseOrContainsSearch(orClause: string): string | null {
  const match = orClause.match(/ilike\.%(.*)%/i);
  return match?.[1] ?? null;
}

async function getCategorieCounts(categoryIds: number[]): Promise<Map<number, { sousCategories: number; transactions: number }>> {
  const result = new Map<number, { sousCategories: number; transactions: number }>();

  await Promise.all(
    categoryIds.map(async (id) => {
      const [{ count: sousCategoriesCount, error: childErr }, { count: transactionCount, error: txErr }] = await Promise.all([
        supabaseServer
          .from('categories')
          .select('*', { count: 'exact', head: true })
          .eq('parent_id', id),
        supabaseServer
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('categorie_id', id),
      ]);

      if (childErr) throw childErr;
      if (txErr) throw txErr;

      result.set(id, {
        sousCategories: sousCategoriesCount ?? 0,
        transactions: transactionCount ?? 0,
      });
    })
  );

  return result;
}

async function attachCategoryParents(rows: AnyRecord[]): Promise<AnyRecord[]> {
  const parentIds = Array.from(
    new Set(
      rows
        .map((row) => row.parent_id)
        .filter((parentId): parentId is number => typeof parentId === 'number')
    )
  );

  if (parentIds.length === 0) {
    return rows.map((row) => ({ ...row, parent: null }));
  }

  const { data, error } = await supabaseServer
    .from('categories')
    .select('id,nom,type')
    .in('id', parentIds);

  if (error) throw error;

  const parentMap = new Map<number, AnyRecord>((data ?? []).map((parent) => [parent.id, parent]));

  return rows.map((row) => ({
    ...row,
    parent: typeof row.parent_id === 'number' ? parentMap.get(row.parent_id) ?? null : null,
  }));
}

async function getEvenementCounts(evenementIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();

  await Promise.all(
    evenementIds.map(async (id) => {
      const { count, error } = await supabaseServer
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('evenement_id', id);

      if (error) throw error;
      result.set(id, count ?? 0);
    })
  );

  return result;
}

const utilisateurDelegate = {
  async create(args: AnyRecord): Promise<AnyRecord> {
    const payload: AnyRecord = {
      nom: args.data.nom,
      email: args.data.email,
      mot_de_passe: args.data.motDePasse,
      role: args.data.role,
      actif: args.data.actif ?? true,
    };

    const { data, error } = await supabaseServer
      .from('utilisateurs')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    return applySelect(normalizeUtilisateur(data), args.select);
  },

  async findUnique(args: AnyRecord): Promise<AnyRecord | null> {
    let query = supabaseServer.from('utilisateurs').select('*');

    if (args.where.id !== undefined) {
      query = query.eq('id', args.where.id);
    }

    if (args.where.email !== undefined) {
      query = query.eq('email', String(args.where.email).toLowerCase());
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return applySelect(normalizeUtilisateur(data), args.select);
  },

  async update(args: AnyRecord): Promise<AnyRecord> {
    const payload: AnyRecord = {};

    if (args.data.nom !== undefined) payload.nom = args.data.nom;
    if (args.data.email !== undefined) payload.email = String(args.data.email).toLowerCase();
    if (args.data.role !== undefined) payload.role = args.data.role;
    if (args.data.actif !== undefined) payload.actif = args.data.actif;
    if (args.data.motDePasse !== undefined) payload.mot_de_passe = args.data.motDePasse;

    const { data, error } = await supabaseServer
      .from('utilisateurs')
      .update(payload)
      .eq('id', args.where.id)
      .select('*')
      .single();

    if (error) throw error;

    return applySelect(normalizeUtilisateur(data), args.select);
  },

  async findMany(args: AnyRecord): Promise<AnyRecord[]> {
    let query = supabaseServer.from('utilisateurs').select('*');
    const where = args.where ?? {};

    if (where.OR && Array.isArray(where.OR)) {
      const search = where.OR[0]?.nom?.contains ?? where.OR[1]?.email?.contains;
      if (search) {
        query = query.or(`nom.ilike.%${search}%,email.ilike.%${search}%`);
      }
    }

    if (where.role !== undefined) query = query.eq('role', where.role);
    if (where.actif !== undefined) query = query.eq('actif', where.actif);

    query = applyDateRangeFilter(query, 'cree_le', where.creeLe);

    const order = normalizeOrderBy(args.orderBy);
    if (order) {
      query = query.order(order.field, { ascending: order.ascending });
    }

    if (args.skip !== undefined && args.take !== undefined) {
      query = query.range(args.skip, args.skip + args.take - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((item) => applySelect(normalizeUtilisateur(item), args.select));
  },

  async count(args?: AnyRecord): Promise<number> {
    let query = supabaseServer.from('utilisateurs').select('*', { count: 'exact', head: true });
    const where = args?.where ?? {};

    if (where.email !== undefined) query = query.eq('email', where.email);
    if (where.role !== undefined) query = query.eq('role', where.role);
    if (where.actif !== undefined) query = query.eq('actif', where.actif);

    if (where.id?.not !== undefined) {
      query = query.neq('id', where.id.not);
    }

    if (where.OR && Array.isArray(where.OR)) {
      const search = where.OR[0]?.nom?.contains ?? where.OR[1]?.email?.contains;
      if (search) {
        query = query.or(`nom.ilike.%${search}%,email.ilike.%${search}%`);
      }
    }

    query = applyDateRangeFilter(query, 'cree_le', where.creeLe);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  },

  async groupBy(args: AnyRecord): Promise<AnyRecord[]> {
    const where = args.where ?? {};
    let query = supabaseServer.from('utilisateurs').select('role');

    if (where.actif !== undefined) query = query.eq('actif', where.actif);

    const { data, error } = await query;
    if (error) throw error;

    const map = new Map<string, number>();
    for (const item of data ?? []) {
      const role = item.role as string;
      map.set(role, (map.get(role) ?? 0) + 1);
    }

    return Array.from(map.entries()).map(([role, count]) => ({ role, _count: count }));
  },
};

const categorieDelegate = {
  async create(args: AnyRecord): Promise<AnyRecord> {
    const payload: AnyRecord = {
      nom: args.data.nom,
      type: args.data.type,
      description: args.data.description ?? null,
      est_systeme: args.data.estSysteme ?? false,
      actif: args.data.actif ?? true,
      parent_id: args.data.parentId ?? null,
    };

    const { data, error } = await supabaseServer
      .from('categories')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    const [dataWithParent] = await attachCategoryParents([data]);

    const counts = await getCategorieCounts([data.id]);
    const normalized = {
      ...normalizeCategorie(dataWithParent),
      _count: counts.get(data.id) ?? { sousCategories: 0, transactions: 0 },
    };

    return applySelect(normalized, args.select);
  },

  async findUnique(args: AnyRecord): Promise<AnyRecord | null> {
    const { data, error } = await supabaseServer
      .from('categories')
      .select('*')
      .eq('id', args.where.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const [dataWithParent] = await attachCategoryParents([data]);

    const counts = await getCategorieCounts([data.id]);
    const normalized = {
      ...normalizeCategorie(dataWithParent),
      _count: counts.get(data.id) ?? { sousCategories: 0, transactions: 0 },
    };

    return applySelect(normalized, args.select);
  },

  async findFirst(args: AnyRecord): Promise<AnyRecord | null> {
    let query = supabaseServer
      .from('categories')
      .select('*');

    const where = args.where ?? {};
    if (where.nom !== undefined) query = query.eq('nom', where.nom);
    if (where.type !== undefined) query = query.eq('type', where.type);
    if (where.actif !== undefined) query = query.eq('actif', where.actif);

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const [dataWithParent] = await attachCategoryParents([data]);

    const counts = await getCategorieCounts([data.id]);
    const normalized = {
      ...normalizeCategorie(dataWithParent),
      _count: counts.get(data.id) ?? { sousCategories: 0, transactions: 0 },
    };

    return applySelect(normalized, args.select);
  },

  async update(args: AnyRecord): Promise<AnyRecord> {
    const payload: AnyRecord = {};

    if (args.data.nom !== undefined) payload.nom = args.data.nom;
    if (args.data.type !== undefined) payload.type = args.data.type;
    if (args.data.description !== undefined) payload.description = args.data.description;
    if (args.data.estSysteme !== undefined) payload.est_systeme = args.data.estSysteme;
    if (args.data.actif !== undefined) payload.actif = args.data.actif;

    if (args.data.parent !== undefined) {
      if (args.data.parent.disconnect) {
        payload.parent_id = null;
      }
      if (args.data.parent.connect?.id !== undefined) {
        payload.parent_id = args.data.parent.connect.id;
      }
    }

    if (args.data.parentId !== undefined) {
      payload.parent_id = args.data.parentId;
    }

    const { data, error } = await supabaseServer
      .from('categories')
      .update(payload)
      .eq('id', args.where.id)
      .select('*')
      .single();

    if (error) throw error;

    const [dataWithParent] = await attachCategoryParents([data]);

    const counts = await getCategorieCounts([data.id]);
    const normalized = {
      ...normalizeCategorie(dataWithParent),
      _count: counts.get(data.id) ?? { sousCategories: 0, transactions: 0 },
    };

    return applySelect(normalized, args.select);
  },

  async findMany(args: AnyRecord): Promise<AnyRecord[]> {
    let query = supabaseServer
      .from('categories')
      .select('*');

    const where = args.where ?? {};

    if (where.OR && Array.isArray(where.OR)) {
      const search = where.OR[0]?.nom?.contains ?? where.OR[1]?.description?.contains;
      if (search) {
        query = query.or(`nom.ilike.%${search}%,description.ilike.%${search}%`);
      }
    }

    if (where.type !== undefined) query = query.eq('type', where.type);
    if (where.actif !== undefined) query = query.eq('actif', where.actif);
    if (where.estSysteme !== undefined) query = query.eq('est_systeme', where.estSysteme);

    if (where.parentId !== undefined) {
      if (where.parentId === null) {
        query = query.is('parent_id', null);
      } else {
        query = query.eq('parent_id', where.parentId);
      }
    }

    const order = normalizeOrderBy(args.orderBy);
    if (order) {
      query = query.order(order.field, { ascending: order.ascending });
    }

    if (args.skip !== undefined && args.take !== undefined) {
      query = query.range(args.skip, args.skip + args.take - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = await attachCategoryParents(data ?? []);
    const counts = await getCategorieCounts(rows.map((r) => r.id));

    return rows.map((item) => {
      const normalized = {
        ...normalizeCategorie(item),
        _count: counts.get(item.id) ?? { sousCategories: 0, transactions: 0 },
      };
      return applySelect(normalized, args.select);
    });
  },

  async count(args?: AnyRecord): Promise<number> {
    let query = supabaseServer.from('categories').select('*', { count: 'exact', head: true });

    const where = args?.where ?? {};
    if (where.nom !== undefined) query = query.eq('nom', where.nom);
    if (where.type !== undefined) query = query.eq('type', where.type);
    if (where.actif !== undefined) query = query.eq('actif', where.actif);
    if (where.estSysteme !== undefined) query = query.eq('est_systeme', where.estSysteme);

    if (where.parentId !== undefined) {
      if (where.parentId === null) query = query.is('parent_id', null);
      else query = query.eq('parent_id', where.parentId);
    }

    if (where.id?.not !== undefined) {
      query = query.neq('id', where.id.not);
    }

    if (where.OR && Array.isArray(where.OR)) {
      const search = where.OR[0]?.nom?.contains ?? where.OR[1]?.description?.contains;
      if (search) {
        query = query.or(`nom.ilike.%${search}%,description.ilike.%${search}%`);
      }
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  },

  async groupBy(args: AnyRecord): Promise<AnyRecord[]> {
    let query = supabaseServer.from('categories').select('type');

    const where = args.where ?? {};
    if (where.actif !== undefined) query = query.eq('actif', where.actif);

    const { data, error } = await query;
    if (error) throw error;

    const map = new Map<string, number>();
    for (const item of data ?? []) {
      const type = item.type as string;
      map.set(type, (map.get(type) ?? 0) + 1);
    }

    return Array.from(map.entries()).map(([type, count]) => ({ type, _count: { id: count } }));
  },
};

const evenementDelegate = {
  async create(args: AnyRecord): Promise<AnyRecord> {
    const payload = {
      nom: args.data.nom,
      description: args.data.description ?? null,
      date_debut: toDbTimestamp(args.data.dateDebut) ?? args.data.dateDebut,
      date_fin:
        args.data.dateFin === null
          ? null
          : toDbTimestamp(args.data.dateFin) ?? args.data.dateFin,
      actif: args.data.actif ?? true,
    };

    const { data, error } = await supabaseServer
      .from('evenements')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    const counts = await getEvenementCounts([data.id]);
    const normalized = {
      ...normalizeEvenement(data),
      _count: { transactions: counts.get(data.id) ?? 0 },
    };

    return applySelect(normalized, args.select);
  },

  async findUnique(args: AnyRecord): Promise<AnyRecord | null> {
    const { data, error } = await supabaseServer
      .from('evenements')
      .select('*')
      .eq('id', args.where.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const counts = await getEvenementCounts([data.id]);
    const normalized = {
      ...normalizeEvenement(data),
      _count: { transactions: counts.get(data.id) ?? 0 },
    };

    return applySelect(normalized, args.select);
  },

  async update(args: AnyRecord): Promise<AnyRecord> {
    const payload: AnyRecord = {};

    if (args.data.nom !== undefined) payload.nom = args.data.nom;
    if (args.data.description !== undefined) payload.description = args.data.description;
    if (args.data.dateDebut !== undefined) {
      payload.date_debut = toDbTimestamp(args.data.dateDebut) ?? args.data.dateDebut;
    }
    if (args.data.dateFin !== undefined) {
      payload.date_fin =
        args.data.dateFin === null ? null : toDbTimestamp(args.data.dateFin) ?? args.data.dateFin;
    }
    if (args.data.actif !== undefined) payload.actif = args.data.actif;

    const { data, error } = await supabaseServer
      .from('evenements')
      .update(payload)
      .eq('id', args.where.id)
      .select('*')
      .single();

    if (error) throw error;

    const counts = await getEvenementCounts([data.id]);
    const normalized = {
      ...normalizeEvenement(data),
      _count: { transactions: counts.get(data.id) ?? 0 },
    };

    return applySelect(normalized, args.select);
  },

  async findMany(args: AnyRecord): Promise<AnyRecord[]> {
    let query = supabaseServer.from('evenements').select('*');
    const where = args.where ?? {};

    if (where.OR && Array.isArray(where.OR)) {
      const search = where.OR[0]?.nom?.contains ?? where.OR[1]?.description?.contains;
      if (search) {
        query = query.or(`nom.ilike.%${search}%,description.ilike.%${search}%`);
      }
    }

    if (where.actif !== undefined) query = query.eq('actif', where.actif);

    query = applyDateRangeFilter(query, 'date_debut', where.dateDebut);

    if (where.OR && Array.isArray(where.OR) && where.OR[0]?.dateFin === null) {
      query = query.or('date_fin.is.null,date_fin.gte.now()');
    }

    const order = normalizeOrderBy(args.orderBy);
    if (order) query = query.order(order.field, { ascending: order.ascending });

    if (args.skip !== undefined && args.take !== undefined) {
      query = query.range(args.skip, args.skip + args.take - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const counts = await getEvenementCounts(rows.map((r) => r.id));

    return rows.map((item) => {
      const normalized = {
        ...normalizeEvenement(item),
        _count: { transactions: counts.get(item.id) ?? 0 },
      };
      return applySelect(normalized, args.select);
    });
  },

  async count(args?: AnyRecord): Promise<number> {
    let query = supabaseServer.from('evenements').select('*', { count: 'exact', head: true });

    const where = args?.where ?? {};
    if (where.nom !== undefined) query = query.eq('nom', where.nom);
    if (where.actif !== undefined) query = query.eq('actif', where.actif);
    if (where.id?.not !== undefined) query = query.neq('id', where.id.not);

    if (where.OR && Array.isArray(where.OR)) {
      const search = parseOrContainsSearch(where.OR.join(','));
      if (search) {
        query = query.or(`nom.ilike.%${search}%,description.ilike.%${search}%`);
      }
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  },
};

const transactionBaseSelect =
  'id,type,montant,description,date_operation,mode_paiement,piece_justificative,est_supprime,cree_le,modifie_le,categorie_id,utilisateur_id,evenement_id,categorie:categories!fk_categorie(id,nom,type),utilisateur:utilisateurs!fk_utilisateur(id,nom,email),evenement:evenements!fk_evenement(id,nom)';

function applyTransactionWhere(query: any, where: AnyRecord): any {
  let q = query;

  if (where.type !== undefined) q = q.eq('type', where.type);
  if (where.categorieId !== undefined) q = q.eq('categorie_id', where.categorieId);

  if (where.evenementId !== undefined) {
    if (where.evenementId === null) q = q.is('evenement_id', null);
    else q = q.eq('evenement_id', where.evenementId);
  }

  if (where.utilisateurId !== undefined) q = q.eq('utilisateur_id', where.utilisateurId);

  q = applyDateRangeFilter(q, 'date_operation', where.dateOperation);

  if (where.montant?.gte !== undefined) q = q.gte('montant', where.montant.gte);
  if (where.montant?.lte !== undefined) q = q.lte('montant', where.montant.lte);

  if (where.description?.contains !== undefined) {
    q = q.ilike('description', `%${where.description.contains}%`);
  }

  if (where.estSupprime !== undefined) q = q.eq('est_supprime', where.estSupprime);

  return q;
}

const transactionDelegate = {
  async create(args: AnyRecord): Promise<AnyRecord> {
    const payload = {
      type: args.data.type,
      montant: args.data.montant,
      description: args.data.description ?? null,
      date_operation:
        toDbTimestamp(args.data.dateOperation) ?? args.data.dateOperation,
      mode_paiement: args.data.modePaiement ?? null,
      piece_justificative: args.data.pieceJustificative ?? null,
      est_supprime: args.data.estSupprime ?? false,
      categorie_id: args.data.categorieId ?? null,
      utilisateur_id: args.data.utilisateurId,
      evenement_id: args.data.evenementId ?? null,
    };

    const { data, error } = await supabaseServer
      .from('transactions')
      .insert(payload)
      .select(transactionBaseSelect)
      .single();

    if (error) throw error;

    return applySelect(normalizeTransaction(data), args.select);
  },

  async findMany(args: AnyRecord): Promise<AnyRecord[]> {
    let query: any = supabaseServer.from('transactions').select(transactionBaseSelect);

    query = applyTransactionWhere(query, args.where ?? {});

    const order = normalizeOrderBy(args.orderBy);
    if (order) {
      query = query.order(order.field, { ascending: order.ascending });
    }

    if (args.skip !== undefined && args.take !== undefined) {
      query = query.range(args.skip, args.skip + args.take - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((item: AnyRecord) => applySelect(normalizeTransaction(item), args.select));
  },

  async findUnique(args: AnyRecord): Promise<AnyRecord | null> {
    let query = supabaseServer.from('transactions').select(transactionBaseSelect);

    if (args.where.id !== undefined) {
      query = query.eq('id', args.where.id);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return applySelect(normalizeTransaction(data), args.select);
  },

  async update(args: AnyRecord): Promise<AnyRecord> {
    const payload: AnyRecord = {};

    if (args.data.type !== undefined) payload.type = args.data.type;
    if (args.data.montant !== undefined) payload.montant = args.data.montant;
    if (args.data.description !== undefined) payload.description = args.data.description;

    if (args.data.dateOperation !== undefined) {
      payload.date_operation =
        toDbTimestamp(args.data.dateOperation) ?? args.data.dateOperation;
    }

    if (args.data.modePaiement !== undefined) payload.mode_paiement = args.data.modePaiement;
    if (args.data.pieceJustificative !== undefined) payload.piece_justificative = args.data.pieceJustificative;
    if (args.data.estSupprime !== undefined) payload.est_supprime = args.data.estSupprime;

    if (args.data.categorieId !== undefined) payload.categorie_id = args.data.categorieId;
    if (args.data.evenementId !== undefined) payload.evenement_id = args.data.evenementId;

    if (args.data.categorie !== undefined) {
      if (args.data.categorie.disconnect) payload.categorie_id = null;
      if (args.data.categorie.connect?.id !== undefined) payload.categorie_id = args.data.categorie.connect.id;
    }

    if (args.data.evenement !== undefined) {
      if (args.data.evenement.disconnect) payload.evenement_id = null;
      if (args.data.evenement.connect?.id !== undefined) payload.evenement_id = args.data.evenement.connect.id;
    }

    const { data, error } = await supabaseServer
      .from('transactions')
      .update(payload)
      .eq('id', args.where.id)
      .select(transactionBaseSelect)
      .single();

    if (error) throw error;

    return applySelect(normalizeTransaction(data), args.select);
  },

  async updateMany(args: AnyRecord): Promise<{ count: number }> {
    const payload: AnyRecord = {};

    for (const [key, value] of Object.entries(args.data ?? {})) {
      payload[toSnakeCase(key)] = value;
    }

    let query = supabaseServer.from('transactions').update(payload);

    const where = args.where ?? {};
    if (where.id?.in) {
      query = query.in('id', where.id.in);
    }

    const { data, error } = await query.select('id');
    if (error) throw error;

    return { count: (data ?? []).length };
  },

  async count(args?: AnyRecord): Promise<number> {
    let query: any = supabaseServer.from('transactions').select('*', { count: 'exact', head: true });
    query = applyTransactionWhere(query, args?.where ?? {});

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  },

  async aggregate(args: AnyRecord): Promise<AnyRecord> {
    let query: any = supabaseServer.from('transactions').select('montant');
    query = applyTransactionWhere(query, args.where ?? {});

    const { data, error } = await query;
    if (error) throw error;

    const sum = (data ?? []).reduce((acc: number, item: AnyRecord) => acc + Number(item.montant ?? 0), 0);

    return {
      _sum: {
        montant: sum,
      },
    };
  },
};

const repartitionDimeDelegate = {
  async create(args: AnyRecord): Promise<AnyRecord> {
    const payload = {
      transaction_id: args.data.transactionId,
      total_dime: args.data.totalDime,
      part_paroisse_mere: args.data.partParoisseMere,
      part_caisse_locale: args.data.partCaisseLocale,
      part_responsable: args.data.partResponsable,
      part_levites: args.data.partLevites,
    };

    const { data, error } = await supabaseServer
      .from('repartition_dimes')
      .insert(payload)
      .select('*, transaction:transactions(id,montant,type,description,date_operation)')
      .single();

    if (error) throw error;

    return applySelect(normalizeRepartitionDime(data), args.select);
  },

  async findUnique(args: AnyRecord): Promise<AnyRecord | null> {
    let query = supabaseServer
      .from('repartition_dimes')
      .select('*, transaction:transactions(id,montant,type,description,date_operation)');

    if (args.where.id !== undefined) query = query.eq('id', args.where.id);
    if (args.where.transactionId !== undefined) query = query.eq('transaction_id', args.where.transactionId);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return applySelect(normalizeRepartitionDime(data), args.select);
  },

  async update(args: AnyRecord): Promise<AnyRecord> {
    const payload: AnyRecord = {};

    for (const [key, value] of Object.entries(args.data ?? {})) {
      payload[toSnakeCase(key)] = value;
    }

    let query = supabaseServer.from('repartition_dimes').update(payload);

    if (args.where.id !== undefined) query = query.eq('id', args.where.id);
    if (args.where.transactionId !== undefined) query = query.eq('transaction_id', args.where.transactionId);

    const { data, error } = await query
      .select('*, transaction:transactions(id,montant,type,description,date_operation)')
      .single();

    if (error) throw error;

    return applySelect(normalizeRepartitionDime(data), args.select);
  },

  async findMany(args: AnyRecord): Promise<AnyRecord[]> {
    let query: any = supabaseServer
      .from('repartition_dimes')
      .select('*, transaction:transactions(id,montant,type,description,date_operation)');

    const where = args.where ?? {};

    if (where.transactionId !== undefined) query = query.eq('transaction_id', where.transactionId);

    query = applyDateRangeFilter(query, 'cree_le', where.creeLe);

    const order = normalizeOrderBy(args.orderBy);
    if (order) query = query.order(order.field, { ascending: order.ascending });

    if (args.skip !== undefined && args.take !== undefined) {
      query = query.range(args.skip, args.skip + args.take - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((item: AnyRecord) => applySelect(normalizeRepartitionDime(item), args.select));
  },

  async count(args?: AnyRecord): Promise<number> {
    let query = supabaseServer.from('repartition_dimes').select('*', { count: 'exact', head: true });

    const where = args?.where ?? {};

    if (where.transactionId !== undefined) query = query.eq('transaction_id', where.transactionId);
    query = applyDateRangeFilter(query, 'cree_le', where.creeLe);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  },

  async delete(args: AnyRecord): Promise<AnyRecord> {
    let query = supabaseServer.from('repartition_dimes').delete();

    if (args.where.id !== undefined) query = query.eq('id', args.where.id);

    const { data, error } = await query
      .select('*, transaction:transactions(id,montant,type,description,date_operation)')
      .single();

    if (error) throw error;

    return applySelect(normalizeRepartitionDime(data), args.select);
  },
};

const journalActionDelegate = {
  async create(args: AnyRecord): Promise<AnyRecord> {
    const payload = {
      utilisateur_id: args.data.utilisateurId,
      action: args.data.action,
      description: args.data.description ?? null,
      adresse_ip: args.data.adresseIP ?? null,
    };

    const { data, error } = await supabaseServer
      .from('journal_actions')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      utilisateurId: data.utilisateur_id,
      action: data.action,
      description: data.description,
      adresseIP: data.adresse_ip,
      creeLe: toDateOrNull(data.cree_le),
    };
  },
};

const prisma: any = {
  utilisateur: utilisateurDelegate,
  categorie: categorieDelegate,
  evenement: evenementDelegate,
  transaction: transactionDelegate,
  repartitionDime: repartitionDimeDelegate,
  journalAction: journalActionDelegate,
  async $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    // Supabase JS n'expose pas de transaction multi-requetes cote client.
    // Cette couche execute le callback en mode sequence pour conserver l'API actuelle.
    return callback(prisma);
  },
};

void toCamelCase;

export default prisma;
