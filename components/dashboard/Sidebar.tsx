"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  clearSession,
  formatRemainingSession,
  getAuthToken,
  getAuthUser,
  getSecondsUntilExpiration,
} from "@/lib/client-auth";
import {
  LayoutDashboard,
  Users,
  FolderTree,
  Calendar,
  CreditCard,
  Coins,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Shield,
} from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/dashboard/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/dashboard/categories", label: "Catégories", icon: FolderTree },
  { href: "/dashboard/evenements", label: "Événements", icon: Calendar },
  { href: "/dashboard/transactions", label: "Transactions", icon: CreditCard },
  { href: "/dashboard/dimes", label: "Dîmes", icon: Coins },
  { href: "/dashboard/rapports", label: "Rapports", icon: BarChart3 },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useMemo(() => getAuthUser(), []);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const token = getAuthToken();
    return token ? getSecondsUntilExpiration(token) : 0;
  });

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const interval = window.setInterval(() => {
      const seconds = getSecondsUntilExpiration(token);
      setRemainingSeconds(seconds);

      if (seconds <= 0) {
        clearSession();
        router.replace("/login?expired=1");
      }
    }, 30000);

    return () => window.clearInterval(interval);
  }, [router]);

  function handleLogout() {
    clearSession();
    router.replace("/login?logout=1");
  }

  return (
    <aside className={`dashboard-sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="sidebar-toggle"
        aria-label={isCollapsed ? "Développer" : "Réduire"}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="sidebar-content">
        <div className="brand-wrap">
          {isCollapsed ? (
            <div className="brand-mini">CCC</div>
          ) : (
            <>
              <p className="brand-kicker">Église C.C.C.</p>
              <h1 className="brand-title">Trésorerie</h1>
            </>
          )}
        </div>

        <nav className="nav-stack" aria-label="Navigation principale">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? "is-active" : ""}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {user && !isCollapsed && (
            <div className="user-info">
              <div className="user-avatar">
                <User size={20} />
              </div>
              <div className="user-details">
                <p className="user-name">{user.nom}</p>
                <p className="user-role">
                  <Shield size={12} />
                  <span>{user.role}</span>
                </p>
              </div>
            </div>
          )}

          <div className="session-info">
            <Clock size={16} />
            {!isCollapsed && (
              <div>
                <p className="session-label">Session active</p>
                <p className="session-time">
                  {formatRemainingSession(remainingSeconds)}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`logout-btn ${isCollapsed ? "collapsed" : ""}`}
            onClick={handleLogout}
            title="Déconnexion"
          >
            <LogOut size={18} />
            {!isCollapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}