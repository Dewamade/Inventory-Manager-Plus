import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, ScanLine, History, Database, LogOut, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logout();
  };

  const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/scan", label: "Scan Material", icon: ScanLine },
    { href: "/riwayat", label: "Riwayat", icon: History },
  ];

  if (user?.role === "master") {
    menuItems.push({ href: "/master", label: "Master", icon: Database });
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r flex flex-col hidden md:flex">
        <div className="p-4 border-b border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground flex items-center gap-3">
          <div className="bg-white text-sidebar-primary p-1.5 rounded text-xl font-bold font-mono">
            MIG
          </div>
          <div>
            <h1 className="font-bold leading-tight">Manajemen Inventori</h1>
            <p className="text-xs opacity-80 uppercase tracking-widest">Gudang</p>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4">
            <UserCircle className="w-8 h-8 text-sidebar-accent-foreground opacity-70" />
            <div>
              <p className="text-sm font-semibold">{user?.username}</p>
              <p className="text-xs text-sidebar-accent-foreground capitalize opacity-70">{user?.role}</p>
            </div>
          </div>
          <Button 
            variant="destructive" 
            className="w-full justify-start text-sm" 
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Keluar
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-sidebar text-sidebar-foreground border-b p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <div className="bg-sidebar-primary text-sidebar-primary-foreground p-1 rounded font-bold font-mono text-sm">
                MIG
             </div>
             <span className="font-bold text-sm">GUDANG</span>
          </div>
        </header>
        
        {/* Mobile Nav */}
        <div className="md:hidden flex overflow-x-auto border-b bg-card">
          {menuItems.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap text-sm font-medium border-b-2 transition-colors ${
                  isActive 
                    ? "border-primary text-primary-foreground bg-primary/10" 
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/5"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}