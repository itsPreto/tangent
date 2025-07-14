<template>
  <div class="terminal-feature" :class="'theme-' + currentTheme">
    <div class="terminal-content">
      <!-- Terminal Header -->
      <div class="terminal-header" :style="headerStyle">
        <div class="header-section">
          <Terminal class="w-5 h-5 text-gray-400" />
          <span class="header-text">Terminal</span>
          <div class="status-indicator" :class="{ 'connected': isConnected }">
            {{ isConnected ? 'Connected' : 'Disconnected' }}
          </div>
        </div>
        <div class="header-controls">
          <button @click="clearTerminal" class="control-btn" :style="buttonStyle">
            <Trash2 class="w-4 h-4" />
          </button>
          <button @click="toggleConnection" class="control-btn" :style="buttonStyle">
            <Power class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Terminal Display -->
      <div class="terminal-display" ref="terminalDisplay" :style="terminalStyle">
        <div class="terminal-output">
          <div 
            v-for="(line, index) in terminalLines" 
            :key="index"
            class="terminal-line"
            :class="line.type">
            <span class="line-prefix">{{ line.prefix }}</span>
            <span class="line-content">{{ line.content }}</span>
          </div>
        </div>
        
        <!-- Input Line -->
        <div class="terminal-input-line" v-if="isConnected">
          <span class="input-prefix">$ </span>
          <input 
            ref="terminalInput"
            v-model="currentInput"
            @keydown.enter="executeCommand"
            @keydown.up="navigateHistory(-1)"
            @keydown.down="navigateHistory(1)"
            class="terminal-input"
            :style="inputStyle"
            placeholder="Enter command..."
            spellcheck="false" />
          <span class="cursor" :class="{ 'blink': isConnected }">_</span>
        </div>
      </div>

      <!-- Terminal Status Bar -->
      <div class="terminal-status" :style="statusStyle">
        <div class="status-left">
          <span class="status-item">
            <Clock class="w-3 h-3" />
            {{ currentTime }}
          </span>
          <span class="status-item">
            <User class="w-3 h-3" />
            user@tangent
          </span>
        </div>
        <div class="status-right">
          <span class="status-item">Lines: {{ terminalLines.length }}</span>
          <span class="status-item">{{ currentDirectory }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { Terminal, Trash2, Power, Clock, User } from 'lucide-vue-next';
import { useThemeStore } from '@/stores/themeStore';

// Stores
const themeStore = useThemeStore();

// Reactive state
const isConnected = ref(true);
const currentInput = ref('');
const currentDirectory = ref('~/projects/tangent');
const terminalDisplay = ref<HTMLElement>();
const terminalInput = ref<HTMLInputElement>();
const currentTime = ref(new Date().toLocaleTimeString());
const commandHistory = ref<string[]>([]);
const historyIndex = ref(-1);

// Mock terminal lines
const terminalLines = ref([
  { type: 'system', prefix: '', content: 'Welcome to Tangent Terminal v1.0.0' },
  { type: 'system', prefix: '', content: 'Type "help" for available commands.' },
  { type: 'system', prefix: '', content: '' },
  { type: 'command', prefix: '$ ', content: 'npm start' },
  { type: 'output', prefix: '', content: '> tangent-ui@1.0.0 start' },
  { type: 'output', prefix: '', content: '> vite' },
  { type: 'success', prefix: '', content: '✓ Server running on http://localhost:3000' },
  { type: 'system', prefix: '', content: '' }
]);

// Available commands
const commands = {
  help: () => [
    'Available commands:',
    '  help       - Show this help message',
    '  clear      - Clear terminal output',
    '  ls         - List directory contents',
    '  pwd        - Print working directory',
    '  cd <dir>   - Change directory',
    '  npm <cmd>  - Run npm command',
    '  git <cmd>  - Run git command',
    '  echo <msg> - Echo message',
    '  date       - Show current date and time',
    '  whoami     - Show current user'
  ],
  
  clear: () => {
    terminalLines.value = [];
    return [];
  },
  
  ls: () => [
    'src/',
    'public/',
    'node_modules/',
    'package.json',
    'vite.config.ts',
    'tsconfig.json',
    'README.md'
  ],
  
  pwd: () => [currentDirectory.value],
  
  date: () => [new Date().toString()],
  
  whoami: () => ['user'],
  
  echo: (args: string[]) => [args.join(' ')],
  
  npm: (args: string[]) => {
    const command = args[0];
    switch (command) {
      case 'install':
        return [
          'Installing dependencies...',
          'added 1247 packages in 3.4s',
          '✓ Installation complete'
        ];
      case 'run':
        return [
          `> tangent-ui@1.0.0 ${args[1] || 'dev'}`,
          '✓ Build successful'
        ];
      case 'test':
        return [
          'Running tests...',
          '✓ All tests passed (12 tests, 0 failures)'
        ];
      default:
        return [`npm: command '${command}' not found`];
    }
  },
  
  git: (args: string[]) => {
    const command = args[0];
    switch (command) {
      case 'status':
        return [
          'On branch main',
          'Your branch is up to date with \'origin/main\'.',
          '',
          'Changes not staged for commit:',
          '  modified:   src/App.vue',
          '  modified:   src/stores/appStore.ts'
        ];
      case 'log':
        return [
          'commit abc123 (HEAD -> main)',
          'Author: User <user@tangent.ai>',
          'Date:   ' + new Date().toDateString(),
          '',
          '    Add dual sidebar functionality'
        ];
      default:
        return [`git: '${command}' is not a git command.`];
    }
  },
  
  cd: (args: string[]) => {
    const dir = args[0] || '~';
    if (dir === '..') {
      const parts = currentDirectory.value.split('/');
      parts.pop();
      currentDirectory.value = parts.join('/') || '/';
    } else if (dir === '~') {
      currentDirectory.value = '~/projects/tangent';
    } else {
      currentDirectory.value = currentDirectory.value + '/' + dir;
    }
    return [];
  }
};

// Theme reactivity
const currentTheme = computed(() => themeStore.currentTheme);
const isDarkTheme = computed(() => themeStore.isDarkTheme(currentTheme.value));
const themeColors = computed(() => themeStore.getThemeColors(currentTheme.value));

// Methods
const executeCommand = () => {
  if (!currentInput.value.trim() || !isConnected.value) return;
  
  const command = currentInput.value.trim();
  commandHistory.value.push(command);
  historyIndex.value = -1;
  
  // Add command to terminal
  addTerminalLine('command', '$ ', command);
  
  // Parse and execute command
  const parts = command.split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);
  
  let output: string[] = [];
  
  if (cmd in commands) {
    output = commands[cmd](args);
  } else {
    output = [`Command not found: ${cmd}. Type "help" for available commands.`];
  }
  
  // Add output to terminal
  output.forEach(line => {
    const type = line.startsWith('✓') ? 'success' : 
                 line.startsWith('Error') || line.includes('not found') ? 'error' : 'output';
    addTerminalLine(type, '', line);
  });
  
  // Clear input
  currentInput.value = '';
  
  // Scroll to bottom
  nextTick(() => {
    scrollToBottom();
  });
};

const addTerminalLine = (type: string, prefix: string, content: string) => {
  terminalLines.value.push({ type, prefix, content });
};

const navigateHistory = (direction: number) => {
  if (commandHistory.value.length === 0) return;
  
  if (direction === -1) {
    // Up arrow - go back in history
    if (historyIndex.value === -1) {
      historyIndex.value = commandHistory.value.length - 1;
    } else if (historyIndex.value > 0) {
      historyIndex.value--;
    }
  } else {
    // Down arrow - go forward in history
    if (historyIndex.value < commandHistory.value.length - 1) {
      historyIndex.value++;
    } else {
      historyIndex.value = -1;
      currentInput.value = '';
      return;
    }
  }
  
  if (historyIndex.value >= 0) {
    currentInput.value = commandHistory.value[historyIndex.value];
  }
};

const clearTerminal = () => {
  terminalLines.value = [];
  addTerminalLine('system', '', 'Terminal cleared');
};

const toggleConnection = () => {
  isConnected.value = !isConnected.value;
  if (isConnected.value) {
    addTerminalLine('success', '', 'Terminal connected');
    nextTick(() => {
      terminalInput.value?.focus();
    });
  } else {
    addTerminalLine('error', '', 'Terminal disconnected');
  }
};

const scrollToBottom = () => {
  if (terminalDisplay.value) {
    terminalDisplay.value.scrollTop = terminalDisplay.value.scrollHeight;
  }
};

// Update current time
const updateTime = () => {
  currentTime.value = new Date().toLocaleTimeString();
};

// Computed styles
const headerStyle = computed(() => {
  return {
    borderBottom: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`,
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 20, 0.5)' : 'rgba(240, 240, 240, 0.5)'
  };
});

const buttonStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(40, 40, 40, 0.8)' : 'rgba(240, 240, 240, 0.8)',
    color: isDarkTheme.value ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
    border: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`
  };
});

const terminalStyle = computed(() => {
  return {
    backgroundColor: isDarkTheme.value ? 'rgba(0, 0, 0, 0.9)' : 'rgba(248, 248, 248, 0.9)',
    color: isDarkTheme.value ? '#00ff00' : '#000000',
    fontFamily: 'Monaco, Consolas, "Courier New", monospace'
  };
});

const inputStyle = computed(() => {
  return {
    backgroundColor: 'transparent',
    color: 'inherit',
    border: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit'
  };
});

const statusStyle = computed(() => {
  return {
    borderTop: `1px solid ${isDarkTheme.value ? 'rgba(80, 80, 80, 0.3)' : 'rgba(200, 200, 200, 0.3)'}`,
    backgroundColor: isDarkTheme.value ? 'rgba(20, 20, 20, 0.8)' : 'rgba(240, 240, 240, 0.8)'
  };
});

// Lifecycle
onMounted(() => {
  const timeInterval = setInterval(updateTime, 1000);
  
  // Focus terminal input
  nextTick(() => {
    terminalInput.value?.focus();
  });
  
  onUnmounted(() => {
    clearInterval(timeInterval);
  });
});
</script>

<style scoped>
.terminal-feature {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.terminal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terminal-header {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-text {
  font-weight: 600;
  font-size: 16px;
}

.status-indicator {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.status-indicator.connected {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.header-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  opacity: 0.8;
}

.terminal-display {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.4;
  border-radius: 8px;
  margin: 16px;
}

.terminal-output {
  margin-bottom: 8px;
}

.terminal-line {
  margin-bottom: 2px;
  white-space: pre-wrap;
  word-break: break-word;
}

.terminal-line.command {
  color: #60a5fa;
}

.terminal-line.success {
  color: #10b981;
}

.terminal-line.error {
  color: #ef4444;
}

.terminal-line.system {
  color: #9ca3af;
}

.line-prefix {
  color: #fbbf24;
  font-weight: 600;
}

.terminal-input-line {
  display: flex;
  align-items: center;
  gap: 4px;
}

.input-prefix {
  color: #fbbf24;
  font-weight: 600;
}

.terminal-input {
  flex: 1;
  min-width: 0;
}

.cursor {
  opacity: 0;
  transition: opacity 0.1s ease;
}

.cursor.blink {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.terminal-status {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  font-size: 11px;
}

.status-left,
.status-right {
  display: flex;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.7;
}
</style>