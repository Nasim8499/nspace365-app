import React, { useEffect, useState } from 'react';
import { useApp } from './lib/store';
import Shell from './components/Shell';
import Auth from './pages/Auth';
import Chat from './pages/Chat';
import Agents from './pages/Agents';
import Automations from './pages/Automations';
import Artifacts from './pages/Artifacts';
import Studio from './pages/Studio';
import Memory from './pages/Memory';
import Me from './pages/Me';
import Download from './pages/Download';
import Visa from './pages/Visa';
import Dashboard from './pages/Dashboard';
import Legal from './pages/Legal';
import Welcome from './pages/Welcome';

export default function App() {
  const { db, route } = useApp();
  const [, force] = useState(0);
  // the animated first-open welcome shows once per device, before the sign-in card
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return localStorage.getItem('nspace.intro') !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__nspaceInstall = e;
      force((n) => n + 1);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // public legal pages: linked from the Google consent screen, so they must open without a login
  const first = route.split('/').filter(Boolean)[0];
  if (first === 'privacy' || first === 'terms') return <Legal kind={first} />;

  if (!db.settings.signedIn) {
    return showIntro ? (
      <Welcome
        onDone={() => {
          try {
            localStorage.setItem('nspace.intro', '1');
          } catch {
            /* private mode */
          }
          setShowIntro(false);
        }}
      />
    ) : (
      <Auth />
    );
  }

  const seg = route.split('/').filter(Boolean);
  const page = seg[0] || 'chat';

  let body: React.ReactNode;
  if (page === 'chat') body = <Chat convId={seg[1]} />;
  else if (page === 'agents') body = <Agents />;
  else if (page === 'automations') body = <Automations />;
  else if (page === 'artifacts') body = <Artifacts />;
  else if (page === 'studio') body = <Studio id={seg[1] || 'new'} />;
  else if (page === 'memory') body = <Memory />;
  else if (page === 'me') body = <Me />;
  else if (page === 'download') body = <Download />;
  else if (page === 'visa') body = <Visa caseId={seg[1]} />;
  else if (page === 'dashboard') body = <Dashboard />;
  else if (page === 'chat') body = <Chat convId={seg[1]} />;
  else body = <Dashboard />;

  return <Shell>{body}</Shell>;
}
