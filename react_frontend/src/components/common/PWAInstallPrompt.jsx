/**
 * PWA Install Prompt
 *
 * - Android/Desktop Chrome: intercepts beforeinstallprompt, shows custom modal
 * - iOS Safari: auto-detects and shows step-by-step guide with icons
 * - iOS Chrome/Firefox: shows a "please use Safari" tip
 * Uses database-driven theme colors (primary, button).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, X, Monitor, Smartphone, WifiOff, Database, RefreshCw, Share, ArrowUp } from 'lucide-react';

// ── Platform detection ──────────────────────────────────────────────────────
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isIOSSafari = () =>
  isIOS() && /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
const isIOSNotSafari = () => isIOS() && !isIOSSafari();
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in window.navigator && window.navigator.standalone);
// ────────────────────────────────────────────────────────────────────────────

export default function PWAInstallPrompt() {
  const promptRef = useRef(null);
  const [mode, setMode] = useState(null); // 'android' | 'ios-safari' | 'ios-other' | null
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isStandalone()) { setIsInstalled(true); return; }

    // iOS Safari — no beforeinstallprompt, must guide manually
    if (isIOSSafari()) {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (dismissed && Date.now() - parseInt(dismissed, 10) < 86_400_000) return;
      setMode('ios-safari');
      setShowPrompt(true);
      return;
    }

    // iOS but NOT Safari (Chrome/Firefox on iOS)
    if (isIOSNotSafari()) {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (dismissed && Date.now() - parseInt(dismissed, 10) < 86_400_000) return;
      setMode('ios-other');
      setShowPrompt(true);
      return;
    }
    const onBeforeInstall = (e) => {
      e.preventDefault();
      promptRef.current = e;
      window.dispatchEvent(new CustomEvent('pwa:installable'));
      // Auto-show; respect 24h dismiss cooldown
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (dismissed && Date.now() - parseInt(dismissed, 10) < 86_400_000) return;
      setMode('android');
      setShowPrompt(true);
    };

    // App was installed (our modal or via address bar)
    const onInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      promptRef.current = null;
      window.dispatchEvent(new CustomEvent('pwa:installed'));
    };

    // Navbar "Install App" button fires this to open the modal
    const onShow = () => {
      if (promptRef.current || isIOSSafari() || isIOSNotSafari()) setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('pwa:show', onShow);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('pwa:show', onShow);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    promptRef.current = null;
    setShowPrompt(false);
  }, []);

  const handleDismiss = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setShowPrompt(false);
      setIsClosing(false);
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }, 250);
  }, []);

  if (!showPrompt || isInstalled) return null;

  // ── iOS Safari: step-by-step guide ──────────────────────────────────────
  if (mode === 'ios-safari') {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex items-end justify-center p-0 bg-black/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        onClick={handleDismiss}
      >
        <div
          className={`w-full max-w-md bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl border-t-2 border-primary-300 dark:border-primary-700 overflow-hidden ${isClosing ? 'animate-slideDown' : 'animate-slideUp'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
          <div className="relative bg-gradient-to-br from-button-600 via-button-500 to-primary-600 px-6 py-5 text-center mx-4 rounded-2xl mb-4 overflow-hidden">
            <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-6 -translate-y-6" />
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-8 translate-y-8" />
            <button onClick={handleDismiss} className="absolute top-2 right-2 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors">
              <X size={16} />
            </button>
            <div className="relative mx-auto w-14 h-14 bg-white rounded-xl shadow-md flex items-center justify-center mb-2">
              <img src="/KJPLogo.png" alt="KJP Ricemill" className="w-10 h-10 object-contain rounded-lg" />
            </div>
            <h2 className="text-lg font-bold text-white relative">Install KJP Ricemill</h2>
            <p className="text-white/80 text-xs mt-0.5 relative">Add to your iPhone / iPad Home Screen</p>
          </div>
          <div className="px-5 pb-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">3 quick steps:</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-button-500 flex items-center justify-center text-white font-bold text-sm">1</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Tap the Share button</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">The <span className="inline-flex items-center gap-0.5 font-bold bg-gray-100 dark:bg-gray-700 px-1 rounded">&#8679; box</span> at the bottom of Safari</p>
                </div>
                <div className="flex-shrink-0 w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-button-500 flex items-center justify-center text-white font-bold text-sm">2</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Tap "Add to Home Screen"</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Scroll the share menu to find it</p>
                </div>
                <div className="flex-shrink-0 w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center border border-gray-300 dark:border-gray-600 shadow">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-button-500 flex items-center justify-center text-white font-bold text-sm">3</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Tap <span className="text-blue-500 font-bold">"Add"</span> (top-right corner)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">App icon appears on your Home Screen!</p>
                </div>
                <div className="flex-shrink-0 w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow">
                  <span className="text-white font-bold text-sm">Add</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center py-3 text-button-500 dark:text-button-400">
            <p className="text-xs font-semibold mb-1">Safari toolbar is at the bottom ↓</p>
            <svg viewBox="0 0 24 24" className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <div className="px-5 pb-6">
            <button onClick={handleDismiss} className="w-full px-4 py-2.5 rounded-xl border-2 border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 text-sm font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── iOS Chrome/Firefox — redirect to Safari ─────────────────────────────
  if (mode === 'ios-other') {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex items-end justify-center p-0 bg-black/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        onClick={handleDismiss}
      >
        <div
          className={`w-full max-w-md bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl border-t-2 border-primary-300 dark:border-primary-700 overflow-hidden pb-6 ${isClosing ? 'animate-slideDown' : 'animate-slideUp'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
          <div className="px-6 py-4 text-center">
            <button onClick={handleDismiss} className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 transition-colors">
              <X size={16} />
            </button>
            <div className="mx-auto w-14 h-14 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center mb-3 bg-white dark:bg-gray-700 shadow">
              <img src="/KJPLogo.png" alt="KJP" className="w-10 h-10 object-contain" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Open in Safari to Install</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              To install on iPhone/iPad, open this page in <span className="font-bold text-blue-500">Safari</span> instead of Chrome or Firefox.
            </p>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-left mb-4">
              <div className="flex-shrink-0 w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold">S</div>
              <p className="text-sm text-blue-700 dark:text-blue-300">Copy the URL → open <span className="font-bold">Safari</span> → paste and visit</p>
            </div>
            <button onClick={handleDismiss} className="w-full px-4 py-2.5 rounded-xl border-2 border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 text-sm font-semibold hover:bg-primary-50 transition-colors">
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Android / Desktop Chrome: standard install modal ────────────────────
  const features = [
    { icon: WifiOff, label: 'Works offline', desc: 'Access your data anytime' },
    { icon: Smartphone, label: 'Mobile ready', desc: 'Feels like a native app' },
    { icon: Database, label: 'Auto-sync', desc: 'Changes sync when online' },
    { icon: RefreshCw, label: 'Always updated', desc: 'Latest version auto-installs' },
  ];

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
      onClick={handleDismiss}
    >
      <div
        className={`w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-primary-300 dark:border-primary-700 relative overflow-hidden ${isClosing ? 'animate-slideDown' : 'animate-slideUp'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-button-600 via-button-500 to-primary-600 px-6 py-8 text-center overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-10 translate-y-10" />
          <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X size={18} />
          </button>

          {/* App icon */}
          <div className="relative mx-auto w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4">
            <img
              src="/KJPLogo.png"
              alt="KJP Ricemill"
              className="w-14 h-14 object-contain rounded-lg"
            />
          </div>

          <h2 className="text-xl font-bold text-white relative">
            Install KJP Ricemill
          </h2>
          <p className="text-white/80 text-sm mt-1 relative">
            Get the full app experience on your device
          </p>
        </div>

        {/* Features grid */}
        <div className="px-5 py-5">
          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-button-500/15 dark:bg-button-400/20 flex items-center justify-center">
                  <Icon size={16} className="text-button-600 dark:text-button-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                    {label}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-primary-200 dark:border-primary-700 text-gray-600 dark:text-gray-300 text-sm font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            Not Now
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 px-4 py-2.5 rounded-xl bg-button-500 hover:bg-button-600 text-white text-sm font-bold shadow-lg shadow-button-500/25 transition-all hover:shadow-xl hover:shadow-button-500/30 flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Install App
          </button>
        </div>

        {/* Device indicator */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            <Monitor size={12} />
            <span>Available on desktop &amp; mobile</span>
            <Smartphone size={12} />
          </div>
        </div>
      </div>
    </div>
  );
}
