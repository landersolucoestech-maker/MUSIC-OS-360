import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
        container: {
                center: true,
                padding: '2rem',
                screens: {
                        '2xl': '1400px'
                }
        },
        extend: {
                colors: {
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        sidebar: {
                                DEFAULT: 'hsl(var(--sidebar-background))',
                                foreground: 'hsl(var(--sidebar-foreground))',
                                primary: 'hsl(var(--sidebar-primary))',
                                'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
                                accent: 'hsl(var(--sidebar-accent))',
                                'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
                                border: 'hsl(var(--sidebar-border))',
                                ring: 'hsl(var(--sidebar-ring))'
                        },
                        success: {
                                DEFAULT: 'hsl(var(--success))',
                                foreground: 'hsl(var(--success-foreground))'
                        },
                        warning: {
                                DEFAULT: 'hsl(var(--warning))',
                                foreground: 'hsl(var(--warning-foreground))'
                        },
                        info: {
                                DEFAULT: 'hsl(var(--info))',
                                foreground: 'hsl(var(--info-foreground))'
                        },
                        status: {
                                active: 'hsl(var(--status-active))',
                                pending: 'hsl(var(--status-pending))',
                                confirmed: 'hsl(var(--status-confirmed))',
                                cancelled: 'hsl(var(--status-cancelled))',
                                executed: 'hsl(var(--status-executed))',
                                registered: 'hsl(var(--status-registered))',
                                analysis: 'hsl(var(--status-analysis))',
                                rejected: 'hsl(var(--status-rejected))',
                                expired: 'hsl(var(--status-expired))',
                                negotiation: 'hsl(var(--status-negotiation))',
                                proposal: 'hsl(var(--status-proposal))'
                        },
                        priority: {
                                high: 'hsl(var(--priority-high))',
                                medium: 'hsl(var(--priority-medium))',
                                low: 'hsl(var(--priority-low))'
                        },
                        category: {
                                show: 'hsl(var(--category-show))',
                                product: 'hsl(var(--category-product))',
                                service: 'hsl(var(--category-service))',
                                audio: 'hsl(var(--category-audio))',
                                video: 'hsl(var(--category-video))'
                        }
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                keyframes: {
                        'accordion-down': {
                                from: {
                                        height: '0'
                                },
                                to: {
                                        height: 'var(--radix-accordion-content-height)'
                                }
                        },
                        'accordion-up': {
                                from: {
                                        height: 'var(--radix-accordion-content-height)'
                                },
                                to: {
                                        height: '0'
                                }
                        },
                        'fade-in': {
                                from: { opacity: '0' },
                                to: { opacity: '1' }
                        },
                        'fade-out': {
                                from: { opacity: '1' },
                                to: { opacity: '0' }
                        },
                        'slide-up': {
                                from: { opacity: '0', transform: 'translateY(10px)' },
                                to: { opacity: '1', transform: 'translateY(0)' }
                        },
                        'slide-down': {
                                from: { opacity: '0', transform: 'translateY(-10px)' },
                                to: { opacity: '1', transform: 'translateY(0)' }
                        },
                        'scale-in': {
                                from: { opacity: '0', transform: 'scale(0.95)' },
                                to: { opacity: '1', transform: 'scale(1)' }
                        },
                        'pulse-subtle': {
                                '0%, 100%': { opacity: '1' },
                                '50%': { opacity: '0.8' }
                        },
                        'shimmer': {
                                '0%': { backgroundPosition: '-200% 0' },
                                '100%': { backgroundPosition: '200% 0' }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'fade-in': 'fade-in 0.3s ease-out',
                        'fade-out': 'fade-out 0.2s ease-out',
                        'slide-up': 'slide-up 0.3s ease-out',
                        'slide-down': 'slide-down 0.3s ease-out',
                        'scale-in': 'scale-in 0.2s ease-out',
                        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
                        'shimmer': 'shimmer 2s linear infinite'
                },
                fontFamily: {
                        sans: [
                                'ui-sans-serif',
                                'system-ui',
                                'sans-serif',
                                'Apple Color Emoji',
                                'Segoe UI Emoji',
                                'Segoe UI Symbol',
                                'Noto Color Emoji'
                        ],
                        serif: [
                                'ui-serif',
                                'Georgia',
                                'Cambria',
                                'Times New Roman',
                                'Times',
                                'serif'
                        ],
                        mono: [
                                'ui-monospace',
                                'SFMono-Regular',
                                'Menlo',
                                'Monaco',
                                'Consolas',
                                'Liberation Mono',
                                'Courier New',
                                'monospace'
                        ]
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
