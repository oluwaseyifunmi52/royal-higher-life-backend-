import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mobileMenuRef = useRef(null);
  const previousActiveElement = useRef(null);

  const handleLogout = () => {
    logoutUser();
    navigate('/');
    setMobileOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileOpen(false);
    if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  };

  const openMobileMenu = () => {
    previousActiveElement.current = document.activeElement;
    setMobileOpen(true);
  };

  const toggleMobileMenu = () => {
    if (mobileOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileOpen) {
        closeMobileMenu();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      const focusableElements = mobileMenuRef.current?.querySelectorAll(
        'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements?.length) {
        setTimeout(() => focusableElements[0].focus(), 0);
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/leadership', label: 'Leadership' },
    { to: '/sermons', label: 'Sermons' },
    { to: '/events', label: 'Events' },
    { to: '/gallery', label: 'Gallery' },
    { to: '/ministries', label: 'Ministries' },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <header
      className={`sticky top-0 z-[var(--z-sticky)] transition-all duration-200 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-sm shadow-md border-b border-navy-100'
          : 'bg-white border-b border-navy-100'
      }`}
      role="banner"
    >
      <div className="container-custom">
        <div className="flex items-center justify-between h-16 lg:h-18">
          <Link
            to="/"
            className="flex items-center gap-3 text-navy-900 font-display font-bold text-xl lg:text-2xl hover:opacity-80 transition-opacity"
            aria-label="Royal HigherLife Christian Ministries - Home"
          >
            <span className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-navy-900 flex items-center justify-center text-white font-display font-bold text-lg lg:text-xl">
              RH
            </span>
            <span className="hidden sm:block">Royal HigherLife</span>
          </Link>

          <nav className="hidden lg:flex lg:items-center lg:gap-8" aria-label="Main navigation">
            <ul className="flex items-center gap-6" role="menubar">
              {navLinks.map((link) => (
                <li key={link.to} role="none">
                  <NavLink
                    to={link.to}
                    role="menuitem"
                    className={({ isActive }) =>
                      `font-medium text-body-sm lg:text-body transition-colors duration-200 ${
                        isActive
                          ? 'text-gold-600 font-semibold'
                          : 'text-navy-600 hover:text-gold-600'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden lg:flex lg:items-center lg:gap-4">
            <Link
              to="/donate"
              className="px-5 py-2.5 lg:px-6 lg:py-3 bg-gold-500 text-white font-semibold text-body-sm lg:text-body rounded-xl hover:bg-gold-600 hover:shadow-gold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
              aria-label="Give / Donate"
            >
              Give
            </Link>
            <div className="hidden lg:flex lg:items-center lg:gap-3">
              {user ? (
                <>
                  <NavLink
                    to="/dashboard"
                    className="text-body-sm text-navy-600 hover:text-gold-600 font-medium transition-colors"
                  >
                    Dashboard
                  </NavLink>
                  {user.role === 'admin' && (
                    <NavLink
                      to="/admin"
                      className="px-4 py-2 text-body-sm bg-navy-100 text-navy-700 font-medium rounded-xl hover:bg-navy-200 transition-colors"
                    >
                      Admin
                    </NavLink>
                  )}
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-body-sm bg-navy-900 text-white font-medium rounded-xl hover:bg-navy-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-5 py-2.5 lg:px-6 lg:py-3 bg-navy-900 text-white font-semibold text-body-sm lg:text-body rounded-xl hover:bg-navy-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
                >
                  Login
                </Link>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleMobileMenu}
            className="lg:hidden p-2.5 rounded-xl text-navy-600 hover:bg-navy-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {mobileOpen && (
          <div
            ref={mobileMenuRef}
            id="mobile-menu"
            className="lg:hidden animate-slide-down border-t border-navy-100 bg-white px-4 pb-6 pt-4"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <nav aria-label="Mobile main navigation">
              <ul className="space-y-1" role="menubar">
                {navLinks.map((link) => (
                  <li key={link.to} role="none">
                    <NavLink
                      to={link.to}
                      role="menuitem"
                      onClick={closeMobileMenu}
                      className={({ isActive }) =>
                        `block px-3 py-3 rounded-xl text-body font-medium transition-colors duration-200 ${
                          isActive
                            ? 'bg-gold-50 text-gold-700 font-semibold'
                            : 'text-navy-600 hover:bg-navy-50 hover:text-gold-600'
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-6 border-t border-navy-100 pt-6 space-y-3">
              {!user ? (
                <Link
                  to="/login"
                  onClick={closeMobileMenu}
                  className="block w-full text-center px-4 py-3 bg-navy-900 text-white font-semibold text-body rounded-xl hover:bg-navy-800 transition-colors"
                >
                  Login
                </Link>
              ) : (
                <>
                  <NavLink
                    to="/dashboard"
                    onClick={closeMobileMenu}
                    className="block w-full text-center px-4 py-3 text-navy-600 hover:bg-navy-50 hover:text-gold-600 font-medium text-body rounded-xl transition-colors"
                  >
                    Dashboard
                  </NavLink>
                  {user.role === 'admin' && (
                    <NavLink
                      to="/admin"
                      onClick={closeMobileMenu}
                      className="block w-full text-center px-4 py-3 bg-navy-100 text-navy-700 font-semibold text-body rounded-xl hover:bg-navy-200 transition-colors"
                    >
                      Admin
                    </NavLink>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 bg-navy-900 text-white font-semibold text-body rounded-xl hover:bg-navy-800 transition-colors"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}