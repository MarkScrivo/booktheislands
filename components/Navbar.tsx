import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Palmtree, Moon, Sun, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

interface NavbarProps {
  cartCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ cartCount = 0 }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  // Get unread notification count
  const unreadCount = useQuery(
    api.notifications.inApp.getUnreadCount,
    user ? { userId: user.id } : "skip"
  );

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Always use solid background for better visibility
  const navClass = `fixed top-0 z-50 w-full transition-all duration-300 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 shadow-sm ${
    scrolled ? 'py-3' : 'py-4'
  }`;

  const linkClass = (path: string) => `text-sm font-medium transition-colors ${
    location.pathname === path
      ? 'text-teal-600 dark:text-teal-400'
      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
  }`;

  const logoClass = 'text-teal-700 dark:text-teal-400';

  return (
    <nav className={navClass}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className={`flex items-center gap-2 text-2xl font-bold tracking-tight ${logoClass}`}>
              <Palmtree className="w-8 h-8 text-teal-500" />
              Book The Islands
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className={linkClass('/')}>Explore</Link>

            {user && (
              <Link to="/inbox" className={`flex items-center gap-1 relative ${linkClass('/inbox')}`}>
                <Bell className="w-4 h-4" />
                Inbox
                {unreadCount && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}

            {user && profile?.role === 'vendor' && (
              <Link to="/vendor" className={linkClass('/vendor')}>Dashboard</Link>
            )}

            {user && profile?.role === 'customer' && (
              <Link to="/trips" className={linkClass('/trips')}>Trips</Link>
            )}

            {user && profile?.role === 'admin' && (
              <Link to="/admin" className={`flex items-center gap-1 ${linkClass('/admin')}`}>
                Admin
              </Link>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full transition-colors bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {!user ? (
              <Link to="/login" className="text-sm font-semibold px-6 py-2.5 rounded-full transition-all duration-300 bg-gray-900 dark:bg-teal-600 text-white hover:bg-teal-600 dark:hover:bg-teal-500 shadow-md">
                Sign In
              </Link>
            ) : (
              <div className="flex items-center gap-4 pl-4 border-l border-gray-200/30 dark:border-gray-700/30">
                <div className="flex flex-col items-end text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-bold">{profile?.fullName}</span>
                  <span className="opacity-70 capitalize">{profile?.role}</span>
                </div>
                <button onClick={handleSignOut} className="p-2 rounded-full transition-colors bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="md:hidden flex items-center gap-2">
            {/* Dark Mode Toggle (Mobile) */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full transition-colors bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-gray-800 dark:text-gray-200">
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-xl animate-in slide-in-from-top-5">
          <div className="p-4 space-y-2">
            <Link to="/" className="block px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium" onClick={() => setIsMenuOpen(false)}>Explore</Link>
            {user && (
              <Link to="/inbox" className="flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium relative" onClick={() => setIsMenuOpen(false)}>
                <Bell className="w-4 h-4" />
                Inbox
                {unreadCount && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ml-auto">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
            {user && profile?.role === 'vendor' && <Link to="/vendor" className="block px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium" onClick={() => setIsMenuOpen(false)}>Vendor Dashboard</Link>}
            {user && profile?.role === 'customer' && <Link to="/trips" className="block px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium" onClick={() => setIsMenuOpen(false)}>My Trips</Link>}
            {user ? (
              <button onClick={() => { handleSignOut(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 text-red-600 dark:text-red-400 font-medium">Sign Out</button>
            ) : (
              <Link to="/login" className="block px-4 py-3 bg-teal-600 dark:bg-teal-500 text-white text-center rounded-lg font-bold mt-4 hover:bg-teal-700 dark:hover:bg-teal-600" onClick={() => setIsMenuOpen(false)}>Sign In</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
