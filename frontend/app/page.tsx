'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
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
  Sparkles,
  Sprout,
  TriangleAlert,
  TrendingUp,
  X,
} from 'lucide-react';

import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';

const challenges = [
  { 
    icon: CloudRain, 
    title: 'Changing climate patterns', 
    copy: 'Rainfall and temperature are becoming harder to plan around.',
    accent: 'blue'
  },
  { 
    icon: Sprout, 
    title: 'Costly crop decisions', 
    copy: 'A poor crop or planting-window choice can affect an entire growing season.',
    accent: 'amber'
  },
  { 
    icon: TriangleAlert, 
    title: 'Fast-moving hazards', 
    copy: 'Drought, floods, heat, and heavy rainfall can damage farms quickly.',
    accent: 'red'
  },
];

const workflowSteps = [
  { 
    icon: MapPinned, 
    title: 'Select your farm', 
    copy: 'Draw and validate the exact boundary.'
  },
  { 
    icon: Database, 
    title: 'Connect evidence', 
    copy: 'Check coverage, time, quality, and source.'
  },
  { 
    icon: Layers3, 
    title: 'Build the twin', 
    copy: 'Create a versioned environmental snapshot.'
  },
  { 
    icon: TrendingUp, 
    title: 'Make a decision', 
    copy: 'Compare explained results and useful actions.'
  },
];

const features = [
  { 
    icon: Layers3, 
    title: 'Farm Digital Twin', 
    copy: 'Comprehensive environmental profile combining terrain, soil, climate, satellite vegetation analysis, and real-time weather.',
    color: 'emerald'
  },
  { 
    icon: FlaskConical, 
    title: 'Crop Simulator', 
    copy: 'Evidence-based crop recommendations with transparent suitability scoring and limiting factor analysis.',
    color: 'blue'
  },
  { 
    icon: CalendarDays, 
    title: 'Annual Crop Plan', 
    copy: 'Optimized 12-month planting calendar aligned with rainfall seasons and crop rotation best practices.',
    color: 'violet'
  },
  { 
    icon: ShieldAlert, 
    title: 'Disaster Center', 
    copy: 'Real-time drought, flood, and heat stress monitoring with practical mitigation actions.',
    color: 'amber'
  },
  { 
    icon: CloudSun, 
    title: 'Climate Overview', 
    copy: 'Current conditions, 7-day forecasts, and historical climate patterns in one clear dashboard.',
    color: 'sky'
  },
];

const dataSources = [
  { icon: Database, name: 'Conduit', desc: 'Local stations' },
  { icon: Layers3, name: 'Satellite', desc: 'Sentinel-2' },
  { icon: Sprout, name: 'Soil', desc: 'SoilGrids' },
  { icon: Mountain, name: 'Terrain', desc: 'Elevation' },
  { icon: CloudSun, name: 'Weather', desc: 'Open-Meteo' },
];

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="redesigned-landing">
      {/* Premium Sticky Navigation */}
      <header className={`redesigned-nav ${isScrolled ? 'scrolled' : ''}`}>
        <div className="redesigned-nav-container">
          <Brand />
          
          <nav className="redesigned-nav-center" aria-label="Main navigation">
            <a href="/">Home</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#features">Features</a>
            <Link href="/app/data-sources">About Data</Link>
          </nav>
          
          <div className="redesigned-nav-actions">
            <Button size="lg" render={<Link href="/app" />} className="redesigned-cta-button">
              Start Farm Analysis
            </Button>
            
            <button 
              aria-label="Open navigation menu" 
              className="mobile-menu-button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="mobile-menu">
            <nav className="mobile-nav-links">
              <a href="/" onClick={() => setMobileMenuOpen(false)}>Home</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <Link href="/app/data-sources" onClick={() => setMobileMenuOpen(false)}>About Data</Link>
            </nav>
            <Button size="lg" render={<Link href="/app" />} className="redesigned-cta-button mobile-cta">
              Start Farm Analysis
            </Button>
          </div>
        )}
      </header>

      {/* Premium Hero Section */}
      <section className="redesigned-hero" aria-labelledby="hero-title">
        <div className="redesigned-hero-container">
          <div className="redesigned-hero-content">
            <div className="redesigned-hero-badge">
              <span>Climate-smart farm planning</span>
            </div>
            
            <h1 id="hero-title" className="redesigned-hero-heading">
              Understand your farm<br />before you plant.
            </h1>
            
            <p className="redesigned-hero-description">
              Draw your farm boundary, connect environmental evidence, and understand your land before making a planting decision.
            </p>
            
            <div className="redesigned-hero-actions">
              <Button size="lg" render={<Link href="/app" />} className="redesigned-primary-button">
                Start Farm Analysis
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/#how-it-works" />} className="redesigned-secondary-button">
                See how it works
              </Button>
            </div>
            
            <p className="redesigned-trust-line">
              <ShieldCheck aria-hidden="true" />
              <span>Unknown data stays unknown. No invented farm readings.</span>
            </p>
          </div>

          <div className="redesigned-hero-visual">
            <div className="redesigned-visual-card">
              <div className="visual-image-wrapper">
                <Image
                  src="/farmtwin-kenya-aerial.png"
                  alt="Aerial view of agricultural fields showing farm boundaries"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 55vw"
                  className="visual-image"
                />
              </div>
              
              <div className="visual-overlay" aria-hidden="true">
                <svg viewBox="0 0 520 360" preserveAspectRatio="none">
                  <polygon points="115,112 352,78 430,237 276,306 82,245" />
                  {[
                    ['115', '112'], ['352', '78'], ['430', '237'], ['276', '306'], ['82', '245'],
                  ].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" />)}
                </svg>
              </div>
              
              <div className="visual-label visual-label-top">
                <span className="label-dot"></span>
                <span>Boundary preview</span>
              </div>
              
              <div className="visual-label visual-label-right">
                <span className="label-dot"></span>
                <span>Evidence connects here</span>
              </div>
              
              <div className="visual-caption">
                Illustrative preview · no live readings
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why FarmTwin Section */}
      <section className="redesigned-why-section" aria-labelledby="why-title">
        <div className="redesigned-section-container">
          <div className="redesigned-section-header">
            <p className="redesigned-eyebrow">WHY FARMTWIN</p>
            <h2 id="why-title" className="redesigned-section-heading">
              Farming decisions<br />are becoming harder
            </h2>
            <p className="redesigned-section-description">
              FarmTwin is designed to show the evidence behind a decision before the growing season is at risk.
            </p>
          </div>
          
          <div className="redesigned-problem-cards">
            {challenges.map(({ icon: Icon, title, copy, accent }) => (
              <article className="redesigned-problem-card" key={title} data-accent={accent}>
                <div className="redesigned-card-icon">
                  <Icon />
                </div>
                <h3 className="redesigned-card-title">{title}</h3>
                <p className="redesigned-card-description">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="redesigned-how-section" id="how-it-works" aria-labelledby="workflow-title">
        <div className="redesigned-section-container">
          <div className="redesigned-section-header">
            <p className="redesigned-eyebrow">HOW IT WORKS</p>
            <h2 id="workflow-title" className="redesigned-section-heading">
              One clear path from land to action
            </h2>
          </div>
          
          <div className="redesigned-workflow-steps">
            {workflowSteps.map(({ icon: Icon, title, copy }, index) => (
              <div className="redesigned-workflow-step" key={title}>
                <div className="redesigned-step-badge">{index + 1}</div>
                <div className="redesigned-step-icon">
                  <Icon />
                </div>
                <h3 className="redesigned-step-title">{title}</h3>
                <p className="redesigned-step-description">{copy}</p>
                {index < workflowSteps.length - 1 && (
                  <ArrowRight className="redesigned-step-connector" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features" aria-labelledby="features-title">
        <div className="section-container">
          <div className="section-header">
            <p className="section-eyebrow">Capabilities</p>
            <h2 id="features-title" className="section-title">
              Everything you need to farm smarter
            </h2>
            <p className="section-subtitle">
              Comprehensive tools for crop planning, risk management, and climate adaptation—all grounded in real environmental data.
            </p>
          </div>
          
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, copy, color }) => (
              <article className="feature-card" key={title} data-color={color}>
                <div className="feature-icon-wrapper">
                  <Icon className="feature-icon" />
                </div>
                <h3 className="feature-title">{title}</h3>
                <p className="feature-description">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="sources-section" aria-labelledby="sources-title">
        <div className="section-container">
          <div className="section-header">
            <p className="section-eyebrow">Environmental evidence</p>
            <h2 id="sources-title" className="section-title">
              Built to preserve provenance
            </h2>
            <p className="section-subtitle">
              Every result retains its provider, timestamp, quality status, and geographic relevance. 
              Unknown data stays unknown—no fabricated readings.
            </p>
          </div>
          
          <div className="data-source-badges">
            {dataSources.map(({ icon: Icon, name, desc }) => (
              <div className="source-badge" key={name}>
                <Icon className="source-icon" />
                <div className="source-info">
                  <span className="source-name">{name}</span>
                  <span className="source-desc">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="final-cta-section">
        <div className="cta-container">
          <div className="cta-content">
            <p className="cta-eyebrow">Start with what's real</p>
            <h2 className="cta-heading">
              Understand your farm before risking a season.
            </h2>
          </div>
          <Button size="lg" render={<Link href="/app" />} className="cta-action-button">
            Open the workspace
            <ArrowRight />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="premium-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <Brand />
            <p className="footer-tagline">Climate-smart farm planning</p>
          </div>
          <nav className="footer-nav" aria-label="Footer navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <Link href="/app/data-sources">Data sources</Link>
            <Link href="/app/project">Project</Link>
          </nav>
          <p className="footer-copyright">© 2024 FarmTwin. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
