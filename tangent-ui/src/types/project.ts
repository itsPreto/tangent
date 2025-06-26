export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  type: 'file' | 'folder';
  lastModified: number;
  parentId?: string;
  children?: ProjectFile[];
}

export interface ProjectMetadata {
  language: string;
  template: string;
  createdAt: number;
  lastModified: number;
  dependencies: Record<string, string>;
}

export interface CodeProject {
  id: string;
  name: string;
  description: string;
  sourceInfo: {
    workspaceId: string;
    nodeId: string;
    messageIndex: number;
    codeIndex: number;
  };
  fileStructure: ProjectFile[];
  metadata: ProjectMetadata;
  currentFileId: string | null;
  openFiles: string[];
}