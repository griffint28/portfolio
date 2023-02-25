import './App.css';
import { BrowserRouter, Routes, Route} from 'react-router-dom';
import NavBar from './NavBar';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import TimelinePage from './pages/TimelinePage';

function App() {
  return (
    <BrowserRouter>
      <div className='App'>
        <NavBar/>
        <h1>Hey there! - Thomas Griffin (just a quick check)</h1>
        <div id = "page-body">
          <Routes>
            <Route path = "/" element = {<HomePage/>}/>
            <Route path = "/about" element = {<AboutPage/>}/>
            <Route path = "/timeline" element = {<TimelinePage/>}/>
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
