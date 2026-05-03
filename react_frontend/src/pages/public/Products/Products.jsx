import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Search, 
  Star, 
  Grid,
  List,
  ArrowRight,
  Leaf,
  Award,
  Truck,
  RefreshCw
} from 'lucide-react';
import { Button, Skeleton } from '../../../components/ui';
import { productsApi, websiteContentApi } from '../../../api';
import { useBusinessSettings } from '../../../context/BusinessSettingsContext';
import { resolveStorageUrl } from '../../../api/config';

const iconMap = { Leaf, Award, Truck, Package };

// Fallback products — empty until real products loaded from API
const fallbackProducts = [];

const fallbackVarieties = [
  { id: 'all', name: 'All Products', count: 0 },
];

const Products = () => {
  const [products, setProducts] = useState([]);
  const [varieties, setVarieties] = useState(fallbackVarieties);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVariety, setSelectedVariety] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('popular');
  const [isFromCache, setIsFromCache] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch products from API (shows cached instantly, refreshes in background)
  useEffect(() => {
    let cancelled = false;
    const fetchProducts = async () => {
      const result = await productsApi.getAll({
        search: searchTerm,
        variety: selectedVariety,
        sort: sortBy,
      });

      if (cancelled) return;
      if (result.success) {
        setProducts(result.data || []);
        setIsFromCache(result.fromCache && result.error ? true : false);
      } else {
        setProducts(fallbackProducts);
        setIsFromCache(true);
      }
      
      setLoading(false);
    };

    // Only show loading skeleton on first load (no products yet)
    if (products.length > 0) setLoading(false);

    const timeoutId = setTimeout(fetchProducts, searchTerm ? 300 : 0);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [searchTerm, selectedVariety, sortBy, retryCount]);

  // Fetch varieties once
  useEffect(() => {
    const fetchVarieties = async () => {
      const result = await productsApi.getVarieties();
      if (result.success && result.data.length > 0) {
        setVarieties(result.data);
      }
    };
    fetchVarieties();
  }, []);

  // Normalize product data
  const normalizeProduct = (product) => ({
    id: product.id || product.product_id,
    name: product.product_name || product.name,
    variety: product.variety_name || product.variety,
    description: product.variety_name ? `${product.variety_name} — ${product.weight_formatted || product.unit || 'Rice'}` : (product.description || ''),
    price: parseFloat(product.price) || 0,
    unit: product.unit,
    image: product.image,
    rating: parseFloat(product.rating || 0),
    reviewsCount: product.reviews_count || product.reviewsCount || 0,
    tags: product.tags || (product.variety_name ? [product.variety_name] : []),
    inStock: product.is_in_stock ?? product.in_stock ?? product.inStock ?? true,
  });

  const normalizedProducts = products.map(normalizeProduct);

  const filteredProducts = normalizedProducts.filter(product => {
    const matchesSearch = (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (product.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVariety = selectedVariety === 'all' || (product.variety || '') === selectedVariety;
    return matchesSearch && matchesVariety;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low': return a.price - b.price;
      case 'price-high': return b.price - a.price;
      case 'rating': return b.rating - a.rating;
      default: return b.reviewsCount - a.reviewsCount;
    }
  });

  const { settings } = useBusinessSettings();
  const logoFallback = settings.business_logo && !settings.business_logo.startsWith('blob:') ? settings.business_logo : null;

  const defaultPageContent = {
    heroTag: '',
    heroTitle: '',
    heroSubtitle: '',
    heroImage: null,
    badges: [],
    ctaTitle: '',
    ctaDescription: '',
    ctaButtonText: '',
  };

  // Load cached content instantly
  const [pageContent, setPageContent] = useState(() => {
    try {
      const saved = localStorage.getItem('kjp-products-content');
      if (saved) return { ...defaultPageContent, ...JSON.parse(saved) };
    } catch (e) {}
    return defaultPageContent;
  });

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const result = await websiteContentApi.getProductsContent();
        if (result.success && result.data) {
          setPageContent(prev => ({ ...prev, ...result.data }));
          localStorage.setItem('kjp-products-content', JSON.stringify(result.data));
        }
      } catch (error) {
        // Use cached/defaults
      }
    };
    fetchContent();

    const handleStorageSync = (e) => {
      if (e.key === 'kjp-products-content' && !e.newValue) fetchContent();
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  const features = pageContent.badges.map(badge => ({
    icon: iconMap[badge.icon] || Award,
    text: badge.title,
  }));

  const handleRetry = useCallback(() => {
    setRetryCount(c => c + 1);
  }, []);

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
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
            {pageContent.heroSubtitle}
          </p>
          
          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {features.map((feature) => (
              <div key={feature.text} className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full">
                <feature.icon size={16} className="text-button-400" />
                <span className="text-sm text-white">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-12 bg-gradient-to-b from-white to-primary-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Offline/Cache Notice */}
          {isFromCache && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl flex items-center justify-between">
              <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                Showing cached data. Server may be unavailable.
              </p>
              <button 
                onClick={handleRetry}
                className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:text-yellow-300 font-medium text-sm"
              >
                <RefreshCw size={16} />
                Retry
              </button>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white dark:bg-gray-700 rounded-2xl shadow-lg border-2 border-primary-100 dark:border-primary-800 p-4 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl focus:outline-none focus:border-button-500 focus:bg-white dark:focus:bg-gray-600 transition-all"
                  />
                </div>
              </div>

              {/* Variety Filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
                {varieties.map((variety) => (
                  <button
                    key={variety.id}
                    onClick={() => setSelectedVariety(variety.id)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                      selectedVariety === variety.id
                        ? 'bg-button-500 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {variety.name}
                    <span className={`ml-1 ${selectedVariety === variety.id ? 'text-white/70' : 'text-gray-400'}`}>
                      ({variety.count})
                    </span>
                  </button>
                ))}
              </div>

              {/* Sort & View */}
              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-lg text-sm focus:outline-none focus:border-button-500 cursor-pointer"
                >
                  <option value="popular">Most Popular</option>
                  <option value="rating">Highest Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>

                <div className="hidden sm:flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-button-600 dark:text-button-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <Grid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-button-600 dark:text-button-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600 dark:text-gray-300">
              {loading ? (
                <span className="inline-block w-40 h-4 animate-skeleton-pulse bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-600 dark:via-gray-500 dark:to-gray-600 rounded" />
              ) : (
                <>Showing <span className="font-semibold text-gray-800 dark:text-gray-100">{sortedProducts.length}</span> products</>
              )}
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg border-2 border-primary-100 dark:border-primary-800">
                  <Skeleton variant="image" className="h-44 w-full rounded-none" />
                  <div className="p-4 space-y-3">
                    <Skeleton variant="title" width="w-3/4" />
                    <Skeleton variant="text" width="w-1/2" />
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, j) => <Skeleton key={j} variant="circle" width="w-4" height="h-4" />)}
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <Skeleton variant="title" width="w-20" />
                      <Skeleton variant="button" width="w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Products Grid */}
          {!loading && viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedProducts.map((product) => (
                <div 
                  key={product.id}
                  className="group bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 hover:shadow-xl transition-all duration-300 border-2 border-primary-300 dark:border-primary-700 hover:border-button-400"
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
                    {!product.inStock && (
                      <div className="absolute top-3 left-3">
                        <span className="px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full shadow">Out of Stock</span>
                      </div>
                    )}
                    {product.tags.length > 0 && product.inStock && (
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                        {product.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="px-2 py-1 bg-button-500 text-white text-xs font-medium rounded-full shadow">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 group-hover:text-button-600 dark:hover:text-button-400 dark:text-button-400 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{product.description}</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-bold text-button-600 dark:text-button-400">₱{product.price.toLocaleString()}</span>
                        <span className="text-sm text-gray-400 ml-1">/{product.unit}</span>
                      </div>
                      <Link to="/contact">
                        <Button size="sm" disabled={!product.inStock} className="!bg-button-500 hover:!bg-button-600 text-white">
                          {product.inStock ? 'Inquire' : 'Sold Out'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Products List */}
          {!loading && viewMode === 'list' && (
            <div className="space-y-4">
              {sortedProducts.map((product) => (
                <div 
                  key={product.id}
                  className="group bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg shadow-primary-100/50 dark:shadow-gray-900/30 hover:shadow-xl transition-all duration-300 border-2 border-primary-300 dark:border-primary-700 hover:border-button-400"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Image */}
                    <div className="relative w-full sm:w-56 h-44 sm:h-auto flex-shrink-0 overflow-hidden">
                      {product.image ? (
                        <img src={product.image} alt={product.name} width={224} height={176} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : logoFallback ? (
                        <img src={logoFallback} alt={product.name} width={224} height={176} loading="lazy" className="w-full h-full object-contain p-6 opacity-60" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center">
                          <Package size={36} className="text-primary-400 dark:text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-6 flex flex-col justify-between">
                      <div>
                      <div className="flex items-center gap-2 mb-2">
                        {!product.inStock && (
                          <span className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full">Out of Stock</span>
                        )}
                        {product.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="px-2 py-1 bg-button-100 dark:bg-button-900/30 text-button-700 dark:text-button-300 text-xs font-medium rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2 group-hover:text-button-600 dark:hover:text-button-400 dark:text-button-400 transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-4">{product.description}</p>

                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div>
                        <span className="text-3xl font-bold text-button-600 dark:text-button-400">₱{product.price.toLocaleString()}</span>
                        <span className="text-gray-400 ml-1">/{product.unit}</span>
                      </div>
                      <Link to="/contact">
                        <Button disabled={!product.inStock} className="!bg-button-500 hover:!bg-button-600 text-white">
                          {product.inStock ? 'Inquire Now' : 'Out of Stock'}
                        </Button>
                      </Link>
                    </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && sortedProducts.length === 0 && (
            <div className="text-center py-16">
              <Package size={64} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">No products found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Try adjusting your search or filter criteria</p>
              <Button onClick={() => { setSearchTerm(''); setSelectedVariety('all'); }} className="!bg-button-500 hover:!bg-button-600 text-white">
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-button-700 via-button-600 to-button-700 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            {pageContent.ctaTitle}
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            {pageContent.ctaDescription}
          </p>
          <Link to="/contact">
            <Button size="lg" className="px-8 bg-white dark:bg-gray-700 !text-button-700 dark:text-button-300 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 group font-semibold">
              {pageContent.ctaButtonText}
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Products;
