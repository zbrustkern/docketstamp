import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getNoticeBySlug, DOCKET_PRICING_TIERS } from '@/lib/docket/notices';
import { interpolateNotice, generateDocketId } from '@/lib/docket/renderer/interpolate';
import { renderLobHtmlPayload } from '@/lib/docket/renderer/lob-html-shell';
import { assertNonFitnessEntity, ConflictOfInterestError } from '@/lib/docket/guardrails';
import { MailTierId, PostalAddress, DocketAddress } from '@/lib/docket/types';
import { saveOrder, updateOrderStatus, getDiscountCode } from '@/lib/firebase-admin';
import { createCardPaymentIntent } from '@/lib/stripe';
import { validateDiscount } from '@/lib/discount';
import { Order } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      slug,
      noticeSlug,
      userValues = {},
      tier,
      selectedTier,
      customerEmail = '',
      docketId: clientDocketId,
      senderAddress,
      recipientAddress,
      discountCode: rawDiscountCode,
    } = body;

    const noticeKey = slug || noticeSlug;
    if (!noticeKey) {
      return NextResponse.json(
        { error: 'Notice template slug is required.' },
        { status: 400 }
      );
    }

    // 1. Resolve Notice Cartridge
    const notice = getNoticeBySlug(noticeKey);
    if (!notice) {
      return NextResponse.json(
        { error: `Notice template '${noticeKey}' not found.` },
        { status: 404 }
      );
    }

    // 2. Strict Conflict-of-Interest & Guardrail Verification (Invariant 1)
    try {
      if (userValues.recipientFormalName) {
        assertNonFitnessEntity(userValues.recipientFormalName);
      }
      if (userValues.serviceProviderName) {
        assertNonFitnessEntity(userValues.serviceProviderName);
      }
      if (userValues.collectionAgencyName) {
        assertNonFitnessEntity(userValues.collectionAgencyName);
      }
      if (userValues.serviceTypeLabel) {
        assertNonFitnessEntity(userValues.serviceTypeLabel);
      }
      if (userValues.creditorName) {
        assertNonFitnessEntity(userValues.creditorName);
      }
      if (userValues.disputedAccountName) {
        assertNonFitnessEntity(userValues.disputedAccountName);
      }
      if (recipientAddress?.name) {
        assertNonFitnessEntity(recipientAddress.name);
      }
      if (recipientAddress?.company) {
        assertNonFitnessEntity(recipientAddress.company);
      }
    } catch (err: unknown) {
      if (err instanceof ConflictOfInterestError) {
        return NextResponse.json(
          {
            error: err.message,
            code: 'CONFLICT_OF_INTEREST',
            category: 'PROHIBITED_NAICS_713940',
          },
          { status: 400 }
        );
      }
      throw err;
    }

    // 3. Schema Validation against Cartridge Definition
    const parsedFields = notice.zodSchema.safeParse(userValues);
    if (!parsedFields.success) {
      return NextResponse.json(
        {
          error: 'Document fields failed statutory validation.',
          details: parsedFields.error.flatten(),
        },
        { status: 400 }
      );
    }

    // 4. Resolve Mail Tier & Pricing
    const activeTier: MailTierId =
      tier || selectedTier || notice.recommendedTier || 'certified';
    const tierMeta = DOCKET_PRICING_TIERS[activeTier];
    if (!tierMeta) {
      return NextResponse.json(
        { error: `Invalid mail service tier '${activeTier}'.` },
        { status: 400 }
      );
    }

    let finalAmountInCents = tierMeta.priceCents;
    let discountAmountInCents = 0;
    let appliedDiscountCode: string | undefined = undefined;

    // Evaluate optional promotional discount code
    if (rawDiscountCode && typeof rawDiscountCode === 'string' && rawDiscountCode.trim()) {
      const codeToLookup = rawDiscountCode.trim().toUpperCase();
      const discountDoc = await getDiscountCode(codeToLookup);
      const discountValidation = validateDiscount(discountDoc, tierMeta.priceCents);

      if (discountValidation.valid) {
        appliedDiscountCode = discountValidation.code;
        discountAmountInCents = discountValidation.discountAmountInCents;
        finalAmountInCents = discountValidation.finalAmountInCents;
      }
    }

    // 5. Generate / Validate Immutable Docket ID
    const docketId =
      clientDocketId && /^DS-2026-[A-Z0-9]{6}$/.test(clientDocketId)
        ? clientDocketId
        : generateDocketId();

    // 6. Dual-Render Parity: Pure Deterministic Document & HTML Generation
    const interpolatedDoc = interpolateNotice({
      notice,
      userValues,
      docketId,
      serviceLevel: activeTier,
      senderAddress,
      recipientAddress,
    });

    const frozenHtmlPayload = renderLobHtmlPayload(interpolatedDoc);

    // 7. Invariant 5: Freeze-Before-Pay Snapshot Persistence
    const orderId = `order_${crypto.randomBytes(16).toString('hex')}`;
    const viewToken = `tok_${crypto.randomBytes(16).toString('hex')}`;

    const orderRecord: Order = {
      id: orderId,
      customerEmail,
      docketId,
      docketNumber: docketId,
      noticeId: notice.id,
      noticeType: notice.slug,
      serviceLevel:
        activeTier === 'first_class'
          ? 'FIRST_CLASS'
          : activeTier === 'certified_return_receipt'
          ? 'CERTIFIED_RETURN_RECEIPT'
          : 'CERTIFIED',
      status: 'PENDING_PAYMENT',
      amountInCents: finalAmountInCents,
      finalAmountInCents,
      originalAmountInCents: tierMeta.priceCents,
      discountCode: appliedDiscountCode,
      discountAmountInCents,
      documentHtml: frozenHtmlPayload,
      viewToken,
      recipientAddress: {
        firstName: interpolatedDoc.recipientAddress.name,
        lastName: '',
        street1: interpolatedDoc.recipientAddress.address_line1,
        street2: interpolatedDoc.recipientAddress.address_line2,
        city: interpolatedDoc.recipientAddress.address_city,
        state: interpolatedDoc.recipientAddress.address_state,
        zip: interpolatedDoc.recipientAddress.address_zip,
        country: 'US',
      },
      returnAddress: {
        firstName: interpolatedDoc.senderAddress.name,
        lastName: '',
        street1: interpolatedDoc.senderAddress.address_line1,
        street2: interpolatedDoc.senderAddress.address_line2,
        city: interpolatedDoc.senderAddress.address_city,
        state: interpolatedDoc.senderAddress.address_state,
        zip: interpolatedDoc.senderAddress.address_zip,
        country: 'US',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Commit snapshot before requesting payment credentials
    await saveOrder(orderRecord);

    // 8. Create Stripe PaymentIntent
    const paymentIntent = await createCardPaymentIntent({
      orderId,
      customerEmail: customerEmail || undefined,
      amountInCents: finalAmountInCents,
      metadata: {
        orderId,
        docketId,
        tier: activeTier,
        noticeSlug: notice.slug,
        product: 'docketstamp',
      },
    });

    // Update order with the Stripe PaymentIntent identifier
    await updateOrderStatus(orderId, {
      stripePaymentId: paymentIntent.paymentIntentId,
    });

    return NextResponse.json({
      orderId,
      viewToken,
      clientSecret: paymentIntent.clientSecret,
      docketId,
      amountCents: finalAmountInCents,
      tier: activeTier,
    });
  } catch (error: any) {
    console.error('[/api/docket/lock-and-intent Error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error initializing docket order.' },
      { status: 500 }
    );
  }
}
