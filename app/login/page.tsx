"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthToken, isTokenExpired, setSession } from "@/lib/client-auth";

export default function LoginPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const nextPath = useMemo(() => searchParams.get("next") || "/dashboard", [searchParams]);
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
			setMessageInfo("Votre session a expire. Merci de vous reconnecter.");
		} else if (searchParams.get("logout") === "1") {
			setMessageInfo("Deconnexion reussie.");
		}
	}, [nextPath, router, searchParams]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErreur(null);
		setChargement(true);

		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email, motDePasse }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data?.erreur || "Connexion impossible");
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
		<div className="login-shell">
			<div className="login-backdrop" />
			<section className="login-card">
				<p className="hero-kicker">Plateforme de Tresorerie</p>
				<h1 className="login-title">Connexion a votre espace financier</h1>
				<p className="login-subtitle">
					Connectez-vous pour acceder aux transactions, dimes, rapports et indicateurs.
				</p>

				{messageInfo ? <p className="info-text">{messageInfo}</p> : null}

				<form onSubmit={handleSubmit} className="login-form">
					<label className="field-label" htmlFor="email">
						Adresse email
					</label>
					<input
						id="email"
						type="email"
						className="field-input"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						required
						autoComplete="email"
						placeholder="admin@eglise.com"
					/>

					<label className="field-label" htmlFor="motDePasse">
						Mot de passe
					</label>
					<input
						id="motDePasse"
						type="password"
						className="field-input"
						value={motDePasse}
						onChange={(event) => setMotDePasse(event.target.value)}
						required
						autoComplete="current-password"
						placeholder="********"
					/>

					{erreur ? <p className="error-text">{erreur}</p> : null}

					<button className="primary-btn" type="submit" disabled={chargement}>
						{chargement ? "Connexion en cours..." : "Se connecter"}
					</button>
				</form>
			</section>
		</div>
	);
}
