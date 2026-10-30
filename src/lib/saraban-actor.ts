// src/lib/saraban-actor.ts
// ผู้ทำของ event — SERVER ONLY (อ่านทะเบียนสมาชิก) · ตัดสินชื่อด้วย pickActorName ที่เทสต์แล้ว

import type { AdminIdentity } from '@/lib/auth-server';
import { getUsersDb, isMongoConfigured } from '@/lib/mongodb';
import { activeRegistryFilter } from '@/lib/registry-user';
import { pickActorName, type Actor } from '@/lib/saraban-doc';

export async function resolveActor(admin: AdminIdentity): Promise<Actor> {
  let registryName: unknown;
  if (isMongoConfigured()) {
    try {
      const doc = await (await getUsersDb())
        .collection('users')
        .findOne(activeRegistryFilter(admin.userId), { projection: { name: 1 } });
      registryName = doc?.name;
    } catch (err) {
      // อ่านชื่อไม่ได้ไม่ใช่เหตุให้ลงรับไม่ได้ — ประวัติได้อีเมลแทนชื่อจริง ซึ่งยังระบุตัวคนได้
      console.warn('resolveActor: อ่านชื่อจากทะเบียนสมาชิกไม่ได้ ใช้อีเมลแทน', err);
    }
  }
  return { id: admin.userId, name: pickActorName(registryName, admin.email, admin.userId) };
}
