import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';

/**
 * ErrorBoundary — catches JavaScript errors in child components and renders
 * a graceful fallback UI instead of crashing the entire application.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 *
 * This ensures that if one page throws, all OTHER pages remain accessible.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to console in development
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.history.back();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="max-w-lg w-full text-center">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle size={40} className="text-amber-500" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              This section encountered an error. The rest of the system is still working fine.
            </p>

            {/* Error details (dev only) */}
            {isDev && this.state.error && (
              <div className="mb-6 text-left bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 overflow-auto max-h-48">
                <p className="text-sm font-mono text-red-700 dark:text-red-300 break-words">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-xs text-red-500 dark:text-red-400 mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-button-500 hover:bg-button-600 text-white font-medium rounded-xl transition-colors"
              >
                <RefreshCw size={18} />
                Try Again
              </button>
              <button
                onClick={this.handleGoBack}
                className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-primary-300 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
              >
                <ArrowLeft size={18} />
                Go Back
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-primary-300 dark:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
              >
                <Home size={18} />
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;