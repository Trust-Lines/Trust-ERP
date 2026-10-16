'use client';

import { Check, Plus } from 'lucide-react';
import { Select } from '@/components/platform/shared/Select';
import {
  DEFAULT_CATEGORIES, SHOW_CUSTOM_CATEGORY, FieldLabel, formatThousands, sanitizeAmount,
} from './helpers';
import type { FormHandles } from './formTypes';

export function Step2CategoriesValue({
  form, extraCats, selectedCats, onToggleCat,
  showCustomInput, setShowCustomInput, customCatInput, setCustomCatInput, onAddCustomCat,
  catValues, setCatValues, watchedCurrency, calculatedTotal,
}: {
  form: FormHandles;
  extraCats: string[];
  selectedCats: string[];
  onToggleCat: (cat: string) => void;
  showCustomInput: boolean;
  setShowCustomInput: (show: boolean) => void;
  customCatInput: string;
  setCustomCatInput: (value: string) => void;
  onAddCustomCat: () => void;
  catValues: Record<string, string>;
  setCatValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  watchedCurrency: string;
  calculatedTotal: number;
}) {
  const { register } = form;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FieldLabel required>Select Project Categories</FieldLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
        {[...DEFAULT_CATEGORIES, ...extraCats].map(cat => {
          const selected = selectedCats.includes(cat);
          return (
            <div
              key={cat}
              onClick={() => onToggleCat(cat)}
              style={{
                padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                border: `1.5px solid ${selected ? '#2563eb' : '#cbd5e1'}`,
                background: selected ? '#eff6ff' : '#ffffff',
                color: selected ? '#2563eb' : '#475569',
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}
            >
              {selected && <Check size={12} strokeWidth={3} />}
              {cat}
            </div>
          );
        })}
        {SHOW_CUSTOM_CATEGORY && (
          showCustomInput ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="form-input" style={{ width: 140, fontSize: 12, padding: '4px 8px' }}
                placeholder="Category name" value={customCatInput}
                onChange={e => setCustomCatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddCustomCat(); } }}
                autoFocus
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={onAddCustomCat}>Add</button>
            </div>
          ) : (
            <div
              onClick={() => setShowCustomInput(true)}
              style={{ padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, border: '1.5px dashed #cbd5e1', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={13} /> Add category
            </div>
          )
        )}
      </div>

      {selectedCats.length > 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 12 }}>Category Estimated Values</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {selectedCats.map(cat => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, minWidth: 100 }}>{cat}</span>
                <input
                  className="form-input" type="text" inputMode="decimal" placeholder="Est. Value"
                  value={formatThousands(catValues[cat] ?? '')}
                  onChange={e => setCatValues(v => ({ ...v, [cat]: sanitizeAmount(e.target.value) }))}
                  style={{ flex: 1, fontSize: 13 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="form-grid-2" style={{ marginTop: 12 }}>
        <div className="form-group">
          <FieldLabel>Currency</FieldLabel>
          <Select className="form-input form-select" {...register('currency')}>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="TRY">TRY — Turkish Lira</option>
          </Select>
        </div>
        <div className="form-group" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Deal Value</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
            {watchedCurrency} {calculatedTotal.toLocaleString('en-US')}
          </span>
        </div>
      </div>
    </div>
  );
}
