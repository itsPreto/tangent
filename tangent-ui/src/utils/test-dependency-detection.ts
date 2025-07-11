// Test file for dependency detection
import { detectAndResolveDependencies, createEnhancedSandpackConfig } from './npmRegistryDetector';

// Test cases
const testCases = [
  {
    name: 'Basic React Component',
    code: `
import React from 'react';
import { useState } from 'react';

const MyComponent = () => {
  const [count, setCount] = useState(0);
  return <div>Count: {count}</div>;
};

export default MyComponent;
    `
  },
  {
    name: 'Three.js Scene',
    code: `
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

const Scene = () => {
  return (
    <Canvas>
      <OrbitControls />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
    </Canvas>
  );
};

export default Scene;
    `
  },
  {
    name: 'Tailwind CSS Component',
    code: `
import React from 'react';
import { motion } from 'framer-motion';

const TailwindComponent = () => {
  return (
    <motion.div 
      className="flex items-center justify-center h-screen bg-gradient-to-r from-blue-500 to-purple-600"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Hello Tailwind!</h1>
        <p className="text-gray-600">This is a responsive card component.</p>
      </div>
    </motion.div>
  );
};

export default TailwindComponent;
    `
  },
  {
    name: 'User Todo List (Your Code)',
    code: `
import React, { useState } from 'react';
import { Trash2, Plus, Check } from 'lucide-react';

const TodoList = () => {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Learn React', completed: false },
    { id: 2, text: 'Build a Todo App', completed: false },
    { id: 3, text: 'Master TypeScript', completed: false }
  ]);
  const [inputValue, setInputValue] = useState('');

  const addTodo = () => {
    if (inputValue.trim()) {
      setTodos([...todos, {
        id: Date.now(),
        text: inputValue,
        completed: false
      }]);
      setInputValue('');
    }
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const toggleComplete = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Todo List</h1>
        
        {/* Add Todo Form */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new todo..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addTodo}
            className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={24} />
          </button>
        </div>

        {/* Todo Items */}
        <div className="space-y-2">
          {todos.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No todos yet. Add one above!</p>
          ) : (
            todos.map(todo => (
              <div
                key={todo.id}
                className={\`flex items-center gap-3 p-3 rounded-lg border transition-all $\{
                  todo.completed 
                    ? 'bg-gray-50 border-gray-200' 
                    : 'bg-white border-gray-300 hover:shadow-sm'
                }\`}
              >
                <button
                  onClick={() => toggleComplete(todo.id)}
                  className={\`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors $\{
                    todo.completed
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 hover:border-green-500'
                  }\`}
                >
                  {todo.completed && <Check size={16} className="text-white" />}
                </button>
                
                <span className={\`flex-1 $\{todo.completed ? 'line-through text-gray-500' : 'text-gray-800'}\`}>
                  {todo.text}
                </span>
                
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Stats */}
        {todos.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-600 text-center">
            {todos.filter(todo => !todo.completed).length} of {todos.length} tasks remaining
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoList;
    `
  },
  {
    name: 'Complex Dependencies',
    code: `
import React, { useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const ComplexComponent = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/data');
      setData(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">
        Data Dashboard - {format(new Date(), 'PPP')}
      </h2>
      
      <AnimatePresence>
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center items-center h-64"
          >
            <div className="loading loading-spinner loading-lg"></div>
          </motion.div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </AnimatePresence>
      
      <button 
        onClick={fetchData}
        className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Refresh Data
      </button>
    </motion.div>
  );
};

export default ComplexComponent;
    `
  }
];

// Test function
export async function testDependencyDetection() {
  console.log('🧪 Testing Dependency Detection...\n');
  
  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log('─'.repeat(50));
    
    try {
      const startTime = Date.now();
      const dependencies = await detectAndResolveDependencies(testCase.code, false);
      const endTime = Date.now();
      
      console.log(`⏱️  Time taken: ${endTime - startTime}ms`);
      console.log(`📦 Dependencies found: ${Object.keys(dependencies).length}`);
      
      Object.entries(dependencies).forEach(([pkg, version]) => {
        console.log(`  • ${pkg}: ${version}`);
      });
      
      // Test enhanced config
      const config = await createEnhancedSandpackConfig(testCase.code, 'javascript', false);
      console.log(`🔧 Additional files: ${Object.keys(config.additionalFiles).length}`);
      if (Object.keys(config.additionalFiles).length > 0) {
        Object.keys(config.additionalFiles).forEach(file => {
          console.log(`  • ${file}`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${testCase.name}:`, error);
    }
  }
  
  console.log('\n✅ Dependency detection test complete!');
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testDependencyDetection = testDependencyDetection;
}