import tiktoken
import os
from pathlib import Path
import re
import time
from typing import Dict, List, Tuple, Optional
import requests
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import logging
import sseclient
import requests
import base64
from PIL import Image
import io
import google.generativeai as genai
from ChatgptChatProcessor import ChatGPTDataProcessor
from ChatPersistenceService import ChatPersistenceService, Chat, db
import tempfile
import uuid

from flask import Blueprint, stream_with_context
import re


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

api_routes = Blueprint('api_routes', __name__)

app = Flask(__name__)

# Configure CORS with specific settings
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",  # Vite dev server
            "http://localhost:5173",  # Another Vite port if needed
        ],
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-API-Key"],  # Added X-API-Key
        "supports_credentials": True
    }
})
# Configuration
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

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

# Initialize processor
media_processor = EnhancedMediaProcessor()
chat_processor = ChatGPTDataProcessor()

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

# Initialize the service
chat_service = ChatPersistenceService(app)

# Register the blueprint AFTER all routes are defined
app.register_blueprint(api_routes, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True, port=5000, use_reloader=False)