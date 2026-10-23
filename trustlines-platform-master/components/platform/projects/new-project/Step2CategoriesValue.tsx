'use client';

import { Check, Plus } from 'lucide-react';
import { Select } from '@/components/platform/shared/Select';
import {
  DEFAULT_CATEGORIES, SHOW_CUSTOM_CATEGORY, FieldLabel, formatThousands, sanitizeAmount,
} from './helpers';
import type { FormHandles } from './formTypes';

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺' };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <FieldLabel required>Project Categories</FieldLabel>
        <div className="np-cat-row">
          {[...DEFAULT_CATEGORIES, ...extraCats].map(cat => {
            const selected = selectedCats.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggleCat(cat)}
                className={`np-cat-chip${selected ? ' selected' : ''}`}
              >
                {selected && <Check size={16} aria-hidden />}
                {cat}
              </button>
            );
          })}
          {SHOW_CUSTOM_CATEGORY && (
            showCustomInput ? (
              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <input
                  className="form-input" style={{ width: 160 }}
                  placeholder="Category name" value={customCatInput}
                  onChange={e => setCustomCatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddCustomCat(); } }}
                  autoFocus
                />
                <button type="button" className="np-cat-chip selected" onClick={onAddCustomCat}>Add</button>
              </div>
            ) : (
              <button type="button" className="np-cat-chip dashed" onClick={() => setShowCustomInput(true)}>
                <Plus size={16} aria-hidden /> Add
              </button>
            )
          )}
        </div>
      </div>

      {selectedCats.length > 0 && (
        <div>
          <FieldLabel required>Category Estimated Values</FieldLabel>
          <div className="form-grid-2" style={{ marginBottom: 0 }}>
            {selectedCats.map(cat => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500, minWidth: 100, color: 'var(--color-secondary-700)' }}>{cat}</span>
                <input
                  className="form-input" type="text" inputMode="decimal" placeholder="Est. value"
                  aria-label={`${cat} estimated value`}
                  value={formatThousands(catValues[cat] ?? '')}
                  onChange={e => setCatValues(v => ({ ...v, [cat]: sanitizeAmount(e.target.value) }))}
                  style={{ flex: 1 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="np-value-row">
        <div style={{ width: 292, maxWidth: '100%' }}>
          <FieldLabel>Currency</FieldLabel>
          <Select className="form-input form-select" {...register('currency')}>
            <option value="USD">$ (USD)</option>
            <option value="EUR">€ (EUR)</option>
            <option value="TRY">₺ (TRY)</option>
          </Select>
        </div>
        <div style={{ width: 385, maxWidth: '100%' }}>
          <FieldLabel>Total Value</FieldLabel>
          <input
            className="form-input"
            readOnly
            aria-label="Total deal value, sum of the category values"
            title="Sum of the category estimated values"
            value={`${CURRENCY_SYMBOL[watchedCurrency] ?? watchedCurrency} ${calculatedTotal.toLocaleString('en-US')}`}
          />
        </div>
      </div>
    </div>
  );
}
