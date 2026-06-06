import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy brand (keep for backward compat)
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#0D5C3D',
          700: '#052E1C',
          900: '#060F0A',
        },
        // New design system
        forest:  '#0D5C3D',
        canopy:  '#15803D',
        growth:  '#22C55E',
        leaf:    '#BBF7D0',
        moss:    '#052E1C',
        sprout:  '#DCFCE7',
        sky:     '#0EA5E9',
        ocean:   '#0369A1',
        fog:     '#F0F7F3',
        haze:    '#E4EFE9',
        night:   '#060F0A',
        dusk:    '#1A3A27',
        ink:     '#0A1628',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        'xs':  '6px',
        'sm':  '10px',
        'md':  '14px',
        'lg':  '18px',
        'xl':  '22px',
        '2xl': '28px',
      },
      boxShadow: {
        'el-1': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'el-2': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'el-3': '0 8px 28px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)',
        'glow-green': '0 8px 28px rgba(13,92,61,0.40)',
        'glow-blue':  '0 8px 24px rgba(14,165,233,0.35)',
        'glow-red':   '0 6px 20px rgba(239,68,68,0.40)',
      },
    },
  },
  plugins: [],
} satisfies Config;
