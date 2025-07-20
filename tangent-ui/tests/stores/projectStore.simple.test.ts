import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '@/stores/projectStore'

describe('projectStore - Core Functionality', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Create a proper localStorage mock for this test
    const storage = new Map()
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
      writable: true
    })
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useProjectStore()
      
      expect(store.projects.size).toBe(0)
      expect(store.currentProjectId).toBe(null)
      expect(store.currentProject).toBe(null)
    })
  })

  describe('generateProjectId', () => {
    it('should generate consistent project IDs', () => {
      const store = useProjectStore()
      
      const id1 = store.generateProjectId('workspace1', 'node1', 0, 0)
      const id2 = store.generateProjectId('workspace1', 'node1', 0, 0)
      const id3 = store.generateProjectId('workspace1', 'node1', 0, 1)
      
      expect(id1).toBe(id2)
      expect(id1).not.toBe(id3)
      expect(id1).toBe('project_workspace1_node1_0_0')
    })
  })

  describe('createProjectFromCode', () => {
    it('should create React project from JavaScript code', () => {
      const store = useProjectStore()
      const code = `
import React from 'react'

function App() {
  return <div>Hello World</div>
}

export default App
      `.trim()
      
      const sourceInfo = {
        workspaceId: 'ws1',
        nodeId: 'node1', 
        messageIndex: 0,
        codeIndex: 0
      }
      
      const project = store.createProjectFromCode(code, 'javascript', sourceInfo)
      
      expect(project.name).toBe('Code from Node node1')
      expect(project.metadata.language).toBe('javascript')
      expect(project.metadata.template).toBe('react')
      expect(project.fileStructure.length).toBeGreaterThan(0)
      
      const mainFile = project.fileStructure.find(f => f.name === 'App.js')
      expect(mainFile?.content).toBe(code)
    })

    it('should create Vue project from Vue code', () => {
      const store = useProjectStore()
      const code = `
<template>
  <div>Hello Vue</div>
</template>

<script>
export default {
  name: 'App'
}
</script>
      `.trim()
      
      const sourceInfo = {
        workspaceId: 'ws1',
        nodeId: 'node1',
        messageIndex: 0,
        codeIndex: 0
      }
      
      const project = store.createProjectFromCode(code, 'vue', sourceInfo)
      
      expect(project.metadata.template).toBe('vue')
      
      const mainFile = project.fileStructure.find(f => f.name === 'App.vue')
      expect(mainFile?.content).toBe(code)
    })

    it('should detect React Three.js project from Three.js code', () => {
      const store = useProjectStore()
      const code = `
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'

function App() {
  return (
    <Canvas>
      <mesh>
        <boxGeometry />
      </mesh>
    </Canvas>
  )
}
      `.trim()
      
      const sourceInfo = {
        workspaceId: 'ws1',
        nodeId: 'node1',
        messageIndex: 0,
        codeIndex: 0
      }
      
      const project = store.createProjectFromCode(code, 'javascript', sourceInfo)
      
      expect(project.metadata.template).toBe('react-three')
      expect(project.metadata.dependencies).toMatchObject({
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        '@react-three/fiber': '^8.15.0',
        '@react-three/drei': '^9.88.0',
        'three': '^0.159.0'
      })
    })

    it('should return existing project if already created', () => {
      const store = useProjectStore()
      const sourceInfo = {
        workspaceId: 'ws1',
        nodeId: 'node1',
        messageIndex: 0,
        codeIndex: 0
      }
      
      const project1 = store.createProjectFromCode('code', 'javascript', sourceInfo)
      const project2 = store.createProjectFromCode('different code', 'javascript', sourceInfo)
      
      expect(project1.id).toBe(project2.id)
      expect(store.projects.size).toBe(1)
    })
  })

  describe('switchToProject', () => {
    it('should switch to existing project', () => {
      const store = useProjectStore()
      const project = store.createProjectFromCode('code', 'javascript', {
        workspaceId: 'ws1',
        nodeId: 'node1',
        messageIndex: 0,
        codeIndex: 0
      })
      
      const result = store.switchToProject(project.id)
      
      expect(result).toBe(true)
      expect(store.currentProjectId).toBe(project.id)
      expect(store.currentProject?.id).toBe(project.id)
    })

    it('should return false for non-existent project', () => {
      const store = useProjectStore()
      
      const result = store.switchToProject('non-existent')
      
      expect(result).toBe(false)
      expect(store.currentProjectId).toBe(null)
    })
  })

  describe('updateProjectFile', () => {
    it('should update file content', () => {
      const store = useProjectStore()
      const project = store.createProjectFromCode('original code', 'javascript', {
        workspaceId: 'ws1',
        nodeId: 'node1',
        messageIndex: 0,
        codeIndex: 0
      })
      
      const mainFile = project.fileStructure.find(f => f.name === 'App.js')!
      const originalModified = mainFile.lastModified
      
      // Use fake timers to control timestamp
      vi.useFakeTimers()
      vi.advanceTimersByTime(1000)
      
      store.updateProjectFile(project.id, mainFile.id, 'updated code')
      
      expect(mainFile.content).toBe('updated code')
      expect(mainFile.lastModified).toBeGreaterThan(originalModified)
      expect(project.metadata.lastModified).toBeGreaterThan(originalModified)
      
      vi.useRealTimers()
    })

    it('should do nothing for non-existent project', () => {
      const store = useProjectStore()
      
      // Should not throw
      expect(() => {
        store.updateProjectFile('non-existent', 'file-id', 'content')
      }).not.toThrow()
    })
  })

  describe('addFileToProject', () => {
    it('should add file to root', () => {
      const store = useProjectStore()
      const project = store.createProjectFromCode('code', 'javascript', {
        workspaceId: 'ws1',
        nodeId: 'node1',
        messageIndex: 0,
        codeIndex: 0
      })
      
      const initialLength = project.fileStructure.length
      
      const fileId = store.addFileToProject(project.id, {
        name: 'utils.js',
        path: '/utils.js',
        content: 'export const utils = {}',
        language: 'javascript',
        type: 'file'
      })
      
      expect(fileId).toBeTruthy()
      expect(project.fileStructure).toHaveLength(initialLength + 1)
      
      const newFile = project.fileStructure.find(f => f.id === fileId)
      expect(newFile).toMatchObject({
        name: 'utils.js',
        content: 'export const utils = {}'
      })
    })
  })

  describe('deleteFileFromProject', () => {
    it('should delete file from root', () => {
      const store = useProjectStore()
      const project = store.createProjectFromCode('code', 'javascript', {
        workspaceId: 'ws1',
        nodeId: 'node1',
        messageIndex: 0,
        codeIndex: 0
      })
      
      const mainFile = project.fileStructure.find(f => f.name === 'App.js')!
      const initialLength = project.fileStructure.length
      
      const result = store.deleteFileFromProject(project.id, mainFile.id)
      
      expect(result).toBe(true)
      expect(project.fileStructure).toHaveLength(initialLength - 1)
      expect(project.fileStructure.find(f => f.id === mainFile.id)).toBeFalsy()
    })

    it('should update currentFileId when deleting current file', () => {
      const store = useProjectStore()
      const project = store.createProjectFromCode('code', 'javascript', {
        workspaceId: 'ws1',
        nodeId: 'node1',
        messageIndex: 0,
        codeIndex: 0
      })
      
      const mainFile = project.fileStructure.find(f => f.name === 'App.js')!
      project.currentFileId = mainFile.id
      
      store.deleteFileFromProject(project.id, mainFile.id)
      
      expect(project.currentFileId).not.toBe(mainFile.id)
    })
  })

  describe('getProjectBySource', () => {
    it('should retrieve project by source info', () => {
      const store = useProjectStore()
      const sourceInfo = {
        workspaceId: 'ws1',
        nodeId: 'node1',
        messageIndex: 0,
        codeIndex: 0
      }
      
      const project = store.createProjectFromCode('code', 'javascript', sourceInfo)
      
      const retrieved = store.getProjectBySource(
        sourceInfo.workspaceId,
        sourceInfo.nodeId,
        sourceInfo.messageIndex,
        sourceInfo.codeIndex
      )
      
      expect(retrieved?.id).toBe(project.id)
    })

    it('should return null for non-existent project', () => {
      const store = useProjectStore()
      
      const result = store.getProjectBySource('ws1', 'node1', 0, 0)
      
      expect(result).toBe(null)
    })
  })

  describe('Storage Operations', () => {
    it('should save and load projects to/from localStorage', () => {
      const store = useProjectStore()
      const project = store.createProjectFromCode('code', 'javascript', {
        workspaceId: 'ws1',
        nodeId: 'node1',
        messageIndex: 0,
        codeIndex: 0
      })
      store.currentProjectId = project.id
      
      store.saveProjectsToStorage()
      
      const stored = localStorage.getItem('codeProjects')
      expect(stored).toBeTruthy()
      
      const parsed = JSON.parse(stored!)
      expect(parsed.projects).toHaveLength(1)
      expect(parsed.currentProjectId).toBe(project.id)
      
      // Test loading
      store.projects.clear()
      store.currentProjectId = null
      
      store.loadProjectsFromStorage()
      
      expect(store.projects.size).toBe(1)
      expect(store.currentProjectId).toBe(project.id)
    })

    it('should handle corrupted storage gracefully', () => {
      const store = useProjectStore()
      
      localStorage.setItem('codeProjects', 'invalid json')
      
      // Should not throw
      expect(() => {
        store.loadProjectsFromStorage()
      }).not.toThrow()
      
      expect(store.projects.size).toBe(0)
    })
  })

  describe('Template Detection', () => {
    it('should detect Vue template', () => {
      const store = useProjectStore()
      
      const project1 = store.createProjectFromCode('<template><div>Vue</div></template>', 'vue', {
        workspaceId: 'ws1', nodeId: 'node1', messageIndex: 0, codeIndex: 0
      })
      
      const project2 = store.createProjectFromCode('import Vue from "vue"', 'javascript', {
        workspaceId: 'ws1', nodeId: 'node1', messageIndex: 0, codeIndex: 1
      })
      
      expect(project1.metadata.template).toBe('vue')
      expect(project2.metadata.template).toBe('vue')
    })

    it('should default to React template', () => {
      const store = useProjectStore()
      
      const project = store.createProjectFromCode('console.log("hello")', 'javascript', {
        workspaceId: 'ws1', nodeId: 'node1', messageIndex: 0, codeIndex: 0
      })
      
      expect(project.metadata.template).toBe('react')
    })
  })
})