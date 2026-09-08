'use client';

import { CloudRain, RotateCcw, ThermometerSun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface ScenarioControlsProps {
  rainfall: number;
  temperature: number;
  busy?: boolean;
  onRainfallChange: (value: number) => void;
  onTemperatureChange: (value: number) => void;
  onApply: () => void;
  onReset: () => void;
}

export function ScenarioControls({
  rainfall,
  temperature,
  busy,
  onRainfallChange,
  onTemperatureChange,
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
        <span>Baseline stays unchanged</span>
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
