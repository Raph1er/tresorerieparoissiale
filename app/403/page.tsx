import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-lightgray px-6">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-white p-8 text-center shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Erreur 403</p>
        <h1 className="mt-3 text-3xl font-bold text-dark">
          Accès refusé
        </h1>
        <p className="mt-3 text-bodytext">
          Votre compte est désactivé ou vous ne disposez pas des permissions nécessaires pour consulter cette page.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 font-medium text-white"
        >
          Retour à l’accueil
        </Link>
      </section>
    </main>
  );
}
