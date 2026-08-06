// Pure signup-queue logic + client-safe types. Mongo access lives in
// src/lib/signups-store.ts.

export type SignupStatus = 'pending' | 'approved' | 'rejected';

export type SignupApplication = {
  id: string;
  clerkId: string;
  email: string | null;
  name: string;
  position: string;
  department: string;
  phone: string;
  status: SignupStatus;
  rejectNote: string | null;
  appliedAt: string; // ISO
  decidedAt: string | null;
  decidedBy: string | null;
};

export type ApplyState =
  | { state: 'form' }
  | { state: 'pending' }
  | { state: 'rejected'; rejectNote: string | null }
  | { state: 'deactivated' }; // registry doc exists but inactive — resolved by the caller

// approved แต่ registry doc หายไปแล้ว = เริ่มใหม่ได้ ไม่ใช่ทางตัน
export function resolveApplyState(
  latest: { status: SignupStatus; rejectNote?: string | null } | null
): ApplyState {
  if (!latest || latest.status === 'approved') return { state: 'form' };
  if (latest.status === 'pending') return { state: 'pending' };
  return { state: 'rejected', rejectNote: latest.rejectNote ?? null };
}

// Approve is idempotent: insert-first ordering means a retry after a partial
// failure (registry insert landed, mark did not) resolves to mark_only and
// completes cleanly — never a duplicate registry doc, never a dead end.
export type ApprovalPlan =
  | { action: 'insert_and_mark' }
  | { action: 'mark_only' }
  | { action: 'noop' }
  | { action: 'invalid' };

export function planApproval(
  status: SignupStatus,
  userExists: boolean
): ApprovalPlan {
  if (status === 'rejected') return { action: 'invalid' };
  if (status === 'approved' && userExists) return { action: 'noop' };
  if (userExists) return { action: 'mark_only' };
  return { action: 'insert_and_mark' };
}
