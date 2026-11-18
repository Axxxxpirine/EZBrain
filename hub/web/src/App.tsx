import { useEffect } from 'react';
import { api } from './api.ts';
import { Header, VIEW_LABEL } from './components/Header.tsx';
import { useApi, useRoute } from './hooks.ts';
import { GraphView } from './views/Graph.tsx';
import { HistoryView } from './views/History.tsx';
import { NotesView } from './views/Notes.tsx';
import { OverviewView } from './views/Overview.tsx';

const POLL = 30_000;

export function App() {
  const route = useRoute();
  const me = useApi('me', api.me);
  const overview = useApi('overview', api.overview, { poll: POLL });

  useEffect(() => {
    document.title = route.view === 'apercu' ? 'EZBrain' : `${VIEW_LABEL[route.view]} · EZBrain`;
  }, [route.view]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.view]);

  return (
    <div className={`app view-${route.view}`}>
      <Header user={me.error ? undefined : me.data?.user} view={route.view} />
      <main className="main">
        {route.view === 'apercu' && <OverviewView overview={overview} />}
        {route.view === 'notes' && <NotesView rest={route.rest} />}
        {route.view === 'carte' && <GraphView />}
        {route.view === 'historique' && <HistoryView hash={route.rest} />}
      </main>
    </div>
  );
}
