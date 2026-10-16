import { NextResponse } from 'next/server';
import { getAllNotices } from '@/src/lib/docket/notices';
import { getAllVerifiedRecipients } from '@/src/lib/docket/data/verified-recipients';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET() {
  const notices = getAllNotices();
  const recipients = getAllVerifiedRecipients();

  const noticeSlugs = notices.map((n) => n.slug);
  const recipientIds = recipients.map((r) => r.id);

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'DocketStamp Agentic Notice & Physical Postal Dispatch API',
      version: '1.0.0',
      description:
        'Official API and MCP interface for DocketStamp. Allows autonomous AI agents to stage formal statutory notices (demand letters, credit disputes, arbitration opt-outs, and data deletion requests) for physical USPS First-Class and Certified Mail dispatch. "Agents stage, humans sign and pay."',
      contact: {
        name: 'DocketStamp Platform Team',
        url: 'https://docketstamp.com',
      },
    },
    servers: [
      {
        url: 'https://docketstamp.com',
        description: 'Production Server',
      },
      {
        url: 'https://staging.docketstamp.com',
        description: 'Staging Server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Local Development Server',
      },
    ],
    paths: {
      '/api/docket/stage': {
        post: {
          summary: 'Stage a certified statutory notice draft',
          description:
            'Allows an AI agent to pre-populate notice fields, select recipients, and obtain a 1-tap review URL for the human user to sign and dispatch. Enforces NAICS 713940 fitness exclusions.',
          operationId: 'stageNoticeDraft',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/StageDraftRequest',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Draft staged successfully with 7-day TTL and 1-tap review URL',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StageDraftResponse',
                  },
                },
              },
            },
            '400': {
              description:
                'Conflict of interest (prohibited fitness entity NAICS 713940) or invalid input parameters',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
            '404': {
              description: 'Notice cartridge not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/api/docket/stage/{stageId}': {
        get: {
          summary: 'Retrieve a staged notice draft by ID',
          description:
            'Fetches the pre-populated values and recipient data for a staged notice draft within its 7-day TTL.',
          operationId: 'getStagedDraft',
          parameters: [
            {
              name: 'stageId',
              in: 'path',
              required: true,
              description: 'Unique staging identifier (format: DS-STAGE-XXXXXX)',
              schema: {
                type: 'string',
                example: 'DS-STAGE-84A19F',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Staged draft record retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StagedDraftRecord',
                  },
                },
              },
            },
            '404': {
              description: 'Draft not found or expired after 7 days',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ErrorResponse',
                  },
                },
              },
            },
          },
        },
      },
      '/api/mcp': {
        post: {
          summary: 'Stateless JSON-RPC 2.0 Model Context Protocol (MCP) Streamable HTTP endpoint',
          description:
            'Enables LLM agents to list notices, search verified corporate recipients, and stage drafts via standard Model Context Protocol methods (initialize, ping, tools/list, tools/call).',
          operationId: 'mcpJsonRpc',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/JsonRpcRequest',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'JSON-RPC 2.0 response object',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/JsonRpcResponse',
                  },
                },
              },
            },
            '400': {
              description: 'Invalid JSON-RPC request',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/JsonRpcResponse',
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        NoticeSlug: {
          type: 'string',
          enum: noticeSlugs,
          description: 'Canonical slug identifying an active statutory Notice Cartridge.',
        },
        VerifiedRecipientId: {
          type: 'string',
          enum: recipientIds,
          description: 'Pre-verified institutional legal notice recipient identifier.',
        },
        MailTier: {
          type: 'string',
          enum: ['first_class', 'certified', 'certified_return_receipt'],
          description: 'USPS postal dispatch service level.',
        },
        PostalAddress: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Full legal individual name' },
            company: { type: 'string', description: 'Company or entity name' },
            addressLine1: { type: 'string', description: 'Street address or P.O. Box' },
            addressLine2: { type: 'string', description: 'Suite, unit, floor, or department' },
            city: { type: 'string', description: 'City' },
            state: { type: 'string', description: 'Two-letter US state code' },
            zip: { type: 'string', description: '5-digit or 9-digit US ZIP code' },
          },
          required: ['addressLine1', 'city', 'state', 'zip'],
        },
        StageDraftRequest: {
          type: 'object',
          properties: {
            noticeSlug: {
              $ref: '#/components/schemas/NoticeSlug',
            },
            recipientId: {
              $ref: '#/components/schemas/VerifiedRecipientId',
            },
            customRecipient: {
              $ref: '#/components/schemas/PostalAddress',
            },
            sender: {
              $ref: '#/components/schemas/PostalAddress',
            },
            fieldValues: {
              type: 'object',
              additionalProperties: true,
              description: 'Key-value mapping of template variable fields.',
            },
            recommendedTier: {
              $ref: '#/components/schemas/MailTier',
            },
          },
          required: ['noticeSlug'],
        },
        StageDraftResponse: {
          type: 'object',
          properties: {
            stageId: {
              type: 'string',
              example: 'DS-STAGE-84A19F',
            },
            noticeSlug: {
              type: 'string',
              example: 'pre-arbitration-notice-of-dispute-and-refund-request',
            },
            reviewUrl: {
              type: 'string',
              format: 'uri',
              example:
                'https://docketstamp.com/notices/pre-arbitration-notice-of-dispute-and-refund-request?stage=DS-STAGE-84A19F',
            },
            missingRequiredFields: {
              type: 'array',
              items: { type: 'string' },
              example: ['senderFullName', 'requestedResolutionAmount'],
            },
            previewSummary: {
              type: 'string',
            },
            pricingTiers: {
              type: 'object',
              additionalProperties: true,
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['stageId', 'noticeSlug', 'reviewUrl', 'missingRequiredFields', 'expiresAt'],
        },
        StagedDraftRecord: {
          type: 'object',
          properties: {
            stageId: { type: 'string' },
            noticeSlug: { type: 'string' },
            noticeTitle: { type: 'string' },
            recipientId: { type: 'string' },
            recipient: { type: 'object' },
            customRecipient: { $ref: '#/components/schemas/PostalAddress' },
            sender: { $ref: '#/components/schemas/PostalAddress' },
            fieldValues: { type: 'object' },
            recommendedTier: { $ref: '#/components/schemas/MailTier' },
            missingRequiredFields: { type: 'array', items: { type: 'string' } },
            previewSummary: { type: 'string' },
            reviewUrl: { type: 'string' },
            pricingTiers: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
          required: ['stageId', 'noticeSlug', 'fieldValues', 'reviewUrl', 'createdAt', 'expiresAt'],
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string', example: 'CONFLICT_OF_INTEREST' },
            details: { type: 'object' },
          },
          required: ['error', 'code'],
        },
        JsonRpcRequest: {
          type: 'object',
          properties: {
            jsonrpc: { type: 'string', example: '2.0' },
            id: {
              oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
              example: 1,
            },
            method: {
              type: 'string',
              example: 'tools/call',
            },
            params: {
              type: 'object',
            },
          },
          required: ['jsonrpc', 'method'],
        },
        JsonRpcResponse: {
          type: 'object',
          properties: {
            jsonrpc: { type: 'string', example: '2.0' },
            id: {
              oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
            },
            result: { type: 'object' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'integer' },
                message: { type: 'string' },
                data: { type: 'object' },
              },
            },
          },
          required: ['jsonrpc'],
        },
      },
    },
  };

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
