import tiktoken
import os
from pathlib import Path
import re
import time
from typing import Dict, List, Tuple, Optional
import requests
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
import tempfile
import uuid
import subprocess
import shutil
import soundfile as sf
import numpy as np
import random
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

# Initialize processors
media_processor = EnhancedMediaProcessor()
chat_processor = ChatGPTDataProcessor()
tts_service = KokoroTTSService()

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
    """Stream TTS audio for long texts"""
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
        
        # Split text into sentences for streaming
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        def generate_audio_stream():
            for i, sentence in enumerate(sentences):
                if not sentence:
                    continue
                    
                try:
                    audio_bytes = tts_service.text_to_speech(sentence, voice, speed, lang_code)
                    audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
                    
                    chunk_data = {
                        'index': i,
                        'text': sentence,
                        'audio': audio_b64,
                        'is_final': i == len(sentences) - 1
                    }
                    
                    yield f"data: {json.dumps(chunk_data)}\n\n"
                    
                except Exception as e:
                    error_data = {
                        'error': str(e),
                        'index': i,
                        'text': sentence
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
import_service = ConversationImportService(chat_service, embedding_service)

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
        
        # Start clustering
        kwargs = {}
        if method == 'kmeans':
            if 'n_clusters' in data:
                kwargs['n_clusters'] = data['n_clusters']
        elif method == 'dbscan':
            if 'eps' in data:
                kwargs['eps'] = data['eps']
            if 'min_samples' in data:
                kwargs['min_samples'] = data['min_samples']
        
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

# Register the blueprint AFTER all routes are defined
app.register_blueprint(api_routes, url_prefix='/api')


if __name__ == '__main__':
    app.run(debug=False, port=5050, use_reloader=True, host='0.0.0.0')