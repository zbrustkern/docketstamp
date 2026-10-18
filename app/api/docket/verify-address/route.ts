import { NextRequest, NextResponse } from 'next/server';
import { verifyUsAddress } from '@/lib/fulfillment/lob';
import { assertNonFitnessEntity, ConflictOfInterestError } from '@/lib/docket/guardrails';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    // Rate Limiting: 20 requests per IP per hour to protect live Lob CASS verification keys
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : req.headers.get('x-real-ip') || '127.0.0.1';

    const rateLimit = checkRateLimit(clientIp, {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 20,
      bucket: 'verify-address',
      message: 'Address verification rate limit exceeded (20 requests per hour). Please retry later.',
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: rateLimit.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const body = await req.json();
    const { address, recipientName, company } = body || {};

    if (!address) {
      return NextResponse.json(
        { error: 'Address payload is required for verification' },
        { status: 400 }
      );
    }

    // Invariant 1: Hard NAICS 713940 Block
    if (recipientName) {
      assertNonFitnessEntity(recipientName);
    }
    if (company) {
      assertNonFitnessEntity(company);
    }
    if (address.name) {
      assertNonFitnessEntity(address.name);
    }
    if (address.company) {
      assertNonFitnessEntity(address.company);
    }

    const verificationResult = await verifyUsAddress(address);

    return NextResponse.json({
      valid: verificationResult.valid,
      deliverability: verificationResult.deliverability,
      standardizedAddress: verificationResult.standardizedAddress,
      error: verificationResult.error,
    });
  } catch (err: any) {
    if (
      err instanceof ConflictOfInterestError ||
      err.name === 'ConflictOfInterestError' ||
      err.name === 'FitnessEntityProhibitedError'
    ) {
      return NextResponse.json(
        {
          error: err.message,
          code: 'CONFLICT_OF_INTEREST_FITNESS_EXCLUSION',
        },
        { status: 400 }
      );
    }

    console.error('[/api/docket/verify-address Error]', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error during address verification' },
      { status: 500 }
    );
  }
}
