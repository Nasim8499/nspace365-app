import React, { useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';

interface Team {
  name: string;
  cat: string;
  icon: string;
  desc: string;
  agents: string[];
}

export const TEAMS: Team[] = [
  {
    name: 'Full-Stack Delivery Guild',
    cat: 'Engineering',
    icon: 'cpu',
    desc: 'A recurring Engineering & AI Delivery workflow that ships, reviews and reports.',
    agents: ['Delivery Lead', 'Backend Engineer', 'QA Engineer'],
  },
  {
    name: 'Product Launch War Room',
    cat: 'Product',
    icon: 'rocket',
    desc: 'A recurring Product & Launch workflow from spec to go-live checklist.',
    agents: ['Product Lead', 'Researcher', 'Launch Manager'],
  },
  {
    name: 'SEO & AEO Content Studio',
    cat: 'Marketing',
    icon: 'globe',
    desc: 'A recurring Growth & Organic Content workflow with brief, draft and audit.',
    agents: ['SEO Strategist', 'Writer', 'Auditor'],
  },
  {
    name: 'Security Operations Room',
    cat: 'IT & Security',
    icon: 'shield',
    desc: 'A recurring Security, QA & Reliability workflow with triage and postmortems.',
    agents: ['Security Lead', 'SRE', 'Analyst'],
  },
  {
    name: 'Financial Planning Room',
    cat: 'Finance',
    icon: 'doc',
    desc: 'A recurring Finance & Executive Ops workflow for forecasts and variance.',
    agents: ['FP&A Lead', 'Analyst', 'Reporter'],
  },
  {
    name: 'Customer Health Room',
    cat: 'Support',
    icon: 'users',
    desc: 'A recurring Customer Success & Service Ops workflow across every account.',
    agents: ['CS Lead', 'Support Agent', 'Researcher'],
  },
  {
    name: 'B2B Deal Room',
    cat: 'Sales',
    icon: 'star',
    desc: 'A recurring Sales & Revenue workflow: research, outreach and follow-up.',
    agents: ['Account Exec', 'Researcher', 'SDR'],
  },
  {
    name: 'Paid Search & Social Desk',
    cat: 'Marketing',
    icon: 'bolt',
    desc: 'A recurring Paid Acquisition & Commerce workflow with spend guardrails.',
    agents: ['Media Buyer', 'Copywriter', 'Analyst'],
  },
  {
    name: 'Design Review Studio',
    cat: 'Design',
    icon: 'image',
    desc: 'A recurring Design & Creative workflow: critique, iterate and hand off.',
    agents: ['Design Lead', 'Critic', 'Prototyper'],
  },
  {
    name: 'Hiring Pipeline Room',
    cat: 'Recruiting',
    icon: 'user',
    desc: 'A recurring People, Recruiting & Learning workflow from JD to offer.',
    agents: ['Recruiter', 'Sourcer', 'Hiring Manager'],
  },
  {
    name: 'Contract Review Room',
    cat: 'Legal',
    icon: 'stamp',
    desc: 'A recurring Legal, Compliance & Trust workflow with redline summaries.',
    agents: ['Counsel', 'Paralegal', 'Compliance Lead'],
  },
  {
    name: 'Game Prototype Studio',
    cat: 'Engineering',
    icon: 'play',
    desc: 'A recurring Game, XR & Immersive Worlds workflow from concept to build.',
    agents: ['Game Designer', 'Engineer', 'Artist'],
  },
  {
    name: 'Support Triage Desk',
    cat: 'Support',
    icon: 'phone',
    desc: 'A recurring Customer Success workflow that routes every ticket correctly.',
    agents: ['Triage Lead', 'Support Agent', 'Knowledge Editor'],
  },
  {
    name: 'Short Video Growth Studio',
    cat: 'Content',
    icon: 'video',
    desc: 'A recurring Growth & Organic Content workflow for hooks, scripts and cuts.',
    agents: ['Creative Director', 'Scriptwriter', 'Editor'],
  },
  {
    name: 'Tender & Bid Room',
    cat: 'Sales',
    icon: 'doc',
    desc: 'A recurring Sales workflow that reads tenders and drafts compliant bids.',
    agents: ['Bid Manager', 'Compliance Lead', 'Writer'],
  },
];

export default function Discover() {
  const { db, addAgent, navigate, toast } = useApp();
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');

  const cats = useMemo(() => ['All', ...Array.from(new Set(TEAMS.map((t) => t.cat)))], []);
  const list = TEAMS.filter(
    (t) =>
      (cat === 'All' || t.cat === cat) &&
      (!q ||
        t.name.toLowerCase().includes(q.toLowerCase()) ||
        t.desc.toLowerCase().includes(q.toLowerCase()))
  );

  const create = (t: Team) => {
    t.agents.forEach((name) =>
      addAgent({
        name,
        tagline: `${t.cat} · part of ${t.name}`,
        system: `You are the ${name} in the ${t.name}. ${t.desc} Answer with concrete, checkable steps and flag anything that needs a human decision.`,
        category: t.cat,
        model: 'auto',
      })
    );
    toast(`${t.agents.length} agents added to your workspace`);
    navigate('/agents');
  };

  return (
    <div className="page">
      <div className="pagehead">
        <div className="col" style={{ flex: 1 }}>
          <h1 className="h1">Discover</h1>
          <div className="sub" style={{ marginTop: 3 }}>
            Agent teams that already know the work. One tap adds every member.
          </div>
        </div>
        <div className="search" style={{ width: 250 }}>
          <Icon name="search" size={14} />
          <input
            className="input"
            placeholder="Search agent teams…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="pagebody scroll">
        <div className="pills" style={{ marginBottom: 14 }}>
          {cats.map((c) => (
            <button key={c} className={`pill${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="teamgrid">
          {list.map((t) => (
            <div className="card teamcard" key={t.name}>
              <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span className="teamico">
                  <Icon name={t.icon} size={17} />
                </span>
                <div className="col" style={{ flex: 1, minWidth: 0 }}>
                  <div className="teamcat">{t.cat}</div>
                  <div className="teamname">{t.name}</div>
                </div>
              </div>
              <div className="teamdesc">{t.desc}</div>
              <div className="row" style={{ marginTop: 'auto', gap: 8 }}>
                <div className="teamavas">
                  {t.agents.slice(0, 3).map((a, i) => (
                    <span key={a} className="teamava" style={{ zIndex: 3 - i }}>
                      {a[0]}
                    </span>
                  ))}
                  <span className="teamava more">+{t.agents.length}</span>
                </div>
                <div className="grow" />
                <button className="btn sm primary" onClick={() => create(t)}>
                  <Icon name="plus" size={13} /> Create
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="hint" style={{ marginTop: 16 }}>
          {db.agents.length} agents already in your workspace.
        </div>
      </div>
    </div>
  );
}
