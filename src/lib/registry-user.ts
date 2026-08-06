// Pure helpers for the shared user registry (db_namphrae.users) — the
// collection smart-namphrae owns and namphrae-map reads. Kept pure so the
// document shape and gate rules stay unit-testable; Mongo access lives in the
// callers (auth-server.ts, signups-store.ts, api/admin/users).

export type RegistryUserDoc = {
  name: string;
  position: string;
  department: string;
  role: string;
  phone: string;
  profileImage: string;
  assignedTask: string;
  clerkId: string;
  isActive: boolean;
  isArchived: boolean;
  exitDate: Date | null;
  exitNote: string;
  createdAt: Date;
  updatedAt: Date;
};

// ตัวกรองสมาชิกของ auth gate — ใช้ $ne ไม่ใช่ equality เพราะ document รุ่นเก่า
// อาจไม่มีฟิลด์เหล่านี้ (ไม่มีฟิลด์ = active ตาม default ของ smart-namphrae)
export function activeRegistryFilter(clerkId: string) {
  return {
    clerkId,
    isActive: { $ne: false },
    isArchived: { $ne: true },
  } as const;
}

export function buildRegistryUserDoc(
  app: {
    clerkId: string;
    name: string;
    position: string;
    department: string;
    phone: string;
  },
  role: string,
  now: Date
): RegistryUserDoc {
  return {
    name: app.name,
    position: app.position,
    department: app.department,
    role,
    phone: app.phone,
    profileImage: '',
    assignedTask: '',
    clerkId: app.clerkId,
    isActive: true,
    isArchived: false,
    exitDate: null,
    exitNote: '',
    createdAt: now,
    updatedAt: now,
  };
}

export type MemberPatchInput = {
  name?: string;
  position?: string;
  department?: string;
  role?: string;
  phone?: string;
  isActive?: boolean;
};

// $set document for PATCH /api/admin/users/[id]. Deactivation stamps exitDate,
// reactivation clears it; updatedAt always moves. isArchived is deliberately
// untouchable from the portal — that lifecycle belongs to smart-namphrae.
export function buildMemberPatch(
  patch: MemberPatchInput,
  now: Date
): Record<string, unknown> {
  const set: Record<string, unknown> = { updatedAt: now };
  for (const key of ['name', 'position', 'department', 'role', 'phone'] as const) {
    if (patch[key] !== undefined) set[key] = patch[key];
  }
  if (patch.isActive !== undefined) {
    set.isActive = patch.isActive;
    set.exitDate = patch.isActive ? null : now;
  }
  return set;
}

// Registry doc -> client shape for the members tab.
export type RegistryMember = {
  id: string;
  clerkId: string | null;
  name: string;
  position: string;
  department: string;
  role: string;
  phone: string;
  isActive: boolean;
  isArchived: boolean;
};

export function serializeMember(doc: {
  _id: { toString(): string };
  clerkId?: unknown;
  name?: unknown;
  position?: unknown;
  department?: unknown;
  role?: unknown;
  phone?: unknown;
  isActive?: unknown;
  isArchived?: unknown;
}): RegistryMember {
  return {
    id: doc._id.toString(),
    clerkId: typeof doc.clerkId === 'string' ? doc.clerkId : null,
    name: typeof doc.name === 'string' ? doc.name : '',
    position: typeof doc.position === 'string' ? doc.position : '',
    department: typeof doc.department === 'string' ? doc.department : '',
    role: typeof doc.role === 'string' ? doc.role : '',
    phone: typeof doc.phone === 'string' ? doc.phone : '',
    isActive: doc.isActive !== false,
    isArchived: doc.isArchived === true,
  };
}
