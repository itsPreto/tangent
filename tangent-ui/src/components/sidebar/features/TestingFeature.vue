<template>
  <div class="testing-feature">
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
              <span class="stat-value">{{ testResults.reduce((sum, r) => sum + r.questionsAnswered, 0) }}</span>
              <span class="stat-label">Total Questions</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ Math.round(testResults.reduce((sum, r) => sum + r.overallScore, 0) /
                testResults.length) }}%</span>
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
                          {{ getModelDetailedResults(result.modelId)?.questionResults.filter(q => q.passed).length || 0 }}/{{ getModelDetailedResults(result.modelId)?.questionResults.length || 0 }}
                          passed
                        </span>
                      </div>

                      <div class="questions-list">
                        <div v-for="(questionResult, index) in getModelDetailedResults(result.modelId)?.questionResults"
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
                                @click="showResponseModal('Expected Answer', questionResult.expectedAnswer)">
                                {{ questionResult.expectedAnswer }}
                              </div>
                            </div>
                            <div class="actual-response">
                              <div class="response-label">Model Response:</div>
                              <div class="response-content actual clickable"
                                :class="{ error: questionResult.actualAnswer.startsWith('ERROR:') }"
                                @click="showResponseModal('Model Response', questionResult.actualAnswer)">
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
        </div>

        <!-- Right Column: Custom Test Execution -->
        <div class="testing-right-column">
          <div class="section-title">Custom Test Execution</div>
          <p class="placeholder-text">Custom test execution interface will be implemented here.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import {
  Search, Check, Plus, X, ChevronDown, ChevronRight, Play, Pause, Square, Loader
} from 'lucide-vue-next';
import { useModelStore } from '@/stores/modelStore';

// Assets
import ollamaIcon from '@/assets/ollama.jpeg';
import googleIcon from '@/assets/google.jpeg';
import anthropicIcon from '@/assets/anthropic.jpeg';
import openRouterIcon from '@/assets/unknown.jpeg';

// Stores
const modelStore = useModelStore();

// State
const testMode = ref('quick');
const testSearchQuery = ref('');
const testModelFilter = ref('all');
const showSelectedModels = ref(false);
const isRunningTests = ref(false);
const isPaused = ref(false);

// Test Filters
const activeTestFilters = ref(new Set());
const testQuickFilters = [
  { id: 'free', label: 'Free' },
  { id: 'fast', label: 'Fast' },
  { id: 'large-context', label: 'Large Context' },
  { id: 'multimodal', label: 'Multimodal' },
  { id: 'reasoning', label: 'Reasoning' }
];

// Selected models for testing
const selectedTestModels = ref([]);

// Quick Test Configuration
const quickTestConfig = reactive({
  testRuns: 1,
  questionsPerRun: 5,
  temperature: 0.7,
  category: 'prompt-adherence'
});

// Test Progress
const testProgress = reactive({
  current: 0,
  total: 0,
  currentModel: '',
  currentQuestion: ''
});

// Test Results
const testResults = ref([]);
const expandedRows = ref(new Set());

// Custom Test Template
const testTemplate = reactive({
  name: '',
  description: '',
  category: 'prompt-adherence',
  config: {
    testRuns: 1,
    questionsPerRun: 5,
    timeout: 30,
    temperature: 0.7
  },
  promptTemplate: ''
});

// Get all models from all providers - same pattern as ModelSelectorFeature
const allModels = computed(() => {
  const models = [];
  models.push(...(modelStore.ollamaModels || []));
  models.push(...(modelStore.openRouterModels || []));
  models.push(...(modelStore.anthropicModels || []));
  models.push(...(modelStore.googleModels || []));
  return models;
});

// Computed properties
const filteredTestModels = computed(() => {
  let models = allModels.value;
  
  // Apply search filter
  if (testSearchQuery.value) {
    models = models.filter(model => 
      model.name.toLowerCase().includes(testSearchQuery.value.toLowerCase())
    );
  }
  
  // Apply provider filter
  if (testModelFilter.value !== 'all') {
    models = models.filter(model => model.source === testModelFilter.value);
  }
  
  // Apply quick filters
  activeTestFilters.value.forEach(filterId => {
    switch (filterId) {
      case 'free':
        models = models.filter(model => model.isFree);
        break;
      case 'fast':
        models = models.filter(model => model.responseTime && model.responseTime < 1000);
        break;
      case 'large-context':
        models = models.filter(model => model.contextLength && model.contextLength > 100000);
        break;
      case 'multimodal':
        models = models.filter(model => model.capabilities?.includes('vision'));
        break;
      case 'reasoning':
        models = models.filter(model => model.capabilities?.includes('reasoning'));
        break;
    }
  });
  
  return models;
});

const sortedTestResults = computed(() => {
  return testResults.value.sort((a, b) => b.overallScore - a.overallScore);
});

// Methods
const getProviderIcon = (source: string) => {
  switch (source) {
    case 'ollama': return ollamaIcon;
    case 'google': return googleIcon;
    case 'anthropic': return anthropicIcon;
    case 'openrouter': return openRouterIcon;
    default: return openRouterIcon;
  }
};

const toggleTestFilter = (filterId: string) => {
  if (activeTestFilters.value.has(filterId)) {
    activeTestFilters.value.delete(filterId);
  } else {
    activeTestFilters.value.add(filterId);
  }
};

const isModelSelected = (model: any) => {
  return selectedTestModels.value.some(m => m.id === model.id);
};

const toggleModelSelection = (model: any) => {
  if (isModelSelected(model)) {
    selectedTestModels.value = selectedTestModels.value.filter(m => m.id !== model.id);
  } else {
    selectedTestModels.value.push(model);
  }
};

const selectAllModels = () => {
  selectedTestModels.value = [...filteredTestModels.value];
};

const clearModelSelection = () => {
  selectedTestModels.value = [];
};

const removeFromTest = (model: any) => {
  selectedTestModels.value = selectedTestModels.value.filter(m => m.id !== model.id);
};

const runQuickTest = async () => {
  if (selectedTestModels.value.length === 0) return;
  
  isRunningTests.value = true;
  isPaused.value = false;
  
  // Calculate total tests
  const totalTests = selectedTestModels.value.length * quickTestConfig.questionsPerRun * quickTestConfig.testRuns;
  testProgress.current = 0;
  testProgress.total = totalTests;
  
  try {
    // Simulate test execution
    for (const model of selectedTestModels.value) {
      if (!isRunningTests.value) break;
      
      testProgress.currentModel = model.name;
      
      for (let run = 0; run < quickTestConfig.testRuns; run++) {
        if (!isRunningTests.value) break;
        
        for (let q = 0; q < quickTestConfig.questionsPerRun; q++) {
          if (!isRunningTests.value) break;
          
          // Wait for pause
          while (isPaused.value && isRunningTests.value) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          if (!isRunningTests.value) break;
          
          testProgress.currentQuestion = `Question ${q + 1} for ${model.name}`;
          
          // Simulate test execution time
          await new Promise(resolve => setTimeout(resolve, 500));
          
          testProgress.current++;
        }
      }
      
      // Add mock test result
      if (isRunningTests.value) {
        const mockResult = {
          modelId: model.id,
          modelName: model.name,
          modelSource: model.source,
          overallScore: Math.random() * 40 + 60, // 60-100%
          criteriaScores: [
            { criterion: 'accuracy', score: Math.random() * 40 + 60 },
            { criterion: 'completeness', score: Math.random() * 40 + 60 },
            { criterion: 'format', score: Math.random() * 40 + 60 }
          ],
          questionsAnswered: quickTestConfig.questionsPerRun,
          avgResponseTime: Math.round(Math.random() * 2000 + 500),
          errors: Math.floor(Math.random() * 3)
        };
        testResults.value.push(mockResult);
      }
    }
  } catch (error) {
    console.error('Error running tests:', error);
  } finally {
    isRunningTests.value = false;
    isPaused.value = false;
    testProgress.currentModel = '';
    testProgress.currentQuestion = '';
  }
};

const pauseTests = () => {
  isPaused.value = true;
};

const resumeTests = () => {
  isPaused.value = false;
};

const stopTests = () => {
  isRunningTests.value = false;
  isPaused.value = false;
  testProgress.current = 0;
  testProgress.total = 0;
  testProgress.currentModel = '';
  testProgress.currentQuestion = '';
};

const exportResults = () => {
  // TODO: Implement results export
  console.log('Export results not yet implemented');
};

const clearResults = () => {
  testResults.value = [];
  expandedRows.value.clear();
};

const getScoreClass = (score: number) => {
  if (score >= 80) return 'score-excellent';
  if (score >= 60) return 'score-good';
  if (score >= 40) return 'score-fair';
  return 'score-poor';
};

const toggleModelRow = (modelId: string) => {
  if (expandedRows.value.has(modelId)) {
    expandedRows.value.delete(modelId);
  } else {
    expandedRows.value.add(modelId);
  }
};

const isModelRowExpanded = (modelId: string) => {
  return expandedRows.value.has(modelId);
};

const getModelDetailedResults = (modelId: string) => {
  // Mock detailed results
  return {
    questionResults: Array.from({ length: quickTestConfig.questionsPerRun }, (_, i) => ({
      question: `Test question ${i + 1} for detailed analysis`,
      expectedAnswer: `Expected answer for question ${i + 1}`,
      actualAnswer: `Model response for question ${i + 1}`,
      overallScore: Math.random() * 40 + 60,
      passed: Math.random() > 0.3,
      responseTime: Math.round(Math.random() * 2000 + 500),
      feedback: 'Automated evaluation feedback'
    }))
  };
};

const showResponseModal = (title: string, content: string) => {
  // TODO: Implement response modal
  console.log(`${title}: ${content}`);
};

// Custom Test Methods
const loadTemplate = () => {
  // TODO: Implement template loading
  console.log('Load template not yet implemented');
};

const saveTemplate = () => {
  // TODO: Implement template saving
  console.log('Save template not yet implemented');
};

const resetTemplate = () => {
  testTemplate.name = '';
  testTemplate.description = '';
  testTemplate.category = 'prompt-adherence';
  testTemplate.config = {
    testRuns: 1,
    questionsPerRun: 5,
    timeout: 30,
    temperature: 0.7
  };
  testTemplate.promptTemplate = '';
};

const insertVariable = (variable: string) => {
  const textarea = document.querySelector('.prompt-textarea') as HTMLTextAreaElement;
  if (textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    testTemplate.promptTemplate = `${before}{${variable}}${after}`;
    
    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length + 2, start + variable.length + 2);
    });
  }
};

// Initialize models
onMounted(async () => {
  // Initialize all providers
  await Promise.all([
    modelStore.initializeProvider('ollama'),
    modelStore.initializeProvider('anthropic'),
    modelStore.initializeProvider('openrouter'),
    modelStore.initializeProvider('google')
  ]);
});
</script>

<style scoped>
.testing-feature {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
}

/* Test Mode Selector */
.test-mode-selector {
  margin-bottom: 1.5rem;
}

.mode-tabs {
  display: flex;
  gap: 0.5rem;
}

.mode-tab {
  flex: 1;
  padding: 1rem;
  background: rgba(var(--theme-background-rgb), 0.5);
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mode-tab.active {
  background: rgba(var(--theme-primary-rgb), 0.1);
  border-color: var(--theme-primary);
}

.mode-icon {
  font-size: 1.5rem;
}

.mode-content {
  text-align: left;
}

.mode-label {
  display: block;
  font-weight: 600;
  color: var(--theme-text-primary);
}

.mode-desc {
  display: block;
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

/* Quick Test Layout */
.quick-test-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.quick-config-column,
.quick-execution-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Config Sections */
.quick-config-section,
.quick-execution-section,
.model-selection-section {
  padding: 1rem;
  background: rgba(var(--theme-background-rgb), 0.5);
  border-radius: 8px;
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--theme-text-primary);
  margin-bottom: 1rem;
}

.quick-config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.config-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--theme-text-primary);
}

.config-input,
.config-range,
.field-select {
  padding: 0.5rem;
  border: 1px solid rgba(var(--theme-border-rgb), 0.3);
  border-radius: 6px;
  background: var(--theme-background);
  color: var(--theme-text-primary);
  font-size: 0.875rem;
}

.range-display {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
  text-align: center;
}

/* Test Description */
.quick-test-description {
  padding: 1rem;
  background: rgba(var(--theme-secondary-rgb), 0.05);
  border-radius: 6px;
  border: 1px solid rgba(var(--theme-secondary-rgb), 0.1);
}

.description-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--theme-text-primary);
}

.test-criteria-list {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

.test-criteria-list li {
  margin-bottom: 0.25rem;
}

/* Test Controls */
.test-control-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.run-quick-test-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  background: var(--theme-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.run-quick-test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-control-group {
  display: flex;
  gap: 0.25rem;
}

.control-btn {
  padding: 0.5rem;
  background: rgba(var(--theme-primary-rgb), 0.1);
  color: var(--theme-primary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.control-btn.pause-resume.paused {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.control-btn.stop {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* Test Info */
.quick-test-info {
  font-size: 0.875rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.info-label {
  color: var(--theme-text-secondary);
}

.info-value {
  font-weight: 500;
  color: var(--theme-text-primary);
}

/* Progress */
.test-progress {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(var(--theme-primary-rgb), 0.05);
  border-radius: 6px;
  border: 1px solid rgba(var(--theme-primary-rgb), 0.1);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.progress-text {
  font-size: 0.875rem;
  color: var(--theme-text-primary);
}

.pause-indicator {
  color: #f59e0b;
  font-weight: 600;
}

.progress-percent {
  font-weight: 600;
  color: var(--theme-primary);
}

.current-question {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
  margin-bottom: 0.75rem;
}

.question-label {
  font-weight: 500;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(var(--theme-border-rgb), 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--theme-primary);
  transition: width 0.3s ease;
}

/* Model Selection */
.test-search-filter-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.test-search-wrapper {
  flex: 1;
  position: relative;
}

.test-search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--theme-text-secondary);
  width: 16px;
  height: 16px;
}

.test-search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.5rem;
  border: 1px solid rgba(var(--theme-border-rgb), 0.3);
  border-radius: 6px;
  background: var(--theme-background);
  color: var(--theme-text-primary);
  font-size: 0.875rem;
}

.provider-select-compact {
  padding: 0.5rem;
  border: 1px solid rgba(var(--theme-border-rgb), 0.3);
  border-radius: 6px;
  background: var(--theme-background);
  color: var(--theme-text-primary);
  font-size: 0.875rem;
}

/* Filter Pills */
.test-filter-pills {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.test-filter-pill {
  padding: 0.25rem 0.75rem;
  background: rgba(var(--theme-primary-rgb), 0.1);
  color: var(--theme-primary);
  border: 1px solid rgba(var(--theme-primary-rgb), 0.2);
  border-radius: 12px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.test-filter-pill.active {
  background: var(--theme-primary);
  color: white;
}

/* Model Selection Actions */
.model-filter-row {
  margin-bottom: 0.75rem;
}

.selection-actions {
  display: flex;
  gap: 0.5rem;
}

.select-all-btn,
.clear-selection-btn {
  padding: 0.25rem 0.75rem;
  background: transparent;
  color: var(--theme-primary);
  border: 1px solid var(--theme-primary);
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
}

/* Selected Models Summary */
.selected-models-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: rgba(var(--theme-primary-rgb), 0.05);
  border-radius: 6px;
}

.summary-text {
  font-size: 0.875rem;
  color: var(--theme-text-primary);
}

.toggle-selected-btn {
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: var(--theme-primary);
  cursor: pointer;
}

/* Selected Models List */
.selected-models-list {
  margin-bottom: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
}

.selected-model-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(var(--theme-background-rgb), 0.8);
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
  border-radius: 4px;
  margin-bottom: 0.25rem;
}

.model-icon-mini {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.model-name-mini {
  flex: 1;
  font-size: 0.875rem;
  color: var(--theme-text-primary);
}

.remove-model-btn {
  padding: 0.125rem;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: none;
  border-radius: 2px;
  cursor: pointer;
}

/* Available Models */
.available-models-list {
  max-height: 400px;
  overflow-y: auto;
}

.test-model-card {
  padding: 0.75rem;
  background: rgba(var(--theme-background-rgb), 0.8);
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
  border-radius: 6px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.test-model-card.selected {
  background: rgba(var(--theme-primary-rgb), 0.1);
  border-color: var(--theme-primary);
}

.model-card-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.model-icon-compact {
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.model-info-compact {
  flex: 1;
}

.model-name-compact {
  font-weight: 500;
  color: var(--theme-text-primary);
  font-size: 0.875rem;
}

.model-meta-compact {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.free-badge,
.size-badge {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  border-radius: 8px;
}

.free-badge {
  background: rgba(34, 197, 94, 0.2);
  color: #15803d;
}

.size-badge {
  background: rgba(59, 130, 246, 0.2);
  color: #1d4ed8;
}

.selection-indicator {
  color: var(--theme-primary);
}

/* Results */
.test-results-section {
  margin-top: 2rem;
  padding: 1rem;
  background: rgba(var(--theme-background-rgb), 0.5);
  border-radius: 8px;
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.results-actions {
  display: flex;
  gap: 0.5rem;
}

.export-btn,
.clear-results-btn {
  padding: 0.5rem 1rem;
  background: var(--theme-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
}

.clear-results-btn {
  background: #ef4444;
}

/* Results Summary */
.results-summary {
  margin-bottom: 1.5rem;
}

.summary-stats {
  display: flex;
  gap: 2rem;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--theme-primary);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

/* Results Table */
.results-table-container {
  overflow-x: auto;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.results-table th,
.results-table td {
  padding: 0.75rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid rgba(var(--theme-border-rgb), 0.2);
}

.results-table th {
  background: rgba(var(--theme-primary-rgb), 0.05);
  font-weight: 600;
  color: var(--theme-text-primary);
}

.result-row.clickable {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.result-row.clickable:hover {
  background: rgba(var(--theme-primary-rgb), 0.05);
}

.expand-cell {
  width: 40px;
}

.expand-icon {
  color: var(--theme-text-secondary);
  transition: transform 0.2s ease;
}

.model-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-name {
  font-weight: 500;
  color: var(--theme-text-primary);
}

.model-source {
  font-size: 0.75rem;
  color: var(--theme-text-secondary);
}

.overall-score,
.criterion-score {
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.score-excellent {
  background: rgba(34, 197, 94, 0.2);
  color: #15803d;
}

.score-good {
  background: rgba(251, 191, 36, 0.2);
  color: #d97706;
}

.score-fair {
  background: rgba(251, 146, 60, 0.2);
  color: #ea580c;
}

.score-poor {
  background: rgba(239, 68, 68, 0.2);
  color: #dc2626;
}

.error-count.has-errors {
  color: #ef4444;
  font-weight: 600;
}

/* Expanded Row Content */
.expanded-row {
  background: rgba(var(--theme-background-rgb), 0.5);
}

.expanded-content {
  padding: 1rem;
}

.model-detailed-view {
  max-width: 100%;
}

.detailed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(var(--theme-border-rgb), 0.2);
}

.detailed-header h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--theme-text-primary);
}

.pass-fail-summary {
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.question-detail-row {
  padding: 1rem;
  background: rgba(var(--theme-background-rgb), 0.8);
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
  border-radius: 6px;
}

.question-detail-row.failed {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.question-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.question-num {
  font-weight: 600;
  color: var(--theme-primary);
  min-width: 2rem;
}

.question-score {
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.question-status {
  font-weight: 600;
  font-size: 1rem;
}

.question-status.passed {
  color: #22c55e;
}

.question-preview {
  flex: 1;
  color: var(--theme-text-secondary);
  font-size: 0.875rem;
}

.response-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.response-label {
  font-weight: 500;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
  color: var(--theme-text-primary);
}

.response-content {
  padding: 0.75rem;
  background: rgba(var(--theme-background-rgb), 0.8);
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
  max-height: 100px;
  overflow-y: auto;
}

.response-content.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.response-content.clickable:hover {
  background: rgba(var(--theme-primary-rgb), 0.05);
}

.response-content.error {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.question-metadata {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--theme-text-secondary);
}

.response-time {
  font-weight: 500;
}

/* Custom Test */
.testing-main-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.testing-left-column,
.testing-right-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.test-template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.template-actions {
  display: flex;
  gap: 0.5rem;
}

.load-template-btn,
.save-template-btn,
.reset-template-btn {
  padding: 0.5rem 1rem;
  background: var(--theme-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
}

.reset-template-btn {
  background: #6b7280;
}

.template-basic-info,
.test-config-section,
.prompt-template-section {
  padding: 1rem;
  background: rgba(var(--theme-background-rgb), 0.5);
  border-radius: 8px;
  border: 1px solid rgba(var(--theme-border-rgb), 0.2);
}

.form-field {
  margin-bottom: 1rem;
}

.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--theme-text-primary);
  margin-bottom: 0.5rem;
}

.field-input,
.field-textarea,
.field-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid rgba(var(--theme-border-rgb), 0.3);
  border-radius: 6px;
  background: var(--theme-background);
  color: var(--theme-text-primary);
  font-size: 0.875rem;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.prompt-editor {
  margin-top: 1rem;
}

.prompt-toolbar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.var-btn {
  padding: 0.25rem 0.75rem;
  background: rgba(var(--theme-primary-rgb), 0.1);
  color: var(--theme-primary);
  border: 1px solid rgba(var(--theme-primary-rgb), 0.2);
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  font-family: monospace;
}

.prompt-textarea {
  width: 100%;
  min-height: 150px;
  padding: 0.75rem;
  border: 1px solid rgba(var(--theme-border-rgb), 0.3);
  border-radius: 6px;
  background: var(--theme-background);
  color: var(--theme-text-primary);
  font-size: 0.875rem;
  font-family: monospace;
  resize: vertical;
}

.placeholder-text {
  text-align: center;
  color: var(--theme-text-secondary);
  font-style: italic;
  padding: 2rem;
}
</style>