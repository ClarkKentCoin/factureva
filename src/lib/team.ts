/**
 * Team / invitation helpers — tenant-scoped.
 * Tokens are random 32-byte values; only their SHA-256 hash is stored.
 */
import { supabase } from "@/integrations/supabase/client";

export type InvitationRole = "admin" | "member";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type Invitation = {
  id: string;
  tenant_id: string;
  email: string;
  role: InvitationRole;
  invited_by: string | null;
  status: InvitationStatus;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
};

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateRawToken(length = 40): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

export async function listInvitations(tenantId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("tenant_invitations")
    .select("id, tenant_id, email, role, invited_by, status, expires_at, accepted_by, accepted_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invitation[];
}

export type CreateInviteInput = {
  tenantId: string;
  email: string;
  role: InvitationRole;
  invitedBy: string;
};

/** Returns { invitation, rawToken } — show the link to the inviter ONCE. */
export async function createInvitation(
  input: CreateInviteInput,
): Promise<{ invitation: Invitation; rawToken: string }> {
  const rawToken = generateRawToken();
  const token_hash = await sha256Hex(rawToken);
  const { data, error } = await supabase
    .from("tenant_invitations")
    .insert({
      tenant_id: input.tenantId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      invited_by: input.invitedBy,
      token_hash,
    })
    .select("id, tenant_id, email, role, invited_by, status, expires_at, accepted_by, accepted_at, created_at")
    .single();
  if (error) throw error;
  return { invitation: data as Invitation, rawToken };
}

export async function revokeInvitation(id: string) {
  const { error } = await supabase
    .from("tenant_invitations")
    .update({ status: "revoked" })
    .eq("id", id);
  if (error) throw error;
}

export type LookupResult = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  expires_at: string;
} | null;

export async function lookupInvitation(rawToken: string): Promise<LookupResult> {
  const token_hash = await sha256Hex(rawToken);
  const { data, error } = await supabase.rpc("get_invitation_by_token_hash", { _token_hash: token_hash });
  if (error) throw error;
  const row = (data as any[])?.[0] ?? null;
  return row as LookupResult;
}

export async function acceptInvitation(rawToken: string): Promise<string> {
  const token_hash = await sha256Hex(rawToken);
  const { data, error } = await supabase.rpc("accept_invitation", { _token_hash: token_hash });
  if (error) throw error;
  return data as string;
}

export type Member = {
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
  email: string | null;
  full_name: string | null;
};

export async function listMembers(tenantId: string): Promise<Member[]> {
  const { data: members, error } = await supabase
    .from("tenant_members")
    .select("user_id, role, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const ids = (members ?? []).map((m: any) => m.user_id);
  let profilesById = new Map<string, { email: string; full_name: string | null }>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", ids);
    for (const p of profiles ?? []) profilesById.set((p as any).id, { email: (p as any).email, full_name: (p as any).full_name });
  }
  return (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    role: m.role,
    created_at: m.created_at,
    email: profilesById.get(m.user_id)?.email ?? null,
    full_name: profilesById.get(m.user_id)?.full_name ?? null,
  }));
}

export async function removeMember(tenantId: string, userId: string) {
  const { error } = await supabase
    .from("tenant_members")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateMemberRole(tenantId: string, userId: string, role: "admin" | "member") {
  const { error } = await supabase
    .from("tenant_members")
    .update({ role })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw error;
}
