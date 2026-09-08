import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  CloudSun,
  FlaskConical,
  LockKeyhole,
  Map,
  ShieldAlert,
} from 'lucide-react';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { FarmToolChooser } from '@/features/decision/FarmToolChooser';

const tools = {
  'digital-twin': {
    name: 'Farm Digital Twin',
    icon: Map,
    phase: 'Phase 5',
    prerequisite:
      'A saved farm boundary and at least one supported environmental layer.',
  },
  'crop-simulator': {
    name: 'Crop Simulator',
    icon: FlaskConical,
    phase: 'Phase 6',
    prerequisite:
      'A farm snapshot plus versioned crop requirements and suitability rules.',
  },
  'annual-plan': {
    name: 'Annual Crop Plan',
    icon: CalendarDays,
    phase: 'Phase 8',
    prerequisite:
      'Verified crop suitability outputs for the selected farm and season.',
  },
  'disaster-center': {
    name: 'Disaster Center',
    icon: ShieldAlert,
    phase: 'Phase 7',
    prerequisite:
      'A farm snapshot and implemented drought, flood, heat, rain, and wind rules.',
  },
  climate: {
    name: 'Climate',
    icon: CloudSun,
    phase: 'Phase 9',
    prerequisite:
      'A selected farm and a source with a clearly identified forecast or outlook horizon.',
  },
} as const;

export default async function ToolPrerequisitePage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  if (tool === 'annual-plan' || tool === 'disaster-center' || tool === 'crop-simulator') {
    return <FarmToolChooser tool={tool} />;
  }
  const details = tools[tool as keyof typeof tools];
  if (!details) notFound();
  const Icon = details.icon;

  return (
    <div className="narrow-content">
      <Link className="back-link" href="/app">
        <ArrowLeft /> Back to overview
      </Link>
      <section className="workspace-card unavailable-page">
        <span className="unavailable-icon">
          <Icon />
        </span>
        <p className="section-kicker">{details.phase}</p>
        <h1>{details.name} needs a farm first</h1>
        <p className="page-lede">{details.prerequisite}</p>
        <div className="prerequisite-notice">
          <LockKeyhole />
          <span>
            <strong>Why it is locked</strong> FarmTwin does not generate
            placeholder scores or assume missing evidence is safe.
          </span>
        </div>
        <div className="inline-actions">
          <Button
            render={<Link href="/app/farms/new" />}
            className="primary-button"
          >
            Start with a farm
          </Button>
          <Button variant="outline" render={<Link href="/app/project" />}>
            View roadmap
          </Button>
        </div>
      </section>
    </div>
  );
}
