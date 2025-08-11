import time
import threading
from pathlib import Path
from typing import Callable, Dict, Any
import logging

logger = logging.getLogger(__name__)

class ConfigFileWatcher:
    """
    File watcher for canvas configuration with callback support
    Monitors YAML config file for changes and triggers reload events
    """
    
    def __init__(self, config_path: str, callback: Callable[[Dict[str, Any]], None] = None):
        self.config_path = Path(config_path)
        self.callback = callback
        self.last_modified = None
        self.is_watching = False
        self.watch_thread = None
        self.watch_interval = 1.0  # Check every 1 second
        
    def start_watching(self):
        """Start monitoring the config file for changes"""
        if self.is_watching:
            return
            
        self.is_watching = True
        self.last_modified = self._get_modification_time()
        
        self.watch_thread = threading.Thread(target=self._watch_loop, daemon=True)
        self.watch_thread.start()
        
        logger.info(f"Started watching config file: {self.config_path}")
    
    def stop_watching(self):
        """Stop monitoring the config file"""
        self.is_watching = False
        if self.watch_thread:
            self.watch_thread.join(timeout=2.0)
        
        logger.info("Stopped watching config file")
    
    def _watch_loop(self):
        """Main watch loop running in separate thread"""
        while self.is_watching:
            try:
                current_modified = self._get_modification_time()
                
                if current_modified and current_modified != self.last_modified:
                    logger.info("Config file changed, triggering callback")
                    self.last_modified = current_modified
                    
                    if self.callback:
                        try:
                            # Load the changed config and call callback
                            import yaml
                            with open(self.config_path, 'r', encoding='utf-8') as file:
                                config_data = yaml.safe_load(file)
                            self.callback(config_data)
                        except Exception as e:
                            logger.error(f"Error in config change callback: {e}")
                
                time.sleep(self.watch_interval)
                
            except Exception as e:
                logger.error(f"Error in watch loop: {e}")
                time.sleep(self.watch_interval)
    
    def _get_modification_time(self):
        """Get file modification time, return None if file doesn't exist"""
        try:
            if self.config_path.exists():
                return self.config_path.stat().st_mtime
        except Exception as e:
            logger.error(f"Error getting modification time: {e}")
        
        return None