import os
import json
import sqlite3
import uuid
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class ThumbnailService:
    def __init__(self, db_path: str = "instance/thumbnails.db", upload_path: str = "static/thumbnails"):
        self.db_path = db_path
        self.upload_path = upload_path
        self._init_database()
        self._init_upload_directory()
    
    def _init_database(self):
        """Initialize the thumbnails database"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create thumbnails table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS thumbnails (
                id TEXT PRIMARY KEY,
                relic_id TEXT,
                node_id TEXT,
                code_index INTEGER,
                message_index INTEGER,
                thumbnail_url TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('relic', 'code_preview')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes for faster queries
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_thumbnails_relic_id ON thumbnails(relic_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_thumbnails_node_code ON thumbnails(node_id, code_index)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_thumbnails_type ON thumbnails(type)')
        
        conn.commit()
        conn.close()
    
    def _init_upload_directory(self):
        """Initialize the upload directory for thumbnails"""
        os.makedirs(self.upload_path, exist_ok=True)
    
    def save_thumbnail(self, thumbnail_data: Dict) -> Dict:
        """Save thumbnail metadata to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            thumbnail_id = str(uuid.uuid4())
            
            cursor.execute('''
                INSERT INTO thumbnails (
                    id, relic_id, node_id, code_index, message_index, 
                    thumbnail_url, timestamp, type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                thumbnail_id,
                thumbnail_data.get('relic_id'),
                thumbnail_data.get('node_id'),
                thumbnail_data.get('code_index'),
                thumbnail_data.get('message_index'),
                thumbnail_data['thumbnail_url'],
                thumbnail_data.get('timestamp', int(datetime.now().timestamp() * 1000)),
                thumbnail_data['type']
            ))
            
            conn.commit()
            
            # Return the created thumbnail with ID
            return {
                'id': thumbnail_id,
                **thumbnail_data
            }
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error saving thumbnail: {e}")
            raise
        finally:
            conn.close()
    
    def get_thumbnail(self, relic_id: str = None, node_id: str = None, code_index: int = None) -> Optional[Dict]:
        """Get thumbnail by relic_id or node_id + code_index"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            if relic_id:
                cursor.execute('''
                    SELECT id, relic_id, node_id, code_index, message_index, 
                           thumbnail_url, timestamp, type, created_at
                    FROM thumbnails 
                    WHERE relic_id = ? 
                    ORDER BY created_at DESC 
                    LIMIT 1
                ''', (relic_id,))
            elif node_id and code_index is not None:
                cursor.execute('''
                    SELECT id, relic_id, node_id, code_index, message_index, 
                           thumbnail_url, timestamp, type, created_at
                    FROM thumbnails 
                    WHERE node_id = ? AND code_index = ? 
                    ORDER BY created_at DESC 
                    LIMIT 1
                ''', (node_id, code_index))
            else:
                return None
            
            row = cursor.fetchone()
            if not row:
                return None
            
            return {
                'id': row[0],
                'relic_id': row[1],
                'node_id': row[2],
                'code_index': row[3],
                'message_index': row[4],
                'thumbnail_url': row[5],
                'timestamp': row[6],
                'type': row[7],
                'created_at': row[8]
            }
            
        finally:
            conn.close()
    
    def get_thumbnails_by_type(self, thumbnail_type: str) -> List[Dict]:
        """Get all thumbnails of a specific type"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT id, relic_id, node_id, code_index, message_index, 
                       thumbnail_url, timestamp, type, created_at
                FROM thumbnails 
                WHERE type = ?
                ORDER BY created_at DESC
            ''', (thumbnail_type,))
            
            thumbnails = []
            for row in cursor.fetchall():
                thumbnails.append({
                    'id': row[0],
                    'relic_id': row[1],
                    'node_id': row[2],
                    'code_index': row[3],
                    'message_index': row[4],
                    'thumbnail_url': row[5],
                    'timestamp': row[6],
                    'type': row[7],
                    'created_at': row[8]
                })
            
            return thumbnails
            
        finally:
            conn.close()
    
    def delete_thumbnail(self, thumbnail_id: str) -> bool:
        """Delete a thumbnail by ID"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get the thumbnail to delete the file
            cursor.execute('SELECT thumbnail_url FROM thumbnails WHERE id = ?', (thumbnail_id,))
            row = cursor.fetchone()
            
            if row:
                thumbnail_url = row[0]
                # Delete the actual file if it's a local file
                if thumbnail_url.startswith('/static/thumbnails/'):
                    file_path = thumbnail_url.replace('/static/thumbnails/', '')
                    full_path = os.path.join(self.upload_path, file_path)
                    if os.path.exists(full_path):
                        os.remove(full_path)
                
                # Delete the database record
                cursor.execute('DELETE FROM thumbnails WHERE id = ?', (thumbnail_id,))
                conn.commit()
                return cursor.rowcount > 0
            
            return False
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error deleting thumbnail: {e}")
            raise
        finally:
            conn.close()
    
    def delete_thumbnails_by_relic(self, relic_id: str) -> int:
        """Delete all thumbnails for a specific relic"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get all thumbnails for this relic
            cursor.execute('SELECT thumbnail_url FROM thumbnails WHERE relic_id = ?', (relic_id,))
            rows = cursor.fetchall()
            
            # Delete the actual files
            for row in rows:
                thumbnail_url = row[0]
                if thumbnail_url.startswith('/static/thumbnails/'):
                    file_path = thumbnail_url.replace('/static/thumbnails/', '')
                    full_path = os.path.join(self.upload_path, file_path)
                    if os.path.exists(full_path):
                        os.remove(full_path)
            
            # Delete the database records
            cursor.execute('DELETE FROM thumbnails WHERE relic_id = ?', (relic_id,))
            conn.commit()
            return cursor.rowcount
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error deleting thumbnails by relic: {e}")
            raise
        finally:
            conn.close()
    
    def save_uploaded_file(self, file_data: bytes, filename: str) -> str:
        """Save uploaded file and return the URL"""
        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_extension = os.path.splitext(filename)[1]
        unique_filename = f"{timestamp}_{uuid.uuid4().hex}{file_extension}"
        
        # Save file
        file_path = os.path.join(self.upload_path, unique_filename)
        with open(file_path, 'wb') as f:
            f.write(file_data)
        
        # Return URL
        return f"/static/thumbnails/{unique_filename}"