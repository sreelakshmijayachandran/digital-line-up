import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const searchSchema = z.object({
  mode: z.enum(["login", "register"]).catch("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Login or Register — Quee Queue Management" },
      {
        name: "description",
        content:
          "Sign in to Quee to book a queue token, track your waiting time, or manage your service counter as staff.",
      },
      { property: "og:title", content: "Login or Register — Quee" },
      {
        property: "og:description",
        content: "Access your Quee account to book tokens or run your service queue.",
      },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  fullName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"customer" | "admin">("customer");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password, fullName, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid details");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.fullName ?? "", phone: parsed.data.phone ?? "", role },
          },
        });
        if (error) throw error;
        toast.success("Account created! You can sign in now.");
        void navigate({ to: "/auth", search: { mode: "login" } });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Welcome back to Quee");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-soft-gradient">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-12">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-2xl">
              {mode === "register" ? "Create your Quee account" : "Sign in to Quee"}
            </CardTitle>
            <CardDescription>Skip the wait, get served smarter.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} className="mb-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" asChild>
                  <Link to="/auth" search={{ mode: "login" }}>
                    Login
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="register" asChild>
                  <Link to="/auth" search={{ mode: "register" }}>
                    Register
                  </Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Anjali Ramesh"
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>I am a</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={role === "customer" ? "default" : "outline"}
                        onClick={() => setRole("customer")}
                      >
                        Customer
                      </Button>
                      <Button
                        type="button"
                        variant={role === "admin" ? "default" : "outline"}
                        onClick={() => setRole("admin")}
                      >
                        Service provider
                      </Button>
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  maxLength={255}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  maxLength={72}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
