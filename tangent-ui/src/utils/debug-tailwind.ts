// Debug utility to test Tailwind CSS detection
import { detectAndResolveDependencies } from './npmRegistryDetector';

const testCode = `
import React, { useState } from 'react';
import { Trash2, Plus, Check } from 'lucide-react';

const TodoList = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Todo List</h1>
        <div className="flex gap-2 mb-6">
          <input
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TodoList;
`;

// Test the Tailwind CSS detection
export async function debugTailwindDetection() {
  console.log('🔍 Testing Tailwind CSS detection...');
  
  // Test regex pattern
  const cssFrameworkDetection = {
    tailwind: /className\s*=\s*["'][^"']*\b(flex|grid|container|mx-auto|bg-\w+|text-\w+|p-\d+|m-\d+|w-\w+|h-\w+|rounded|shadow|border|hover:|focus:|dark:|md:|lg:|xl:)[^"']*["']/i,
  };
  
  const tailwindMatch = cssFrameworkDetection.tailwind.test(testCode);
  console.log('✅ Tailwind regex match:', tailwindMatch);
  
  if (tailwindMatch) {
    const matches = testCode.match(cssFrameworkDetection.tailwind);
    console.log('📝 First match:', matches?.[0]);
  }
  
  // Test full dependency detection
  try {
    const deps = await detectAndResolveDependencies(testCode, false);
    console.log('📦 Dependencies detected:', deps);
    
    if (deps.tailwindcss) {
      console.log('✅ Tailwind CSS detected:', deps.tailwindcss);
    } else {
      console.log('❌ Tailwind CSS NOT detected');
    }
  } catch (error) {
    console.error('❌ Error during detection:', error);
  }
}

// Export for browser console
if (typeof window !== 'undefined') {
  (window as any).debugTailwindDetection = debugTailwindDetection;
}