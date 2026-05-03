import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Target, 
  Eye, 
  Heart, 
  Award,
  Users,
  Truck,
  Shield,
  Leaf,
  CheckCircle,
  ArrowRight,
  MapPin,
  Calendar
} from 'lucide-react';
import { Button } from '../../../components/ui';
import Skeleton from '../../../components/ui/Skeleton';
import { websiteContentApi } from '../../../api';
import { resolveStorageUrl } from '../../../api/config';

// Icon mapping for values
const iconMap = {
  'Quality First': Shield,
  'Customer Care': Heart,
  'Sustainability': Leaf,
  'Excellence': Award,
};

// Default content — empty until API provides real data
const defaultContent = {
  heroTitle: '',
  heroTitleHighlight: '',
  heroSubtitle: '',
  missionTitle: '',
  missionDescription: '',
  missionPoints: [],
  visionTitle: '',
  visionDescription: '',
  visionPoints: [],
  values: [],
  timeline: [],
  team: [],
};

// Default team images
const teamImages = [];

// Get initial content from localStorage/window (preloaded in index.html)
const getInitialAboutContent = () => {
  if (window.__ABOUT_CONTENT__) return { ...defaultContent, ...window.__ABOUT_CONTENT__ };
  try {
    const saved = localStorage.getItem('kjp-about-content');
    if (saved) return { ...defaultContent, ...JSON.parse(saved) };
  } catch (e) {}
  return defaultContent;
};

const About = () => {
  // Initialize with cached data immediately - no flash!
  const [content, setContent] = useState(getInitialAboutContent);
  const [loading, setLoading] = useState(() => !window.__ABOUT_CONTENT__);

  // Fetch about content from API
  const fetchAboutContent = async () => {
    try {
      const result = await websiteContentApi.getAboutContent();
      if (result.success && result.data) {
        const newContent = { ...defaultContent, ...result.data };
        setContent(newContent);
        localStorage.setItem('kjp-about-content', JSON.stringify(result.data));
      }
    } catch (error) {
      console.log('Using cached content');
    }
  };

  // Sync with API in background
  useEffect(() => {
    const syncContent = async () => {
      await fetchAboutContent();
      setLoading(false);
    };
    syncContent();
  }, []);

  // Cross-tab sync: re-fetch when admin saves content (clears localStorage cache)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'kjp-about-content' && !e.newValue) {
        fetchAboutContent();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Map values with icons
  const values = (content.values || defaultContent.values).map(v => ({
    ...v,
    icon: iconMap[v.title] || Shield,
  }));

  const timeline = content.timeline || defaultContent.timeline;
  
  // Map team with images
  const team = (content.team || defaultContent.team).map((member, index) => ({
    ...member,
    image: member.image ? resolveStorageUrl(member.image) : '/KJPLogo.png',
  }));

  const stats = [];

  // Default hero image if none set
  const rawHeroImage = content.heroImage || null;
  const heroImage = rawHeroImage ? (rawHeroImage.startsWith('/storage') ? resolveStorageUrl(rawHeroImage) : rawHeroImage) : null;

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ 
            backgroundImage: `url(${heroImage})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-gray-900" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1 bg-button-500/20 border border-button-500/30 text-button-300 rounded-full text-sm font-medium mb-6">
            About KJP Ricemill
          </span>
          {loading && !content.heroTitle ? (
            <div className="mb-6">
              <Skeleton variant="text" width="w-96" height="h-14" className="mx-auto mb-3 !bg-white/10" />
              <Skeleton variant="text" width="w-72" height="h-14" className="mx-auto !bg-white/10" />
            </div>
          ) : (
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
              {content.heroTitle}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-button-400 to-primary-400">
                {content.heroTitleHighlight}
              </span>
            </h1>
          )}
          {loading && !content.heroSubtitle ? (
            <Skeleton variant="text" width="w-2/3" height="h-6" className="mx-auto !bg-white/10" />
          ) : (
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              {content.heroSubtitle}
            </p>
          )}
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="py-24 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Mission */}
            <div className="bg-gradient-to-br from-button-50 to-primary-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-10 shadow-lg shadow-primary-100/50 dark:shadow-none border-2 border-primary-300 dark:border-primary-700">
              <div className="w-16 h-16 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-button-500/25">
                <Target size={32} className="text-white" />
              </div>
              {loading && !content.missionTitle ? (
                <>
                  <Skeleton variant="title" width="w-1/2" className="mb-4" />
                  <Skeleton variant="text" count={3} className="mb-6" />
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">{content.missionTitle}</h2>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                    {content.missionDescription}
                  </p>
                  <ul className="space-y-3">
                    {(content.missionPoints || defaultContent.missionPoints).map((item) => (
                      <li key={item} className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
                        <CheckCircle size={18} className="text-button-600 dark:text-button-400 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Vision */}
            <div className="bg-gradient-to-br from-primary-50 to-button-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-10 shadow-lg shadow-primary-100/50 dark:shadow-none border-2 border-primary-300 dark:border-primary-700">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-primary-500/25">
                <Eye size={32} className="text-white" />
              </div>
              {loading && !content.visionTitle ? (
                <>
                  <Skeleton variant="title" width="w-1/2" className="mb-4" />
                  <Skeleton variant="text" count={3} className="mb-6" />
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">{content.visionTitle}</h2>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                    {content.visionDescription}
                  </p>
                  <ul className="space-y-3">
                    {(content.visionPoints || defaultContent.visionPoints).map((item) => (
                      <li key={item} className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
                        <CheckCircle size={18} className="text-primary-500 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-button-700 to-button-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <stat.icon size={28} className="text-white" />
                </div>
                <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-sm text-white/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Values Section */}
      <section className="py-24 bg-gradient-to-b from-white to-primary-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 bg-button-100 dark:bg-button-900/30 dark:bg-button-500/20 text-button-700 dark:text-button-300 rounded-full text-sm font-medium mb-4">
              Our Values
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              What We Stand For
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Our core values guide everything we do, from how we source our rice to how we serve our customers
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {loading && values.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-700 rounded-xl p-8 shadow-lg border-2 border-primary-300 dark:border-primary-700 text-center">
                  <Skeleton variant="circle" width="w-16" height="h-16" className="mx-auto mb-6" />
                  <Skeleton variant="title" width="w-2/3" className="mx-auto mb-3" />
                  <Skeleton variant="text" count={2} />
                </div>
              ))
            ) : values.map((value) => (
              <div 
                key={value.title}
                className="group bg-white dark:bg-gray-700 rounded-xl p-8 shadow-lg shadow-primary-100/50 dark:shadow-none hover:shadow-xl transition-all duration-300 border-2 border-primary-300 dark:border-primary-700 hover:border-button-400 text-center"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-button-500/25">
                  <value.icon size={28} className="text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">{value.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-24 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 bg-button-100 dark:bg-button-900/30 dark:bg-button-500/20 text-button-700 dark:text-button-300 rounded-full text-sm font-medium mb-4">
              Our Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              A Legacy of Quality
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              From humble beginnings to becoming a trusted name in the rice industry
            </p>
          </div>

          <div className="relative">
            {/* Timeline Line */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-button-200 dark:bg-button-500/30" />

            <div className="space-y-12">
              {timeline.map((item, index) => (
                <div key={item.year} className={`relative flex items-center ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                  {/* Content */}
                  <div className={`w-full md:w-1/2 ${index % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                    <div className="bg-gradient-to-br from-primary-50 to-button-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 shadow-lg shadow-primary-100/50 dark:shadow-none border-2 border-primary-300 dark:border-primary-700 hover:border-button-400 transition-colors">
                      <span className="inline-block px-3 py-1 bg-button-500 text-white text-sm font-bold rounded-full mb-3">
                        {item.year}
                      </span>
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">{item.title}</h3>
                      <p className="text-gray-600 dark:text-gray-300">{item.description}</p>
                    </div>
                  </div>

                  {/* Timeline Dot */}
                  <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-6 h-6 bg-button-500 rounded-full border-4 border-white dark:border-gray-800 shadow-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-24 bg-gradient-to-b from-primary-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 bg-button-100 dark:bg-button-900/30 dark:bg-button-500/20 text-button-700 dark:text-button-300 rounded-full text-sm font-medium mb-4">
              Our Team
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Meet the People Behind KJP
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              A dedicated team committed to bringing you the best quality rice products
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {loading && team.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg border-2 border-primary-300 dark:border-primary-700">
                  <Skeleton variant="image" height="h-64" />
                  <div className="p-6 text-center">
                    <Skeleton variant="circle" width="w-20" height="h-20" className="mx-auto mb-4" />
                    <Skeleton variant="title" width="w-2/3" className="mx-auto mb-2" />
                    <Skeleton variant="text" width="w-1/2" className="mx-auto" />
                  </div>
                </div>
              ))
            ) : team.map((member) => (
              <div 
                key={member.name}
                className="group bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg shadow-primary-100/50 dark:shadow-none hover:shadow-xl transition-all duration-300 border-2 border-primary-300 dark:border-primary-700 hover:border-button-400"
              >
                <div className="relative h-64 overflow-hidden">
                  <img 
                    src={member.image} 
                    alt={member.name}
                    width={400}
                    height={256}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
                </div>
                <div className="p-6 text-center -mt-16 relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-button-500 to-button-700 rounded-full mx-auto mb-4 border-4 border-white dark:border-gray-800 shadow-lg flex items-center justify-center text-white text-2xl font-bold">
                    {member.name.charAt(0)}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{member.name}</h3>
                  <p className="text-sm text-button-600 dark:text-button-400">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-button-700 via-button-600 to-button-700 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Experience the KJP Difference?
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            Join hundreds of satisfied customers who trust KJP Ricemill for their rice needs.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/contact">
              <Button size="lg" className="px-8 bg-white dark:bg-gray-700 !text-button-700 dark:text-button-300 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 group">
                Get in Touch
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/products">
              <Button variant="outline" size="lg" className="px-8 border-white/30 text-white hover:bg-white/10">
                View Products
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
