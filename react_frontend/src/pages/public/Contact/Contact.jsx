import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Send,
  MessageCircle,
  User,
  Building,
  CheckCircle,
  Facebook,
  Instagram,
  Twitter,
  ArrowRight
} from 'lucide-react';
import { Button, FormInput } from '../../../components/ui';
import Skeleton from '../../../components/ui/Skeleton';
import { useBusinessSettings } from '../../../context/BusinessSettingsContext';
import { websiteContentApi, contactApi } from '../../../api';
import { resolveStorageUrl } from '../../../api/config';

const Contact = () => {
  const { settings } = useBusinessSettings();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    subject: '',
    message: '',
    inquiryType: 'general',
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const defaultPageContent = {
    heroTag: '',
    heroTitle: '',
    heroSubtitle: '',
    heroImage: null,
    formTitle: '',
    faqs: [],
    socialTitle: '',
    socialDescription: '',
  };

  // Load cached content instantly
  const [pageContent, setPageContent] = useState(() => {
    try {
      const saved = localStorage.getItem('kjp-contact-content');
      if (saved) return { ...defaultPageContent, ...JSON.parse(saved) };
    } catch (e) {}
    return defaultPageContent;
  });

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const result = await websiteContentApi.getContactContent();
        if (result.success && result.data) {
          setPageContent(prev => ({ ...prev, ...result.data }));
          localStorage.setItem('kjp-contact-content', JSON.stringify(result.data));
        }
      } catch (error) {
        // Use cached/defaults
      }
    };
    fetchContent();

    const handleStorageSync = (e) => {
      if (e.key === 'kjp-contact-content' && !e.newValue) fetchContent();
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const result = await contactApi.send({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        company: formData.company || undefined,
        subject: formData.subject,
        inquiry_type: formData.inquiryType,
        message: formData.message,
      });

      if (result.success) {
        setIsSubmitted(true);
      } else {
        setSubmitError(result.message || result.error || 'Failed to send message. Please try again.');
      }
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: 'Visit Us',
      details: settings.business_address ? settings.business_address.split(',').map(s => s.trim()) : [],
      color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    },
    {
      icon: Phone,
      title: 'Call Us',
      details: settings.business_phone ? [settings.business_phone] : [],
      color: 'bg-button-100 dark:bg-button-900/30 text-button-600 dark:text-button-400',
    },
    {
      icon: Mail,
      title: 'Email Us',
      details: settings.business_email ? [settings.business_email] : [],
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    },
    {
      icon: Clock,
      title: 'Business Hours',
      details: settings.business_hours ? settings.business_hours.split('\n').filter(Boolean) : ['Monday - Saturday: 7AM - 6PM'],
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    },
  ];

  const inquiryTypes = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'wholesale', label: 'Wholesale Orders' },
    { value: 'retail', label: 'Retail Purchase' },
    { value: 'partnership', label: 'Business Partnership' },
    { value: 'feedback', label: 'Feedback / Suggestions' },
  ];

  if (isSubmitted) {
    return (
      <div className="overflow-hidden">
        <section className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-white dark:from-gray-800 to-primary-50 dark:to-gray-700 flex items-center">
          <div className="max-w-xl mx-auto px-4 text-center">
            <div className="w-20 h-20 bg-button-100 dark:bg-button-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={48} className="text-button-600 dark:text-button-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Thank You for Reaching Out!
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              We've received your message and will get back to you within 24 hours. 
              For urgent inquiries, please call us directly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/">
                <Button variant="outline" className="w-full sm:w-auto">
                  Back to Home
                </Button>
              </Link>
              <Link to="/products">
                <Button className="w-full sm:w-auto">
                  Browse Products
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ 
            backgroundImage: pageContent.heroImage
              ? `url(${resolveStorageUrl(pageContent.heroImage)})`
              : 'none',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-gray-900" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1 bg-button-500/20 border border-button-500/30 text-button-300 rounded-full text-sm font-medium mb-6">
            {pageContent.heroTag}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            {pageContent.heroTitle}
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            {pageContent.heroSubtitle}
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-12 -mt-8 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((info) => (
              <div 
                key={info.title}
                className="bg-white dark:bg-gray-700 rounded-xl p-6 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 border-2 border-primary-300 dark:border-primary-700 hover:border-button-400 hover:shadow-xl transition-all"
              >
                <div className={`w-12 h-12 ${info.color} rounded-xl flex items-center justify-center mb-4`}>
                  <info.icon size={24} />
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{info.title}</h3>
                {info.details.map((detail, idx) => (
                  <p key={idx} className="text-gray-600 dark:text-gray-300 text-sm">{detail}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 bg-gradient-to-b from-white dark:from-gray-800 to-primary-50 dark:to-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="bg-white dark:bg-gray-700 rounded-xl shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 border-2 border-primary-300 dark:border-primary-700 p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">{pageContent.formTitle}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Inquiry Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Type of Inquiry
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {inquiryTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, inquiryType: type.value }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          formData.inquiryType === type.value
                            ? 'bg-button-500 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:outline-none focus:border-button-500 focus:bg-white dark:focus:bg-gray-600 transition-all"
                        placeholder="Juan Dela Cruz"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:outline-none focus:border-button-500 focus:bg-white dark:focus:bg-gray-600 transition-all"
                        placeholder="juan@example.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:outline-none focus:border-button-500 focus:bg-white dark:focus:bg-gray-600 transition-all"
                        placeholder="+63 917 123 4567"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Company / Organization
                    </label>
                    <div className="relative">
                      <Building size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:outline-none focus:border-button-500 focus:bg-white dark:focus:bg-gray-600 transition-all"
                        placeholder="Your company name"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:outline-none focus:border-button-500 focus:bg-white dark:focus:bg-gray-600 transition-all"
                    placeholder="What is this about?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Message *
                  </label>
                  <div className="relative">
                    <MessageCircle size={18} className="absolute left-3 top-3 text-gray-400" />
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:outline-none focus:border-button-500 focus:bg-white dark:focus:bg-gray-600 transition-all resize-none"
                      placeholder="Tell us more about your inquiry..."
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={18} className="mr-2" />
                      Send Message
                    </>
                  )}
                </Button>

                {submitError && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm text-center">
                    {submitError}
                  </div>
                )}
              </form>
            </div>

            {/* Map & FAQ */}
            <div className="space-y-8">
              {/* Map */}
              <div className="bg-white dark:bg-gray-700 rounded-xl shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 border-2 border-primary-300 dark:border-primary-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <MapPin size={20} className="text-button-600 dark:text-button-400" />
                    Find Us on the Map
                  </h3>
                </div>
                <div className="h-64 bg-gray-200 dark:bg-gray-600 relative">
                  {settings.google_maps_embed ? (
                    <iframe
                      title={`${settings.business_name || 'Business'} Location`}
                      src={settings.google_maps_embed}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen=""
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="absolute inset-0"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      <div className="text-center">
                        <MapPin size={32} className="mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">Map not configured</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                    📍 {settings.business_address || 'Our Location'}
                  </p>
                </div>
              </div>

              {/* FAQs */}
              <div className="bg-white dark:bg-gray-700 rounded-xl shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 border-2 border-primary-300 dark:border-primary-700 p-6">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Frequently Asked Questions</h3>
                <div className="space-y-4">
                  {pageContent.faqs.map((faq, index) => (
                    <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">{faq.question}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{faq.answer}</p>
                    </div>
                  ))}
                </div>
                <Link 
                  to="/about" 
                  className="mt-4 text-button-600 hover:text-button-700 dark:text-button-300 font-medium text-sm flex items-center gap-1 group"
                >
                  Learn more about us
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Social Links */}
              <div className="bg-gradient-to-br from-button-600 to-button-700 rounded-xl p-6 text-white shadow-lg shadow-button-500/25">
                <h3 className="font-semibold mb-2">{pageContent.socialTitle}</h3>
                <p className="text-white/80 text-sm mb-4">
                  {pageContent.socialDescription}
                </p>
                <div className="flex gap-3">
                  <a 
                    href="#" 
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Facebook size={20} />
                  </a>
                  <a 
                    href="#" 
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Instagram size={20} />
                  </a>
                  <a 
                    href="#" 
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Twitter size={20} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
