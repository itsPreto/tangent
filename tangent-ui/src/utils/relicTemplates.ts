
// Properly escape angle brackets in code templates to avoid Vue parsing issues
export const getTemplateCode = (template: string, language: string): string => {
    switch (template) {
      case 'empty':
        return '// Start coding here\n';
      case 'basic':
        if (language.includes('react')) {
          return `// Basic React Component
  
  const MyComponent = () => {
    return (
      <div className="container">
        <h1>Hello World</h1>
        <p>This is a basic React component</p>
      </div>
    );
  };
  
  export default MyComponent;`;
        } else if (language.includes('vue')) {
          return `<template>
    <div class="container">
      <h1>Hello World</h1>
      <p>This is a basic Vue component</p>
    </div>
  </template>
  
  <script setup>
  // Component logic here
  </script>
  
  <style scoped>
  .container {
    padding: 1rem;
  }
  </style>`;
        } else {
          return `// Basic JavaScript
  
  function init() {
    console.log('Hello world!');
    
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = '<h1>Hello World</h1><p>This is a basic JavaScript app</p>';
    }
  }
  
  init();`;
        }
      case 'stateful':
        if (language.includes('react')) {
          if (language.includes('typescript')) {
            return `// Stateful TypeScript React Component
  import { useState } from 'react';
  
  interface CounterProps {
    initialValue?: number;
  }
  
  const Counter = ({ initialValue = 0 }) => {
    const [count, setCount] = useState(initialValue);
  
    const increment = () => setCount(count + 1);
    const decrement = () => setCount(count - 1);
    
    return (
      <div className="counter">
        <h2>Counter: {count}</h2>
        <div className="buttons">
          <button onClick={decrement}>-</button>
          <button onClick={increment}>+</button>
        </div>
      </div>
    );
  };
  
  export default Counter;`;
          } else {
            return `// Stateful JavaScript React Component
  import { useState } from 'react';
  
  const Counter = ({ initialValue = 0 }) => {
    const [count, setCount] = useState(initialValue);
  
    const increment = () => setCount(count + 1);
    const decrement = () => setCount(count - 1);
    
    return (
      <div className="counter">
        <h2>Counter: {count}</h2>
        <div className="buttons">
          <button onClick={decrement}>-</button>
          <button onClick={increment}>+</button>
        </div>
      </div>
    );
  };
  
  export default Counter;`;
          }
        } else if (language.includes('vue')) {
          return `<template>
    <div class="counter">
      <h2>Counter: {{ count }}</h2>
      <div class="buttons">
        <button @click="decrement">-</button>
        <button @click="increment">+</button>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  
  const props = defineProps({
    initialValue: {
      type: Number,
      default: 0
    }
  });
  
  const count = ref(props.initialValue);
  
  const increment = () => count.value++;
  const decrement = () => count.value--;
  </script>
  
  <style scoped>
  .counter {
    text-align: center;
    padding: 1rem;
  }
  
  .buttons {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid #ccc;
    background: #f5f5f5;
    cursor: pointer;
  }
  </style>`;
        } else {
          return `// Stateful Vanilla JavaScript
  
  class Counter {
    constructor(elementId, initialValue = 0) {
      this.element = document.getElementById(elementId);
      this.count = initialValue;
      this.render();
      this.attachEvents();
    }
    
    increment() {
      this.count++;
      this.render();
    }
    
    decrement() {
      this.count--;
      this.render();
    }
    
    render() {
      if (!this.element) return;
      
      this.element.innerHTML = \`
        <div class="counter">
          <h2>Counter: \${this.count}</h2>
          <div class="buttons">
            <button id="decrement">-</button>
            <button id="increment">+</button>
          </div>
        </div>
      \`;
      
      this.attachEvents();
    }
    
    attachEvents() {
      if (!this.element) return;
      
      const incrementBtn = this.element.querySelector('#increment');
      const decrementBtn = this.element.querySelector('#decrement');
      
      if (incrementBtn && decrementBtn) {
        incrementBtn.addEventListener('click', () => this.increment());
        decrementBtn.addEventListener('click', () => this.decrement());
      }
    }
  }
  
  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    new Counter('app');
  });`;
        }
      case 'tailwind':
        if (language.includes('react')) {
          return `// Tailwind CSS styled React component
  
  const TailwindCard = ({ title = "Card Title", description = "This is a card description" }) => {
    return (
      <div className="max-w-sm mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl m-4">
        <div className="md:flex">
          <div className="p-8">
            <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">{title}</div>
            <p className="mt-2 text-gray-500">{description}</p>
            <button className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Learn More
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  export default TailwindCard;`;
        } else {
          return `// Tailwind CSS styled component
  
  const template = \`
    <div class="max-w-sm mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl m-4">
      <div class="md:flex">
        <div class="p-8">
          <div class="uppercase tracking-wide text-sm text-indigo-500 font-semibold">Card Title</div>
          <p class="mt-2 text-gray-500">This is a card description</p>
          <button class="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Learn More
          </button>
        </div>
      </div>
    </div>
  \`;
  
  document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = template;
    }
  });`;
        }
      default:
        return '// Start coding here';
    }
  }