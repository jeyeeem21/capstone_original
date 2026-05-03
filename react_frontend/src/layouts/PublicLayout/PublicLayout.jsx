import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation, useSearchParams } from 'react-router-dom';
import { Menu, X, Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter, Linkedin, ChevronUp, Download } from 'lucide-react';
import { Button, LoginModal, ForgotPasswordModal, RegisterModal } from '../../components/ui';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import { DEFAULT_LOGO } from '../../api/config';

// Prefetch map for nav hover
const prefetchMap = {
  '/': () => import('../../pages/public/Home'),
  '/about': () => import('../../pages/public/About'),
  '/products': () => import('../../pages/public/Products'),
  '/contact': () => import('../../pages/public/Contact'),
};

// Public Header/Navbar
const PublicHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isInstallable, setIsInstallable] = useState(false);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useBusinessSettings();

  // Listen for PWA installability events from PWAInstallPrompt
  useEffect(() => {
    const onInstallable = () => setIsInstallable(true);
    const onInstalled  = () => setIsInstallable(false);
    // Hide if already running as standalone
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && window.navigator.standalone)
    ) {
      setIsInstallable(false);
      return;
    }
    // iOS devices are always "installable" (via Safari share menu)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) { setIsInstallable(true); return; }

    window.addEventListener('pwa:installable', onInstallable);
    window.addEventListener('pwa:installed',   onInstalled);
    return () => {
      window.removeEventListener('pwa:installable', onInstallable);
      window.removeEventListener('pwa:installed',   onInstalled);
    };
  }, []);

  const handleInstallClick = () => {
    window.dispatchEvent(new CustomEvent('pwa:show'));
  };

  // Auto-open login modal when redirected with ?login=true
  useEffect(() => {
    if (searchParams.get('login') === 'true') {
      setIsLoginModalOpen(true);
      searchParams.delete('login');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/products', label: 'Products' },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg border-b border-primary-200 dark:border-primary-700' 
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center shadow-lg shadow-button-500/25 group-hover:scale-105 transition-transform overflow-hidden">
              <img 
                src={settings.business_logo && !settings.business_logo.startsWith('blob:') ? settings.business_logo : DEFAULT_LOGO} 
                alt={settings.business_name || 'Logo'} 
                className="w-10 h-10 object-contain"
                onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_LOGO; }}
              />
            </div>
            <div>
              <h1 className={`font-bold text-xl transition-colors ${isScrolled ? 'text-gray-800 dark:text-gray-100' : 'text-white'}`}>
                {settings.business_name || 'KJP Ricemill'}
              </h1>
              <p className={`text-xs font-medium transition-colors ${isScrolled ? 'text-button-600 dark:text-button-400' : 'text-button-300'}`}>
                {settings.business_tagline || 'Quality Rice Products'}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onMouseEnter={() => prefetchMap[link.to]?.()}
                onTouchStart={() => prefetchMap[link.to]?.()}
                className={({ isActive }) => `
                  px-4 py-2 rounded-lg font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-button-500 text-white shadow-md' 
                    : isScrolled 
                      ? 'text-gray-700 dark:text-gray-200 hover:bg-primary-100 dark:hover:bg-primary-900/20 hover:text-button-600 dark:hover:text-button-400 dark:text-button-400' 
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-2">
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isScrolled
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-button-600 dark:text-button-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-700'
                    : 'bg-white/15 text-white hover:bg-white/25 border border-white/30'
                }`}
              >
                <Download size={15} />
                Install App
              </button>
            )}
            <Button 
              variant={isScrolled ? 'default' : 'outline'} 
              className={!isScrolled ? 'border-white text-white hover:bg-white dark:hover:bg-gray-700 hover:text-button-600 dark:hover:text-button-400 dark:text-button-400' : ''}
              onClick={() => setIsLoginModalOpen(true)}
            >
              Login
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`md:hidden p-2 rounded-lg transition-colors ${
              isScrolled ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700' : 'text-white hover:bg-white/10'
            }`}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`md:hidden transition-all duration-300 overflow-hidden ${
        isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="bg-white dark:bg-gray-700 border-t border-primary-200 dark:border-primary-700 shadow-lg">
          <nav className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onMouseEnter={() => prefetchMap[link.to]?.()}
                onTouchStart={() => prefetchMap[link.to]?.()}
                className={({ isActive }) => `
                  block px-4 py-3 rounded-lg font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-button-500 text-white' 
                    : 'text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-button-600 dark:hover:text-button-400 dark:text-button-400'
                  }
                `}
              >
                {link.label}
              </NavLink>
            ))}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600 mt-2 space-y-2">
              {isInstallable && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleInstallClick();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-button-600 dark:text-button-400 border border-primary-200 dark:border-primary-700 font-semibold text-sm hover:bg-primary-100 transition-colors"
                >
                  <Download size={15} />
                  Install App
                </button>
              )}
              <Button 
                variant="default" 
                className="w-full"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsLoginModalOpen(true);
                }}
              >
                Login
              </Button>
            </div>
          </nav>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSwitchToRegister={() => { setIsLoginModalOpen(false); setIsRegisterModalOpen(true); }}
        onSwitchToForgotPassword={(email) => { setForgotPasswordEmail(email || ''); setIsLoginModalOpen(false); setIsForgotPasswordModalOpen(true); }}
      />

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setIsForgotPasswordModalOpen(false)}
        onSwitchToLogin={() => { setIsForgotPasswordModalOpen(false); setIsLoginModalOpen(true); }}
        initialEmail={forgotPasswordEmail}
      />

      {/* Register Modal */}
      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSwitchToLogin={() => { setIsRegisterModalOpen(false); setIsLoginModalOpen(true); }}
      />
    </header>
  );
};

// Public Footer
const PublicFooter = () => {
  const { settings } = useBusinessSettings();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const quickLinks = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About Us' },
    { to: '/products', label: 'Products' },
    { to: '/contact', label: 'Contact' },
  ];

  const contactInfo = [
    { icon: MapPin, text: settings.business_address || '' },
    { icon: Phone, text: settings.business_phone || '' },
    { icon: Mail, text: settings.business_email || '' },
    { icon: Clock, text: settings.business_hours || '' },
  ].filter(item => item.text);

  const socialLinks = [
    { icon: Facebook, href: settings.social_facebook, label: 'Facebook' },
    { icon: Instagram, href: settings.social_instagram, label: 'Instagram' },
    { icon: Twitter, href: settings.social_twitter, label: 'Twitter' },
    { icon: Linkedin, href: settings.social_linkedin, label: 'LinkedIn' },
  ].filter(link => link.href);

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-button-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {/* Brand Section */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                <img 
                  src={settings.business_logo || DEFAULT_LOGO} 
                  alt={settings.business_name || 'Logo'} 
                  className="w-10 h-10 object-contain"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
                <span style={{display:'none'}} className="text-white font-bold text-xl items-center justify-center">{(settings.business_name || 'K').substring(0, 1)}</span>
              </div>
              <div>
                <h3 className="font-bold text-xl">{settings.business_name || 'KJP Ricemill'}</h3>
                <p className="text-xs text-button-400">{settings.business_tagline || 'Quality Rice Products'}</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              {settings.footer_tagline || 'Your trusted partner in quality rice processing and distribution.'}
            </p>
            {socialLinks.length > 0 && (
              <div className="flex gap-3">
                {socialLinks.map((social, index) => (
                  <a key={index} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label} className="w-10 h-10 bg-white/10 hover:bg-button-500 rounded-lg flex items-center justify-center transition-colors">
                    <social.icon size={18} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-lg mb-6 relative">
              Quick Links
              <span className="absolute -bottom-2 left-0 w-12 h-1 bg-button-500 rounded-full" />
            </h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link 
                    to={link.to}
                    className="text-gray-400 hover:text-button-400 transition-colors flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 bg-button-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold text-lg mb-6 relative">
              Contact Us
              <span className="absolute -bottom-2 left-0 w-12 h-1 bg-button-500 rounded-full" />
            </h4>
            <ul className="space-y-4">
              {contactInfo.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-button-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <item.icon size={18} className="text-button-400" />
                  </div>
                  <p className="text-sm text-gray-400 pt-2.5 whitespace-pre-line">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} {settings.business_name || 'KJP Ricemill'} {settings.footer_copyright || 'Management System. All rights reserved.'}
          </p>
          <p className="text-xs text-gray-600">
            {settings.footer_powered_by || ''}
          </p>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 w-12 h-12 bg-button-500 hover:bg-button-600 text-white rounded-full shadow-lg transition-all duration-300 flex items-center justify-center z-50 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        <ChevronUp size={24} />
      </button>
    </footer>
  );
};

// Main Public Layout
const PublicLayout = () => {
  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
};

export default PublicLayout;
