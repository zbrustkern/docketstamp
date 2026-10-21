'use client';
import React, { useId } from 'react';
import { US_STATE_CODES, type PublicTemplateAvailability } from '@/src/lib/docket/template-policy';
import { STATE_STATUTES } from '@/src/lib/docket/data/state-statutes';

type Props = {
  availability: PublicTemplateAvailability;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  light?: boolean;
};

/** These declarations control service availability; they are not mailing addresses. */
export function TemplateLocationFields({ availability, values, onChange, light = false }: Props) {
  const id = useId();
  const fields = [
    ...(availability.requiresResidence ? [{ key: 'consumerResidenceState', label: 'State where you live', help: 'Your residence may differ from your mailing address.' }] : []),
    ...(availability.requiresProperty ? [{ key: 'propertyState', label: 'State where the rental property is located', help: 'Use the property’s state, which may differ from your landlord’s address.' }] : []),
  ];
  return <div className="space-y-4">{fields.map(field => <div key={field.key}>
    <label htmlFor={`${id}-${field.key}`} className="block text-sm font-semibold">{field.label}</label>
    <select id={`${id}-${field.key}`} value={values[field.key] || ''} onChange={event => onChange(field.key, event.target.value)} aria-describedby={`${id}-${field.key}-help`} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 ${light ? 'border-stone-300 bg-white text-stone-900' : 'border-slate-600 bg-slate-800 text-white'}`}>
      <option value="">Choose a state</option>
      {US_STATE_CODES.map(code => <option key={code} value={code}>{STATE_STATUTES[code]?.stateName || code}</option>)}
    </select>
    <p id={`${id}-${field.key}-help`} className={`mt-1 text-xs ${light ? 'text-stone-600' : 'text-slate-400'}`}>{field.help}</p>
  </div>)}</div>;
}
