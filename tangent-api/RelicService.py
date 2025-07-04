import os
import json
import sqlite3
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class RelicService:
    def __init__(self, db_path: str = "instance/relics.db"):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Initialize the relics database with tables for relics and versions"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create relics table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS relics (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                language TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                workspace_id TEXT,
                source_info TEXT
            )
        ''')
        
        # Create relic versions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS relic_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                relic_id TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                code TEXT NOT NULL,
                dependencies TEXT,
                commit_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by TEXT DEFAULT 'user',
                FOREIGN KEY (relic_id) REFERENCES relics(id) ON DELETE CASCADE,
                UNIQUE(relic_id, version_number)
            )
        ''')
        
        # Create index for faster queries
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_relic_versions_relic_id ON relic_versions(relic_id)')
        
        conn.commit()
        conn.close()
    
    def create_relic(self, relic_data: Dict) -> Dict:
        """Create a new relic with initial version"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Insert the relic
            cursor.execute('''
                INSERT INTO relics (id, name, description, language, workspace_id, source_info)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                relic_data['id'],
                relic_data['name'],
                relic_data.get('description', ''),
                relic_data['language'],
                relic_data.get('workspace_id'),
                json.dumps(relic_data.get('source_info', {}))
            ))
            
            # Create initial version
            cursor.execute('''
                INSERT INTO relic_versions (relic_id, version_number, code, dependencies, commit_message)
                VALUES (?, 1, ?, ?, ?)
            ''', (
                relic_data['id'],
                relic_data['code'],
                json.dumps(relic_data.get('dependencies', {})),
                'Initial version'
            ))
            
            conn.commit()
            
            # Return the created relic with version info
            return self.get_relic(relic_data['id'])
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creating relic: {e}")
            raise
        finally:
            conn.close()
    
    def update_relic(self, relic_id: str, updates: Dict, commit_message: str = None) -> Dict:
        """Update relic metadata and/or create new version if code changed"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get current relic
            current = self.get_relic(relic_id)
            if not current:
                raise ValueError(f"Relic {relic_id} not found")
            
            # Update metadata if provided
            if 'name' in updates or 'description' in updates:
                cursor.execute('''
                    UPDATE relics 
                    SET name = COALESCE(?, name),
                        description = COALESCE(?, description),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (
                    updates.get('name'),
                    updates.get('description'),
                    relic_id
                ))
            
            # Create new version if code changed
            if 'code' in updates and updates['code'] != current['latest_version']['code']:
                # Get next version number
                cursor.execute('''
                    SELECT COALESCE(MAX(version_number), 0) + 1 
                    FROM relic_versions 
                    WHERE relic_id = ?
                ''', (relic_id,))
                next_version = cursor.fetchone()[0]
                
                # Insert new version
                cursor.execute('''
                    INSERT INTO relic_versions (relic_id, version_number, code, dependencies, commit_message)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    relic_id,
                    next_version,
                    updates['code'],
                    json.dumps(updates.get('dependencies', current['latest_version'].get('dependencies', {}))),
                    commit_message or f'Version {next_version}'
                ))
                
                # Update the relic's updated_at
                cursor.execute('''
                    UPDATE relics SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
                ''', (relic_id,))
            
            conn.commit()
            return self.get_relic(relic_id)
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating relic: {e}")
            raise
        finally:
            conn.close()
    
    def get_relic(self, relic_id: str, version: Optional[int] = None) -> Optional[Dict]:
        """Get a relic with specific version or latest"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get relic metadata
            cursor.execute('''
                SELECT id, name, description, language, status, 
                       created_at, updated_at, workspace_id, source_info
                FROM relics WHERE id = ?
            ''', (relic_id,))
            
            row = cursor.fetchone()
            if not row:
                return None
            
            relic = {
                'id': row[0],
                'name': row[1],
                'description': row[2],
                'language': row[3],
                'status': row[4],
                'created_at': row[5],
                'updated_at': row[6],
                'workspace_id': row[7],
                'source_info': json.loads(row[8]) if row[8] else {}
            }
            
            # Get specific version or latest
            if version:
                cursor.execute('''
                    SELECT version_number, code, dependencies, commit_message, created_at
                    FROM relic_versions
                    WHERE relic_id = ? AND version_number = ?
                ''', (relic_id, version))
            else:
                cursor.execute('''
                    SELECT version_number, code, dependencies, commit_message, created_at
                    FROM relic_versions
                    WHERE relic_id = ?
                    ORDER BY version_number DESC
                    LIMIT 1
                ''', (relic_id,))
            
            version_row = cursor.fetchone()
            if version_row:
                relic['latest_version'] = {
                    'version': version_row[0],
                    'code': version_row[1],
                    'dependencies': json.loads(version_row[2]) if version_row[2] else {},
                    'commit_message': version_row[3],
                    'created_at': version_row[4]
                }
            
            return relic
            
        finally:
            conn.close()
    
    def get_relic_versions(self, relic_id: str) -> List[Dict]:
        """Get all versions of a relic"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT version_number, commit_message, created_at, created_by
                FROM relic_versions
                WHERE relic_id = ?
                ORDER BY version_number DESC
            ''', (relic_id,))
            
            versions = []
            for row in cursor.fetchall():
                versions.append({
                    'version': row[0],
                    'commit_message': row[1],
                    'created_at': row[2],
                    'created_by': row[3]
                })
            
            return versions
            
        finally:
            conn.close()
    
    def list_relics(self, workspace_id: Optional[str] = None) -> List[Dict]:
        """List all relics, optionally filtered by workspace"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            if workspace_id:
                cursor.execute('''
                    SELECT r.id, r.name, r.description, r.language, r.status,
                           r.created_at, r.updated_at, r.workspace_id,
                           v.version_number, v.code
                    FROM relics r
                    LEFT JOIN relic_versions v ON r.id = v.relic_id
                    WHERE r.workspace_id = ?
                    AND v.version_number = (
                        SELECT MAX(version_number) FROM relic_versions WHERE relic_id = r.id
                    )
                ''', (workspace_id,))
            else:
                cursor.execute('''
                    SELECT r.id, r.name, r.description, r.language, r.status,
                           r.created_at, r.updated_at, r.workspace_id,
                           v.version_number, v.code
                    FROM relics r
                    LEFT JOIN relic_versions v ON r.id = v.relic_id
                    WHERE v.version_number = (
                        SELECT MAX(version_number) FROM relic_versions WHERE relic_id = r.id
                    )
                ''')
            
            relics = []
            for row in cursor.fetchall():
                relics.append({
                    'id': row[0],
                    'name': row[1],
                    'description': row[2],
                    'language': row[3],
                    'status': row[4],
                    'created_at': row[5],
                    'updated_at': row[6],
                    'workspace_id': row[7],
                    'latest_version': row[8],
                    'code': row[9]
                })
            
            return relics
            
        finally:
            conn.close()
    
    def delete_relic(self, relic_id: str) -> bool:
        """Delete a relic and all its versions"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('DELETE FROM relics WHERE id = ?', (relic_id,))
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            logger.error(f"Error deleting relic: {e}")
            raise
        finally:
            conn.close()