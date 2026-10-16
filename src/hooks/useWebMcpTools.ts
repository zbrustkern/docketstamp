'use client';

/**
 * useWebMcpTools Hook
 *
 * Implements Section 4.1 & 4.2 of docs/DOCKETSTAMP_AGENTIC_EXPANSION.md:
 * - Client-side hook implementing Chrome 149+ WebMCP specification (Model Context Protocol in browser)
 * - Detects navigator.modelContext?.registerTool or window.modelContext?.registerTool
 * - Registers tool `fill_docket_fields` with dynamic Notice cartridge input schema
 * - Exposes callbacks for live workspace field updates and tier adjustments
 * - Cleans up and unregisters the tool on component unmount
 */

import { useState, useEffect, useRef } from 'react';
import { NoticeTemplateDefinition, MailTierId } from '@/lib/docket/types';
import { getVerifiedRecipientById } from '@/lib/docket/data/verified-recipients';

export interface UseWebMcpToolsOptions {
  notice: NoticeTemplateDefinition;
  onUpdateValues: (fields: Record<string, string>) => void;
  onSelectTier?: (tier: MailTierId) => void;
}

export interface UseWebMcpToolsResult {
  isSupported: boolean;
  isRegistered: boolean;
  toolName: string;
}

const TOOL_NAME = 'fill_docket_fields';

export function useWebMcpTools({
  notice,
  onUpdateValues,
  onSelectTier,
}: UseWebMcpToolsOptions): UseWebMcpToolsResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const registrationRef = useRef<any>(null);

  // Keep latest callbacks in refs so the registered tool always invokes current state handlers
  const onUpdateValuesRef = useRef(onUpdateValues);
  onUpdateValuesRef.current = onUpdateValues;

  const onSelectTierRef = useRef(onSelectTier);
  onSelectTierRef.current = onSelectTier;

  useEffect(() => {
    // Check for Chrome 149+ Model Context API
    const mc =
      typeof navigator !== 'undefined' && (navigator as any).modelContext
        ? (navigator as any).modelContext
        : typeof window !== 'undefined' && (window as any).modelContext
        ? (window as any).modelContext
        : null;

    if (!mc || typeof mc.registerTool !== 'function') {
      setIsSupported(false);
      setIsRegistered(false);
      return;
    }

    setIsSupported(true);

    // Build dynamic input schema based on current notice cartridge
    const dynamicProperties: Record<string, any> = {
      recipientId: {
        type: 'string',
        description: 'Verified institutional recipient identifier (e.g. leg_wth, cra_eqf, tel_cmc).',
      },
      tier: {
        type: 'string',
        enum: ['first_class', 'certified', 'certified_return_receipt'],
        description: 'USPS mail service tier for dispatch.',
      },
      fields: {
        type: 'object',
        description: 'Key-value map of form field values to populate on the notice sheet.',
        additionalProperties: { type: 'string' },
      },
    };

    // Add explicit notice field properties for LLM tool introspection
    for (const field of notice.fields) {
      dynamicProperties[field.key] = {
        type: 'string',
        description: `${field.label} (${field.docusignTagLabel})`,
      };
    }

    // Add standard address properties
    const standardFields = [
      'senderFullName',
      'senderAddressLine1',
      'senderAddressLine2',
      'senderCity',
      'senderState',
      'senderZip',
      'recipientFormalName',
      'recipientAddressLine1',
      'recipientAddressLine2',
      'recipientCity',
      'recipientState',
      'recipientZip',
      'propertyState',
    ];

    for (const key of standardFields) {
      if (!dynamicProperties[key]) {
        dynamicProperties[key] = {
          type: 'string',
          description: `Standard field: ${key}`,
        };
      }
    }

    const toolDefinition = {
      name: TOOL_NAME,
      description: `Populate or update form fields on the active DocketStamp notice sheet for "${notice.title}".`,
      inputSchema: {
        type: 'object',
        properties: dynamicProperties,
      },
      execute: async (input: any) => {
        try {
          const updates: Record<string, string> = {};

          // Extract values from nested 'fields' property if provided
          if (input && typeof input.fields === 'object' && input.fields !== null) {
            for (const [k, v] of Object.entries(input.fields)) {
              if (typeof v === 'string') {
                updates[k] = v;
              }
            }
          }

          // Extract direct top-level field matches
          if (input && typeof input === 'object') {
            for (const [k, v] of Object.entries(input)) {
              if (k !== 'fields' && k !== 'recipientId' && k !== 'tier' && typeof v === 'string') {
                updates[k] = v;
              }
            }
          }

          // Handle recipientId resolution
          if (input?.recipientId && typeof input.recipientId === 'string') {
            const rec = getVerifiedRecipientById(input.recipientId);
            if (rec) {
              updates.recipientFormalName = rec.formalRecipientLine || rec.brandName;
              updates.recipientAddressLine1 = rec.addressLine1;
              updates.recipientCity = rec.city;
              updates.recipientState = rec.state;
              updates.recipientZip = rec.zip;
              if (notice.slug.includes('credit-bureau') || rec.category === 'credit_bureau') {
                updates.bureauEntityId = rec.id;
              }
              if (rec.recommendedTier && onSelectTierRef.current) {
                onSelectTierRef.current(rec.recommendedTier);
              }
            }
          }

          // Handle mail tier update
          if (
            input?.tier &&
            (input.tier === 'first_class' ||
              input.tier === 'certified' ||
              input.tier === 'certified_return_receipt')
          ) {
            if (onSelectTierRef.current) {
              onSelectTierRef.current(input.tier as MailTierId);
            }
          }

          // Apply updates to workspace state
          if (Object.keys(updates).length > 0) {
            onUpdateValuesRef.current(updates);
          }

          return {
            success: true,
            updatedCount: Object.keys(updates).length,
            updatedKeys: Object.keys(updates),
            message: `Successfully updated ${Object.keys(updates).length} fields on DocketStamp instrument.`,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err.message || 'Unknown error updating fields',
          };
        }
      },
      // Compatibility aliases for different WebMCP draft runner implementations
      handler: async (input: any) => {
        return (toolDefinition as any).execute(input);
      },
      run: async (input: any) => {
        return (toolDefinition as any).execute(input);
      },
    };

    try {
      const reg = mc.registerTool(toolDefinition);
      registrationRef.current = reg;
      setIsRegistered(true);
    } catch (err) {
      console.warn('[useWebMcpTools] Failed to register WebMCP tool:', err);
      setIsRegistered(false);
    }

    return () => {
      try {
        if (registrationRef.current) {
          if (typeof registrationRef.current.unregister === 'function') {
            registrationRef.current.unregister();
          } else if (typeof registrationRef.current.dispose === 'function') {
            registrationRef.current.dispose();
          }
        }
        if (mc && typeof mc.unregisterTool === 'function') {
          mc.unregisterTool(TOOL_NAME);
        }
      } catch (err) {
        console.warn('[useWebMcpTools] Failed to clean up WebMCP tool:', err);
      }
      setIsRegistered(false);
    };
  }, [notice]);

  return {
    isSupported,
    isRegistered,
    toolName: TOOL_NAME,
  };
}
