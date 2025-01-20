from flask import Flask, request, jsonify
from flask_cors import CORS
import tiktoken
import os
import re
import json
from typing import Dict, List, Tuple, Optional
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class TokenOptimizer:
    AVAILABLE_MODELS = {
        "gpt-4": "cl100k_base",
        "gpt-3.5-turbo": "cl100k_base",
        "gpt-4-1106-preview": "cl100k_base",
        "gpt-3.5": "cl100k_base",
        "text-davinci-003": "p50k_base",
        "text-davinci-002": "p50k_base",
        "code-davinci-002": "p50k_base",
        "text-curie-001": "p50k_base",
        "text-babbage-001": "p50k_base",
        "text-ada-001": "p50k_base",
        "davinci": "r50k_base",
        "curie": "r50k_base",
        "babbage": "r50k_base",
        "ada": "r50k_base",
        "codellama/CodeLlama-7b-hf": "cl100k_base",
        "codellama/CodeLlama-70b-hf": "cl100k_base",
        "meta-llama/Meta-Llama-3-8B": "cl100k_base",
        "meta-llama/Meta-Llama-3-70B": "cl100k_base",
    }

    def __init__(self, model: str = "gpt-4"):
        self.model = model
        self.encoding_name = self.AVAILABLE_MODELS.get(model, "cl100k_base")
        self.encoding = tiktoken.get_encoding(self.encoding_name)
        
    def tokenize_text(self, text: str) -> List[int]:
        return self.encoding.encode(text)
    
    def optimize_tokens(self, text: str, level: str) -> Tuple[str, Dict]:
        tokens = self.tokenize_text(text)
        original_count = len(tokens)
        
        valid_levels = ["low", "medium", "aggressive"]
        if level not in valid_levels:
            level = "medium"
        
        rules = {
            "low": {
                "remove_comments": True,
                "compress_whitespace": True,
                "remove_empty_lines": False,
            },
            "medium": {
                "remove_comments": True,
                "compress_whitespace": True,
                "remove_empty_lines": True,
                "shorten_variable_names": False,
            },
            "aggressive": {
                "remove_comments": True,
                "compress_whitespace": True,
                "remove_empty_lines": True,
                "shorten_variable_names": True,
            }
        }
        
        current_rules = rules[level]
        optimized_text = text
        
        if current_rules["remove_comments"]:
            lines = optimized_text.split("\n")
            lines = [line for line in lines if not line.strip().startswith("//")]
            optimized_text = "\n".join(lines)
            optimized_text = re.sub(r'/\*[\s\S]*?\*/', '', optimized_text)
        
        if current_rules["compress_whitespace"]:
            optimized_text = re.sub(r'\s+', ' ', optimized_text)
            
        if current_rules["remove_empty_lines"]:
            lines = optimized_text.split("\n")
            lines = [line for line in lines if line.strip()]
            optimized_text = "\n".join(lines)
            
        optimized_tokens = self.tokenize_text(optimized_text)
        
        token_map = {
            "original": {
                "text": text,
                "token_count": original_count,
                "tokens": [self.encoding.decode([t]) for t in tokens]
            },
            "optimized": {
                "text": optimized_text,
                "token_count": len(optimized_tokens),
                "tokens": [self.encoding.decode([t]) for t in optimized_tokens]
            }
        }
        
        return optimized_text, token_map

@app.route('/models', methods=['GET'])
def get_available_models():
    return jsonify({
        "models": list(TokenOptimizer.AVAILABLE_MODELS.keys()),
        "encodings": list(set(TokenOptimizer.AVAILABLE_MODELS.values()))
    })

@app.route('/optimize', methods=['POST'])
def optimize_content():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        model = data.get('model', 'gpt-4')
        level = data.get('level', 'medium')
        
        optimizer = TokenOptimizer(model)

        # Handle raw text input
        if 'text' in data:
            content = data['text']
            optimized_content, token_map = optimizer.optimize_tokens(content, level)
            return jsonify({
                "token_map": token_map,
                "optimization_level": level,
                "model": model
            })

        # Handle file input
        filepath = data.get('filepath')
        if not filepath:
            return jsonify({"error": "No filepath or text provided"}), 400
            
        if not os.path.isabs(filepath):
            filepath = os.path.abspath(filepath)
            
        if not os.path.exists(filepath):
            return jsonify({"error": f"File not found: {filepath}"}), 404
        
        if not os.path.isfile(filepath):
            return jsonify({"error": f"Path exists but is not a file: {filepath}"}), 400
            
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            optimized_content, token_map = optimizer.optimize_tokens(content, level)
            
            return jsonify({
                "filepath": filepath,
                "token_map": token_map,
                "optimization_level": level,
                "model": model
            })
            
        except UnicodeDecodeError:
            return jsonify({"error": "File is not readable as text"}), 400
        except IOError as e:
            return jsonify({"error": f"Error reading file: {str(e)}"}), 500
            
    except Exception as e:
        logger.exception("Error in optimize endpoint")
        return jsonify({"error": str(e)}), 500

@app.route('/bundle', methods=['POST'])
def create_bundle():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        directory = data.get('directory')
        if not directory:
            return jsonify({"error": "No directory provided"}), 400

        model = data.get('model', 'gpt-4')
        level = data.get('level', 'medium')
        
        optimizer = TokenOptimizer(model)
        
        if not os.path.isabs(directory):
            directory = os.path.abspath(directory)
        
        if not os.path.exists(directory):
            return jsonify({"error": f"Directory not found: {directory}"}), 404
            
        if not os.path.isdir(directory):
            return jsonify({"error": f"Path exists but is not a directory: {directory}"}), 400
        
        files = []
        for root, _, filenames in os.walk(directory):
            for filename in filenames:
                if filename.endswith(('.vue', '.ts', '.js', '.jsx', '.tsx', '.py')):
                    filepath = os.path.join(root, filename)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        optimized_content, token_map = optimizer.optimize_tokens(content, level)
                        files.append({
                            "filepath": filepath,
                            "token_map": token_map,
                            "optimization_level": level,
                            "model": model
                        })
                    except UnicodeDecodeError:
                        logger.warning(f"Skipping non-text file: {filepath}")
                        continue
                    except IOError as e:
                        logger.error(f"Error reading file {filepath}: {str(e)}")
                        continue
        
        return jsonify({
            "directory": directory,
            "files": files,
            "model": model
        })
        
    except Exception as e:
        logger.exception("Error in create_bundle endpoint")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)