import {Link} from 'react-router-dom';
import React, { useState } from 'react';
import './NavBar.css';

function Navbar() {
  const [showMenu, setShowMenu] = useState(false);

  function toggleMenu() {
    setShowMenu(!showMenu);
  }

  return (
    <nav>
      <div className="logo">Logo</div>
      <ul className={showMenu ? "menu active" : "menu"}>
        <li>
            <Link to = "/">Home</Link>
        </li>
        <li>
            <Link to = "/About">About</Link>
        </li>
        <li>
            <Link to = "/Timeline">Timeline</Link>
        </li>
      </ul>
      <div className="toggle" onClick={toggleMenu}>
        <i className="fas fa-bars"></i>
      </div>
    </nav>
  );
}

export default Navbar;
