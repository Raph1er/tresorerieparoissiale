"use client";
/**
 * components/auth/LoginPageClient.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Version cliente de la page de connexion.
 *
 * Pourquoi ce découpage ?
 * Next.js 16 demande que `useSearchParams()` soit utilisé à l'intérieur d'un
 * composant client rendu derrière une frontière `Suspense`.
 *
 * Le fichier `app/login/page.tsx` devient donc un wrapper serveur minimal,
 * tandis que toute la logique interactive (formulaire, localStorage, redirection)
 * reste ici.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Label, TextInput } from "flowbite-react";
import { getAuthToken, isTokenExpired, setSession } from "@/lib/client-auth";
import Logo from "@/components/layout/Logo";

// Fond dégradé animé repris du template MatDash.
const gradientStyle: CSSProperties = {
  background:
    "linear-gradient(45deg, rgba(238,119,82,0.2), rgba(231,60,126,0.2), rgba(35,166,213,0.2), rgba(35,213,171,0.2))",
  backgroundSize: "400% 400%",
  animation: "gradient 15s ease infinite",
  height: "100vh",
};

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Si ?next=/dashboard/transactions est présent, on le respecte après connexion.
  const nextPath = useMemo(
    () => searchParams.get("next") ?? "/dashboard",
    [searchParams],
  );

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [messageInfo, setMessageInfo] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (token && !isTokenExpired(token)) {
      router.replace(nextPath);
      return;
    }

    if (searchParams.get("expired") === "1") {
      setMessageInfo("Votre session a expiré. Merci de vous reconnecter.");
    } else if (searchParams.get("logout") === "1") {
      setMessageInfo("Déconnexion réussie.");
    }
  }, [nextPath, router, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur(null);
    setChargement(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, motDePasse }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.erreur ?? "Connexion impossible");
      }

      setSession(data.token, data.utilisateur);
      router.push(nextPath);
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div style={gradientStyle} className="relative overflow-hidden h-screen">
      <div className="flex h-full justify-center items-center px-4">
        <div className="rounded-xl shadow-md bg-white dark:bg-darkgray p-6 w-full md:w-[400px] border-none">
          <div className="flex flex-col gap-2 w-full">
            <div className="mx-auto mb-2">
              <Logo />
            </div>

            <p className="text-sm text-center text-bodytext">
              Connectez-vous à votre espace financier
            </p>

            {messageInfo && (
              <div className="bg-lightinfo rounded-md px-3 py-2 text-xs text-info text-center">
                {messageInfo}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-2">
              <div className="mb-4">
                <div className="mb-2 block">
                  <Label htmlFor="email" value="Adresse email" />
                </div>
                <TextInput
                  id="email"
                  type="email"
                  placeholder="admin@eglise.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="form-control form-rounded-xl"
                />
              </div>

              <div className="mb-4">
                <div className="mb-2 block">
                  <Label htmlFor="motDePasse" value="Mot de passe" />
                </div>
                <TextInput
                  id="motDePasse"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(event) => setMotDePasse(event.target.value)}
                  className="form-control form-rounded-xl"
                />
              </div>

              {erreur && (
                <div className="mb-3 bg-lighterror rounded-md px-3 py-2 text-xs text-error">
                  {erreur}
                </div>
              )}

              <Button
                type="submit"
                color="primary"
                disabled={chargement}
                className="w-full bg-primary text-white rounded-xl mt-2"
              >
                {chargement ? "Connexion en cours…" : "Se connecter"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
