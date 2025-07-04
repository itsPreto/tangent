<template>
  <div class="floating-configurator" :style="mainStyle">
    <!-- Floating Panel Container -->
    <div class="panel-container">

      <!-- Main Content Area -->
      <div class="panel-body">

        <!-- Tab Header -->
        <div class="tab-header">
          <!-- Tab Navigation -->
          <div class="tab-nav">
            <button @click="activeTab = 'agents'" class="tab-btn" :class="{ active: activeTab === 'agents' }">
              <span class="tab-icon">⚙️</span>
              <span class="tab-label">Agents</span>
            </button>
            <button @click="activeTab = 'testing'" class="tab-btn" :class="{ active: activeTab === 'testing' }">
              <span class="tab-icon">🧪</span>
              <span class="tab-label">Testing</span>
            </button>
          </div>
        </div>

        <!-- API Configuration (Collapsible) -->
        <div v-if="showApiConfig" class="api-config-section">
          <div class="api-grid">
            <div v-for="provider in apiProviders.filter(p => p.id !== 'ollama')" :key="provider.id"
              class="api-input-row">
              <div class="api-label">{{ provider.name }}</div>
              <div class="api-input-group">
                <input v-model="apiKeys[provider.id]" type="password" :placeholder="provider.placeholder"
                  class="api-input-compact" @keydown.enter="saveApiKey(provider.id)" />
                <button @click="saveApiKey(provider.id)" class="save-btn-compact" :disabled="!apiKeys[provider.id]">
                  <Check class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Agents Tab Content -->
        <div v-if="activeTab === 'agents'" class="tab-content">
          <!-- Stats and API Status Row -->
          <div class="agents-header-row">
            <!-- Stats Mini Cards -->
            <div class="stats-row">
              <div class="mini-stat">
                <span class="stat-value">{{ totalModels }}</span>
                <span class="stat-label">Models</span>
              </div>
              <div class="mini-stat">
                <span class="stat-value">{{ freeModelsCount }}</span>
                <span class="stat-label">Free</span>
              </div>
              <div class="mini-stat">
                <span class="stat-value">{{ configuredAgentsCount }}/4</span>
                <span class="stat-label">Agents</span>
              </div>
            </div>

            <!-- API Status Icons -->
            <div class="api-status-row">
              <div v-for="provider in apiProviders" :key="provider.id" class="api-status-dot"
                :class="{ connected: isConnected(provider.id), error: hasError(provider.id) }"
                :title="`${provider.name}: ${getStatusText(provider.id)}`" @click="toggleProviderConfig(provider.id)">
                <img :src="getProviderIcon(provider.id)" class="status-icon" />
              </div>
            </div>
          </div>

          <!-- Two Column Layout -->
          <div class="main-columns">

            <!-- Left Column: Agents, System Messages, TTS, Whisper -->
            <div class="left-column">
              <div class="section-title">Active Agents</div>
              <div class="agents-compact">
                <div v-for="agent in allAgentTypes" :key="agent.id" class="agent-compact" :class="{
                  configured: getAgentModel(agent.id),
                  selected: selectedAgent === agent.id,
                  custom: agent.isCustom
                }" :style="{ '--agent-color': agent.color }" @click="selectAgent(agent.id)">
                  <div class="agent-icon-compact" :style="{ backgroundColor: agent.color + '15', color: agent.color }">
                    {{ agent.emoji }}
                  </div>
                  <div class="agent-details-compact">
                    <div class="agent-name-compact">{{ agent.name }}</div>
                    <div class="agent-model-compact">{{ getAgentModel(agent.id)?.name || 'No model' }}</div>
                  </div>
                  <div class="agent-actions">
                    <button v-if="getAgentModel(agent.id)" @click.stop="clearAgent(agent.id)" class="clear-compact">
                      <X class="w-3 h-3" />
                    </button>
                    <button v-if="agent.isCustom" @click.stop="agentStore.removeAgent(agent.id)" class="delete-compact"
                      title="Delete agent">
                      <Trash2 class="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <!-- Add Custom Agent Button -->
                <button @click="showCustomAgentForm = !showCustomAgentForm" class="add-agent-btn">
                  <Plus class="w-3 h-3" />
                  <span>Create Custom Agent</span>
                </button>
              </div>

              <!-- Custom Agent Creation Form -->
              <div v-if="showCustomAgentForm" class="custom-agent-form">
                <div class="form-header">
                  <span class="form-title">New Custom Agent</span>
                  <button @click="showCustomAgentForm = false" class="close-form-btn">
                    <X class="w-3 h-3" />
                  </button>
                </div>

                <div class="form-fields">
                  <div class="form-field">
                    <label class="field-label">Name</label>
                    <input v-model="customAgentForm.name" type="text" placeholder="e.g., Research Agent"
                      class="field-input" />
                  </div>

                  <div class="form-field">
                    <label class="field-label">Description</label>
                    <textarea v-model="customAgentForm.description" placeholder="What this agent specializes in..."
                      class="field-textarea" rows="2"></textarea>
                  </div>

                  <div class="form-field">
                    <label class="field-label">Trigger Patterns (Regex)</label>
                    <div v-for="(pattern, index) in customAgentForm.triggerPatterns" :key="index" class="pattern-row">
                      <input v-model="customAgentForm.triggerPatterns[index]" type="text"
                        placeholder="e.g., research|analyze|study" class="field-input" />
                      <button @click="removeTriggerPattern(index)" class="remove-btn">
                        <X class="w-3 h-3" />
                      </button>
                    </div>
                    <button @click="addTriggerPattern" class="add-pattern-btn">
                      <Plus class="w-3 h-3" />
                      Add Pattern
                    </button>
                  </div>

                  <div class="form-field">
                    <label class="field-label">Tags</label>
                    <div v-for="(tag, index) in customAgentForm.tags" :key="index" class="tag-row">
                      <input v-model="customAgentForm.tags[index]" type="text" placeholder="e.g., research"
                        class="field-input" />
                      <button @click="removeTag(index)" class="remove-btn">
                        <X class="w-3 h-3" />
                      </button>
                    </div>
                    <button @click="addTag" class="add-tag-btn">
                      <Plus class="w-3 h-3" />
                      Add Tag
                    </button>
                  </div>

                  <button @click="createCustomAgent" class="create-agent-btn">
                    Create Agent
                  </button>
                </div>
              </div>

              <!-- System Message Panel -->
              <div class="system-message-section">
                <div class="system-header">
                  <span class="section-title">System Message</span>
                  <span v-if="selectedAgent" class="selected-agent">
                    {{agentTypes.find(a => a.id === selectedAgent)?.emoji}}
                    {{agentTypes.find(a => a.id === selectedAgent)?.name}}
                  </span>
                </div>

                <div v-if="selectedAgent" class="system-message-editor">
                  <textarea v-model="systemMessages[selectedAgent]" @input="updateSystemMessage" class="system-textarea"
                    :placeholder="`Enter system message for ${agentTypes.find(a => a.id === selectedAgent)?.name}...`"
                    rows="4"></textarea>
                  <div class="system-actions">
                    <button @click="resetSystemMessage" class="reset-btn">
                      <RotateCcw class="w-3 h-3" />
                      Reset
                    </button>
                    <span class="char-count">{{ systemMessages[selectedAgent]?.length || 0 }} chars</span>
                  </div>
                </div>

                <div v-else class="system-placeholder">
                  <MessageSquare class="w-8 h-8 opacity-30" />
                  <span>Click an agent to edit its system message</span>
                </div>
              </div>

              <!-- TTS Section -->
              <div class="tts-section">
                <div class="tts-header">
                  <span class="section-title">Text-to-Speech</span>
                  <label class="toggle-switch-compact">
                    <input type="checkbox" v-model="ttsSettings.enabled" @change="updateTTSSettings"
                      class="toggle-input" />
                    <span class="toggle-slider-compact"></span>
                  </label>
                </div>

                <div v-if="ttsSettings.enabled" class="tts-controls-compact">
                  <select v-model="ttsSettings.voice" @change="updateTTSSettings" class="voice-select-compact">
                    <option v-for="voice in voices" :key="voice.id" :value="voice.id">
                      {{ voice.name }}
                    </option>
                  </select>

                  <div class="speed-control">
                    <span class="speed-label">{{ ttsSettings.speed.toFixed(1) }}x</span>
                    <input type="range" v-model.number="ttsSettings.speed" @input="updateTTSSettings" min="0.5"
                      max="2.0" step="0.1" class="speed-range" />
                  </div>

                  <div class="tts-actions">
                    <label class="auto-read-toggle">
                      <input type="checkbox" v-model="ttsSettings.autoRead" @change="updateTTSSettings"
                        class="checkbox-compact" />
                      <span>Auto-read</span>
                    </label>
                    <button @click="testVoice" :disabled="isTesting" class="test-btn-compact">
                      <component :is="isTesting ? 'Loader' : 'Play'" class="w-3 h-3"
                        :class="{ 'animate-spin': isTesting }" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Whisper.cpp Section -->
              <div class="whisper-section">
                <div class="whisper-header">
                  <span class="section-title">Whisper.cpp</span>
                  <label class="toggle-switch-compact">
                    <input type="checkbox" v-model="whisperSettings.enabled" @change="updateWhisperSettings"
                      class="toggle-input" />
                    <span class="toggle-slider-compact"></span>
                  </label>
                </div>

                <div v-if="whisperSettings.enabled" class="whisper-controls-compact">
                  <div class="control-row">
                    <label class="control-label-inline">Model</label>
                    <select v-model="whisperSettings.model" @change="updateWhisperSettings"
                      class="whisper-select-compact">
                      <option v-for="model in whisperModels" :key="model.id" :value="model.id">
                        {{ model.name }}
                      </option>
                    </select>
                  </div>

                  <div class="control-row">
                    <label class="control-label-inline">Language</label>
                    <select v-model="whisperSettings.language" @change="updateWhisperSettings"
                      class="whisper-select-compact">
                      <option value="auto">Auto-detect</option>
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="it">Italian</option>
                      <option value="pt">Portuguese</option>
                      <option value="ru">Russian</option>
                      <option value="ja">Japanese</option>
                      <option value="zh">Chinese</option>
                    </select>
                  </div>

                  <div class="control-row">
                    <label class="control-label-inline">Threads</label>
                    <input type="number" v-model.number="whisperSettings.threads" @input="updateWhisperSettings" min="1"
                      max="16" class="whisper-input-compact" />
                  </div>

                  <div class="whisper-toggles">
                    <label class="whisper-toggle">
                      <input type="checkbox" v-model="whisperSettings.translate" @change="updateWhisperSettings"
                        class="checkbox-compact" />
                      <span>Translate to English</span>
                    </label>

                    <label class="whisper-toggle">
                      <input type="checkbox" v-model="whisperSettings.diarize" @change="updateWhisperSettings"
                        class="checkbox-compact" />
                      <span>Speaker diarization</span>
                    </label>

                    <label class="whisper-toggle">
                      <input type="checkbox" v-model="whisperSettings.timestamps" @change="updateWhisperSettings"
                        class="checkbox-compact" />
                      <span>Include timestamps</span>
                    </label>
                  </div>

                  <div class="whisper-advanced">
                    <button @click="showWhisperAdvanced = !showWhisperAdvanced" class="advanced-toggle">
                      <ChevronDown class="w-3 h-3" :class="{ 'rotate-180': showWhisperAdvanced }" />
                      Advanced
                    </button>

                    <div v-if="showWhisperAdvanced" class="advanced-controls">
                      <div class="control-row">
                        <label class="control-label-inline">Temperature</label>
                        <input type="range" v-model.number="whisperSettings.temperature" @input="updateWhisperSettings"
                          min="0" max="1" step="0.1" class="whisper-range" />
                        <span class="range-value">{{ whisperSettings.temperature.toFixed(1) }}</span>
                      </div>

                      <div class="control-row">
                        <label class="control-label-inline">Beam size</label>
                        <input type="number" v-model.number="whisperSettings.beamSize" @input="updateWhisperSettings"
                          min="1" max="10" class="whisper-input-compact" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Model Browser -->
            <div class="right-column">
              <div class="model-browser">
                <div class="browser-header">
                  <div class="section-title">Model Browser</div>
                  <div class="model-count">{{ filteredModels.length }} models</div>
                </div>

                <!-- Compact Search & Filters -->
                <div class="search-filters-compact">
                  <div class="search-row">
                    <div class="search-wrapper-compact">
                      <Search class="search-icon-compact" />
                      <input v-model="searchQuery" type="text" placeholder="Search..." class="search-input-compact" />
                    </div>
                    <select v-model="activeProvider" class="provider-select-compact">
                      <option value="all">All</option>
                      <option value="ollama">Ollama</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google</option>
                    </select>
                  </div>

                  <!-- Compact Filter Pills -->
                  <div class="filter-pills">
                    <button v-for="filter in quickFilters" :key="filter.id" @click="toggleFilter(filter.id)"
                      class="filter-pill" :class="{ active: activeFilters.has(filter.id) }">
                      {{ filter.label }}
                    </button>
                  </div>
                </div>

                <!-- Models List - Compact Cards -->
                <div class="models-list-compact">
                  <div v-for="model in displayedModels" :key="model.id" class="model-card-compact" :class="{
                    favorite: isFavorite(model),
                    free: model.isFree
                  }">
                    <div class="model-row">
                      <img :src="getProviderIcon(model.source)" class="model-icon-compact" />
                      <div class="model-info-compact">
                        <div class="model-name-compact">{{ model.name }}</div>
                        <div class="model-meta-compact">
                          <span v-if="model.isFree" class="free-badge">FREE</span>
                          <span v-if="model.parameterSize" class="size-badge">{{ model.parameterSize }}</span>
                          <span v-if="model.contextLength" class="context-badge">{{ formatContext(model.contextLength)
                          }}</span>
                        </div>
                      </div>
                      <button @click="toggleFavorite(model)" class="favorite-btn-compact"
                        :class="{ active: isFavorite(model) }">
                        <Star class="w-3 h-3" :class="{ 'fill-current': isFavorite(model) }" />
                      </button>
                    </div>

                    <!-- Agent Assignment Row -->
                    <div class="assignment-row">
                      <span class="assign-label">Assign:</span>
                      <div class="agent-assignment-btns">
                        <button v-for="agent in allAgentTypes" :key="agent.id" @click="setAsAgent(agent.id, model)"
                          class="agent-btn-compact" :class="{
                            active: getAgentModel(agent.id)?.id === model.id,
                            custom: agent.isCustom
                          }" :style="{ '--agent-color': agent.color }" :title="`Assign to ${agent.name}`">
                          {{ agent.emoji }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Load More -->
                  <div class="load-more-compact">
                    <div v-if="isLoadingMore" class="loading-compact">
                      <Loader class="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                    <button v-else-if="hasMoreModels" @click="loadMoreModels" class="load-more-btn-compact">
                      Load {{ Math.min(itemsPerPage, remainingCount) }} more
                    </button>
                    <div v-else-if="displayedModels.length > 0" class="end-compact">
                      All loaded
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Testing Tab Content -->
        <div v-if="activeTab === 'testing'" class="tab-content">
          <!-- Test Mode Selector -->
          <div class="test-mode-selector">
            <div class="mode-tabs">
              <button @click="testMode = 'quick'" class="mode-tab" :class="{ active: testMode === 'quick' }">
                <span class="mode-icon">⚡</span>
                <div class="mode-content">
                  <span class="mode-label">Quick Test</span>
                  <span class="mode-desc">Default prompt adherence test</span>
                </div>
              </button>
              <button @click="testMode = 'custom'" class="mode-tab" :class="{ active: testMode === 'custom' }">
                <span class="mode-icon">🔧</span>
                <div class="mode-content">
                  <span class="mode-label">Custom Test</span>
                  <span class="mode-desc">Create your own test template</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Quick Test Content -->
          <div v-if="testMode === 'quick'" class="quick-test-content">
            <div class="quick-test-columns">

              <!-- Left: Quick Configuration -->
              <div class="quick-config-column">
                <div class="quick-config-section">
                  <div class="section-title">Quick Test Settings</div>

                  <div class="quick-config-grid">
                    <div class="config-item">
                      <label class="config-label">Test Runs</label>
                      <input v-model.number="quickTestConfig.testRuns" type="number" min="1" max="5"
                        class="config-input" />
                    </div>

                    <div class="config-item">
                      <label class="config-label">Questions</label>
                      <input v-model.number="quickTestConfig.questionsPerRun" type="number" min="3" max="20"
                        class="config-input" />
                    </div>

                    <div class="config-item">
                      <label class="config-label">Temperature</label>
                      <input v-model.number="quickTestConfig.temperature" type="range" min="0" max="1" step="0.1"
                        class="config-range" />
                      <span class="range-display">{{ quickTestConfig.temperature.toFixed(1) }}</span>
                    </div>

                    <div class="config-item">
                      <label class="config-label">Category</label>
                      <select v-model="quickTestConfig.category" class="field-select">
                        <option value="prompt-adherence">Prompt Adherence</option>
                        <option value="structured-output">Structured Output</option>
                        <option value="code-generation">Code Generation</option>
                        <option value="reasoning">Reasoning</option>
                      </select>
                    </div>
                  </div>

                  <div class="quick-test-description">
                    <div class="description-title">Evaluation Criteria:</div>
                    <ul class="test-criteria-list">
                      <li><strong>Accuracy:</strong> Following instructions correctly (40%)</li>
                      <li><strong>Completeness:</strong> Addressing all prompt parts (30%)</li>
                      <li><strong>Format:</strong> Output format compliance (30%)</li>
                    </ul>
                  </div>
                </div>

                <!-- Quick Execution Controls -->
                <div class="quick-execution-section">
                  <div class="section-title">Run Test</div>

                  <div class="quick-execution-controls">
                    <div class="test-control-buttons">
                      <button @click="runQuickTest" :disabled="selectedTestModels.length === 0 || isRunningTests"
                        class="run-quick-test-btn" :class="{ loading: isRunningTests }">
                        <component :is="isRunningTests ? 'Loader' : 'Play'" class="w-4 h-4"
                          :class="{ 'animate-spin': isRunningTests }" />
                        {{ isRunningTests ? 'Testing...' : 'Run Quick Test' }}
                      </button>

                      <div v-if="isRunningTests" class="test-control-group">
                        <button @click="isPaused ? resumeTests() : pauseTests()" class="control-btn pause-resume"
                          :class="{ paused: isPaused }">
                          <component :is="isPaused ? 'Play' : 'Pause'" class="w-3 h-3" />
                          {{ isPaused ? 'Resume' : 'Pause' }}
                        </button>

                        <button @click="stopTests" class="control-btn stop">
                          <Square class="w-3 h-3" />
                          Stop
                        </button>
                      </div>
                    </div>

                    <div class="quick-test-info">
                      <div class="info-row">
                        <span class="info-label">Models:</span>
                        <span class="info-value">{{ selectedTestModels.length }}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Questions:</span>
                        <span class="info-value">{{ quickTestConfig.questionsPerRun }}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Total Tests:</span>
                        <span class="info-value">{{ selectedTestModels.length * quickTestConfig.questionsPerRun *
                          quickTestConfig.testRuns }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Test Progress -->
                  <div v-if="testProgress.total > 0" class="test-progress">
                    <div class="progress-header">
                      <span class="progress-text">
                        Testing {{ testProgress.current }}/{{ testProgress.total }}
                        ({{ testProgress.currentModel }})
                        <span v-if="isPaused" class="pause-indicator">PAUSED</span>
                      </span>
                      <span class="progress-percent">
                        {{ Math.round((testProgress.current / testProgress.total) * 100) }}%
                      </span>
                    </div>
                    <div v-if="testProgress.currentQuestion" class="current-question">
                      <span class="question-label">Current Question:</span>
                      <span class="question-text">{{ testProgress.currentQuestion }}</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill"
                        :style="{ width: `${(testProgress.current / testProgress.total) * 100}%` }"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right: Model Selection -->
              <div class="quick-execution-column">
                <div class="model-selection-section">
                  <div class="section-title">Select Models to Test</div>

                  <!-- Search and Filter Row -->
                  <div class="test-search-filter-row">
                    <div class="test-search-wrapper">
                      <Search class="test-search-icon" />
                      <input v-model="testSearchQuery" type="text" placeholder="Search models..."
                        class="test-search-input" />
                    </div>
                    <select v-model="testModelFilter" class="provider-select-compact">
                      <option value="all">All Providers</option>
                      <option value="ollama">Ollama</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google</option>
                    </select>
                  </div>

                  <!-- Filter Pills -->
                  <div class="test-filter-pills">
                    <button v-for="filter in testQuickFilters" :key="filter.id" @click="toggleTestFilter(filter.id)"
                      class="test-filter-pill" :class="{ active: activeTestFilters.has(filter.id) }">
                      {{ filter.label }}
                    </button>
                  </div>

                  <div class="model-filter-row">
                    <div class="selection-actions">
                      <button @click="selectAllModels" class="select-all-btn">Select All</button>
                      <button @click="clearModelSelection" class="clear-selection-btn">Clear</button>
                    </div>
                  </div>

                  <div class="selected-models-summary">
                    <span class="summary-text">{{ selectedTestModels.length }} models selected</span>
                    <button v-if="selectedTestModels.length > 0" @click="showSelectedModels = !showSelectedModels"
                      class="toggle-selected-btn">
                      <ChevronDown class="w-3 h-3" :class="{ 'rotate-180': showSelectedModels }" />
                    </button>
                  </div>

                  <div v-if="showSelectedModels" class="selected-models-list">
                    <div v-for="model in selectedTestModels" :key="model.id" class="selected-model-item">
                      <img :src="getProviderIcon(model.source)" class="model-icon-mini" />
                      <span class="model-name-mini">{{ model.name }}</span>
                      <button @click="removeFromTest(model)" class="remove-model-btn">
                        <X class="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <!-- Available Models List -->
                  <div class="available-models-list">
                    <div v-for="model in filteredTestModels" :key="model.id" class="test-model-card"
                      :class="{ selected: isModelSelected(model) }" @click="toggleModelSelection(model)">
                      <div class="model-card-content">
                        <img :src="getProviderIcon(model.source)" class="model-icon-compact" />
                        <div class="model-info-compact">
                          <div class="model-name-compact">{{ model.name }}</div>
                          <div class="model-meta-compact">
                            <span v-if="model.isFree" class="free-badge">FREE</span>
                            <span v-if="model.parameterSize" class="size-badge">{{ model.parameterSize }}</span>
                          </div>
                        </div>
                        <div class="selection-indicator">
                          <Check v-if="isModelSelected(model)" class="w-3 h-3" />
                          <Plus v-else class="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quick Test Results -->
            <div v-if="testResults.length > 0" class="test-results-section">
              <div class="results-header">
                <span class="section-title">Test Results</span>
                <div class="results-actions">
                  <button @click="exportResults" class="export-btn">
                    <span>📊</span> Export
                  </button>
                  <button @click="clearResults" class="clear-results-btn">
                    <span>🗑️</span> Clear
                  </button>
                </div>
              </div>

              <!-- Results Summary -->
              <div class="results-summary">
                <div class="summary-stats">
                  <div class="stat-item">
                    <span class="stat-value">{{ testResults.length }}</span>
                    <span class="stat-label">Models Tested</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{{testResults.reduce((sum, r) => sum + r.questionsAnswered, 0)}}</span>
                    <span class="stat-label">Total Questions</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{{Math.round(testResults.reduce((sum, r) => sum + r.overallScore, 0) /
                      testResults.length)}}%</span>
                    <span class="stat-label">Avg Score</span>
                  </div>
                </div>
              </div>

              <!-- Results Table -->
              <div class="results-table-container">
                <table class="results-table">
                  <thead>
                    <tr>
                      <th class="expand-col"></th>
                      <th class="model-col">Model</th>
                      <th class="score-col">Overall Score</th>
                      <th class="criterion-col">Accuracy</th>
                      <th class="criterion-col">Completeness</th>
                      <th class="criterion-col">Format</th>
                      <th class="stat-col">Questions</th>
                      <th class="stat-col">Avg Time</th>
                      <th class="stat-col">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="result in sortedTestResults" :key="result.modelId">
                      <tr class="result-row clickable" @click="toggleModelRow(result.modelId)">
                        <td class="expand-cell">
                          <component :is="isModelRowExpanded(result.modelId) ? 'ChevronDown' : 'ChevronRight'"
                            class="expand-icon" />
                        </td>
                        <td class="model-cell">
                          <div class="model-info">
                            <img :src="getProviderIcon(result.modelSource)" class="model-icon-mini" />
                            <span class="model-name">{{ result.modelName }}</span>
                            <span class="model-source">{{ result.modelSource }}</span>
                          </div>
                        </td>
                        <td class="score-cell">
                          <div class="overall-score" :class="getScoreClass(result.overallScore)">
                            {{ Math.round(result.overallScore) }}%
                          </div>
                        </td>
                        <td class="criterion-cell">
                          <div class="criterion-score" :class="getScoreClass(result.criteriaScores[0]?.score || 0)">
                            {{ Math.round(result.criteriaScores[0]?.score || 0) }}%
                          </div>
                        </td>
                        <td class="criterion-cell">
                          <div class="criterion-score" :class="getScoreClass(result.criteriaScores[1]?.score || 0)">
                            {{ Math.round(result.criteriaScores[1]?.score || 0) }}%
                          </div>
                        </td>
                        <td class="criterion-cell">
                          <div class="criterion-score" :class="getScoreClass(result.criteriaScores[2]?.score || 0)">
                            {{ Math.round(result.criteriaScores[2]?.score || 0) }}%
                          </div>
                        </td>
                        <td class="stat-cell">{{ result.questionsAnswered }}</td>
                        <td class="stat-cell">{{ result.avgResponseTime }}ms</td>
                        <td class="stat-cell">
                          <span class="error-count" :class="{ 'has-errors': result.errors > 0 }">
                            {{ result.errors }}
                          </span>
                        </td>
                      </tr>
                      <!-- Expanded Row Content -->
                      <tr v-if="isModelRowExpanded(result.modelId)" class="expanded-row">
                        <td colspan="9" class="expanded-content">
                          <div class="model-detailed-view">
                            <div class="detailed-header">
                              <h4>{{ result.modelName }} - Question-by-Question Results</h4>
                              <span class="pass-fail-summary">
                                {{getModelDetailedResults(result.modelId)?.questionResults.filter(q => q.passed).length
                                || 0 }}/{{ getModelDetailedResults(result.modelId)?.questionResults.length || 0 }}
                                passed
                              </span>
                            </div>

                            <div class="questions-list">
                              <div
                                v-for="(questionResult, index) in getModelDetailedResults(result.modelId)?.questionResults"
                                :key="index" class="question-detail-row" :class="{ failed: !questionResult.passed }">
                                <div class="question-summary">
                                  <span class="question-num">Q{{ index + 1 }}</span>
                                  <span class="question-score" :class="getScoreClass(questionResult.overallScore)">
                                    {{ Math.round(questionResult.overallScore) }}%
                                  </span>
                                  <span class="question-status" :class="{ passed: questionResult.passed }">
                                    {{ questionResult.passed ? '✓' : '✗' }}
                                  </span>
                                  <span class="question-preview">{{ questionResult.question.substring(0, 80) }}{{
                                    questionResult.question.length > 80 ? '...' : '' }}</span>
                                </div>

                                <div class="response-comparison">
                                  <div class="expected-response">
                                    <div class="response-label">Expected:</div>
                                    <div class="response-content expected clickable" 
                                         @click="showResponseModal('Expected Answer', questionResult.expectedAnswer, true)">
                                      {{ questionResult.expectedAnswer }}
                                    </div>
                                  </div>
                                  <div class="actual-response">
                                    <div class="response-label">Model Response:</div>
                                    <div class="response-content actual clickable"
                                      :class="{ error: questionResult.actualAnswer.startsWith('ERROR:') }"
                                      @click="showResponseModal('Model Response', questionResult.actualAnswer, true)">
                                      {{ questionResult.actualAnswer }}
                                    </div>
                                  </div>
                                </div>

                                <div class="question-metadata">
                                  <span class="response-time">{{ questionResult.responseTime }}ms</span>
                                  <span class="feedback">{{ questionResult.feedback }}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Custom Test Content -->
          <div v-if="testMode === 'custom'" class="custom-test-content">

            <div class="testing-main-columns">

              <!-- Left Column: Test Template Configuration -->
              <div class="testing-left-column">

                <!-- Test Template Header -->
                <div class="test-template-header">
                  <div class="section-title">Test Template Configuration</div>
                  <div class="template-actions">
                    <button @click="loadTemplate" class="load-template-btn">
                      <span>📁</span> Load
                    </button>
                    <button @click="saveTemplate" class="save-template-btn">
                      <span>💾</span> Save
                    </button>
                    <button @click="resetTemplate" class="reset-template-btn">
                      <span>🔄</span> Reset
                    </button>
                  </div>
                </div>

                <!-- Template Basic Info -->
                <div class="template-basic-info">
                  <div class="form-field">
                    <label class="field-label">Template Name</label>
                    <input v-model="testTemplate.name" type="text" placeholder="e.g., Code Generation Test"
                      class="field-input" />
                  </div>

                  <div class="form-field">
                    <label class="field-label">Description</label>
                    <textarea v-model="testTemplate.description" placeholder="What this test evaluates..."
                      class="field-textarea" rows="2"></textarea>
                  </div>

                  <div class="form-field">
                    <label class="field-label">Test Category</label>
                    <select v-model="testTemplate.category" class="field-select">
                      <option value="prompt-adherence">Prompt Adherence</option>
                      <option value="structured-output">Structured Output</option>
                      <option value="code-generation">Code Generation</option>
                      <option value="reasoning">Reasoning & Logic</option>
                      <option value="creativity">Creativity</option>
                      <option value="factual-accuracy">Factual Accuracy</option>
                      <option value="safety">Safety & Ethics</option>
                      <option value="custom">Custom Test</option>
                    </select>
                  </div>
                </div>

                <!-- Test Configuration -->
                <div class="test-config-section">
                  <div class="config-header">
                    <span class="section-title">Test Configuration</span>
                  </div>

                  <div class="config-grid">
                    <div class="config-item">
                      <label class="config-label">Test Runs</label>
                      <input v-model.number="testTemplate.config.testRuns" type="number" min="1" max="10"
                        class="config-input" />
                    </div>

                    <div class="config-item">
                      <label class="config-label">Questions per Run</label>
                      <input v-model.number="testTemplate.config.questionsPerRun" type="number" min="1" max="50"
                        class="config-input" />
                    </div>

                    <div class="config-item">
                      <label class="config-label">Timeout (seconds)</label>
                      <input v-model.number="testTemplate.config.timeout" type="number" min="10" max="300"
                        class="config-input" />
                    </div>

                    <div class="config-item">
                      <label class="config-label">Temperature</label>
                      <input v-model.number="testTemplate.config.temperature" type="range" min="0" max="2" step="0.1"
                        class="config-range" />
                      <span class="range-display">{{ testTemplate.config.temperature.toFixed(1) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Test Prompt Template -->
                <div class="prompt-template-section">
                  <div class="section-title">Prompt Template</div>

                  <div class="prompt-editor">
                    <div class="prompt-toolbar">
                      <button @click="insertVariable('task')" class="var-btn">{task}</button>
                      <button @click="insertVariable('context')" class="var-btn">{context}</button>
                      <button @click="insertVariable('format')" class="var-btn">{format}</button>
                      <button @click="insertVariable('examples')" class="var-btn">{examples}</button>
                    </div>

                    <textarea v-model="testTemplate.promptTemplate"
                      placeholder="Enter your prompt template with variables like {task}, {context}, {format}..."
                      class="prompt-textarea" rows="6"></textarea>
                  </div>
                </div>

                <!-- Evaluation Criteria -->
                <div class="evaluation-section">
                  <div class="section-title">Evaluation Criteria</div>

                  <div class="criteria-list">
                    <div v-for="(criterion, index) in testTemplate.evaluationCriteria" :key="index"
                      class="criterion-row">
                      <input v-model="criterion.name" type="text" placeholder="Criterion name" class="criterion-name" />
                      <input v-model.number="criterion.weight" type="number" min="0" max="1" step="0.1"
                        placeholder="Weight (0-1)" class="criterion-weight" />
                      <textarea v-model="criterion.description" placeholder="How to evaluate this criterion..."
                        class="criterion-description" rows="2"></textarea>
                      <button @click="removeCriterion(index)" class="remove-criterion-btn">
                        <X class="w-3 h-3" />
                      </button>
                    </div>

                    <button @click="addCriterion" class="add-criterion-btn">
                      <Plus class="w-3 h-3" />
                      Add Criterion
                    </button>
                  </div>
                </div>
              </div>

              <!-- Right Column: Model Selection & Test Execution -->
              <div class="testing-right-column">

                <!-- Model Selection -->
                <div class="model-selection-section">
                  <div class="section-title">Models to Test</div>

                  <!-- Search and Filter Row -->
                  <div class="test-search-filter-row">
                    <div class="test-search-wrapper">
                      <Search class="test-search-icon" />
                      <input v-model="testSearchQuery" type="text" placeholder="Search models..."
                        class="test-search-input" />
                    </div>
                    <select v-model="testModelFilter" class="provider-select-compact">
                      <option value="all">All Providers</option>
                      <option value="ollama">Ollama</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google</option>
                    </select>
                  </div>

                  <!-- Filter Pills -->
                  <div class="test-filter-pills">
                    <button v-for="filter in testQuickFilters" :key="filter.id" @click="toggleTestFilter(filter.id)"
                      class="test-filter-pill" :class="{ active: activeTestFilters.has(filter.id) }">
                      {{ filter.label }}
                    </button>
                  </div>

                  <div class="model-filter-row">
                    <div class="selection-actions">
                      <button @click="selectAllModels" class="select-all-btn">Select All</button>
                      <button @click="clearModelSelection" class="clear-selection-btn">Clear</button>
                    </div>
                  </div>

                  <div class="selected-models-summary">
                    <span class="summary-text">{{ selectedTestModels.length }} models selected</span>
                    <button v-if="selectedTestModels.length > 0" @click="showSelectedModels = !showSelectedModels"
                      class="toggle-selected-btn">
                      <ChevronDown class="w-3 h-3" :class="{ 'rotate-180': showSelectedModels }" />
                    </button>
                  </div>

                  <div v-if="showSelectedModels" class="selected-models-list">
                    <div v-for="model in selectedTestModels" :key="model.id" class="selected-model-item">
                      <img :src="getProviderIcon(model.source)" class="model-icon-mini" />
                      <span class="model-name-mini">{{ model.name }}</span>
                      <button @click="removeFromTest(model)" class="remove-model-btn">
                        <X class="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <!-- Available Models List -->
                  <div class="available-models-list">
                    <div v-for="model in filteredTestModels" :key="model.id" class="test-model-card"
                      :class="{ selected: isModelSelected(model) }" @click="toggleModelSelection(model)">
                      <div class="model-card-content">
                        <img :src="getProviderIcon(model.source)" class="model-icon-compact" />
                        <div class="model-info-compact">
                          <div class="model-name-compact">{{ model.name }}</div>
                          <div class="model-meta-compact">
                            <span v-if="model.isFree" class="free-badge">FREE</span>
                            <span v-if="model.parameterSize" class="size-badge">{{ model.parameterSize }}</span>
                          </div>
                        </div>
                        <div class="selection-indicator">
                          <Check v-if="isModelSelected(model)" class="w-3 h-3" />
                          <Plus v-else class="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>



                <!-- Testing Agent Configuration -->
                <div class="testing-agent-section">
                  <div class="section-title">Testing Agent</div>

                  <div class="agent-config">
                    <div class="form-field">
                      <label class="field-label">Test Data Generator Agent</label>
                      <select v-model="testTemplate.testingAgent" class="field-select">
                        <option value="">Select an agent for generating test data...</option>
                        <option v-for="agent in allAgentTypes" :key="agent.id" :value="agent.id"
                          :disabled="!getAgentModel(agent.id)">
                          {{ agent.emoji }} {{ agent.name }} {{ getAgentModel(agent.id) ?
                            `(${getAgentModel(agent.id).name})` : '(No model)' }}
                        </option>
                      </select>
                    </div>

                    <div class="form-field">
                      <label class="field-label">Test Generation Prompt</label>
                      <textarea v-model="testTemplate.testGenerationPrompt"
                        placeholder="Instructions for the testing agent to generate test data..." class="field-textarea"
                        rows="4"></textarea>
                    </div>
                  </div>
                </div>


                <!-- Test Execution -->
                <div class="test-execution-section">
                  <div class="section-title">Test Execution</div>

                  <div class="execution-controls">
                    <button @click="generateTestData" :disabled="!canGenerateTestData" class="generate-data-btn"
                      :class="{ loading: isGeneratingData }">
                      <component :is="isGeneratingData ? 'Loader' : 'Zap'" class="w-4 h-4"
                        :class="{ 'animate-spin': isGeneratingData }" />
                      {{ isGeneratingData ? 'Generating...' : 'Generate Test Data' }}
                    </button>

                    <div class="test-control-buttons">
                      <button @click="runTests" :disabled="!canRunTests" class="run-tests-btn"
                        :class="{ loading: isRunningTests }">
                        <component :is="isRunningTests ? 'Loader' : 'Play'" class="w-4 h-4"
                          :class="{ 'animate-spin': isRunningTests }" />
                        {{ isRunningTests ? 'Running Tests...' : 'Run Tests' }}
                      </button>

                      <div v-if="isRunningTests" class="test-control-group">
                        <button @click="isPaused ? resumeTests() : pauseTests()" class="control-btn pause-resume"
                          :class="{ paused: isPaused }">
                          <component :is="isPaused ? 'Play' : 'Pause'" class="w-3 h-3" />
                          {{ isPaused ? 'Resume' : 'Pause' }}
                        </button>

                        <button @click="stopTests" class="control-btn stop">
                          <Square class="w-3 h-3" />
                          Stop
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Test Progress -->
                  <div v-if="testProgress.total > 0" class="test-progress">
                    <div class="progress-header">
                      <span class="progress-text">
                        Testing {{ testProgress.current }}/{{ testProgress.total }}
                        ({{ testProgress.currentModel }})
                        <span v-if="isPaused" class="pause-indicator">PAUSED</span>
                      </span>
                      <span class="progress-percent">
                        {{ Math.round((testProgress.current / testProgress.total) * 100) }}%
                      </span>
                    </div>
                    <div v-if="testProgress.currentQuestion" class="current-question">
                      <span class="question-label">Current Question:</span>
                      <span class="question-text">{{ testProgress.currentQuestion }}</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill"
                        :style="{ width: `${(testProgress.current / testProgress.total) * 100}%` }">
                      </div>
                    </div>
                  </div>

                  <!-- Generated Test Data Preview -->
                  <div v-if="generatedTestData.length > 0" class="test-data-preview">
                    <div class="preview-header">
                      <span class="section-title">Generated Test Data</span>
                      <span class="data-count">{{ generatedTestData.length }} questions</span>
                    </div>

                    <div class="test-questions-list">
                      <div v-for="(question, index) in generatedTestData.slice(0, 3)" :key="index"
                        class="test-question-preview">
                        <div class="question-number">Q{{ index + 1 }}</div>
                        <div class="question-text">{{ question.question }}</div>
                        <div v-if="question.expectedAnswer" class="expected-answer">
                          Expected: {{ question.expectedAnswer.substring(0, 100) }}...
                        </div>
                      </div>

                      <div v-if="generatedTestData.length > 3" class="more-questions">
                        +{{ generatedTestData.length - 3 }} more questions
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Test Results -->
                <div v-if="testResults.length > 0" class="test-results-section">
                  <div class="results-header">
                    <span class="section-title">Test Results</span>
                    <div class="results-actions">
                      <button @click="exportResults" class="export-btn">
                        <span>📊</span> Export
                      </button>
                      <button @click="clearResults" class="clear-results-btn">
                        <span>🗑️</span> Clear
                      </button>
                    </div>
                  </div>

                  <!-- Results Summary -->
                  <div class="results-summary">
                    <div class="summary-stats">
                      <div class="stat-item">
                        <span class="stat-value">{{ testResults.length }}</span>
                        <span class="stat-label">Models Tested</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-value">{{testResults.reduce((sum, r) => sum + r.questionsAnswered, 0)
                        }}</span>
                        <span class="stat-label">Total Questions</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-value">{{Math.round(testResults.reduce((sum, r) => sum + r.overallScore, 0) /
                          testResults.length)}}%</span>
                        <span class="stat-label">Avg Score</span>
                      </div>
                    </div>
                  </div>

                  <!-- Results Table -->
                  <div class="results-table-container">
                    <table class="results-table">
                      <thead>
                        <tr>
                          <th class="expand-col"></th>
                          <th class="model-col">Model</th>
                          <th class="score-col">Overall Score</th>
                          <th class="criterion-col">Accuracy</th>
                          <th class="criterion-col">Completeness</th>
                          <th class="criterion-col">Format</th>
                          <th class="stat-col">Questions</th>
                          <th class="stat-col">Avg Time</th>
                          <th class="stat-col">Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        <template v-for="result in sortedTestResults" :key="result.modelId">
                          <tr class="result-row clickable" @click="toggleModelRow(result.modelId)">
                            <td class="expand-cell">
                              <component :is="isModelRowExpanded(result.modelId) ? 'ChevronDown' : 'ChevronRight'"
                                class="expand-icon" />
                            </td>
                            <td class="model-cell">
                              <div class="model-info">
                                <img :src="getProviderIcon(result.modelSource)" class="model-icon-mini" />
                                <span class="model-name">{{ result.modelName }}</span>
                                <span class="model-source">{{ result.modelSource }}</span>
                              </div>
                            </td>
                            <td class="score-cell">
                              <div class="overall-score" :class="getScoreClass(result.overallScore)">
                                {{ Math.round(result.overallScore) }}%
                              </div>
                            </td>
                            <td class="criterion-cell">
                              <div class="criterion-score" :class="getScoreClass(result.criteriaScores[0]?.score || 0)">
                                {{ Math.round(result.criteriaScores[0]?.score || 0) }}%
                              </div>
                            </td>
                            <td class="criterion-cell">
                              <div class="criterion-score" :class="getScoreClass(result.criteriaScores[1]?.score || 0)">
                                {{ Math.round(result.criteriaScores[1]?.score || 0) }}%
                              </div>
                            </td>
                            <td class="criterion-cell">
                              <div class="criterion-score" :class="getScoreClass(result.criteriaScores[2]?.score || 0)">
                                {{ Math.round(result.criteriaScores[2]?.score || 0) }}%
                              </div>
                            </td>
                            <td class="stat-cell">{{ result.questionsAnswered }}</td>
                            <td class="stat-cell">{{ result.avgResponseTime }}ms</td>
                            <td class="stat-cell">
                              <span class="error-count" :class="{ 'has-errors': result.errors > 0 }">
                                {{ result.errors }}
                              </span>
                            </td>
                          </tr>
                          <!-- Expanded Row Content -->
                          <tr v-if="isModelRowExpanded(result.modelId)" class="expanded-row">
                            <td colspan="9" class="expanded-content">
                              <div class="model-detailed-view">
                                <div class="detailed-header">
                                  <h4>{{ result.modelName }} - Question-by-Question Results</h4>
                                  <span class="pass-fail-summary">
                                    {{getModelDetailedResults(result.modelId)?.questionResults.filter(q =>
                                    q.passed).length || 0 }}/{{
                                      getModelDetailedResults(result.modelId)?.questionResults.length || 0 }} passed
                                  </span>
                                </div>

                                <div class="questions-list">
                                  <div
                                    v-for="(questionResult, index) in getModelDetailedResults(result.modelId)?.questionResults"
                                    :key="index" class="question-detail-row"
                                    :class="{ failed: !questionResult.passed }">
                                    <div class="question-summary">
                                      <span class="question-num">Q{{ index + 1 }}</span>
                                      <span class="question-score" :class="getScoreClass(questionResult.overallScore)">
                                        {{ Math.round(questionResult.overallScore) }}%
                                      </span>
                                      <span class="question-status" :class="{ passed: questionResult.passed }">
                                        {{ questionResult.passed ? '✓' : '✗' }}
                                      </span>
                                      <span class="question-preview">{{ questionResult.question.substring(0, 80) }}{{
                                        questionResult.question.length > 80 ? '...' : '' }}</span>
                                    </div>

                                    <div class="response-comparison">
                                      <div class="expected-response">
                                        <div class="response-label">Expected:</div>
                                        <div class="response-content expected clickable"
                                             @click="showResponseModal('Expected Answer', questionResult.expectedAnswer, true)">
                                          {{ questionResult.expectedAnswer }}
                                        </div>
                                      </div>
                                      <div class="actual-response">
                                        <div class="response-label">Model Response:</div>
                                        <div class="response-content actual clickable"
                                          :class="{ error: questionResult.actualAnswer.startsWith('ERROR:') }"
                                          @click="showResponseModal('Model Response', questionResult.actualAnswer, true)">
                                          {{ questionResult.actualAnswer }}
                                        </div>
                                      </div>
                                    </div>

                                    <div class="question-metadata">
                                      <span class="response-time">{{ questionResult.responseTime }}ms</span>
                                      <span class="feedback">{{ questionResult.feedback }}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </template>
                      </tbody>
                    </table>
                  </div>

                  <!-- Detailed Results View -->
                  <div v-if="detailedTestResults.length > 0" class="detailed-results-section">
                    <div class="detailed-results-header">
                      <span class="section-title">Question-by-Question Results</span>
                      <div class="view-toggle">
                        <label class="toggle-switch-compact">
                          <input type="checkbox" v-model="showDetailedResults">
                          <span class="toggle-slider"></span>
                        </label>
                        <span class="toggle-label">Show Details</span>
                      </div>
                    </div>

                    <div v-if="showDetailedResults" class="detailed-results-content">
                      <div v-for="modelResult in detailedTestResults" :key="modelResult.modelId"
                        class="model-detailed-results">
                        <div class="model-header-detailed">
                          <img :src="getProviderIcon(modelResult.modelSource)" class="model-icon-mini" />
                          <span class="model-name-detailed">{{ modelResult.modelName }}</span>
                          <span class="model-summary">
                            {{modelResult.questionResults.filter(q => q.passed).length}}/{{
                              modelResult.questionResults.length
                            }} passed
                          </span>
                        </div>

                        <div class="questions-grid">
                          <div v-for="(questionResult, index) in modelResult.questionResults" :key="index"
                            class="question-result-card" :class="{ failed: !questionResult.passed }">
                            <div class="question-header">
                              <span class="question-number">Q{{ index + 1 }}</span>
                              <span class="question-score" :class="getScoreClass(questionResult.overallScore)">
                                {{ Math.round(questionResult.overallScore) }}%
                              </span>
                              <span class="question-status" :class="{ passed: questionResult.passed }">
                                {{ questionResult.passed ? '✓' : '✗' }}
                              </span>
                            </div>

                            <div class="question-content">
                              <div class="question-text">
                                <strong>Question:</strong> {{ questionResult.question }}
                              </div>

                              <div class="answer-comparison">
                                <div class="expected-answer">
                                  <div class="answer-label">Expected Answer:</div>
                                  <div class="answer-text expected">{{ questionResult.expectedAnswer }}</div>
                                </div>

                                <div class="actual-answer">
                                  <div class="answer-label">Model Response:</div>
                                  <div class="answer-text actual"
                                    :class="{ error: questionResult.actualAnswer.startsWith('ERROR:') }">
                                    {{ questionResult.actualAnswer }}
                                  </div>
                                </div>
                              </div>

                              <div class="criteria-scores">
                                <div v-for="score in questionResult.scores" :key="score.name"
                                  class="criterion-score-item">
                                  <span class="criterion-name">{{ score.name }}:</span>
                                  <span class="criterion-value" :class="getScoreClass(score.score)">
                                    {{ Math.round(score.score) }}%
                                  </span>
                                </div>
                              </div>

                              <div class="question-meta">
                                <span class="response-time">{{ questionResult.responseTime }}ms</span>
                                <span class="difficulty">{{ questionResult.difficulty }}</span>
                                <span class="feedback">{{ questionResult.feedback }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Notifications -->
    <Teleport to="body">
      <transition name="notification">
        <div v-if="notification.show" class="notification">
          <Check class="w-4 h-4" />
          <span>{{ notification.message }}</span>
        </div>
      </transition>
    </Teleport>
    
    <!-- Response Modal -->
    <Teleport to="body">
      <transition name="modal">
        <div v-if="responseModal.show" class="modal-overlay" @click.self="closeResponseModal">
          <div class="response-modal">
            <div class="modal-header">
              <h3>{{ responseModal.title }}</h3>
              <button @click="closeResponseModal" class="modal-close-btn">
                <X class="w-4 h-4" />
              </button>
            </div>
            <div class="modal-body">
              <pre v-if="responseModal.isJson" class="json-content">{{ responseModal.content }}</pre>
              <div v-else class="text-content">{{ responseModal.content }}</div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, reactive, watch } from 'vue';
import {
  X, Search, Check, Star, Play, Pause, Square, Loader, MessageSquare, RotateCcw, ChevronDown, ChevronRight, Plus, Trash2, Zap
} from 'lucide-vue-next';
import { useModelStore } from '@/stores/modelStore';
import { useThemeStore } from '@/stores/themeStore';
import { useAgentStore } from '@/stores/agentStore';
import ttsService from '@/services/ttsService';

// Assets
import ollamaIcon from '@/assets/ollama.jpeg';
import googleIcon from '@/assets/google.jpeg';
import anthropicIcon from '@/assets/anthropic.jpeg';
import openRouterIcon from '@/assets/unknown.jpeg';

const props = defineProps({
  isOpen: Boolean,
  currentModel: Object
});

const emit = defineEmits(['close', 'model-selected', 'api-key-saved']);

// Stores
const modelStore = useModelStore();
const themeStore = useThemeStore();
const agentStore = useAgentStore();

// State
const activeTab = ref('agents');
const searchQuery = ref('');
const activeProvider = ref('all');
const currentPage = ref(0);
const itemsPerPage = 20;
const isLoadingMore = ref(false);
const showApiConfig = ref(false);
const selectedAgent = ref(null);
const showWhisperAdvanced = ref(false);

// API Keys
const apiKeys = reactive({
  openrouter: localStorage.getItem('openRouterApiKey') || '',
  anthropic: localStorage.getItem('anthropicApiKey') || '',
  google: localStorage.getItem('geminiApiKey') || ''
});

// Filters
const activeFilters = ref(new Set());

// System Messages
const systemMessages = reactive({
  text: localStorage.getItem('systemMessage_text') || 'You are a helpful text assistant. Provide clear, accurate, and helpful responses.',
  vision: localStorage.getItem('systemMessage_vision') || 'You are a vision assistant. Analyze images carefully and provide detailed, accurate descriptions and insights.',
  code: localStorage.getItem('systemMessage_code') || 'You are a coding assistant. Write clean, efficient code with proper explanations and follow best practices.',
  router: localStorage.getItem('systemMessage_router') || 'You are a request router. Categorize user requests into: "code", "vision", or "text". Respond with ONLY the category name.'
});

// TTS
const ttsSettings = reactive({
  voice: ttsService.settings.voice,
  speed: ttsService.settings.speed,
  autoRead: ttsService.settings.autoRead,
  enabled: ttsService.settings.enabled
});

// Whisper Settings
const whisperSettings = reactive({
  enabled: JSON.parse(localStorage.getItem('whisperSettings_enabled') || 'false'),
  model: localStorage.getItem('whisperSettings_model') || 'ggml-base.en.bin',
  language: localStorage.getItem('whisperSettings_language') || 'auto',
  threads: parseInt(localStorage.getItem('whisperSettings_threads') || '4'),
  translate: JSON.parse(localStorage.getItem('whisperSettings_translate') || 'false'),
  diarize: JSON.parse(localStorage.getItem('whisperSettings_diarize') || 'false'),
  timestamps: JSON.parse(localStorage.getItem('whisperSettings_timestamps') || 'true'),
  temperature: parseFloat(localStorage.getItem('whisperSettings_temperature') || '0.0'),
  beamSize: parseInt(localStorage.getItem('whisperSettings_beamSize') || '5')
});

const isTesting = ref(false);
const voices = computed(() => ttsService.voices.value);

// Notification
const notification = ref({ show: false, message: '' });

// Testing state
const testMode = ref('quick');
const quickTestConfig = reactive({
  testRuns: 3,
  questionsPerRun: 5,
  temperature: 0.7,
  category: 'prompt-adherence'
});

const testTemplate = reactive({
  name: '',
  description: '',
  category: 'prompt-adherence',
  config: {
    testRuns: 3,
    questionsPerRun: 5,
    timeout: 60,
    temperature: 0.7
  },
  promptTemplate: 'Task: {task}\n\nContext: {context}\n\nPlease provide a response in the following format: {format}\n\nExamples: {examples}',
  evaluationCriteria: [
    { name: 'Accuracy', weight: 0.4, description: 'How accurate is the response?' },
    { name: 'Completeness', weight: 0.3, description: 'Does the response address all parts of the question?' },
    { name: 'Format Compliance', weight: 0.3, description: 'Does the response follow the specified format?' }
  ],
  testingAgent: '',
  testGenerationPrompt: 'Generate {questionsPerRun} test questions for evaluating {category}. Each question should test different aspects and difficulty levels. Return a JSON array with objects containing "question", "expectedAnswer", "context", and "difficulty" fields.'
});

const selectedTestModels = ref([]);
const testModelFilter = ref('all');
const testSearchQuery = ref('');
const activeTestFilters = ref(new Set());
const showSelectedModels = ref(false);
const isGeneratingData = ref(false);
const isRunningTests = ref(false);
const isPaused = ref(false);
const generatedTestData = ref([]);
const testResults = ref([]);
const detailedTestResults = ref([]);
const showDetailedResults = ref(false);
const expandedModelRows = ref(new Set());
const responseModal = ref({ show: false, title: '', content: '', isJson: false });
const testProgress = ref({ current: 0, total: 0, currentModel: '', currentQuestion: '' });
const testState = ref({
  currentModelIndex: 0,
  currentQuestionIndex: 0,
  currentRunIndex: 0,
  resumeData: null
});

// Configuration
const apiProviders = [
  { id: 'ollama', name: 'Ollama', placeholder: '' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-v1-...' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'google', name: 'Google', placeholder: 'AIza...' }
];

const agentTypes = [
  { id: 'text', name: 'Text Agent', emoji: '💬', color: '#3b82f6' },
  { id: 'vision', name: 'Vision Agent', emoji: '👁️', color: '#8b5cf6' },
  { id: 'code', name: 'Code Agent', emoji: '💻', color: '#10b981' },
  { id: 'router', name: 'Router Agent', emoji: '🧠', color: '#f59e0b' }
];

// Dynamic agent creation state
const showCustomAgentForm = ref(false);
const customAgentForm = reactive({
  name: '',
  description: '',
  emoji: '🤖',
  color: '#6366f1',
  triggerPatterns: [''],
  tags: ['']
});

const quickFilters = [
  { id: 'vision', label: 'Vision' },
  { id: 'code', label: 'Code' },
  { id: 'free', label: 'Free' },
  { id: 'small', label: '< 7B' },
  { id: 'large', label: '≥ 20B' },
  { id: 'fast', label: 'Fast' },
  { id: 'quality', label: 'Quality' }
];

// Test-specific filters
const testQuickFilters = [
  { id: 'vision', label: 'Vision' },
  { id: 'code', label: 'Code' },
  { id: 'free', label: 'Free' },
  { id: 'small', label: '< 7B' },
  { id: 'large', label: '≥ 20B' },
  { id: 'fast', label: 'Fast' },
  { id: 'local', label: 'Local' }
];

// Whisper Models
const whisperModels = [
  { id: 'ggml-tiny.bin', name: 'Tiny (39 MB)' },
  { id: 'ggml-tiny.en.bin', name: 'Tiny.en (39 MB)' },
  { id: 'ggml-base.bin', name: 'Base (142 MB)' },
  { id: 'ggml-base.en.bin', name: 'Base.en (142 MB)' },
  { id: 'ggml-small.bin', name: 'Small (466 MB)' },
  { id: 'ggml-small.en.bin', name: 'Small.en (466 MB)' },
  { id: 'ggml-medium.bin', name: 'Medium (1.5 GB)' },
  { id: 'ggml-medium.en.bin', name: 'Medium.en (1.5 GB)' },
  { id: 'ggml-large-v1.bin', name: 'Large v1 (2.9 GB)' },
  { id: 'ggml-large-v2.bin', name: 'Large v2 (2.9 GB)' },
  { id: 'ggml-large-v3.bin', name: 'Large v3 (2.9 GB)' }
];

// Theme reactivity - watch for theme changes from DOM
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light');

// Theme observer to detect theme changes
let themeObserver;

const updateThemeFromDOM = () => {
  const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
  if (newTheme !== currentTheme.value) {
    currentTheme.value = newTheme;
  }
};

// Theme-based computed values
const isDark = computed(() => themeStore.isDarkTheme(currentTheme.value));
const colors = computed(() => themeStore.getThemeColors(currentTheme.value));

// Styles - Use DaisyUI variables for consistency
const mainStyle = computed(() => ({
  '--primary': colors.value.primary,
  '--secondary': colors.value.secondary,
  '--accent': colors.value.accent
}));

// Computed
const allModels = computed(() => {
  const models = [];
  if (activeProvider.value === 'all' || activeProvider.value === 'ollama') {
    models.push(...(modelStore.ollamaModels || []));
  }
  if (activeProvider.value === 'all' || activeProvider.value === 'openrouter') {
    models.push(...(modelStore.openRouterModels || []));
  }
  if (activeProvider.value === 'all' || activeProvider.value === 'anthropic') {
    models.push(...(modelStore.anthropicModels || []));
  }
  if (activeProvider.value === 'all' || activeProvider.value === 'google') {
    models.push(...(modelStore.googleModels || []));
  }
  return models;
});

const filteredModels = computed(() => {
  let models = allModels.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    models = models.filter(model =>
      model.name.toLowerCase().includes(query) ||
      model.description?.toLowerCase().includes(query) ||
      model.provider?.toLowerCase().includes(query)
    );
  }

  if (activeFilters.value.size > 0) {
    models = models.filter(model => {
      // ALL filters must match (AND logic)
      for (const filterId of activeFilters.value) {
        let matches = false;

        if (filterId === 'vision') {
          matches = hasVisionCapability(model);
        } else if (filterId === 'code') {
          matches = hasCodeCapability(model);
        } else if (filterId === 'free') {
          matches = model.isFree === true;
        } else if (filterId === 'small') {
          const size = parseFloat(model.parameterSize || '0');
          matches = size > 0 && size < 7;
        } else if (filterId === 'large') {
          const size = parseFloat(model.parameterSize || '0');
          matches = size >= 20;
        } else if (filterId === 'fast') {
          const size = parseFloat(model.parameterSize || '0');
          matches = (size > 0 && size < 7) || model.quantization?.includes('Q4') || false;
        } else if (filterId === 'quality') {
          matches = model.quantization?.includes('Q6') || model.quantization?.includes('Q8') || !model.quantization;
        }

        if (!matches) return false; // If any filter doesn't match, exclude the model
      }
      return true; // All filters matched
    });
  }

  return models.sort((a, b) => {
    const aFav = isFavorite(a);
    const bFav = isFavorite(b);
    if (aFav !== bFav) return bFav ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
});

const totalModels = computed(() => allModels.value.length);
const freeModelsCount = computed(() => allModels.value.filter(m => m.isFree).length);
const configuredAgentsCount = computed(() => agentTypes.filter(agent => getAgentModel(agent.id)).length);
const displayedModels = computed(() => {
  const endIndex = (currentPage.value + 1) * itemsPerPage;
  return filteredModels.value.slice(0, endIndex);
});
const hasMoreModels = computed(() => displayedModels.value.length < filteredModels.value.length);
const remainingCount = computed(() => filteredModels.value.length - displayedModels.value.length);

// Methods
const isConnected = (provider) => {
  switch (provider) {
    case 'ollama': return modelStore.ollamaModels.length > 0;
    case 'openrouter': return !!apiKeys.openrouter && modelStore.openRouterModels.length > 0;
    case 'anthropic': return !!apiKeys.anthropic && modelStore.anthropicModels.length > 0;
    case 'google': return !!apiKeys.google && modelStore.googleModels.length > 0;
    default: return false;
  }
};

const hasError = (provider) => {
  switch (provider) {
    case 'openrouter': return !!apiKeys.openrouter && modelStore.openRouterModels.length === 0;
    case 'anthropic': return !!apiKeys.anthropic && modelStore.anthropicModels.length === 0;
    case 'google': return !!apiKeys.google && modelStore.googleModels.length === 0;
    default: return false;
  }
};

const getStatusText = (provider) => {
  if (isConnected(provider)) return 'Connected';
  if (hasError(provider)) return 'Error';
  if (provider === 'ollama') return 'Not running';
  return 'No API key';
};

const toggleProviderConfig = (providerId) => {
  if (providerId !== 'ollama') {
    showApiConfig.value = !showApiConfig.value;
  }
};

const selectAgent = (agentId) => {
  selectedAgent.value = selectedAgent.value === agentId ? null : agentId;
};

const updateSystemMessage = () => {
  if (selectedAgent.value) {
    localStorage.setItem(`systemMessage_${selectedAgent.value}`, systemMessages[selectedAgent.value]);
    showNotification('System message updated');
  }
};

const resetSystemMessage = () => {
  if (selectedAgent.value) {
    const defaults = {
      text: 'You are a helpful text assistant. Provide clear, accurate, and helpful responses.',
      vision: 'You are a vision assistant. Analyze images carefully and provide detailed, accurate descriptions and insights.',
      code: 'You are a coding assistant. Write clean, efficient code with proper explanations and follow best practices.',
      router: 'You are a request router. Categorize user requests into: "code", "vision", or "text". Respond with ONLY the category name.'
    };
    systemMessages[selectedAgent.value] = defaults[selectedAgent.value];
    localStorage.setItem(`systemMessage_${selectedAgent.value}`, systemMessages[selectedAgent.value]);
    showNotification('System message reset to default');
  }
};

const updateWhisperSettings = () => {
  Object.keys(whisperSettings).forEach(key => {
    localStorage.setItem(`whisperSettings_${key}`,
      typeof whisperSettings[key] === 'boolean' ? JSON.stringify(whisperSettings[key]) : whisperSettings[key]);
  });
  showNotification('Whisper settings updated');
};

const getProviderIcon = (source) => {
  const icons = { ollama: ollamaIcon, openrouter: openRouterIcon, google: googleIcon, anthropic: anthropicIcon };
  return icons[source] || openRouterIcon;
};

const hasVisionCapability = (model) => {
  // Check if model explicitly supports vision
  if (model.supportsVision === true) return true;

  // Check capabilities array
  if (model.capabilities?.includes('vision')) return true;

  // Check name patterns for known vision models
  const modelName = model.name.toLowerCase();
  const visionPatterns = ['vision', 'llava', 'claude-3', 'gpt-4v', 'gemini-pro-vision', 'gemini-2.0-flash'];
  if (visionPatterns.some(pattern => modelName.includes(pattern))) return true;

  // For OpenRouter, check architecture
  if (model.source === 'openrouter' && model.architecture?.input_modalities?.includes('image')) return true;

  // For Anthropic, Claude 3 models support vision
  if (model.source === 'anthropic' && modelName.includes('claude-3')) return true;

  // For Google, Gemini models with vision in name or 2.0 flash support vision
  if (model.source === 'google' && (modelName.includes('vision') || modelName.includes('2.0-flash'))) return true;

  return false;
};

const hasCodeCapability = (model) => {
  return model.name.toLowerCase().includes('code') ||
    model.name.toLowerCase().includes('coder') ||
    model.name.toLowerCase().includes('codestral');
};

const formatContext = (tokens) => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return `${tokens}`;
};

const saveApiKey = async (provider) => {
  const key = apiKeys[provider];
  if (!key) return;

  const keyMap = { openrouter: 'openRouterApiKey', anthropic: 'anthropicApiKey', google: 'geminiApiKey' };
  localStorage.setItem(keyMap[provider], key);
  await modelStore.initializeProvider(provider);
  showNotification(`${provider} API key saved`);
  emit('api-key-saved', { provider, apiKey: key });
};

const toggleFilter = (filterId) => {
  if (activeFilters.value.has(filterId)) {
    activeFilters.value.delete(filterId);
  } else {
    activeFilters.value.add(filterId);
  }
  currentPage.value = 0;
};

const loadMoreModels = async () => {
  if (isLoadingMore.value || !hasMoreModels.value) return;
  isLoadingMore.value = true;
  await new Promise(resolve => setTimeout(resolve, 300));
  currentPage.value++;
  isLoadingMore.value = false;
};

const getAgentModel = (agentId) => {
  // For standard agents, find by type
  const standardAgent = agentStore.agentConfigs.find(config => config.type === agentId && config.isDefault && config.enabled);
  if (standardAgent) return standardAgent.model || null;

  // For custom agents, find by ID
  const customAgent = agentStore.agentConfigs.find(config => config.id === agentId);
  return customAgent?.model || null;
};

const setAsAgent = (agentId, model) => {
  // For custom agents, update the specific agent config
  const customAgent = agentStore.agentConfigs.find(config => config.id === agentId);
  if (customAgent) {
    agentStore.updateAgentConfig(agentId, { model, enabled: true });
    showNotification(`Set as ${customAgent.name}`);
  } else {
    // For standard agents
    agentStore.setAgentModel(agentId, model);
    const agentType = agentTypes.find(a => a.id === agentId);
    showNotification(`Set as ${agentType?.name}`);
  }
  emit('model-selected', model);
};

const clearAgent = (agentId) => {
  // Check if it's a custom agent
  const customAgent = agentStore.agentConfigs.find(config => config.id === agentId);
  if (customAgent) {
    agentStore.updateAgentConfig(agentId, { model: null });
    showNotification(`${customAgent.name} cleared`);
  } else {
    // For standard agents
    const config = agentStore.agentConfigs.find(config => config.type === agentId && config.isDefault);
    if (config) {
      agentStore.updateAgentConfig(config.id, { model: null });
      showNotification(`${agentTypes.find(a => a.id === agentId)?.name} cleared`);
    }
  }
};

const isFavorite = (model) => {
  const favorites = JSON.parse(localStorage.getItem('favoriteModels') || '[]');
  return favorites.some(fav => fav.id === model.id);
};

const toggleFavorite = (model) => {
  const favorites = JSON.parse(localStorage.getItem('favoriteModels') || '[]');
  const index = favorites.findIndex(fav => fav.id === model.id);

  if (index >= 0) {
    favorites.splice(index, 1);
    showNotification('Removed from favorites');
  } else {
    favorites.push(model);
    showNotification('Added to favorites');
  }

  localStorage.setItem('favoriteModels', JSON.stringify(favorites));
};

const updateTTSSettings = () => {
  ttsService.updateSettings(ttsSettings);
  showNotification('TTS settings updated');
};

const testVoice = async () => {
  if (isTesting.value) return;
  isTesting.value = true;
  try {
    await ttsService.speak("Hello! This is a test of your text-to-speech settings.");
    showNotification('Voice test completed');
  } catch (error) {
    showNotification('Voice test failed');
  } finally {
    isTesting.value = false;
  }
};

const showNotification = (message) => {
  notification.value = { show: true, message };
  setTimeout(() => notification.value.show = false, 3000);
};

// Custom agent methods
const createCustomAgent = () => {
  if (!customAgentForm.name || !customAgentForm.description) {
    showNotification('Please provide name and description');
    return;
  }

  const validPatterns = customAgentForm.triggerPatterns.filter(p => p.trim());
  const validTags = customAgentForm.tags.filter(t => t.trim());

  const newAgent = agentStore.createAgentType(
    customAgentForm.name,
    customAgentForm.description,
    validPatterns,
    validTags
  );

  // Reset form
  customAgentForm.name = '';
  customAgentForm.description = '';
  customAgentForm.triggerPatterns = [''];
  customAgentForm.tags = [''];
  showCustomAgentForm.value = false;

  showNotification(`Created custom agent: ${newAgent.name}`);
};

const addTriggerPattern = () => {
  customAgentForm.triggerPatterns.push('');
};

const removeTriggerPattern = (index) => {
  if (customAgentForm.triggerPatterns.length > 1) {
    customAgentForm.triggerPatterns.splice(index, 1);
  }
};

const addTag = () => {
  customAgentForm.tags.push('');
};

const removeTag = (index) => {
  if (customAgentForm.tags.length > 1) {
    customAgentForm.tags.splice(index, 1);
  }
};

// Get all agents including custom ones
const allAgentTypes = computed(() => {
  const customAgents = agentStore.customAgents.map(agent => ({
    id: agent.id,
    name: agent.name,
    emoji: '🤖',
    color: '#6366f1',
    isCustom: true
  }));

  return [...agentTypes, ...customAgents];
});

// Testing computed properties
const filteredTestModels = computed(() => {
  let models = allModels.value;

  // Provider filter
  if (testModelFilter.value !== 'all') {
    models = models.filter(model => model.source === testModelFilter.value);
  }

  // Search filter
  if (testSearchQuery.value) {
    const query = testSearchQuery.value.toLowerCase();
    models = models.filter(model =>
      model.name.toLowerCase().includes(query) ||
      model.description?.toLowerCase().includes(query) ||
      model.provider?.toLowerCase().includes(query)
    );
  }

  // Quick filters
  if (activeTestFilters.value.size > 0) {
    models = models.filter(model => {
      for (const filterId of activeTestFilters.value) {
        let matches = false;

        if (filterId === 'vision') {
          matches = hasVisionCapability(model);
        } else if (filterId === 'code') {
          matches = hasCodeCapability(model);
        } else if (filterId === 'free') {
          matches = model.isFree === true;
        } else if (filterId === 'small') {
          const size = parseFloat(model.parameterSize || '0');
          matches = size > 0 && size < 7;
        } else if (filterId === 'large') {
          const size = parseFloat(model.parameterSize || '0');
          matches = size >= 20;
        } else if (filterId === 'fast') {
          const size = parseFloat(model.parameterSize || '0');
          matches = (size > 0 && size < 7) || model.quantization?.includes('Q4') || false;
        } else if (filterId === 'local') {
          matches = model.source === 'ollama';
        }

        if (!matches) return false;
      }
      return true;
    });
  }

  return models.sort((a, b) => {
    const aSelected = isModelSelected(a);
    const bSelected = isModelSelected(b);
    if (aSelected !== bSelected) return bSelected ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
});

const canGenerateTestData = computed(() => {
  return testTemplate.testingAgent && testTemplate.name && testTemplate.config.questionsPerRun > 0;
});

const canRunTests = computed(() => {
  return selectedTestModels.value.length > 0 && generatedTestData.value.length > 0;
});

const sortedTestResults = computed(() => {
  return [...testResults.value].sort((a, b) => b.overallScore - a.overallScore);
});

const isModelSelected = (model) => {
  return selectedTestModels.value.some(m => m.id === model.id);
};

// Testing methods
const loadTemplate = () => {
  // TODO: Implement template loading from localStorage or file
  showNotification('Template loading not yet implemented');
};

const saveTemplate = () => {
  const templates = JSON.parse(localStorage.getItem('testTemplates') || '[]');
  const templateToSave = { ...testTemplate, id: Date.now(), createdAt: new Date().toISOString() };
  templates.push(templateToSave);
  localStorage.setItem('testTemplates', JSON.stringify(templates));
  showNotification('Template saved successfully');
};

const resetTemplate = () => {
  Object.assign(testTemplate, {
    name: '',
    description: '',
    category: 'prompt-adherence',
    config: {
      testRuns: 3,
      questionsPerRun: 5,
      timeout: 60,
      temperature: 0.7
    },
    promptTemplate: 'Task: {task}\n\nContext: {context}\n\nPlease provide a response in the following format: {format}\n\nExamples: {examples}',
    evaluationCriteria: [
      { name: 'Accuracy', weight: 0.4, description: 'How accurate is the response?' },
      { name: 'Completeness', weight: 0.3, description: 'Does the response address all parts of the question?' },
      { name: 'Format Compliance', weight: 0.3, description: 'Does the response follow the specified format?' }
    ],
    testingAgent: '',
    testGenerationPrompt: 'Generate {questionsPerRun} test questions for evaluating {category}. Each question should test different aspects and difficulty levels. Return a JSON array with objects containing "question", "expectedAnswer", "context", and "difficulty" fields.'
  });
  showNotification('Template reset to defaults');
};

const insertVariable = (variable) => {
  const textarea = document.querySelector('.prompt-textarea');
  if (textarea) {
    const cursorPos = textarea.selectionStart;
    const textBefore = testTemplate.promptTemplate.substring(0, cursorPos);
    const textAfter = testTemplate.promptTemplate.substring(cursorPos);
    testTemplate.promptTemplate = textBefore + `{${variable}}` + textAfter;
  }
};

const addCriterion = () => {
  testTemplate.evaluationCriteria.push({
    name: '',
    weight: 0.1,
    description: ''
  });
};

const removeCriterion = (index) => {
  if (testTemplate.evaluationCriteria.length > 1) {
    testTemplate.evaluationCriteria.splice(index, 1);
  }
};

const toggleModelSelection = (model) => {
  if (isModelSelected(model)) {
    removeFromTest(model);
  } else {
    selectedTestModels.value.push(model);
  }
};

const removeFromTest = (model) => {
  const index = selectedTestModels.value.findIndex(m => m.id === model.id);
  if (index !== -1) {
    selectedTestModels.value.splice(index, 1);
  }
};

const selectAllModels = () => {
  selectedTestModels.value = [...filteredTestModels.value];
};

const clearModelSelection = () => {
  selectedTestModels.value = [];
};

const toggleTestFilter = (filterId) => {
  if (activeTestFilters.value.has(filterId)) {
    activeTestFilters.value.delete(filterId);
  } else {
    activeTestFilters.value.add(filterId);
  }
};

const generateTestData = async () => {
  if (!canGenerateTestData.value) return;

  isGeneratingData.value = true;
  try {
    // Get the testing agent model
    const testingAgentModel = getAgentModel(testTemplate.testingAgent);
    if (!testingAgentModel) {
      throw new Error('Testing agent model not found');
    }

    // Replace variables in the generation prompt
    const prompt = testTemplate.testGenerationPrompt
      .replace('{questionsPerRun}', testTemplate.config.questionsPerRun)
      .replace('{category}', testTemplate.category);

    // TODO: Implement actual API call to testing agent
    // For now, simulate with setTimeout
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate mock test data
    const mockData = [];
    for (let i = 0; i < testTemplate.config.questionsPerRun; i++) {
      mockData.push({
        question: `Test question ${i + 1} for ${testTemplate.category}`,
        expectedAnswer: `Expected answer for question ${i + 1}`,
        context: `Context for question ${i + 1}`,
        difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)]
      });
    }

    generatedTestData.value = mockData;
    showNotification(`Generated ${mockData.length} test questions`);

  } catch (error) {
    console.error('Failed to generate test data:', error);
    showNotification('Failed to generate test data');
  } finally {
    isGeneratingData.value = false;
  }
};

// Pause/Resume functionality
const pauseTests = () => {
  isPaused.value = true;
  showNotification('Test run paused');
};

const resumeTests = () => {
  isPaused.value = false;
  showNotification('Test run resumed');
};

const stopTests = () => {
  isRunningTests.value = false;
  isPaused.value = false;
  testState.value = { currentModelIndex: 0, currentQuestionIndex: 0, currentRunIndex: 0, resumeData: null };
  showNotification('Test run stopped');
};

// Wait for pause/resume
const waitForResume = async () => {
  while (isPaused.value && isRunningTests.value) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

const runTests = async () => {
  if (!canRunTests.value) return;

  isRunningTests.value = true;
  isPaused.value = false;
  testResults.value = [];
  detailedTestResults.value = [];
  expandedModelRows.value.clear();

  try {
    const totalTests = selectedTestModels.value.length * generatedTestData.value.length;
    testProgress.value = { current: 0, total: totalTests, currentModel: '', currentQuestion: '' };

    for (let modelIndex = testState.value.currentModelIndex; modelIndex < selectedTestModels.value.length; modelIndex++) {
      if (!isRunningTests.value) break; // Check if test was stopped

      const model = selectedTestModels.value[modelIndex];
      testProgress.value.currentModel = model.name;
      testState.value.currentModelIndex = modelIndex;

      const modelResult = {
        modelId: model.id,
        modelName: model.name,
        modelSource: model.source,
        questionsAnswered: 0,
        criteriaScores: testTemplate.evaluationCriteria.map(c => ({ name: c.name, score: 0 })),
        overallScore: 0,
        avgResponseTime: 0,
        errors: 0
      };

      const modelDetailedResults = {
        modelId: model.id,
        modelName: model.name,
        modelSource: model.source,
        questionResults: []
      };

      let totalResponseTime = 0;

      for (let questionIndex = testState.value.currentQuestionIndex; questionIndex < generatedTestData.value.length; questionIndex++) {
        if (!isRunningTests.value) break; // Check if test was stopped

        // Wait if paused
        await waitForResume();
        if (!isRunningTests.value) break;

        const question = generatedTestData.value[questionIndex];
        testProgress.value.current++;
        testProgress.value.currentQuestion = question.question.substring(0, 50) + '...';
        testState.value.currentQuestionIndex = questionIndex;

        try {
          const startTime = Date.now();

          // Make actual API call to the model
          const response = await callModelAPI(model, question.question);

          const responseTime = Date.now() - startTime;
          totalResponseTime += responseTime;
          modelResult.questionsAnswered++;

          // Evaluate the response
          const evaluation = await evaluateResponse(question, response);

          // Store detailed result
          const questionResult = {
            question: question.question,
            expectedAnswer: question.expectedAnswer,
            actualAnswer: response,
            responseTime: responseTime,
            scores: evaluation.scores,
            overallScore: evaluation.overallScore,
            passed: evaluation.passed,
            feedback: evaluation.feedback,
            difficulty: question.difficulty,
            context: question.context
          };

          modelDetailedResults.questionResults.push(questionResult);

          // Update model result scores
          modelResult.criteriaScores.forEach(criterion => {
            const evalCriterion = evaluation.scores.find(s => s.name === criterion.name);
            if (evalCriterion) {
              criterion.score += evalCriterion.score;
            }
          });

        } catch (error) {
          console.error('Question evaluation failed:', error);
          modelResult.errors++;

          // Store error result
          modelDetailedResults.questionResults.push({
            question: question.question,
            expectedAnswer: question.expectedAnswer,
            actualAnswer: 'ERROR: ' + error.message,
            responseTime: 0,
            scores: testTemplate.evaluationCriteria.map(c => ({ name: c.name, score: 0 })),
            overallScore: 0,
            passed: false,
            feedback: 'Failed to get response from model',
            difficulty: question.difficulty,
            context: question.context
          });
        }
      }

      // Calculate averages only if we completed questions for this model
      if (modelResult.questionsAnswered > 0) {
        modelResult.avgResponseTime = Math.round(totalResponseTime / modelResult.questionsAnswered);
        modelResult.criteriaScores.forEach(criterion => {
          criterion.score = criterion.score / modelResult.questionsAnswered;
        });

        // Calculate overall score based on criteria weights
        modelResult.overallScore = modelResult.criteriaScores.reduce((sum, criterion) => {
          const weight = testTemplate.evaluationCriteria.find(c => c.name === criterion.name)?.weight || 0;
          return sum + (criterion.score * weight);
        }, 0);
      }

      testResults.value.push(modelResult);
      detailedTestResults.value.push(modelDetailedResults);

      // Reset question index for next model
      testState.value.currentQuestionIndex = 0;
    }

    if (isRunningTests.value) {
      showNotification(`Completed testing ${selectedTestModels.value.length} models`);
    }

  } catch (error) {
    console.error('Testing failed:', error);
    showNotification('Testing failed: ' + error.message);
  } finally {
    isRunningTests.value = false;
    isPaused.value = false;
    testProgress.value = { current: 0, total: 0, currentModel: '', currentQuestion: '' };
    testState.value = { currentModelIndex: 0, currentQuestionIndex: 0, currentRunIndex: 0, resumeData: null };
  }
};

// Evaluate response against expected answer and criteria
const evaluateResponse = async (question, response) => {
  try {
    // Simple evaluation logic - in a real implementation, you might use an LLM for evaluation
    const scores = testTemplate.evaluationCriteria.map(criterion => {
      let score = 0;

      switch (criterion.name) {
        case 'Accuracy':
          // Check if response contains key elements from expected answer
          if (question.expectedAnswer && response) {
            const expectedWords = question.expectedAnswer.toLowerCase().split(/\s+/);
            const responseWords = response.toLowerCase().split(/\s+/);
            const matchingWords = expectedWords.filter(word => responseWords.includes(word));
            score = (matchingWords.length / expectedWords.length) * 100;
          }
          break;

        case 'Completeness':
          // Check response length and structure
          if (response && response.length > 20) {
            score = Math.min(100, (response.length / 200) * 100);
          }
          break;

        case 'Format Compliance':
          // Check if response follows expected format
          score = response && response.length > 0 ? 85 + Math.random() * 15 : 0;
          break;

        default:
          score = 50 + Math.random() * 50; // Random score for custom criteria
      }

      return { name: criterion.name, score: Math.max(0, Math.min(100, score)) };
    });

    // Calculate overall score
    const overallScore = scores.reduce((sum, score, index) => {
      const weight = testTemplate.evaluationCriteria[index]?.weight || 0;
      return sum + (score.score * weight);
    }, 0);

    const passed = overallScore >= 60; // Pass threshold

    return {
      scores,
      overallScore,
      passed,
      feedback: passed ? 'Response meets criteria' : 'Response needs improvement'
    };

  } catch (error) {
    console.error('Evaluation failed:', error);
    return {
      scores: testTemplate.evaluationCriteria.map(c => ({ name: c.name, score: 0 })),
      overallScore: 0,
      passed: false,
      feedback: 'Evaluation failed: ' + error.message
    };
  }
};

const getScoreClass = (score) => {
  if (score >= 80) return 'score-excellent';
  if (score >= 60) return 'score-good';
  if (score >= 40) return 'score-fair';
  return 'score-poor';
};

// Model row expansion functions
const toggleModelRow = (modelId) => {
  if (expandedModelRows.value.has(modelId)) {
    expandedModelRows.value.delete(modelId);
  } else {
    expandedModelRows.value.add(modelId);
  }
};

const isModelRowExpanded = (modelId) => {
  return expandedModelRows.value.has(modelId);
};

const getModelDetailedResults = (modelId) => {
  return detailedTestResults.value.find(result => result.modelId === modelId);
};

// Modal functions
const showResponseModal = (title, content, isJson = false) => {
  responseModal.value = {
    show: true,
    title,
    content: isJson ? formatJson(content) : content,
    isJson
  };
};

const closeResponseModal = () => {
  responseModal.value.show = false;
};

const formatJson = (content) => {
  try {
    // Remove any leading/trailing whitespace
    const trimmed = typeof content === 'string' ? content.trim() : content;
    
    // Check if it looks like JSON
    if (typeof trimmed === 'string') {
      // Check for JSON-like structure
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed, null, 2);
      }
      
      // Check if it contains JSON embedded in text (common in LLM responses)
      const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          // Return the full text with the JSON portion pretty-printed
          const before = trimmed.substring(0, jsonMatch.index);
          const after = trimmed.substring(jsonMatch.index + jsonMatch[0].length);
          return before + JSON.stringify(parsed, null, 2) + after;
        } catch (e) {
          // If embedded JSON parsing fails, return original
          return content;
        }
      }
    }
    
    // If it's an object, stringify it
    if (typeof trimmed === 'object' && trimmed !== null) {
      return JSON.stringify(trimmed, null, 2);
    }
    
    // Otherwise return as-is
    return content;
  } catch (e) {
    // If parsing fails, return the original content
    return content;
  }
};

const exportResults = () => {
  // Create comprehensive export data
  const exportData = {
    exportInfo: {
      timestamp: new Date().toISOString(),
      testType: testMode.value,
      totalModels: testResults.value.length,
      totalQuestions: testResults.value.reduce((sum, r) => sum + r.questionsAnswered, 0),
      averageScore: Math.round(testResults.value.reduce((sum, r) => sum + r.overallScore, 0) / testResults.value.length) || 0
    },
    testConfiguration: testMode.value === 'quick' ? {
      type: 'quick',
      category: quickTestConfig.category,
      testRuns: quickTestConfig.testRuns,
      questionsPerRun: quickTestConfig.questionsPerRun,
      temperature: quickTestConfig.temperature
    } : {
      type: 'custom',
      name: testTemplate.name,
      description: testTemplate.description,
      category: testTemplate.category,
      config: testTemplate.config,
      evaluationCriteria: testTemplate.evaluationCriteria
    },
    summaryResults: testResults.value,
    detailedResults: detailedTestResults.value.map(modelResult => ({
      modelId: modelResult.modelId,
      modelName: modelResult.modelName,
      modelSource: modelResult.modelSource,
      questionsAndAnswers: modelResult.questionResults.map((questionResult, index) => ({
        questionNumber: index + 1,
        question: questionResult.question,
        expectedAnswer: questionResult.expectedAnswer,
        actualAnswer: questionResult.actualAnswer,
        responseTime: questionResult.responseTime,
        scores: questionResult.scores,
        overallScore: questionResult.overallScore,
        passed: questionResult.passed,
        feedback: questionResult.feedback,
        difficulty: questionResult.difficulty,
        context: questionResult.context
      })),
      statistics: {
        totalQuestions: modelResult.questionResults.length,
        questionsPassed: modelResult.questionResults.filter(q => q.passed).length,
        questionsFailed: modelResult.questionResults.filter(q => !q.passed).length,
        passRate: Math.round((modelResult.questionResults.filter(q => q.passed).length / modelResult.questionResults.length) * 100) || 0,
        averageResponseTime: Math.round(modelResult.questionResults.reduce((sum, q) => sum + q.responseTime, 0) / modelResult.questionResults.length) || 0,
        averageScore: Math.round(modelResult.questionResults.reduce((sum, q) => sum + q.overallScore, 0) / modelResult.questionResults.length) || 0
      }
    })),
    testQuestions: generatedTestData.value
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `llm-test-results-${testMode.value}-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showNotification('Comprehensive results exported successfully');
};

const clearResults = () => {
  testResults.value = [];
  detailedTestResults.value = [];
  generatedTestData.value = [];
  expandedModelRows.value.clear();
  showNotification('Results cleared');
};

// API calling functions for testing
const callModelAPI = async (model, question) => {
  const systemPrompt = 'You are being tested for prompt adherence. Answer the question directly and accurately.';
  const openRouterApiKey = localStorage.getItem('openRouterApiKey') || '';

  let endpoint = '';
  let headers = { 'Content-Type': 'application/json' };
  let requestBody;

  switch (model.source) {
    case 'openrouter':
      endpoint = 'http://127.0.0.1:5050/api/chat/openrouter/stream';
      headers['X-API-Key'] = openRouterApiKey;
      requestBody = {
        model: model.id,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.3,
        max_tokens: 500
      };
      break;

    case 'ollama':
      endpoint = 'http://localhost:11434/api/chat';
      requestBody = {
        model: model.id,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 500
        }
      };
      break;

    case 'anthropic':
      const anthropicApiKey = localStorage.getItem('anthropicApiKey');
      if (!anthropicApiKey) throw new Error('Anthropic API key not found');
      endpoint = 'http://127.0.0.1:5050/api/chat/anthropic/stream';
      headers['X-API-Key'] = anthropicApiKey;
      requestBody = {
        model: model.id,
        messages: [{ role: 'user', content: question }],
        system: systemPrompt,
        temperature: 0.3,
        max_tokens: 500
      };
      break;

    case 'google':
      const geminiApiKey = localStorage.getItem('geminiApiKey');
      if (!geminiApiKey) throw new Error('Gemini API key not found');
      endpoint = 'http://127.0.0.1:5050/api/chat/google/stream';
      headers['X-API-Key'] = geminiApiKey;
      requestBody = {
        model: model.id,
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\n' + question }] }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500
        }
      };
      break;

    default:
      throw new Error(`Unsupported model source: ${model.source}`);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  // Handle streaming responses
  if (model.source === 'ollama') {
    const data = await response.json();
    return data.message?.content || '';
  } else {
    // For streaming providers, collect the full response
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let fullResponse = '';
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices?.[0]?.delta?.content) {
              fullResponse += data.choices[0].delta.content;
            }
          } catch (e) {
            // Ignore parsing errors for non-JSON lines
          }
        }
      }
    }

    return fullResponse;
  }
};

const runQuickTest = async () => {
  if (selectedTestModels.value.length === 0) return;

  // Use the existing runTests functionality but with predefined settings
  isRunningTests.value = true;
  isPaused.value = false;
  testResults.value = [];
  detailedTestResults.value = [];
  expandedModelRows.value.clear();

  try {
    // Generate default prompt adherence test data based on category
    const defaultQuestions = generateDefaultTestQuestions(quickTestConfig.category, quickTestConfig.questionsPerRun);
    generatedTestData.value = defaultQuestions;

    const totalTests = selectedTestModels.value.length * defaultQuestions.length * quickTestConfig.testRuns;
    testProgress.value = { current: 0, total: totalTests, currentModel: '', currentQuestion: '' };

    for (let modelIndex = testState.value.currentModelIndex; modelIndex < selectedTestModels.value.length; modelIndex++) {
      if (!isRunningTests.value) break; // Check if test was stopped

      const model = selectedTestModels.value[modelIndex];
      testProgress.value.currentModel = model.name;
      testState.value.currentModelIndex = modelIndex;

      const modelResult = {
        modelId: model.id,
        modelName: model.name,
        modelSource: model.source,
        questionsAnswered: 0,
        criteriaScores: [
          { name: 'Accuracy', score: 0 },
          { name: 'Completeness', score: 0 },
          { name: 'Format Compliance', score: 0 }
        ],
        overallScore: 0,
        avgResponseTime: 0,
        errors: 0
      };

      const modelDetailedResults = {
        modelId: model.id,
        modelName: model.name,
        modelSource: model.source,
        questionResults: []
      };

      let totalResponseTime = 0;

      for (let run = 0; run < quickTestConfig.testRuns; run++) {
        for (let questionIndex = 0; questionIndex < defaultQuestions.length; questionIndex++) {
          if (!isRunningTests.value) break; // Check if test was stopped

          // Wait if paused
          await waitForResume();
          if (!isRunningTests.value) break;

          const question = defaultQuestions[questionIndex];
          testProgress.value.current++;
          testProgress.value.currentQuestion = question.question.substring(0, 50) + '...';

          try {
            const startTime = Date.now();

            // Make actual API call to the model
            const response = await callModelAPI(model, question.question);

            const responseTime = Date.now() - startTime;
            totalResponseTime += responseTime;
            modelResult.questionsAnswered++;

            // Evaluate the response
            const evaluation = await evaluateResponse(question, response);

            // Store detailed result
            const questionResult = {
              question: question.question,
              expectedAnswer: question.expectedAnswer,
              actualAnswer: response,
              responseTime: responseTime,
              scores: evaluation.scores,
              overallScore: evaluation.overallScore,
              passed: evaluation.passed,
              feedback: evaluation.feedback,
              difficulty: question.difficulty,
              context: question.context || ''
            };

            modelDetailedResults.questionResults.push(questionResult);

            // Update model result scores
            modelResult.criteriaScores.forEach(criterion => {
              const evalCriterion = evaluation.scores.find(s => s.name === criterion.name);
              if (evalCriterion) {
                criterion.score += evalCriterion.score;
              }
            });

          } catch (error) {
            console.error(`Error testing ${model.name}:`, error);
            modelResult.errors++;

            // Store error result
            modelDetailedResults.questionResults.push({
              question: question.question,
              expectedAnswer: question.expectedAnswer,
              actualAnswer: 'ERROR: ' + error.message,
              responseTime: 0,
              scores: [
                { name: 'Accuracy', score: 0 },
                { name: 'Completeness', score: 0 },
                { name: 'Format Compliance', score: 0 }
              ],
              overallScore: 0,
              passed: false,
              feedback: 'Failed to get response from model',
              difficulty: question.difficulty,
              context: question.context || ''
            });
          }
        }
      }

      // Calculate averages
      modelResult.avgResponseTime = Math.round(totalResponseTime / modelResult.questionsAnswered);
      modelResult.criteriaScores.forEach(criterion => {
        criterion.score = criterion.score / modelResult.questionsAnswered;
      });

      // Calculate overall score (weighted: Accuracy 40%, Completeness 30%, Format 30%)
      modelResult.overallScore =
        (modelResult.criteriaScores[0].score * 0.4) +
        (modelResult.criteriaScores[1].score * 0.3) +
        (modelResult.criteriaScores[2].score * 0.3);

      testResults.value.push(modelResult);
      detailedTestResults.value.push(modelDetailedResults);
    }

    if (isRunningTests.value) {
      showNotification(`Quick test completed! Tested ${selectedTestModels.value.length} models`);
    }

  } catch (error) {
    console.error('Quick test failed:', error);
    showNotification('Quick test failed: ' + error.message);
  } finally {
    isRunningTests.value = false;
    isPaused.value = false;
    testProgress.value = { current: 0, total: 0, currentModel: '', currentQuestion: '' };
    testState.value = { currentModelIndex: 0, currentQuestionIndex: 0, currentRunIndex: 0, resumeData: null };
  }
};

const generateDefaultTestQuestions = (category, count) => {
  const questionTemplates = {
    'prompt-adherence': [
      'Please write a brief summary of the following topic in exactly 3 sentences',
      'List 5 advantages and 5 disadvantages of renewable energy in bullet points',
      'Explain the concept of machine learning in simple terms, using no more than 100 words',
      'Create a short poem about technology with exactly 4 lines',
      'Describe the process of photosynthesis in 2 paragraphs'
    ],
    'structured-output': [
      'Format your response as a JSON object with "question", "answer", and "confidence" fields',
      'Provide your answer in this format: Problem: [X], Solution: [Y], Result: [Z]',
      'Structure your response using numbered points (1., 2., 3., etc.)',
      'Return a markdown table with columns: Item, Category, Priority, Status',
      'Format as CSV with headers: Name,Type,Value,Description'
    ],
    'code-generation': [
      'Write a Python function that calculates the factorial of a number',
      'Create a JavaScript function to reverse a string',
      'Write SQL to find the top 5 customers by purchase amount',
      'Create a CSS rule for a responsive navigation bar',
      'Write a simple HTML form with validation'
    ],
    'reasoning': [
      'If all birds can fly and penguins are birds, why can\'t penguins fly? Explain the logic.',
      'A train travels 60 mph for 2 hours, then 80 mph for 1 hour. What\'s the average speed?',
      'You have 3 boxes. One contains only apples, one only oranges, one mixed. All labels are wrong. How do you fix them by drawing one fruit?',
      'If it takes 5 machines 5 minutes to make 5 widgets, how long does it take 100 machines to make 100 widgets?',
      'A farmer has chickens and cows. There are 30 heads and 74 legs total. How many of each animal?'
    ]
  };

  const templates = questionTemplates[category] || questionTemplates['prompt-adherence'];
  const questions = [];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    questions.push({
      question: template,
      expectedAnswer: `Expected response for: ${template.substring(0, 50)}...`,
      context: category,
      difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)]
    });
  }

  return questions;
};

const getBaseCategoryScore = (category, model) => {
  // Simulate different model performance based on category and model characteristics
  let baseScore = 70; // Default base score

  if (category === 'code-generation' && hasCodeCapability(model)) {
    baseScore += 15;
  }

  if (category === 'structured-output' && model.name.toLowerCase().includes('gpt')) {
    baseScore += 10;
  }

  if (category === 'reasoning' && model.parameterSize && parseFloat(model.parameterSize) > 10) {
    baseScore += 12;
  }

  if (model.isFree) {
    baseScore -= 5; // Free models might perform slightly lower
  }

  return Math.max(30, Math.min(95, baseScore));
};

// Lifecycle
onMounted(async () => {
  if (voices.value.length === 0) await ttsService.loadVoices();
  Object.assign(ttsSettings, ttsService.settings);

  // Setup theme observer
  themeObserver = new MutationObserver(() => {
    updateThemeFromDOM();
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  // Initial theme check
  updateThemeFromDOM();

  const providers = ['ollama', 'openrouter', 'anthropic', 'google'];
  for (const provider of providers) {
    try {
      await modelStore.initializeProvider(provider);
    } catch (error) {
      console.warn(`Failed to load ${provider} models:`, error);
    }
  }
});

onBeforeUnmount(() => {
  if (themeObserver) {
    themeObserver.disconnect();
  }
});
</script>

<style scoped>
.floating-configurator {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
}

.panel-container {
  height: 100%;
  background: hsl(var(--b1));
  border: 1px solid hsl(var(--b3));
  border-right: none;
  border-radius: inherit;
  /* Inherit border radius from parent */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: all;
  position: relative;
  color: hsl(var(--bc));
}

.panel-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, hsl(var(--p) / 0.04), hsl(var(--a) / 0.02));
  border-radius: inherit;
  /* Inherit border radius from parent */
  pointer-events: none;
  opacity: 0.3;
}


.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: hsl(var(--bc));
  background: linear-gradient(135deg, hsl(var(--p)), hsl(var(--a)));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.close-btn {
  background: hsl(var(--b2));
  border: 1px solid hsl(var(--b3));
  border-radius: 8px;
  padding: 6px;
  color: hsl(var(--bc) / 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: hsl(var(--b3));
  color: hsl(var(--bc));
  transform: scale(1.05);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding-right: 24px;
  padding-left: 24px;
  position: relative;
  font-family: monospace;
  z-index: 1;
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Tab Header */
.tab-header {
  display: flex;
  justify-content: center;
  padding-top: 16px;
  padding-right: 0px;
  padding-left: 0px;
  border-bottom: 1px solid hsl(var(--b3));
}

/* Tab Navigation */
.tab-nav {
  display: flex;
  gap: 2px;
  background: hsl(var(--b2));
  border-radius: 10px;
  padding: 3px;
  position: relative;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: hsl(var(--bc) / 0.6);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 12px;
  font-weight: 500;
  position: relative;
  z-index: 1;
}

.tab-btn:hover {
  color: hsl(var(--bc) / 0.8);
  transform: translateY(-1px);
}

.tab-btn.active {
  background: hsl(var(--b1));
  color: hsl(var(--p));
  box-shadow:
    0 2px 8px hsl(var(--b3) / 0.4),
    0 1px 3px hsl(var(--p) / 0.2);
  transform: translateY(-1px);
  position: relative;
}

.tab-btn.active::before {
  content: '';
  position: absolute;
  bottom: -3px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  background: hsl(var(--p));
  border-radius: 2px;
  box-shadow: 0 0 6px hsl(var(--p) / 0.5);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  background: hsl(var(--pc));
  border: 2px solid hsl(var(--b1));
  border-radius: 50%;
  box-shadow: 0 0 4px hsl(var(--p) / 0.6);
}

.tab-icon {
  font-size: 16px;
  transition: transform 0.2s ease;
}

.tab-btn.active .tab-icon {
  transform: scale(1.1);
}

.tab-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 600;
}

/* Agents Header Row */
.agents-header-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: linear-gradient(135deg, hsl(var(--b2)), hsl(var(--b3)));
  border-radius: 12px;
  border: 1px solid hsl(var(--b3));
  padding-right: 16px;
  padding-left: 16px;
}

.stats-row {
  display: flex;
  gap: 40px;
}

.mini-stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: hsl(var(--p));
}

.stat-label {
  display: block;
  font-size: 10px;
  color: hsl(var(--bc) / 0.7);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.api-status-row {
  display: flex;
  gap: 12px;
}

.api-status-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.api-status-dot.connected {
  border-color: #10b981;
  background: #10b981;
}

.api-status-dot.error {
  border-color: #ef4444;
  background: #ef4444;
}

.api-status-dot:hover {
  transform: scale(1.1);
}

.status-icon {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  object-fit: contain;
}

/* API Config */
.api-config-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  min-width: -webkit-fill-available;
  padding: 8px;
}

.api-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.api-label {
  width: 80px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.api-input-group {
  display: flex;
  gap: 6px;
  flex: 1;
}

.api-input-compact {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  transition: all 0.2s ease;
}

.api-input-compact:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary)20;
}

.save-btn-compact {
  padding: 6px;
  background: var(--primary);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.save-btn-compact:hover:not(:disabled) {
  transform: translateY(-1px);
}

.save-btn-compact:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Main Columns */
.main-columns {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
  flex-direction: row-reverse;
}

.left-column,
.right-column {
  display: flex;
    flex-direction: column;
    max-width: 18vw;
    gap: 16px;
    min-height: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  align-self: anchor-center;
  color: var(--text-primary);
  margin: 0;
}

/* Agents Compact */
.agents-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-compact {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.agent-compact:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.agent-compact.configured {
  border-color: var(--agent-color);
  background: linear-gradient(135deg, var(--agent-color)06, var(--agent-color)03);
}

.agent-compact.selected {
  border-color: var(--primary);
  background: linear-gradient(135deg, var(--primary)08, var(--primary)04);
  box-shadow: 0 0 0 2px var(--primary)20;
}

.agent-icon-compact {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.agent-details-compact {
  flex: 1;
  min-width: 0;
}

.agent-name-compact {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 2px 0;
}

.agent-model-compact {
  font-size: 10px;
  color: var(--text-secondary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clear-compact {
  background: none;
  border: 1px solid var(--border);
  padding: 3px;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.clear-compact:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

/* System Message Section */
.system-message-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.system-header {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin-bottom: 12px;
}

.selected-agent {
  font-size: 11px;
  color: var(--text-secondary);
  padding: 2px 6px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.system-message-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.system-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  transition: all 0.2s ease;
}

.system-textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary)20;
}

.system-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 10px;
}

.reset-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.char-count {
  font-size: 10px;
  color: var(--text-tertiary);
}

.system-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--text-secondary);
  font-size: 11px;
  text-align: center;
  gap: 8px;
}

/* TTS Section */
.tts-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.tts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.toggle-switch-compact {
  position: relative;
  width: 32px;
  height: 18px;
  cursor: pointer;
}

.toggle-input {
  display: none;
}

.toggle-slider-compact {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-tertiary);
  border-radius: 18px;
  transition: all 0.2s ease;
}

.toggle-slider-compact::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  bottom: 2px;
  background: white;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.toggle-input:checked+.toggle-slider-compact {
  background: var(--primary);
}

.toggle-input:checked+.toggle-slider-compact::before {
  transform: translateX(14px);
}

.tts-controls-compact {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.voice-select-compact {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  transition: all 0.2s ease;
}

.voice-select-compact:focus {
  outline: none;
  border-color: var(--primary);
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-label {
  font-size: 10px;
  color: var(--text-secondary);
  min-width: 28px;
}

.speed-range {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-tertiary);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.speed-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
}

.speed-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  border: none;
}

.tts-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.auto-read-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-primary);
  cursor: pointer;
}

.checkbox-compact {
  width: 12px;
  height: 12px;
  accent-color: var(--primary);
}

.test-btn-compact {
  padding: 4px 6px;
  background: var(--primary);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.test-btn-compact:hover:not(:disabled) {
  transform: translateY(-1px);
}

.test-btn-compact:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Whisper Section */
.whisper-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.whisper-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.whisper-controls-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label-inline {
  font-size: 10px;
  color: var(--text-secondary);
  min-width: 50px;
  font-weight: 500;
}

.whisper-select-compact,
.whisper-input-compact {
  flex: 1;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 10px;
  transition: all 0.2s ease;
}

.whisper-select-compact:focus,
.whisper-input-compact:focus {
  outline: none;
  border-color: var(--primary);
}

.whisper-toggles {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.whisper-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--text-primary);
  cursor: pointer;
}

.whisper-advanced {
  margin-top: 8px;
}

.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 10px;
}

.advanced-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.advanced-toggle .w-3 {
  transition: transform 0.2s ease;
}

.rotate-180 {
  transform: rotate(180deg);
}

.advanced-controls {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.whisper-range {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--bg-primary);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.whisper-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
}

.whisper-range::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  border: none;
}

.range-value {
  font-size: 9px;
  color: var(--text-secondary);
  min-width: 20px;
  text-align: right;
}

/* Model Browser */
.model-browser {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.browser-header {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.model-count {
  font-size: 11px;
  color: var(--text-secondary);
  padding: 2px 6px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.search-filters-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-row {
  display: flex;
  gap: 8px;
}

.search-wrapper-compact {
  position: relative;
  flex: 1;
}

.search-icon-compact {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.search-input-compact {
  width: 100%;
  padding: 6px 8px 6px 24px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  transition: all 0.2s ease;
}

.search-input-compact:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary)20;
}

.provider-select-compact {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  min-width: 80px;
  transition: all 0.2s ease;
}

.provider-select-compact:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary)20;
}

.filter-pills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.filter-pill {
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-pill:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.filter-pill.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

/* Models List */
.models-list-compact {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.model-card-compact {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  transition: all 0.2s ease;
  position: relative;
}

.model-card-compact:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 12px var(--shadow);
}

.model-card-compact.favorite {
  background: linear-gradient(135deg, #fbbf2410, #fbbf2405);
  border-color: #fbbf24;
}

.model-card-compact.free::after {
  content: 'FREE';
  position: absolute;
  top: 4px;
  right: 6px;
  background: #10b981;
  color: white;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  letter-spacing: 0.3px;
}

.model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.model-icon-compact {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: contain;
  flex-shrink: 0;
}

.model-info-compact {
  flex: 1;
  min-width: 0;
}

.model-name-compact {
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 3px 0;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-meta-compact {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.free-badge,
.size-badge,
.context-badge {
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.free-badge {
  background: #10b981;
  color: white;
}

.size-badge {
  background: var(--primary);
  color: white;
}

.context-badge {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.favorite-btn-compact {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.favorite-btn-compact:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.favorite-btn-compact.active {
  background: #fbbf24;
  border-color: #fbbf24;
  color: white;
}

.assignment-row {
  display: flex;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.assign-label {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.agent-assignment-btns {
  display: flex;
  gap: 4px;
}

.agent-btn-compact {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

.agent-btn-compact:hover {
  background: var(--bg-tertiary);
  transform: scale(1.05);
}

.agent-btn-compact.active {
  background: var(--agent-color);
  border-color: var(--agent-color);
  color: white;
  box-shadow: 0 1px 4px var(--agent-color)30;
}

/* Load More */
.load-more-compact {
  padding: 12px 0;
  text-align: center;
}

.loading-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}

.load-more-btn-compact {
  padding: 6px 12px;
  background: var(--primary);
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
}

.load-more-btn-compact:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--primary)30;
}

.end-compact {
  color: var(--text-tertiary);
  font-size: 11px;
}

/* Notification */
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1001;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 20px var(--shadow);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  backdrop-filter: blur(20px);
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from,
.notification-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Scrollbar */
.panel-body::-webkit-scrollbar,
.models-list-compact::-webkit-scrollbar {
  width: 4px;
}

.panel-body::-webkit-scrollbar-track,
.models-list-compact::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb,
.models-list-compact::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

.panel-body::-webkit-scrollbar-thumb:hover,
.models-list-compact::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* Custom Agent Styles */
.agent-compact.custom {
  border-color: #6366f1;
  background: linear-gradient(135deg, #6366f106, #6366f103);
}

.agent-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.delete-compact {
  background: none;
  border: 1px solid var(--border);
  padding: 3px;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.delete-compact:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

.add-agent-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
  width: 100%;
  justify-content: center;
  margin-top: 8px;
}

.add-agent-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.custom-agent-form {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.form-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-form-btn {
  background: none;
  border: 1px solid var(--border);
  padding: 4px;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-form-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-input,
.field-textarea {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  transition: all 0.2s ease;
}

.field-input:focus,
.field-textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary)20;
}

.pattern-row,
.tag-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.remove-btn {
  background: none;
  border: 1px solid var(--border);
  padding: 4px;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.remove-btn:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

.add-pattern-btn,
.add-tag-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 10px;
  margin-top: 4px;
}

.add-pattern-btn:hover,
.add-tag-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.create-agent-btn {
  padding: 8px 16px;
  background: var(--primary);
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
  margin-top: 8px;
}

.create-agent-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--primary)30;
}

.agent-btn-compact.custom {
  border-color: #6366f1;
  background: #6366f1;
  color: white;
}

/* Testing Tab Styles */
.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

/* Test Mode Selector */
.test-mode-selector {
  margin-bottom: 16px;
}

.mode-tabs {
  display: flex;
  gap: 8px;
  background: hsl(var(--b2));
  border-radius: 12px;
  padding: 4px;
}

.mode-tab {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.mode-tab:hover {
  background: hsl(var(--b3));
}

.mode-tab.active {
  background: hsl(var(--b1));
  box-shadow:
    0 2px 8px hsl(var(--b3) / 0.4),
    0 1px 3px hsl(var(--p) / 0.2);
}

.mode-icon {
  font-size: 24px;
  opacity: 0.7;
  transition: all 0.2s ease;
}

.mode-tab.active .mode-icon {
  opacity: 1;
  transform: scale(1.1);
}

.mode-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-label {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--bc));
  margin: 0;
}

.mode-desc {
  font-size: 11px;
  color: hsl(var(--bc) / 0.7);
  margin: 0;
}

.mode-tab.active .mode-label {
  color: hsl(var(--p));
}

/* Quick Test Styles */
.quick-test-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.quick-test-columns {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 20px;
  min-height: 0;
  margin-bottom: 16px;
}

.quick-config-column,
.quick-execution-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  overflow-y: auto;
}

.quick-config-section,
.quick-execution-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.quick-config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.quick-test-description {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 10px;
}

.description-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.test-criteria-list {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  color: var(--text-secondary);
}

.test-criteria-list li {
  margin-bottom: 4px;
}

.quick-execution-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.run-quick-test-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: hsl(var(--p));
  color: hsl(var(--pc));
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 600;
}

.run-quick-test-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px hsl(var(--p) / 0.4);
}

.run-quick-test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.run-quick-test-btn.loading {
  opacity: 0.8;
}

.quick-test-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.info-value {
  font-size: 11px;
  color: var(--text-primary);
  font-weight: 600;
}

/* Custom Test Content */
.custom-test-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.testing-main-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.testing-left-column,
.testing-right-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  overflow-y: auto;
}

/* Test Template Header */
.test-template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.template-actions {
  display: flex;
  gap: 8px;
}

.load-template-btn,
.save-template-btn,
.reset-template-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 10px;
}

.load-template-btn:hover,
.save-template-btn:hover,
.reset-template-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

/* Template Configuration */
.template-basic-info,
.test-config-section,
.prompt-template-section,
.evaluation-section,
.testing-agent-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.config-header {
  margin-bottom: 12px;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-input,
.config-range {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
}

.range-display {
  font-size: 10px;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 2px;
}

.field-select {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
}

/* Prompt Editor */
.prompt-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-toolbar {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.var-btn {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 9px;
  font-family: monospace;
}

.var-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.prompt-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  font-family: monospace;
  resize: vertical;
  min-height: 120px;
}

/* Evaluation Criteria */
.criteria-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.criterion-row {
  display: grid;
  grid-template-columns: 1fr 80px 2fr 24px;
  gap: 8px;
  align-items: start;
}

.criterion-name,
.criterion-weight {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 10px;
}

.criterion-description {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 10px;
  resize: none;
}

.remove-criterion-btn,
.add-criterion-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 10px;
}

.remove-criterion-btn:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

.add-criterion-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

/* Model Selection */
.model-selection-section,
.test-execution-section,
.test-results-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

/* Test Search and Filter */
.test-search-filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.test-search-wrapper {
  position: relative;
  flex: 1;
}

.test-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.test-search-input {
  width: 100%;
  padding: 6px 8px 6px 24px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  transition: all 0.2s ease;
}

.test-search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary)20;
}

.test-filter-pills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.test-filter-pill {
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.test-filter-pill:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.test-filter-pill.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.model-filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.selection-actions {
  display: flex;
  gap: 6px;
}

.select-all-btn,
.clear-selection-btn {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 10px;
}

.select-all-btn:hover,
.clear-selection-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.selected-models-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  margin-bottom: 8px;
}

.summary-text {
  font-size: 11px;
  color: var(--text-secondary);
}

.toggle-selected-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px;
}

.selected-models-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  max-height: 120px;
  overflow-y: auto;
}

.selected-model-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.model-icon-mini {
  width: 14px;
  height: 14px;
  border-radius: 2px;
}

.model-name-mini {
  flex: 1;
  font-size: 10px;
  color: var(--text-primary);
}

.remove-model-btn {
  background: none;
  border: 1px solid var(--border);
  padding: 2px;
  border-radius: 2px;
  color: var(--text-secondary);
  cursor: pointer;
}

.remove-model-btn:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

.available-models-list {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.test-model-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.test-model-card:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.test-model-card.selected {
  border-color: var(--primary);
  background: linear-gradient(135deg, var(--primary)08, var(--primary)04);
}

.model-card-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.selection-indicator {
  color: var(--primary);
}

/* Test Execution */
.execution-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.generate-data-btn,
.run-tests-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: var(--primary);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
  font-weight: 500;
}

.generate-data-btn:hover,
.run-tests-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--primary)30;
}

.generate-data-btn:disabled,
.run-tests-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.generate-data-btn.loading,
.run-tests-btn.loading {
  opacity: 0.8;
}

/* Test Progress */
.test-progress {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 16px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.progress-text {
  font-size: 10px;
  color: var(--text-secondary);
}

.progress-percent {
  font-size: 10px;
  font-weight: 600;
  color: var(--primary);
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--bg-primary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width 0.3s ease;
}

/* Test Data Preview */
.test-data-preview {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 16px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.data-count {
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 2px 6px;
  border-radius: 3px;
}

.test-questions-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.test-question-preview {
  padding: 6px 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  border: 1px solid var(--border);
}

.question-number {
  font-size: 9px;
  font-weight: 600;
  color: var(--primary);
  margin-bottom: 2px;
}

.question-text {
  font-size: 10px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.expected-answer {
  font-size: 9px;
  color: var(--text-secondary);
  font-style: italic;
}

.more-questions {
  text-align: center;
  font-size: 10px;
  color: var(--text-secondary);
  padding: 4px;
}

/* Test Results */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.results-actions {
  display: flex;
  gap: 6px;
}

.export-btn,
.clear-results-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 10px;
}

.export-btn:hover,
.clear-results-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.results-summary {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 12px;
}

.summary-stats {
  display: flex;
  gap: 16px;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 9px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.result-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.model-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
}

.overall-score {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
}

.score-excellent {
  background: #10b981;
  color: white;
}

.score-good {
  background: #3b82f6;
  color: white;
}

.score-fair {
  background: #f59e0b;
  color: white;
}

.score-poor {
  background: #ef4444;
  color: white;
}

.result-metrics {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-name {
  font-size: 9px;
  color: var(--text-secondary);
  min-width: 60px;
}

.metric-bar {
  flex: 1;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.metric-score {
  font-size: 9px;
  color: var(--text-secondary);
  min-width: 30px;
  text-align: right;
}

.result-stats {
  display: flex;
  gap: 12px;
  font-size: 9px;
  color: var(--text-secondary);
}

.stat {
  display: flex;
  align-items: center;
}

/* Animation */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.panel-container {
  animation: slideIn 0.3s ease-out;
}

/* Theme-specific styling to match SandPack panel */
.theme-dark .panel-container {
  background: linear-gradient(350deg, rgb(103 198 123 / 21%), rgb(46 0 145));
  box-shadow: -8px 0 40px rgba(255, 117, 152, 0.15), inset 0px 1px 20px 2px rgba(189, 189, 189, 0.172);
  border-color: rgba(255, 117, 152, 0.3);
  ;
}

.theme-cyberpunk .panel-container {
  background: linear-gradient(135deg, rgb(58 177 165 / 95%), rgb(191 37 94));
  box-shadow: -8px 0 40px rgba(255, 117, 152, 0.15), inset 0px 1px 20px 2px rgba(255, 117, 152, 0.1);
  border-color: rgba(255, 117, 152, 0.3);
}

.theme-cyberpunk .panel-container::before {
  background: linear-gradient(135deg, rgba(255, 117, 152, 0.08), rgba(247, 213, 29, 0.04));
  opacity: 0.6;
}

.theme-synthwave .panel-container {
  background: linear-gradient(0deg, rgb(222 177 0 / 94%), rgb(80 30 110 / 0%));
  box-shadow: -8px 0 40px rgba(231, 121, 193, 0.15), inset 0px 1px 25px 2px rgba(88, 199, 243, 0.1);
  border-color: rgba(231, 121, 193, 0.3);
}

.theme-synthwave .panel-container::before {
  background: linear-gradient(135deg, rgba(231, 121, 193, 0.08), rgba(243, 204, 48, 0.04));
  opacity: 0.5;
}

.theme-aqua .panel-container {
  background: linear-gradient(1deg, rgb(0 0 0 / 70%), rgb(0 75 161 / 80%));
  box-shadow: -8px 0 40px rgba(9, 236, 243, 0.15), inset 0px 1px 20px 2px rgba(9, 236, 243, 0.1);
  border-color: rgba(9, 236, 243, 0.3);
}

.theme-pastel .panel-container {
  background: linear-gradient(1deg, rgb(12 12 12 / 0%), rgb(246 203 209));
  box-shadow: -8px 0 40px rgba(255, 192, 203, 0.15), inset 0px 1px 15px 2px rgba(255, 192, 203, 0.1);
  border-color: rgba(255, 192, 203, 0.3);
}

.theme-wireframe .panel-container {
  background: linear-gradient(1deg, rgba(155, 152, 152, 0), rgb(214, 211, 211));
  box-shadow: -8px 0 40px rgba(255, 192, 203, 0.15), inset 0px 1px 15px 2px rgba(255, 192, 203, 0.1);
  border-color: rgba(255, 192, 203, 0.3);
}

.theme-valentine .panel-container,
.theme-cupcake .panel-container {
  background: linear-gradient(135deg, rgb(247 186 206 / 95%), rgba(255, 225, 235, 0.9));
  box-shadow: -8px 0 40px rgba(255, 192, 203, 0.15), inset 0px 1px 15px 2px rgba(255, 192, 203, 0.1);
  border-color: rgba(255, 192, 203, 0.3);
}

.theme-retro .panel-container {
  background: linear-gradient(2deg, rgb(0 0 0 / 0%), rgb(196 91 17 / 75%));
  box-shadow: -8px 0 40px rgba(239, 153, 149, 0.15), inset 0px 1px 20px 2px rgba(239, 153, 149, 0.1);
  border: 2px solid rgba(239, 153, 149, 0.4);
  border-right: none;
}

.theme-forest .panel-container {
  background: linear-gradient(1deg, rgb(12 12 12 / 0%), rgb(2 88 44 / 80%));
  box-shadow: -8px 0 40px rgba(92, 127, 103, 0.15), inset 0px 1px 20px 2px rgba(92, 127, 103, 0.1);
  border-color: rgba(92, 127, 103, 0.3);
}

.theme-black .panel-container {
  background: linear-gradient(2deg, rgb(255 255 255 / 23%), rgb(0 0 0 / 80%));
  box-shadow: -8px 0 40px rgba(92, 127, 103, 0.15), inset 0px 1px 20px 2px rgba(92, 127, 103, 0.1);
  border-color: rgba(92, 127, 103, 0.3);
}

.theme-cmyk .panel-container {
  background: linear-gradient(179deg, rgb(15 15 25 / 0%), rgb(255 64 129 / 63%));
  box-shadow: -8px 0 40px rgba(255, 215, 0, 0.15), inset 0px 1px 20px 2px rgba(255, 215, 0, 0.05);
  border-color: rgba(255, 215, 0, 0.2);
}

.theme-luxury .panel-container {
  background: linear-gradient(2deg, rgba(15, 15, 25, 0.95), rgb(246 176 0 / 20%));
  box-shadow: -8px 0 40px rgba(255, 215, 0, 0.15), inset 0px 1px 20px 2px rgba(255, 215, 0, 0.05);
  border-color: rgba(255, 215, 0, 0.2);
}

.theme-dracula .panel-container {
  background: linear-gradient(1deg, rgb(245 150 236 / 34%), rgba(3, 136, 166, 0.601));
  box-shadow: -8px 0 40px rgba(255, 121, 198, 0.15), inset 0px 1px 20px 2px rgba(255, 121, 198, 0.08);
  border-color: rgba(255, 121, 198, 0.3);
}

.theme-halloween .panel-container {
  background: linear-gradient(1deg, rgb(75 40 0), rgb(24 187 233 / 53%));
  box-shadow: -8px 0 40px rgba(255, 165, 0, 0.15), inset 0px 1px 20px 2px rgba(255, 165, 0, 0.08);
  border-color: rgba(255, 165, 0, 0.3);
}

.theme-emerald .panel-container,
.theme-garden .panel-container {
  background: linear-gradient(135deg, rgba(240, 253, 244, 0.95), rgba(220, 252, 231, 0.9));
  box-shadow: -8px 0 40px rgba(102, 204, 138, 0.15), inset 0px 1px 15px 2px rgba(102, 204, 138, 0.08);
  border-color: rgba(102, 204, 138, 0.3);
}

.theme-business .panel-container {
  background: linear-gradient(357deg, rgb(0 0 0 / 59%), rgb(46 99 200 / 80%));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-acid .panel-container {
  background: linear-gradient(357deg, rgb(255 255 255 / 78%), rgb(138 198 118));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-lemonade .panel-container {
  background: linear-gradient(357deg, rgb(255 255 255 / 78%), rgba(146, 231, 117, 0.816));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-light .panel-container {
  background: linear-gradient(350deg, rgb(103 198 123 / 21%), rgb(236 147 255 / 82%));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-bumblebee .panel-container {
  background: linear-gradient(350deg, rgb(103 198 123 / 21%), rgb(244 210 41 / 80%));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-lofi .panel-container {
  background: linear-gradient(350deg, rgb(0 0 0 / 28%), rgb(86 86 86 / 80%));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-fantasy .panel-container {
  background: linear-gradient(350deg, rgb(1 135 9 / 28%), rgb(102 6 6 / 62%));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-autumn .panel-container {
  background: linear-gradient(350deg, rgb(1 135 9 / 28%), rgb(102 6 6 / 62%));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-winter .panel-container {
  background: linear-gradient(350deg, rgb(103 198 123 / 21%), rgb(164 227 255 / 95%));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-coffee .panel-container {
  background: linear-gradient(175deg, rgb(128 108 94 / 61%), rgb(36 26 35));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-night .panel-container {
  background: linear-gradient(171deg, rgb(129 140 248), rgb(14 13 25 / 47%));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

.theme-corporate .panel-container {
  background: linear-gradient(175deg, rgba(248, 250, 252, 0.95), rgba(241, 245, 249, 0.9));
  box-shadow: -8px 0 40px rgba(75, 107, 251, 0.15), inset 0px 1px 15px 2px rgba(75, 107, 251, 0.05);
  border-color: rgba(75, 107, 251, 0.2);
}

/* Results Table Styling */
.results-table-container {
  margin-top: 20px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.results-table thead {
  background: rgba(255, 255, 255, 0.1);
}

.results-table th {
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.results-table td {
  padding: 12px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  vertical-align: middle;
}

.result-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.result-row:last-child td {
  border-bottom: none;
}

.model-col {
  width: 25%;
  min-width: 180px;
}

.score-col {
  width: 12%;
  text-align: center;
}

.criterion-col {
  width: 10%;
  text-align: center;
}

.stat-col {
  width: 8%;
  text-align: center;
}

.model-cell .model-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-cell .model-name {
  font-weight: 500;
  color: var(--text-primary);
}

.model-cell .model-source {
  font-size: 10px;
  color: var(--text-secondary);
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.score-cell,
.criterion-cell {
  text-align: center;
}

.overall-score,
.criterion-score {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 11px;
}

.score-excellent {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.score-good {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.score-fair {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.score-poor {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.stat-cell {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

.error-count {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.error-count.has-errors {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.model-icon-mini {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* Responsive table */
@media (max-width: 1400px) {
  .results-table {
    font-size: 11px;
  }

  .results-table th,
  .results-table td {
    padding: 8px 6px;
  }

  .model-col {
    min-width: 140px;
  }
}

/* Test Control Buttons */
.test-control-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.test-control-group {
  display: flex;
  gap: 4px;
  align-items: center;
}

.control-btn {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--background);
  color: var(--text-secondary);
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background: var(--hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.control-btn.pause-resume.paused {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.3);
}

.control-btn.stop {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.control-btn.stop:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

/* Progress Updates */
.pause-indicator {
  font-size: 10px;
  font-weight: 600;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
}

.current-question {
  margin: 8px 0;
  padding: 8px;
  background: var(--card-background);
  border-radius: 6px;
  font-size: 11px;
}

.question-label {
  font-weight: 500;
  color: var(--text-secondary);
  margin-right: 8px;
}

.question-text {
  color: var(--text-primary);
  font-style: italic;
}

/* Detailed Results */
.detailed-results-section {
  margin-top: 20px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.detailed-results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.detailed-results-content {
  max-height: 600px;
  overflow-y: auto;
}

.model-detailed-results {
  margin-bottom: 24px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.model-header-detailed {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--card-background);
  border-bottom: 1px solid var(--border);
}

.model-name-detailed {
  font-weight: 500;
  color: var(--text-primary);
}

.model-summary {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: auto;
}

.questions-grid {
  padding: 16px;
  display: grid;
  gap: 12px;
}

.question-result-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  background: var(--background);
  transition: all 0.2s;
}

.question-result-card.failed {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.question-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.question-number {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--hover);
  padding: 2px 6px;
  border-radius: 4px;
}

.question-score {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}

.question-status {
  font-size: 14px;
  margin-left: auto;
}

.question-status.passed {
  color: #10b981;
}

.question-content {
  font-size: 12px;
}

.question-text {
  margin-bottom: 12px;
  color: var(--text-primary);
  line-height: 1.4;
}

.answer-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 12px 0;
}

.answer-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.answer-text {
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.4;
  max-height: 100px;
  overflow-y: auto;
}

.answer-text.expected {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: var(--text-primary);
}

.answer-text.actual {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: var(--text-primary);
}

.answer-text.actual.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.criteria-scores {
  display: flex;
  gap: 12px;
  margin: 8px 0;
  flex-wrap: wrap;
}

.criterion-score-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.criterion-name {
  font-size: 10px;
  color: var(--text-secondary);
}

.criterion-value {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 4px;
  border-radius: 3px;
}

.question-meta {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 10px;
  color: var(--text-secondary);
}

.response-time {
  font-weight: 500;
}

.difficulty {
  text-transform: capitalize;
}

.feedback {
  font-style: italic;
  margin-left: auto;
}

/* Responsive detailed results */
@media (max-width: 1200px) {
  .answer-comparison {
    grid-template-columns: 1fr;
  }

  .criteria-scores {
    justify-content: center;
  }

  .question-meta {
    flex-direction: column;
    gap: 4px;
  }
}

/* Clickable Table Rows */
.expand-col {
  width: 30px;
  padding: 8px 4px;
}

.expand-cell {
  text-align: center;
  padding: 8px 4px;
}

.expand-icon {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
  transition: transform 0.2s, color 0.2s;
}

.result-row.clickable {
  cursor: pointer;
}

.result-row.clickable:hover {
  background: rgba(255, 255, 255, 0.06);
}

.result-row.clickable:hover .expand-icon {
  color: var(--text-primary);
  transform: scale(1.1);
}

/* Expanded Row Content */
.expanded-row {
  background: rgba(255, 255, 255, 0.02);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.expanded-content {
  padding: 16px;
}

.model-detailed-view {
  background: var(--card-background);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--border);
}

.detailed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.detailed-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.pass-fail-summary {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-detail-row {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  transition: all 0.2s;
}

.question-detail-row.failed {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.question-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.question-num {
  font-size: 10px;
  font-weight: 600;
  background: var(--hover);
  color: var(--text-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 24px;
  text-align: center;
}

.question-score {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
}

.question-status {
  font-size: 12px;
  font-weight: 600;
}

.question-status.passed {
  color: #10b981;
}

.question-preview {
  font-size: 11px;
  color: var(--text-primary);
  flex: 1;
  font-style: italic;
}

.response-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 8px 0;
}

.expected-response,
.actual-response {
  min-width: 0;
}

.response-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.response-content {
  font-size: 11px;
  line-height: 1.4;
  padding: 8px;
  border-radius: 4px;
  max-height: 120px;
  overflow-y: auto;
  word-wrap: break-word;
}

.response-content.expected {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: var(--text-primary);
}

.response-content.actual {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: var(--text-primary);
}

.response-content.actual.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.question-metadata {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 10px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.response-time {
  font-weight: 500;
}

.feedback {
  font-style: italic;
  margin-left: auto;
}

/* Responsive adjustments for expanded content */
@media (max-width: 1200px) {
  .response-comparison {
    grid-template-columns: 1fr;
  }

  .question-summary {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .question-metadata {
    flex-direction: column;
    gap: 4px;
  }
}

@media (max-width: 768px) {
  .expanded-content {
    padding: 12px;
  }

  .model-detailed-view {
    padding: 12px;
  }

  .detailed-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

/* Response Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.response-modal {
  background: var(--card-background);
  border: 1px solid var(--border);
  border-radius: 12px;
  max-width: 800px;
  max-height: 80vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  background: var(--hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.json-content {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre;
  color: var(--text-primary);
}

.text-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Clickable Response Content */
.response-content.clickable {
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}

.response-content.clickable:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.response-content.clickable::after {
  content: 'Click to view full response';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  margin-bottom: 4px;
}

.response-content.clickable:hover::after {
  opacity: 1;
}

/* Modal Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s;
}

.modal-enter-active .response-modal,
.modal-leave-active .response-modal {
  transition: transform 0.3s, opacity 0.3s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .response-modal,
.modal-leave-to .response-modal {
  transform: scale(0.9);
  opacity: 0;
}

/* Responsive Modal */
@media (max-width: 640px) {
  .modal-overlay {
    padding: 10px;
  }
  
  .response-modal {
    max-height: 90vh;
  }
  
  .modal-header {
    padding: 12px 16px;
  }
  
  .modal-body {
    padding: 16px;
  }
  
  .json-content {
    font-size: 11px;
    padding: 12px;
  }
}
</style>