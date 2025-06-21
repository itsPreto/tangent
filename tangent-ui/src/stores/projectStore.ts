import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CodeProject, ProjectFile } from '@/types/project';

export const useProjectStore = defineStore('projects', () => {
  const projects = ref(new Map<string, CodeProject>());
  const currentProjectId = ref<string | null>(null);

  // Generate unique project ID
  const generateProjectId = (workspaceId: string, nodeId: string, messageIndex: number, codeIndex: number): string => {
    return `project_${workspaceId}_${nodeId}_${messageIndex}_${codeIndex}`;
  };

  // Get current project
  const currentProject = computed(() => {
    return currentProjectId.value ? projects.value.get(currentProjectId.value) : null;
  });

  // Create new project from code snippet
  const createProjectFromCode = (
    code: string, 
    language: string, 
    sourceInfo: CodeProject['sourceInfo']
  ): CodeProject => {
    const projectId = generateProjectId(
      sourceInfo.workspaceId,
      sourceInfo.nodeId,
      sourceInfo.messageIndex,
      sourceInfo.codeIndex
    );

    // Check if project already exists
    if (projects.value.has(projectId)) {
      return projects.value.get(projectId)!;
    }

    // Determine template and initial file structure based on language/code content
    const template = detectTemplate(code, language);
    const initialFiles = createInitialFileStructure(code, language, template);
    
    const project: CodeProject = {
      id: projectId,
      name: `Code from Node ${sourceInfo.nodeId.slice(-6)}`,
      description: `Generated from workspace ${sourceInfo.workspaceId}`,
      sourceInfo,
      fileStructure: initialFiles,
      metadata: {
        language,
        template,
        createdAt: Date.now(),
        lastModified: Date.now(),
        dependencies: getTemplateDependencies(template)
      },
      currentFileId: initialFiles.find(f => f.type === 'file')?.id || null,
      openFiles: []
    };

    projects.value.set(projectId, project);
    saveProjectsToStorage();
    
    return project;
  };

  // Switch to project
  const switchToProject = (projectId: string): boolean => {
    if (projects.value.has(projectId)) {
      currentProjectId.value = projectId;
      saveProjectsToStorage(); // Save the current project switch
      return true;
    }
    return false;
  };

  // Update project file
  const updateProjectFile = (projectId: string, fileId: string, content: string): void => {
    const project = projects.value.get(projectId);
    if (!project) return;

    const updateFileInStructure = (files: ProjectFile[]): boolean => {
      for (const file of files) {
        if (file.id === fileId) {
          file.content = content;
          file.lastModified = Date.now();
          project.metadata.lastModified = Date.now();
          return true;
        }
        if (file.children && updateFileInStructure(file.children)) {
          return true;
        }
      }
      return false;
    };

    updateFileInStructure(project.fileStructure);
    saveProjectsToStorage();
  };

  // Add file to project
  const addFileToProject = (projectId: string, file: Omit<ProjectFile, 'id' | 'lastModified'>): string => {
    const project = projects.value.get(projectId);
    if (!project) return '';

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newFile: ProjectFile = {
      ...file,
      id: fileId,
      lastModified: Date.now()
    };

    if (file.parentId) {
      // Add to parent folder
      const findAndAddToParent = (files: ProjectFile[]): boolean => {
        for (const f of files) {
          if (f.id === file.parentId) {
            if (!f.children) f.children = [];
            f.children.push(newFile);
            return true;
          }
          if (f.children && findAndAddToParent(f.children)) {
            return true;
          }
        }
        return false;
      };
      findAndAddToParent(project.fileStructure);
    } else {
      // Add to root
      project.fileStructure.push(newFile);
    }

    project.metadata.lastModified = Date.now();
    saveProjectsToStorage();
    return fileId;
  };

  // Delete file from project
  const deleteFileFromProject = (projectId: string, fileId: string): boolean => {
    const project = projects.value.get(projectId);
    if (!project) return false;

    const deleteFromStructure = (files: ProjectFile[]): boolean => {
      for (let i = 0; i < files.length; i++) {
        if (files[i].id === fileId) {
          files.splice(i, 1);
          return true;
        }
        if (files[i].children && deleteFromStructure(files[i].children)) {
          return true;
        }
      }
      return false;
    };

    const deleted = deleteFromStructure(project.fileStructure);
    if (deleted) {
      project.metadata.lastModified = Date.now();
      // Remove from open files
      project.openFiles = project.openFiles.filter(id => id !== fileId);
      if (project.currentFileId === fileId) {
        project.currentFileId = project.fileStructure.find(f => f.type === 'file')?.id || null;
      }
      saveProjectsToStorage();
    }
    return deleted;
  };

  // Rename file in project
  const renameFileInProject = (projectId: string, fileId: string, newName: string): boolean => {
    const project = projects.value.get(projectId);
    if (!project) return false;

    const renameInStructure = (files: ProjectFile[]): boolean => {
      for (const file of files) {
        if (file.id === fileId) {
          file.name = newName;
          file.lastModified = Date.now();
          project.metadata.lastModified = Date.now();
          return true;
        }
        if (file.children && renameInStructure(file.children)) {
          return true;
        }
      }
      return false;
    };

    const renamed = renameInStructure(project.fileStructure);
    if (renamed) {
      saveProjectsToStorage();
    }
    return renamed;
  };

  // Update project open files
  const updateProjectOpenFiles = (projectId: string, openFiles: string[], currentFileId: string | null): void => {
    const project = projects.value.get(projectId);
    if (!project) return;

    project.openFiles = openFiles;
    project.currentFileId = currentFileId;
    saveProjectsToStorage();
  };

  // Get project by source info
  const getProjectBySource = (workspaceId: string, nodeId: string, messageIndex: number, codeIndex: number): CodeProject | null => {
    const projectId = generateProjectId(workspaceId, nodeId, messageIndex, codeIndex);
    return projects.value.get(projectId) || null;
  };

  // Save to localStorage
  const saveProjectsToStorage = (): void => {
    const projectsData = Array.from(projects.value.entries());
    const storageData = {
      projects: projectsData,
      currentProjectId: currentProjectId.value
    };
    localStorage.setItem('codeProjects', JSON.stringify(storageData));
  };

  // Load from localStorage
  const loadProjectsFromStorage = (): void => {
    try {
      const stored = localStorage.getItem('codeProjects');
      if (stored) {
        const storageData = JSON.parse(stored);
        
        // Handle both old and new storage formats
        if (Array.isArray(storageData)) {
          // Old format - just projects array
          projects.value = new Map(storageData);
        } else {
          // New format - projects and currentProjectId
          projects.value = new Map(storageData.projects || []);
          currentProjectId.value = storageData.currentProjectId || null;
        }
      }
    } catch (error) {
      console.error('Error loading projects from storage:', error);
    }
  };

  // Helper functions
  const detectTemplate = (code: string, language: string): string => {
    // Detect React/Vue/etc based on code content
    if (code.includes('React') || code.includes('jsx') || language === 'react') return 'react';
    if (code.includes('Vue') || code.includes('<template>')) return 'vue';
    if (code.includes('THREE') || code.includes('three')) return 'react-three';
    if (language === 'html') return 'vanilla';
    return 'react'; // default
  };

  const createInitialFileStructure = (code: string, language: string, template: string): ProjectFile[] => {
    const now = Date.now();
    
    // Create main file based on template
    const mainFileName = getMainFileName(template, language);
    const mainFile: ProjectFile = {
      id: 'main_file',
      name: mainFileName,
      path: `/${mainFileName}`,
      content: code,
      language: language === 'react' ? 'jsx' : language,
      type: 'file',
      lastModified: now
    };

    // Add template-specific files
    const templateFiles = getTemplateFiles(template);
    
    // Recursively assign IDs and lastModified to template files
    const processTemplateFiles = (files: Partial<ProjectFile>[], parentId?: string): ProjectFile[] => {
      return files.map(tf => {
        const fileId = `template_${tf.name!.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.random().toString(36).substr(2, 9)}`;
        const processedFile: ProjectFile = {
          ...tf,
          id: fileId,
          lastModified: now,
          name: tf.name!,
          path: tf.path!,
          content: tf.content!,
          language: tf.language!,
          type: tf.type!,
          parentId: parentId
        };
        
        if (tf.children) {
          processedFile.children = processTemplateFiles(tf.children, fileId);
        }
        
        return processedFile;
      });
    };

    const allFiles = [mainFile, ...processTemplateFiles(templateFiles)];

    // For React/JS projects, ensure we have the essential sandpack setup
    if (template === 'react' || template === 'react-three') {
      // Add package.json if not already present
      const hasPackageJson = allFiles.some(f => f.name === 'package.json');
      if (!hasPackageJson) {
        allFiles.push({
          id: 'package_json',
          name: 'package.json',
          path: '/package.json',
          content: JSON.stringify({
            name: 'code-preview',
            version: '1.0.0',
            dependencies: getTemplateDependencies(template)
          }, null, 2),
          language: 'json',
          type: 'file',
          lastModified: now
        });
      }
    }

    return allFiles;
  };

  const getMainFileName = (template: string, language: string): string => {
    switch (template) {
      case 'vue': return 'App.vue';
      case 'vanilla': return 'index.html';
      default: return language === 'typescript' ? 'App.tsx' : 'App.jsx';
    }
  };

  const getTemplateFiles = (template: string): Partial<ProjectFile>[] => {
    // Return additional files needed for each template
    switch (template) {
      case 'react':
      case 'react-three':
        return [
          {
            name: 'index.js',
            path: '/index.js',
            content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import './styles.css';

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);`,
            language: 'javascript',
            type: 'file'
          },
          {
            name: 'styles.css',
            path: '/styles.css',
            content: `html, body, #root {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
  background: #f0f0f0;
}`,
            language: 'css',
            type: 'file'
          },
          {
            name: 'public',
            path: '/public',
            content: '',
            language: 'folder',
            type: 'folder',
            children: [
              {
                name: 'index.html',
                path: '/public/index.html',
                content: `<!DOCTYPE html>
<html>
<head>
  <title>Code Preview</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
                language: 'html',
                type: 'file'
              }
            ]
          }
        ];
      case 'vue':
        return [
          {
            name: 'src',
            path: '/src',
            content: '',
            language: 'folder',
            type: 'folder',
            children: [
              {
                name: 'main.js',
                path: '/src/main.js',
                content: `import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')`,
                language: 'javascript',
                type: 'file'
              },
              {
                name: 'style.css',
                path: '/src/style.css',
                content: `html, body, #app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}`,
                language: 'css',
                type: 'file'
              }
            ]
          },
          {
            name: 'index.html',
            path: '/index.html',
            content: `<!DOCTYPE html>
<html>
<head>
  <title>Vue App</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`,
            language: 'html',
            type: 'file'
          }
        ];
      default:
        return [];
    }
  };

  const getTemplateDependencies = (template: string): Record<string, string> => {
    // Return dependencies for each template
    switch (template) {
      case 'react':
        return { 'react': '^18.2.0', 'react-dom': '^18.2.0' };
      case 'react-three':
        return { 
          'react': '^18.2.0', 
          'react-dom': '^18.2.0',
          '@react-three/fiber': '^8.13.0',
          '@react-three/drei': '^9.77.0',
          'three': '^0.153.0'
        };
      case 'vue':
        return { 'vue': '^3.3.0' };
      default:
        return {};
    }
  };

  // Initialize
  loadProjectsFromStorage();

  return {
    projects,
    currentProjectId,
    currentProject,
    generateProjectId,
    createProjectFromCode,
    switchToProject,
    updateProjectFile,
    addFileToProject,
    deleteFileFromProject,
    renameFileInProject,
    updateProjectOpenFiles,
    getProjectBySource,
    saveProjectsToStorage,
    loadProjectsFromStorage
  };
});