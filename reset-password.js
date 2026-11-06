/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Variables Supabase manquantes. Vérifie SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans le .env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function resetPassword(email, newPassword) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('L\'email est requis.');
  }

  if (!newPassword || String(newPassword).length < 8) {
    throw new Error('Le nouveau mot de passe doit contenir au moins 8 caractères.');
  }

  const { data: user, error: userError } = await supabase
    .from('utilisateurs')
    .select('id, email, nom, role')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error(`Aucun utilisateur trouvé pour l'email: ${normalizedEmail}`);
  }

  const hash = await bcrypt.hash(newPassword, 10);

  const { data: updatedUser, error: updateError } = await supabase
    .from('utilisateurs')
    .update({ mot_de_passe: hash })
    .eq('id', user.id)
    .select('id, email, nom, role')
    .single();

  if (updateError) {
    throw updateError;
  }

  console.log('✅ Mot de passe réinitialisé avec succès pour :');
  console.log(JSON.stringify(updatedUser, null, 2));
}

(async () => {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log('Utilisation : node reset-password.js <email_existant> <nouveau_mot_de_passe>');
    console.log('Exemple : node reset-password.js admin@paroisse.fr MonNouveauMotDePasse123');
    process.exit(1);
  }

  try {
    await resetPassword(email, newPassword);
  } catch (error) {
    console.error('❌ Erreur :');
    console.error(error.message || error);
    process.exit(1);
  }
})();
