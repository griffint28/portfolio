import TransitMap from './components/TransitMap';
import RouteEditor from './components/RouteEditor';

function App() {
  const isEdit = new URLSearchParams(window.location.search).get('edit') === '1';
  return isEdit ? <RouteEditor /> : <TransitMap />;
}

export default App;
