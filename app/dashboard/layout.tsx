import type { ReactNode } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import AuthGuard from "@/components/dashboard/AuthGuard";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <div className="dashboard-content">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}