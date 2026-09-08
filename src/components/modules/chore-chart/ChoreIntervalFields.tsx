'use client';

import type { CSSProperties } from 'react';
import { useTranslate } from '@/i18n';
import type { ChoreFormState } from './form-hooks';

const inputStyle: CSSProperties = {
  width: '100%', minHeight: 44, padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--hs-border-strong)', background: 'var(--hs-bg-panel)',
  color: 'var(--hs-text-body)', fontSize: 14,
};

/** Shared by the desktop editor and phone form so both can edit the cadence. */
export default function ChoreIntervalFields({ form }: {
  form: Pick<ChoreFormState, 'intervalDays' | 'anchorDate' | 'setIntervalDays' | 'setAnchorDate'>;
}) {
  const t = useTranslate('modules');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
      <label style={{ flex: '1 1 110px', fontSize: 12, color: 'var(--hs-text-muted)' }}>
        {t('chore-chart.choreForm.intervalDaysLabel')}
        <input
          type="number" min={1} step={1} required
          value={form.intervalDays}
          onChange={(event) => form.setIntervalDays(event.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ flex: '2 1 160px', fontSize: 12, color: 'var(--hs-text-muted)' }}>
        {t('chore-chart.choreForm.anchorDateLabel')}
        <input
          type="date" required
          value={form.anchorDate}
          onChange={(event) => form.setAnchorDate(event.target.value)}
          style={inputStyle}
        />
      </label>
    </div>
  );
}
