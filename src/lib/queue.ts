import { supabase } from "@/integrations/supabase/client";

export type TokenStatus = "waiting" | "serving" | "completed" | "skipped" | "cancelled";

export type Service = {
  id: string;
  name: string;
  description: string;
  avg_duration_minutes: number;
  is_active: boolean;
  created_at: string;
};

export type QueueToken = {
  id: string;
  token_number: number;
  service_id: string;
  user_id: string | null;
  customer_name: string;
  status: TokenStatus;
  queue_date: string;
  created_at: string;
  served_at: string | null;
  completed_at: string | null;
};

export const today = () => new Date().toISOString().slice(0, 10);

export async function fetchServices(activeOnly = false): Promise<Service[]> {
  let query = supabase.from("services").select("*").order("name");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Service[];
}

export async function fetchTodayTokens(): Promise<QueueToken[]> {
  const { data, error } = await supabase
    .from("tokens")
    .select("*")
    .eq("queue_date", today())
    .order("token_number");
  if (error) throw error;
  return (data ?? []) as QueueToken[];
}

export function currentServing(tokens: QueueToken[], serviceId?: string) {
  return tokens.find((t) => t.status === "serving" && (!serviceId || t.service_id === serviceId));
}

export function waitingList(tokens: QueueToken[], serviceId?: string) {
  return tokens
    .filter((t) => t.status === "waiting" && (!serviceId || t.service_id === serviceId))
    .sort((a, b) => a.token_number - b.token_number);
}

/** Number of people ahead of this token in its own service queue. */
export function peopleAhead(tokens: QueueToken[], token: QueueToken) {
  return waitingList(tokens, token.service_id).filter((t) => t.token_number < token.token_number)
    .length;
}

export function estimatedWaitMinutes(
  tokens: QueueToken[],
  token: QueueToken,
  services: Service[],
) {
  const service = services.find((s) => s.id === token.service_id);
  const perPerson = service?.avg_duration_minutes ?? 10;
  const serving = currentServing(tokens, token.service_id) ? 1 : 0;
  return (peopleAhead(tokens, token) + serving) * perPerson;
}

export function formatWait(minutes: number) {
  if (minutes <= 0) return "You're next";
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `~${h}h ${m}m` : `~${h}h`;
}

export const statusLabel: Record<TokenStatus, string> = {
  waiting: "Waiting",
  serving: "Now serving",
  completed: "Completed",
  skipped: "Skipped",
  cancelled: "Cancelled",
};
