<template>
    <component 
      :is="iconComponent" 
      :class="iconClass"
      :style="iconStyle"
    />
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue'
  import { 
    FileText, Code, Globe, Palette, Braces, 
    FileCode, Settings, Image, Package,
    Database, Archive, FileSpreadsheet,
    BookOpen, Video, Music, Lock
  } from 'lucide-vue-next'
  
  interface Props {
    filename: string
    size?: number
  }
  
  const props = withDefaults(defineProps<Props>(), {
    size: 16
  })
  
  const fileExtension = computed(() => {
    const parts = props.filename.split('.')
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
  })
  
  const iconComponent = computed(() => {
    const ext = fileExtension.value
    
    // JavaScript/TypeScript files
    if (['js', 'jsx', 'mjs'].includes(ext)) {
      return FileCode
    }
    
    if (['ts', 'tsx'].includes(ext)) {
      return FileCode
    }
    
    // Web files
    if (ext === 'html' || ext === 'htm') {
      return Globe
    }
    
    if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') {
      return Palette
    }
    
    // Framework files
    if (ext === 'vue') {
      return FileCode
    }
    
    if (ext === 'svelte') {
      return FileCode
    }
    
    // Data files
    if (['json', 'xml', 'yaml', 'yml', 'toml'].includes(ext)) {
      return Braces
    }
    
    // Python
    if (ext === 'py' || ext === 'pyw' || ext === 'pyi') {
      return FileCode
    }
    
    // Config files
    if (['config', 'conf', 'cfg', 'ini', 'env'].includes(ext)) {
      return Settings
    }
    
    // Package files
    if (['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(props.filename)) {
      return Package
    }
    
    // Images
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) {
      return Image
    }
    
    // Databases
    if (['db', 'sqlite', 'sql'].includes(ext)) {
      return Database
    }
    
    // Archives
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return Archive
    }
    
    // Spreadsheets
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return FileSpreadsheet
    }
    
    // Documents
    if (['md', 'mdx', 'txt', 'doc', 'docx', 'pdf'].includes(ext)) {
      return BookOpen
    }
    
    // Media
    if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) {
      return Video
    }
    
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
      return Music
    }
    
    // Security
    if (['key', 'pem', 'crt', 'cert'].includes(ext)) {
      return Lock
    }
    
    // Default
    return FileText
  })
  
  const iconClass = computed(() => {
    const ext = fileExtension.value
    
    // Add specific styling classes based on file type
    const classes = []
    
    // JavaScript files - yellow
    if (['js', 'jsx', 'mjs'].includes(ext)) {
      classes.push('text-yellow-500')
    }
    
    // TypeScript files - blue
    else if (['ts', 'tsx'].includes(ext)) {
      classes.push('text-blue-500')
    }
    
    // HTML files - orange
    else if (ext === 'html' || ext === 'htm') {
      classes.push('text-orange-500')
    }
    
    // CSS files - blue
    else if (['css', 'scss', 'sass', 'less'].includes(ext)) {
      classes.push('text-blue-400')
    }
    
    // Vue files - green
    else if (ext === 'vue') {
      classes.push('text-green-500')
    }
    
    // Python files - blue/yellow
    else if (['py', 'pyw', 'pyi'].includes(ext)) {
      classes.push('text-blue-600')
    }
    
    // JSON files - yellow
    else if (['json', 'yaml', 'yml'].includes(ext)) {
      classes.push('text-yellow-600')
    }
    
    // Image files - purple
    else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
      classes.push('text-purple-500')
    }
    
    // Config files - gray
    else if (['config', 'conf', 'cfg', 'ini', 'env'].includes(ext)) {
      classes.push('text-gray-500')
    }
    
    // Package files - red
    else if (['package.json', 'package-lock.json', 'yarn.lock'].includes(props.filename)) {
      classes.push('text-red-500')
    }
    
    // Default - neutral
    else {
      classes.push('text-gray-600')
    }
    
    return classes.join(' ')
  })
  
  const iconStyle = computed(() => ({
    width: `${props.size}px`,
    height: `${props.size}px`,
    flexShrink: 0
  }))
  </script>
  
  <style scoped>
  /* Additional icon styling can go here */
  </style>