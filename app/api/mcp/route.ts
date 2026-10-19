import { NextRequest, NextResponse } from 'next/server';
import { getAllNotices, getNoticesByCategory } from '@/src/lib/docket/notices';
import { searchVerifiedRecipients } from '@/src/lib/docket/data/verified-recipients';
import { createStagedDraft, StageDraftRequest } from '../docket/stage/stage-store';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MCP_TOOLS = [
  {
    name: 'list_docket_notices',
    description:
      'Lists all available statutory Notice Cartridges on DocketStamp with their slugs, titles, descriptions, categories, recommended tiers, and required fields.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['tenant', 'credit_debt', 'cancellation', 'consumer_rights'],
          description: 'Optional category filter: tenant, credit_debt, cancellation, or consumer_rights',
        },
      },
    },
  },
  {
    name: 'search_verified_recipients',
    description:
      'Searches the 38 pre-verified institutional recipients (credit bureaus, collection agencies, telecom, insurance, tech hardware OEMs) by brand name or category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term for company brand name, legal entity name, or city/state',
        },
        category: {
          type: 'string',
          description:
            'Optional category filter: credit_bureau, debt_collector, home_service, telecom_insurance, tech_hardware_legal',
        },
      },
    },
  },
  {
    name: 'stage_certified_notice',
    description:
      'Stages a certified postal notice draft on DocketStamp for a human user to review, adopt signature, and dispatch via USPS. Enforces NAICS 713940 fitness exclusions. Returns a 1-tap review URL.',
    inputSchema: {
      type: 'object',
      properties: {
        noticeSlug: {
          type: 'string',
          description: 'Canonical slug of the notice cartridge',
        },
        recipientId: {
          type: 'string',
          description: 'Pre-verified institutional recipient ID (e.g. leg_wth, cra_eqf, col_pra)',
        },
        customRecipient: {
          type: 'object',
          description: 'Custom recipient address if not using a verified recipient',
          properties: {
            name: { type: 'string' },
            company: { type: 'string' },
            addressLine1: { type: 'string' },
            addressLine2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zip: { type: 'string' },
          },
          required: ['name', 'addressLine1', 'city', 'state', 'zip'],
        },
        sender: {
          type: 'object',
          description: 'Sender address',
          properties: {
            name: { type: 'string' },
            addressLine1: { type: 'string' },
            addressLine2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zip: { type: 'string' },
          },
        },
        fieldValues: {
          type: 'object',
          description: 'Key-value map of notice field variables (partial completion allowed)',
        },
        recommendedTier: {
          type: 'string',
          enum: ['first_class', 'certified', 'certified_return_receipt'],
          description: 'Recommended USPS dispatch tier',
        },
      },
      required: ['noticeSlug'],
    },
  },
];

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error: Invalid JSON was received by the server.' },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { jsonrpc, id, method, params } = body || {};

  if (jsonrpc !== '2.0') {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0".' },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 1. initialize
  if (method === 'initialize') {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'docketstamp-mcp',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        },
      },
      { headers: CORS_HEADERS }
    );
  }

  // 2. ping
  if (method === 'ping') {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id,
        result: {},
      },
      { headers: CORS_HEADERS }
    );
  }

  // 3. tools/list
  if (method === 'tools/list') {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      },
      { headers: CORS_HEADERS }
    );
  }

  // 4. tools/call
  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    if (!toolName) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Invalid params: "name" is required for tools/call.' },
        },
        { headers: CORS_HEADERS }
      );
    }

    // Tool: list_docket_notices
    if (toolName === 'list_docket_notices') {
      const category = toolArgs.category;
      const cartridges = category ? getNoticesByCategory(category) : getAllNotices();
      const output = cartridges.map((n) => ({
        slug: n.slug,
        title: n.title,
        shortDescription: n.shortDescription,
        documentHeaderTitle: n.documentHeaderTitle,
        category: n.category,
        recommendedTier: n.recommendedTier,
        recipientMode: n.recipientMode,
        fields: (n.fields || []).map((f) => ({
          key: f.key,
          label: f.label,
          docusignTagLabel: f.docusignTagLabel,
          inputType: f.inputType,
          placeholder: f.placeholder,
          helperText: f.helperText,
          options: f.options,
          maxLength: f.maxLength,
        })),
      }));

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(output, null, 2),
              },
            ],
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // Tool: search_verified_recipients
    if (toolName === 'search_verified_recipients') {
      const { query, category } = toolArgs;
      const recipients = searchVerifiedRecipients(query, category);
      const output = recipients.map((r) => ({
        id: r.id,
        brandName: r.brandName,
        category: r.category,
        formalRecipientLine: r.formalRecipientLine,
        addressLine1: r.addressLine1,
        addressLine2: r.addressLine2,
        city: r.city,
        state: r.state,
        zip: r.zip,
        recommendedTier: r.recommendedTier,
        requiredIdentifiersHint: r.requiredIdentifiersHint,
      }));

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(output, null, 2),
              },
            ],
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // Tool: stage_certified_notice
    if (toolName === 'stage_certified_notice') {
      const stageReq: StageDraftRequest = {
        noticeSlug: toolArgs.noticeSlug,
        recipientId: toolArgs.recipientId,
        customRecipient: toolArgs.customRecipient,
        sender: toolArgs.sender,
        fieldValues: toolArgs.fieldValues,
        recommendedTier: toolArgs.recommendedTier,
      };

      const result = await createStagedDraft(stageReq);

      if (!result.success) {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      error: result.error,
                      code: result.code,
                      ...(result.details ? { details: result.details } : {}),
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          },
          { headers: CORS_HEADERS }
        );
      }

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    stageId: result.stageId,
                    reviewUrl: result.reviewUrl,
                    missingRequiredFields: result.missingRequiredFields,
                  },
                  null,
                  2
                ),
              },
            ],
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // Unknown tool name
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown tool: '${toolName}'.` },
      },
      { headers: CORS_HEADERS }
    );
  }

  // Unknown method
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32601, message: `Method '${method}' not found.` },
    },
    { headers: CORS_HEADERS }
  );
}
