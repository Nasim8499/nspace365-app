import React from 'react';
import { useApp } from '../lib/store';
import { Monogram, Wordmark } from '../components/Logo';
import { ADMIN_EMAIL } from '../lib/seed';

const SECTIONS: Record<'privacy' | 'terms', { title: string; blocks: [string, string][] }> = {
  privacy: {
    title: 'Privacy Policy',
    blocks: [
      [
        'What we collect',
        'When you sign in we keep your name, email address and the role you chose (applicant or agency admin). When you submit a visa case we store the passport data you upload, the documents and the case notes you add.',
      ],
      [
        'Where it is stored',
        'Case data and chat history stay in this app on the device you use, under your browser storage. If the workspace is connected to the agency database, the same records are synced to the agency account that owns the workspace.',
      ],
      [
        'Sign in with Google',
        'Google sign-in shares your name, email address and profile picture with us. We never receive your Google password. The Google token is read in your browser and is not stored on a server.',
      ],
      [
        'Model providers',
        'If an AI provider key is configured, the text you send in a chat or case is forwarded to that provider so it can answer. Without a key the assistant runs on the built-in on-device engine and nothing leaves the browser.',
      ],
      [
        'Your choices',
        'You can delete a case, a conversation or a memory from the app at any time, or sign out and clear the site data to remove everything stored on the device. Agency staff can remove an applicant record from the dashboard.',
      ],
      [
        'Contact',
        `Questions about this policy: ${ADMIN_EMAIL}.`,
      ],
    ],
  },
  terms: {
    title: 'Terms of Service',
    blocks: [
      [
        'The service',
        'NsPace is an AI workspace for visa agencies and their applicants: an assistant, agent automations, document generation and a visa case dashboard.',
      ],
      [
        'Your account',
        'You are responsible for the accuracy of the details you enter and for keeping your sign-in method secure. Agency admin access is limited to staff the agency authorises.',
      ],
      [
        'Immigration advice',
        'The app prepares documents, checks passport validity and drafts supporting letters. It is not a law firm and does not provide legal advice. A licensed agency reviewer approves every application before it is submitted to an embassy or portal.',
      ],
      [
        'Payments to authorities',
        'Embassy fees and any government charges are paid by you on the official portal. The app deliberately stops before final submission so a human approves it.',
      ],
      [
        'Generated documents',
        'You keep ownership of the content you upload and the documents generated for your case. We may keep a copy inside your account so agency staff can review it.',
      ],
      [
        'Contact',
        `Questions about these terms: ${ADMIN_EMAIL}.`,
      ],
    ],
  },
};

export default function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  const { navigate, db } = useApp();
  const doc = SECTIONS[kind];
  return (
    <div className="legalwrap">
      <div className="glass legalcard">
        <div className="legalhead">
          <Monogram size={44} />
          <Wordmark size={22} />
        </div>
        <h1 className="h1" style={{ marginTop: 14 }}>{doc.title}</h1>
        <p className="sub" style={{ marginTop: 0 }}>
          Last updated 13 November 2026 · NsPace (VisaMOTion 365)
        </p>
        {doc.blocks.map(([h, body]) => (
          <section key={h} style={{ marginTop: 18 }}>
            <h2 className="h2" style={{ margin: '0 0 6px' }}>{h}</h2>
            <p className="hint" style={{ lineHeight: 1.65, margin: 0 }}>{body}</p>
          </section>
        ))}
        <div className="row" style={{ gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={() => navigate(kind === 'privacy' ? '/terms' : '/privacy')}>
            {kind === 'privacy' ? 'Terms of Service' : 'Privacy Policy'}
          </button>
          {db.settings.signedIn && (
            <button className="btn sm primary" onClick={() => navigate('/dashboard')}>Back to the app</button>
          )}
        </div>
      </div>
    </div>
  );
}
