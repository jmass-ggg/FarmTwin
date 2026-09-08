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
    status: 'coming-soon' as const,
    prerequisite:
      'This view is planned but not yet implemented in the current build.',
  },
  'crop-simulator': {
    name: 'Crop Simulator',
    icon: FlaskConical,
    phase: 'Phase 6',
    status: 'farm-required' as const,
    prerequisite:
      'A farm snapshot plus versioned crop requirements and suitability rules.',
  },
  'annual-plan': {
    name: 'Annual Crop Plan',
    icon: CalendarDays,
    phase: 'Phase 8',
    status: 'farm-required' as const,
    prerequisite:
      'Verified crop suitability outputs for the selected farm and season.',
  },
  'disaster-center': {
    name: 'Disaster Center',
    icon: ShieldAlert,
    phase: 'Phase 7',
    status: 'farm-required' as const,
    prerequisite:
      'A farm snapshot and implemented drought, flood, heat, rain, and wind rules.',
  },
  climate: {
    name: 'Climate Scenarios',
    icon: CloudSun,
    phase: 'Phase 9',
    status: 'farm-required' as const,
    prerequisite:
      'Scenario controls are available inside the Crop Simulator and Annual Crop Plan once a farm is selected.',
  },
} as const;

export default async function ToolPrerequisitePage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  if (tool === 'annual-plan' || tool === 'disaster-center' || tool === 'crop-simulator' || tool === 'climate') {
    return <FarmToolChooser tool={tool} />;
  }
  const details = tools[tool as keyof typeof tools];
  if (!details) notFound();
  const Icon = details.icon;

  if (details.status === 'coming-soon') {
    return (
      <div className="narrow-content">
        <Link className="back-link" href="/app">
          <ArrowLeft /> Back to overview
        </Link>
        <section className="workspace-card unavailable-page">
          <span className="unavailable-icon">
            <Icon />
          </span>
          <p className="section-kicker">{details.phase} · Coming soon</p>
          <h1>{details.name}</h1>
          <p className="page-lede">{details.prerequisite}</p>
          <div className="prerequisite-notice">
            <LockKeyhole />
            <span>
              <strong>Not yet implemented</strong> This feature is on the
              roadmap but has not been built in the current release.
            </span>
          </div>
          <div className="inline-actions">
            <Button variant="outline" render={<Link href="/app/project" />}>
              View roadmap
            </Button>
          </div>
        </section>
      </div>
    );
  }

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
