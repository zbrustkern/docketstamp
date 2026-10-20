import { createHash } from 'node:crypto';
import { z } from 'zod';

export const OutboundEmailInputSchema = z.object({
  requestId: z.string().uuid(),
  to: z.string().trim().email().max(254).refine((value) => !/[;,\s]/.test(value), 'Enter one recipient email address'),
  subject: z.string().trim().min(1).max(160).refine((value) => !/[\r\n]/.test(value), 'Subject must be one line'),
  message: z.string().trim().min(1).max(12000),
}).strict();

export type OutboundEmailInput = z.infer<typeof OutboundEmailInputSchema>;
export type OutboundEmailStatus = 'pending' | 'accepted' | 'rejected' | 'uncertain';
export interface OutboundEmailRecord {
  requestId: string;
  environment: 'local' | 'staging' | 'production';
  recipient: string;
  subject: string;
  status: OutboundEmailStatus;
  providerId?: string;
  actorId: string;
  createdAt: string;
  updatedAt: string;
}

export type ReserveResult =
  | { kind: 'reserved'; record: OutboundEmailRecord }
  | { kind: 'duplicate'; record: OutboundEmailRecord }
  | { kind: 'conflict' }
  | { kind: 'rate_limited' };

export interface OutboundEmailStore {
  reserve(input: { requestId: string; environment: OutboundEmailRecord['environment']; actorId: string; recipient: string; subject: string; contentDigest: string; now: string }): Promise<ReserveResult>;
  complete(requestId: string, environment: OutboundEmailRecord['environment'], status: Exclude<OutboundEmailStatus, 'pending'>, providerId?: string): Promise<void>;
}

export function outboundEmailIdempotencyKey(environment: string, requestId: string): string {
  const digest = createHash('sha256').update(`${environment}:${requestId}`).digest('hex');
  return `docketstamp_${digest}`;
}

export type ProviderSend = (params: {
  apiKey: string;
  to: string;
  subject: string;
  message: string;
  idempotencyKey: string;
}) => Promise<{ status: 'accepted' | 'rejected' | 'uncertain'; providerId?: string }>;

export async function executeOutboundEmail(params: {
  input: OutboundEmailInput;
  environment: OutboundEmailRecord['environment'];
  actorId: string;
  now: string;
  apiKey?: string;
  store: OutboundEmailStore;
  send: ProviderSend;
}): Promise<{ status: OutboundEmailStatus; providerId?: string; duplicate: boolean }> {
  if (!params.apiKey?.trim()) throw new Error('OUTBOUND_EMAIL_NOT_CONFIGURED');
  const reservation = await params.store.reserve({
    requestId: params.input.requestId,
    environment: params.environment,
    actorId: params.actorId,
    recipient: params.input.to,
    subject: params.input.subject,
    contentDigest: createHash('sha256').update(`${params.input.to}\n${params.input.subject}\n${params.input.message}`).digest('hex'),
    now: params.now,
  });
  if (reservation.kind === 'rate_limited') throw new Error('OUTBOUND_EMAIL_RATE_LIMITED');
  if (reservation.kind === 'conflict') throw new Error('OUTBOUND_EMAIL_REQUEST_CONFLICT');
  if (reservation.kind === 'duplicate') {
    if (reservation.record.status === 'pending' && Date.parse(params.now) - Date.parse(reservation.record.createdAt) > 30_000) {
      await params.store.complete(params.input.requestId, params.environment, 'uncertain');
      return { status: 'uncertain', duplicate: true };
    }
    return { status: reservation.record.status, providerId: reservation.record.providerId, duplicate: true };
  }

  let result: Awaited<ReturnType<ProviderSend>>;
  try {
    result = await params.send({
      apiKey: params.apiKey,
      to: params.input.to,
      subject: params.input.subject,
      message: params.input.message,
      idempotencyKey: outboundEmailIdempotencyKey(params.environment, params.input.requestId),
    });
  } catch {
    result = { status: 'uncertain' };
  }
  await params.store.complete(params.input.requestId, params.environment, result.status, result.providerId);
  return { ...result, duplicate: false };
}

export const OUTBOUND_EMAIL_FROM = 'Zeke at DocketStamp <zeke@docketstamp.com>';
export const OUTBOUND_EMAIL_REPLY_TO = 'zeke@docketstamp.com';
export const OUTBOUND_EMAIL_RATE_LIMIT = 5;
export const OUTBOUND_EMAIL_RATE_WINDOW_MS = 60 * 60 * 1000;
