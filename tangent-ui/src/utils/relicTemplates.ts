import { SandpackFiles } from "sandpack-vue3";

export const getTemplateCode = (template: string, language: string): string => {
  // Handle Python templates first
  if (language === 'python') {
    switch (template) {
      case 'empty':
        return '# Start coding here\n';
      case 'basic':
        return `# Basic Python Script

def main():
    print("Hello, World!")
    print("This is a basic Python script")

if __name__ == "__main__":
    main()`;
      case 'stateful':
        return `# Stateful Python Class Example

class Counter:
    def __init__(self, initial_value=0):
        self.count = initial_value
    
    def increment(self):
        self.count += 1
        return self.count
    
    def decrement(self):
        self.count -= 1
        return self.count
    
    def reset(self):
        self.count = 0
        return self.count
    
    def get_count(self):
        return self.count

def main():
    counter = Counter(5)
    print(f"Initial count: {counter.get_count()}")
    
    print(f"After increment: {counter.increment()}")
    print(f"After increment: {counter.increment()}")
    print(f"After decrement: {counter.decrement()}")
    print(f"After reset: {counter.reset()}")

if __name__ == "__main__":
    main()`;
      case 'tailwind':
        return `# Python Data Processing Example

import json
from datetime import datetime

def process_data(data):
    """Process and format data"""
    processed = []
    
    for item in data:
        processed_item = {
            'id': item.get('id', 'unknown'),
            'title': item.get('title', 'Untitled').title(),
            'description': item.get('description', 'No description'),
            'timestamp': datetime.now().isoformat(),
            'processed': True
        }
        processed.append(processed_item)
    
    return processed

def main():
    # Sample data
    sample_data = [
        {'id': 1, 'title': 'first item', 'description': 'This is the first item'},
        {'id': 2, 'title': 'second item', 'description': 'This is the second item'},
        {'id': 3, 'title': 'third item', 'description': 'This is the third item'}
    ]
    
    # Process the data
    result = process_data(sample_data)
    
    # Pretty print the result
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()`;
      default:
        return '# Start coding here\n';
    }
  }

  // Handle Vue templates
  if (language === 'vue') {
    switch (template) {
      case 'empty':
        return `<template>
  <div>
    <!-- Start coding here -->
  </div>
</template>

<script setup>
// Component logic here
</script>

<style scoped>
/* Component styles here */
</style>`;
      case 'basic':
        return `<template>
  <div class="container">
    <h1>Hello World</h1>
    <p>This is a basic Vue component</p>
    <button @click="handleClick" class="btn">
      Click me!
    </button>
  </div>
</template>

<script setup>
const handleClick = () => {
  alert('Hello from Vue!');
};
</script>

<style scoped>
.container {
  padding: 2rem;
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: inherit;
  color: inherit;
  min-height: 100vh;
}

.btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 1rem;
}

.btn:hover {
  background: #369870;
}
</style>`;
      case 'stateful':
        return `<template>
  <div class="counter">
    <h2>Counter: {{ count }}</h2>
    <div class="buttons">
      <button @click="decrement" class="btn btn-secondary">-</button>
      <button @click="increment" class="btn btn-primary">+</button>
    </div>
    <button @click="reset" class="btn btn-outline">Reset</button>
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
const reset = () => count.value = props.initialValue;
</script>

<style scoped>
.counter {
  text-align: center;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin: 1rem 0;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #42b883;
  color: white;
  border-color: #42b883;
}

.btn-primary:hover {
  background: #369870;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border-color: #6c757d;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-outline {
  background: transparent;
  color: #42b883;
  border-color: #42b883;
}

.btn-outline:hover {
  background: #42b883;
  color: white;
}
</style>`;
      case 'tailwind':
        return `<template>
  <div class="max-w-sm mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl m-4">
    <div class="md:flex">
      <div class="p-8">
        <div class="uppercase tracking-wide text-sm text-indigo-500 font-semibold">{{ title }}</div>
        <p class="mt-2 text-gray-500">{{ description }}</p>
        <button @click="handleClick" 
                class="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          Learn More
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    default: 'Card Title'
  },
  description: {
    type: String,
    default: 'This is a card description'
  }
});

const handleClick = () => {
  alert('Learn more clicked!');
};
</script>

<style>
/* Tailwind classes handle most styling */
</style>`;
      default:
        return `<template>
  <div>
    <!-- Start coding here -->
  </div>
</template>

<script setup>
// Component logic here
</script>

<style scoped>
/* Component styles here */
</style>`;
    }
  }

  // Handle React/JavaScript/TypeScript templates
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

const Counter = ({ initialValue = 0 }: CounterProps) => {
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

export const getFiles = (code: string, currentLanguage: string): SandpackFiles => {
  const mainFile = { code, active: true };
  
  // Handle Vue SFC files
  if (currentLanguage === 'vue') {
    const htmlTemplate = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '    <title>Vue App</title>',
      '  </head>',
      '  <body>',
      '    <div id="app"></div>',
      '    <script type="module" src="/src/main.js"></script>',
      '  </body>',
      '</html>'
    ].join('\n');
    
    return {
      '/App.vue': mainFile,
      '/src/main.js': {
        code: [
          'import { createApp } from \'vue\'',
          'import App from \'./App.vue\'',
          'import \'./style.css\'',
          '',
          'createApp(App).mount(\'#app\')'
        ].join('\n'),
        hidden: true
      },
      '/src/style.css': {
        code: [
          'html, body, #app {',
          '  width: 100vw;',
          '  height: 100vh;',
          '  margin: 0;',
          '  padding: 0;',
          '  overflow: hidden;',
          '  font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;',
          '  background-color: var(--fallback-b1, oklch(var(--b1)));',
          '  color: var(--fallback-bc, oklch(var(--bc)));',
          '}',
          '',
          '/* Dark theme support */',
          '@media (prefers-color-scheme: dark) {',
          '  html, body, #app {',
          '    background-color: #1a1a1a;',
          '    color: #e5e5e5;',
          '  }',
          '}'
        ].join('\n'),
        hidden: true
      },
      '/index.html': {
        code: htmlTemplate,
        hidden: true
      }
    };
  }
  
  // Handle React/JavaScript/TypeScript files
  if (currentLanguage === 'javascript' || 
      currentLanguage === 'react' || 
      currentLanguage === 'typescript' || 
      currentLanguage === 'typescriptreact') {
    
    const fileExtension = currentLanguage === 'typescript' || currentLanguage === 'typescriptreact' 
      ? (currentLanguage === 'typescriptreact' ? '.tsx' : '.ts')
      : (currentLanguage === 'react' ? '.jsx' : '.js');
    
    return {
      [`/App${fileExtension}`]: mainFile,
      '/index.js': {
        code: [
          'import { StrictMode } from "react";',
          'import { createRoot } from "react-dom/client";',
          'import App from "./App";',
          'import \'./styles.css\';',
          '',
          'const root = createRoot(document.getElementById("root"));',
          'root.render(',
          '  <StrictMode>',
          '    <App />',
          '  </StrictMode>',
          ');'
        ].join('\n'),
        hidden: true
      },
      '/styles.css': {
        code: [
          'html, body, #root {',
          '  width: 100vw;',
          '  height: 100vh;',
          '  margin: 0;',
          '  padding: 0;',
          '  overflow: hidden;',
          '  font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;',
          '  background-color: var(--fallback-b1, oklch(var(--b1)));',
          '  color: var(--fallback-bc, oklch(var(--bc)));',
          '}',
          '',
          '/* Dark theme support */',
          '@media (prefers-color-scheme: dark) {',
          '  html, body, #root {',
          '    background-color: #1a1a1a;',
          '    color: #e5e5e5;',
          '  }',
          '}',
          '',
          '/* Additional theming */',
          '.container {',
          '  background-color: inherit;',
          '  color: inherit;',
          '}'
        ].join('\n'),
        hidden: true
      }
    };
  }
  
  // Handle Python files
  if (currentLanguage === 'python') {
    return {
      '/main.py': mainFile
    };
  }
  
  // Default fallback for other languages
  return { '/App.js': mainFile };
};