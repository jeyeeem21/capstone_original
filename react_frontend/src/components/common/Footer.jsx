import { Heart, Mail, Phone, MapPin, Clock, Zap, Package, ShoppingCart, TrendingUp, BarChart3, Facebook, Twitter, Instagram, Linkedin, Wheat, Monitor, ClipboardList, User } from 'lucide-react';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import { DEFAULT_LOGO } from '../../api/config';
import { useAuth } from '../../context/AuthContext';

const Footer = ({ 
  className = ''
}) => {
  const { settings } = useBusinessSettings();
  const { basePath, isStaff, user } = useAuth();
  const currentYear = new Date().getFullYear();
  const isCustomer = user?.role === 'customer';

  const quickLinks = isStaff() ? [
    { icon: Monitor, label: 'Point of Sale', href: '/secretary/pos' },
    { icon: User, label: 'My Profile', href: '/secretary/profile' },
  ] : isCustomer ? [
    { icon: Package, label: 'Products', href: '/customer/products' },
    { icon: ClipboardList, label: 'My Orders', href: '/customer/orders' },
    { icon: User, label: 'My Profile', href: '/customer/profile' },
  ] : [
    { icon: Package, label: 'Products', href: `${basePath}/products` },
    { icon: Monitor, label: 'Point of Sale', href: `${basePath}/pos` },
    { icon: ClipboardList, label: 'Orders', href: `${basePath}/orders` },
    { icon: TrendingUp, label: 'Procurement', href: `${basePath}/procurement` },
    { icon: BarChart3, label: 'Sales', href: `${basePath}/sales` },
  ];

  const contactInfo = [
    { icon: MapPin, text: settings.business_address || 'Calapan City, Oriental Mindoro, Philippines' },
    { icon: Phone, text: settings.business_phone || '+63 917-123-4567' },
    { icon: Mail, text: settings.business_email || 'info@kjpricemill.com' },
    { icon: Clock, text: settings.business_hours || 'Mon-Sat: 7:00 AM - 6:00 PM' },
  ];

  const socialLinks = [
    { icon: Facebook, href: settings.social_facebook, label: 'Facebook' },
    { icon: Twitter, href: settings.social_twitter, label: 'Twitter' },
    { icon: Instagram, href: settings.social_instagram, label: 'Instagram' },
    { icon: Linkedin, href: settings.social_linkedin, label: 'LinkedIn' },
  ].filter(link => link.href); // Only show links that have URLs

  // Parse powered by text to separate framework and institution
  const poweredByText = settings.footer_powered_by || 'Powered by XianFire Framework. Built at Mindoro State University';
  const poweredByParts = poweredByText.split('. ');
  const frameworkText = poweredByParts[0]?.replace('Powered by ', '') || 'XianFire Framework';
  const institutionText = poweredByParts[1]?.replace('Built at ', '') || 'Mindoro State University';

  return (
    <footer className={`rounded-xl overflow-hidden ${className}`}>
      {/* Main Footer Content */}
      <div 
        className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10"
        style={{ backgroundColor: 'var(--color-bg-footer)' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
          
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-button-500 flex items-center justify-center shadow-lg shadow-button-500/30 overflow-hidden">
                <img 
                  src={settings.business_logo && !settings.business_logo.startsWith('blob:') ? settings.business_logo : DEFAULT_LOGO} 
                  alt={settings.business_name || 'Business Logo'} 
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <Wheat className="text-white hidden" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">{settings.business_name || 'KJP Rice Mill'}</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-5">
              {settings.footer_tagline || 'Your trusted partner in quality rice processing and distribution.'}
            </p>
            <div className="flex items-center gap-3">
              {(settings.footer_badge1 ?? 'Premium Quality') && (
                <span className="px-4 py-1.5 rounded-full border-2 border-button-500 text-button-400 text-xs font-semibold">
                  {settings.footer_badge1 || 'Premium Quality'}
                </span>
              )}
              {(settings.footer_badge2 ?? 'ISO Certified') && (
                <span className="px-4 py-1.5 rounded-full bg-button-500 text-white text-xs font-semibold">
                  {settings.footer_badge2 || 'ISO Certified'}
                </span>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="flex items-center gap-2 text-white font-bold text-lg mb-5">
              <Zap size={18} className="text-button-400" />
              Quick Links
            </h4>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href} 
                    className="flex items-center gap-3 text-gray-400 hover:text-button-400 transition-colors text-sm group"
                  >
                    <link.icon size={16} className="text-button-500 group-hover:text-button-400 transition-colors" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="flex items-center gap-2 text-white font-bold text-lg mb-5">
              <Mail size={18} className="text-button-400" />
              Get In Touch
            </h4>
            <ul className="space-y-3">
              {contactInfo.map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-gray-400 text-sm">
                  <item.icon size={16} className="text-button-500 mt-0.5 flex-shrink-0" />
                  <span className="whitespace-pre-line">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-gray-950 dark:bg-black px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-gray-400 text-sm">
              © {currentYear} {settings.business_name || 'KJP Rice Mill'} {settings.footer_copyright || 'Management System. All rights reserved.'} V1.0
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              Powered by <span className="text-button-400 font-medium">{frameworkText}</span>
              {' '}Built at <span className="text-gray-400">{institutionText}</span>
            </p>
          </div>
          
          {/* Social Links */}
          <div className="flex items-center gap-2">
            {socialLinks.length > 0 ? (
              socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-10 h-10 rounded-lg bg-button-500 hover:bg-button-400 flex items-center justify-center transition-colors shadow-lg shadow-button-500/20"
                >
                  <social.icon size={18} className="text-white" />
                </a>
              ))
            ) : (
              <span className="text-gray-500 dark:text-gray-400 text-sm">No social links configured</span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
