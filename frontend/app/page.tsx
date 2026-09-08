import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  CloudRain,
  CloudSun,
  Database,
  FlaskConical,
  Layers3,
  Leaf,
  MapPinned,
  Menu,
  Mountain,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  TriangleAlert,
} from 'lucide-react';

import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';

const challenges = [
  { icon: CloudRain, title: 'Changing climate patterns', copy: 'Rainfall and temperature are becoming harder to plan around.' },
  { icon: Sprout, title: 'Costly crop decisions', copy: 'A poor crop or planting-window choice can affect a whole season.' },
  { icon: TriangleAlert, title: 'Fast-moving hazards', copy: 'Drought, floods, heat, and heavy rain can damage farms quickly.' },
];

const capabilities = [
  { icon: Layers3, title: 'Farm Digital Twin', copy: 'Bring farm shape, terrain, vegetation, climate, water, and soil evidence into one source-aware view.', phase: 'Phases 4–5' },
  { icon: FlaskConical, title: 'Crop Simulator', copy: 'Compare crops and planting choices using deterministic, explained suitability rules.', phase: 'Phase 6' },
  { icon: CalendarDays, title: 'Annual Crop Plan', copy: 'Turn supported seasonal options into a farmer-controlled twelve-month plan.', phase: 'Phase 8' },
  { icon: ShieldAlert, title: 'Disaster Center', copy: 'Understand hazard drivers and practical actions without treating unknown data as low risk.', phase: 'Phase 7' },
  { icon: CloudSun, title: 'Climate Overview', copy: 'Keep current observations, forecasts, seasonal outlooks, and scenarios clearly separated.', phase: 'Phase 9' },
];

export default function Home() {
  return (
    <main className="marketing-page">
      <header className="marketing-header">
        <div className="marketing-nav page-width">
          <Brand />
          <nav className="desktop-marketing-links" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#capabilities">Capabilities</a>
            <Link href="/app/project">Project & architecture</Link>
          </nav>
          <div className="header-actions">
            <span className="demo-badge"><span aria-hidden="true" /> Preview · non-live</span>
            <Button size="lg" render={<Link href="/app" />} className="primary-button header-cta">
              Open workspace
            </Button>
            <Button aria-label="Open workspace navigation" variant="outline" size="icon-lg" render={<Link href="/app" />} className="mobile-menu-button">
              <Menu />
            </Button>
          </div>
        </div>
      </header>

      <section className="hero page-width" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><Leaf /> Climate-smart farm planning</p>
          <h1 id="hero-title">Understand your farm before you plant.</h1>
          <p className="hero-lede">
            Draw your farm boundary, connect environmental evidence, and see what is known,
            missing, or ready for a decision.
          </p>
          <div className="hero-actions">
            <Button size="lg" render={<Link href="/app" />} className="primary-button">
              Start farm analysis <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/#how-it-works" />} className="secondary-button">
              See how it works
            </Button>
          </div>
          <p className="trust-note">
            <ShieldCheck aria-hidden="true" /> Unknown data stays unknown. No invented farm readings.
          </p>
        </div>

        <div className="hero-visual">
          <Image
            src="/farmtwin-kenya-aerial.png"
            alt="Aerial view of cultivated fields in the Kenyan highlands"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 50vw"
          />
          <div className="boundary-preview" aria-hidden="true">
            <svg viewBox="0 0 520 360" preserveAspectRatio="none">
              <polygon points="115,112 352,78 430,237 276,306 82,245" />
              {[
                ['115', '112'], ['352', '78'], ['430', '237'], ['276', '306'], ['82', '245'],
              ].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" />)}
            </svg>
          </div>
          <span className="visual-chip chip-top">Boundary preview</span>
          <span className="visual-chip chip-bottom">Evidence connects here</span>
          <p className="visual-caption">Illustrative preview · no live readings</p>
        </div>
      </section>

      <section className="challenge-section" aria-labelledby="challenges-title">
        <div className="page-width">
          <div className="centered-heading">
            <p className="section-kicker">Why FarmTwin</p>
            <h2 id="challenges-title">Farming decisions are becoming harder</h2>
            <p>FarmTwin is designed to show the evidence behind a decision before the growing season is at risk.</p>
          </div>
          <div className="challenge-grid">
            {challenges.map(({ icon: Icon, title, copy }) => (
              <article className="marketing-card" key={title}>
                <span className="marketing-icon"><Icon /></span>
                <h3>{title}</h3><p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="how-section page-width" id="how-it-works" aria-labelledby="how-title">
        <div className="centered-heading">
          <p className="section-kicker">How it works</p>
          <h2 id="how-title">One clear path from land to action</h2>
        </div>
        <ol className="process-grid">
          {[
            { icon: MapPinned, title: 'Select your farm', copy: 'Draw and validate the exact boundary.' },
            { icon: Database, title: 'Connect evidence', copy: 'Check coverage, time, quality, and source.' },
            { icon: Layers3, title: 'Build the twin', copy: 'Create a versioned environmental snapshot.' },
            { icon: ShieldCheck, title: 'Make a decision', copy: 'Compare explained results and useful actions.' },
          ].map(({ icon: Icon, title, copy }, index) => (
            <li key={title}>
              <span className="process-number">{index + 1}</span>
              <span className="process-icon"><Icon /></span>
              <h3>{title}</h3><p>{copy}</p>
              {index < 3 && <ArrowRight className="process-arrow" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </section>

      <section className="capability-section" id="capabilities" aria-labelledby="capabilities-title">
        <div className="page-width">
          <div className="centered-heading">
            <p className="section-kicker">Planned workspace</p>
            <h2 id="capabilities-title">Everything needs evidence and a gate</h2>
            <p>Unavailable tools stay visible, name their phase, and explain what must exist before they open.</p>
          </div>
          <div className="capability-grid">
            {capabilities.map(({ icon: Icon, title, copy, phase }) => (
              <article className="marketing-card capability-card" key={title}>
                <div className="capability-card-top"><span className="marketing-icon"><Icon /></span><span>{phase}</span></div>
                <h3>{title}</h3><p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sources-section page-width" aria-labelledby="sources-title">
        <div className="centered-heading">
          <p className="section-kicker">Environmental evidence</p>
          <h2 id="sources-title">Built to preserve provenance</h2>
          <p>Every result must retain its provider, timestamp, data mode, quality, and geographic relevance.</p>
        </div>
        <div className="source-chip-row" aria-label="Planned environmental source types">
          <span><Database /> Conduit</span><span><Layers3 /> Satellite</span><span><Sprout /> Soil</span><span><Mountain /> Terrain</span><span><CloudSun /> Weather</span>
        </div>
      </section>

      <section className="marketing-cta">
        <div className="page-width">
          <div><p className="section-kicker">Start with what is real</p><h2>Understand your farm before risking a season.</h2></div>
          <Button size="lg" render={<Link href="/app" />} className="cta-button">Open the workspace <ArrowRight /></Button>
        </div>
      </section>

      <footer className="marketing-footer">
        <div className="page-width">
          <Brand />
          <nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#capabilities">Capabilities</a><Link href="/app/data-sources">Data sources</Link><Link href="/app/project">Project</Link></nav>
          <p>FarmTwin · Climate-smart farm planning</p>
        </div>
      </footer>
    </main>
  );
}
