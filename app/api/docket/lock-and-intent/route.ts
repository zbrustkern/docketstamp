import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getNoticeBySlug, DOCKET_PRICING_TIERS } from '@/lib/docket/notices';
import { interpolateNotice, generateDocketId } from '@/lib/docket/renderer/interpolate';
import { renderLobHtmlPayload } from '@/lib/docket/renderer/lob-html-shell';
import { assertNonFitnessEntity, ConflictOfInterestError } from '@/lib/docket/guardrails';
import { MailTierId, PostalAddress, DocketAddress } from '@/lib/docket/types';
import { saveOrder, updateOrderStatus, getDiscountCode, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { createCardPaymentIntent } from '@/lib/stripe';
import { validateDiscount } from '@/lib/discount';
import { Order } from '@/lib/types';
import { createDocumentIntegrityEvidence } from '@/lib/docket/integrity-evidence';

export async function POST(req: NextRequest) {
  let failureCode:
    | 'ORDER_PERSISTENCE'
    | 'PAYMENT_INITIALIZATION'
    | 'CHECKOUT_UNAVAILABLE' = 'CHECKOUT_UNAVAILABLE';
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
      userId,
      telemetrySessionId,
      sessionId: altSessionId,
      experienceVersion,
      entrySource,
      signatureAdoption,
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

    if (
      !signatureAdoption ||
      signatureAdoption.adopted !== true ||
      signatureAdoption.affirmed !== true ||
      typeof signatureAdoption.signerName !== 'string' ||
      !signatureAdoption.signerName.trim()
    ) {
      return NextResponse.json(
        {
          error: 'Adopt the typed signature and confirm the affirmation before checkout.',
          code: 'SIGNATURE_ADOPTION_REQUIRED',
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
    const adoptedSignerName = signatureAdoption.signerName.trim();
    if (adoptedSignerName !== interpolatedDoc.signatureBlock.signerName) {
      return NextResponse.json(
        { error: 'The adopted signer must match the name on the document.', code: 'SIGNER_MISMATCH' },
        { status: 400 }
      );
    }
    const adoptedAt = Date.now();
    const lockedAt = Date.now();
    const documentIntegrityEvidence = createDocumentIntegrityEvidence(
      frozenHtmlPayload,
      adoptedSignerName,
      adoptedAt,
      lockedAt
    );

    // 7. Invariant 5: Freeze-Before-Pay Snapshot Persistence
    let authenticatedUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : undefined;
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        try {
          const decoded = await verifyFirebaseIdToken(token);
          if (decoded?.uid) {
            authenticatedUserId = decoded.uid;
          }
        } catch (authErr) {
          console.warn('[lock-and-intent] Failed to verify Authorization Bearer token:', authErr);
        }
      }
    }

    const orderId = `order_${crypto.randomBytes(16).toString('hex')}`;
    const viewToken = `tok_${crypto.randomBytes(16).toString('hex')}`;

    const cleanSessionId = typeof telemetrySessionId === 'string' && telemetrySessionId.trim()
      ? telemetrySessionId.trim().slice(0, 100)
      : typeof altSessionId === 'string' && altSessionId.trim()
      ? altSessionId.trim().slice(0, 100)
      : undefined;

    const cleanExpVersion = typeof experienceVersion === 'string' && experienceVersion.trim()
      ? experienceVersion.trim().slice(0, 50)
      : 'home_v2';

    const ALLOWED_ENTRY_SOURCES = new Set([
      'home_chooser',
      'companies_directory',
      'recipient_prefill',
      'staged_draft',
      'direct_notice',
      'unknown',
    ]);
    const cleanEntrySource = typeof entrySource === 'string' && ALLOWED_ENTRY_SOURCES.has(entrySource.trim())
      ? entrySource.trim()
      : 'unknown';

    const orderRecord: Order = {
      id: orderId,
      schemaVersion: 2,
      kind: 'notice',
      noticeVersion: 1,
      postalProvider: 'unknown',
      userId: authenticatedUserId || undefined,
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
      documentIntegrityEvidence,
      viewToken,
      experienceVersion: cleanExpVersion,
      sessionId: cleanSessionId,
      telemetrySessionId: cleanSessionId,
      entrySource: cleanEntrySource,
      attribution: {
        sessionId: cleanSessionId,
        utmSource: cleanEntrySource,
      },
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
      ...(finalAmountInCents === 0 ? { paymentMethod: 'PROMO_CODE' as const } : {}),
    };

    // Commit snapshot before requesting payment credentials
    failureCode = 'ORDER_PERSISTENCE';
    await saveOrder(orderRecord);

    // A 100% discount is still a fully frozen notice order, but it does not
    // require a zero-dollar Stripe PaymentIntent. The free-order endpoint binds
    // it to durable free authorization before postal dispatch.
    if (finalAmountInCents === 0) {
      return NextResponse.json({
        orderId,
        viewToken,
        clientSecret: null,
        paymentIntentId: null,
        docketId,
        amountCents: 0,
        tier: activeTier,
        isFree: true,
        discountCode: appliedDiscountCode,
        discountAmountInCents,
      });
    }

    // 8. Create Stripe PaymentIntent
    failureCode = 'PAYMENT_INITIALIZATION';
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
      {
        code: failureCode,
        error:
          failureCode === 'ORDER_PERSISTENCE'
            ? 'We could not save checkout securely.'
            : failureCode === 'PAYMENT_INITIALIZATION'
            ? 'We could not initialize secure payment.'
            : 'We could not prepare checkout.',
      },
      { status: 500 }
    );
  }
}
