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

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Label, TextInput } from "flowbite-react";
import Image from "next/image";
import { getAuthToken, isTokenExpired, setSession } from "@/lib/client-auth";
import Logo from "@/components/layout/Logo";

const messageBlocks = [
  "Gérez la trésorerie de votre paroisse en toute simplicité.",
  "Suivez le solde de la paroisse, les dernières opérations et les priorités de gestion depuis un seul écran.",
  "Contrôle des entrées, sorties et justificatifs avec pagination.",
];

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
  const [animatedBlocks, setAnimatedBlocks] = useState<string[]>([]);
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [typedText, setTypedText] = useState("");

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

  useEffect(() => {
    if (activeBlockIndex >= messageBlocks.length) {
      return;
    }

    const currentMessage = messageBlocks[activeBlockIndex];
    if (typedText.length < currentMessage.length) {
      const timeoutId = window.setTimeout(() => {
        setTypedText(currentMessage.slice(0, typedText.length + 1));
      }, 26);

      return () => window.clearTimeout(timeoutId);
    }

    const pauseId = window.setTimeout(() => {
      setAnimatedBlocks((current) => [...current, currentMessage]);
      setTypedText("");
      setActiveBlockIndex((current) => current + 1);
    }, 550);

    return () => window.clearTimeout(pauseId);
  }, [activeBlockIndex, typedText]);

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
    <div className="relative min-h-screen overflow-hidden">
      <Image
        src="/Christ2.jpg"
        alt="Illustration de fond"
        fill
        priority
        className="object-cover"
      />

      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-[460px] rounded-2xl border border-white/20 bg-white/92 p-6 shadow-2xl backdrop-blur-sm md:p-8">
          <div className="flex flex-col gap-3 w-full">
            <div className="mx-auto mb-1">
              <Logo />
            </div>

            <div className="rounded-xl bg-slate-900 px-4 py-3 text-sm leading-relaxed text-slate-100 min-h-[148px]">
              {animatedBlocks.map((block, index) => (
                <p key={`block-${index}`} className="mb-2">
                  {block}
                </p>
              ))}
              {activeBlockIndex < messageBlocks.length ? (
                <p>
                  {typedText}
                  <span className="inline-block w-[7px] animate-pulse">|</span>
                </p>
              ) : null}
            </div>

            <p className="text-sm text-center text-bodytext font-medium">
              Connectez-vous à votre espace financier
            </p>

            {messageInfo && (
              <div className="bg-lightinfo rounded-md px-3 py-2 text-xs text-info text-center">
                {messageInfo}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-1">
              <div className="mb-4">
                <div className="mb-2 block">
                  <Label htmlFor="email" value="Adresse email" className="text-sky-400" />
                </div>
                <TextInput
                  id="email"
                  type="email"
                  placeholder="admin@eglise.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="form-control form-rounded-xl [&_input]:bg-slate-900/85 [&_input]:text-slate-50 [&_input]:placeholder:text-slate-300 [&_input]:caret-slate-50"
                />
              </div>

              <div className="mb-4">
                <div className="mb-2 block">
                  <Label htmlFor="motDePasse" value="Mot de passe" className="text-sky-400" />
                </div>
                <TextInput
                  id="motDePasse"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(event) => setMotDePasse(event.target.value)}
                  className="form-control form-rounded-xl [&_input]:bg-slate-900/85 [&_input]:text-slate-50 [&_input]:placeholder:text-slate-300 [&_input]:caret-slate-50"
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
                {chargement ? "Connexion en cours..." : "Se connecter"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
