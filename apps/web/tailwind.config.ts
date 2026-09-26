import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          active: "hsl(var(--primary-active))",
          soft: "hsl(var(--primary-soft))",
          "border-soft": "hsl(var(--primary-border-soft))",
        },

        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },

        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
        },

        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },

        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          hover: "hsl(var(--accent-hover))",
        },

        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          secondary: "hsl(var(--sidebar-background-secondary))",
          foreground: "hsl(var(--sidebar-foreground))",
          muted: "hsl(var(--sidebar-muted))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground":
            "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground":
            "hsl(var(--sidebar-accent-foreground))",
          active: "hsl(var(--sidebar-active))",
          "active-foreground":
            "hsl(var(--sidebar-active-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
        },

        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
        },

        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
        },

        status: {
          active: "hsl(var(--status-active))",
          pending: "hsl(var(--status-pending))",
          confirmed: "hsl(var(--status-confirmed))",
          cancelled: "hsl(var(--status-cancelled))",
          executed: "hsl(var(--status-executed))",
          registered: "hsl(var(--status-registered))",
          analysis: "hsl(var(--status-analysis))",
          rejected: "hsl(var(--status-rejected))",
          expired: "hsl(var(--status-expired))",
          negotiation: "hsl(var(--status-negotiation))",
          proposal: "hsl(var(--status-proposal))",
        },

        priority: {
          high: "hsl(var(--priority-high))",
          medium: "hsl(var(--priority-medium))",
          low: "hsl(var(--priority-low))",
        },

        category: {
          show: "hsl(var(--category-show))",
          product: "hsl(var(--category-product))",
          service: "hsl(var(--category-service))",
          audio: "hsl(var(--category-audio))",
          video: "hsl(var(--category-video))",
        },

        surface: {
          "1": "hsl(var(--surface-1))",
          "2": "hsl(var(--surface-2))",
          "3": "hsl(var(--surface-3))",
        },

        // Scoped to `.landing-theme` (see index.css) — not used outside the
        // institutional landing page.
        landing: {
          dark: "hsl(var(--landing-dark))",
          darker: "hsl(var(--landing-darker))",
          foreground: "hsl(var(--landing-dark-foreground))",
          accent: "hsl(var(--landing-accent-light))",
        },
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "elevation-1": "var(--shadow-sm)",
        "elevation-2": "var(--shadow-md)",
        "elevation-3": "var(--shadow-lg)",
        "elevation-4": "var(--shadow-xl)",
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: {
            height:
              "var(--radix-accordion-content-height)",
          },
        },

        "accordion-up": {
          from: {
            height:
              "var(--radix-accordion-content-height)",
          },
          to: { height: "0" },
        },

        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },

        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },

        "slide-up": {
          from: {
            opacity: "0",
            transform: "translateY(10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },

        "slide-down": {
          from: {
            opacity: "0",
            transform: "translateY(-10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },

      animation: {
        "accordion-down":
          "accordion-down 0.2s ease-out",
        "accordion-up":
          "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
      },

      fontFamily: {
        sans: [
          '"Geist"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji',
        ],

        serif: [
          'ui-serif',
          'Georgia',
          'Cambria',
          'Times New Roman',
          'Times',
          'serif',
        ],

        mono: [
          '"Geist"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;