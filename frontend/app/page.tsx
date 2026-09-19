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
    copy: 'Rainfall and temperature shifts make traditional planting calendars unreliable.',
    accent: 'blue'
  },
  { 
    icon: Sprout, 
    title: 'Costly crop decisions', 
    copy: 'Every planting choice affects an entire season's yield and income.',
    accent: 'green'
  },
  { 
    icon: TriangleAlert, 
    title: 'Fast-moving hazards', 
    copy: 'Drought, floods, and extreme weather can devastate unprepared farms.',
    accent: 'red'
  },
];

const workflowSteps = [
  { 
    icon: MapPinned, 
    title: 'Select your farm', 
    copy: 'Draw your farm boundary on the map. FarmTwin validates the area and prepares for analysis.'
  },
  { 
    icon: Database, 
    title: 'Connect evidence', 
    copy: 'Satellite, weather, soil, and terrain data automatically connect to your exact location.'
  },
  { 
    icon: Layers3, 
    title: 'Build the twin', 
    copy: 'A complete environmental snapshot is created with full data provenance and quality tracking.'
  },
  { 
    icon: TrendingUp, 
    title: 'Make decisions', 
    copy: 'Compare crop options, assess risks, and plan your season with confidence.'
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
      <section className="why-section" aria-labelledby="why-title">
        <div className="section-container">
          <div className="section-header">
            <p className="section-eyebrow">Why FarmTwin</p>
            <h2 id="why-title" className="section-title">
              Farming decisions are becoming harder
            </h2>
            <p className="section-subtitle">
              Climate change is making traditional farming knowledge less reliable. 
              FarmTwin provides the environmental evidence needed to adapt.
            </p>
          </div>
          
          <div className="challenge-cards">
            {challenges.map(({ icon: Icon, title, copy, accent }) => (
              <article className="challenge-card" key={title} data-accent={accent}>
                <div className="challenge-icon-wrapper">
                  <Icon className="challenge-icon" />
                </div>
                <h3 className="challenge-title">{title}</h3>
                <p className="challenge-description">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="workflow-section" id="how-it-works" aria-labelledby="workflow-title">
        <div className="section-container">
          <div className="section-header">
            <p className="section-eyebrow">How it works</p>
            <h2 id="workflow-title" className="section-title">
              One clear path from land to action
            </h2>
          </div>
          
          <div className="workflow-steps">
            {workflowSteps.map(({ icon: Icon, title, copy }, index) => (
              <div className="workflow-step" key={title}>
                <div className="step-number">{index + 1}</div>
                <div className="step-icon-wrapper">
                  <Icon className="step-icon" />
                </div>
                <h3 className="step-title">{title}</h3>
                <p className="step-description">{copy}</p>
                {index < workflowSteps.length - 1 && (
                  <ArrowRight className="step-arrow" aria-hidden="true" />
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
