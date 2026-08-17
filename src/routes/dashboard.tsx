import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Ticket, Users, CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  currentServing,
  estimatedWaitMinutes,
  fetchServices,
  fetchTodayTokens,
  formatWait,
  peopleAhead,
  statusLabel,
  waitingList,
  type QueueToken,
} from "@/lib/queue";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Queue — Quee Token Booking" },
      {
        name: "description",
        content:
          "Book a queue token, see the token being served right now and track your estimated waiting time live.",
      },
      { property: "og:title", content: "My Queue — Quee" },
      {
        property: "og:description",
        content: "Live token status and estimated waiting time for your booking.",
      },
    ],
  }),
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serviceId, setServiceId] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }, [loading, user, navigate]);

  const servicesQuery = useQuery({ queryKey: ["services", "active"], queryFn: () => fetchServices(true) });
  const tokensQuery = useQuery({
    queryKey: ["tokens", "today"],
    queryFn: fetchTodayTokens,
    refetchInterval: 5000,
  });

  const services = servicesQuery.data ?? [];
  const tokens = tokensQuery.data ?? [];
  const myTokens = tokens.filter((t) => t.user_id === user?.id);
  const activeToken = myTokens.find((t) => t.status === "waiting" || t.status === "serving");

  const book = useMutation({
    mutationFn: async () => {
      if (!serviceId) throw new Error("Select a service first");
      const { data, error } = await supabase.rpc("book_token", {
        _service_id: serviceId,
        _customer_name: (user?.user_metadata?.["full_name"] as string) || user?.email || "Guest",
      });
      if (error) throw error;
      return data as unknown as QueueToken;
    },
    onSuccess: (token) => {
      toast.success(`Token #${token.token_number} booked`);
      void queryClient.invalidateQueries({ queryKey: ["tokens", "today"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not book token"),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tokens").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking cancelled");
      void queryClient.invalidateQueries({ queryKey: ["tokens", "today"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not cancel"),
  });

  const serviceOf = (id: string) => services.find((s) => s.id === id);
  const serving = activeToken ? currentServing(tokens, activeToken.service_id) : undefined;
  const wait = activeToken ? estimatedWaitMinutes(tokens, activeToken, services) : 0;

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-soft-gradient">
        <Navbar />
        <p className="p-8 text-center text-muted-foreground">Loading your queue…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-soft-gradient pb-16">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold">My Queue</h1>
        <p className="mt-1 text-muted-foreground">
          Book a token and follow your position without standing in line.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Ticket}
            label="Your token"
            value={activeToken ? `#${activeToken.token_number}` : "—"}
            hint={activeToken ? serviceOf(activeToken.service_id)?.name : "No active booking"}
          />
          <StatCard
            icon={Users}
            label="Now serving"
            value={serving ? `#${serving.token_number}` : "—"}
            hint={activeToken ? serviceOf(activeToken.service_id)?.name : "Select a service"}
          />
          <StatCard
            icon={Clock}
            label="Estimated wait"
            value={activeToken ? formatWait(wait) : "—"}
            hint={activeToken ? `${peopleAhead(tokens, activeToken)} ahead of you` : "—"}
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed today"
            value={String(myTokens.filter((t) => t.status === "completed").length)}
            hint="Your finished visits"
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Book a token</CardTitle>
              <CardDescription>Pick a service and join the digital queue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · ~{s.avg_duration_minutes} min each
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {serviceId && (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                  {waitingList(tokens, serviceId).length} people waiting ·{" "}
                  {currentServing(tokens, serviceId)
                    ? `serving #${currentServing(tokens, serviceId)?.token_number}`
                    : "counter free"}
                </div>
              )}

              <Button
                className="w-full"
                disabled={!serviceId || book.isPending || Boolean(activeToken)}
                onClick={() => book.mutate()}
              >
                {activeToken ? "You already have an active token" : "Book my token"}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Today's bookings</CardTitle>
              <CardDescription>Status updates refresh automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {myTokens.length === 0 && (
                <p className="text-sm text-muted-foreground">No bookings yet today.</p>
              )}
              {myTokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <div>
                    <p className="font-semibold">
                      Token #{t.token_number}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {serviceOf(t.service_id)?.name ?? "Service"}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.status === "waiting"
                        ? `${peopleAhead(tokens, t)} ahead · ${formatWait(estimatedWaitMinutes(tokens, t, services))}`
                        : statusLabel[t.status]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        t.status === "serving"
                          ? "default"
                          : t.status === "waiting"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {statusLabel[t.status]}
                    </Badge>
                    {t.status === "waiting" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancel.mutate(t.id)}
                        disabled={cancel.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
