/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  safelist: [
    // Ensure all button color classes are generated
    {
      pattern: /bg-button-(50|100|200|300|400|500|600|700|800|900)/,
      variants: ['hover', 'dark', 'dark:hover'],
    },
    {
      pattern: /from-button-(50|100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /to-button-(50|100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /text-button-(50|100|200|300|400|500|600|700|800|900)/,
      variants: ['hover', 'dark', 'dark:hover', 'group-hover', 'dark:group-hover'],
    },
    {
      pattern: /border-button-(50|100|200|300|400|500|600|700|800|900)/,
    },
    // Ensure all primary color classes are generated
    {
      pattern: /bg-primary-(50|100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /border-primary-(50|100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /from-primary-(50|100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /to-primary-(50|100|200|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /text-primary-(50|100|200|300|400|500|600|700|800|900)/,
    },
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
        },
        secondary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        button: {
          50: 'var(--color-button-50)',
          100: 'var(--color-button-100)',
          200: 'var(--color-button-200)',
          300: 'var(--color-button-300)',
          400: 'var(--color-button-400)',
          500: 'var(--color-button-500)',
          600: 'var(--color-button-600)',
          700: 'var(--color-button-700)',
          800: 'var(--color-button-800)',
          900: 'var(--color-button-900)',
        },
        border: {
          50: 'var(--color-border-50)',
          100: 'var(--color-border-100)',
          200: 'var(--color-border-200)',
          300: 'var(--color-border-300)',
          400: 'var(--color-border-400)',
          500: 'var(--color-border-500)',
          600: 'var(--color-border-600)',
          700: 'var(--color-border-700)',
          800: 'var(--color-border-800)',
          900: 'var(--color-border-900)',
        },
      },
      backgroundColor: {
        'theme-primary': 'var(--color-bg-primary)',
        'theme-secondary': 'var(--color-bg-secondary)',
      },
      textColor: {
        'theme-primary': 'var(--color-text-primary)',
        'theme-secondary': 'var(--color-text-secondary)',
      },
    },
  },
  plugins: [],
}

