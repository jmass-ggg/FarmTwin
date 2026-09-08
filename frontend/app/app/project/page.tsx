import {
  Check,
  CircleDashed,
  GitBranch,
  Layers3,
  LockKeyhole,
  Route,
} from 'lucide-react';

const phases = [
  {
    number: 0,
    name: 'Audit and contract freeze',
    status: 'Verified',
    note: 'Architecture, boundaries, source register, and API contract recorded.',
  },
  {
    number: 1,
    name: 'Backend and database foundation',
    status: 'Verified',
    note: 'Configuration, auth boundary, ownership, PostGIS, and read APIs tested.',
  },
  {
    number: 2,
    name: 'Conduit pipeline',
    status: 'Verified',
    note: 'Historical fixture ingestion, normalization, aggregation, provenance, and endpoints implemented.',
  },
  {
    number: 3,
    name: 'Frontend foundation',
    status: 'Implemented',
    note: 'Design system, landing, workspace routes, API states, and access rules are built; browser interaction evidence is still required for Verified.',
  },
  {
    number: 4,
    name: 'Farm selection and persistence',
    status: 'Verified',
    note: 'Global search, drawing, validation, revisions, ownership, and persistence are implemented and tested.',
  },
  {
    number: 5,
    name: 'Environmental context and twin',
    status: 'Planned',
    note: 'Requires a saved farm and source-aware snapshot infrastructure.',
  },
  {
    number: 6,
    name: 'Crop suitability and simulator',
    status: 'Planned',
    note: 'Requires versioned crop requirements and deterministic scoring.',
  },
  {
    number: 7,
    name: 'Hazards and actions',
    status: 'Implemented',
    note: 'Drought and heat screening connect to actions; flood remains explicitly unknown without terrain evidence.',
  },
  {
    number: 8,
    name: 'Annual planner',
    status: 'Implemented',
    note: 'Twelve planting periods reuse the deterministic demonstration crop-scoring engine.',
  },
  {
    number: 9,
    name: 'Climate views and scenarios',
    status: 'Implemented',
    note: 'Rainfall and temperature scenarios recalculate crop rankings without mutating the baseline.',
  },
  {
    number: 10,
    name: 'Supporting pages and connected behavior',
    status: 'Planned',
    note: 'Completes settings, sources, and cross-feature state.',
  },
  {
    number: 11,
    name: 'Validation and release preparation',
    status: 'Planned',
    note: 'Security, recovery, accessibility, and end-to-end release gates.',
  },
  {
    number: 12,
    name: 'Production deployment',
    status: 'Planned',
    note: 'Only after release gates pass and the owner authorizes the target environment.',
  },
];

export default function ProjectPage() {
  return (
    <div className="content-stack project-page">
      <header className="page-heading project-heading">
        <div>
          <p className="section-kicker">Living plan</p>
          <h1>Project & architecture</h1>
          <p>
            Implementation status is evidence-based. A polished screen does not
            imply that farm analytics are complete or agronomically validated.
          </p>
        </div>
        <span className="status-key">
          <CircleDashed /> Updated for planner & risks
        </span>
      </header>

      <section
        className="workspace-card architecture-card"
        aria-labelledby="system-flow"
      >
        <div className="card-heading-row">
          <div>
            <p className="section-kicker">System flow</p>
            <h2 id="system-flow">Evidence before decisions</h2>
          </div>
          <GitBranch />
        </div>
        <div
          className="architecture-flow"
          aria-label="Farm boundary flows through evidence and digital twin to supported decisions"
        >
          {[
            'Farm boundary',
            'Environmental evidence',
            'Versioned digital twin',
            'Supported decisions',
          ].map((label, index) => (
            <div className="flow-step" key={label}>
              <span>{index + 1}</span>
              <strong>{label}</strong>
              {index < 3 && <Route aria-hidden="true" />}
            </div>
          ))}
        </div>
        <p className="architecture-note">
          <Layers3 /> The language layer may explain verified results later; it
          never invents measurements or calculates core scores.
        </p>
      </section>

      <section aria-labelledby="roadmap-title">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Delivery roadmap</p>
            <h2 id="roadmap-title">Thirteen gated phases</h2>
          </div>
          <p>Verified means acceptance evidence exists.</p>
        </div>
        <div className="phase-list">
          {phases.map((phase) => (
            <article
              className="phase-row"
              key={phase.number}
              data-status={phase.status.toLowerCase().replace(' ', '-')}
            >
              <span className="phase-number">
                {String(phase.number).padStart(2, '0')}
              </span>
              <div>
                <h3>{phase.name}</h3>
                <p>{phase.note}</p>
              </div>
              <span className="phase-status">
                {phase.status === 'Verified' ? (
                  <Check />
                ) : phase.status === 'Implemented' ||
                  phase.status === 'In progress' ? (
                  <CircleDashed />
                ) : (
                  <LockKeyhole />
                )}
                {phase.status}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
