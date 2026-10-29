import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getNoticeBySlug, DOCKET_PRICING_TIERS } from '@/lib/docket/notices';
import { interpolateNotice, generateDocketId } from '@/lib/docket/renderer/interpolate';
import { renderLobHtmlPayload } from '@/lib/docket/renderer/lob-html-shell';
import { assessPhysicalFit } from '@/lib/docket/renderer/physical-fit';
import { assertNonFitnessEntity, ConflictOfInterestError } from '@/lib/docket/guardrails';
import { MailTierId } from '@/lib/docket/types';
import { updateOrderStatus, getDiscountCode, verifyFirebaseIdToken, getOrderById } from '@/lib/firebase-admin';
import { createCardPaymentIntent } from '@/lib/stripe';
import { validateDiscount } from '@/lib/discount';
import { Order } from '@/lib/types';
import { createDocumentIntegrityEvidence } from '@/lib/docket/integrity-evidence';
import { createOrderUnderPolicy } from '@/lib/template-policy-store';
import { PolicyNexus } from '@/src/lib/docket/template-policy';
import { isMailingReadyForCheckout } from '@/lib/checkout-readiness';
import { validateNoticeInput } from '@/lib/docket/input-validation';
import { getAddressDigest, verifyAddressVerificationEvidence, type AddressEvidenceAddress } from '@/lib/docket/address-verification-evidence';
import { createCapability, createAttemptId, reserveAttempt, setAttemptState, sha256, updateOrderAttemptState } from '@/src/lib/checkout-attempts/store';
import { verifyUsAddress } from '@/lib/fulfillment/lob';
import { addressVerificationStatusLabel } from '@/lib/docket/address-verification-status';
import { resolvePaymentMode } from '@/lib/payment-mode';
import { serverEnvironment } from '@/lib/admin-console/commands/access';

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function comparableAddressPart(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-US') : '';
}

export async function POST(req: NextRequest) {
  let failureCode:
    | 'ORDER_PERSISTENCE'
    | 'PAYMENT_INITIALIZATION'
    | 'CHECKOUT_UNAVAILABLE' = 'CHECKOUT_UNAVAILABLE';
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Checkout request must be an object.' }, { status: 400 });
    }

    const {
      slug,
      noticeSlug,
      userValues: rawUserValues = {},
      tier,
      selectedTier,
      customerEmail = '',
      docketId: clientDocketId,
      senderAddress,
      recipientAddress,
      discountCode: rawDiscountCode,
      draftId: rawDraftId,
      draftRevision: rawDraftRevision,
      checkoutCapability: rawCheckoutCapability,
      idempotencyKey: rawIdempotencyKey,
      verificationEvidence,
      telemetrySessionId,
      sessionId: altSessionId,
      journeyId: rawJourneyId,
      experienceVersion,
      entrySource,
      signatureAdoption,
      marketingConsent = false,
    } = body as Record<string, any>;

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

    // 2. Parse the template schema, then keep only bounded factual fields and
    // explicitly allowed postal components. Legal metadata remains renderer-owned.
    let validatedInput: ReturnType<typeof validateNoticeInput>;
    try {
      validatedInput = validateNoticeInput(notice, rawUserValues, senderAddress, recipientAddress);
    } catch (err: unknown) {
      // A few template refinements use the same prohibited-recipient guard as
      // the post-parse shared checks. Convert that deliberate rejection into
      // the stable public conflict response instead of a generic 500.
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
    if (!validatedInput.success) {
      return NextResponse.json(
        {
          error: 'Document fields failed validation.',
          details: validatedInput.issues,
        },
        { status: 400 }
      );
    }
    const policyNexus: PolicyNexus = {
      consumerResidenceState: rawUserValues.consumerResidenceState,
      propertyState: rawUserValues.propertyState,
    };
    const userValues = validatedInput.userValues;
    // Structured addresses are optional: the ordinary workspace submits postal
    // fields in userValues. Bind proofs to the same effective addresses that
    // interpolation and physical fulfillment actually use.
    const safeSenderAddress = {
      name: userValues.senderFullName,
      addressLine1: userValues.senderAddressLine1,
      addressLine2: userValues.senderAddressLine2,
      city: userValues.senderCity, state: userValues.senderState, zip: userValues.senderZip,
      ...validatedInput.senderAddress,
    };
    const safeRecipientAddress = {
      name: userValues.recipientFormalName,
      addressLine1: userValues.recipientAddressLine1,
      addressLine2: userValues.recipientAddressLine2,
      city: userValues.recipientCity, state: userValues.recipientState, zip: userValues.recipientZip,
      ...validatedInput.recipientAddress,
    };

    const draftId = typeof rawDraftId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(rawDraftId)
      ? rawDraftId
      : `draft_${crypto.randomBytes(16).toString('hex')}`;
    const draftRevision = Number.isSafeInteger(rawDraftRevision) && rawDraftRevision >= 0 ? rawDraftRevision : 0;
    const checkoutCapability = typeof rawCheckoutCapability === 'string' && rawCheckoutCapability.length >= 32 && rawCheckoutCapability.length <= 256
      ? rawCheckoutCapability
      : createCapability();
    const idempotencyKey = typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.length >= 8 && rawIdempotencyKey.length <= 128
      ? rawIdempotencyKey
      : crypto.randomUUID();

    const addressEvidenceValues = verificationEvidence && typeof verificationEvidence === 'object' ? verificationEvidence : {};
    if (!isMailingReadyForCheckout()) {
      return NextResponse.json({ error: 'Mailing checkout is temporarily unavailable. Nothing was charged.', code: 'MAILING_UNAVAILABLE' }, { status: 503 });
    }
    const allowedAddressProviderModes = process.env.NODE_ENV === 'test'
      ? ['live_cass', 'staging_mock_cass', 'local_mock'] as const
      : process.env.LOB_ENV === 'staging_mock_cass'
        ? ['live_cass', 'staging_mock_cass'] as const
        : ['live_cass'] as const;
    const senderAddressFields = safeSenderAddress as Record<string, string | undefined>;
    const recipientAddressFields = safeRecipientAddress as Record<string, string | undefined>;
    const senderEvidenceAddress: AddressEvidenceAddress = {
      name: senderAddressFields.name,
      addressLine1: senderAddressFields.addressLine1,
      addressLine2: senderAddressFields.addressLine2,
      city: senderAddressFields.city,
      state: senderAddressFields.state,
      zip: senderAddressFields.zip,
    };
    const recipientEvidenceAddress: AddressEvidenceAddress = {
      name: recipientAddressFields.name,
      company: recipientAddressFields.company,
      addressLine1: recipientAddressFields.addressLine1,
      addressLine2: recipientAddressFields.addressLine2,
      city: recipientAddressFields.city,
      state: recipientAddressFields.state,
      zip: recipientAddressFields.zip,
    };
    let senderEvidencePayload = addressEvidenceValues.sender
      ? verifyAddressVerificationEvidence({ evidence: addressEvidenceValues.sender, role: 'sender', draftId, draftRevision, address: senderEvidenceAddress, allowedProviderModes: [...allowedAddressProviderModes] })
      : null;
    let recipientEvidencePayload = addressEvidenceValues.recipient
      ? verifyAddressVerificationEvidence({ evidence: addressEvidenceValues.recipient, role: 'recipient', draftId, draftRevision, address: recipientEvidenceAddress, allowedProviderModes: [...allowedAddressProviderModes] })
      : null;
    let senderAddressEvidenceDigest = senderEvidencePayload?.addressDigest;
    let recipientAddressEvidenceDigest = recipientEvidencePayload?.addressDigest;
    const verifiedAddressProviderModes: Array<'live_cass' | 'staging_mock_cass' | 'local_mock' | undefined> = [
      senderEvidencePayload?.providerMode,
      recipientEvidencePayload?.providerMode,
    ];
    if ((addressEvidenceValues.sender && !senderEvidencePayload) || (addressEvidenceValues.recipient && !recipientEvidencePayload)) {
      return NextResponse.json({ error: 'Address verification is stale or does not match this draft revision. Verify the current addresses again.', code: 'ADDRESS_VERIFICATION_STALE' }, { status: 409 });
    }
    // Older clients may not send signed review evidence. In that case verify
    // the exact submitted addresses server-side; if CASS changes one, require
    // explicit review before creating a frozen document or payment.
    for (const [role, address, existing] of [
      ['sender', senderEvidenceAddress, senderEvidencePayload],
      ['recipient', recipientEvidenceAddress, recipientEvidencePayload],
    ] as const) {
      if (existing) continue;
      const verification = await verifyUsAddress({
        name: address.name || '', company: address.company,
        addressLine1: address.addressLine1 || '', addressLine2: address.addressLine2,
        city: address.city || '', state: address.state || '', zip: address.zip || '',
      });
      if (!verification.valid || !verification.standardizedAddress) {
        return NextResponse.json({ error: 'A mailing address could not be verified. Review it and try again.', code: 'ADDRESS_VERIFICATION_FAILED', role, detail: verification.error || verification.deliverability }, { status: 422 });
      }
      const normalized = verification.standardizedAddress;
      const normalizedZip = `${normalized.zip_code || ''}${normalized.zip_code_plus_4 ? `-${normalized.zip_code_plus_4}` : ''}`;
      const changed = comparableAddressPart(address.addressLine1) !== comparableAddressPart(normalized.primary_line)
        || comparableAddressPart(address.addressLine2) !== comparableAddressPart(normalized.secondary_line)
        || comparableAddressPart(address.city) !== comparableAddressPart(normalized.city)
        || comparableAddressPart(address.state) !== comparableAddressPart(normalized.state)
        || comparableAddressPart(String(address.zip || '').replace(/-/g, '')) !== comparableAddressPart(normalizedZip.replace(/-/g, ''));
      if (changed) {
        return NextResponse.json({
          error: 'The postal service suggested a change. Review and accept the standardized address before checkout.',
          code: 'ADDRESS_NORMALIZATION_REVIEW_REQUIRED', role,
          suggestedAddress: { name: normalized.recipient, addressLine1: normalized.primary_line, addressLine2: normalized.secondary_line || '', city: normalized.city, state: normalized.state, zip: normalizedZip },
          providerMode: process.env.LOB_ENV === 'staging_mock_cass' ? 'staging_mock_cass' : 'live_cass',
        }, { status: 409 });
      }
      const payload = {
        addressDigest: getAddressDigest(address),
      };
      if (role === 'sender') {
        senderAddressEvidenceDigest = payload.addressDigest;
        verifiedAddressProviderModes[0] = verification.providerMode;
      } else {
        recipientAddressEvidenceDigest = payload.addressDigest;
        verifiedAddressProviderModes[1] = verification.providerMode;
      }
    }

    try {
      for (const key of [
        'recipientFormalName',
        'serviceProviderName',
        'collectionAgencyName',
        'serviceTypeLabel',
        'creditorName',
        'disputedAccountName',
      ]) {
        const value = userValues[key];
        if (value) assertNonFitnessEntity(value);
      }
      if (safeRecipientAddress.name) assertNonFitnessEntity(safeRecipientAddress.name);
      if (safeRecipientAddress.company) assertNonFitnessEntity(safeRecipientAddress.company);
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
      typeof clientDocketId === 'string' && /^DS-2026-[A-Z0-9]{6}$/.test(clientDocketId)
        ? clientDocketId
        : generateDocketId();

    // 6. Dual-Render Parity: Pure Deterministic Document & HTML Generation
    const interpolatedDoc = interpolateNotice({
      notice,
      userValues,
      docketId,
      serviceLevel: activeTier,
      cassStatus: addressVerificationStatusLabel(verifiedAddressProviderModes),
      senderAddress: safeSenderAddress,
      recipientAddress: safeRecipientAddress,
    });

    const physicalFit = assessPhysicalFit(interpolatedDoc);
    if (!physicalFit.fits) {
      return NextResponse.json({
        error: physicalFit.failure === 'address_length'
          ? 'Shorten the mailing names, company, or address lines to fit standard postal address limits.'
          : 'This letter is too long for one printed page. Shorten the longest filled details, then review it again before continuing.',
        code: 'PHYSICAL_FIT_REQUIRED',
        reason: physicalFit.failure,
      }, { status: 422 });
    }

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
    let authenticatedUserId: string | undefined;
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

    // Verified identity is the sole account-ownership authority. An invalid or
    // missing token creates an isolated guest capability scope; body userId is ignored.
    const capabilityDigest = sha256(checkoutCapability);
    const scopeId = authenticatedUserId ? sha256(`user:${authenticatedUserId}`) : sha256(`guest:${capabilityDigest}`);

    const orderId = `order_${crypto.randomBytes(16).toString('hex')}`;
    const viewToken = `tok_${crypto.randomBytes(16).toString('hex')}`;
    const attemptId = createAttemptId();
    const quoteVersion = `q_${sha256(stableJson({ tier: activeTier, amount: finalAmountInCents, original: tierMeta.priceCents, discountCode: appliedDiscountCode || null, discountAmountInCents })).slice(0, 20)}`;
    const pricingVersion = 'docketstamp-usps-2026-v1';
    const requestPayloadDigest = sha256(stableJson({
      noticeSlug: notice.slug, userValues, senderAddress: safeSenderAddress, recipientAddress: safeRecipientAddress,
      tier: activeTier, amount: finalAmountInCents, discountCode: appliedDiscountCode || null,
      discountAmountInCents, signatureAdoption: { signerName: adoptedSignerName, affirmed: true },
      requestedDocketId: typeof clientDocketId === 'string' ? clientDocketId : null,
      customerEmail: typeof customerEmail === 'string' ? customerEmail.trim() : '',
      draftId, draftRevision,
      policyNexus, senderAddressEvidence: senderAddressEvidenceDigest, recipientAddressEvidence: recipientAddressEvidenceDigest,
    }));
    // Resolve payment authority server-side before reserving an attempt so
    // supersession can later choose a mode-safe resolver without trusting IDs.
    const checkoutPaymentMode = finalAmountInCents > 0 ? resolvePaymentMode() : undefined;

    const attemptReservation = await reserveAttempt({
      attemptId,
      orderId,
      ownerUid: authenticatedUserId,
      capabilityDigest,
      draftId,
      draftRevision,
      requestKeyDigest: sha256(idempotencyKey),
      payloadDigest: requestPayloadDigest,
      snapshotHash: sha256(frozenHtmlPayload),
      quoteVersion,
      pricingVersion,
      amountInCents: finalAmountInCents,
      currency: 'usd',
      paymentMode: checkoutPaymentMode,
      tier: activeTier,
      scopeId,
    });
    if (attemptReservation.kind === 'conflict') {
      return NextResponse.json({ error: 'This idempotency key was already used for different checkout details.', code: 'IDEMPOTENCY_KEY_REUSED' }, { status: 409 });
    }
    if (attemptReservation.kind === 'active_attempt') {
      return NextResponse.json({ error: 'Resolve the previous checkout attempt before creating another payment.', code: 'CHECKOUT_ATTEMPT_ACTIVE', attemptId: attemptReservation.attempt.attemptId, state: attemptReservation.attempt.state }, { status: 409 });
    }
    if (attemptReservation.kind === 'replay') {
      let prior = attemptReservation.attempt;
      const priorOrder = await getOrderById(prior.orderId);
      if (!priorOrder) {
        if (prior.state === 'creating') {
          // The original request can still be committing its policy-bound
          // snapshot. Absence is not proof that the creator has stopped.
          return NextResponse.json({ error: 'Checkout initialization is still in progress. Retry this same request.', code: 'CHECKOUT_ATTEMPT_BUSY', attemptId: prior.attemptId }, { status: 409 });
        }
        return NextResponse.json({ error: 'The prior checkout snapshot could not be loaded.', code: 'CHECKOUT_ATTEMPT_UNAVAILABLE' }, { status: 503 });
      }
      if (prior.amountInCents > 0) {
        let currentMode;
        try { currentMode = resolvePaymentMode(); } catch { currentMode = undefined; }
        const persistedMode = prior.paymentMode || priorOrder.paymentMode;
        if (!persistedMode || !currentMode || persistedMode !== currentMode || priorOrder.paymentMode !== persistedMode ||
            (prior.paymentMode && prior.paymentMode !== persistedMode)) {
          return NextResponse.json({ error: 'The saved checkout payment mode cannot be safely resumed in this runtime.', code: 'CHECKOUT_PAYMENT_MODE_MISMATCH' }, { status: 409 });
        }
      }
      if (prior.state === 'creating' && prior.amountInCents > 0 && !prior.paymentIntentId && priorOrder.status === 'PENDING_PAYMENT') {
        // Recover the original Stripe request with its stable provider idempotency key.
        // Stripe returns the same PaymentIntent if the first response was lost.
        const recoveredPayment = await createCardPaymentIntent({
          orderId: prior.orderId,
          customerEmail: priorOrder.customerEmail || undefined,
          amountInCents: prior.amountInCents,
          metadata: {
            orderId: prior.orderId,
            docketId: String(priorOrder.docketId || ''),
            tier: prior.tier,
            noticeSlug: String(priorOrder.noticeType || ''),
            product: 'docketstamp',
            checkoutAttemptId: prior.attemptId,
            draftRevision: String(prior.draftRevision),
            snapshotHash: prior.snapshotHash,
          },
          idempotencyKey: `docketstamp_${prior.attemptId}`,
        });
        await updateOrderStatus(prior.orderId, { stripePaymentId: recoveredPayment.paymentIntentId, checkoutPaymentIntentId: recoveredPayment.paymentIntentId });
        prior = await setAttemptState(prior.attemptId, 'locked', {
          paymentIntentId: recoveredPayment.paymentIntentId,
          clientSecret: recoveredPayment.clientSecret || undefined,
        });
        await updateOrderAttemptState(prior.orderId, prior);
      }
      return NextResponse.json({
        orderId: prior.orderId,
        viewToken: priorOrder.viewToken,
        clientSecret: prior.clientSecret || null,
        paymentIntentId: prior.paymentIntentId || null,
        docketId: priorOrder.docketId,
        amountCents: prior.amountInCents,
        tier: prior.tier,
        isFree: prior.amountInCents === 0,
        attemptId: prior.attemptId,
        draftId: prior.draftId,
        draftRevision: prior.draftRevision,
        quoteVersion: prior.quoteVersion,
        pricingVersion: prior.pricingVersion,
        snapshotHash: prior.snapshotHash,
        reviewPayload: priorOrder.documentHtml,
        checkoutCapability,
      });
    }

    const cleanSessionId = typeof telemetrySessionId === 'string' && telemetrySessionId.trim()
      ? telemetrySessionId.trim().slice(0, 100)
      : typeof altSessionId === 'string' && altSessionId.trim()
      ? altSessionId.trim().slice(0, 100)
      : undefined;
    const cleanJourneyId = typeof rawJourneyId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(rawJourneyId.trim())
      ? rawJourneyId.trim()
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
      checkoutAttemptId: attemptId,
      checkoutAttemptState: 'creating',
      checkoutAttemptSupersededBy: null,
      checkoutPaymentIntentId: null,
      amountInCents: finalAmountInCents,
      finalAmountInCents,
      ...(checkoutPaymentMode ? { paymentMode: checkoutPaymentMode } : {}),
      originalAmountInCents: tierMeta.priceCents,
      discountCode: appliedDiscountCode,
      discountAmountInCents,
      documentHtml: frozenHtmlPayload,
      documentIntegrityEvidence,
      viewToken,
      experienceVersion: cleanExpVersion,
      sessionId: cleanSessionId,
      telemetrySessionId: cleanSessionId,
      telemetryJourneyId: cleanJourneyId,
      entrySource: cleanEntrySource,
      attribution: {
        sessionId: cleanSessionId,
        utmSource: cleanEntrySource,
        // Customer consent assertion captured at lock; omitted/denied stays false.
        marketingConsent: marketingConsent === true,
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
    const policyCommit = await createOrderUnderPolicy(orderRecord as any, notice.slug, policyNexus, {
      eventId: `document_locked:${orderId}`,
      eventName: 'document_locked',
      environment: serverEnvironment(),
      occurredAt: new Date(lockedAt).toISOString(),
      sessionId: cleanSessionId,
      journeyId: cleanJourneyId,
      draftRevision,
      checkoutAttemptId: attemptId,
      orderId,
      noticeId: notice.slug,
      tier: activeTier,
      entrySurface: cleanEntrySource,
      experienceVersion: cleanExpVersion,
      classification: 'unresolved',
      classificationEvidenceRef: `orders/${orderId}`,
      safeProperties: { result: 'locked' },
    });
    if (!policyCommit.ok) {
      await setAttemptState(attemptId, 'cancelled');
      return NextResponse.json({
        error: policyCommit.decision.message,
        code: policyCommit.decision.code,
        details: { requiredFields: policyCommit.decision.requiredFields },
      }, { status: 403 });
    }
    await setAttemptState(attemptId, 'creating', {
      policyRevision: policyCommit.revision,
      templateContentDigest: policyCommit.contentDigest,
      policyNexus,
    });

    // A 100% discount is still a fully frozen notice order, but it does not
    // require a zero-dollar Stripe PaymentIntent. The free-order endpoint binds
    // it to durable free authorization before postal dispatch.
    if (finalAmountInCents === 0) {
      let attempt = await setAttemptState(attemptId, 'locked');
      await updateOrderAttemptState(orderId, attempt);
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
        attemptId,
        draftId,
        draftRevision,
        quoteVersion,
        pricingVersion,
        snapshotHash: attempt.snapshotHash,
        reviewPayload: frozenHtmlPayload,
        checkoutCapability,
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
        checkoutAttemptId: attemptId,
        draftRevision: String(draftRevision),
        snapshotHash: sha256(frozenHtmlPayload),
      },
      idempotencyKey: `docketstamp_${attemptId}`,
    });

    // Update order with the Stripe PaymentIntent identifier
    await updateOrderStatus(orderId, {
      stripePaymentId: paymentIntent.paymentIntentId,
      checkoutPaymentIntentId: paymentIntent.paymentIntentId,
    });
    const attempt = await setAttemptState(attemptId, 'locked', {
      paymentIntentId: paymentIntent.paymentIntentId,
      clientSecret: paymentIntent.clientSecret || undefined,
    });
    await updateOrderAttemptState(orderId, attempt);

    return NextResponse.json({
      orderId,
      viewToken,
      clientSecret: paymentIntent.clientSecret,
      docketId,
      amountCents: finalAmountInCents,
      tier: activeTier,
      attemptId,
      draftId,
      draftRevision,
      quoteVersion,
      pricingVersion,
      snapshotHash: attempt.snapshotHash,
      reviewPayload: frozenHtmlPayload,
      checkoutCapability,
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
