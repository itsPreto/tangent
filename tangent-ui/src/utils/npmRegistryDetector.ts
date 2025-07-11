// utils/npmRegistryDetector.ts
import { SandpackFiles } from '@codesandbox/sandpack-react';

interface DependencyCache {
  [packageName: string]: {
    version: string;
    fetchedAt: number;
  };
}

// Cache for npm versions (1 hour TTL)
const versionCache: DependencyCache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Extended package mappings with more libraries
const EXTENDED_PACKAGE_MAPPINGS: Record<string, { name: string; version: string }> = {
  // React ecosystem
  "react": { name: "react", version: "^18.2.0" },
  "react-dom": { name: "react-dom", version: "^18.2.0" },
  "react-router-dom": { name: "react-router-dom", version: "^6.20.0" },
  "react-hook-form": { name: "react-hook-form", version: "^7.48.0" },
  
  // State management
  "redux": { name: "redux", version: "^5.0.0" },
  "react-redux": { name: "react-redux", version: "^9.0.0" },
  "@reduxjs/toolkit": { name: "@reduxjs/toolkit", version: "^2.0.0" },
  "zustand": { name: "zustand", version: "^4.4.0" },
  "jotai": { name: "jotai", version: "^2.6.0" },
  "valtio": { name: "valtio", version: "^1.12.0" },
  
  // UI Component Libraries
  "@mui/material": { name: "@mui/material", version: "^5.15.0" },
  "@emotion/react": { name: "@emotion/react", version: "^11.11.0" },
  "@emotion/styled": { name: "@emotion/styled", version: "^11.11.0" },
  "antd": { name: "antd", version: "^5.12.0" },
  "@chakra-ui/react": { name: "@chakra-ui/react", version: "^2.8.0" },
  "@mantine/core": { name: "@mantine/core", version: "^7.3.0" },
  "@headlessui/react": { name: "@headlessui/react", version: "^1.7.0" },
  
  // Animation libraries
  "framer-motion": { name: "framer-motion", version: "^10.16.0" },
  "react-spring": { name: "react-spring", version: "^9.7.0" },
  "lottie-react": { name: "lottie-react", version: "^2.4.0" },
  "@lottiefiles/react-lottie-player": { name: "@lottiefiles/react-lottie-player", version: "^3.5.0" },
  
  // Data visualization
  "recharts": { name: "recharts", version: "^2.10.0" },
  "react-chartjs-2": { name: "react-chartjs-2", version: "^5.2.0" },
  "chart.js": { name: "chart.js", version: "^4.4.0" },
  "d3": { name: "d3", version: "^7.8.0" },
  "plotly.js": { name: "plotly.js", version: "^2.27.0" },
  
  // 3D and WebGL libraries
  "three": { name: "three", version: "^0.158.0" },
  "@react-three/fiber": { name: "@react-three/fiber", version: "^8.13.4" },
  "@react-three/drei": { name: "@react-three/drei", version: "^9.78.1" },
  "@react-three/postprocessing": { name: "@react-three/postprocessing", version: "^2.14.13" },
  "@react-three/rapier": { name: "@react-three/rapier", version: "^2.1.0" },
  "@react-three/csg": { name: "@react-three/csg", version: "^3.0.0" },
  "@types/three": { name: "@types/three", version: "^0.158.2" },
  
  // Audio and Media
  "@tonejs/midi": { name: "@tonejs/midi", version: "^1.0.0" },
  "tone": { name: "tone", version: "^14.7.0" },
  "howler": { name: "howler", version: "^2.2.0" },
  
  // Utilities
  "axios": { name: "axios", version: "^1.6.0" },
  "date-fns": { name: "date-fns", version: "^3.0.0" },
  "moment": { name: "moment", version: "^2.29.0" },
  "dayjs": { name: "dayjs", version: "^1.11.0" },
  "uuid": { name: "uuid", version: "^9.0.0" },
  "clsx": { name: "clsx", version: "^2.1.0" },
  "classnames": { name: "classnames", version: "^2.5.0" },
  "lodash": { name: "lodash", version: "^4.17.21" },
  "ramda": { name: "ramda", version: "^0.29.0" },
  "simplex-noise": { name: "simplex-noise", version: "^4.0.3" },
  
  // Forms and validation
  "formik": { name: "formik", version: "^2.4.0" },
  "yup": { name: "yup", version: "^1.3.0" },
  "zod": { name: "zod", version: "^3.22.0" },
  
  // Styling
  "tailwindcss": { name: "tailwindcss", version: "^3.4.0" },
  "autoprefixer": { name: "autoprefixer", version: "^10.4.16" },
  "postcss": { name: "postcss", version: "^8.4.32" },
  "styled-components": { name: "styled-components", version: "^5.3.11" },
  "@types/styled-components": { name: "@types/styled-components", version: "^5.1.34" },
  
  // Icons
  "lucide-react": { name: "lucide-react", version: "^0.525.0" },
  "react-icons": { name: "react-icons", version: "^4.12.0" },
  "@heroicons/react": { name: "@heroicons/react", version: "^2.0.0" },
  
  // Testing
  "@testing-library/react": { name: "@testing-library/react", version: "^13.4.0" },
  "@testing-library/jest-dom": { name: "@testing-library/jest-dom", version: "^5.16.0" },
  "vitest": { name: "vitest", version: "^1.0.0" },
  "jest": { name: "jest", version: "^29.7.0" },
};

export async function fetchPackageVersion(packageName: string): Promise<string> {
  // Check cache first
  const cached = versionCache[packageName];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.version;
  }
  
  // Check extended mappings
  if (EXTENDED_PACKAGE_MAPPINGS[packageName]) {
    return EXTENDED_PACKAGE_MAPPINGS[packageName].version;
  }
  
  try {
    // Try to fetch from npm registry
    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const version = `^${data.version}`;
      
      // Cache the result
      versionCache[packageName] = {
        version,
        fetchedAt: Date.now(),
      };
      
      return version;
    }
  } catch (error) {
    console.warn(`Failed to fetch version for ${packageName}, using 'latest'`);
  }
  
  return "latest";
}

export async function detectAndResolveDependencies(
  code: string,
  useNpmRegistry: boolean = true
): Promise<Record<string, string>> {
  const dependencies: Record<string, string> = {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "^5.0.1"
  };
  
  // Enhanced regex patterns
  const importPatterns = [
    // ES6 imports
    /import\s+(?:(?:\{[^}]*\})|(?:\*\s+as\s+\w+)|(?:\w+))?\s*(?:,\s*(?:\{[^}]*\}|\w+))?\s*from\s*['"]([^'"]+)['"]/g,
    // Dynamic imports
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // Require statements
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // CSS imports
    /@import\s+['"]([^'"]+)['"]/g,
  ];
  
  const imports = new Set<string>();
  
  for (const pattern of importPatterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      imports.add(match[1]);
    }
  }
  
  // Detect CSS framework usage
  const cssFrameworkDetection = {
    tailwind: /className\s*=\s*["'][^"']*\b(flex|grid|container|mx-auto|bg-\w+|text-\w+|p-\d+|m-\d+|w-\w+|h-\w+|rounded|shadow|border|hover:|focus:|dark:|md:|lg:|xl:)[^"']*["']/i,
    bootstrap: /className\s*=\s*["'][^"']*\b(btn|btn-primary|container-fluid|row|col|navbar|modal|card|form-control)[^"']*["']/i,
    bulma: /className\s*=\s*["'][^"']*\b(button|is-primary|container|columns|column|navbar|modal|card|field|control)[^"']*["']/i,
  };
  
  // Check for CSS frameworks
  if (cssFrameworkDetection.tailwind.test(code)) {
    dependencies["tailwindcss"] = await (useNpmRegistry ? 
      fetchPackageVersion("tailwindcss") : 
      EXTENDED_PACKAGE_MAPPINGS["tailwindcss"]?.version || "^3.4.0");
    dependencies["autoprefixer"] = await (useNpmRegistry ? 
      fetchPackageVersion("autoprefixer") : 
      EXTENDED_PACKAGE_MAPPINGS["autoprefixer"]?.version || "^10.4.16");
    dependencies["postcss"] = await (useNpmRegistry ? 
      fetchPackageVersion("postcss") : 
      EXTENDED_PACKAGE_MAPPINGS["postcss"]?.version || "^8.4.32");
  }
  
  // Process imports and get versions
  const versionPromises: Promise<void>[] = [];
  
  for (const importPath of imports) {
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      continue;
    }
    
    const packageName = extractPackageName(importPath);
    
    versionPromises.push(
      (async () => {
        const version = await (useNpmRegistry ? 
          fetchPackageVersion(packageName) : 
          Promise.resolve(EXTENDED_PACKAGE_MAPPINGS[packageName]?.version || "latest"));
        dependencies[packageName] = version;
      })()
    );
  }
  
  // Wait for all version fetches to complete
  await Promise.all(versionPromises);
  
  return dependencies;
}

function extractPackageName(importPath: string): string {
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.slice(0, 2).join('/');
  }
  return importPath.split('/')[0];
}

// Create enhanced Sandpack configuration
export async function createEnhancedSandpackConfig(
  code: string,
  language: string,
  useNpmRegistry: boolean = true
) {
  const dependencies = await detectAndResolveDependencies(code, useNpmRegistry);
  
  // Detect if we need additional configuration files
  const needsTailwindConfig = !!dependencies.tailwindcss;
  const additionalFiles: SandpackFiles = {};
  
  if (needsTailwindConfig) {
    // Add comprehensive Tailwind CSS setup
    additionalFiles["/public/index.html"] = {
      code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Sandpack React App with Tailwind CSS" />
    <title>React App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ['Inter', 'system-ui', 'sans-serif'],
            }
          }
        }
      }
    </script>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    </style>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`
    };
    
    // Add Tailwind CSS imports to the main CSS file
    additionalFiles["/src/index.css"] = {
      code: `/* Tailwind CSS imports */
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

/* Custom styles */
body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

/* Additional utility classes */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}`
    };
    
    additionalFiles["/tailwind.config.js"] = {
      code: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    },
  },
  plugins: [],
}`
    };
    
    additionalFiles["/postcss.config.js"] = {
      code: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
    };
  }
  
  return {
    dependencies,
    additionalFiles,
    options: {
      autorun: true,
      recompileMode: 'immediate' as const,
      recompileDelay: 0,
      externalResources: needsTailwindConfig ? [
        "https://cdn.tailwindcss.com",
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
      ] : []
    }
  };
}

// Helper function to get basic dependencies for fallback
export function getBasicDependencies(): Record<string, string> {
  return {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "^5.0.1"
  };
}

// Helper function to merge dependencies
export function mergeDependencies(
  base: Record<string, string>,
  additional: Record<string, string>
): Record<string, string> {
  return { ...base, ...additional };
}