import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Check, AlertCircle, Loader2, Search, Navigation } from 'lucide-react';
import { debouncedSearchAddress } from '../../api/openRouteService';

/**
 * Address Autocomplete Input
 *
 * Main field: Nominatim-powered autocomplete, Philippines only.
 *   - Suggestions are shown when available, but NOT required — the user can
 *     type any address freely and still save it (Nominatim doesn't have all
 *     PH barangay-level streets indexed).
 *   - When a suggestion is selected the address is treated as geocode-ready.
 *   - When typed manually the hint line says so, and delivery fee may use an
 *     approximation.
 *
 * Landmark field (opt-in via `onLandmarkChange` prop):
 *   - A secondary plain-text input for house/block details + local landmarks
 *     e.g. "Blk 4, tapat ng yellow house, looban ng Heron St."
 *   - Stored in `address_landmark`, never used for geocoding.
 */
const AddressAutocomplete = ({
  label = 'Address',
  name = 'address',
  value = '',
  onChange,
  required = false,
  error = '',
  disabled = false,
  className = '',
  hint = '',
  submitted = false,
  placeholder = 'e.g. Brgy. Sanjuan, Cainta, Rizal  or  Bongabong, Oriental Mindoro',
  // Landmark / directions field — rendered only when onLandmarkChange is provided
  landmark = '',
  onLandmarkChange = null,
  landmarkName = 'address_landmark',
  landmarkPlaceholder = 'e.g. Blk 4, tapat ng yellow house, looban ng Heron St.',
}) => {
  const [touched, setTouched] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  // true = picked from suggestion (geocode-ready); false = typed manually
  const [pickedFromSuggestion, setPickedFromSuggestion] = useState(false);
  const wrapperRef = useRef(null);

  const hasValue   = value && value.toString().trim().length > 0;
  const isValid    = hasValue && !error;
  // Success icon shown whenever there's a value and no error (free-form is fine)
  const showSuccess = required && isValid && (touched || submitted);
  const showRequiredError = required && (touched || submitted) && !hasValue && !error;
  const displayError = error || (showRequiredError ? 'This field is required' : '');

  // Shake on submit with error
  useEffect(() => {
    if (submitted && showRequiredError) {
      setShouldShake(true);
      const t = setTimeout(() => setShouldShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [submitted, showRequiredError]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Mark as geocode-ready if value was pre-filled (edit mode)
  useEffect(() => {
    if (value && value.trim().length > 5) setPickedFromSuggestion(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setPickedFromSuggestion(false);
    onChange({ target: { name, value: val } });

    if (val.length >= 3) {
      setSearching(true);
      debouncedSearchAddress(val, (results) => {
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSearching(false);
      });
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearching(false);
    }
  }, [name, onChange]);

  const handleSelectSuggestion = useCallback((suggestion) => {
    onChange({ target: { name, value: suggestion.label } });
    setPickedFromSuggestion(true);
    setShowSuggestions(false);
    setSuggestions([]);
    setTouched(true);
  }, [name, onChange]);

  const hintText = hint
    || (pickedFromSuggestion
      ? 'Address confirmed from map — delivery fee will be calculated accurately.'
      : hasValue
        ? "Address saved as-is. Delivery fee will be estimated; driver will confirm exact location."
        : 'Type your address — select from suggestions when available for accurate delivery fee. Free-form input also accepted.');

  return (
    <div className={`mb-4 ${className}`} ref={wrapperRef}>
      {label && (
        <label htmlFor={name} className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          <MapPin size={14} className="text-gray-400" />
          {label}
          {required && <span className="text-red-500">*</span>}
          {!required && <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(Optional)</span>}
          <span className="ml-auto text-xs font-normal text-blue-500 dark:text-blue-400 flex items-center gap-0.5">🇵🇭 Philippines only</span>
        </label>
      )}

      {/* ── Main address input ── */}
      <div className="relative">
        <input
          id={name}
          name={name}
          type="text"
          value={value}
          onChange={handleInputChange}
          onBlur={() => setTouched(true)}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className={`w-full px-4 py-3 text-sm border-2 rounded-xl transition-all shadow-sm
            ${displayError
              ? 'border-red-400 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-red-500/20'
              : showSuccess
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20 focus:border-green-500 focus:ring-green-500/20'
                : 'border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 dark:text-gray-100 hover:border-primary-400 dark:hover:border-primary-600 focus:border-primary-500 focus:ring-primary-500/20'
            }
            ${disabled ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed opacity-60' : ''}
            ${shouldShake ? 'animate-shake' : ''}
            focus:outline-none focus:ring-4 pr-10 dark:placeholder-gray-400
          `}
        />
        {/* Status icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {searching && <Loader2 size={18} className="text-blue-500 animate-spin" />}
          {!searching && displayError && <AlertCircle size={18} className="text-red-500" />}
          {!searching && showSuccess && !displayError && <Check size={18} className="text-green-500" />}
          {!searching && !displayError && !showSuccess && hasValue && <Search size={16} className="text-gray-400" />}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border-2 border-primary-200 dark:border-primary-700 rounded-xl shadow-lg max-h-52 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep focus on input during click
                onClick={() => handleSelectSuggestion(s)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors flex items-start gap-2"
              >
                <MapPin size={14} className="text-primary-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-100 leading-tight block">{s.label}</span>
                  {s.locality && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {s.locality}{s.region ? `, ${s.region}` : ''}
                    </span>
                  )}
                </div>
              </button>
            ))}
            <div className="px-4 py-2 text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-xl">
              Don't see your address? Type it manually — any format is accepted.
            </div>
          </div>
        )}
      </div>

      {/* Hint / error */}
      {!displayError && !searching && (
        <p className={`mt-1.5 text-xs flex items-center gap-1 ${pickedFromSuggestion && hasValue ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {pickedFromSuggestion && hasValue && <Check size={11} />}
          {hintText}
        </p>
      )}
      {searching && (
        <p className="mt-1.5 text-xs text-blue-500 flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" /> Searching Philippine addresses...
        </p>
      )}
      {displayError && !searching && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={12} />{displayError}
        </p>
      )}

      {/* ── Landmark / directions field (optional) ── */}
      {onLandmarkChange !== null && (
        <div className="mt-3">
          <label htmlFor={landmarkName} className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            <Navigation size={14} className="text-gray-400" />
            House/Block No. &amp; Landmark
            <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(Optional)</span>
          </label>
          <input
            id={landmarkName}
            name={landmarkName}
            type="text"
            value={landmark}
            onChange={(e) => onLandmarkChange({ target: { name: landmarkName, value: e.target.value } })}
            disabled={disabled}
            placeholder={landmarkPlaceholder}
            autoComplete="off"
            className={`w-full px-4 py-3 text-sm border-2 rounded-xl transition-all shadow-sm
              border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 dark:text-gray-100
              hover:border-primary-400 dark:hover:border-primary-600
              focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 focus:outline-none
              ${disabled ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed opacity-60' : ''}
              dark:placeholder-gray-400
            `}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Street number, block/lot, or nearby landmark to help the driver locate you.
          </p>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;

