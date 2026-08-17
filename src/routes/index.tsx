import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BellRing,
  Clock,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Smartphone,
  Ticket,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchServices, fetchTodayTokens, currentServing, waitingList } from "@/lib/queue";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quee — Skip the Wait, Get Served Smarter" },
      {
        name: "description",
        content:
          "Quee is a digital queue and appointment system for shops, clinics, salons and service centres. Book a token online and track your live waiting time.",
      },
      { property: "og:title", content: "Quee — Skip the Wait, Get Served Smarter" },
      {
        property: "og:description",
        content:
          "Digital token booking and live queue tracking for local shops, clinics, salons and service centres.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Ticket,
    title: "Instant token booking",
    text: "Pick a service and get a digital token in one tap — no paper slips, no crowding.",
  },
  {
    icon: Clock,
    title: "Live waiting time",
    text: "Estimated wait is calculated from the real queue and each service's average duration.",
  },
  {
    icon: BellRing,
    title: "Live status updates",
    text: "Your token status refreshes automatically as the counter calls the next customer.",
  },
  {
    icon: LayoutDashboard,
    title: "Staff dashboard",
    text: "Call next, complete, or skip customers and see today's pending and served list.",
  },
  {
    icon: ShieldCheck,
    title: "Secure accounts",
    text: "Separate customer and service-provider logins with protected staff-only controls.",
  },
  {
    icon: Smartphone,
    title: "Mobile friendly",
    text: "Works on any phone browser — designed for walk-in customers on the move.",
  },
];

const steps = [
  { n: "01", t: "Register", d: "Create a free customer account in seconds." },
  { n: "02", t: "Pick a service", d: "Choose the counter or service you need today." },
  { n: "03", t: "Get your token", d: "Receive your token number and estimated wait time." },
  { n: "04", t: "Arrive on time", d: "Track the live queue and walk in when you're next." },
];

function Landing() {
  const services = useQuery({ queryKey: ["services", "active"], queryFn: () => fetchServices(true) });
  const tokens = useQuery({ queryKey: ["tokens", "today"], queryFn: fetchTodayTokens, refetchInterval: 10000 });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-hero-gradient">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:items-center md:py-28">
            <div className="text-primary-foreground">
              <span className="inline-flex items-center rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-3 py-1 text-xs font-medium">
                Digital queue management
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
                Skip the Wait, Get Served Smarter.
              </h1>
              <p className="mt-4 max-w-lg text-base opacity-90">
                Quee turns the physical waiting line at shops, clinics, salons and service centres
                into a live digital queue. Book a token from your phone and arrive exactly when
                it's your turn.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary">
                  <Link to="/auth" search={{ mode: "register" }}>
                    Get started free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Link to="/auth" search={{ mode: "login" }}>
                    Login
                  </Link>
                </Button>
              </div>
            </div>

            <Card className="shadow-elevated">
              <CardContent className="p-6">
                <p className="text-sm font-semibold text-muted-foreground">Live queue right now</p>
                <div className="mt-4 space-y-3">
                  {(services.data ?? []).slice(0, 4).map((s) => {
                    const serving = currentServing(tokens.data ?? [], s.id);
                    const waiting = waitingList(tokens.data ?? [], s.id).length;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{waiting} waiting</p>
                        </div>
                        <span className="rounded-lg bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
                          {serving ? `#${serving.token_number}` : "Free"}
                        </span>
                      </div>
                    );
                  })}
                  {(services.data ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Loading live counters…</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* About */}
        <section id="about" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold">About Quee</h2>
              <p className="mt-4 text-muted-foreground">
                Local service counters still run on paper tokens and long physical lines. Quee gives
                every shop, clinic, salon and Akshaya-style service centre a simple digital queue:
                customers book a token online, watch the counter progress in real time, and only
                show up when their turn is close.
              </p>
              <p className="mt-4 text-muted-foreground">
                Staff get a clean control panel to call the next customer, complete or skip a token,
                manage services and review daily numbers — all from one screen.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: "Less crowding", v: "No waiting room queues" },
                { k: "Fair order", v: "Sequential token series" },
                { k: "Live status", v: "Auto-refreshing queue" },
                { k: "Daily reports", v: "Served vs pending" },
              ].map((i) => (
                <Card key={i.k} className="shadow-card">
                  <CardContent className="p-5">
                    <p className="font-semibold">{i.k}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{i.v}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-soft-gradient py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold">How it works</h2>
            <p className="mt-2 text-muted-foreground">Four steps from booking to being served.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s) => (
                <Card key={s.n} className="shadow-card">
                  <CardContent className="p-6">
                    <span className="text-sm font-bold text-primary">{s.n}</span>
                    <p className="mt-2 text-lg font-semibold">{s.t}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <h2 className="text-3xl font-bold">Key features</h2>
          <p className="mt-2 text-muted-foreground">Everything a small service counter needs.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="shadow-card">
                <CardContent className="p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-lg font-semibold">{f.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-hero-gradient py-16">
          <div className="mx-auto max-w-3xl px-4 text-center text-primary-foreground">
            <h2 className="text-3xl font-bold">Ready to clear your waiting room?</h2>
            <p className="mt-3 opacity-90">
              Create a customer account to book tokens, or a service-provider account to run your
              own queue.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-6">
              <Link to="/auth" search={{ mode: "register" }}>
                Register now
              </Link>
            </Button>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <h2 className="text-3xl font-bold">Contact</h2>
          <p className="mt-2 text-muted-foreground">
            Questions about bringing Quee to your counter? Reach out.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Mail, label: "Email", value: "hello@quee.app" },
              { icon: Phone, label: "Phone", value: "+91 98765 43210" },
              { icon: MapPin, label: "Office", value: "Kochi, Kerala, India" },
            ].map((c) => (
              <Card key={c.label} className="shadow-card">
                <CardContent className="flex items-center gap-4 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                    <p className="font-semibold">{c.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Quee. Skip the Wait, Get Served Smarter.</p>
          <p>Digital queue management for local service centres.</p>
        </div>
      </footer>
    </div>
  );
}
