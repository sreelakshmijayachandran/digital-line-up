import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function QueeLogo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-hero-gradient text-lg font-bold text-primary-foreground">
        Q
      </span>
      <span className="text-xl font-bold tracking-tight text-foreground">Quee</span>
    </Link>
  );
}

export function Navbar() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const links = user
    ? [
        { to: "/dashboard" as const, label: "My Queue" },
        ...(isAdmin ? [{ to: "/admin" as const, label: "Admin" }] : []),
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <QueeLogo />

        <div className="hidden items-center gap-1 md:flex">
          {!user && (
            <>
              <a
                href="/#about"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                About
              </a>
              <a
                href="/#how"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                How it works
              </a>
              <a
                href="/#features"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Features
              </a>
              <a
                href="/#contact"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Contact
              </a>
            </>
          )}
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-primary" }}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <Button variant="outline" size="sm" className="ml-2" onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <div className="ml-2 flex gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth" search={{ mode: "login" }}>
                  Login
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth" search={{ mode: "register" }}>
                  Register
                </Link>
              </Button>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </nav>

      {open && (
        <div className="border-t border-border bg-card px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {!user && (
              <>
                <a href="/#about" className="py-2 text-sm" onClick={() => setOpen(false)}>
                  About
                </a>
                <a href="/#how" className="py-2 text-sm" onClick={() => setOpen(false)}>
                  How it works
                </a>
                <a href="/#features" className="py-2 text-sm" onClick={() => setOpen(false)}>
                  Features
                </a>
                <a href="/#contact" className="py-2 text-sm" onClick={() => setOpen(false)}>
                  Contact
                </a>
              </>
            )}
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="py-2 text-sm" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            {user ? (
              <Button variant="outline" size="sm" className="mt-2" onClick={signOut}>
                Sign out
              </Button>
            ) : (
              <div className="mt-2 flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to="/auth" search={{ mode: "login" }}>
                    Login
                  </Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link to="/auth" search={{ mode: "register" }}>
                    Register
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
