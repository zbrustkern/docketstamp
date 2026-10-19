import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { AdminAccessError, Capability, requireCapability, serverEnvironment } from './access';

export interface CommandInput {
  capability: Capability; action: string; targetType: string; targetId: string;
  requestId: string; reason: string; effectSummary: string; expectedVersion?: number;
}
export async function beginCommand(req: NextRequest, input: CommandInput) {
  const actor = requireCapability(req, input.capability, true);
  if (!/^[a-zA-Z0-9_.:-]{8,128}$/.test(input.requestId) || !input.reason?.trim() || input.reason.length > 500 || input.targetId.length > 160) {
    throw new AdminAccessError(400, 'COMMAND_INPUT_INVALID');
  }
  const digest = crypto.createHash('sha256').update(JSON.stringify({ ...input, actor: actor.actorId })).digest('hex');
  const auditId = crypto.createHash('sha256').update(`${actor.actorId}:${input.requestId}`).digest('hex');
  const ref = firestoreDb.collection('admin_audit_v1').doc(auditId);
  const existing = await firestoreDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      if (snap.data()?.digest !== digest) throw new AdminAccessError(409, 'COMMAND_REQUEST_CONFLICT');
      return snap.data();
    }
    tx.set(ref, sanitizeFirestoreData({
      schemaVersion: 1, auditId, ...actor, capability: input.capability, action: input.action,
      targetType: input.targetType, targetId: input.targetId, expectedVersion: input.expectedVersion,
      requestId: input.requestId, reason: input.reason, effectSummary: input.effectSummary,
      environment: serverEnvironment(), occurredAt: new Date().toISOString(), status: 'pending', digest,
    }));
    return null;
  });
  return { auditId, actor, duplicate: Boolean(existing), status: String(existing?.status || 'pending') };
}

export async function finishCommand(auditId: string, status: 'succeeded' | 'failed' | 'uncertain' | 'reconciled', resultCode: string) {
  if (!/^[A-Z0-9_]{1,80}$/.test(resultCode)) throw new Error('Use bounded diagnostic code');
  await firestoreDb.collection('admin_audit_v1').doc(auditId).update({ status, resultCode, completedAt: new Date().toISOString() });
}
