// src/config/sandpackConfig.ts
import { detectAndResolveDependencies, createEnhancedSandpackConfig, getBasicDependencies } from '@/utils/npmRegistryDetector';

// Legacy static dependencies (now as fallback)
const LEGACY_DEPENDENCIES = {
  "react": "^18.2.0",
  "three": "^0.158.0",
  "react-dom": "^18.2.0",
  "@react-three/rapier": "^2.1.0",
  "@types/three": "^0.158.2",
  "@react-three/csg": "3.0.0",
  "@react-three/drei": "9.78.1",
  "@react-three/fiber": "8.13.4",
  "@react-three/postprocessing": "2.14.13",
  "@tonejs/midi": "1.0.0",
  "lucide-react": "0.525.0",
  "simplex-noise":"4.0.3",
  "styled-components": "^5.3.11",
  "@types/styled-components": "^5.1.34"
};

// Enhanced sandbox setup with dynamic dependency detection
export async function createDynamicSandpackSetup(
  code: string,
  useNpmRegistry: boolean = true,
  includeLegacyDeps: boolean = true
) {
  try {
    // Get enhanced configuration
    const config = await createEnhancedSandpackConfig(code, 'javascript', useNpmRegistry);
    
    // Merge with legacy dependencies if requested
    const finalDependencies = includeLegacyDeps 
      ? { ...LEGACY_DEPENDENCIES, ...config.dependencies }
      : config.dependencies;
    
    return {
      dependencies: finalDependencies,
      additionalFiles: config.additionalFiles,
      options: config.options
    };
  } catch (error) {
    console.warn('Failed to create dynamic setup, falling back to legacy dependencies:', error);
    return {
      dependencies: LEGACY_DEPENDENCIES,
      additionalFiles: {},
      options: {
        autorun: true,
        recompileMode: 'immediate' as const,
        recompileDelay: 0
      }
    };
  }
}

// Smart dependency resolver that analyzes code and returns appropriate setup
export async function getSmartSandpackSetup(
  code: string,
  options: {
    useNpmRegistry?: boolean;
    includeLegacyDeps?: boolean;
    timeout?: number;
  } = {}
) {
  const {
    useNpmRegistry = true,
    includeLegacyDeps = true,
    timeout = 5000
  } = options;
  
  // Race condition: either get enhanced setup or timeout to legacy
  const enhancedSetupPromise = createDynamicSandpackSetup(code, useNpmRegistry, includeLegacyDeps);
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), timeout)
  );
  
  try {
    return await Promise.race([enhancedSetupPromise, timeoutPromise]);
  } catch (error) {
    console.warn('Enhanced setup timed out or failed, using legacy setup:', error);
    return {
      dependencies: LEGACY_DEPENDENCIES,
      additionalFiles: {},
      options: {
        autorun: true,
        recompileMode: 'immediate' as const,
        recompileDelay: 0
      }
    };
  }
}

// Legacy export for backwards compatibility
export const sandpackSetup = {
  dependencies: LEGACY_DEPENDENCIES
};

// Export utility functions
export { detectAndResolveDependencies, createEnhancedSandpackConfig, getBasicDependencies };