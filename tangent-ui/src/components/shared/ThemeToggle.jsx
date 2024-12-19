import React, { useState } from 'react';
import { Sun, Moon, Sparkles, Atom, Stars, Cloud } from 'lucide-react';
import { Button } from '../core/button';
import { motion, AnimatePresence } from 'framer-motion';

export function ThemeToggle({ theme, setTheme }) {
  const [isOpen, setIsOpen] = useState(false);

  const themes = [
    {
      name: 'light',
      icon: Sun,
      label: 'Light',
      className: 'text-amber-500'
    },
    {
      name: 'dark',
      icon: Moon,
      label: 'Dark',
      className: 'text-slate-900 dark:text-slate-100'
    },
    {
      name: 'hextech-nordic',
      icon: Sparkles,
      label: 'Nordic',
      className: 'text-[hsl(195,96%,65%)]'
    },
    {
      name: 'singed-theme',
      icon: Atom,
      label: 'Cyber',
      className: 'text-[hsl(150,70%,35%)]'
    },
    {
      name: 'celestial-theme',
      icon: Stars,
      label: 'Celestial',
      className: 'text-[hsl(280,90%,70%)]'
    },
    {
      name: 'void-theme',
      icon: Cloud,
      label: 'Void',
      className: 'text-[hsl(270,100%,60%)]'
    }
  ];

  const currentTheme = themes.find(t => t.name === theme) || themes[0];
  const Icon = currentTheme.icon;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 transition-colors ${
          theme === 'hextech-nordic' ? 'glow pulse' :
          theme === 'celestial-theme' ? 'celestial-shimmer' :
          theme === 'void-theme' ? 'void-pulse' : ''
        }`}
      >
        <Icon className={`h-4 w-4 transition-all ${themes.find(t => t.name === theme)?.className}`} />
        <span className="sr-only">Toggle theme</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-2 origin-top-right z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-36 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
            >
              {themes.map((t) => {
                const ThemeIcon = t.icon;
                return (
                  <motion.button
                    key={t.name}
                    onClick={() => {
                      document.documentElement.classList.remove(
                        'light', 'dark', 'hextech-nordic', 
                        'singed-theme', 'celestial-theme', 'void-theme'
                      );
                      document.documentElement.classList.add(t.name);
                      setTheme(t.name);
                      localStorage.setItem('theme', t.name);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-2 px-2 py-1.5 text-sm
                      transition-colors hover:bg-accent
                      ${theme === t.name ? 'bg-accent' : ''}
                      ${t.name === 'hextech-nordic' ? 'hover:text-[hsl(195,96%,65%)]' : ''}
                      ${t.name === 'celestial-theme' ? 'hover:text-[hsl(280,90%,70%)]' : ''}
                      ${t.name === 'void-theme' ? 'hover:text-[hsl(270,100%,60%)]' : ''}
                    `}
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ThemeIcon className={`h-4 w-4 ${t.className}`} />
                    <span>{t.label}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}