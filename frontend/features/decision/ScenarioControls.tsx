'use client';

import { CloudRain, Droplets, RotateCcw, ThermometerSun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export interface ScenarioControlsProps {
  rainfall: number;
  temperature: number;
  irrigationMm?: string;
  busy?: boolean;
  onRainfallChange: (value: number) => void;
  onTemperatureChange: (value: number) => void;
  onIrrigationChange?: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
}

export function ScenarioControls({
  rainfall,
  temperature,
  irrigationMm = '',
  busy,
  onRainfallChange,
  onTemperatureChange,
  onIrrigationChange,
  onApply,
  onReset,
}: ScenarioControlsProps) {
  const firstValue = (value: number | readonly number[]) =>
    typeof value === 'number' ? value : (value[0] ?? 0);

  return (
    <section
      className="workspace-card scenario-controls"
      aria-labelledby="scenario-title"
    >
      <div className="scenario-heading">
        <div>
          <p className="section-kicker">Climate what-if</p>
          <h2 id="scenario-title">Test a possible season</h2>
        </div>
        <span>
          {rainfall === 0 && temperature === 0 && (!irrigationMm || irrigationMm === '')
            ? 'Baseline (no changes)'
            : [
                rainfall !== 0 && `${rainfall > 0 ? '+' : ''}${rainfall}% rain`,
                temperature !== 0 && `${temperature > 0 ? '+' : ''}${temperature}°C`,
                irrigationMm && irrigationMm !== '' && `${irrigationMm} mm irrigation`,
              ]
                .filter(Boolean)
                .join(' · ')
          }
        </span>
      </div>
      <div className="scenario-control-grid">
        <div className="scenario-slider">
          <span>
            <CloudRain /> Rainfall change{' '}
            <strong>
              {rainfall > 0 ? '+' : ''}
              {rainfall}%
            </strong>
          </span>
          <Slider
            aria-label="Rainfall change percentage"
            min={-50}
            max={50}
            step={5}
            value={[rainfall]}
            onValueChange={(values) => onRainfallChange(firstValue(values))}
          />
          <small>Drier −50% · Wetter +50%</small>
        </div>
        <div className="scenario-slider">
          <span>
            <ThermometerSun /> Temperature change{' '}
            <strong>
              {temperature > 0 ? '+' : ''}
              {temperature}°C
            </strong>
          </span>
          <Slider
            aria-label="Temperature change in degrees Celsius"
            min={-5}
            max={5}
            step={0.5}
            value={[temperature]}
            onValueChange={(values) => onTemperatureChange(firstValue(values))}
          />
          <small>Cooler −5°C · Warmer +5°C</small>
        </div>
        {onIrrigationChange !== undefined && (
          <div className="scenario-input">
            <label htmlFor="scenario-irrigation-mm">
              <Droplets aria-hidden="true" /> Irrigation override{' '}
              {irrigationMm ? (
                <strong>{irrigationMm} mm</strong>
              ) : (
                <span className="scenario-input-hint">optional</span>
              )}
            </label>
            <input
              id="scenario-irrigation-mm"
              type="number"
              min="0"
              step="10"
              value={irrigationMm}
              onChange={(e) => onIrrigationChange(e.target.value)}
              placeholder="e.g. 200"
              aria-label="Irrigation override in millimetres"
            />
            <small>Override irrigation applied to the scenario (mm)</small>
          </div>
        )}
      </div>
      <div className="scenario-actions">
        <Button onClick={onApply} disabled={busy} className="primary-button">
          {busy ? 'Recalculating…' : 'Recalculate farm'}
        </Button>
        <Button onClick={onReset} disabled={busy} variant="outline">
          <RotateCcw /> Reset baseline
        </Button>
      </div>
    </section>
  );
}
