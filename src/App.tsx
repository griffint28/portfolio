import TransitMap from './components/TransitMap';
import RouteEditor from './components/RouteEditor';
import ThemeEditor from './components/ThemeEditor';

/* Two dev tools hang off query params, neither reachable from the site itself:
   ?edit=1  — hand-place the lines and stations (RouteEditor)
   ?theme=1 — tune the map palette against the real map (ThemeEditor) */
function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('edit') === '1') return <RouteEditor />;
  if (params.get('theme') === '1') return <ThemeEditor />;
  return <TransitMap />;
}

export default App;
