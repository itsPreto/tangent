import tiktoken
import os
from pathlib import Path

# Disable ChromaDB telemetry
os.environ['ANONYMIZED_TELEMETRY'] = 'false'
import re
import time
from typing import Dict, List, Tuple, Optional
import requests
from collections import defaultdict
import numpy as np
from flask import Flask, request, jsonify, Response, Blueprint, stream_with_context
from flask_cors import CORS
import logging
import sseclient
import requests
import json
import hashlib
import base64
from PIL import Image
import io
import google.generativeai as genai
from ChatgptChatProcessor import ChatGPTDataProcessor
from ChatPersistenceService import ChatPersistenceService, Chat, db
from EmbeddingService import EmbeddingService
from ClusteringService import ClusteringService
from ConversationImportService import ConversationImportService
from RelicService import RelicService
from ThumbnailService import ThumbnailService
from SessionService import SessionService
from SlashCommandService import SlashCommandService
from ToolCallService import ToolCallService
from ClaudeCodeService import ClaudeCodeService
from NodeClusteringService import NodeClusteringService
from SearchService import SearchService
from ReflectionService import ReflectionService
from RouterAgentService import RouterAgentService
from AgentConfigService import AgentConfigService
from MockDataService import MockDataService
from CanvasConfigService import CanvasConfigService
from ConfigFileWatcher import ConfigFileWatcher
import tempfile
import uuid
import subprocess
from functools import wraps
import shutil
import soundfile as sf
import numpy as np
import random
import math
from datetime import datetime, timedelta, timezone

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

api_routes = Blueprint('api_routes', __name__)

app = Flask(__name__)

# Configure CORS with more permissive settings for development
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",  # Vite dev server
            "http://localhost:5173",  # Another common Vite port
            "http://127.0.0.1:3000",  # IPv4 localhost
            "http://127.0.0.1:5173",  # IPv4 localhost
            "http://localhost:8080",  # Vue CLI dev server
            "http://127.0.0.1:8080",  # IPv4 localhost
        ],
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-API-Key"],
        "supports_credentials": True
    }
})

# Configuration
UPLOAD_FOLDER = 'uploads'
AUDIO_FOLDER = 'audio_temp'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(AUDIO_FOLDER):
    os.makedirs(AUDIO_FOLDER)

# Whisper configuration - update these paths to match your whisper.cpp installation
WHISPER_MODEL_PATH = os.getenv('WHISPER_MODEL_PATH', '/Users/928546/Desktop/whisper.cpp/models/ggml-base.en.bin')
VAD_MODEL_PATH = os.getenv('VAD_MODEL_PATH', '/Users/928546/Desktop/whisper.cpp/models/ggml-silero-v5.1.2.bin')
WHISPER_CLI_PATH = os.getenv('WHISPER_CLI_PATH', '/Users/928546/Desktop/whisper.cpp/build/bin/whisper-cli')


class TangentDependencyAnalyzer:
    """
    Robust dependency analyzer for the Tangent project with caching and incremental updates
    """
    
    """
    Enhanced dependency analyzer that matches the JavaScript version's capabilities
    """
    
    def __init__(self, project_root: str = '.'):
        self.project_root = Path(project_root).resolve()
        self.cache_file = self.project_root / '.tangent_deps_cache.json'
        self.files: Dict[str, Dict] = {}
        self.dependencies: Dict[str, List] = {}
        self.reverse_dependencies: Dict[str, List] = {}
        self.circular_deps: List[List[str]] = []
        self.stats = {
            'totalFiles': 0,
            'totalDependencies': 0,
            'circularDependencies': 0,
            'externalDependencies': 0,
            'vueComponents': 0,
            'unresolvedImports': 0
        }
        
    def extract_vue_script_sections(self, content: str) -> List[str]:
        """Extract all script sections from Vue file (setup and regular)"""
        sections = []
        
        # Pattern for script setup
        setup_pattern = r'<script\s+setup[^>]*>([\s\S]*?)</script>'
        # Pattern for regular script (not setup)
        script_pattern = r'<script(?!\s+setup)[^>]*>([\s\S]*?)</script>'
        
        # Extract setup scripts first
        for match in re.finditer(setup_pattern, content, re.IGNORECASE):
            sections.append(match.group(1))
        
        # Then regular scripts
        for match in re.finditer(script_pattern, content, re.IGNORECASE):
            sections.append(match.group(1))
            
        return sections
    
    def extract_imports_from_script(self, content: str, file_path: str) -> List[Dict]:
        """Extract imports using comprehensive patterns matching JavaScript version"""
        imports = []
        
        # Comprehensive import patterns (matching JavaScript version)
        patterns = [
            # Named imports: import { a, b, c } from 'module'
            (r"import\s*\{\s*([^}]*)\s*\}\s*from\s*['\"`]([^'\"`]+)['\"`]", 2),
            
            # Default imports: import Something from 'module' 
            (r"import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s*['\"`]([^'\"`]+)['\"`]", 2),
            
            # Namespace imports: import * as Something from 'module'
            (r"import\s*\*\s*as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s*['\"`]([^'\"`]+)['\"`]", 2),
            
            # Mixed imports: import Default, { named } from 'module'
            (r"import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*\{\s*([^}]*)\s*\}\s*from\s*['\"`]([^'\"`]+)['\"`]", 3),
            
            # Side-effect imports: import 'module'
            (r"import\s*['\"`]([^'\"`]+)['\"`]", 1),
            
            # Dynamic imports: import('module')
            (r"import\s*\(\s*['\"`]([^'\"`]+)['\"`]\s*\)", 1),
            
            # Require statements: const x = require('module')
            (r"require\s*\(\s*['\"`]([^'\"`]+)['\"`]\s*\)", 1),
            
            # TypeScript type imports: import type { Type } from 'module'
            (r"import\s+type\s*\{\s*([^}]*)\s*\}\s*from\s*['\"`]([^'\"`]+)['\"`]", 2)
        ]
        
        found_imports = set()
        
        for pattern, path_group in patterns:
            for match in re.finditer(pattern, content, re.MULTILINE):
                import_path = match.group(path_group)
                
                if import_path and self.is_valid_import_path(import_path) and import_path not in found_imports:
                    found_imports.add(import_path)
                    
                    imports.append({
                        'path': import_path,
                        'type': self.get_import_type(import_path),
                        'importType': 'script-import',
                        'resolvedPath': self.resolve_import_path(import_path, file_path),
                        'line': self.get_line_number(content, match.start()),
                        'resolved': bool(self.resolve_import_path(import_path, file_path))
                    })
        
        return imports
    
    def extract_template_imports(self, template_content: str, file_path: str) -> List[Dict]:
        """Extract component usage from Vue template"""
        imports = []
        
        # Extract component usage from template
        component_pattern = r'<([A-Z][a-zA-Z0-9]*)'
        found_components = set()
        
        for match in re.finditer(component_pattern, template_content):
            component_name = match.group(1)
            
            # Skip HTML elements
            if component_name not in ['Html', 'Head', 'Body', 'Script', 'Style', 'Link', 'Meta']:
                if component_name not in found_components:
                    found_components.add(component_name)
                    imports.append({
                        'path': f'component:{component_name}',
                        'type': 'template-component',
                        'importType': 'template-usage',
                        'line': self.get_line_number(template_content, match.start()),
                        'resolved': False
                    })
        
        return imports
    
    def is_valid_import_path(self, import_path: str) -> bool:
        """Validate import path"""
        if not import_path or len(import_path) == 0 or len(import_path) > 500:
            return False
        if '${' in import_path or import_path.startswith(('data:', 'http', '//')):
            return False
        if import_path in ('.', '..') or re.match(r'^[\s\n\r]+$', import_path):
            return False
        return True
    
    def get_import_type(self, import_path: str) -> str:
        """Determine the type of import"""
        if import_path.startswith(('./', '../')):
            return 'relative'
        elif import_path.startswith('@/'):
            return 'alias'
        elif import_path.startswith('/'):
            return 'absolute'
        elif ':' in import_path:
            return 'special'
        else:
            return 'external'
    
    def resolve_import_path(self, import_path: str, from_file: str) -> Optional[str]:
        """Resolve import path to actual file"""
        try:
            from_dir = Path(from_file).parent
            
            if import_path.startswith(('./', '../')):
                # Relative import
                resolved = (self.project_root / from_dir / import_path).resolve()
            elif import_path.startswith('@/'):
                # Alias import (assuming @/ maps to src/)
                src_dir = self.project_root / 'tangent-ui' / 'src'
                if not src_dir.exists():
                    src_dir = self.project_root / 'src'
                resolved = (src_dir / import_path[2:]).resolve()
            elif import_path.startswith('/'):
                # Absolute import
                resolved = (self.project_root / import_path[1:]).resolve()
            else:
                # External import
                return None
            
            # Try different extensions
            extensions = ['', '.vue', '.ts', '.js', '.json', '/index.vue', '/index.ts', '/index.js']
            
            for ext in extensions:
                candidate = Path(str(resolved) + ext)
                if candidate.exists():
                    try:
                        return str(candidate.relative_to(self.project_root))
                    except ValueError:
                        return None
                        
        except Exception:
            pass
            
        return None
    
    def get_line_number(self, content: str, index: int) -> int:
        """Get line number for given character index"""
        try:
            return content[:index].count('\n') + 1
        except:
            return 1
    
    def find_files(self) -> Dict[str, Dict]:
        """Find all relevant files in the project"""
        files = {}
        
        # File extensions and their categories
        extensions_map = {
            '.vue': 'vue-component',
            '.ts': 'typescript', 
            '.js': 'javascript',
            '.json': 'config'
        }
        
        for ext, category in extensions_map.items():
            pattern = f'**/*{ext}'
            for file_path in self.project_root.rglob(pattern):
                # Skip excluded directories
                if any(part in {'node_modules', '.git', 'dist', 'build', '__pycache__', '.venv'} 
                       for part in file_path.parts):
                    continue
                
                # Skip very large files
                try:
                    if file_path.stat().st_size > 1024 * 1024:  # 1MB
                        continue
                except OSError:
                    continue
                    
                relative_path = str(file_path.relative_to(self.project_root))
                
                files[relative_path] = {
                    'name': file_path.name,
                    'path': relative_path,
                    'extension': ext,
                    'category': self.categorize_file(relative_path, category),
                    'size': file_path.stat().st_size,
                    'imports': [],
                    'exports': []
                }
                
        return files
    
    def categorize_file(self, file_path: str, base_category: str) -> str:
        """Determine more specific file category"""
        path_lower = file_path.lower()
        
        if 'store' in path_lower or 'pinia' in path_lower:
            return 'store'
        elif any(keyword in path_lower for keyword in ['util', 'helper', 'service']):
            return 'utility'
        elif 'type' in path_lower and base_category == 'typescript':
            return 'types'
        elif 'config' in path_lower or file_path.endswith(('.config.js', '.config.ts')):
            return 'config'
        
        return base_category
    
    def analyze_file(self, file_path: str, file_info: Dict):
        """Analyze a single file for imports and exports"""
        try:
            full_path = self.project_root / file_path
            with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
            if not content.strip():
                self.dependencies[file_path] = []
                return
                
            imports = []
            
            if file_info['extension'] == '.vue':
                # Extract script sections
                script_sections = self.extract_vue_script_sections(content)
                for script_content in script_sections:
                    imports.extend(self.extract_imports_from_script(script_content, file_path))
                
                # Extract template components
                template_match = re.search(r'<template[^>]*>([\s\S]*?)</template>', content, re.IGNORECASE)
                if template_match:
                    imports.extend(self.extract_template_imports(template_match.group(1), file_path))
                    
            elif file_info['extension'] in ['.ts', '.js']:
                imports = self.extract_imports_from_script(content, file_path)
                
            elif file_info['extension'] == '.json' and 'package.json' in file_path:
                # Handle package.json dependencies
                try:
                    json_data = json.loads(content)
                    for dep_type in ['dependencies', 'devDependencies']:
                        if dep_type in json_data:
                            for dep in json_data[dep_type]:
                                imports.append({
                                    'path': dep,
                                    'type': 'external',
                                    'importType': dep_type,
                                    'line': 1,
                                    'resolved': False
                                })
                except json.JSONDecodeError:
                    pass
            
            file_info['imports'] = imports
            self.dependencies[file_path] = imports
            
            # Build reverse dependencies
            for imp in imports:
                resolved_path = imp.get('resolvedPath')
                if resolved_path and resolved_path in self.files:
                    if resolved_path not in self.reverse_dependencies:
                        self.reverse_dependencies[resolved_path] = []
                    self.reverse_dependencies[resolved_path].append({
                        'file': file_path,
                        'import': imp
                    })
                    
        except Exception as e:
            print(f"Warning: Error analyzing file {file_path}: {e}")
            self.dependencies[file_path] = []
    
    def find_circular_dependencies(self):
        """Find circular dependencies using DFS"""
        visited = set()
        rec_stack = set()
        cycles = []
        
        def dfs(file_path: str, path: List[str], depth: int = 0) -> bool:
            if depth > 50:  # Prevent infinite recursion
                return False
                
            if file_path in rec_stack:
                # Found a cycle
                try:
                    cycle_start = path.index(file_path)
                    cycle = path[cycle_start:] + [file_path]
                    if len(cycle) <= 10:  # Only reasonable sized cycles
                        cycles.append(cycle)
                except ValueError:
                    pass
                return True
                
            if file_path in visited:
                return False
                
            visited.add(file_path)
            rec_stack.add(file_path)
            path.append(file_path)
            
            # Check dependencies
            for dep in self.dependencies.get(file_path, []):
                resolved_path = dep.get('resolvedPath')
                if resolved_path and resolved_path in self.files:
                    dfs(resolved_path, path[:], depth + 1)
                    
            rec_stack.remove(file_path)
            path.pop()
            return False
        
        for file_path in self.files:
            if file_path not in visited:
                dfs(file_path, [])
                
        # Remove duplicate cycles
        unique_cycles = []
        seen = set()
        for cycle in cycles:
            sorted_cycle = tuple(sorted(cycle))
            if sorted_cycle not in seen:
                seen.add(sorted_cycle)
                unique_cycles.append(cycle)
                
        self.circular_deps = unique_cycles
    
    def calculate_stats(self):
        """Calculate analysis statistics"""
        self.stats['totalFiles'] = len(self.files)
        self.stats['totalDependencies'] = sum(
            len(deps) for deps in self.dependencies.values()
        )
        self.stats['circularDependencies'] = len(self.circular_deps)
        self.stats['vueComponents'] = len([
            f for f in self.files.values() 
            if f['category'] == 'vue-component'
        ])
        self.stats['externalDependencies'] = sum(
            len([dep for dep in deps if dep.get('type') == 'external'])
            for deps in self.dependencies.values()
        )
        self.stats['unresolvedImports'] = sum(
            len([dep for dep in deps if not dep.get('resolvedPath') and dep.get('type') != 'external'])
            for deps in self.dependencies.values()
        )
    
    def analyze(self) -> Dict:
        """Perform full dependency analysis"""
        start_time = time.time()
        
        print(f"🔍 Starting enhanced dependency analysis...")
        print(f"📁 Analyzing: {self.project_root}")
        
        # Find all files
        self.files = self.find_files()
        print(f"📄 Found {len(self.files)} files to analyze")
        
        if not self.files:
            print("⚠️  No files found to analyze")
            return {
                'stats': self.stats,
                'files': [],
                'circularDependencies': [],
                'metadata': {
                    'analyzer': 'TangentDependencyAnalyzer',
                    'version': '2.0.0',
                    'timestamp': time.time(),
                    'analysisTimeMs': 0,
                    'projectRoot': str(self.project_root)
                }
            }
        
        # Analyze each file
        processed = 0
        for file_path, file_info in self.files.items():
            processed += 1
            if processed % 50 == 0:
                print(f"📊 Progress: {processed}/{len(self.files)} files analyzed")
            self.analyze_file(file_path, file_info)
        
        print(f"🔗 Building reverse dependencies...")
        # Reverse dependencies are built during analyze_file
        
        print(f"🌀 Finding circular dependencies...")
        self.find_circular_dependencies()
        
        print(f"📈 Calculating statistics...")
        self.calculate_stats()
        
        analysis_time = time.time() - start_time
        
        # Prepare result
        result = {
            'stats': self.stats,
            'files': list(self.files.values()),
            'circularDependencies': [
                {'cycle': cycle, 'length': len(cycle)}
                for cycle in self.circular_deps
            ],
            'metadata': {
                'analyzer': 'TangentDependencyAnalyzer',
                'version': '2.0.0',
                'timestamp': time.time(),
                'analysisTimeMs': round(analysis_time * 1000, 2),
                'cached': False,
                'projectRoot': str(self.project_root)
            }
        }
        
        print(f"✅ Analysis completed in {analysis_time:.2f}s")
        print(f"📊 Results: {self.stats['totalFiles']} files, {self.stats['totalDependencies']} dependencies")
        
        return result

class EnhancedMediaProcessor:
    def __init__(self):
        self.supported_image_types = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
        self.supported_video_types = {'video/mp4', 'video/quicktime', 'video/webm'}
        self.conversation_history = {}  # Store conversation history per media_id
     
    def process_media(self, file_data: bytes, mime_type: str, api_type: str, api_key: str = None, model: str = None) -> Dict:
            """Process media file and return analysis based on API type"""
            try:
                if mime_type in self.supported_image_types:
                    result = self.process_image(file_data, mime_type, api_type, api_key, model)
                elif mime_type in self.supported_video_types:
                    result = self.process_video(file_data, mime_type, api_type, api_key, model)
                else:
                    raise ValueError(f"Unsupported media type: {mime_type}")

                # Generate media ID
                media_id = str(uuid.uuid4())
                
                # Initialize conversation history
                self.conversation_history[media_id] = {
                    'messages': [
                        {'role': 'system', 'content': 'You are analyzing media content. Use the initial analysis as context.'},
                        {'role': 'assistant', 'content': result['analysis']}
                    ],
                    'media_data': base64.b64encode(file_data).decode('utf-8'),
                    'api_type': api_type,
                    'model': model
                }
                
                return {
                    **result,
                    'media_id': media_id
                }
                
            except Exception as e:
                logger.error(f"Error in media processing: {str(e)}")
                raise

    def process_image(self, file_data: bytes, mime_type: str, api_type: str, api_key: str = None, model: str = None) -> Dict:
        """Process image with selected API"""
        if api_type == "ollama":
            return self._process_ollama_image(file_data, model or "llava")
        elif api_type == "openrouter":
            return self._process_openrouter_image(file_data, api_key, model)
        elif api_type == "gemini":
            return self._process_gemini_image(file_data, api_key, model or "gemini-pro-vision")
        else:
            raise ValueError(f"Unsupported API type: {api_type}")

    def process_video(self, file_data: bytes, mime_type: str, api_type: str, api_key: str = None, model: str = None) -> Dict:
        """Process video with selected API"""
        if api_type == "gemini":
            return self._process_gemini_video(file_data, api_key, model or "gemini-pro-vision")
        else:
            raise ValueError("Video processing currently only supported with Gemini API")

    def _process_ollama_image(self, file_data: bytes, model: str) -> Dict:
        """Process image using Ollama's local API"""
        try:
            base64_image = base64.b64encode(file_data).decode('utf-8')
            
            response = requests.post(
                'http://localhost:11434/api/generate',
                json={
                    "model": model,
                    "prompt": "Describe this image in detail",
                    "images": [base64_image],
                    "stream": False
                }
            )
            
            if response.status_code != 200:
                raise ValueError(f"Ollama API returned status code {response.status_code}")
            
            response_data = response.json()
            if "response" not in response_data:
                raise ValueError("Unexpected response format from Ollama API")
                
            return {
                "analysis": response_data["response"],
                "type": "image"
            }
        except Exception as e:
            logger.error(f"Error in Ollama image processing: {str(e)}")
            raise

    def _process_openrouter_image(self, file_data: bytes, api_key: str, model: str) -> Dict:
        """Process image using OpenRouter API"""
        try:
            base64_image = base64.b64encode(file_data).decode('utf-8')
            
            response = requests.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'HTTP-Referer': 'http://localhost:5173',
                    'X-Title': 'Tangent Chat'
                },
                json={
                    "model": model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Describe this image in detail"
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }]
                }
            )
            
            if response.status_code != 200:
                raise ValueError(f"OpenRouter API returned status code {response.status_code}")
                
            response_data = response.json()
            if not response_data.get("choices"):
                raise ValueError("Unexpected response format from OpenRouter API")
                
            return {
                "analysis": response_data["choices"][0]["message"]["content"],
                "type": "image"
            }
        except Exception as e:
            logger.error(f"Error in OpenRouter image processing: {str(e)}")
            raise

    def _process_gemini_image(self, file_data: bytes, api_key: str, model: str) -> Dict:
        """Process image using Google's Gemini API"""
        try:
            genai.configure(api_key=api_key)
            model_instance = genai.GenerativeModel(model)
            
            image = Image.open(io.BytesIO(file_data))
            response = model_instance.generate_content(["Describe this image in detail", image])
            
            if not response.text:
                raise ValueError("Empty response from Gemini API")
                
            return {
                "analysis": response.text,
                "type": "image"
            }
        except Exception as e:
            logger.error(f"Error in Gemini image processing: {str(e)}")
            raise

    def _process_gemini_video(self, file_data: bytes, api_key: str, model: str) -> Dict:
        """Process video using Google's Gemini API"""
        temp_file = None
        try:
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
            temp_file.write(file_data)
            temp_file.close()
            
            genai.configure(api_key=api_key)
            video_file = genai.upload_file(temp_file.name)
            
            while video_file.state.name == "PROCESSING":
                time.sleep(1)
                video_file = genai.get_file(video_file.name)
                
            if video_file.state.name == "FAILED":
                raise ValueError(f"Video processing failed: {video_file.error}")
                
            model_instance = genai.GenerativeModel(model)
            response = model_instance.generate_content(
                ["Analyze this video and provide a detailed description", video_file]
            )
            
            if not response.text:
                raise ValueError("Empty response from Gemini API")
                
            return {
                "analysis": response.text,
                "type": "video"
            }
        except Exception as e:
            logger.error(f"Error in Gemini video processing: {str(e)}")
            raise
        finally:
            if temp_file and os.path.exists(temp_file.name):
                os.unlink(temp_file.name)

    def chat_follow_up(self, media_id: str, message: str, api_key: str = None) -> Dict:
        """Handle follow-up questions about the media"""
        try:
            if media_id not in self.conversation_history:
                raise ValueError("No conversation history found for this media")
                
            history = self.conversation_history[media_id]
            api_type = history['api_type']
            model = history['model']
            
            # Add user message to history
            history['messages'].append({'role': 'user', 'content': message})
            
            # Get response based on API type
            if api_type == "ollama":
                response = self._ollama_follow_up(history)
            elif api_type == "openrouter":
                response = self._openrouter_follow_up(history, api_key)
            elif api_type == "gemini":
                response = self._gemini_follow_up(history, api_key)
            else:
                raise ValueError(f"Unsupported API type for chat: {api_type}")
                
            # Add response to history
            history['messages'].append({'role': 'assistant', 'content': response})
            
            return {
                'response': response,
                'conversation_id': media_id
            }
            
        except Exception as e:
            logger.error(f"Error in follow-up chat: {str(e)}")
            raise

    def _ollama_follow_up(self, history: Dict) -> str:
        """Handle follow-up with Ollama"""
        base64_image = history['media_data']
        messages = history['messages']
        
        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                "model": history['model'],
                "prompt": messages[-1]['content'],
                "images": [base64_image],
                "system": "You are analyzing the provided image. Use previous conversation as context.",
                "context": [msg['content'] for msg in messages[:-1]],
                "stream": False
            }
        )
        
        return response.json()['response']

    def _openrouter_follow_up(self, history: Dict, api_key: str) -> str:
        """Handle follow-up with OpenRouter"""
        base64_image = history['media_data']
        messages = []
        
        # Add initial message with image
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": history['messages'][1]['content']
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}"
                    }
                }
            ]
        })
        
        # Add subsequent messages
        for msg in history['messages'][2:]:
            messages.append({
                "role": msg['role'],
                "content": msg['content']
            })
            
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'HTTP-Referer': 'http://localhost:5173',
                'X-Title': 'Tangent Chat'
            },
            json={
                "model": history['model'],
                "messages": messages
            }
        )
        
        return response.json()['choices'][0]['message']['content']

    def _gemini_follow_up(self, history: Dict, api_key: str) -> str:
        """Handle follow-up with Gemini"""
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(history['model'])
        
        # Convert base64 to image
        image_data = base64.b64decode(history['media_data'])
        image = Image.open(io.BytesIO(image_data))
        
        # Create chat with history
        chat = model.start_chat(history=[
            genai.types.ContentMsgPart(msg['content'])
            for msg in history['messages'][:-1]
        ])
        
        # Send follow-up with image context
        response = chat.send_message([
            history['messages'][-1]['content'],
            image
        ])
        
        return response.text

class KokoroTTSService:
    """Service for text-to-speech using Kokoro TTS"""
    
    def __init__(self):
        self.pipeline = None
        self.voices = {
            'af_heart': 'American Female (Heart)',
            'af_sarah': 'American Female (Sarah)', 
            'af_sky': 'American Female (Sky)',
            'af_nicole': 'American Female (Nicole)',
            'am_adam': 'American Male (Adam)',
            'am_michael': 'American Male (Michael)',
            'bf_emma': 'British Female (Emma)',
            'bf_isabella': 'British Female (Isabella)',
            'bm_george': 'British Male (George)',
            'bm_lewis': 'British Male (Lewis)'
        }
        self.default_voice = 'am_adam'
        self.sample_rate = 24000
        
    def initialize_pipeline(self, lang_code='a'):
        """Initialize the Kokoro pipeline lazily"""
        if self.pipeline is None:
            try:
                from kokoro import KPipeline
                self.pipeline = KPipeline(lang_code=lang_code)
                logger.info("Kokoro TTS pipeline initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Kokoro TTS: {e}")
                raise
        return self.pipeline
    
    def text_to_speech(self, text: str, voice: str = None, speed: float = 1.0, lang_code: str = 'a') -> bytes:
        """Convert text to speech and return audio bytes"""
        try:
            # Initialize pipeline if needed
            pipeline = self.initialize_pipeline(lang_code)
            
            # Use default voice if none specified
            if not voice or voice not in self.voices:
                voice = self.default_voice
            
            # Clean text for better pronunciation
            text = self._clean_text(text)
            
            if not text.strip():
                raise ValueError("No text provided for TTS")
            
            # Generate audio
            generator = pipeline(text, voice=voice, speed=speed)
            
            # Combine all audio chunks
            audio_chunks = []
            for _, _, audio in generator:
                audio_chunks.append(audio)
            
            if not audio_chunks:
                raise ValueError("No audio generated")
            
            # Concatenate audio
            full_audio = np.concatenate(audio_chunks)
            
            # Convert to bytes
            audio_bytes = self._audio_to_bytes(full_audio)
            
            logger.info(f"TTS generated {len(full_audio)} samples for text: {text[:50]}...")
            return audio_bytes
            
        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            raise
    
    def _clean_text(self, text: str) -> str:
        """Clean text for better TTS pronunciation"""
        # Remove markdown formatting
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)  # Bold
        text = re.sub(r'\*(.*?)\*', r'\1', text)      # Italic
        text = re.sub(r'`(.*?)`', r'\1', text)        # Code
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)  # Links
        
        # Clean up code blocks
        text = re.sub(r'```.*?```', '[code block]', text, flags=re.DOTALL)
        text = re.sub(r'`[^`]+`', '[code]', text)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        return text
    
    def _audio_to_bytes(self, audio: np.ndarray) -> bytes:
        """Convert numpy audio array to WAV bytes"""
        # Ensure audio is in the right format
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        
        # Normalize if needed
        if np.max(np.abs(audio)) > 1.0:
            audio = audio / np.max(np.abs(audio))
        
        # Create temporary file to get WAV bytes
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
            sf.write(tmp_file.name, audio, self.sample_rate)
            tmp_file.flush()
            
            with open(tmp_file.name, 'rb') as f:
                wav_bytes = f.read()
            
            os.unlink(tmp_file.name)
            
        return wav_bytes
    
    def get_available_voices(self) -> Dict[str, str]:
        """Get list of available voices"""
        return self.voices
    
    def warmup(self, voice: str = None, lang_code: str = 'a') -> None:
        """Warmup the TTS pipeline with a short synthesis"""
        try:
            if not voice or voice not in self.voices:
                voice = self.default_voice
            
            # Use a very short text for warmup
            warmup_text = "Hi."
            
            logger.info(f"Warming up TTS pipeline with voice: {voice}")
            start_time = time.time()
            
            # This will initialize the pipeline and do a quick synthesis
            self.text_to_speech(warmup_text, voice=voice, speed=1.0, lang_code=lang_code)
            
            warmup_time = (time.time() - start_time) * 1000
            logger.info(f"TTS warmup completed in {warmup_time:.1f}ms")
            
        except Exception as e:
            logger.warning(f"TTS warmup failed: {e}")
            # Continue anyway, warmup is optional

# Initialize processors
media_processor = EnhancedMediaProcessor()
chat_processor = ChatGPTDataProcessor()
tts_service = KokoroTTSService()

# Warmup TTS service in background
import threading
def warmup_tts():
    """Warmup TTS in a separate thread"""
    try:
        tts_service.warmup()
    except Exception as e:
        logger.warning(f"Background TTS warmup failed: {e}")

# Start warmup thread
warmup_thread = threading.Thread(target=warmup_tts, daemon=True)
warmup_thread.start()

# ========== TTS HELPER FUNCTIONS ==========

def clean_text_for_speech(text: str) -> str:
    """Clean text for better TTS pronunciation"""
    # Remove markdown formatting
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)  # Bold
    text = re.sub(r'\*(.*?)\*', r'\1', text)      # Italic
    text = re.sub(r'`(.*?)`', r'\1', text)        # Code
    text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)  # Links
    
    # Clean up code blocks
    text = re.sub(r'```.*?```', '[code block]', text, flags=re.DOTALL)
    text = re.sub(r'`[^`]+`', '[code]', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text

def create_smart_chunks(text: str, chunk_size: int) -> list:
    """Create smart sentence-level chunks for TTS streaming"""
    import re
    
    # Split by sentences first
    sentences = re.findall(r'[^.!?]*[.!?]+', text)
    clean_sentences = [s.strip() for s in sentences if s.strip()]
    
    if not clean_sentences:
        # Fallback for text without proper sentence endings
        words = text.split()
        if not words:
            return []
        
        chunks = []
        words_per_chunk = max(8, len(words) // 4)  # Reasonable chunks
        
        for i in range(0, len(words), words_per_chunk):
            chunk = ' '.join(words[i:i + words_per_chunk])
            chunks.append(chunk)
        
        return chunks
    
    # Group sentences into chunks
    chunks = []
    current_chunk = []
    
    for i, sentence in enumerate(clean_sentences):
        current_chunk.append(sentence)
        
        # Check if we should end this chunk
        should_end_chunk = (
            len(current_chunk) >= chunk_size or  # Reached target sentence count
            i == len(clean_sentences) - 1 or  # Last sentence
            len(' '.join(current_chunk)) > 200  # Long chunk
        )
        
        if should_end_chunk:
            chunks.append(' '.join(current_chunk))
            current_chunk = []
    
    # Add any remaining sentences
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks

# ========== APP ROUTES ==========

@app.route('/api/process', methods=['POST'])
def process_uploaded_data():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if not file.filename.endswith('.json'):
            return jsonify({'error': 'Invalid file type'}), 400

        # Save uploaded file
        data_dir = Path('./unprocessed')
        data_dir.mkdir(exist_ok=True)
        file_path = data_dir / 'chat_data.json'
        file.save(file_path)

        try:
            processed_messages = chat_processor.process_data(str(file_path))
            print(processed_messages) #for debugging

            return jsonify({
                'messages': processed_messages,
                'message': 'Data processed successfully'
            })

        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
          logger.error(f"Error processing data in /api/process route: {str(e)}")
          return jsonify({'error': str(e)}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/count-tokens', methods=['POST'])
def count_tokens():
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400
            
        # Initialize the tokenizer
        enc = tiktoken.get_encoding("cl100k_base")
        
        # Count tokens
        tokens = len(enc.encode(data['text']))
        
        return jsonify({'tokens': tokens})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/chats', methods=['POST'])
def create_chat():
    try:
        # Check if user is authenticated
        auth_header = request.headers.get('Authorization')
        if auth_header:
            try:
                token = auth_header.split(' ')[1]
                user_id = user_service.verify_token(token)
                if user_id:
                    # User is authenticated, check workspace limits
                    user = user_service.get_user_by_id(user_id)
                    if user and not user['trial_status']['can_create_workspace']:
                        return jsonify({'error': 'Workspace limit reached. Please upgrade to create more workspaces.'}), 403
                    
                    # Increment workspace count
                    result, error = user_service.increment_workspace_count(user_id)
                    if error:
                        return jsonify({'error': error}), 400
            except:
                pass  # If token verification fails, continue without auth (for now)
        
        data = request.json
        if not data or 'title' not in data or 'initialNode' not in data:
            return jsonify({'error': 'Missing required data'}), 400
            
        chat_id = chat_service.create_chat(data['title'], data['initialNode'])
        return jsonify({'chatId': chat_id})
    except Exception as e:
        logger.error(f"Error creating chat: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats', methods=['GET'])
def list_chats():
    try:
        chats = chat_service.list_chats()
        return jsonify({'chats': chats})
    except Exception as e:
        logger.error(f"Error listing chats: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats/<chat_id>', methods=['GET'])
def get_chat(chat_id):
    try:
        chat = chat_service.get_chat(chat_id)
        if not chat:
            return jsonify({'error': 'Chat not found'}), 404
        return jsonify(chat)
    except Exception as e:
        logger.error(f"Error getting chat: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats/<chat_id>', methods=['DELETE'])
def delete_chat(chat_id):
    try:
        success = chat_service.delete_chat(chat_id)
        if not success:
            return jsonify({'error': 'Chat not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error deleting chat: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/system/fresh-start', methods=['POST'])
def fresh_start():
    """
    Nuclear option: Clear ALL data and reset to fresh state
    Requires confirmation token to prevent accidental deletion
    """
    try:
        data = request.get_json()
        confirmation = data.get('confirmation', '')
        
        # Require specific confirmation phrase
        if confirmation != 'DELETE_EVERYTHING_I_AM_SURE':
            return jsonify({'error': 'Invalid confirmation. Required: DELETE_EVERYTHING_I_AM_SURE'}), 400
        
        logger.warning("🚨 FRESH START INITIATED - DELETING ALL DATA")
        
        # Clear all database data
        success = chat_service.clear_all_data()
        
        if not success:
            return jsonify({'error': 'Failed to clear database'}), 500
        
        # Clear clustering data
        try:
            clustering_service.clear_all_data()
        except Exception as e:
            logger.warning(f"Error clearing clustering data: {e}")
        
        # Clear any cached files (audio, uploads, etc.)
        try:
            import shutil
            import os
            
            # Clear audio temp files
            if os.path.exists(AUDIO_FOLDER):
                shutil.rmtree(AUDIO_FOLDER)
                os.makedirs(AUDIO_FOLDER)
            
            # Clear upload files
            if os.path.exists(UPLOAD_FOLDER):
                shutil.rmtree(UPLOAD_FOLDER)
                os.makedirs(UPLOAD_FOLDER)
            
            # Clear dependency cache
            cache_file = '.tangent_deps_cache.json'
            if os.path.exists(cache_file):
                os.remove(cache_file)
                
        except Exception as e:
            logger.warning(f"Error clearing cache files: {e}")
        
        logger.warning("✅ FRESH START COMPLETED - ALL DATA CLEARED")
        
        return jsonify({
            'message': 'Fresh start completed successfully',
            'cleared': {
                'chats': True,
                'nodes': True,
                'clustering_data': True,
                'audio_cache': True,
                'upload_cache': True,
                'dependency_cache': True
            }
        })
        
    except Exception as e:
        logger.error(f"Error during fresh start: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats/<chat_id>/cleanup-orphaned-nodes', methods=['POST'])
def cleanup_orphaned_nodes(chat_id):
    """Clean up orphaned nodes in a chat"""
    try:
        cleaned_count = chat_service.cleanup_orphaned_nodes(chat_id)
        return jsonify({
            'success': True,
            'cleaned_nodes': cleaned_count,
            'message': f'Cleaned up {cleaned_count} orphaned nodes'
        })
    except Exception as e:
        logger.error(f"Error cleaning orphaned nodes: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats/<chat_id>/integrity-check', methods=['GET'])
def check_node_integrity(chat_id):
    """Check node count integrity for a chat"""
    try:
        integrity_data = chat_service.get_node_count_integrity_check(chat_id)
        return jsonify(integrity_data)
    except Exception as e:
        logger.error(f"Error checking integrity: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats/<chat_id>/nodes', methods=['POST'])
def add_node(chat_id):
    try:
        data = request.json
        node_id = chat_service.add_node(chat_id, data)
        if not node_id:
            return jsonify({'error': 'Chat not found'}), 404
        return jsonify({'nodeId': node_id})
    except Exception as e:
        logger.error(f"Error adding node: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats/<chat_id>/nodes/<node_id>', methods=['PUT'])
def update_node(chat_id, node_id):
    try:
        data = request.json
        success = chat_service.update_node(chat_id, node_id, data)
        if not success:
            return jsonify({'error': 'Node not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error updating node: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats/<chat_id>/nodes/<node_id>', methods=['DELETE'])
def remove_node(chat_id, node_id):
    try:
        success = chat_service.remove_node(chat_id, node_id)
        if not success:
            return jsonify({'error': 'Node not found or cannot delete main node'}), 404
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error removing node: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats/<chat_id>/nodes/<node_id>/detach', methods=['POST'])
def detach_node(chat_id, node_id):
    """Detach a node from its parent, making it orphaned"""
    try:
        node = chat_service.get_node(chat_id, node_id)
        if not node:
            return jsonify({'error': 'Node not found'}), 404
            
        if not node.parent_id:
            return jsonify({'error': 'Node has no parent to detach from'}), 400
            
        # Store the old parent info for response
        old_parent_id = node.parent_id
        old_branch_index = node.branch_message_index
        
        # Detach the node
        success = chat_service.update_node(chat_id, node_id, {
            'parent_id': None,
            'branchMessageIndex': None
        })
        
        if not success:
            return jsonify({'error': 'Failed to detach node'}), 500
            
        return jsonify({
            'success': True,
            'old_parent_id': old_parent_id,
            'old_branch_index': old_branch_index
        })
    except Exception as e:
        logger.error(f"Error detaching node: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats/<chat_id>/nodes/<node_id>/attach', methods=['POST'])
def attach_node(chat_id, node_id):
    """Attach a node to a new parent"""
    try:
        data = request.json
        new_parent_id = data.get('parentId')
        branch_message_index = data.get('branchMessageIndex')
        
        if not new_parent_id:
            return jsonify({'error': 'New parent ID required'}), 400
            
        # Get both nodes
        node = chat_service.get_node(chat_id, node_id)
        parent_node = chat_service.get_node(chat_id, new_parent_id)
        
        if not node or not parent_node:
            return jsonify({'error': 'Node or parent not found'}), 404
            
        # Prevent circular dependencies
        if chat_service.would_create_cycle(chat_id, node_id, new_parent_id):
            return jsonify({'error': 'This would create a circular dependency'}), 400
            
        # Update the node
        success = chat_service.update_node(chat_id, node_id, {
            'parent_id': new_parent_id,
            'branchMessageIndex': branch_message_index
        })
        
        if not success:
            return jsonify({'error': 'Failed to attach node'}), 500
            
        # Calculate context preview
        context_preview = chat_service.get_context_preview(chat_id, node_id)
        
        return jsonify({
            'success': True,
            'context_preview': context_preview
        })
    except Exception as e:
        logger.error(f"Error attaching node: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chats/<chat_id>/nodes/<node_id>/valid-parents', methods=['GET'])
def get_valid_parents(chat_id, node_id):
    """Get list of valid attachment targets for a node"""
    try:
        node = chat_service.get_node(chat_id, node_id)
        if not node:
            return jsonify({'error': 'Node not found'}), 404
            
        # Get all nodes in the chat
        all_nodes = chat_service.get_all_nodes(chat_id)
        
        # Filter out invalid targets
        valid_parents = []
        for potential_parent in all_nodes:
            # Skip self
            if potential_parent.id == node_id:
                continue
                
            # Skip current parent
            if node.parent_id and potential_parent.id == node.parent_id:
                continue
                
            # Skip descendants
            if chat_service.is_descendant(chat_id, potential_parent.id, node_id):
                continue
                
            valid_parents.append({
                'id': potential_parent.id,
                'title': potential_parent.title,
                'type': potential_parent.type,
                'messageCount': len(potential_parent.messages or [])
            })
            
        return jsonify({'valid_parents': valid_parents})
    except Exception as e:
        logger.error(f"Error getting valid parents: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/process-media', methods=['POST'])
def process_media():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['file']
        api_type = request.form.get('api_type')
        api_key = request.form.get('api_key')
        model = request.form.get('model')
        
        if not file.filename:
            return jsonify({'error': 'No file selected'}), 400
            
        file_data = file.read()
        mime_type = file.content_type
        
        result = media_processor.process_media(file_data, mime_type, api_type, api_key, model)
        
        # Save the file
        media_id = result['media_id']
        media_path = os.path.join(UPLOAD_FOLDER, f"{media_id}_{file.filename}")
        with open(media_path, 'wb') as f:
            f.write(file_data)
        
        return jsonify({
            **result,
            'filename': file.filename,
            'mime_type': mime_type
        })
        
    except Exception as e:
        logger.error(f"Error processing media: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chat-follow-up', methods=['POST'])
def chat_follow_up():
    try:
        data = request.json
        media_id = data.get('media_id')
        message = data.get('message')
        api_key = data.get('api_key')
        
        if not media_id or not message:
            return jsonify({'error': 'Missing required parameters'}), 400
            
        response = media_processor.chat_follow_up(media_id, message, api_key)
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in chat follow-up: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/chats/<chat_id>', methods=['PUT'])
def update_chat(chat_id):
    try:
        data = request.json
        # Find the chat
        chat = Chat.query.get(chat_id)
        if not chat:
            return jsonify({'error': 'Chat not found'}), 404
            
        # Update positions if provided
        if 'x' in data:
            chat.x = data['x']
        if 'y' in data:
            chat.y = data['y']
        
        # Update other metadata as needed
        if 'title' in data:
            chat.title = data['title']
            
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error updating chat: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/media/<media_id>', methods=['GET'])
def get_media(media_id):
    try:
        for filename in os.listdir(UPLOAD_FOLDER):
            if filename.startswith(media_id):
                file_path = os.path.join(UPLOAD_FOLDER, filename)
                with open(file_path, 'rb') as f:
                    return f.read()
        return jsonify({'error': 'Media not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transcribe-audio', methods=['POST'])
def transcribe_audio():
    """Transcribe audio using Whisper.cpp with VAD support"""
    try:
        # Check if audio file is present
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
            
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'No audio file selected'}), 400
        
        # Get VAD parameters from request
        mode = request.form.get('mode', 'manual')
        vad_threshold = float(request.form.get('vad_threshold', 0.5))
        min_speech_duration = int(request.form.get('min_speech_duration', 250))
        min_silence_duration = int(request.form.get('min_silence_duration', 1500))
        max_speech_duration = int(request.form.get('max_speech_duration', 30))
        speech_pad = int(request.form.get('speech_pad', 200))
        
        # Create temporary files with absolute paths
        audio_id = str(uuid.uuid4())
        input_path = os.path.abspath(os.path.join(AUDIO_FOLDER, f"{audio_id}_input.webm"))
        wav_path = os.path.abspath(os.path.join(AUDIO_FOLDER, f"{audio_id}.wav"))
        
        try:
            # Save uploaded audio file
            audio_file.save(input_path)
            
            # Convert webm to wav using ffmpeg (whisper.cpp expects wav)
            ffmpeg_cmd = [
                'ffmpeg', '-i', input_path, 
                '-ar', '16000',  # 16kHz sample rate
                '-ac', '1',      # mono
                '-c:a', 'pcm_s16le',  # 16-bit PCM
                '-y',            # overwrite output
                wav_path
            ]
            
            logger.info(f"Running ffmpeg command: {' '.join(ffmpeg_cmd)}")
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                logger.error(f"FFmpeg error: {result.stderr}")
                return jsonify({'error': 'Failed to convert audio format'}), 500
            
            # Check if conversion was successful
            if not os.path.exists(wav_path):
                logger.error(f"WAV file was not created: {wav_path}")
                return jsonify({'error': 'Audio conversion failed - WAV file not created'}), 500
            
            logger.info(f"WAV file created successfully: {wav_path}, size: {os.path.getsize(wav_path)} bytes")
            
            # Check if required files exist
            if not os.path.exists(WHISPER_CLI_PATH):
                return jsonify({'error': f'Whisper CLI not found at {WHISPER_CLI_PATH}'}), 500
                
            if not os.path.exists(WHISPER_MODEL_PATH):
                return jsonify({'error': f'Whisper model not found at {WHISPER_MODEL_PATH}'}), 500
                
            if not os.path.exists(VAD_MODEL_PATH):
                return jsonify({'error': f'VAD model not found at {VAD_MODEL_PATH}'}), 500
            
            # Try with more lenient VAD settings first
            whisper_cmd_vad = [
                WHISPER_CLI_PATH,
                '-f', wav_path,
                '-m', WHISPER_MODEL_PATH,
                '--vad',
                '--vad-model', VAD_MODEL_PATH,
                '--vad-threshold', '0.1',  # Very low threshold
                '--vad-min-speech-duration-ms', '100',  # Very short minimum
                '--vad-min-silence-duration-ms', '500',  # Short silence
                '--vad-max-speech-duration-s', str(max_speech_duration),
                '--vad-speech-pad-ms', str(speech_pad),
                '--output-txt',  # Output as text
                '--no-timestamps',  # Clean text output
                '--threads', '4'
            ]
            
            logger.info(f"Running whisper with lenient VAD: {' '.join(whisper_cmd_vad)}")
            
            # Run whisper transcription with VAD
            result = subprocess.run(whisper_cmd_vad, capture_output=True, text=True, cwd=os.path.dirname(WHISPER_CLI_PATH))
            
            transcription_text = ""
            vad_used = True
            
            if result.returncode == 0:
                # Get transcription text
                transcription_text = result.stdout.strip()
                
                # If no text output in stdout, try reading from generated txt file
                if not transcription_text:
                    txt_file = wav_path.replace('.wav', '.txt')
                    if os.path.exists(txt_file):
                        with open(txt_file, 'r', encoding='utf-8') as f:
                            transcription_text = f.read().strip()
                        try:
                            os.remove(txt_file)  # Clean up
                        except:
                            pass
            
            # If VAD didn't detect speech, try without VAD as fallback
            if not transcription_text:
                logger.info("VAD detected no speech, trying without VAD as fallback")
                whisper_cmd_no_vad = [
                    WHISPER_CLI_PATH,
                    '-f', wav_path,
                    '-m', WHISPER_MODEL_PATH,
                    '--output-txt',  # Output as text
                    '--no-timestamps',  # Clean text output
                    '--threads', '4'
                ]
                
                logger.info(f"Running whisper without VAD: {' '.join(whisper_cmd_no_vad)}")
                
                result = subprocess.run(whisper_cmd_no_vad, capture_output=True, text=True, cwd=os.path.dirname(WHISPER_CLI_PATH))
                
                if result.returncode != 0:
                    logger.error(f"Whisper error (no VAD): {result.stderr}")
                    return jsonify({'error': f'Transcription failed: {result.stderr}'}), 500
                
                transcription_text = result.stdout.strip()
                vad_used = False
                
                # If no text output in stdout, try reading from generated txt file
                if not transcription_text:
                    txt_file = wav_path.replace('.wav', '.txt')
                    if os.path.exists(txt_file):
                        with open(txt_file, 'r', encoding='utf-8') as f:
                            transcription_text = f.read().strip()
                        try:
                            os.remove(txt_file)  # Clean up
                        except:
                            pass
            
            if not transcription_text:
                return jsonify({'error': 'No speech detected in audio. Try speaking more clearly or adjusting microphone settings.'}), 400
            
            logger.info(f"Transcription successful: {transcription_text[:100]}...")
            
            return jsonify({
                'text': transcription_text,
                'mode': mode,
                'vad_used': vad_used,
                'vad_params': {
                    'threshold': vad_threshold if vad_used else None,
                    'min_speech_duration': min_speech_duration,
                    'min_silence_duration': min_silence_duration,
                    'max_speech_duration': max_speech_duration,
                    'speech_pad': speech_pad
                }
            })
            
        finally:
            # Clean up temporary files
            for temp_file in [input_path, wav_path]:
                if os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                    except Exception as e:
                        logger.warning(f"Failed to remove temp file {temp_file}: {e}")
                        
    except Exception as e:
        logger.error(f"Error in audio transcription: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/text-to-speech', methods=['POST'])
def text_to_speech():
    """Convert text to speech using Kokoro TTS"""
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400
            
        text = data.get('text', '').strip()
        if not text:
            return jsonify({'error': 'Empty text provided'}), 400
            
        voice = data.get('voice', 'af_heart')
        speed = float(data.get('speed', 1.0))
        lang_code = data.get('lang_code', 'a')
        
        # Validate speed
        if not 0.5 <= speed <= 2.0:
            speed = 1.0
            
        # Generate audio
        audio_bytes = tts_service.text_to_speech(text, voice, speed, lang_code)
        
        # Return audio as base64
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        return jsonify({
            'audio': audio_b64,
            'voice': voice,
            'speed': speed,
            'sample_rate': tts_service.sample_rate,
            'text_length': len(text)
        })
        
    except Exception as e:
        logger.error(f"Error in TTS: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tts-voices', methods=['GET'])
def get_tts_voices():
    """Get available TTS voices"""
    try:
        voices = tts_service.get_available_voices()
        return jsonify({'voices': voices})
    except Exception as e:
        logger.error(f"Error getting TTS voices: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tts-stream', methods=['POST'])
def text_to_speech_stream():
    """Stream TTS audio with smart sentence-level chunking"""
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400
            
        text = data.get('text', '').strip()
        if not text:
            return jsonify({'error': 'Empty text provided'}), 400
            
        voice = data.get('voice', 'af_heart')
        speed = float(data.get('speed', 1.0))
        lang_code = data.get('lang_code', 'a')
        chunk_size = int(data.get('chunk_size', 1))  # Default to 1 sentence
        
        # Clean text for speech
        clean_text = clean_text_for_speech(text)
        
        # Create smart sentence-level chunks
        chunks = create_smart_chunks(clean_text, chunk_size)
        
        def generate_audio_stream():
            synthesis_times = []
            
            for i, chunk in enumerate(chunks):
                if not chunk.strip():
                    continue
                    
                try:
                    start_time = time.time()
                    audio_bytes = tts_service.text_to_speech(chunk, voice, speed, lang_code)
                    synthesis_time = (time.time() - start_time) * 1000  # Convert to ms
                    synthesis_times.append(synthesis_time)
                    
                    audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
                    
                    # Calculate adaptive chunk size suggestion
                    avg_synthesis_time = sum(synthesis_times) / len(synthesis_times)
                    suggested_chunk_size = chunk_size
                    
                    if avg_synthesis_time < 800 and chunk_size < 3:  # Fast synthesis, increase chunk size
                        suggested_chunk_size = min(chunk_size + 1, 3)
                    elif avg_synthesis_time > 2000 and chunk_size > 1:  # Slow synthesis, decrease chunk size
                        suggested_chunk_size = max(chunk_size - 1, 1)
                    
                    chunk_data = {
                        'index': i,
                        'text': chunk,
                        'audio': audio_b64,
                        'synthesis_time': synthesis_time,
                        'suggested_chunk_size': suggested_chunk_size,
                        'is_final': i == len(chunks) - 1,
                        'total_chunks': len(chunks)
                    }
                    
                    yield f"data: {json.dumps(chunk_data)}\n\n"
                    
                except Exception as e:
                    error_data = {
                        'error': str(e),
                        'index': i,
                        'text': chunk,
                        'synthesis_time': 0
                    }
                    yield f"data: {json.dumps(error_data)}\n\n"
                    
            yield f"data: {json.dumps({'done': True})}\n\n"
        
        return Response(generate_audio_stream(), content_type='text/event-stream')
        
    except Exception as e:
        logger.error(f"Error in TTS streaming: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ========== API ROUTES (BLUEPRINT) ==========

@api_routes.route('/models/anthropic', methods=['GET'])
def get_anthropic_models():
    """Proxy endpoint to fetch Anthropic models through the backend."""
    try:
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({'error': 'API key is required'}), 400

        # Call Anthropic API to get models
        response = requests.get(
            'https://api.anthropic.com/v1/models',
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            }
        )

        # Return the response from Anthropic
        if response.status_code != 200:
            return jsonify({
                'error': f'Anthropic API error: {response.status_code}',
                'message': response.text
            }), response.status_code

        return jsonify(response.json())
    
    except Exception as e:
        logger.error(f"Error fetching Anthropic models: {str(e)}")
        return jsonify({'error': str(e)}), 500


@api_routes.route('/chat/anthropic', methods=['POST'])
def chat_with_anthropic():
    """Non-streaming endpoint for Anthropic chat."""
    try:
        data = request.json
        api_key = request.headers.get('X-API-Key')
        
        if not api_key:
            return jsonify({'error': 'API key is required'}), 400
        
        # Required parameters
        model = data.get('model')
        messages = data.get('messages')
        system = data.get('system', '')
        max_tokens = data.get('max_tokens', 1024)
        
        # Optional parameters
        temperature = data.get('temperature', 0.7)
        top_p = data.get('top_p', 0.95)
        top_k = data.get('top_k', 40)
        
        if not model or not messages:
            return jsonify({'error': 'Model and messages are required'}), 400
        
        # Call Anthropic API
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            json={
                'model': model,
                'messages': messages,
                'system': system,
                'max_tokens': max_tokens,
                'temperature': temperature,
                'top_p': top_p
            }
        )
        
        # Return the response from Anthropic
        if response.status_code != 200:
            return jsonify({
                'error': f'Anthropic API error: {response.status_code}',
                'message': response.text
            }), response.status_code
        
        return jsonify(response.json())
    
    except Exception as e:
        logger.error(f"Error in Anthropic chat: {str(e)}")
        return jsonify({'error': str(e)}), 500


@api_routes.route('/chat/anthropic/stream', methods=['POST'])
def stream_chat_with_anthropic():
    """Streaming endpoint for Anthropic chat."""
    @stream_with_context
    def generate():
        try:
            data = request.json
            api_key = request.headers.get('X-API-Key')
            
            if not api_key:
                yield f"data: {json.dumps({'error': 'API key is required'})}\n\n"
                return

            # Required parameters
            model = data.get('model')
            messages = data.get('messages')
            system = data.get('system', '')
            max_tokens = data.get('max_tokens', 1024)
            
            # Optional parameters
            temperature = data.get('temperature', 0.7)
            top_p = data.get('top_p', 0.95)
            top_k = data.get('top_k', 40)
            
            if not model or not messages:
                yield f"data: {json.dumps({'error': 'Model and messages are required'})}\n\n"
                return
            
            # Call Anthropic API with streaming
            response = requests.post(
                'https://api.anthropic.com/v1/messages',
                headers={
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                json={
                    'model': model,
                    'messages': messages,
                    'system': system,
                    'max_tokens': max_tokens,
                    'temperature': temperature,
                    'top_p': top_p,
                    'stream': True
                },
                stream=True
            )
            
            if response.status_code != 200:
                error_message = response.text
                yield f"data: {json.dumps({'error': f'Anthropic API error: {response.status_code}', 'message': error_message})}\n\n"
                return
            
            # Process and forward the streamed response
            client = sseclient.SSEClient(response)
            for event in client.events():
                yield f"{event.data}\n\n"
                
        except Exception as e:
            logger.error(f"Error in Anthropic streaming chat: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return Response(generate(), content_type='text/event-stream')


@api_routes.route('/models/openrouter', methods=['GET'])
def get_openrouter_models():
    """Proxy endpoint to fetch OpenRouter models through the backend."""
    try:
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({'error': 'API key is required'}), 400

        # Call OpenRouter API to get models
        response = requests.get(
            'https://openrouter.ai/api/v1/models',
            headers={
                'Authorization': f'Bearer {api_key}',
                'HTTP-Referer': request.headers.get('Origin', 'http://localhost:3000'),
                'X-Title': 'Tangent Chat',
                'Content-Type': 'application/json'
            }
        )

        # Return the response from OpenRouter
        if response.status_code != 200:
            return jsonify({
                'error': f'OpenRouter API error: {response.status_code}',
                'message': response.text
            }), response.status_code

        return jsonify(response.json())
    
    except Exception as e:
        logger.error(f"Error fetching OpenRouter models: {str(e)}")
        return jsonify({'error': str(e)}), 500


@api_routes.route('/models/google', methods=['GET'])
def get_google_models():
    """Proxy endpoint to fetch Google Gemini models through the backend."""
    try:
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({'error': 'API key is required'}), 400

        # Call Google API to get models
        response = requests.get(
            f'https://generativelanguage.googleapis.com/v1beta/models?key={api_key}'
        )

        # Return the response from Google
        if response.status_code != 200:
            return jsonify({
                'error': f'Google API error: {response.status_code}',
                'message': response.text
            }), response.status_code

        return jsonify(response.json())
    
    except Exception as e:
        logger.error(f"Error fetching Google models: {str(e)}")
        return jsonify({'error': str(e)}), 500


@api_routes.route('/chat/openrouter', methods=['POST'])
def chat_with_openrouter():
    """Non-streaming endpoint for OpenRouter chat."""
    try:
        data = request.json
        api_key = request.headers.get('X-API-Key')
        
        if not api_key:
            return jsonify({'error': 'API key is required'}), 400
        
        # Required parameters
        model = data.get('model')
        messages = data.get('messages')
        max_tokens = data.get('max_tokens', 1024)
        
        # Optional parameters
        temperature = data.get('temperature', 0.7)
        top_p = data.get('top_p', 0.95)
        top_k = data.get('top_k', 40)
        
        if not model or not messages:
            return jsonify({'error': 'Model and messages are required'}), 400
        
        # Call OpenRouter API
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'HTTP-Referer': request.headers.get('Origin', 'http://localhost:3000'),
                'X-Title': 'Tangent Chat',
                'Content-Type': 'application/json'
            },
            json={
                'model': model,
                'messages': messages,
                'max_tokens': max_tokens,
                'temperature': temperature,
                'top_p': top_p,
                'top_k': top_k
            }
        )
        
        # Return the response from OpenRouter
        if response.status_code != 200:
            return jsonify({
                'error': f'OpenRouter API error: {response.status_code}',
                'message': response.text
            }), response.status_code
        
        return jsonify(response.json())
    
    except Exception as e:
        logger.error(f"Error in OpenRouter chat: {str(e)}")
        return jsonify({'error': str(e)}), 500


@api_routes.route('/chat/openrouter/stream', methods=['POST'])
def stream_chat_with_openrouter():
    """Streaming endpoint for OpenRouter chat."""
    @stream_with_context
    def generate():
        try:
            data = request.json
            api_key = request.headers.get('X-API-Key')
            
            if not api_key:
                yield f"data: {json.dumps({'error': 'API key is required'})}\n\n"
                return

            # Required parameters
            model = data.get('model')
            messages = data.get('messages')
            max_tokens = data.get('max_tokens', 1024)
            
            # Optional parameters
            temperature = data.get('temperature', 0.7)
            top_p = data.get('top_p', 0.95)
            top_k = data.get('top_k', 40)
            
            if not model or not messages:
                yield f"data: {json.dumps({'error': 'Model and messages are required'})}\n\n"
                return
            
            # Call OpenRouter API with streaming
            response = requests.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'HTTP-Referer': request.headers.get('Origin', 'http://localhost:3000'),
                    'X-Title': 'Tangent Chat',
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                json={
                    'model': model,
                    'messages': messages,
                    'max_tokens': max_tokens,
                    'temperature': temperature,
                    'top_p': top_p,
                    'top_k': top_k,
                    'stream': True
                },
                stream=True
            )
            
            if response.status_code != 200:
                error_message = response.text
                yield f"data: {json.dumps({'error': f'OpenRouter API error: {response.status_code}', 'message': error_message})}\n\n"
                return
            
            # Forward the streamed response
            for chunk in response.iter_lines():
                if chunk:
                    yield f"{chunk.decode('utf-8')}\n\n"
                
        except Exception as e:
            logger.error(f"Error in OpenRouter streaming chat: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return Response(generate(), content_type='text/event-stream')


@api_routes.route('/chat/google', methods=['POST'])
def chat_with_google():
    """Non-streaming endpoint for Google Gemini chat."""
    try:
        data = request.json
        api_key = request.headers.get('X-API-Key')
        
        if not api_key:
            return jsonify({'error': 'API key is required'}), 400
        
        # Required parameters
        model = data.get('model')
        contents = data.get('contents')
        
        if not model or not contents:
            return jsonify({'error': 'Model and contents are required'}), 400
        
        # Get generation config
        generation_config = data.get('generationConfig', {})
        
        # Call Google API
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/{model}:generateContent?key={api_key}"
        
        payload = {
            'contents': contents,
            'generationConfig': generation_config
        }
        
        if 'safetySettings' in data:
            payload['safetySettings'] = data['safetySettings']
        
        response = requests.post(
            endpoint,
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        
        # Return the response from Google
        if response.status_code != 200:
            return jsonify({
                'error': f'Google API error: {response.status_code}',
                'message': response.text
            }), response.status_code
        
        return jsonify(response.json())
    
    except Exception as e:
        logger.error(f"Error in Google Gemini chat: {str(e)}")
        return jsonify({'error': str(e)}), 500


@api_routes.route('/chat/google/stream', methods=['POST'])
def stream_chat_with_google():
    """Streaming endpoint for Google Gemini chat."""
    @stream_with_context
    def generate():
        try:
            data = request.json
            api_key = request.headers.get('X-API-Key')
            
            if not api_key:
                yield f"data: {json.dumps({'error': 'API key is required'})}\n\n"
                return

            # Required parameters
            model = data.get('model')
            contents = data.get('contents')
            
            if not model or not contents:
                yield f"data: {json.dumps({'error': 'Model and contents are required'})}\n\n"
                return
            
            # Get generation config
            generation_config = data.get('generationConfig', {})
            
            # Call Google API with streaming
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/{model}:streamGenerateContent?key={api_key}"
            
            payload = {
                'contents': contents,
                'generationConfig': generation_config
            }
            
            if 'safetySettings' in data:
                payload['safetySettings'] = data['safetySettings']
            
            response = requests.post(
                endpoint,
                json=payload,
                headers={'Content-Type': 'application/json'},
                stream=True
            )
            
            if response.status_code != 200:
                error_message = response.text
                yield f"data: {json.dumps({'error': f'Google API error: {response.status_code}', 'message': error_message})}\n\n"
                return
            
            # Process and forward the streamed response
            for chunk in response.iter_lines():
                if chunk:
                    yield f"data: {chunk.decode('utf-8')}\n\n"
                
        except Exception as e:
            logger.error(f"Error in Google Gemini streaming chat: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return Response(generate(), content_type='text/event-stream')

@app.route('/api/analyze-dependencies', methods=['POST', 'OPTIONS'])
def analyze_dependencies():
    """
    Analyze project dependencies with enhanced capabilities matching JavaScript version
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'message': 'OK'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
        
    try:
        # Get project root from request or use parent directory
        data = {}
        if request.content_type and 'application/json' in request.content_type:
            try:
                data = request.get_json() or {}
            except Exception as json_error:
                logger.warning(f"Failed to parse JSON request body: {json_error}")
                data = {}
        
        # Default to parent directory (where the actual project is)
        # Since the Flask app runs from tangent-api but project is in parent dir
        project_root = data.get('projectRoot', '..')
        
        # Resolve the path and ensure it exists
        resolved_path = Path(project_root).resolve()
        
        # Check if tangent-ui exists in the resolved path
        tangent_ui_path = resolved_path / 'tangent-ui'
        if not tangent_ui_path.exists():
            # Try current directory as fallback
            current_dir = Path('.').resolve()
            tangent_ui_current = current_dir / 'tangent-ui'
            if tangent_ui_current.exists():
                project_root = '.'
            else:
                logger.warning(f"tangent-ui not found in {resolved_path} or {current_dir}")
        
        logger.info(f"Using project root: {Path(project_root).resolve()}")
        
        # Use the enhanced analyzer instead of the original
        analyzer = TangentDependencyAnalyzer(project_root)
        
        # Perform analysis
        result = analyzer.analyze()
        
        logger.info(f"Enhanced dependency analysis completed: {result['stats']['totalFiles']} files, "
                   f"{result['stats']['totalDependencies']} dependencies")
        
        return jsonify(result)
        
    except FileNotFoundError:
        return jsonify({
            'error': 'Project directory not found',
            'message': 'The specified project directory does not exist'
        }), 404
        
    except PermissionError:
        return jsonify({
            'error': 'Permission denied',
            'message': 'Cannot access the project directory'
        }), 403
        
    except Exception as e:
        logger.error(f"Error in enhanced dependency analysis: {str(e)}")
        return jsonify({
            'error': 'Analysis failed',
            'message': str(e)
        }), 500

@app.route('/api/dependency-status', methods=['GET'])
def get_dependency_status():
    """
    Get the current status of dependency analysis (cached vs fresh)
    """
    try:
        analyzer = TangentDependencyAnalyzer('.')
        current_checksum = analyzer.get_project_checksum()
        
        cache_exists = analyzer.cache_file.exists()
        cache_valid = False
        cache_timestamp = None
        
        if cache_exists:
            try:
                with open(analyzer.cache_file, 'r') as f:
                    cache_data = json.load(f)
                    cache_valid = cache_data.get('checksum') == current_checksum
                    cache_timestamp = cache_data.get('timestamp')
            except (json.JSONDecodeError, OSError):
                pass
        
        return jsonify({
            'cacheExists': cache_exists,
            'cacheValid': cache_valid,
            'cacheTimestamp': cache_timestamp,
            'currentChecksum': current_checksum,
            'needsRefresh': not cache_valid
        })
        
    except Exception as e:
        logger.error(f"Error getting dependency status: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

# ========== OLLAMA MODEL ENDPOINTS ==========

@app.route('/api/ollama/models', methods=['GET'])
def get_ollama_models():
    """Get list of available Ollama models with vision capabilities"""
    try:
        response = requests.get('http://localhost:11434/api/tags')
        if response.status_code != 200:
            return jsonify({'error': 'Failed to connect to Ollama'}), 500
            
        data = response.json()
        models = data.get('models', [])
        
        # Filter and enhance models with capabilities
        enhanced_models = []
        for model in models:
            # Check if model has vision capabilities
            has_vision = (
                'vision' in model['name'].lower() or
                'llava' in model['name'].lower() or
                'moondream' in model['name'].lower() or
                'qwen' in model['name'].lower() or
                'granite' in model['name'].lower() or
                'gemma' in model['name'].lower()
            )
            
            if has_vision:
                # Add capabilities info
                capabilities = ['completion']
                if has_vision:
                    capabilities.append('vision')
                
                model['capabilities'] = capabilities
                enhanced_models.append(model)
        
        return jsonify({
            'models': enhanced_models,
            'total': len(enhanced_models),
            'timestamp': time.time()
        })
        
    except requests.RequestException as e:
        logger.error(f"Error connecting to Ollama: {str(e)}")
        return jsonify({'error': 'Ollama service unavailable'}), 503
    except Exception as e:
        logger.error(f"Error fetching Ollama models: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ollama/model-details', methods=['POST'])
def get_ollama_model_details():
    """Get detailed information about a specific Ollama model"""
    try:
        data = request.json
        model_name = data.get('model')
        
        if not model_name:
            return jsonify({'error': 'Model name is required'}), 400
            
        # Get detailed model information
        response = requests.post(
            'http://localhost:11434/api/show',
            json={'model': model_name, 'verbose': False}
        )
        
        if response.status_code != 200:
            return jsonify({'error': f'Failed to get model details for {model_name}'}), 500
            
        model_details = response.json()
        
        # Add capabilities based on model info
        capabilities = ['completion']
        if (model_details.get('capabilities') and 'vision' in model_details['capabilities']) or \
           'vision' in model_name.lower() or \
           any(name in model_name.lower() for name in ['llava', 'moondream', 'qwen', 'granite']):
            capabilities.append('vision')
            
        model_details['capabilities'] = capabilities
        
        return jsonify(model_details)
        
    except requests.RequestException as e:
        logger.error(f"Error connecting to Ollama: {str(e)}")
        return jsonify({'error': 'Ollama service unavailable'}), 503
    except Exception as e:
        logger.error(f"Error fetching model details: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ollama/test-model', methods=['POST'])
def test_ollama_model():
    """Test a vision model with a simple prompt"""
    try:
        data = request.json
        model_name = data.get('model')
        test_type = data.get('test_type', 'simple')
        
        if not model_name:
            return jsonify({'error': 'Model name is required'}), 400
            
        # Simple text completion test
        if test_type == 'simple':
            response = requests.post(
                'http://localhost:11434/api/generate',
                json={
                    'model': model_name,
                    'prompt': 'Hello, can you introduce yourself briefly?',
                    'stream': False
                }
            )
            
            if response.status_code != 200:
                return jsonify({'error': 'Model test failed'}), 500
                
            result = response.json()
            
            return jsonify({
                'success': True,
                'response': result.get('response', ''),
                'eval_count': result.get('eval_count'),
                'eval_duration': result.get('eval_duration'),
                'test_type': test_type
            })
            
        # Vision test would require an image
        elif test_type == 'vision':
            return jsonify({'error': 'Vision test requires image upload'}), 400
            
        else:
            return jsonify({'error': 'Invalid test type'}), 400
            
    except requests.RequestException as e:
        logger.error(f"Error testing model: {str(e)}")
        return jsonify({'error': 'Ollama service unavailable'}), 503
    except Exception as e:
        logger.error(f"Error in model test: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ollama/status', methods=['GET'])
def get_ollama_status():
    """Check if Ollama service is running and get version info"""
    try:
        # Try to connect to Ollama
        response = requests.get('http://localhost:11434/api/version', timeout=5)
        
        if response.status_code == 200:
            version_info = response.json()
            
            # Get list of models to check if any are loaded
            models_response = requests.get('http://localhost:11434/api/tags')
            model_count = 0
            if models_response.status_code == 200:
                models_data = models_response.json()
                model_count = len(models_data.get('models', []))
            
            return jsonify({
                'status': 'running',
                'version': version_info.get('version', 'unknown'),
                'model_count': model_count,
                'timestamp': time.time()
            })
        else:
            return jsonify({
                'status': 'error',
                'error': 'Unexpected response from Ollama'
            }), 500
            
    except requests.RequestException:
        return jsonify({
            'status': 'offline',
            'error': 'Ollama service is not running or not accessible'
        }), 503
    except Exception as e:
        logger.error(f"Error checking Ollama status: {str(e)}")
        return jsonify({
            'status': 'error', 
            'error': str(e)
        }), 500

# ========== OLLAMA MANAGER PROXY ENDPOINTS ==========

@app.route('/api/ollama-proxy/health', methods=['GET'])
def ollama_proxy_health():
    """Proxy health check to Ollama Manager"""
    try:
        response = requests.get('http://localhost:11434/health', timeout=5)
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        return jsonify({'error': 'Ollama Manager proxy unavailable', 'details': str(e)}), 503

@app.route('/api/ollama-proxy/tags', methods=['GET'])
def ollama_proxy_tags():
    """Proxy tags endpoint to Ollama Manager"""
    try:
        response = requests.get('http://localhost:11434/api/tags', timeout=30)
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        return jsonify({'error': 'Failed to fetch models from Ollama Manager', 'details': str(e)}), 503

@app.route('/api/ollama-proxy/chat', methods=['POST'])
def ollama_proxy_chat():
    """Proxy chat endpoint to Ollama Manager"""
    try:
        response = requests.post(
            'http://localhost:11434/api/chat',
            json=request.json,
            headers={'Content-Type': 'application/json'},
            timeout=120
        )
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        return jsonify({'error': 'Failed to chat with Ollama Manager', 'details': str(e)}), 503

@app.route('/api/ollama-proxy/generate', methods=['POST'])
def ollama_proxy_generate():
    """Proxy generate endpoint to Ollama Manager"""
    try:
        response = requests.post(
            'http://localhost:11434/api/generate',
            json=request.json,
            headers={'Content-Type': 'application/json'},
            timeout=120
        )
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        return jsonify({'error': 'Failed to generate with Ollama Manager', 'details': str(e)}), 503

@app.route('/api/ollama-proxy/pull', methods=['POST'])
def ollama_proxy_pull():
    """Proxy pull endpoint to Ollama Manager (streaming)"""
    try:
        response = requests.post(
            'http://localhost:11434/api/pull',
            json=request.json,
            headers={'Content-Type': 'application/json'},
            stream=True,
            timeout=600  # 10 minutes for model pulls
        )
        
        def generate():
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    yield chunk
        
        return Response(generate(), mimetype='text/event-stream')
    except requests.RequestException as e:
        return jsonify({'error': 'Failed to pull model from Ollama Manager', 'details': str(e)}), 503

@app.route('/api/ollama-proxy/delete', methods=['DELETE'])
def ollama_proxy_delete():
    """Proxy delete endpoint to Ollama Manager"""
    try:
        response = requests.delete(
            'http://localhost:11434/api/delete',
            json=request.json,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        return jsonify({'error': 'Failed to delete model from Ollama Manager', 'details': str(e)}), 503

@app.route('/api/ollama-proxy/models/<model_name>/metadata', methods=['GET', 'PUT', 'DELETE'])
def ollama_proxy_metadata(model_name):
    """Proxy model metadata endpoints to Ollama Manager"""
    try:
        if request.method == 'GET':
            response = requests.get(f'http://localhost:11434/api/models/{model_name}/metadata', timeout=10)
        elif request.method == 'PUT':
            response = requests.put(
                f'http://localhost:11434/api/models/{model_name}/metadata',
                json=request.json,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
        elif request.method == 'DELETE':
            response = requests.delete(f'http://localhost:11434/api/models/{model_name}/metadata', timeout=10)
        
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        return jsonify({'error': 'Failed to access model metadata from Ollama Manager', 'details': str(e)}), 503


# Initialize the services
chat_service = ChatPersistenceService(app)
embedding_service = EmbeddingService()
clustering_service = ClusteringService(embedding_service, chat_service)
node_clustering_service = NodeClusteringService(embedding_service, chat_service)
search_service = SearchService(chat_service, embedding_service)
import_service = ConversationImportService(chat_service, embedding_service)
tool_call_service = ToolCallService(app)
claude_code_service = ClaudeCodeService(app, tool_call_service)
reflection_service = ReflectionService()
router_agent_service = RouterAgentService()
agent_config_service = AgentConfigService()
mock_data_service = MockDataService(chat_service)
config_service = CanvasConfigService()

# Global variable to store config change events for SSE
config_change_events = []
config_change_lock = threading.Lock()

def on_config_changed(config_data):
    """Callback for when config file changes"""
    with config_change_lock:
        config_change_events.append({
            'timestamp': time.time(),
            'config': config_data,
            'event': 'config_updated'
        })
        # Keep only last 10 events
        if len(config_change_events) > 10:
            config_change_events.pop(0)

# Initialize file watcher
config_watcher = ConfigFileWatcher(config_service.config_path, on_config_changed)
config_watcher.start_watching()

# Canvas Configuration endpoints
@api_routes.route('/config', methods=['GET'])
def get_canvas_config():
    """Get complete canvas configuration"""
    try:
        config = config_service.load_config()
        return jsonify({
            'success': True,
            'config': config,
            'last_modified': config_service._last_modified
        })
    except Exception as e:
        logger.error(f"Error getting canvas config: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_routes.route('/config', methods=['PUT'])
def update_canvas_config():
    """Update complete canvas configuration"""
    try:
        config_data = request.get_json()
        if not config_data:
            return jsonify({'success': False, 'error': 'No configuration data provided'}), 400
        
        success = config_service.save_config(config_data)
        if success:
            return jsonify({
                'success': True,
                'message': 'Configuration updated successfully',
                'config': config_data
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to save configuration'}), 500
    except Exception as e:
        logger.error(f"Error updating canvas config: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_routes.route('/config/<section>', methods=['GET'])
def get_config_section(section):
    """Get specific configuration section"""
    try:
        section_data = config_service.get_section(section)
        if section_data is None:
            return jsonify({'success': False, 'error': f'Section "{section}" not found'}), 404
        
        return jsonify({
            'success': True,
            'section': section,
            'data': section_data
        })
    except Exception as e:
        logger.error(f"Error getting config section {section}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_routes.route('/config/<section>', methods=['PUT'])
def update_config_section(section):
    """Update specific configuration section"""
    try:
        section_data = request.get_json()
        if not section_data:
            return jsonify({'success': False, 'error': 'No section data provided'}), 400
        
        success = config_service.update_section(section, section_data)
        if success:
            return jsonify({
                'success': True,
                'message': f'Section "{section}" updated successfully',
                'section': section,
                'data': section_data
            })
        else:
            return jsonify({'success': False, 'error': f'Failed to update section "{section}"'}), 500
    except Exception as e:
        logger.error(f"Error updating config section {section}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_routes.route('/config/positioning', methods=['GET'])
def get_positioning_values():
    """Get all positioning values for migration purposes"""
    try:
        positioning = config_service.get_positioning_values()
        return jsonify({
            'success': True,
            'positioning': positioning
        })
    except Exception as e:
        logger.error(f"Error getting positioning values: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_routes.route('/config/reload', methods=['POST'])
def reload_config():
    """Force reload configuration from file"""
    try:
        config = config_service.load_config()
        return jsonify({
            'success': True,
            'message': 'Configuration reloaded successfully',
            'config': config,
            'last_modified': config_service._last_modified
        })
    except Exception as e:
        logger.error(f"Error reloading config: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_routes.route('/config/validate', methods=['POST'])
def validate_config():
    """Validate configuration data without saving"""
    try:
        config_data = request.get_json()
        if not config_data:
            return jsonify({'success': False, 'error': 'No configuration data provided'}), 400
        
        # Use the internal validation method
        config_service._validate_config(config_data)
        return jsonify({
            'success': True,
            'message': 'Configuration is valid',
            'valid': True
        })
    except Exception as e:
        logger.error(f"Config validation error: {e}")
        return jsonify({'success': False, 'error': str(e), 'valid': False}), 400

@api_routes.route('/config/export', methods=['GET'])
def export_config():
    """Export configuration as JSON"""
    try:
        json_config = config_service.export_to_json()
        return Response(
            json_config,
            mimetype='application/json',
            headers={
                'Content-Disposition': 'attachment; filename=tangent-config.json'
            }
        )
    except Exception as e:
        logger.error(f"Error exporting config: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_routes.route('/config/import', methods=['POST'])
def import_config():
    """Import configuration from JSON"""
    try:
        if 'file' in request.files:
            # Handle file upload
            file = request.files['file']
            json_string = file.read().decode('utf-8')
        elif request.json:
            # Handle JSON body
            json_string = json.dumps(request.json)
        else:
            return jsonify({'success': False, 'error': 'No configuration data provided'}), 400
        
        success = config_service.import_from_json(json_string)
        if success:
            return jsonify({
                'success': True,
                'message': 'Configuration imported successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to import configuration'}), 500
    except Exception as e:
        logger.error(f"Error importing config: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_routes.route('/config/stream', methods=['GET'])
def stream_config_changes():
    """Server-Sent Events endpoint for real-time config changes"""
    def generate():
        yield "data: {\"event\": \"connected\", \"message\": \"Config stream connected\"}\n\n"
        
        last_event_time = 0
        while True:
            try:
                with config_change_lock:
                    # Send any new events
                    for event in config_change_events:
                        if event['timestamp'] > last_event_time:
                            yield f"data: {json.dumps(event)}\n\n"
                            last_event_time = event['timestamp']
                
                # Check if config service detected file changes
                if config_service.reload_if_modified():
                    config_data = config_service.config_data
                    event = {
                        'timestamp': time.time(),
                        'config': config_data,
                        'event': 'config_reloaded'
                    }
                    yield f"data: {json.dumps(event)}\n\n"
                
                time.sleep(1)  # Check every second
                
            except GeneratorExit:
                break
            except Exception as e:
                logger.error(f"Error in config stream: {e}")
                yield f"data: {{\"event\": \"error\", \"error\": \"{str(e)}\"}}\n\n"
                break
    
    return Response(stream_with_context(generate()), 
                   mimetype='text/event-stream',
                   headers={
                       'Cache-Control': 'no-cache',
                       'Connection': 'keep-alive',
                       'Access-Control-Allow-Origin': '*'
                   })

# Clustering endpoints
@api_routes.route('/clustering/start', methods=['POST'])
def start_clustering():
    """
    Start workspace clustering in the background
    """
    try:
        data = request.get_json() or {}
        method = data.get('method', 'kmeans')
        
        # Validate clustering method
        if method not in ['kmeans', 'dbscan']:
            return jsonify({'error': 'Invalid clustering method. Use "kmeans" or "dbscan"'}), 400
        
        # Check if clustering is already running
        status = clustering_service.get_clustering_status()
        if status['is_running']:
            return jsonify({'error': 'Clustering is already in progress'}), 409
        
        # Extract all clustering parameters
        kwargs = {}
        
        # Auto-optimization parameters
        auto_optimize = data.get('autoOptimize', False)
        if auto_optimize:
            kwargs['auto_optimize'] = True
            kwargs['min_clusters'] = data.get('minClusters', 3)
            kwargs['max_clusters'] = data.get('maxClusters', 15)
            kwargs['quality_target'] = data.get('qualityTarget', 'balanced')
        
        # Algorithm-specific parameters
        if method == 'kmeans':
            if 'n_clusters' in data:
                kwargs['n_clusters'] = data['n_clusters']
        elif method == 'dbscan':
            if 'eps' in data:
                kwargs['eps'] = data['eps']
            if 'min_samples' in data:
                kwargs['min_samples'] = data['min_samples']
            kwargs['include_outliers'] = data.get('includeOutliers', True)
        
        clustering_service.start_clustering_background(method=method, **kwargs)
        
        return jsonify({
            'message': 'Clustering started successfully',
            'method': method,
            'parameters': kwargs
        })
        
    except Exception as e:
        logger.error(f"Error starting clustering: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/clustering/status', methods=['GET'])
def get_clustering_status():
    """
    Get the current clustering status and progress
    """
    try:
        status = clustering_service.get_clustering_status()
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error getting clustering status: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/clustering/results', methods=['GET'])
def get_clustering_results():
    """
    Get the latest clustering results
    """
    try:
        status = clustering_service.get_clustering_status()
        return jsonify({
            'clusters': status['clusters'],
            'is_complete': not status['is_running'] and status['progress'] >= 1.0,
            'message': status['status_message']
        })
    except Exception as e:
        logger.error(f"Error getting clustering results: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/clustering/multi-resolution', methods=['POST'])
def generate_multi_resolution_clusters():
    """
    Generate clusters at multiple resolutions for slider interface
    """
    try:
        data = request.get_json() or {}
        min_clusters = data.get('minClusters', 2)
        max_clusters = data.get('maxClusters', 50)
        method = data.get('method', 'kmeans')
        
        # Validate parameters
        if min_clusters < 2 or max_clusters > 100 or min_clusters >= max_clusters:
            return jsonify({'error': 'Invalid cluster range. Min should be >= 2, Max <= 100, and Min < Max'}), 400
        
        if method not in ['kmeans', 'dbscan']:
            return jsonify({'error': 'Invalid clustering method. Use "kmeans" or "dbscan"'}), 400
        
        # Check if clustering is already running
        status = clustering_service.get_clustering_status()
        if status['is_running']:
            return jsonify({'error': 'Clustering is already in progress'}), 409
        
        # Start multi-resolution clustering in background
        from threading import Thread
        
        def generate_multi_resolution():
            try:
                clustering_service.clustering_status['is_running'] = True
                clustering_service.clustering_status['status_message'] = 'Generating multi-resolution clusters...'
                
                cluster_range = (min_clusters, max_clusters)
                results = clustering_service.generate_multi_resolution_clusters(cluster_range, method)
                
                clustering_service.clustering_status['is_running'] = False
                clustering_service.clustering_status['status_message'] = f'Generated {len(results)} cluster resolutions'
                
            except Exception as e:
                clustering_service.clustering_status['is_running'] = False
                clustering_service.clustering_status['status_message'] = f'Error: {str(e)}'
                logger.error(f"Error in multi-resolution clustering: {e}")
        
        thread = Thread(target=generate_multi_resolution)
        thread.start()
        
        return jsonify({
            'message': 'Multi-resolution clustering started',
            'min_clusters': min_clusters,
            'max_clusters': max_clusters,
            'method': method
        })
        
    except Exception as e:
        logger.error(f"Error starting multi-resolution clustering: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/clustering/resolution/<int:n_clusters>', methods=['GET'])
def get_clusters_at_resolution(n_clusters):
    """
    Get clusters at a specific resolution
    """
    try:
        method = request.args.get('method', 'kmeans')
        
        if method not in ['kmeans', 'dbscan']:
            return jsonify({'error': 'Invalid clustering method. Use "kmeans" or "dbscan"'}), 400
        
        if n_clusters < 2 or n_clusters > 100:
            return jsonify({'error': 'Cluster count must be between 2 and 100'}), 400
        
        # Get clusters at the specified resolution
        result = clustering_service.get_clusters_at_resolution(n_clusters, method)
        
        if result is None:
            return jsonify({'error': 'Failed to generate clusters at specified resolution'}), 500
        
        return jsonify({
            'clusters': result['clusters'],
            'cluster_count': n_clusters,
            'actual_clusters': result['actual_clusters'],
            'quality_score': result['quality_score'],
            'method': result['method'],
            'timestamp': result['timestamp'].isoformat(),
            'version': result['version']
        })
        
    except Exception as e:
        logger.error(f"Error getting clusters at resolution {n_clusters}: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/clustering/cache/status', methods=['GET'])
def get_cache_status():
    """
    Get current cache status and staleness information
    """
    try:
        status = clustering_service.get_cache_status()
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error getting cache status: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/clustering/cache/invalidate', methods=['POST'])
def invalidate_cache():
    """
    Manually invalidate the cluster cache
    """
    try:
        clustering_service._invalidate_cache()
        clustering_service.cache_version += 1
        return jsonify({'message': 'Cache invalidated successfully', 'new_version': clustering_service.cache_version})
    except Exception as e:
        logger.error(f"Error invalidating cache: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/clustering/stop', methods=['POST'])
def stop_clustering():
    """
    Stop the clustering process
    """
    try:
        clustering_service.stop_clustering()
        return jsonify({'message': 'Clustering stop requested'})
    except Exception as e:
        logger.error(f"Error stopping clustering: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/workspace-clusters', methods=['GET'])
def get_workspace_clusters():
    """
    Get semantic clusters of workspaces for topic-based canvas layout
    Optimized for ultra-low zoom levels (1-5%)
    """
    try:
        # Get query parameters
        method = request.args.get('method', 'kmeans')
        n_clusters = request.args.get('clusters', type=int)
        auto_optimize = request.args.get('auto_optimize', 'false').lower() == 'true'
        include_positions = request.args.get('include_positions', 'false').lower() == 'true'
        
        # Validate method
        if method not in ['kmeans', 'dbscan']:
            return jsonify({'error': 'Invalid method. Use "kmeans" or "dbscan"'}), 400
        
        # Check if we have cached results
        cached_clusters = clustering_service.cached_clusters
        if cached_clusters and clustering_service.cache_timestamp:
            # Use cached results if they're recent (within 5 minutes)
            cache_age = (datetime.now() - clustering_service.cache_timestamp).total_seconds()
            if cache_age < 300:  # 5 minutes
                logger.info(f"Using cached workspace clusters (age: {cache_age:.1f}s)")
                clusters = cached_clusters
            else:
                # Cache is stale, regenerate
                clusters = clustering_service.cluster_workspaces(
                    method=method,
                    n_clusters=n_clusters,
                    auto_optimize=auto_optimize
                )
        else:
            # No cache, generate fresh clusters
            clusters = clustering_service.cluster_workspaces(
                method=method,
                n_clusters=n_clusters,
                auto_optimize=auto_optimize
            )
        
        if not clusters:
            return jsonify({
                'success': False,
                'clusters': [],
                'totalWorkspaces': 0,
                'message': 'No clusters generated - check if workspaces exist'
            })
        
        # Calculate topic islands layout positions if requested
        if include_positions:
            clusters = calculate_topic_island_positions(clusters)
        
        # Calculate summary statistics
        total_workspaces = sum(cluster['size'] for cluster in clusters)
        cluster_stats = {
            'total_clusters': len(clusters),
            'total_workspaces': total_workspaces,
            'avg_cluster_size': total_workspaces / len(clusters) if clusters else 0,
            'largest_cluster': max(cluster['size'] for cluster in clusters) if clusters else 0,
            'smallest_cluster': min(cluster['size'] for cluster in clusters) if clusters else 0
        }
        
        return jsonify({
            'success': True,
            'clusters': clusters,
            'stats': cluster_stats,
            'method': method,
            'cached': cached_clusters is not None,
            'generated_at': clustering_service.cache_timestamp.isoformat() if clustering_service.cache_timestamp else None
        })
        
    except Exception as e:
        logger.error(f"Error getting workspace clusters: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def calculate_topic_island_positions(clusters):
    """
    Calculate optimal positions for topic islands to prevent overlap
    Uses a grid-based layout with dynamic spacing
    """
    if not clusters:
        return clusters
    
    import math
    
    # Calculate grid dimensions
    num_clusters = len(clusters)
    grid_cols = max(1, int(math.ceil(math.sqrt(num_clusters))))
    grid_rows = max(1, int(math.ceil(num_clusters / grid_cols)))
    
    # Base spacing - larger for topic islands
    ISLAND_HORIZONTAL_SPACING = 2000  # Space between topic islands
    ISLAND_VERTICAL_SPACING = 1500
    ISLAND_START_X = 100
    ISLAND_START_Y = 100
    
    # Sort clusters by size (largest first) for better visual hierarchy
    sorted_clusters = sorted(clusters, key=lambda c: c['size'], reverse=True)
    
    for i, cluster in enumerate(sorted_clusters):
        row = i // grid_cols
        col = i % grid_cols
        
        # Calculate island center position
        center_x = ISLAND_START_X + col * ISLAND_HORIZONTAL_SPACING
        center_y = ISLAND_START_Y + row * ISLAND_VERTICAL_SPACING
        
        # Add position data to cluster
        cluster['island'] = {
            'center_x': center_x,
            'center_y': center_y,
            'grid_row': row,
            'grid_col': col
        }
        
        # Calculate workspace positions within the island
        workspace_positions = calculate_island_workspace_positions(
            cluster['workspaces'], center_x, center_y
        )
        
        # Add positions to each workspace
        for j, workspace in enumerate(cluster['workspaces']):
            if j < len(workspace_positions):
                workspace['island_position'] = workspace_positions[j]
    
    return sorted_clusters

def calculate_island_workspace_positions(workspaces, center_x, center_y):
    """
    Calculate positions for workspaces within a topic island
    Arranges them in a circular/spiral pattern around the island center
    """
    if not workspaces:
        return []
    
    positions = []
    num_workspaces = len(workspaces)
    
    if num_workspaces == 1:
        # Single workspace at center
        positions.append({'x': center_x, 'y': center_y})
    elif num_workspaces <= 8:
        # Circular arrangement for small groups
        import math
        radius = 400  # Distance from center
        for i, workspace in enumerate(workspaces):
            angle = (2 * math.pi * i) / num_workspaces
            x = center_x + radius * math.cos(angle)
            y = center_y + radius * math.sin(angle)
            positions.append({'x': x, 'y': y})
    else:
        # Spiral arrangement for larger groups
        import math
        radius = 300
        angle_increment = 2.4  # Radians between each item
        radius_increment = 50   # How much radius increases per item
        
        for i, workspace in enumerate(workspaces):
            angle = i * angle_increment
            current_radius = radius + (i * radius_increment / 8)  # Gradual spiral
            x = center_x + current_radius * math.cos(angle)
            y = center_y + current_radius * math.sin(angle)
            positions.append({'x': x, 'y': y})
    
    return positions

@api_routes.route('/visualization', methods=['GET'])
def get_visualization_data():
    """
    Get visualization data for D3 force graph from clustering results
    """
    try:
        # Get current clustering status and results
        status = clustering_service.get_clustering_status()
        
        if not status['clusters']:
            return jsonify({
                'points': [],
                'clusters': [],
                'titles': [],
                'topics': {},
                'chats_with_reflections': []
            })
        
        # Transform cluster data into D3 format
        points = []
        cluster_assignments = []
        titles = []
        topics = {}
        
        # Generate positions using a simple grid layout for now
        import math
        cluster_radius = 150
        workspace_radius = 50
        
        for cluster_idx, cluster in enumerate(status['clusters']):
            # Add cluster center point
            center_x = cluster_radius * math.cos(2 * math.pi * cluster_idx / len(status['clusters']))
            center_y = cluster_radius * math.sin(2 * math.pi * cluster_idx / len(status['clusters']))
            
            # Add workspaces around cluster center
            for workspace_idx, workspace in enumerate(cluster['workspaces']):
                # Position workspaces in a circle around cluster center
                angle = 2 * math.pi * workspace_idx / len(cluster['workspaces'])
                x = center_x + workspace_radius * math.cos(angle)
                y = center_y + workspace_radius * math.sin(angle)
                
                points.append([x, y])
                cluster_assignments.append(cluster_idx)
                titles.append(workspace['title'])
            
            # Build topic metadata
            topics[str(cluster_idx)] = {
                'topic': cluster['title'],
                'size': cluster['size'],
                'coherence': 0.85,  # Default coherence value
                'reflection': f"This topic contains {cluster['size']} related workspaces"
            }
        
        return jsonify({
            'points': points,
            'clusters': cluster_assignments,
            'titles': titles,
            'topics': topics,
            'chats_with_reflections': []  # TODO: Add reflection detection
        })
        
    except Exception as e:
        logger.error(f"Error getting visualization data: {e}")
        return jsonify({'error': str(e)}), 500

# Node clustering endpoints
@api_routes.route('/nodes/cluster', methods=['POST'])
def cluster_nodes():
    """
    Cluster nodes within a chat based on content similarity
    """
    try:
        data = request.get_json() or {}
        chat_id = data.get('chat_id')
        method = data.get('method', 'kmeans')
        
        if not chat_id:
            return jsonify({'error': 'chat_id is required'}), 400
        
        # Method-specific parameters
        kwargs = {}
        if method == 'kmeans':
            kwargs['k'] = data.get('k')  # Will auto-determine if None
        elif method == 'dbscan':
            kwargs['eps'] = data.get('eps', 0.5)
            kwargs['min_samples'] = data.get('min_samples', 2)
        
        # Add canvas bounds if provided
        if 'canvas_bounds' in data:
            kwargs['canvas_bounds'] = data['canvas_bounds']
        
        import asyncio
        result = asyncio.run(node_clustering_service.auto_arrange_nodes(chat_id, method, **kwargs))
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error clustering nodes: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/nodes/auto-arrange', methods=['POST'])
def auto_arrange_nodes():
    """
    Auto-arrange nodes based on clustering and relationships
    """
    try:
        data = request.get_json() or {}
        chat_id = data.get('chat_id')
        
        if not chat_id:
            return jsonify({'error': 'chat_id is required'}), 400
        
        # Default to kmeans clustering for auto-arrange
        import asyncio
        result = asyncio.run(node_clustering_service.auto_arrange_nodes(
            chat_id=chat_id,
            method=data.get('method', 'kmeans'),
            canvas_bounds=data.get('canvas_bounds')
        ))
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error auto-arranging nodes: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/nodes/fix-collisions', methods=['POST'])
def fix_node_collisions():
    """
    Fix overlapping nodes by repositioning them with collision detection
    """
    try:
        data = request.get_json() or {}
        chat_id = data.get('chat_id')
        
        if not chat_id:
            return jsonify({'error': 'chat_id is required'}), 400
        
        # Get chat and nodes
        chat = chat_service.get_chat(chat_id)
        if not chat or not chat.nodes:
            return jsonify({'error': 'No nodes found'}), 400
            
        nodes = [node.__dict__ for node in chat.nodes]
        nodes_by_id = {node['id']: node for node in nodes}
        canvas_bounds = data.get('canvas_bounds', {'width': 2000, 'height': 1500, 'margin': 200})
        
        # Check for collisions and reposition overlapping nodes
        new_positions = {}
        final_positions = {}
        
        for node in nodes:
            node_id = node['id']
            current_pos = {'x': node.get('x', 0), 'y': node.get('y', 0)}
            
            # Find collision-free position
            collision_free_pos = node_clustering_service.find_collision_free_position(
                current_pos, node, final_positions, nodes_by_id, canvas_bounds
            )
            
            # Only update if position changed (had collision)
            if (collision_free_pos['x'] != current_pos['x'] or 
                collision_free_pos['y'] != current_pos['y']):
                new_positions[node_id] = collision_free_pos
            
            final_positions[node_id] = collision_free_pos
        
        # Update node positions in database
        updated_count = 0
        for node_id, new_pos in new_positions.items():
            success = chat_service.update_node(chat_id, node_id, {
                'x': new_pos['x'],
                'y': new_pos['y']
            })
            if success:
                updated_count += 1
        
        return jsonify({
            'success': True,
            'updated_nodes': updated_count,
            'total_nodes': len(nodes),
            'new_positions': new_positions
        })
        
    except Exception as e:
        logger.error(f"Error fixing node collisions: {e}")
        return jsonify({'error': str(e)}), 500

# Search endpoints
@api_routes.route('/search/nodes', methods=['POST'])
def search_nodes():
    """
    Search nodes using text, semantic, or hybrid search
    """
    try:
        data = request.get_json() or {}
        query = data.get('query', '').strip()
        chat_id = data.get('chat_id')
        search_type = data.get('type', 'hybrid')  # text, semantic, hybrid
        limit = data.get('limit', 20)
        
        if not query:
            return jsonify({'error': 'query is required'}), 400
        
        results = []
        
        if search_type == 'text':
            results = search_service.text_search_nodes(
                query=query,
                chat_id=chat_id,
                search_titles=data.get('search_titles', True),
                search_content=data.get('search_content', True),
                case_sensitive=data.get('case_sensitive', False),
                regex=data.get('regex', False)
            )
        elif search_type == 'semantic':
            results = search_service.semantic_search_nodes(
                query=query,
                chat_id=chat_id,
                limit=limit,
                similarity_threshold=data.get('similarity_threshold', 0.7)
            )
        elif search_type == 'hybrid':
            results = search_service.hybrid_search_nodes(
                query=query,
                chat_id=chat_id,
                limit=limit,
                text_weight=data.get('text_weight', 0.4),
                semantic_weight=data.get('semantic_weight', 0.6)
            )
        else:
            return jsonify({'error': f'Invalid search type: {search_type}'}), 400
        
        return jsonify({
            'results': results,
            'query': query,
            'search_type': search_type,
            'total_results': len(results)
        })
        
    except Exception as e:
        logger.error(f"Error searching nodes: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/search/suggestions', methods=['GET'])
def get_search_suggestions():
    """
    Get search suggestions based on partial query
    """
    try:
        query = request.args.get('q', '').strip()
        chat_id = request.args.get('chat_id')
        limit = int(request.args.get('limit', 5))
        
        if not query:
            return jsonify({'suggestions': []})
        
        suggestions = search_service.get_search_suggestions(
            partial_query=query,
            chat_id=chat_id,
            limit=limit
        )
        
        return jsonify({'suggestions': suggestions})
        
    except Exception as e:
        logger.error(f"Error getting search suggestions: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/search/nodes/by-type', methods=['GET'])
def search_nodes_by_type():
    """
    Search nodes by type (branch, main, media, etc.)
    """
    try:
        node_type = request.args.get('type')
        chat_id = request.args.get('chat_id')
        
        if not node_type:
            return jsonify({'error': 'type parameter is required'}), 400
        
        results = search_service.search_nodes_by_type(
            node_type=node_type,
            chat_id=chat_id
        )
        
        return jsonify({
            'results': results,
            'node_type': node_type,
            'total_results': len(results)
        })
        
    except Exception as e:
        logger.error(f"Error searching nodes by type: {e}")
        return jsonify({'error': str(e)}), 500

# Conversation Import endpoints
@api_routes.route('/import/conversations', methods=['POST'])
def import_conversations():
    """
    Import conversations from uploaded JSON file
    """
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        if not file.filename.lower().endswith('.json'):
            return jsonify({'error': 'Only JSON files are supported'}), 400
        
        # Read file data
        file_data = file.read()
        if not file_data:
            return jsonify({'error': 'Empty file'}), 400
        
        # Start import process
        result = import_service.start_import(file_data, file.filename)
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify({
            'message': 'Import started successfully',
            'filename': file.filename,
            'format': result.get('format'),
            'status': 'started'
        })
        
    except Exception as e:
        logger.error(f"Error starting conversation import: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/import/status', methods=['GET'])
def get_import_status():
    """
    Get the current import status and progress
    """
    try:
        status = import_service.get_import_status()
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error getting import status: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/import/stop', methods=['POST'])
def stop_import():
    """
    Stop the import process
    """
    try:
        result = import_service.stop_import()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error stopping import: {e}")
        return jsonify({'error': str(e)}), 500

# ========== RELIC ENDPOINTS ==========

# Initialize services
relic_service = RelicService()
thumbnail_service = ThumbnailService()

@api_routes.route('/relics', methods=['GET', 'OPTIONS'])
def list_relics():
    """Get list of all relics, optionally filtered by workspace"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        workspace_id = request.args.get('workspace_id')
        relics = relic_service.list_relics(workspace_id)
        return jsonify({'relics': relics})
    except Exception as e:
        logger.error(f"Error listing relics: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/relics', methods=['POST', 'OPTIONS'])
def create_relic():
    """Create a new relic with initial version"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.json
        if not data.get('id') or not data.get('name') or not data.get('language') or not data.get('code'):
            return jsonify({'error': 'Missing required fields: id, name, language, code'}), 400
        
        relic = relic_service.create_relic(data)
        return jsonify(relic), 201
    except Exception as e:
        logger.error(f"Error creating relic: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/relics/<relic_id>', methods=['GET', 'OPTIONS'])
def get_relic(relic_id):
    """Get a specific relic with optional version"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        version = request.args.get('version', type=int)
        relic = relic_service.get_relic(relic_id, version)
        
        if not relic:
            return jsonify({'error': 'Relic not found'}), 404
        
        return jsonify(relic)
    except Exception as e:
        logger.error(f"Error getting relic: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/relics/<relic_id>', methods=['PUT', 'OPTIONS'])
def update_relic(relic_id):
    """Update relic (creates new version if code changed)"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.json
        commit_message = data.pop('commit_message', None)
        
        relic = relic_service.update_relic(relic_id, data, commit_message)
        return jsonify(relic)
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"Error updating relic: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/relics/<relic_id>', methods=['DELETE', 'OPTIONS'])
def delete_relic(relic_id):
    """Delete a relic and all its versions"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        success = relic_service.delete_relic(relic_id)
        if not success:
            return jsonify({'error': 'Relic not found'}), 404
        
        return jsonify({'message': 'Relic deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Error deleting relic: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/relics/<relic_id>/versions', methods=['GET', 'OPTIONS'])
def get_relic_versions(relic_id):
    """Get all versions of a relic"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        versions = relic_service.get_relic_versions(relic_id)
        return jsonify({'versions': versions})
    except Exception as e:
        logger.error(f"Error getting relic versions: {e}")
        return jsonify({'error': str(e)}), 500

# ========== THUMBNAIL ENDPOINTS ==========

@api_routes.route('/thumbnails', methods=['POST', 'OPTIONS'])
def save_thumbnail():
    """Save thumbnail metadata"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.json
        logger.info(f"Thumbnail save request data: {data}")
        
        if not data.get('thumbnail_url') or not data.get('type'):
            logger.error(f"Missing required fields. Data: {data}")
            return jsonify({'error': 'Missing required fields: thumbnail_url, type'}), 400
        
        thumbnail = thumbnail_service.save_thumbnail(data)
        return jsonify(thumbnail), 201
    except Exception as e:
        logger.error(f"Error saving thumbnail: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/thumbnails', methods=['GET', 'OPTIONS'])
def get_thumbnail():
    """Get thumbnail by relic_id or node_id + code_index"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        relic_id = request.args.get('relicId')
        node_id = request.args.get('nodeId')
        code_index = request.args.get('codeIndex', type=int)
        
        thumbnail = thumbnail_service.get_thumbnail(relic_id, node_id, code_index)
        
        if not thumbnail:
            return jsonify({'error': 'Thumbnail not found'}), 404
        
        return jsonify(thumbnail)
    except Exception as e:
        logger.error(f"Error getting thumbnail: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/thumbnails/<thumbnail_id>', methods=['DELETE', 'OPTIONS'])
def delete_thumbnail(thumbnail_id):
    """Delete a thumbnail"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        success = thumbnail_service.delete_thumbnail(thumbnail_id)
        if not success:
            return jsonify({'error': 'Thumbnail not found'}), 404
        
        return jsonify({'message': 'Thumbnail deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Error deleting thumbnail: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/preview/<preview_id>', methods=['GET'])
def serve_preview(preview_id):
    """Serve a live code preview"""
    try:
        # Get the preview data from temporary storage
        preview_data = preview_storage.get(preview_id)
        if not preview_data:
            return "Preview not found", 404
        
        code = preview_data.get('code', '')
        language = preview_data.get('language', 'javascript')
        
        # Generate HTML based on language
        if language in ['javascript', 'js']:
            html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Preview</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }}
        .container {{
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .output {{
            border: 1px solid #ddd;
            padding: 15px;
            margin-top: 20px;
            border-radius: 4px;
            background: #fff;
        }}
        .error {{
            color: #d73a49;
            background: #ffeef0;
            border-color: #d73a49;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h2>JavaScript Preview</h2>
        <div id="output" class="output">
            <p>Running code...</p>
        </div>
    </div>
    
    <script>
        const output = document.getElementById('output');
        
        // Override console.log to capture output
        const originalLog = console.log;
        const originalError = console.error;
        const logs = [];
        
        console.log = function(...args) {{
            logs.push({{type: 'log', args: args}});
            originalLog.apply(console, args);
            updateOutput();
        }};
        
        console.error = function(...args) {{
            logs.push({{type: 'error', args: args}});
            originalError.apply(console, args);
            updateOutput();
        }};
        
        function updateOutput() {{
            output.innerHTML = logs.map(log => {{
                const content = log.args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                
                if (log.type === 'error') {{
                    return `<div class="error">Error: ${{content}}</div>`;
                }} else {{
                    return `<div>${{content}}</div>`;
                }}
            }}).join('') || '<p>No output</p>';
        }}
        
        // Execute the user code
        try {{
            {code}
        }} catch (error) {{
            console.error(error.message);
        }}
        
        // If no output after 1 second, show code executed message
        setTimeout(() => {{
            if (logs.length === 0) {{
                output.innerHTML = '<p style="color: #28a745;">Code executed successfully (no console output)</p>';
            }}
        }}, 1000);
    </script>
</body>
</html>
"""
        
        elif language in ['html', 'markup']:
            html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML Preview</title>
    <style>
        body {{
            margin: 0;
            font-family: Arial, sans-serif;
        }}
    </style>
</head>
<body>
    {code}
</body>
</html>
"""
        
        elif language in ['css']:
            html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CSS Preview</title>
    <style>
        {code}
    </style>
</head>
<body>
    <div class="container">
        <h1>CSS Preview</h1>
        <p>This is a sample paragraph to demonstrate CSS styling.</p>
        <div class="box">Sample box element</div>
        <button>Sample button</button>
    </div>
</body>
</html>
"""
        
        else:
            html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Preview</title>
    <style>
        body {{
            font-family: 'Courier New', monospace;
            margin: 0;
            padding: 20px;
            background: #f8f9fa;
        }}
        .code-block {{
            background: #2d3748;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            white-space: pre-wrap;
        }}
    </style>
</head>
<body>
    <h2>{language.title()} Code</h2>
    <div class="code-block">{code}</div>
</body>
</html>
"""
        
        return html, 200, {'Content-Type': 'text/html'}
    
    except Exception as e:
        logger.error(f"Error serving preview: {e}")
        return f"Error: {e}", 500

# Simple in-memory storage for previews
preview_storage = {}

@api_routes.route('/create-preview', methods=['POST', 'OPTIONS'])
def create_preview():
    """Create a preview and return its ID"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.json
        code = data.get('code', '')
        language = data.get('language', 'javascript')
        
        # Generate a unique preview ID
        import uuid
        preview_id = str(uuid.uuid4())
        
        # Store the preview data
        preview_storage[preview_id] = {
            'code': code,
            'language': language,
            'created_at': time.time()
        }
        
        # Clean up old previews (older than 1 hour)
        current_time = time.time()
        preview_storage.clear()  # Simple cleanup - remove all old previews
        preview_storage[preview_id] = {
            'code': code,
            'language': language,
            'created_at': current_time
        }
        
        preview_url = f"http://127.0.0.1:5050/api/preview/{preview_id}"
        
        return jsonify({
            'preview_id': preview_id,
            'preview_url': preview_url
        })
    
    except Exception as e:
        logger.error(f"Error creating preview: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/capture-url', methods=['POST', 'OPTIONS'])
def capture_url_screenshot():
    """Capture screenshot of a URL using Playwright"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        from playwright.sync_api import sync_playwright
        import base64
        
        data = request.json
        url = data.get('url')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Set viewport size
            page.set_viewport_size({"width": 1280, "height": 720})
            
            # Navigate to URL
            logger.info(f"Navigating to URL: {url}")
            page.goto(url, wait_until='networkidle')
            
            # Get page title and content for debugging
            title = page.title()
            content = page.content()
            logger.info(f"Page title: {title}")
            logger.info(f"Page content length: {len(content)}")
            
            # Wait extra time for SandPack to load
            page.wait_for_timeout(3000)  # 3 seconds
            
            # Check if there's any content
            try:
                # Look for any div with content
                page.wait_for_selector('div', timeout=5000)
                logger.info("Found div elements")
            except Exception as e:
                logger.warning(f"No div elements found: {e}")
            
            # Take screenshot
            screenshot = page.screenshot(type='jpeg', quality=80)
            browser.close()
            
            # Convert to base64
            screenshot_base64 = base64.b64encode(screenshot).decode('utf-8')
            return jsonify({
                'screenshot': f'data:image/jpeg;base64,{screenshot_base64}'
            })
            
    except Exception as e:
        logger.error(f"Error capturing screenshot: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/upload/thumbnail', methods=['POST', 'OPTIONS'])
def upload_thumbnail():
    """Upload thumbnail image file"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        logger.info(f"Upload request - files: {list(request.files.keys())}, form: {list(request.form.keys())}")
        logger.info(f"Content-Type: {request.content_type}")
        
        if 'thumbnail' not in request.files:
            logger.error(f"No 'thumbnail' field in request.files. Available fields: {list(request.files.keys())}")
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['thumbnail']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Read file data
        file_data = file.read()
        filename = file.filename
        
        # Log file details for debugging
        logger.info(f"Received file upload: filename={filename}, size={len(file_data)} bytes")
        
        if len(file_data) == 0:
            return jsonify({'error': 'Uploaded file is empty'}), 400
        
        # Save file and get URL
        thumbnail_url = thumbnail_service.save_uploaded_file(file_data, filename)
        
        return jsonify({'url': thumbnail_url}), 201
    except Exception as e:
        logger.error(f"Error uploading thumbnail: {e}")
        return jsonify({'error': str(e)}), 500

# Serve static thumbnail files
@app.route('/static/thumbnails/<filename>')
def serve_thumbnail(filename):
    """Serve thumbnail files"""
    from flask import send_from_directory
    return send_from_directory(thumbnail_service.upload_path, filename)

# Mock Data Generator
CONTENT_THEMES = {
    "tech_support": {
        "titles": ["Issue with Login", "API Key Not Working", "Database Connection Error", "Frontend Component Bug", "Server is Down"],
        "user_prompts": ["My app is crashing, can you help?", "I'm getting a 403 Forbidden error.", "How do I reset my password?", "The main button isn't clickable on mobile.", "The server seems to be unresponsive."],
        "assistant_responses": ["Of course, can you provide the full error log?", "A 403 error means you don't have permission. Have you checked your API key scopes?", "You can reset your password by visiting the settings page and clicking 'Forgot Password'.", "Let's debug the component. Can you check the browser's console for any errors?", "I'm looking into the server status now. It seems we have a high load. We are working on it."]
    },
    "creative": {
        "titles": ["Brainstorming a Story", "Poem about the Stars", "Character Ideas", "World-building for Fantasy", "Sci-Fi Movie Plot"],
        "user_prompts": ["Let's write a story about a time-traveling librarian.", "Give me a line to start a poem about space.", "I need a name for a grumpy but lovable robot.", "Describe a futuristic city powered by magic.", "What if dogs secretly ruled the world?"],
        "assistant_responses": ["Excellent idea! Does the librarian travel to the past or future to save a specific book?", "How about: 'The cosmos hums a tune only silence can hear.'", "How about 'Clank' or 'Unit 734' who insists on being called 'Bob'?", "Imagine spires of shimmering crystal woven with arcane circuits, where enchanted vehicles navigate sky-lanes of pure light.", "That's a fantastic premise! The secret canine council would meet in the world's largest dog park, disguised as a normal day of play."]
    },
    "general": {
        "titles": ["Finding a New Hobby", "Classic Lasagna Recipe", "Travel Plans for Italy", "Learning Guitar", "Best way to brew coffee"],
        "user_prompts": ["I'm bored, can you suggest a new hobby for me?", "What's a good, simple recipe for lasagna?", "What are the must-see cities in Italy for a first-timer?", "I want to learn guitar, where should I start?", "What's the difference between a pour-over and a french press?"],
        "assistant_responses": ["Have you considered urban exploration or digital art? They're both very engaging and can be done solo.", "For a great lasagna, you'll need a rich bolognese sauce, a creamy béchamel, and layers of fresh pasta and parmesan.", "For a first trip, you can't go wrong with Rome for history, Florence for art, and Venice for its unique canals.", "Start with learning basic chords like G, C, D, and Em. There are many great tutorials on YouTube!", "A pour-over gives a very clean, crisp cup by letting water pass through the grounds, while a French press steeps the grounds, resulting in a fuller-bodied, more robust flavor."]
    }
}

def get_mock_content(theme_data):
    """Returns a random user prompt and assistant response from a theme."""
    return random.choice(theme_data["user_prompts"]), random.choice(theme_data["assistant_responses"])

def generate_chatgpt_conversation(config, theme_data):
    """Generates a single conversation in ChatGPT format."""
    conv_id = f"chat-{uuid.uuid4()}"
    num_messages = random.randint(2, config['max_messages_per_conversation'])
    
    # Timestamps for the entire conversation
    start_time = time.time() - random.uniform(3600, 86400 * 60) # Sometime in the last 60 days
    update_time = start_time

    mapping = {}
    
    # Create the root node
    root_id = "client-created-root"
    first_message_id = str(uuid.uuid4())
    mapping[root_id] = {"id": root_id, "message": None, "parent": None, "children": [first_message_id]}
    
    parent_id = root_id
    current_node_id = None
    
    for i in range(num_messages):
        msg_id = first_message_id if i == 0 else str(uuid.uuid4())
        role = "user" if i % 2 == 0 else "assistant"
        user_prompt, assistant_response = get_mock_content(theme_data)
        content = user_prompt if role == "user" else assistant_response
        
        # Increment time for each message
        update_time += random.uniform(10, 300)

        message_obj = {
            "id": msg_id,
            "author": {"role": role, "name": None, "metadata": {}},
            "create_time": update_time,
            "content": {"content_type": "text", "parts": [content]},
            "status": "finished_successfully",
            "end_turn": True,
            "weight": 1.0,
            "metadata": {"finish_details": {"type": "stop"}, "is_complete": True, "model_slug": "gpt-4o"},
            "recipient": "all",
        }

        node = {
            "id": msg_id,
            "message": message_obj,
            "parent": parent_id,
            "children": [],
        }
        
        # Link from parent
        if parent_id in mapping:
            mapping[parent_id]["children"].append(msg_id)
        
        mapping[msg_id] = node
        parent_id = msg_id
        current_node_id = msg_id

    return {
        "id": conv_id,
        "title": random.choice(theme_data["titles"]),
        "create_time": start_time,
        "update_time": update_time,
        "mapping": mapping,
        "current_node": current_node_id,
        "moderation_results": [],
        "plugin_ids": None,
        "conversation_id": conv_id,
        "default_model_slug": "auto"
    }

def generate_claude_conversation(config, theme_data):
    """Generates a single conversation in Claude format."""
    conv_id = str(uuid.uuid4())
    num_messages = random.randint(2, config['max_messages_per_conversation'])

    start_time = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60))
    current_time = start_time
    
    chat_messages = []
    for i in range(num_messages):
        sender = "human" if i % 2 == 0 else "assistant"
        user_prompt, assistant_response = get_mock_content(theme_data)
        content = user_prompt if sender == "human" else assistant_response
        
        current_time += timedelta(seconds=random.randint(10, 300))
        timestamp_str = current_time.isoformat().replace("+00:00", "Z")

        chat_messages.append({
            "uuid": str(uuid.uuid4()),
            "text": content,
            "content": [{"type": "text", "text": content, "citations": []}],
            "sender": sender,
            "created_at": timestamp_str,
            "updated_at": timestamp_str,
            "attachments": [],
            "files": []
        })

    return {
        "uuid": conv_id,
        "name": random.choice(theme_data["titles"]) if random.random() > 0.2 else "",
        "created_at": start_time.isoformat().replace("+00:00", "Z"),
        "updated_at": current_time.isoformat().replace("+00:00", "Z"),
        "account": {"uuid": f"acc-{uuid.uuid4()}"},
        "chat_messages": chat_messages
    }

@app.route('/api/generate-mock-archive', methods=['POST'])
def generate_archive():
    try:
        config = request.get_json()
        platform = config.get("platform")
        count = int(config.get("conversation_count", 5))
        max_msgs = int(config.get("max_messages_per_conversation", 15))
        theme = config.get("content_source", "general")

        if not platform or platform not in ["chatgpt", "claude"]:
            return jsonify({"error": "Invalid 'platform' specified. Use 'chatgpt' or 'claude'."}), 400
        
        theme_data = CONTENT_THEMES.get(theme, CONTENT_THEMES["general"])
        
        conversations = []
        if platform == "chatgpt":
            for _ in range(count):
                conversations.append(generate_chatgpt_conversation(config, theme_data))
        elif platform == "claude":
            for _ in range(count):
                conversations.append(generate_claude_conversation(config, theme_data))
        
        return jsonify(conversations)

    except Exception as e:
        logger.error(f"Error generating mock archive: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-workspace', methods=['POST', 'OPTIONS'])
def generate_workspace():
    """
    Generate a structured workspace based on user input or template
    """
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        user_input = data.get('userInput', '').strip()
        template_id = data.get('templateId')
        preferences = data.get('preferences', {})
        
        if not user_input and not template_id:
            return jsonify({"error": "Either userInput or templateId is required"}), 400

        # If template ID is provided, use predefined structure
        if template_id:
            workspace = generate_from_template(template_id, user_input)
            if workspace:
                return jsonify(workspace)
            else:
                return jsonify({"error": "Template not found"}), 404

        # Generate workspace using LLM
        workspace = generate_workspace_with_llm(user_input, preferences)
        return jsonify(workspace)

    except Exception as e:
        logger.error(f"Error generating workspace: {str(e)}")
        return jsonify({"error": str(e)}), 500

def generate_from_template(template_id: str, user_input: str = ""):
    """Generate workspace from predefined template"""
    
    # Template definitions
    templates = {
        'game-dev': {
            'title': 'Game Development Project',
            'branches': [
                {
                    'id': 'game-concept',
                    'title': 'Game Concept',
                    'starterMessage': "Let's brainstorm your game concept! What type of experience do you want players to have? We can explore different genres, mechanics, and themes to find the perfect match for your vision.",
                    'position': {'x': 0, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'technical-planning',
                    'title': 'Technical Planning', 
                    'starterMessage': "Now let's plan the technical requirements for your game. We'll choose the right engine, define platform requirements, and outline the technical architecture needed to bring your concept to life.",
                    'position': {'x': 400, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'art-design',
                    'title': 'Art & Design',
                    'starterMessage': "Time to design the visual style and user interface for your game. We'll explore art styles, create a visual identity, and plan the UI/UX that will make your game both beautiful and intuitive.",
                    'position': {'x': 0, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'monetization',
                    'title': 'Monetization Strategy',
                    'starterMessage': "Let's plan how your game will generate revenue sustainably. We'll explore different monetization models, design fair pricing strategies, and ensure your business model enhances rather than detracts from the player experience.",
                    'position': {'x': 400, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'marketing-launch',
                    'title': 'Marketing & Launch',
                    'starterMessage': "Ready to plan your launch? Let's identify your target audience, create a marketing strategy, and build anticipation for your game release.",
                    'position': {'x': 200, 'y': 500},
                    'type': 'assistant'
                }
            ],
            'connections': [
                {'parentId': 'game-concept', 'childId': 'technical-planning', 'label': 'implementation'},
                {'parentId': 'game-concept', 'childId': 'art-design', 'label': 'visual direction'},
                {'parentId': 'technical-planning', 'childId': 'monetization', 'label': 'feasibility'},
                {'parentId': 'art-design', 'childId': 'marketing-launch', 'label': 'assets'},
                {'parentId': 'monetization', 'childId': 'marketing-launch', 'label': 'strategy'}
            ]
        },
        'brainstorm': {
            'title': 'Brainstorming Session',
            'branches': [
                {
                    'id': 'problem-definition',
                    'title': 'Problem Definition',
                    'starterMessage': "Let's clearly define the problem or challenge we're trying to solve. The better we understand the problem, the more effective our solutions will be.",
                    'position': {'x': 0, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'idea-generation',
                    'title': 'Idea Generation',
                    'starterMessage': "Now let's generate as many ideas as possible without judgment. The goal is quantity and creativity - we'll evaluate later!",
                    'position': {'x': 400, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'idea-evaluation',
                    'title': 'Idea Evaluation',
                    'starterMessage': "Time to evaluate our ideas against key criteria like feasibility, impact, and resources required. Let's be systematic about this analysis.",
                    'position': {'x': 200, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'solution-selection',
                    'title': 'Solution Selection',
                    'starterMessage': "Let's select the best solutions based on our evaluation and plan the next steps for implementation.",
                    'position': {'x': 0, 'y': 500},
                    'type': 'assistant'
                },
                {
                    'id': 'action-planning',
                    'title': 'Action Planning',
                    'starterMessage': "Now let's create a concrete action plan to implement our chosen solution, with clear steps and timelines.",
                    'position': {'x': 400, 'y': 500},
                    'type': 'assistant'
                }
            ],
            'connections': [
                {'parentId': 'problem-definition', 'childId': 'idea-generation', 'label': 'context'},
                {'parentId': 'idea-generation', 'childId': 'idea-evaluation', 'label': 'raw ideas'},
                {'parentId': 'idea-evaluation', 'childId': 'solution-selection', 'label': 'analysis'},
                {'parentId': 'solution-selection', 'childId': 'action-planning', 'label': 'decisions'}
            ]
        },
        'research': {
            'title': 'Research Project',
            'branches': [
                {
                    'id': 'research-question',
                    'title': 'Research Question',
                    'starterMessage': "Let's formulate a clear, focused research question that will guide our investigation and help us stay on track.",
                    'position': {'x': 0, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'source-gathering',
                    'title': 'Source Gathering',
                    'starterMessage': "Now let's identify and gather reliable, high-quality sources of information relevant to our research question.",
                    'position': {'x': 400, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'analysis-notes',
                    'title': 'Analysis & Notes',
                    'starterMessage': "Time to analyze our sources systematically and take structured notes that will support our conclusions.",
                    'position': {'x': 0, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'synthesis',
                    'title': 'Synthesis',
                    'starterMessage': "Let's synthesize our findings into coherent insights and identify patterns and themes across our sources.",
                    'position': {'x': 400, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'conclusions',
                    'title': 'Conclusions',
                    'starterMessage': "Finally, let's draw well-supported conclusions and identify the implications of our research findings.",
                    'position': {'x': 200, 'y': 500},
                    'type': 'assistant'
                }
            ],
            'connections': [
                {'parentId': 'research-question', 'childId': 'source-gathering', 'label': 'focus'},
                {'parentId': 'source-gathering', 'childId': 'analysis-notes', 'label': 'materials'},
                {'parentId': 'analysis-notes', 'childId': 'synthesis', 'label': 'insights'},
                {'parentId': 'synthesis', 'childId': 'conclusions', 'label': 'findings'}
            ]
        },
        'writing': {
            'title': 'Writing Project',
            'branches': [
                {
                    'id': 'concept-theme',
                    'title': 'Concept & Theme',
                    'starterMessage': "Let's develop your core concept and explore the themes you want to convey through your writing.",
                    'position': {'x': 0, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'character-development',
                    'title': 'Character Development',
                    'starterMessage': "Time to create compelling, three-dimensional characters that will drive your story forward and connect with readers.",
                    'position': {'x': 400, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'plot-structure',
                    'title': 'Plot Structure',
                    'starterMessage': "Now let's build a solid plot structure and outline that will guide your writing process and maintain narrative momentum.",
                    'position': {'x': 0, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'writing-drafting',
                    'title': 'Writing & Drafting',
                    'starterMessage': "Let's start writing! I'll help you overcome writer's block, develop your unique voice, and maintain consistency throughout your draft.",
                    'position': {'x': 400, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'revision-polish',
                    'title': 'Revision & Polish',
                    'starterMessage': "Time to revise, edit, and polish your work. We'll focus on structure, clarity, style, and making every word count.",
                    'position': {'x': 200, 'y': 500},
                    'type': 'assistant'
                }
            ],
            'connections': [
                {'parentId': 'concept-theme', 'childId': 'character-development', 'label': 'foundation'},
                {'parentId': 'concept-theme', 'childId': 'plot-structure', 'label': 'direction'},
                {'parentId': 'character-development', 'childId': 'writing-drafting', 'label': 'voice'},
                {'parentId': 'plot-structure', 'childId': 'writing-drafting', 'label': 'framework'},
                {'parentId': 'writing-drafting', 'childId': 'revision-polish', 'label': 'draft'}
            ]
        },
        'science': {
            'title': 'Scientific Investigation',
            'branches': [
                {
                    'id': 'hypothesis',
                    'title': 'Hypothesis',
                    'starterMessage': "Let's formulate a testable hypothesis based on observations. A good hypothesis should be specific, measurable, and falsifiable.",
                    'position': {'x': 0, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'methodology',
                    'title': 'Methodology',
                    'starterMessage': "Now let's design a rigorous experimental methodology. We'll plan the experimental design, controls, and procedures to test our hypothesis.",
                    'position': {'x': 400, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'data-collection',
                    'title': 'Data Collection',
                    'starterMessage': "Time to plan and execute our data collection process. We'll establish protocols for gathering accurate and reliable data.",
                    'position': {'x': 0, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'analysis',
                    'title': 'Analysis',
                    'starterMessage': "Let's analyze our data and look for patterns and significance. We'll use appropriate statistical methods and visualization techniques.",
                    'position': {'x': 400, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'conclusions',
                    'title': 'Conclusions',
                    'starterMessage': "Finally, let's interpret results and draw scientific conclusions. We'll discuss implications, limitations, and future research directions.",
                    'position': {'x': 200, 'y': 500},
                    'type': 'assistant'
                }
            ],
            'connections': [
                {'parentId': 'hypothesis', 'childId': 'methodology', 'label': 'testing approach'},
                {'parentId': 'methodology', 'childId': 'data-collection', 'label': 'procedure'},
                {'parentId': 'data-collection', 'childId': 'analysis', 'label': 'raw data'},
                {'parentId': 'analysis', 'childId': 'conclusions', 'label': 'results'}
            ]
        },
        'business': {
            'title': 'Business Strategy',
            'branches': [
                {
                    'id': 'market-analysis',
                    'title': 'Market Analysis',
                    'starterMessage': "Let's analyze your target market and competitive landscape. We'll identify opportunities, threats, and market positioning strategies.",
                    'position': {'x': 0, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'value-proposition',
                    'title': 'Value Proposition',
                    'starterMessage': "Now let's define your unique value proposition and positioning. What makes your offering special and why should customers choose you?",
                    'position': {'x': 400, 'y': 0},
                    'type': 'assistant'
                },
                {
                    'id': 'business-model',
                    'title': 'Business Model',
                    'starterMessage': "Time to design a sustainable and scalable business model. We'll define revenue streams, cost structure, and key partnerships.",
                    'position': {'x': 0, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'financial-planning',
                    'title': 'Financial Planning',
                    'starterMessage': "Let's create financial projections and funding strategies. We'll plan budgets, forecast revenues, and identify funding needs.",
                    'position': {'x': 400, 'y': 300},
                    'type': 'assistant'
                },
                {
                    'id': 'go-to-market',
                    'title': 'Go-to-Market',
                    'starterMessage': "Finally, let's plan your market entry and growth strategy. We'll create a roadmap for launching and scaling your business.",
                    'position': {'x': 200, 'y': 500},
                    'type': 'assistant'
                }
            ],
            'connections': [
                {'parentId': 'market-analysis', 'childId': 'value-proposition', 'label': 'insights'},
                {'parentId': 'value-proposition', 'childId': 'business-model', 'label': 'positioning'},
                {'parentId': 'business-model', 'childId': 'financial-planning', 'label': 'structure'},
                {'parentId': 'financial-planning', 'childId': 'go-to-market', 'label': 'resources'}
            ]
        }
    }
    
    template = templates.get(template_id)
    if not template:
        return None
    
    # Create workspace structure with proper formatting
    workspace = {
        'title': template['title'],
        'nodes': [],
        'connections': template['connections'],
        'layout': 'structured'
    }
    
    # Convert branches to nodes with messages
    for branch in template['branches']:
        node = {
            'id': branch['id'],
            'title': branch['title'],
            'x': branch['position']['x'],
            'y': branch['position']['y'],
            'type': 'branch',
            'messages': [
                {
                    'role': 'assistant',
                    'content': branch['starterMessage'],
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'id': f"msg-{uuid.uuid4()}"
                }
            ]
        }
        workspace['nodes'].append(node)
    
    return workspace

def generate_workspace_with_llm(user_input: str, preferences: dict):
    """Generate simple single-node workspace for regular requests"""
    
    # Create simple workspace with just the user's input
    workspace = {
        'title': user_input[:50] + "..." if len(user_input) > 50 else user_input,
        'nodes': [],
        'connections': [],
        'layout': 'simple'
    }
    
    # Create single main node with user input - no additional branches
    main_node = {
        'id': 'main-topic',
        'title': 'Chat',
        'x': 400,
        'y': 300,
        'type': 'branch',
        'messages': [
            {
                'role': 'user',
                'content': user_input,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'id': f"msg-{uuid.uuid4()}"
            }
        ]
    }
    workspace['nodes'].append(main_node)
    
    return workspace

def extract_key_concepts(text: str) -> list:
    """Extract key concepts from user input"""
    # Simple keyword extraction - could be enhanced with NLP
    import re
    
    # Remove common words and extract meaningful terms
    common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why', 'who', 'i', 'we', 'you', 'they', 'it', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'need', 'want', 'help', 'me', 'my', 'your'}
    
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    concepts = [word for word in words if word not in common_words]
    
    # Return top concepts
    return list(set(concepts))[:5]

def generate_branch_topics(concepts: list, user_input: str) -> list:
    """Generate branch topics based on concepts"""
    import math
    
    # Default branch generation patterns
    if any(word in user_input.lower() for word in ['game', 'gaming', 'develop', 'play']):
        return [
            {'title': 'Game Design', 'starter_message': 'Let\'s design the core gameplay mechanics and player experience.', 'relation': 'design'},
            {'title': 'Technical Development', 'starter_message': 'Now let\'s plan the technical implementation and tools needed.', 'relation': 'implementation'},
            {'title': 'Art & Visuals', 'starter_message': 'Time to create the visual style and artistic direction.', 'relation': 'aesthetics'},
            {'title': 'Testing & Polish', 'starter_message': 'Let\'s plan testing, feedback, and final polishing phases.', 'relation': 'refinement'}
        ]
    
    elif any(word in user_input.lower() for word in ['business', 'startup', 'company', 'strategy']):
        return [
            {'title': 'Market Analysis', 'starter_message': 'Let\'s analyze the market opportunity and competitive landscape.', 'relation': 'research'},
            {'title': 'Business Model', 'starter_message': 'Now let\'s design a sustainable business model and revenue streams.', 'relation': 'strategy'},
            {'title': 'Product Development', 'starter_message': 'Time to plan product development and key features.', 'relation': 'execution'},
            {'title': 'Go-to-Market', 'starter_message': 'Let\'s create a launch strategy and marketing plan.', 'relation': 'launch'}
        ]
    
    elif any(word in user_input.lower() for word in ['research', 'study', 'learn', 'analysis']):
        return [
            {'title': 'Research Planning', 'starter_message': 'Let\'s plan our research approach and methodology.', 'relation': 'methodology'},
            {'title': 'Data Collection', 'starter_message': 'Now let\'s gather relevant information and sources.', 'relation': 'gathering'},
            {'title': 'Analysis', 'starter_message': 'Time to analyze findings and identify patterns.', 'relation': 'insights'},
            {'title': 'Conclusions', 'starter_message': 'Let\'s synthesize our findings into actionable conclusions.', 'relation': 'synthesis'}
        ]
    
    # Generic branches based on concepts
    branches = []
    for i, concept in enumerate(concepts[:4]):
        branches.append({
            'title': concept.title(),
            'starter_message': f'Let\'s explore {concept} in detail and understand its role in your project.',
            'relation': 'exploration'
        })
    
    # Ensure we have at least 3 branches
    while len(branches) < 3:
        branches.append({
            'title': f'Area {len(branches) + 1}',
            'starter_message': 'Let\'s explore this aspect of your project in more detail.',
            'relation': 'investigation'
        })
    
    return branches[:5]  # Limit to 5 branches max

# Tool Call Management Endpoints
@api_routes.route('/tool-calls/node/<node_id>', methods=['GET'])
def get_tool_calls_for_node(node_id):
    """Get all tool calls for a specific node"""
    try:
        tool_calls = tool_call_service.get_tool_calls_for_node(node_id)
        return jsonify(tool_calls)
    except Exception as e:
        logger.error(f"Error getting tool calls for node {node_id}: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/tool-calls/<tool_call_id>', methods=['GET'])
def get_tool_call_details(tool_call_id):
    """Get detailed information about a specific tool call"""
    try:
        details = tool_call_service.get_tool_call_details(tool_call_id)
        if details is None:
            return jsonify({'error': 'Tool call not found'}), 404
        return jsonify(details)
    except Exception as e:
        logger.error(f"Error getting tool call details for {tool_call_id}: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/file-nodes/node/<node_id>', methods=['GET'])
def get_file_nodes_for_node(node_id):
    """Get all file nodes for a specific node"""
    try:
        file_nodes = tool_call_service.get_file_nodes_for_node(node_id)
        return jsonify(file_nodes)
    except Exception as e:
        logger.error(f"Error getting file nodes for node {node_id}: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/execution-nodes/node/<node_id>', methods=['GET'])
def get_execution_nodes_for_node(node_id):
    """Get all execution nodes for a specific node"""
    try:
        execution_nodes = tool_call_service.get_execution_nodes_for_node(node_id)
        return jsonify(execution_nodes)
    except Exception as e:
        logger.error(f"Error getting execution nodes for node {node_id}: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/execution-nodes/<execution_id>/terminate', methods=['POST'])
def terminate_execution(execution_id):
    """Terminate a running execution"""
    try:
        success = tool_call_service.terminate_execution(execution_id)
        return jsonify({'success': success})
    except Exception as e:
        logger.error(f"Error terminating execution {execution_id}: {e}")
        return jsonify({'error': str(e)}), 500

# Claude Code Management Endpoints
@api_routes.route('/claude-code/instances', methods=['POST'])
def create_claude_code_instance():
    """Create a new Claude Code instance"""
    try:
        data = request.json
        instance_id = claude_code_service.create_instance_sync(data)
        return jsonify({'instance_id': instance_id})
    except Exception as e:
        logger.error(f"Error creating Claude Code instance: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/claude-code/instances', methods=['GET'])
def get_claude_code_instances():
    """Get all active Claude Code instances"""
    try:
        # Return empty list if no instances
        if not hasattr(claude_code_service, 'active_instances'):
            return jsonify([])
        
        instances = claude_code_service.get_active_instances_sync()
        return jsonify(instances)
    except Exception as e:
        logger.error(f"Error getting Claude Code instances: {e}")
        # Return empty list on error for now
        return jsonify([])
        # return jsonify({'error': str(e)}), 500

@api_routes.route('/claude-code/instances/<instance_id>/status', methods=['GET'])
def get_claude_code_instance_status(instance_id):
    """Get status of a specific Claude Code instance"""
    try:
        status = claude_code_service.get_instance_status_sync(instance_id)
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error getting Claude Code instance status: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/claude-code/instances/<instance_id>/message', methods=['POST'])
def send_claude_code_message(instance_id):
    """Send a message to a Claude Code instance"""
    try:
        data = request.json
        message = data.get('message', '')
        
        # Check if it's a slash command
        if claude_code_service.is_slash_command(message):
            result = claude_code_service.handle_slash_command(instance_id, message)
            return jsonify(result)
        else:
            success = claude_code_service.send_message_sync(instance_id, message)
            return jsonify({'success': success})
    except Exception as e:
        logger.error(f"Error sending message to Claude Code instance: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/claude-code/instances/<instance_id>/pause', methods=['POST'])
def pause_claude_code_instance(instance_id):
    """Pause a Claude Code instance"""
    try:
        success = claude_code_service.pause_instance_sync(instance_id)
        return jsonify({'success': success})
    except Exception as e:
        logger.error(f"Error pausing Claude Code instance: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/claude-code/instances/<instance_id>/resume', methods=['POST'])
def resume_claude_code_instance(instance_id):
    """Resume a paused Claude Code instance"""
    try:
        success = claude_code_service.resume_instance_sync(instance_id)
        return jsonify({'success': success})
    except Exception as e:
        logger.error(f"Error resuming Claude Code instance: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/claude-code/instances/<instance_id>/stop', methods=['POST'])
def stop_claude_code_instance(instance_id):
    """Stop a Claude Code instance"""
    try:
        success = claude_code_service.stop_instance_sync(instance_id)
        return jsonify({'success': success})
    except Exception as e:
        logger.error(f"Error stopping Claude Code instance: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/claude-code/sessions', methods=['GET'])
def get_claude_code_sessions():
    """Get historical Claude Code sessions"""
    try:
        sessions = claude_code_service.get_session_history()
        return jsonify(sessions)
    except Exception as e:
        logger.error(f"Error getting Claude Code sessions: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/claude-code/sessions/<session_id>/resume', methods=['POST'])
def resume_claude_code_session(session_id):
    """Resume a previous Claude Code session"""
    try:
        data = request.json or {}
        instance_id = claude_code_service.resume_session_sync(session_id, data)
        return jsonify({'instance_id': instance_id})
    except Exception as e:
        logger.error(f"Error resuming Claude Code session: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/claude-code/instances/register-external', methods=['POST'])
def register_external_claude_code_instance():
    """Register an external Claude Code instance that's already running"""
    try:
        data = request.json or {}
        instance_id = data.get('instance_id', f'external-{uuid.uuid4()}')
        
        # Create a mock instance to represent the external session
        external_instance_config = {
            'name': data.get('name', 'External Claude Code Session'),
            'external': True,
            'session_id': data.get('session_id'),
            'working_dir': data.get('working_dir', '/Users/928546/Desktop/tangent'),
            'node_id': data.get('node_id')
        }
        
        # Register with the service
        claude_code_service.register_external_instance(instance_id, external_instance_config)
        
        return jsonify({
            'success': True, 
            'instance_id': instance_id,
            'message': 'External instance registered successfully'
        })
    except Exception as e:
        logger.error(f"Error registering external Claude Code instance: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/claude-code/send-message', methods=['GET', 'POST'])
def send_claude_code_message_simple():
    """Send a message to Claude Code using the SDK with streaming"""
    try:
        # Support both GET (for SSE) and POST requests
        if request.method == 'GET':
            message = request.args.get('message', '')
            session_id = request.args.get('session_id')
            node_id = request.args.get('node_id')
            context = request.args.get('context', '')
            allowed_tools_str = request.args.get('allowed_tools', 'Write,Read,Edit,LS,Glob,Grep,Bash')
            allowed_tools = [tool.strip() for tool in allowed_tools_str.split(',')]
        else:
            data = request.json or {}
            message = data.get('message', '')
            session_id = data.get('session_id')
            node_id = data.get('node_id')
            context = data.get('context', '')
            allowed_tools = data.get('allowed_tools', ['Write', 'Read', 'Edit', 'LS', 'Glob', 'Grep', 'Bash'])
        
        if not message:
            if request.method == 'GET':
                return Response('data: {"type": "error", "error": "Message is required"}\n\n', mimetype='text/event-stream')
            return jsonify({'error': 'Message is required'}), 400
            
        def generate():
            try:
                # Prepare message with context if available
                full_message = message
                if context and not session_id:
                    # For new sessions, include recent context
                    full_message = f"Previous conversation context:\n{context}\n\nCurrent message: {message}"
                
                # Use Claude Code SDK to send message with streaming (following docs best practices)
                if session_id:
                    # Resume existing session using documented --resume flag
                    cmd = [
                        'claude', '-p', '--resume', session_id, full_message,
                        '--output-format', 'stream-json',
                        '--verbose',
                        '--allowedTools'
                    ] + allowed_tools
                else:
                    # Start new session with -p flag
                    cmd = [
                        'claude', '-p', full_message,
                        '--output-format', 'stream-json',
                        '--verbose',
                        '--allowedTools'
                    ] + allowed_tools
                
                # Set working directory to project root
                working_dir = '/Users/928546/Desktop/tangent'
                
                # Run Claude Code command with streaming
                process = subprocess.Popen(
                    cmd,
                    cwd=working_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=0,  # Unbuffered for real-time streaming
                    universal_newlines=True
                )
                
                tool_calls = []
                buffer = ""
                last_yield_time = time.time()
                
                # Line-by-line streaming for Claude Code SDK stream-json format
                buffer = ""
                
                # Read line by line for proper JSON parsing
                for line in iter(process.stdout.readline, ''):
                    if not line:  # Process ended
                        break
                    
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        # Parse Claude Code SDK message format
                        sdk_message = json.loads(line)
                        
                        # Handle different SDK message types according to documentation
                        if sdk_message.get('type') == 'system':
                            # System initialization message
                            if sdk_message.get('subtype') == 'init':
                                yield f"data: {json.dumps({
                                    'type': 'system',
                                    'subtype': 'init',
                                    'session_id': sdk_message.get('session_id'),
                                    'model': sdk_message.get('model'),
                                    'tools': sdk_message.get('tools', []),
                                    'mcp_servers': sdk_message.get('mcp_servers', []),
                                    'cwd': sdk_message.get('cwd'),
                                    'permission_mode': sdk_message.get('permissionMode', 'default')
                                })}\n\n"
                        
                        elif sdk_message.get('type') == 'assistant':
                            # Assistant message with content
                            assistant_msg = sdk_message.get('message', {})
                            content = assistant_msg.get('content', [])
                            
                            # Process each content block
                            for content_block in content:
                                if content_block.get('type') == 'text':
                                    # Stream text content
                                    yield f"data: {json.dumps({
                                        'type': 'text',
                                        'content': content_block.get('text', ''),
                                        'session_id': sdk_message.get('session_id')
                                    })}\n\n"
                                
                                elif content_block.get('type') == 'tool_use':
                                    # Tool use block
                                    tool_info = {
                                        'type': 'tool_use',
                                        'tool_name': content_block.get('name'),
                                        'tool_id': content_block.get('id'),
                                        'parameters': content_block.get('input', {}),
                                        'session_id': sdk_message.get('session_id')
                                    }
                                    tool_calls.append(tool_info)
                                    yield f"data: {json.dumps(tool_info)}\n\n"
                        
                        elif sdk_message.get('type') == 'user':
                            # User message (for multi-turn conversations)
                            user_msg = sdk_message.get('message', {})
                            yield f"data: {json.dumps({
                                'type': 'user',
                                'content': user_msg.get('content', ''),
                                'session_id': sdk_message.get('session_id')
                            })}\n\n"
                        
                        elif sdk_message.get('type') == 'result':
                            # Final result message
                            subtype = sdk_message.get('subtype', 'success')
                            result_data = {
                                'type': 'result',
                                'subtype': subtype,
                                'session_id': sdk_message.get('session_id'),
                                'duration_ms': sdk_message.get('duration_ms'),
                                'duration_api_ms': sdk_message.get('duration_api_ms'),
                                'num_turns': sdk_message.get('num_turns'),
                                'total_cost_usd': sdk_message.get('total_cost_usd', 0.0),
                                'is_error': sdk_message.get('is_error', False)
                            }
                            
                            # Add result content for success
                            if subtype == 'success':
                                result_data['result'] = sdk_message.get('result', '')
                            
                            yield f"data: {json.dumps(result_data)}\n\n"
                        
                        else:
                            # Unknown message type, log and pass through
                            yield f"data: {json.dumps({
                                'type': 'unknown',
                                'raw_message': sdk_message
                            })}\n\n"
                            
                    except json.JSONDecodeError as e:
                        # Handle non-JSON output (shouldn't happen with stream-json but just in case)
                        yield f"data: {json.dumps({
                            'type': 'raw_output',
                            'content': line,
                            'parse_error': str(e)
                        })}\n\n"
                
                # Wait for process to complete and check return code
                process.wait()
                if process.returncode != 0:
                    stderr_output = process.stderr.read()
                    yield f"data: {json.dumps({'type': 'error', 'error': f'Claude Code failed: {stderr_output}'})}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        
        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'  # Disable nginx buffering
            }
        )
            
    except Exception as e:
        logger.error(f"Error setting up Claude Code streaming: {e}")
        return jsonify({'error': str(e)}), 500

# ========== REFLECTION SYSTEM ENDPOINTS ==========

@api_routes.route('/reflections/trigger', methods=['POST'])
def trigger_reflection():
    """Trigger reflection generation from upvote or thanks detection"""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['node_id', 'chat_id', 'trigger_type', 'trigger_message_index']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Get the node from database directly
        from ChatPersistenceService import Node
        node_record = Node.query.get(data['node_id'])
        if not node_record:
            return jsonify({'error': 'Node not found'}), 404
        
        messages = node_record.messages or []
        if not messages:
            return jsonify({'error': 'No messages found in node'}), 400
        
        # Use router agent to analyze conversation
        trigger_data = {
            'node_id': data['node_id'],
            'chat_id': data['chat_id'],
            'trigger_type': data['trigger_type'],
            'trigger_message_index': data['trigger_message_index']
        }
        
        # Analyze conversation with router agent
        reflection_data = router_agent_service.analyze_conversation_for_reflection(messages, trigger_data)
        
        # Create reflection in database
        reflection_id = reflection_service.create_reflection(reflection_data)
        
        return jsonify({
            'reflection_id': reflection_id,
            'message': 'Reflection created successfully',
            'reflection_data': reflection_data
        })
        
    except Exception as e:
        logger.error(f"Error triggering reflection: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/<reflection_id>', methods=['GET'])
def get_reflection(reflection_id):
    """Get a specific reflection by ID"""
    try:
        reflection = reflection_service.get_reflection(reflection_id)
        if not reflection:
            return jsonify({'error': 'Reflection not found'}), 404
        
        return jsonify(reflection)
        
    except Exception as e:
        logger.error(f"Error getting reflection: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/search', methods=['POST'])
def search_reflections():
    """Search for relevant reflections based on current context"""
    try:
        data = request.json
        
        # Get search parameters
        query_params = {
            'keywords': data.get('keywords', []),
            'technologies': data.get('technologies', []),
            'domains': data.get('domains', []),
            'complexity': data.get('complexity'),
            'min_relevance_score': data.get('min_relevance_score', 0.1),
            'limit': data.get('limit', 10),
            'exclude_node_id': data.get('exclude_node_id'),
            'exclude_chat_id': data.get('exclude_chat_id')
        }
        
        # Search reflections
        reflections = reflection_service.search_reflections(query_params)
        
        return jsonify({
            'reflections': reflections,
            'count': len(reflections)
        })
        
    except Exception as e:
        logger.error(f"Error searching reflections: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/suggest', methods=['POST'])
def suggest_reflections():
    """Get reflection suggestions for current conversation context"""
    try:
        data = request.json
        
        if 'messages' not in data:
            return jsonify({'error': 'Messages are required'}), 400
        
        messages = data['messages']
        node_id = data.get('node_id')
        chat_id = data.get('chat_id')
        
        # Analyze current context
        context = router_agent_service.analyze_current_conversation_context(messages)
        
        # Search for relevant reflections
        query_params = {
            'keywords': context['keywords'],
            'technologies': context['technologies'],
            'domains': context['domains'],
            'complexity': context['complexity'],
            'min_relevance_score': 0.3,
            'limit': 5,
            'exclude_node_id': node_id,
            'exclude_chat_id': chat_id
        }
        
        reflections = reflection_service.search_reflections(query_params)
        
        return jsonify({
            'suggestions': reflections,
            'context': context,
            'count': len(reflections)
        })
        
    except Exception as e:
        logger.error(f"Error getting reflection suggestions: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/<reflection_id>/feedback', methods=['POST'])
def provide_reflection_feedback(reflection_id):
    """Provide feedback on reflection helpfulness"""
    try:
        data = request.json
        
        if 'helpful' not in data:
            return jsonify({'error': 'helpful field is required (true/false)'}), 400
        
        was_helpful = data['helpful']
        success = reflection_service.update_reflection_usage(reflection_id, was_helpful)
        
        if not success:
            return jsonify({'error': 'Reflection not found'}), 404
        
        return jsonify({'message': 'Feedback recorded successfully'})
        
    except Exception as e:
        logger.error(f"Error recording feedback: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/node/<node_id>', methods=['GET'])
def get_reflections_by_node(node_id):
    """Get all reflections for a specific node"""
    try:
        reflections = reflection_service.get_reflections_by_node(node_id)
        return jsonify({
            'reflections': reflections,
            'count': len(reflections)
        })
        
    except Exception as e:
        logger.error(f"Error getting node reflections: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/chat/<chat_id>', methods=['GET'])
def get_reflections_by_chat(chat_id):
    """Get all reflections for a specific chat"""
    try:
        reflections = reflection_service.get_reflections_by_chat(chat_id)
        return jsonify({
            'reflections': reflections,
            'count': len(reflections)
        })
        
    except Exception as e:
        logger.error(f"Error getting chat reflections: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/stats', methods=['GET'])
def get_reflection_stats():
    """Get reflection system statistics"""
    try:
        stats = reflection_service.get_reflection_stats()
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error getting reflection stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/recent', methods=['GET'])
def get_recent_reflections():
    """Get recent reflections"""
    try:
        limit = request.args.get('limit', 10, type=int)
        days = request.args.get('days', 30, type=int)
        
        reflections = reflection_service.get_recent_reflections(limit, days)
        return jsonify({
            'reflections': reflections,
            'count': len(reflections)
        })
        
    except Exception as e:
        logger.error(f"Error getting recent reflections: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/top', methods=['GET'])
def get_top_reflections():
    """Get highest scoring reflections"""
    try:
        limit = request.args.get('limit', 10, type=int)
        
        reflections = reflection_service.get_top_reflections(limit)
        return jsonify({
            'reflections': reflections,
            'count': len(reflections)
        })
        
    except Exception as e:
        logger.error(f"Error getting top reflections: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/<reflection_id>', methods=['DELETE'])
def delete_reflection(reflection_id):
    """Delete a reflection"""
    try:
        success = reflection_service.delete_reflection(reflection_id)
        if not success:
            return jsonify({'error': 'Reflection not found'}), 404
        
        return jsonify({'message': 'Reflection deleted successfully'})
        
    except Exception as e:
        logger.error(f"Error deleting reflection: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/similarity-search', methods=['POST'])
def search_reflections_by_similarity():
    """Search for reflections using semantic similarity"""
    try:
        data = request.get_json()
        query_text = data.get('query_text')
        limit = data.get('limit', 10)
        similarity_threshold = data.get('similarity_threshold', 0.7)
        
        if not query_text:
            return jsonify({'error': 'query_text is required'}), 400
        
        results = reflection_service.search_reflections_by_similarity(
            query_text, limit, similarity_threshold
        )
        
        return jsonify({
            'reflections': results,
            'query': query_text,
            'total_results': len(results)
        })
        
    except Exception as e:
        logger.error(f"Error in similarity search: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/<reflection_id>/related', methods=['GET'])
def get_related_reflections(reflection_id):
    """Get reflections related to a specific reflection"""
    try:
        limit = int(request.args.get('limit', 5))
        
        related = reflection_service.find_related_reflections(reflection_id, limit)
        
        return jsonify({
            'related_reflections': related,
            'source_reflection_id': reflection_id,
            'total_results': len(related)
        })
        
    except Exception as e:
        logger.error(f"Error getting related reflections: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/<reflection_id>/update-embeddings', methods=['POST'])
def update_reflection_embeddings(reflection_id):
    """Regenerate embeddings for a specific reflection"""
    try:
        success = reflection_service.update_reflection_embeddings(reflection_id)
        
        if not success:
            return jsonify({'error': 'Failed to update embeddings or reflection not found'}), 404
        
        return jsonify({'message': 'Embeddings updated successfully'})
        
    except Exception as e:
        logger.error(f"Error updating reflection embeddings: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/advanced-search', methods=['POST'])
def advanced_reflection_search():
    """Search reflections using advanced criteria and metadata"""
    try:
        data = request.get_json()
        criteria = data.get('criteria', {})
        
        results = reflection_service.search_by_advanced_criteria(criteria)
        
        return jsonify({
            'reflections': results,
            'criteria': criteria,
            'total_results': len(results)
        })
        
    except Exception as e:
        logger.error(f"Error in advanced reflection search: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/<reflection_id>/metadata', methods=['GET'])
def get_reflection_metadata(reflection_id):
    """Get detailed metadata for a specific reflection"""
    try:
        metadata = reflection_service.get_reflection_metadata(reflection_id)
        
        if not metadata:
            return jsonify({'error': 'Reflection not found'}), 404
        
        return jsonify({
            'reflection_id': reflection_id,
            'metadata': metadata
        })
        
    except Exception as e:
        logger.error(f"Error getting reflection metadata: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/keyword-search', methods=['POST'])
def keyword_pattern_search():
    """Search reflections by keyword patterns"""
    try:
        data = request.get_json()
        
        technical_keywords = data.get('technical_keywords')
        error_keywords = data.get('error_keywords')
        domains = data.get('domains')
        complexity = data.get('complexity')
        limit = data.get('limit', 10)
        
        results = reflection_service.search_reflections_by_keyword_patterns(
            technical_keywords=technical_keywords,
            error_keywords=error_keywords,
            domains=domains,
            complexity=complexity,
            limit=limit
        )
        
        return jsonify({
            'reflections': results,
            'search_criteria': {
                'technical_keywords': technical_keywords,
                'error_keywords': error_keywords,
                'domains': domains,
                'complexity': complexity
            },
            'total_results': len(results)
        })
        
    except Exception as e:
        logger.error(f"Error in keyword pattern search: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/update-all-metadata', methods=['POST'])
def update_all_reflection_metadata():
    """Update metadata for all existing reflections"""
    try:
        results = reflection_service.update_all_reflection_metadata()
        
        return jsonify({
            'message': 'Metadata update completed',
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error updating all reflection metadata: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/conversation/analyze-context', methods=['POST'])
def analyze_conversation_context():
    """Analyze current conversation context for reflection matching"""
    try:
        data = request.get_json()
        messages = data.get('messages', [])
        
        if not messages:
            return jsonify({'error': 'messages are required'}), 400
        
        # Analyze context
        context_data = router_agent_service.analyze_current_conversation_context(messages)
        
        # Get reflection suggestions based on context
        suggestions = router_agent_service.suggest_relevant_reflections(context_data, limit=5)
        
        return jsonify({
            'context': context_data,
            'reflection_suggestions': suggestions,
            'suggestion_count': len(suggestions)
        })
        
    except Exception as e:
        logger.error(f"Error analyzing conversation context: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/conversation/reflection-suggestions', methods=['POST'])
def get_reflection_suggestions():
    """Get reflection suggestions for current conversation"""
    try:
        data = request.get_json()
        messages = data.get('messages', [])
        limit = data.get('limit', 5)
        
        if not messages:
            return jsonify({'error': 'messages are required'}), 400
        
        # Analyze context first
        context_data = router_agent_service.analyze_current_conversation_context(messages)
        
        # Get suggestions
        suggestions = router_agent_service.suggest_relevant_reflections(context_data, limit=limit)
        
        return jsonify({
            'suggestions': suggestions,
            'context_summary': {
                'domains': context_data.get('domains', []),
                'technologies': context_data.get('technologies', []),
                'stage': context_data.get('conversation_stage', 'unknown'),
                'complexity': context_data.get('complexity', 'medium')
            },
            'total_suggestions': len(suggestions)
        })
        
    except Exception as e:
        logger.error(f"Error getting reflection suggestions: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/reflections/test-relevance-scoring', methods=['POST'])
def test_relevance_scoring():
    """Test enhanced relevance scoring with sample context data"""
    try:
        data = request.get_json()
        context_data = data.get('context_data', {})
        limit = data.get('limit', 5)
        min_score = data.get('min_score', 0.2)
        
        if not context_data:
            # Use sample context data for testing
            context_data = {
                'technologies': ['react', 'javascript'],
                'domains': ['frontend'],
                'keywords': ['component', 'useState', 'rendering'],
                'problem_patterns': ['state management'],
                'complexity': 'medium'
            }
        
        # Get contextual suggestions using enhanced scoring
        suggestions = reflection_service.get_contextual_reflection_suggestions(
            context_data, 
            limit=limit, 
            min_score=min_score
        )
        
        # Also get basic suggestions for comparison
        basic_suggestions = reflection_service.search_reflections({
            'technologies': context_data.get('technologies', []),
            'domains': context_data.get('domains', []),
            'keywords': context_data.get('keywords', []),
            'limit': limit
        })
        
        return jsonify({
            'enhanced_suggestions': suggestions,
            'basic_suggestions': basic_suggestions,
            'context_used': context_data,
            'enhanced_count': len(suggestions),
            'basic_count': len(basic_suggestions),
            'scoring_improvement': len(suggestions) - len(basic_suggestions)
        })
        
    except Exception as e:
        logger.error(f"Error testing relevance scoring: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Agent Configuration Endpoints

@api_routes.route('/agent-configs', methods=['GET'])
def get_agent_configs():
    """Get all agent configurations"""
    try:
        user_id = request.args.get('user_id')  # For future multi-user support
        configs = agent_config_service.get_all_agent_configs(user_id)
        return jsonify(configs)
    except Exception as e:
        logger.error(f"Error getting agent configs: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/agent-configs', methods=['POST'])
def create_agent_config():
    """Create a new agent configuration"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')  # For future multi-user support
        
        config_id = agent_config_service.create_agent_config(data, user_id)
        return jsonify({'id': config_id, 'message': 'Agent configuration created successfully'}), 201
    except Exception as e:
        logger.error(f"Error creating agent config: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/agent-configs/<config_id>', methods=['GET'])
def get_agent_config(config_id):
    """Get a specific agent configuration"""
    try:
        user_id = request.args.get('user_id')
        config = agent_config_service.get_agent_config(config_id, user_id)
        if not config:
            return jsonify({'error': 'Agent configuration not found'}), 404
        return jsonify(config)
    except Exception as e:
        logger.error(f"Error getting agent config: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/agent-configs/<config_id>', methods=['PUT'])
def update_agent_config(config_id):
    """Update an agent configuration"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        success = agent_config_service.update_agent_config(config_id, data, user_id)
        if not success:
            return jsonify({'error': 'Agent configuration not found'}), 404
        
        return jsonify({'message': 'Agent configuration updated successfully'})
    except Exception as e:
        logger.error(f"Error updating agent config: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/agent-configs/<config_id>', methods=['DELETE'])
def delete_agent_config(config_id):
    """Delete an agent configuration"""
    try:
        user_id = request.args.get('user_id')
        success = agent_config_service.delete_agent_config(config_id, user_id)
        if not success:
            return jsonify({'error': 'Agent configuration not found or cannot be deleted'}), 404
        
        return jsonify({'message': 'Agent configuration deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting agent config: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/agent-configs/set-model', methods=['POST'])
def set_agent_model():
    """Set model for a specific agent type"""
    try:
        data = request.get_json()
        agent_type = data.get('agent_type')
        model_data = data.get('model')
        user_id = data.get('user_id')
        
        if not agent_type or not model_data:
            return jsonify({'error': 'agent_type and model are required'}), 400
        
        success = agent_config_service.set_agent_model(agent_type, model_data, user_id)
        if not success:
            return jsonify({'error': 'Failed to set agent model'}), 400
        
        return jsonify({'message': 'Agent model set successfully'})
    except Exception as e:
        logger.error(f"Error setting agent model: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/agent-configs/defaults', methods=['POST'])
def create_default_agents():
    """Create default agent configurations"""
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id')
        
        created_ids = agent_config_service.create_default_agents(user_id)
        return jsonify({'created_agents': created_ids, 'message': f'Created {len(created_ids)} default agents'})
    except Exception as e:
        logger.error(f"Error creating default agents: {str(e)}")
        return jsonify({'error': str(e)}), 500

# API Key Endpoints

@api_routes.route('/api-keys', methods=['GET'])
def get_api_keys():
    """Get all API keys"""
    try:
        user_id = request.args.get('user_id')
        keys = agent_config_service.get_api_keys(user_id)
        # Don't return actual key values for security
        return jsonify({provider: '***' if key else '' for provider, key in keys.items()})
    except Exception as e:
        logger.error(f"Error getting API keys: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/api-keys', methods=['POST'])
def set_api_key():
    """Set an API key"""
    try:
        data = request.get_json()
        provider = data.get('provider')
        key_value = data.get('key_value')
        user_id = data.get('user_id')
        
        if not provider or not key_value:
            return jsonify({'error': 'provider and key_value are required'}), 400
        
        success = agent_config_service.set_api_key(provider, key_value, user_id)
        return jsonify({'message': 'API key set successfully'})
    except Exception as e:
        logger.error(f"Error setting API key: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/api-keys/<provider>', methods=['DELETE'])
def delete_api_key(provider):
    """Delete an API key"""
    try:
        user_id = request.args.get('user_id')
        success = agent_config_service.delete_api_key(provider, user_id)
        if not success:
            return jsonify({'error': 'API key not found'}), 404
        
        return jsonify({'message': 'API key deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting API key: {str(e)}")
        return jsonify({'error': str(e)}), 500

# System Message Endpoints

@api_routes.route('/system-messages', methods=['GET'])
def get_system_messages():
    """Get all system messages"""
    try:
        user_id = request.args.get('user_id')
        messages = agent_config_service.get_system_messages(user_id)
        return jsonify(messages)
    except Exception as e:
        logger.error(f"Error getting system messages: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/system-messages', methods=['POST'])
def set_system_message():
    """Set a system message"""
    try:
        data = request.get_json()
        agent_type = data.get('agent_type')
        message = data.get('message')
        user_id = data.get('user_id')
        agent_id = data.get('agent_id')
        
        if not agent_type or not message:
            return jsonify({'error': 'agent_type and message are required'}), 400
        
        success = agent_config_service.set_system_message(agent_type, message, user_id, agent_id)
        return jsonify({'message': 'System message set successfully'})
    except Exception as e:
        logger.error(f"Error setting system message: {str(e)}")
        return jsonify({'error': str(e)}), 500

# User Preference Endpoints

@api_routes.route('/preferences', methods=['GET'])
def get_preferences():
    """Get user preferences"""
    try:
        user_id = request.args.get('user_id')
        category = request.args.get('category')
        preferences = agent_config_service.get_preferences(category, user_id)
        return jsonify(preferences)
    except Exception as e:
        logger.error(f"Error getting preferences: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/preferences', methods=['POST'])
def set_preference():
    """Set a user preference"""
    try:
        data = request.get_json()
        key = data.get('key')
        value = data.get('value')
        category = data.get('category')
        user_id = data.get('user_id')
        
        if not key or value is None or not category:
            return jsonify({'error': 'key, value, and category are required'}), 400
        
        success = agent_config_service.set_preference(key, value, category, user_id)
        return jsonify({'message': 'Preference set successfully'})
    except Exception as e:
        logger.error(f"Error setting preference: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/preferences/<key>', methods=['DELETE'])
def delete_preference(key):
    """Delete a user preference"""
    try:
        user_id = request.args.get('user_id')
        success = agent_config_service.delete_preference(key, user_id)
        if not success:
            return jsonify({'error': 'Preference not found'}), 404
        
        return jsonify({'message': 'Preference deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting preference: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Migration Endpoint

@api_routes.route('/migrate-localstorage', methods=['POST'])
def migrate_localstorage():
    """Migrate data from localStorage format to database"""
    try:
        data = request.get_json()
        localStorage_data = data.get('localStorage_data')
        user_id = data.get('user_id')
        
        if not localStorage_data:
            return jsonify({'error': 'localStorage_data is required'}), 400
        
        results = agent_config_service.import_localStorage_data(localStorage_data, user_id)
        return jsonify({
            'message': 'LocalStorage data migrated successfully',
            'results': results
        })
    except Exception as e:
        logger.error(f"Error migrating localStorage: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Mock Data Generation Endpoints
@api_routes.route('/mock-data/generate', methods=['POST'])
def generate_mock_data():
    """Generate mock workspaces with configurable parameters"""
    try:
        data = request.get_json()
        
        total_nodes = data.get('totalNodes', 100)
        num_workspaces = data.get('numWorkspaces', 5)
        branching_factor = data.get('branchingFactor', 0.3)
        max_depth = data.get('maxDepth', 5)
        canvas_bounds = data.get('canvasBounds', {
            'width': 10000, 
            'height': 8000, 
            'margin': 500
        })
        
        # Validate parameters
        if total_nodes < 1 or num_workspaces < 1:
            return jsonify({'error': 'Total nodes and workspaces must be positive'}), 400
        
        if total_nodes < num_workspaces:
            return jsonify({'error': 'Total nodes must be at least equal to number of workspaces'}), 400
        
        # Generate configuration
        config = mock_data_service.generate_mock_workspace_config(
            total_nodes, num_workspaces, branching_factor, max_depth, canvas_bounds
        )
        
        # Create the workspaces
        import asyncio
        result = asyncio.run(mock_data_service.create_mock_workspaces(config))
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error generating mock data: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/mock-data/config', methods=['POST'])
def generate_mock_config():
    """Generate mock workspace configuration without creating data"""
    try:
        data = request.get_json()
        
        total_nodes = data.get('totalNodes', 100)
        num_workspaces = data.get('numWorkspaces', 5)
        branching_factor = data.get('branchingFactor', 0.3)
        max_depth = data.get('maxDepth', 5)
        canvas_bounds = data.get('canvasBounds', {
            'width': 10000, 
            'height': 8000, 
            'margin': 500
        })
        
        config = mock_data_service.generate_mock_workspace_config(
            total_nodes, num_workspaces, branching_factor, max_depth, canvas_bounds
        )
        
        return jsonify({
            'success': True,
            'config': config,
            'preview': {
                'estimated_nodes_per_workspace': [ws['node_count'] for ws in config['workspaces']],
                'total_estimated_size': sum(ws['node_count'] for ws in config['workspaces']),
                'canvas_coverage': f"{len(config['workspaces'])} workspaces across {canvas_bounds['width']}x{canvas_bounds['height']} canvas"
            }
        })
        
    except Exception as e:
        logger.error(f"Error generating mock config: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/mock-data/clear', methods=['POST'])
def clear_mock_data():
    """Clear all mock-generated data"""
    try:
        import asyncio
        result = asyncio.run(mock_data_service.clear_mock_data())
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error clearing mock data: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/clear-all-data', methods=['POST'])
def clear_all_data():
    """DANGER: Clear ALL data from the database including original workspaces"""
    try:
        # This will delete EVERYTHING - all chats and nodes
        success = chat_service.clear_all_data()
        
        if success:
            return jsonify({
                'success': True,
                'message': 'All data has been cleared from the database',
                'warning': 'This action deleted ALL chats and nodes, including original data'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to clear data'
            }), 500
            
    except Exception as e:
        logger.error(f"Error clearing all data: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/mock-data/status', methods=['GET'])
def get_mock_data_status():
    """Get information about existing mock data"""
    try:
        # This would need to query the database for mock data statistics
        # For now, return basic info
        return jsonify({
            'success': True,
            'mock_data_exists': False,  # Would check database
            'total_mock_nodes': 0,      # Would count mock nodes
            'total_mock_workspaces': 0, # Would count mock workspaces
            'last_generated': None      # Would check timestamp
        })
    except Exception as e:
        logger.error(f"Error getting mock data status: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/mock-data/debug-tree', methods=['POST'])
def debug_conversation_tree():
    """Debug conversation tree generation"""
    try:
        config = request.json
        total_nodes = config.get('totalNodes', 5)
        branching_factor = config.get('branchingFactor', 0.5)
        max_depth = config.get('maxDepth', 3)
        
        # Create mock data service
        mock_service = MockDataService(chat_service)
        
        # Generate a single conversation tree to debug
        tree = mock_service.generate_conversation_tree(
            total_nodes, branching_factor, max_depth, "Debug Tree"
        )
        
        return jsonify({
            'success': True,
            'tree': tree,
            'total_nodes_generated': len(tree),
            'config': {
                'totalNodes': total_nodes,
                'branchingFactor': branching_factor,
                'maxDepth': max_depth
            }
        })
    except Exception as e:
        logger.error(f"Error debugging conversation tree: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/debug/workspace-nodes/<chat_id>', methods=['GET'])
def debug_workspace_nodes(chat_id):
    """Debug endpoint to check actual node count in a specific workspace"""
    try:
        # Get the chat data
        chat_data = chat_service.get_chat(chat_id)
        if not chat_data:
            return jsonify({'error': 'Chat not found'}), 404
        
        nodes = chat_data.get('nodes', [])
        
        return jsonify({
            'success': True,
            'chat_id': chat_id,
            'chat_title': chat_data.get('title', 'Unknown'),
            'claimed_nodes': len(nodes),
            'actual_nodes': len(nodes),
            'node_details': [
                {
                    'id': node.get('id'),
                    'title': node.get('title'),
                    'type': node.get('type'),
                    'parent_id': node.get('parentId'),
                    'x': node.get('x'),
                    'y': node.get('y')
                } for node in nodes
            ]
        })
    except Exception as e:
        logger.error(f"Error debugging workspace nodes: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/debug/all-workspace-counts', methods=['GET'])
def debug_all_workspace_counts():
    """Debug endpoint to check node counts for all workspaces"""
    try:
        chat_summaries = chat_service.list_chats()
        workspace_stats = []
        
        for chat_summary in chat_summaries:
            try:
                chat_data = chat_service.get_chat(chat_summary['id'])
                if chat_data:
                    nodes = chat_data.get('nodes', [])
                    
                    # Safely get first 5 node titles
                    node_titles = []
                    if nodes:
                        try:
                            for i, node in enumerate(nodes):
                                if i >= 5:  # Only first 5
                                    break
                                if isinstance(node, dict):
                                    node_titles.append(node.get('title', 'Untitled'))
                                else:
                                    node_titles.append(str(node))
                        except Exception as e:
                            node_titles = [f"Error processing nodes: {e}"]
                    
                    workspace_stats.append({
                        'id': chat_summary['id'],
                        'title': chat_summary.get('title', 'Unknown'),
                        'claimed_nodes': len(nodes) if nodes else 0,
                        'actual_node_count': len(nodes) if nodes else 0,
                        'node_titles': node_titles,
                        'nodes_type': str(type(nodes)),
                        'first_node_type': str(type(nodes[0])) if nodes else 'N/A'
                    })
            except Exception as e:
                workspace_stats.append({
                    'id': chat_summary['id'], 
                    'title': chat_summary.get('title', 'Unknown'),
                    'error': str(e)
                })
        
        return jsonify({
            'success': True,
            'total_workspaces': len(workspace_stats),
            'workspaces': workspace_stats
        })
    except Exception as e:
        logger.error(f"Error debugging workspace counts: {e}")
        return jsonify({'error': str(e)}), 500

@api_routes.route('/all-nodes', methods=['GET'])
def get_all_nodes():
    """Get ALL nodes from ALL chats for simultaneous canvas rendering"""
    try:
        all_nodes = []
        all_connections = []
        
        # Get all chat summaries
        chat_summaries = chat_service.list_chats()
        
        def flatten_nodes(node_data, chat_id, workspace_title):
            """Recursively flatten hierarchical node structure into list"""
            nodes_list = []
            
            if node_data and node_data.get('id'):
                # Convert node to dict format expected by frontend
                node_dict = {
                    'id': node_data.get('id'),
                    'chatId': chat_id,
                    'workspaceTitle': workspace_title,
                    'parentId': node_data.get('parentId'),
                    'type': node_data.get('type', 'main'),
                    'title': node_data.get('title', 'Untitled'),
                    'x': float(node_data.get('x', 0)),
                    'y': float(node_data.get('y', 0)),
                    'messages': node_data.get('messages', []),
                    'metadata': node_data.get('metadata', {}),
                    'branchMessageIndex': node_data.get('branchMessageIndex'),
                    'created_at': node_data.get('created_at')
                }
                nodes_list.append(node_dict)
                
                # Create connection if has parent
                if node_data.get('parentId'):
                    connection = {
                        'id': f"{node_data.get('parentId')}-{node_data.get('id')}",
                        'startNodeId': node_data.get('parentId'),
                        'endNodeId': node_data.get('id'),
                        'type': 'parent-child',
                        'chatId': chat_id
                    }
                    all_connections.append(connection)
                
                # Recursively process children
                children = node_data.get('children', [])
                for child in children:
                    nodes_list.extend(flatten_nodes(child, chat_id, workspace_title))
            
            return nodes_list
        
        # Load each chat with full data including nodes
        for chat_summary in chat_summaries:
            try:
                # Get full chat data with hierarchical nodes
                full_chat_data = chat_service.get_chat(chat_summary['id'])
                if full_chat_data and 'nodes' in full_chat_data:
                    # Flatten the hierarchical node structure
                    workspace_nodes = flatten_nodes(
                        full_chat_data['nodes'], 
                        chat_summary['id'], 
                        chat_summary.get('title', 'Untitled Workspace')
                    )
                    all_nodes.extend(workspace_nodes)
                    
            except Exception as e:
                logger.warning(f"Error loading chat {chat_summary['id']}: {e}")
                continue
        
        return jsonify({
            'success': True,
            'nodes': all_nodes,
            'connections': all_connections,
            'totalNodes': len(all_nodes),
            'totalWorkspaces': len(chat_summaries) if chat_summaries else 0
        })
        
    except Exception as e:
        logger.error(f"Error getting all nodes: {e}")
        return jsonify({'error': str(e)}), 500


def generate_simple_topic_label(titles):
    """Generate a simple topic label from workspace titles."""
    if not titles:
        return "Unknown Topic"
    
    if len(titles) == 1:
        return titles[0]
    
    # Extract common words from titles
    all_words = []
    for title in titles:
        words = title.lower().split()
        # Filter out common words
        meaningful_words = [w for w in words if len(w) > 3 and w not in ['chat', 'conversation', 'untitled', 'workspace']]
        all_words.extend(meaningful_words)
    
    if all_words:
        # Count word frequency
        word_counts = {}
        for word in all_words:
            word_counts[word] = word_counts.get(word, 0) + 1
        
        # Find most common meaningful word
        if word_counts:
            most_common_word = max(word_counts.items(), key=lambda x: x[1])
            if most_common_word[1] > 1:  # Appears in multiple titles
                return f"{most_common_word[0].title()} Discussion"
    
    # Fallback to first title or generic name
    return titles[0] if titles else f"Topic Group"

def generate_batch_topic_labels(clusters_data):
    """Generate descriptive topic labels for multiple clusters in a single LLM request."""
    try:
        # Prepare structured input for batch processing
        clusters_input = []
        for i, cluster_data in enumerate(clusters_data):
            titles = cluster_data['titles']
            keywords = cluster_data['keywords']
            contents = cluster_data['contents']
            
            clusters_input.append({
                "cluster_id": i,
                "workspace_count": len(titles),
                "sample_titles": titles[:4],  # First 4 titles
                "keywords": keywords[:5],     # Top 5 keywords
                "content_sample": ' '.join(contents[:2])[:400]  # Brief content sample
            })
        
        # Create structured prompt for batch processing
        prompt = f"""You are a workspace categorization expert. Given the following clusters of workspaces, generate descriptive 2-4 word labels for each cluster.

Input clusters (JSON):
{json.dumps(clusters_input, indent=2)}

Requirements for each label:
- 2-4 words maximum
- Descriptive and professional
- Specific to the cluster content
- Avoid generic terms like "Discussion", "Projects", "Group"
- Use technical terms when appropriate (e.g., "React Development", "API Architecture", "DevOps Pipeline")
- Consider both keywords AND workspace titles

Return ONLY a JSON object with cluster_id as key and descriptive label as value:
{{"0": "Frontend Architecture", "1": "Backend APIs", "2": "Mobile Development"}}

Labels:"""

        # Use a slightly larger model for better batch processing
        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                'model': 'qwen3:0.6b',  # Could also try qwen3:3b if available
                'prompt': prompt,
                'stream': False,
                'options': {
                    'temperature': 0.2,  # Lower temperature for more consistent formatting
                    'num_predict': 150,  # More tokens for batch response
                }
            },
            timeout=30  # Longer timeout for batch processing
        )
        
        if response.status_code == 200:
            result = response.json()
            generated_response = result.get('response', '').strip()
            
            # Clean up and extract JSON
            import re
            # Remove any text before the JSON object
            json_match = re.search(r'\{[^}]*\}', generated_response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                try:
                    labels_dict = json.loads(json_str)
                    # Validate and clean labels
                    cleaned_labels = {}
                    for cluster_id, label in labels_dict.items():
                        if label and len(label) < 60 and len(label.split()) <= 5:
                            cleaned_labels[cluster_id] = label.strip('"\'.,;:!?\n- ').title()
                    
                    if cleaned_labels:
                        logger.info(f"Generated {len(cleaned_labels)} batch labels via LLM")
                        return cleaned_labels
                        
                except json.JSONDecodeError:
                    logger.warning("Failed to parse JSON from LLM batch response")
        
    except Exception as e:
        logger.warning(f"Batch LLM topic generation failed: {e}")
    
    # Fallback to individual processing
    logger.info("Falling back to individual label generation")
    return None

def generate_descriptive_fallback_label(titles, keywords, content_sample):
    """Generate a more descriptive fallback label using keywords and titles."""
    # Combine titles and keywords for analysis
    all_terms = []
    
    # Extract meaningful terms from titles
    for title in titles[:3]:
        terms = re.findall(r'\b[a-zA-Z]{3,}\b', title.lower())
        all_terms.extend([t for t in terms if t not in {'the', 'and', 'for', 'with', 'chat', 'discussion'}])
    
    # Add keywords
    all_terms.extend(keywords[:3])
    
    # Count frequency and find most meaningful combinations
    from collections import Counter
    term_counts = Counter(all_terms)
    
    # Try to create compound labels
    top_terms = [term for term, count in term_counts.most_common(3)]
    
    if len(top_terms) >= 2:
        # Create combinations
        if any(tech in top_terms for tech in ['api', 'backend', 'frontend', 'mobile', 'web']):
            tech_term = next(t for t in top_terms if t in ['api', 'backend', 'frontend', 'mobile', 'web'])
            other_terms = [t for t in top_terms if t != tech_term and t not in {'development', 'system', 'application'}]
            if other_terms:
                return f"{tech_term.title()} {other_terms[0].title()}"
            return f"{tech_term.title()} Development"
        
        # General combination
        return f"{top_terms[0].title()} {top_terms[1].title()}"
    
    # Single term with context
    if top_terms:
        base_term = top_terms[0].title()
        if base_term.lower() in ['design', 'ui', 'ux']:
            return f"{base_term} System"
        elif base_term.lower() in ['data', 'analytics']:
            return f"{base_term} Pipeline"
        elif base_term.lower() in ['test', 'testing']:
            return f"{base_term} Strategy"
        else:
            return f"{base_term} Architecture"
    
    return "Development Topic"

@api_routes.route('/workspaces/cluster', methods=['POST'])
def cluster_workspaces():
    """Cluster workspaces by semantic similarity and generate topic labels."""
    try:
        data = request.json or {}
        use_existing_data = data.get('use_existing_data', False)
        
        # CRITICAL: Check for cached results first for fast startup
        # Try file-based cache first for persistence across restarts
        import pickle
        cache_file = Path('clustering_cache.pkl')
        try:
            if cache_file.exists():
                with open(cache_file, 'rb') as f:
                    cache_data = pickle.load(f)
                cache_age = (datetime.now() - cache_data.get('timestamp', datetime.min)).total_seconds()
                if cache_age < 3600:  # Use cache if less than 1 hour old (was 5 minutes)
                    logger.info(f"Using file-cached workspace clustering results (age: {cache_age:.1f}s)")
                    return jsonify(cache_data['result'])
        except Exception as e:
            logger.warning(f"Failed to load clustering cache file: {e}")
        
        # Fallback to memory cache
        if hasattr(clustering_service, 'workspace_clustering_cache'):
            cache_age = (datetime.now() - clustering_service.workspace_clustering_cache.get('timestamp', datetime.min)).total_seconds()
            if cache_age < 3600:  # Use cache if less than 1 hour old (was 5 minutes)
                logger.info(f"Using memory-cached workspace clustering results (age: {cache_age:.1f}s)")
                return jsonify(clustering_service.workspace_clustering_cache['result'])
        
        if use_existing_data:
            # Use existing workspace data from database
            chats = chat_service.list_chats()
            if not chats:
                return jsonify({'error': 'No workspaces found'}), 400
            
            workspace_titles = []
            workspace_contents = []
            
            for chat in chats:
                title = chat.get('title', f'Workspace {len(workspace_titles) + 1}')
                workspace_titles.append(title)
                
                # Extract content from nodes
                content_parts = []
                nodes = chat.get('nodes', [])
                if isinstance(nodes, list):
                    for node in nodes[:3]:  # First 3 nodes to avoid too much content
                        if isinstance(node, dict):
                            messages = node.get('messages', [])
                            for msg in messages[:2]:  # First 2 messages per node
                                if isinstance(msg, dict) and msg.get('content'):
                                    content_parts.append(str(msg['content'])[:500])
                elif isinstance(nodes, dict):
                    # Single node structure
                    messages = nodes.get('messages', [])
                    for msg in messages[:5]:  # First 5 messages
                        if isinstance(msg, dict) and msg.get('content'):
                            content_parts.append(str(msg['content'])[:500])
                
                workspace_contents.append(' '.join(content_parts) if content_parts else title)
        else:
            # Use provided data
            workspace_titles = data.get('titles', [])
            workspace_contents = data.get('contents', [])
            
            if not workspace_titles or not workspace_contents:
                return jsonify({'error': 'Both titles and contents are required'}), 400
            
            if len(workspace_titles) != len(workspace_contents):
                return jsonify({'error': 'Titles and contents arrays must have same length'}), 400
        
        # Content-based topic discovery using word frequency analysis
        logger.info(f"Discovering topics from {len(workspace_titles)} workspaces using content analysis")
        
        # Extract key terms from all workspace content
        all_content_words = []
        workspace_word_vectors = []
        
        import re
        from collections import Counter
        
        # Common stop words to filter out
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'cant', 'wont', 'dont',
            'what', 'where', 'when', 'why', 'how', 'who', 'which', 'whose', 'whom'
        }
        
        # Process each workspace content
        for i, content in enumerate(workspace_contents):
            combined_text = f"{workspace_titles[i]} {content}".lower()
            # Extract meaningful words (3+ characters, alphanumeric)
            words = re.findall(r'\b[a-z]{3,}\b', combined_text)
            # Filter out stop words and common technical terms
            meaningful_words = [w for w in words if w not in stop_words and len(w) > 3]
            workspace_word_vectors.append(Counter(meaningful_words))
            all_content_words.extend(meaningful_words)
        
        # Find most common meaningful terms across all workspaces
        global_word_freq = Counter(all_content_words)
        # Get top frequent words but not too common (appearing in < 80% of workspaces)
        max_workspace_freq = len(workspace_titles) * 0.8
        candidate_topics = [word for word, freq in global_word_freq.most_common(100) 
                           if freq >= 2 and freq < max_workspace_freq]
        
        logger.info(f"Found {len(candidate_topics)} candidate topic words: {candidate_topics[:10]}")
        
        # Dynamic clustering based on content similarity
        clusters = []
        workspace_clusters = {}  # workspace_index -> cluster_id
        
        # Create initial clusters based on dominant topic words
        for i, word_vector in enumerate(workspace_word_vectors):
            # Find the most relevant topic words for this workspace
            workspace_topics = []
            for topic_word in candidate_topics[:20]:  # Check top 20 topic candidates
                if word_vector.get(topic_word, 0) > 0:
                    workspace_topics.append((topic_word, word_vector[topic_word]))
            
            # Sort by frequency in this workspace
            workspace_topics.sort(key=lambda x: x[1], reverse=True)
            
            # Assign to cluster based on top topic word
            if workspace_topics:
                primary_topic = workspace_topics[0][0]
                
                # Find existing cluster with this topic or create new one
                cluster_id = None
                for j, cluster in enumerate(clusters):
                    if cluster['primary_topic'] == primary_topic:
                        cluster_id = j
                        break
                
                if cluster_id is None:
                    # Create new cluster
                    cluster_id = len(clusters)
                    clusters.append({
                        'id': cluster_id,
                        'primary_topic': primary_topic,
                        'workspaces': [],
                        'all_topics': Counter()
                    })
                
                # Add workspace to cluster
                clusters[cluster_id]['workspaces'].append(i)
                clusters[cluster_id]['all_topics'].update([t[0] for t in workspace_topics])
                workspace_clusters[i] = cluster_id
            else:
                # No clear topics - assign to "misc" cluster
                misc_cluster_id = None
                for j, cluster in enumerate(clusters):
                    if cluster['primary_topic'] == 'miscellaneous':
                        misc_cluster_id = j
                        break
                
                if misc_cluster_id is None:
                    misc_cluster_id = len(clusters)
                    clusters.append({
                        'id': misc_cluster_id,
                        'primary_topic': 'miscellaneous',
                        'workspaces': [],
                        'all_topics': Counter()
                    })
                
                clusters[misc_cluster_id]['workspaces'].append(i)
                workspace_clusters[i] = misc_cluster_id
        
        # Prepare data for batch topic label generation
        clusters_for_labeling = []
        for cluster in clusters:
            if cluster['workspaces']:  # Only include non-empty clusters
                workspace_indices = cluster['workspaces']
                cluster_titles = [workspace_titles[i] for i in workspace_indices]
                cluster_contents = [workspace_contents[i][:500] for i in workspace_indices]
                top_topics = [word for word, _ in cluster['all_topics'].most_common(5)]
                
                clusters_for_labeling.append({
                    'original_cluster': cluster,
                    'titles': cluster_titles,
                    'contents': cluster_contents,
                    'keywords': top_topics
                })
        
        # Generate topic labels in batch
        batch_labels = generate_batch_topic_labels(clusters_for_labeling)
        
        # Generate cluster metadata with batch-generated or fallback labels
        cluster_metadata = {}
        
        for i, cluster_data in enumerate(clusters_for_labeling):
            cluster = cluster_data['original_cluster']
            cluster_id = cluster['id']
            workspace_indices = cluster['workspaces']
            cluster_titles = cluster_data['titles']
            top_topics = cluster_data['keywords']
            
            # Get label from batch generation or use fallback
            if batch_labels and str(i) in batch_labels:
                topic_label = batch_labels[str(i)]
                logger.info(f"Using batch-generated label for cluster {cluster_id}: '{topic_label}'")
            else:
                # Use enhanced fallback labeling
                try:
                    topic_label = generate_descriptive_fallback_label(
                        cluster_titles, 
                        top_topics, 
                        ' '.join(cluster_data['contents'][:2])
                    )
                    logger.info(f"Using fallback label for cluster {cluster_id}: '{topic_label}'")
                except Exception as e:
                    logger.warning(f"Fallback labeling failed for cluster {cluster_id}: {e}")
                    topic_label = cluster['primary_topic'].title().replace('_', ' ')
            
            # Calculate cluster coherence based on topic word overlap
            coherence = min(1.0, len(cluster['all_topics']) / max(1, len(workspace_indices)))
            
            cluster_metadata[str(cluster_id)] = {
                'topic': topic_label,
                'size': len(workspace_indices),
                'coherence': coherence,
                'keywords': top_topics[:3]
            }
            
            logger.info(f"Final cluster {cluster_id}: '{topic_label}' with {len(workspace_indices)} workspaces, keywords: {top_topics[:3]}")
        
        # Convert to expected cluster format
        cluster_assignments = [workspace_clusters.get(i, 0) for i in range(len(workspace_titles))]
        clusters_array = np.array(cluster_assignments)
        
        logger.info(f"Created {len(cluster_metadata)} dynamic clusters based on content analysis")
        
        # Calculate solar system layout with topic islands and orbital workspaces
        topic_positions, workspace_positions = calculate_solar_system_layout(
            cluster_metadata, clusters_array, workspace_titles
        )
        
        # Prepare response
        response_data = {
            'success': True,
            'clusters': clusters_array.tolist(),
            'topics': cluster_metadata,
            'topic_positions': topic_positions,
            'workspace_positions': workspace_positions
        }
        
        # CRITICAL: Cache the result for fast future requests
        cache_data = {
            'result': response_data,
            'timestamp': datetime.now()
        }
        
        # Save to memory cache
        clustering_service.workspace_clustering_cache = cache_data
        
        # Save to file cache for persistence across restarts
        try:
            import pickle
            with open('clustering_cache.pkl', 'wb') as f:
                pickle.dump(cache_data, f)
            logger.info("Cached workspace clustering results to file and memory for fast future requests")
        except Exception as e:
            logger.warning(f"Failed to save clustering cache to file: {e}")
            logger.info("Cached workspace clustering results to memory only")
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error clustering workspaces: {e}")
        return jsonify({'error': str(e)}), 500


def calculate_solar_system_layout(cluster_metadata, clusters_array, workspace_titles):
    """Calculate solar system layout: topic islands with orbital workspaces."""
    import math
    
    # Solar system layout constants - ISOLATED CLUSTERS (no overlap)
    MAX_ORBITAL_RADIUS = 700     # Maximum orbital radius (400 base + 150*2 rings + buffer)
    ISOLATION_BUFFER = 200       # Extra buffer between territories  
    TOPIC_SEPARATION = (MAX_ORBITAL_RADIUS * 2) + ISOLATION_BUFFER  # Total: 1600px minimum between topic centers
    TOPIC_HORIZONTAL_GAP = 20000  # Massive gaps to prevent workspace node tree overlap
    TOPIC_VERTICAL_GAP = 16000    # Massive vertical separation for complete isolation
    TOPIC_START_X = 2000         # Starting position for first topic
    TOPIC_START_Y = 2000
    ORBITAL_BASE_RADIUS = 400    # Base orbital radius around topics (increased to clear 600x200px labels)
    ORBITAL_RADIUS_INCREMENT = 150  # Additional radius per orbital ring
    MIN_WORKSPACE_DISTANCE = 400 # Minimum distance between workspaces
    
    topics = list(cluster_metadata.keys())
    logger.info(f"Calculating solar system layout for {len(topics)} topics")
    
    # Step 1: Position topic islands using circular layout around center (0, 0)
    CENTER_X = 0
    CENTER_Y = 0
    MIN_TOPIC_SEPARATION = (MAX_ORBITAL_RADIUS * 2) + ISOLATION_BUFFER  # 1600px minimum between topic centers
    
    topic_positions = {}
    
    if len(topics) == 1:
        # Single topic at center
        topic_positions[topics[0]] = {"x": CENTER_X, "y": CENTER_Y}
        logger.info(f"Single topic '{cluster_metadata[topics[0]]['topic']}' positioned at center (0, 0)")
    else:
        # Multiple topics arranged in concentric circles
        topics_per_circle = 6  # Maximum 6 topics per circle for optimal spacing
        
        for i, topic_id in enumerate(topics):
            if i < topics_per_circle:
                # Inner circle - massive radius for min zoom visibility  
                circle_radius = 25000  # 25000px from center for excellent spacing at 0.99% zoom
                topics_in_this_circle = min(len(topics), topics_per_circle)
                angle = (2 * math.pi * i) / topics_in_this_circle
            else:
                # Outer circles - add 12000px for each additional ring
                ring_number = (i - topics_per_circle) // topics_per_circle + 1
                circle_radius = 25000 + (ring_number * 12000)
                position_in_ring = (i - topics_per_circle) % topics_per_circle
                remaining_topics = len(topics) - topics_per_circle - (ring_number - 1) * topics_per_circle
                topics_in_this_circle = min(topics_per_circle, remaining_topics)
                angle = (2 * math.pi * position_in_ring) / topics_in_this_circle
            
            # Start from top (angle offset -π/2)
            angle_offset = -math.pi / 2
            final_angle = angle + angle_offset
            
            topic_x = CENTER_X + math.cos(final_angle) * circle_radius
            topic_y = CENTER_Y + math.sin(final_angle) * circle_radius
            
            topic_positions[topic_id] = {
                "x": topic_x,
                "y": topic_y
            }
            
            topic_name = cluster_metadata[topic_id]['topic']
            workspace_count = cluster_metadata[topic_id]['size']
            ring_info = f"center" if i == 0 and len(topics) == 1 else f"circle {(i // topics_per_circle) + 1}"
            logger.info(f"Topic '{topic_name}' positioned at ({topic_x:.0f}, {topic_y:.0f}) in {ring_info} with {workspace_count} workspaces")
    
    # Step 2: Calculate orbital positions for workspaces around their topics
    workspace_positions = {}
    topic_workspace_counts = defaultdict(int)
    
    for workspace_idx, cluster_id in enumerate(clusters_array):
        cluster_id_str = str(cluster_id)
        
        if cluster_id_str not in topic_positions:
            logger.warning(f"Workspace {workspace_idx} assigned to unknown topic {cluster_id_str}")
            continue
            
        topic_pos = topic_positions[cluster_id_str]
        workspace_count_in_topic = topic_workspace_counts[cluster_id_str]
        total_workspaces_in_topic = cluster_metadata[cluster_id_str]['size']
        
        # Calculate orbital position
        # Calculate orbital ring and position for symmetrical distribution
        workspaces_per_ring = 8  # Perfect octagon spacing (8 equally spaced positions)
        ring_number = workspace_count_in_topic // workspaces_per_ring
        position_in_ring = workspace_count_in_topic % workspaces_per_ring
        
        # Calculate radius for this ring
        orbital_radius = ORBITAL_BASE_RADIUS + (ring_number * ORBITAL_RADIUS_INCREMENT)
        
        # Calculate EXACT angle for perfect symmetrical spacing
        workspaces_this_ring = min(workspaces_per_ring, total_workspaces_in_topic - (ring_number * workspaces_per_ring))
        angle_step = (2 * math.pi) / workspaces_this_ring
        angle = position_in_ring * angle_step
        
        # Start at top (0 degrees = right, -π/2 = top)
        angle_offset = -math.pi / 2  # Start from top instead of right
        final_angle = angle + angle_offset
        
        # NO JITTER - Perfect symmetrical placement
        orbital_x = topic_pos["x"] + math.cos(final_angle) * orbital_radius
        orbital_y = topic_pos["y"] + math.sin(final_angle) * orbital_radius
        
        workspace_positions[workspace_idx] = {
            "orbital_x": orbital_x,
            "orbital_y": orbital_y,
            "topic_id": cluster_id_str,
            "topic_center_x": topic_pos["x"],
            "topic_center_y": topic_pos["y"],
            "orbital_ring": workspace_count_in_topic // 6
        }
        
        topic_workspace_counts[cluster_id_str] += 1
        
        workspace_title = workspace_titles[workspace_idx] if workspace_idx < len(workspace_titles) else f"Workspace {workspace_idx}"
        logger.info(f"Workspace '{workspace_title[:30]}...' orbiting {cluster_metadata[cluster_id_str]['topic']} at ({orbital_x:.0f}, {orbital_y:.0f})")
    
    logger.info(f"Solar system layout complete: {len(topics)} topic islands, {len(workspace_positions)} orbital workspaces")
    
    return topic_positions, workspace_positions

# Register the blueprint AFTER all routes are defined
app.register_blueprint(api_routes, url_prefix='/api')


if __name__ == '__main__':
    app.run(debug=False, port=5050, use_reloader=True, host='0.0.0.0')