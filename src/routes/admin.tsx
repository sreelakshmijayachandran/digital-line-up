import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, CheckCircle2, Clock, PlayCircle, Ticket, Trash2, Users } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
  fetchServices,
  fetchTodayTokens,
  formatWait,
  statusLabel,
  waitingList,
  type QueueToken,
  type Service,
} from "@/lib/queue";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Staff Dashboard — Quee Queue Control" },
      {
        name: "description",
        content:
          "Manage today's queue: call the next customer, mark visits completed, skip no-shows and edit your services.",
      },
      { property: "og:title", content: "Staff Dashboard — Quee" },
      {
        property: "og:description",
        content: "Run your counter queue with live token control and daily reports.",
      },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serviceId, setServiceId] = useState<string>("");
  const [newService, setNewService] = useState({ name: "", description: "", duration: "10" });

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }, [loading, user, navigate]);

  const servicesQuery = useQuery({ queryKey: ["services", "all"], queryFn: () => fetchServices() });
  const tokensQuery = useQuery({
    queryKey: ["tokens", "today"],
    queryFn: fetchTodayTokens,
    refetchInterval: 5000,
  });

  const services = servicesQuery.data ?? [];
  const tokens = tokensQuery.data ?? [];

  useEffect(() => {
    if (!serviceId && services.length > 0) setServiceId(services[0]!.id);
  }, [services, serviceId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["tokens", "today"] });
    void queryClient.invalidateQueries({ queryKey: ["services"] });
  };

  const updateToken = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<QueueToken> }) => {
      const { error } = await supabase.from("tokens").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  const saveService = useMutation({
    mutationFn: async () => {
      const name = newService.name.trim();
      if (!name) throw new Error("Service name is required");
      const { error } = await supabase.from("services").insert({
        name: name.slice(0, 80),
        description: newService.description.trim().slice(0, 200),
        avg_duration_minutes: Math.max(1, Math.min(240, Number(newService.duration) || 10)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Service added");
      setNewService({ name: "", description: "", duration: "10" });
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add service"),
  });

  const editService = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Service> }) => {
      const { error } = await supabase.from("services").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update service"),
  });

  const removeService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Service removed");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove service"),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-soft-gradient">
        <Navbar />
        <p className="p-8 text-center text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-soft-gradient">
        <Navbar />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Staff access only</h1>
          <p className="mt-2 text-muted-foreground">
            This dashboard is for service providers. Register a service provider account to manage a
            queue.
          </p>
        </div>
      </div>
    );
  }

  const scoped = tokens.filter((t) => !serviceId || t.service_id === serviceId);
  const serving = currentServing(tokens, serviceId);
  const waiting = waitingList(tokens, serviceId);
  const next = waiting[0];
  const completed = scoped.filter((t) => t.status === "completed");
  const avg = services.find((s) => s.id === serviceId)?.avg_duration_minutes ?? 10;

  const callNext = () => {
    if (!next) {
      toast.info("No customers waiting");
      return;
    }
    if (serving) {
      updateToken.mutate({
        id: serving.id,
        patch: { status: "completed", completed_at: new Date().toISOString() },
      });
    }
    updateToken.mutate({
      id: next.id,
      patch: { status: "serving", served_at: new Date().toISOString() },
    });
    toast.success(`Now serving token #${next.token_number}`);
  };

  return (
    <div className="min-h-screen bg-soft-gradient pb-16">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Staff Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Today's queue at a glance.</p>
          </div>
          <div className="w-full sm:w-64">
            <Label className="mb-2 block text-xs">Counter / service</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={PlayCircle}
            label="Current token"
            value={serving ? `#${serving.token_number}` : "—"}
            hint={serving?.customer_name ?? "Counter free"}
          />
          <StatCard
            icon={Ticket}
            label="Next token"
            value={next ? `#${next.token_number}` : "—"}
            hint={next?.customer_name ?? "Queue empty"}
          />
          <StatCard icon={Users} label="Waiting" value={String(waiting.length)} hint="In queue now" />
          <StatCard
            icon={CheckCircle2}
            label="Completed"
            value={String(completed.length)}
            hint="Served today"
          />
          <StatCard
            icon={Clock}
            label="Est. wait"
            value={formatWait(waiting.length * avg)}
            hint={`~${avg} min per customer`}
          />
        </div>

        <Tabs defaultValue="queue" className="mt-8">
          <TabsList>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4 space-y-6">
            <Card className="shadow-card">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Live queue</CardTitle>
                  <CardDescription>Call, complete or skip customers.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={callNext} disabled={updateToken.isPending}>
                    Call next
                  </Button>
                  {serving && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        updateToken.mutate({
                          id: serving.id,
                          patch: { status: "completed", completed_at: new Date().toISOString() },
                        })
                      }
                    >
                      Mark completed
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {scoped.filter((t) => t.status === "waiting" || t.status === "serving").length ===
                  0 && <p className="text-sm text-muted-foreground">No pending customers.</p>}
                {scoped
                  .filter((t) => t.status === "serving" || t.status === "waiting")
                  .sort((a, b) => (a.status === "serving" ? -1 : b.status === "serving" ? 1 : a.token_number - b.token_number))
                  .map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-sm font-bold text-accent-foreground">
                          #{t.token_number}
                        </span>
                        <div>
                          <p className="font-semibold">{t.customer_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Booked {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={t.status === "serving" ? "default" : "secondary"}>
                          {statusLabel[t.status]}
                        </Badge>
                        {t.status === "waiting" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateToken.mutate({
                                id: t.id,
                                patch: { status: "serving", served_at: new Date().toISOString() },
                              })
                            }
                          >
                            Serve
                          </Button>
                        )}
                        {t.status === "serving" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateToken.mutate({
                                id: t.id,
                                patch: {
                                  status: "completed",
                                  completed_at: new Date().toISOString(),
                                },
                              })
                            }
                          >
                            Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateToken.mutate({ id: t.id, patch: { status: "skipped" } })}
                        >
                          Skip
                        </Button>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Completed & closed today</CardTitle>
                <CardDescription>Completed, skipped and cancelled tokens.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {scoped
                  .filter((t) => ["completed", "skipped", "cancelled"].includes(t.status))
                  .map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
                    >
                      <span className="font-medium">
                        #{t.token_number} · {t.customer_name}
                      </span>
                      <Badge variant="outline">{statusLabel[t.status]}</Badge>
                    </div>
                  ))}
                {scoped.filter((t) => ["completed", "skipped", "cancelled"].includes(t.status))
                  .length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing closed yet today.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="mt-4 space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Add a service</CardTitle>
                <CardDescription>Each service gets its own token series.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="sname">Name</Label>
                  <Input
                    id="sname"
                    value={newService.name}
                    maxLength={80}
                    onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                    placeholder="Passport Verification"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sdesc">Description</Label>
                  <Input
                    id="sdesc"
                    value={newService.description}
                    maxLength={200}
                    onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                    placeholder="Document check and verification"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sdur">Minutes</Label>
                  <Input
                    id="sdur"
                    type="number"
                    min={1}
                    max={240}
                    value={newService.duration}
                    onChange={(e) => setNewService({ ...newService, duration: e.target.value })}
                  />
                </div>
                <Button onClick={() => saveService.mutate()} disabled={saveService.isPending}>
                  Add
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Your services</CardTitle>
                <CardDescription>Toggle availability or update duration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{s.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{s.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={240}
                        defaultValue={s.avg_duration_minutes}
                        className="w-24"
                        onBlur={(e) =>
                          editService.mutate({
                            id: s.id,
                            patch: {
                              avg_duration_minutes: Math.max(
                                1,
                                Math.min(240, Number(e.target.value) || 10),
                              ),
                            },
                          })
                        }
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={s.is_active}
                          onCheckedChange={(v) =>
                            editService.mutate({ id: s.id, patch: { is_active: v } })
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {s.is_active ? "Active" : "Paused"}
                        </span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${s.name}`}
                        onClick={() => removeService.mutate(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" /> Today's report
                </CardTitle>
                <CardDescription>Per-service summary for {new Date().toLocaleDateString()}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((s) => {
                  const all = tokens.filter((t) => t.service_id === s.id);
                  const done = all.filter((t) => t.status === "completed").length;
                  const wait = all.filter((t) => t.status === "waiting").length;
                  const skipped = all.filter((t) => t.status === "skipped").length;
                  const cancelled = all.filter((t) => t.status === "cancelled").length;
                  return (
                    <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                      <p className="font-semibold">{s.name}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground sm:grid-cols-5">
                        <span>Issued: {all.length}</span>
                        <span>Completed: {done}</span>
                        <span>Waiting: {wait}</span>
                        <span>Skipped: {skipped}</span>
                        <span>Cancelled: {cancelled}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
