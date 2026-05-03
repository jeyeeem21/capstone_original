import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Truck, 
  Shield, 
  Leaf, 
  Star, 
  Package, 
  Users,
  ChevronRight,
  Quote,
  Award,
  Clock,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../../../components/ui';
import Skeleton from '../../../components/ui/Skeleton';
import { productsApi, websiteContentApi } from '../../../api';
import { useBusinessSettings } from '../../../context/BusinessSettingsContext';
import { resolveStorageUrl } from '../../../api/config';

// Icon mapping for features
const iconMap = {
  'Quality Assured': Shield,
  'Farm Fresh': Leaf,
  'Fast Delivery': Truck,
  'Best Prices': Award,
};

// Fallback products — empty until real products loaded from API
const fallbackProducts = [];

// Default content — empty until API provides real data
const defaultContent = {
  heroTitle: '',
  heroTitleHighlight: '',
  heroSubtitle: '',
  heroTag: '',
  aboutTitle: '',
  aboutDescription: '',
  aboutPoints: [],
  stats: [],
  features: [],
};

// Get initial content from localStorage/window (preloaded in index.html)
const getInitialContent = () => {
  if (window.__HOME_CONTENT__) return { ...defaultContent, ...window.__HOME_CONTENT__ };
  try {
    const saved = localStorage.getItem('kjp-home-content');
    if (saved) return { ...defaultContent, ...JSON.parse(saved) };
  } catch (e) {}
  return defaultContent;
};

const getInitialProducts = () => {
  if (window.__PRODUCTS__) return window.__PRODUCTS__;
  try {
    const saved = localStorage.getItem('kjp-products');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return fallbackProducts;
};

const Home = () => {
  // Initialize with cached data immediately - no flash!
  const [products, setProducts] = useState(getInitialProducts);
  const [loading, setLoading] = useState(() => !window.__HOME_CONTENT__);
  const [content, setContent] = useState(getInitialContent);
  const { settings } = useBusinessSettings();
  const logoFallback = settings.business_logo && !settings.business_logo.startsWith('blob:') ? settings.business_logo : null;

  // Fetch home content from API
  const fetchHomeContent = async () => {
    try {
      const contentResult = await websiteContentApi.getHomeContent();
      if (contentResult.success && contentResult.data) {
        const newContent = { ...defaultContent, ...contentResult.data };
        setContent(newContent);
        localStorage.setItem('kjp-home-content', JSON.stringify(contentResult.data));
      }
    } catch (error) {
      console.log('Using cached content');
    }
  };

  // Sync with API in background
  useEffect(() => {
    const syncData = async () => {
      await fetchHomeContent();

      // Fetch products in background
      try {
        const result = await productsApi.getFeatured();
        if (result.success && result.data.length > 0) {
          const normalizedProducts = result.data.map(p => ({
            id: p.id || p.product_id,
            name: p.product_name || p.name,
            description: p.variety_name ? `${p.variety_name} — ${p.weight_formatted || p.unit || 'Rice'}` : (p.description || ''),
            price: parseFloat(p.price) || 0,
            unit: p.unit,
            image: p.image,
            tags: p.tags || (p.variety_name ? [p.variety_name] : []),
          }));
          setProducts(normalizedProducts);
          localStorage.setItem('kjp-products', JSON.stringify(normalizedProducts));
        }
      } catch (error) {
        console.log('Using cached products');
      }
      
      setLoading(false);
    };

    syncData();
  }, []);

  // Cross-tab sync: re-fetch when admin saves content (clears localStorage cache)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'kjp-home-content' && !e.newValue) {
        fetchHomeContent();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Map features with icons
  const features = (content.features || defaultContent.features).map(f => ({
    ...f,
    icon: iconMap[f.title] || Shield,
  }));

  const testimonials = content.testimonials || [];
  const stats = content.stats || defaultContent.stats;

  // Default hero image if none set
  const rawHeroImage = content.heroImage || null;
  const heroImage = rawHeroImage ? (rawHeroImage.startsWith('/storage') ? resolveStorageUrl(rawHeroImage) : rawHeroImage) : null;

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: `url(${heroImage})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-900/80 to-green-900/70" />
        </div>

        {/* Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-10 w-72 h-72 bg-green-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          {loading && !content.heroTag ? (
            <Skeleton variant="text" width="w-48" height="h-8" className="mx-auto mb-8 !bg-white/10" />
          ) : content.heroTag ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-full text-green-300 text-sm font-medium mb-8">
              <Leaf size={16} />
              <span>{content.heroTag}</span>
            </div>
          ) : null}
          
          {loading && !content.heroTitle ? (
            <div className="mb-6">
              <Skeleton variant="text" width="w-96" height="h-16" className="mx-auto mb-3 !bg-white/10" />
              <Skeleton variant="text" width="w-80" height="h-16" className="mx-auto !bg-white/10" />
            </div>
          ) : (
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              {content.heroTitle}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-primary-400">
                {content.heroTitleHighlight}
              </span>
            </h1>
          )}
          
          {loading && !content.heroSubtitle ? (
            <Skeleton variant="text" width="w-2/3" height="h-6" className="mx-auto mb-10 !bg-white/10" />
          ) : (
            <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
              {content.heroSubtitle}
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/products">
              <Button size="lg" className="px-8 group bg-button-500 hover:bg-button-600">
                Explore Products
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="px-8 border-white/50 text-white hover:bg-white/10">
                Contact Us
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
            {loading && stats.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center border border-white/10">
                  <Skeleton variant="text" width="w-20" height="h-12" className="mx-auto mb-2 !bg-white/10" />
                  <Skeleton variant="text" width="w-24" height="h-4" className="mx-auto !bg-white/10" />
                </div>
              ))
            ) : stats.map((stat, index) => (
              <div key={stat.label} className="group relative bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center border border-white/10 hover:border-button-400/50 hover:bg-white/15 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-button-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-button-300 to-button-500 bg-clip-text text-transparent mb-1">{stat.value}</div>
                  <div className="text-sm text-gray-300 font-medium tracking-wide">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-white/50 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-b from-white to-primary-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 bg-button-100 dark:bg-button-900/30 dark:bg-button-500/20 text-button-700 dark:text-button-300 rounded-full text-sm font-medium mb-4">
              Why Choose Us
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Excellence in Every Grain
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              We take pride in delivering the highest quality rice products with exceptional service
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {loading && features.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-700 rounded-xl p-8 shadow-lg border-2 border-primary-300 dark:border-primary-700">
                  <Skeleton variant="circle" width="w-14" height="h-14" className="mb-6" />
                  <Skeleton variant="title" width="w-2/3" className="mb-3" />
                  <Skeleton variant="text" count={3} />
                </div>
              ))
            ) : features.map((feature, index) => (
              <div 
                key={feature.title}
                className="group bg-white dark:bg-gray-700 rounded-xl p-8 shadow-lg shadow-primary-100/50 dark:shadow-none hover:shadow-xl transition-all duration-300 border-2 border-primary-300 dark:border-primary-700 hover:border-button-400"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 bg-gradient-to-br from-button-500 to-button-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-button-500/25">
                  <feature.icon size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Preview Section */}
      <section className="py-24 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4">
            <div>
              <span className="inline-block px-4 py-1 bg-button-100 dark:bg-button-900/30 dark:bg-button-500/20 text-button-700 dark:text-button-300 rounded-full text-sm font-medium mb-4">
                Our Products
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100">
                Premium Rice Selection
              </h2>
            </div>
            <Link to="/products" className="group flex items-center gap-2 text-button-600 dark:text-button-400 font-medium hover:text-button-700">
              View All Products
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading && products.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg border-2 border-primary-300 dark:border-primary-700">
                  <Skeleton variant="image" height="h-44" />
                  <div className="p-6">
                    <Skeleton variant="title" width="w-3/4" className="mb-2" />
                    <Skeleton variant="text" width="w-1/2" className="mb-4" />
                    <div className="flex items-end justify-between">
                      <Skeleton variant="text" width="w-20" height="h-7" />
                      <Skeleton variant="button" width="w-16" />
                    </div>
                  </div>
                </div>
              ))
            ) : products.map((product, index) => (
              <div 
                key={product.id || index}
                className="group bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg shadow-primary-100/50 dark:shadow-none hover:shadow-xl transition-all duration-300 border-2 border-primary-300 dark:border-primary-700 hover:border-button-400"
              >
                {/* Product Image */}
                <div className="relative h-44 overflow-hidden">
                  {product.image ? (
                    <img src={product.image} alt={product.name} width={400} height={176} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : logoFallback ? (
                    <img src={logoFallback} alt={product.name} width={400} height={176} loading="lazy" className="w-full h-full object-contain p-6 opacity-60" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center">
                      <Package size={36} className="text-primary-400 dark:text-gray-400" />
                    </div>
                  )}
                  {product.tags && product.tags.length > 0 && (
                    <div className="absolute top-3 left-3">
                      <span className="px-3 py-1 bg-button-500 text-white text-xs font-medium rounded-full shadow">
                        {product.tags[0]}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 group-hover:text-button-600 dark:hover:text-button-400 dark:text-button-400 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{product.description}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-bold text-button-600 dark:text-button-400">₱{typeof product.price === 'number' ? product.price.toLocaleString() : product.price}</span>
                      <span className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400 ml-1">/{product.unit}</span>
                    </div>
                    <Link to="/products">
                      <Button size="sm" variant="outline" className="!border-button-300 dark:border-button-700 !text-button-700 dark:text-button-300 hover:!bg-button-50 dark:bg-button-900/20">View</Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Preview Section */}
      <section className="py-24 bg-gradient-to-br from-primary-50 to-green-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="relative z-10">
                <img 
                  src={heroImage || '/KJPLogo.png'}
                  alt="Rice Mill"
                  width={600}
                  height={400}
                  loading="lazy"
                  className="rounded-2xl shadow-2xl w-full h-auto"
                />
              </div>
              <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-green-500/20 rounded-2xl -z-0" />
              <div className="absolute -top-8 -left-8 w-32 h-32 bg-primary-500/20 rounded-2xl -z-0" />
              
              {/* Floating Card */}
              <div className="absolute -bottom-6 -left-6 bg-white dark:bg-gray-700 rounded-xl shadow-xl p-4 z-20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-button-100 dark:bg-button-900/30 rounded-lg flex items-center justify-center">
                    <Clock size={24} className="text-button-600 dark:text-button-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{new Date().getFullYear() - (parseInt(settings.business_start_year) || 2010)}+</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Years of Excellence</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <span className="inline-block px-4 py-1 bg-button-100 dark:bg-button-900/30 dark:bg-button-500/20 text-button-700 dark:text-button-300 rounded-full text-sm font-medium mb-4">
                About Us
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                {content.aboutTitle || ''}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                {content.aboutDescription || ''}
              </p>
              <ul className="space-y-4 mb-8">
                {(content.aboutPoints || defaultContent.aboutPoints).map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-button-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={14} className="text-white" />
                    </div>
                    <span className="text-gray-700 dark:text-gray-200">{item}</span>
                  </li>
                ))}
              </ul>
              <Link to="/about">
                <Button size="lg" className="group bg-button-500 hover:bg-button-600">
                  Learn More About Us
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {testimonials.length > 0 && (
      <section className="py-24 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 bg-button-100 dark:bg-button-900/30 dark:bg-button-500/20 text-button-700 dark:text-button-300 rounded-full text-sm font-medium mb-4">
              Testimonials
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Don't just take our word for it - hear from our satisfied customers
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div 
                key={testimonial.name}
                className="bg-gradient-to-br from-primary-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl p-8 shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 border-2 border-primary-300 dark:border-primary-700 hover:border-button-400 transition-colors"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} size={18} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <Quote size={32} className="text-button-200 dark:text-button-600 mb-4" />
                <p className="text-gray-600 dark:text-gray-300 mb-6 italic">"{testimonial.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-button-500 to-button-700 rounded-full flex items-center justify-center text-white font-semibold">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{testimonial.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-button-700 via-button-600 to-button-700 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Order Premium Rice?
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            Get in touch with us today and experience the KJP Ricemill difference. 
            Quality rice, competitive prices, and exceptional service.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/contact">
              <Button size="lg" className="px-8 bg-white dark:bg-gray-700 !text-button-700 dark:text-button-300 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 font-semibold">
                Contact Us Now
              </Button>
            </Link>
            <Link to="/products">
              <Button variant="outline" size="lg" className="px-8 border-white/50 text-white hover:bg-white/10">
                View Products
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
