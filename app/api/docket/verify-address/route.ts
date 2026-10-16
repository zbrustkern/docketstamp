import { NextRequest, NextResponse } from 'next/server';
import { verifyUsAddress } from '@/lib/fulfillment/lob';
import { assertNonFitnessEntity, ConflictOfInterestError } from '@/lib/docket/guardrails';

export async function POST(req: NextRequest) {
  try {
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
    if (err instanceof ConflictOfInterestError || err.name === 'ConflictOfInterestError' || err.name === 'FitnessEntityProhibitedError') {
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
