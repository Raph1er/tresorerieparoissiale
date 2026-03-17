"use client";
/**
 * HeaderLayout.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * En-tête du dashboard (barre de navigation supérieure).
 *
 * Adapté du Header.tsx du template MatDash.
 * Changements par rapport au template :
 *   - react-router Link → next/link
 *   - useNavigate → useRouter de next/navigation
 *   - Supprimé : Topbar (publicité), bouton "Check Pro", Notification
 *   - Ajouté : nom/email de l'utilisateur depuis le JWT (getAuthUser)
 *   - Ajouté : minuteur de session (temps restant avant expiration)
 *   - Ajouté : bouton de déconnexion avec clearSession()
 *
 * Structure :
 *   [Gauche]  Bouton hamburger (mobile uniquement)
 *   [Droite]  Temps de session restant  |  Menu dropdown profil
 *                                               ├─ Nom / email / rôle
 *                                               └─ Bouton déconnexion
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";     // ← Next.js (pas useNavigate de react-router)
import { Navbar, Drawer, Button, Dropdown } from "flowbite-react";
import { Icon } from "@iconify/react";
import {
  clearSession,
  formatRemainingSession,
  getAuthToken,
  getAuthUser,
  getSecondsUntilExpiration,
  setAuthUser,
  type AuthUser,
} from "@/lib/client-auth";
import { fetchWithAuth } from "@/lib/api-client";
import MobileSidebarContent from "./MobileSidebarContent";

interface UserProfileApi {
  id: number;
  nom: string;
  email: string;
  role: string;
}

const HeaderLayout = () => {
  const router = useRouter();

  // ── Source utilisateur pour le header ───────────────────────────────────────
  // On part du localStorage, puis on rafraîchit depuis la BD pour éviter
  // d'afficher un profil obsolète après une mise à jour de compte.
  const [user, setUser] = useState<AuthUser | null>(() => getAuthUser());

  useEffect(() => {
    const localUser = getAuthUser();
    if (!localUser) {
      setUser(null);
      return;
    }

    setUser(localUser);

    fetchWithAuth<UserProfileApi>(`/api/utilisateurs/${localUser.id}`)
      .then((freshUser) => {
        const normalized: AuthUser = {
          id: freshUser.id,
          nom: freshUser.nom,
          email: freshUser.email,
          role: freshUser.role,
        };

        setUser(normalized);
        setAuthUser(normalized);
      })
      .catch(() => {
        // En cas d'erreur temporaire, on conserve le profil local.
      });
  }, []);

  // ── Header sticky au scroll ─────────────────────────────────────────────────
  // isSticky : true si l'utilisateur a scrollé plus de 50px
  const [isSticky, setIsSticky] = useState(false);
  useEffect(() => {
    const onScroll = () => setIsSticky(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll); // cleanup
  }, []);

  // ── Tiroir mobile ───────────────────────────────────────────────────────────
  // mobileOpen : contrôle l'ouverture/fermeture du drawer latéral sur mobile
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── Minuteur de session ─────────────────────────────────────────────────────
  // Affiche le temps restant avant expiration du JWT
  // Initialisation immédiate pour éviter un flash "0m"
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const token = getAuthToken();
    return token ? getSecondsUntilExpiration(token) : 0;
  });

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    // Mise à jour toutes les 10 secondes (pas besoin d'une précision au seconde)
    const interval = setInterval(() => {
      const seconds = getSecondsUntilExpiration(token);
      setRemainingSeconds(seconds);

      // Si le token est expiré → déconnexion automatique
      if (seconds <= 0) {
        clearSession();
        router.replace("/login?expired=1");
      }
    }, 10_000);

    return () => clearInterval(interval); // cleanup au démontage
  }, [router]);

  // ── Déconnexion ─────────────────────────────────────────────────────────────
  function handleLogout() {
    clearSession();                        // supprime le token et les infos du localStorage
    router.replace("/login?logout=1");     // redirige vers la page de login
  }

  // ── Initiales pour l'avatar ─────────────────────────────────────────────────
  // Ex: "Dupont Jean" → "DJ"
  const initiales = user?.nom
    ?.split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") ?? "U";

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════
          HEADER PRINCIPAL
          sticky top-0 → reste collé en haut au scroll
          z-[5] → au-dessus du contenu mais sous les modales
          ════════════════════════════════════════════════════════════════════ */}
      <header
        className={`sticky top-0 z-[5] transition-shadow ${
          isSticky
            ? "bg-white dark:bg-dark shadow-md"  // ombre quand on a scrollé
            : "bg-white dark:bg-darkgray"
        }`}
      >
        <Navbar
          fluid
          className="rounded-none bg-transparent dark:bg-transparent py-4 sm:px-8 px-4"
        >
          <div className="flex gap-3 items-center justify-between w-full">

            {/* ── Gauche : bouton hamburger (mobile uniquement) ─────────── */}
            {/* xl:hidden → visible uniquement sous 1280px */}
            <div className="flex gap-2 items-center">
              <span
                onClick={() => setMobileOpen(true)}
                className="h-10 w-10 flex text-black dark:text-white xl:hidden hover:text-primary hover:bg-lightprimary rounded-full justify-center items-center cursor-pointer"
                aria-label="Ouvrir le menu"
              >
                <Icon icon="solar:hamburger-menu-line-duotone" height={21} />
              </span>
            </div>

            {/* ── Droite : session + profil ─────────────────────────────── */}
            <div className="flex gap-3 items-center">

              {/* Temps de session restant (caché sur mobile très petit) */}
              <span className="hidden sm:flex items-center gap-1 text-xs text-bodytext">
                <Icon icon="solar:clock-circle-line-duotone" height={15} />
                {/* formatRemainingSession convertit 3600 sec → "1h 0m" */}
                Session : {formatRemainingSession(remainingSeconds)}
              </span>

              {/* Menu déroulant profil ─────────────────────────────────── */}
              <Dropdown
                label=""
                className="rounded-sm w-52"
                dismissOnClick={false}
                // renderTrigger : remplace le bouton Dropdown par défaut par notre avatar
                renderTrigger={() => (
                  <div className="flex items-center gap-2 cursor-pointer hover:bg-lightprimary rounded-lg px-2 py-1 transition-colors">
                    {/* Avatar : cercle coloré avec les initiales */}
                    <span className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {initiales}
                    </span>
                    {/* Nom de l'utilisateur (caché sur petit écran) */}
                    <span className="hidden sm:block text-sm font-medium text-dark dark:text-white">
                      {user?.nom ?? "Utilisateur"}
                    </span>
                  </div>
                )}
              >
                {/* ── Infos de l'utilisateur ────────────────────────── */}
                <div className="px-4 py-3 border-b border-border dark:border-darkborder">
                  <p className="text-sm font-semibold text-dark dark:text-white">
                    {user?.nom ?? "Utilisateur"}
                  </p>
                  <p className="text-xs text-bodytext truncate">{user?.email ?? "-"}</p>
                  {/* Rôle affiché en cyan */}
                  <p className="text-xs text-secondary mt-0.5 capitalize font-medium">
                    {user?.role ?? "-"}
                  </p>
                </div>

                {/* ── Bouton déconnexion ────────────────────────────── */}
                <div className="p-3">
                  <Button
                    size="sm"
                    onClick={handleLogout}
                    className="w-full border border-primary text-primary bg-transparent hover:bg-lightprimary focus:ring-0"
                  >
                    <Icon icon="solar:logout-2-line-duotone" height={16} className="mr-1.5" />
                    Se déconnecter
                  </Button>
                </div>
              </Dropdown>

            </div>
          </div>
        </Navbar>
      </header>

      {/* ════════════════════════════════════════════════════════════════════
          TIROIR MOBILE
          Drawer (flowbite) : panneau latéral qui glisse depuis la gauche.
          Il contient la même navigation que la sidebar desktop.
          Visible uniquement quand mobileOpen === true.
          ════════════════════════════════════════════════════════════════════ */}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        className="w-[280px] p-0"
      >
        <Drawer.Items>
          <MobileSidebarContent />
        </Drawer.Items>
      </Drawer>
    </>
  );
};

export default HeaderLayout;
