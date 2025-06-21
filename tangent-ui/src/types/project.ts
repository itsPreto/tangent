export interface CodeProject {
    id: string;
    name: string;
    description?: string;
    sourceInfo: {
      workspaceId: string;
      nodeId: string;
      messageIndex: number;
      codeIndex: number;
    };
    fileStructure: ProjectFile[];
    metadata: {
      language: string;
      template: string;
      createdAt: number;
      lastModified: number;
      dependencies: Record<string, string>;
    };
    currentFileId: string | null;
    openFiles: string[];
  }
  
  export interface ProjectFile {
    id: string;
    name: string;
    path: string;
    content: string;
    language: string;
    type: 'file' | 'folder';
    parentId?: string;
    children?: ProjectFile[];
    lastModified: number;
  }
  