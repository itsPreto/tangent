from typing import Dict, List, Set, Tuple, Optional
import re
from collections import Counter
from ChatPersistenceService import db, Reflection
import logging

logger = logging.getLogger(__name__)


class ReflectionIndexingService:
    """
    Advanced indexing system for reflections with keyword extraction, 
    technical metadata analysis, and intelligent search capabilities
    """
    
    def __init__(self):
        # Technical keyword patterns for different domains
        self.tech_patterns = {
            'frontend': [
                'react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'sass', 'scss',
                'component', 'props', 'state', 'redux', 'vuex', 'pinia', 'router', 'dom', 'event',
                'responsive', 'mobile', 'desktop', 'browser', 'webkit', 'chrome', 'firefox',
                'npm', 'yarn', 'webpack', 'vite', 'babel', 'eslint', 'prettier'
            ],
            'backend': [
                'python', 'flask', 'django', 'fastapi', 'node', 'express', 'spring', 'rails',
                'database', 'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'sqlite',
                'api', 'rest', 'graphql', 'microservice', 'server', 'endpoint', 'middleware',
                'authentication', 'authorization', 'jwt', 'oauth', 'session', 'cookie'
            ],
            'devops': [
                'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'ansible',
                'ci/cd', 'jenkins', 'github actions', 'gitlab', 'deployment', 'container',
                'nginx', 'apache', 'load balancer', 'cdn', 'monitoring', 'logging'
            ],
            'data': [
                'pandas', 'numpy', 'scipy', 'sklearn', 'tensorflow', 'pytorch', 'jupyter',
                'data analysis', 'machine learning', 'deep learning', 'neural network',
                'regression', 'classification', 'clustering', 'visualization', 'matplotlib'
            ],
            'mobile': [
                'ios', 'android', 'swift', 'kotlin', 'java', 'react native', 'flutter', 'dart',
                'xcode', 'android studio', 'app store', 'play store', 'mobile app', 'responsive'
            ]
        }
        
        # Error patterns that commonly occur
        self.error_patterns = [
            'cannot read property', 'undefined is not a function', 'null pointer',
            'import error', 'module not found', 'syntax error', 'type error',
            'connection refused', 'timeout', 'cors error', 'permission denied',
            '404 not found', '500 internal server error', 'authentication failed'
        ]
        
        # Code pattern indicators
        self.code_patterns = [
            'async/await', 'promise', 'callback', 'closure', 'decorator', 'middleware',
            'singleton', 'factory', 'observer', 'mvc', 'mvvm', 'dependency injection',
            'recursion', 'iteration', 'optimization', 'caching', 'memoization'
        ]
        
        # Complexity indicators
        self.complexity_indicators = {
            'high': ['distributed', 'concurrent', 'async', 'parallel', 'optimization', 'performance', 'scale'],
            'medium': ['integration', 'api', 'database', 'authentication', 'validation'],
            'low': ['ui', 'styling', 'layout', 'text', 'display', 'simple']
        }
    
    def extract_keywords_and_metadata(self, reflection_data: Dict) -> Dict:
        """
        Extract comprehensive keywords and technical metadata from reflection data
        
        Args:
            reflection_data: Dictionary containing reflection information
            
        Returns:
            Dictionary with extracted metadata including:
            - technical_keywords: Domain-specific technical terms
            - error_keywords: Error-related terms
            - code_pattern_keywords: Programming patterns mentioned
            - complexity_score: Estimated complexity (0.0 to 1.0)
            - primary_domain: Most likely technical domain
            - technology_stack: Identified technologies
            - learning_level: Estimated learning level required
        """
        try:
            # Combine all text content for analysis
            full_text = self._combine_reflection_text(reflection_data)
            
            # Extract different types of keywords
            technical_keywords = self._extract_technical_keywords(full_text)
            error_keywords = self._extract_error_keywords(full_text)
            code_pattern_keywords = self._extract_code_pattern_keywords(full_text)
            
            # Determine primary domain
            primary_domain = self._determine_primary_domain(technical_keywords, full_text)
            
            # Extract technology stack
            technology_stack = self._extract_technology_stack(full_text, technical_keywords)
            
            # Calculate complexity score
            complexity_score = self._calculate_complexity_score(full_text, reflection_data)
            
            # Determine learning level
            learning_level = self._determine_learning_level(complexity_score, reflection_data)
            
            # Extract semantic themes
            themes = self._extract_semantic_themes(full_text, reflection_data)
            
            return {
                'technical_keywords': technical_keywords,
                'error_keywords': error_keywords,
                'code_pattern_keywords': code_pattern_keywords,
                'complexity_score': complexity_score,
                'primary_domain': primary_domain,
                'technology_stack': technology_stack,
                'learning_level': learning_level,
                'semantic_themes': themes,
                'keyword_density': len(technical_keywords) / max(len(full_text.split()), 1),
                'has_code_examples': self._has_code_examples(full_text),
                'solution_type': self._classify_solution_type(reflection_data)
            }
            
        except Exception as e:
            logger.error(f"Error extracting keywords and metadata: {e}")
            return self._get_default_metadata()
    
    def _combine_reflection_text(self, reflection_data: Dict) -> str:
        """Combine all text fields from reflection for analysis"""
        text_parts = []
        
        # Core fields
        text_parts.append(reflection_data.get('problem_statement', ''))
        text_parts.append(reflection_data.get('technical_challenge', ''))
        text_parts.append(reflection_data.get('solution_breakthrough', ''))
        
        # Arrays of text
        for field in ['key_insights', 'failed_approaches', 'technologies', 'code_patterns', 'keywords']:
            items = reflection_data.get(field, [])
            if items:
                text_parts.extend(items)
        
        return ' '.join(text_parts).lower()
    
    def _extract_technical_keywords(self, text: str) -> List[str]:
        """Extract domain-specific technical keywords"""
        found_keywords = []
        
        for domain, keywords in self.tech_patterns.items():
            for keyword in keywords:
                if keyword.lower() in text:
                    found_keywords.append(keyword)
        
        # Remove duplicates while preserving order
        return list(dict.fromkeys(found_keywords))
    
    def _extract_error_keywords(self, text: str) -> List[str]:
        """Extract error-related keywords"""
        found_errors = []
        
        for error_pattern in self.error_patterns:
            if error_pattern.lower() in text:
                found_errors.append(error_pattern)
        
        return found_errors
    
    def _extract_code_pattern_keywords(self, text: str) -> List[str]:
        """Extract programming pattern keywords"""
        found_patterns = []
        
        for pattern in self.code_patterns:
            if pattern.lower() in text:
                found_patterns.append(pattern)
        
        return found_patterns
    
    def _determine_primary_domain(self, technical_keywords: List[str], full_text: str) -> str:
        """Determine the primary technical domain"""
        domain_scores = {}
        
        for domain, keywords in self.tech_patterns.items():
            score = sum(1 for keyword in keywords if keyword in technical_keywords)
            # Add bonus for domain-specific terms in full text
            score += sum(0.5 for keyword in keywords if keyword.lower() in full_text)
            domain_scores[domain] = score
        
        if not domain_scores or max(domain_scores.values()) == 0:
            return 'general'
        
        return max(domain_scores, key=domain_scores.get)
    
    def _extract_technology_stack(self, text: str, technical_keywords: List[str]) -> List[str]:
        """Extract specific technologies mentioned"""
        # Common technology names and frameworks
        technologies = [
            'react', 'vue', 'angular', 'flask', 'django', 'express', 'spring',
            'docker', 'kubernetes', 'aws', 'azure', 'mysql', 'postgresql', 'mongodb',
            'python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'go', 'rust'
        ]
        
        found_tech = []
        for tech in technologies:
            if tech.lower() in text or tech in technical_keywords:
                found_tech.append(tech)
        
        return found_tech
    
    def _calculate_complexity_score(self, text: str, reflection_data: Dict) -> float:
        """Calculate complexity score from 0.0 to 1.0"""
        score = 0.0
        
        # Check for complexity indicators
        for level, indicators in self.complexity_indicators.items():
            weight = {'high': 1.0, 'medium': 0.6, 'low': 0.3}[level]
            for indicator in indicators:
                if indicator.lower() in text:
                    score += weight * 0.1
        
        # Factor in iteration count
        iteration_count = reflection_data.get('iteration_count', 0)
        if iteration_count:
            score += min(iteration_count / 10, 0.3)  # More iterations = more complex
        
        # Factor in time to solution
        time_to_solution = reflection_data.get('time_to_solution', 0)
        if time_to_solution:
            score += min(time_to_solution / 120, 0.2)  # Longer time = more complex
        
        # Factor in number of failed approaches
        failed_approaches = len(reflection_data.get('failed_approaches', []))
        score += min(failed_approaches / 5, 0.2)
        
        return min(score, 1.0)
    
    def _determine_learning_level(self, complexity_score: float, reflection_data: Dict) -> str:
        """Determine required learning level"""
        if complexity_score >= 0.8:
            return 'expert'
        elif complexity_score >= 0.6:
            return 'advanced'
        elif complexity_score >= 0.3:
            return 'intermediate'
        else:
            return 'beginner'
    
    def _extract_semantic_themes(self, text: str, reflection_data: Dict) -> List[str]:
        """Extract high-level semantic themes"""
        themes = []
        
        # Problem-solving themes
        if any(word in text for word in ['debug', 'fix', 'error', 'bug']):
            themes.append('debugging')
        
        if any(word in text for word in ['implement', 'build', 'create', 'develop']):
            themes.append('implementation')
        
        if any(word in text for word in ['optimize', 'performance', 'speed', 'efficient']):
            themes.append('optimization')
        
        if any(word in text for word in ['integrate', 'connect', 'api', 'service']):
            themes.append('integration')
        
        if any(word in text for word in ['design', 'architecture', 'pattern', 'structure']):
            themes.append('architecture')
        
        if any(word in text for word in ['test', 'testing', 'unit', 'integration']):
            themes.append('testing')
        
        return themes
    
    def _has_code_examples(self, text: str) -> bool:
        """Check if reflection contains code examples"""
        code_indicators = ['function', 'def ', 'class ', 'const ', 'var ', 'let ', '{', '}', '()', '=>']
        return any(indicator in text for indicator in code_indicators)
    
    def _classify_solution_type(self, reflection_data: Dict) -> str:
        """Classify the type of solution provided"""
        solution = reflection_data.get('solution_breakthrough', '').lower()
        
        if any(word in solution for word in ['configuration', 'config', 'setting']):
            return 'configuration'
        elif any(word in solution for word in ['algorithm', 'logic', 'approach']):
            return 'algorithmic'
        elif any(word in solution for word in ['pattern', 'design', 'architecture']):
            return 'architectural'
        elif any(word in solution for word in ['library', 'framework', 'tool']):
            return 'tooling'
        elif any(word in solution for word in ['syntax', 'code', 'implementation']):
            return 'implementation'
        else:
            return 'general'
    
    def _get_default_metadata(self) -> Dict:
        """Return default metadata when extraction fails"""
        return {
            'technical_keywords': [],
            'error_keywords': [],
            'code_pattern_keywords': [],
            'complexity_score': 0.5,
            'primary_domain': 'general',
            'technology_stack': [],
            'learning_level': 'intermediate',
            'semantic_themes': [],
            'keyword_density': 0.0,
            'has_code_examples': False,
            'solution_type': 'general'
        }
    
    def search_by_advanced_criteria(self, criteria: Dict) -> List[Dict]:
        """
        Search reflections using advanced criteria and metadata
        
        Args:
            criteria: Dictionary with search criteria:
                - domains: List of technical domains
                - technologies: List of technologies
                - complexity_range: Tuple of (min, max) complexity
                - learning_level: Required learning level
                - themes: List of semantic themes
                - solution_types: List of solution types
                - has_code: Boolean for code examples
                - keywords: List of keywords to match
        
        Returns:
            List of matching reflections with relevance scores
        """
        try:
            query = Reflection.query
            
            results = []
            all_reflections = query.all()
            
            for reflection in all_reflections:
                score = self._calculate_criteria_match_score(reflection, criteria)
                if score > 0.0:
                    reflection_dict = self._reflection_to_dict(reflection)
                    reflection_dict['match_score'] = score
                    results.append(reflection_dict)
            
            # Sort by match score
            results.sort(key=lambda x: x['match_score'], reverse=True)
            return results
            
        except Exception as e:
            logger.error(f"Error in advanced criteria search: {e}")
            return []
    
    def _calculate_criteria_match_score(self, reflection: Reflection, criteria: Dict) -> float:
        """Calculate how well a reflection matches the search criteria"""
        score = 0.0
        max_score = 0.0
        
        # Check domains
        if 'domains' in criteria and criteria['domains']:
            max_score += 1.0
            reflection_domains = reflection.domains or []
            if any(domain in reflection_domains for domain in criteria['domains']):
                score += 1.0
        
        # Check technologies
        if 'technologies' in criteria and criteria['technologies']:
            max_score += 1.0
            reflection_techs = reflection.technologies or []
            if any(tech in reflection_techs for tech in criteria['technologies']):
                score += 1.0
        
        # Check complexity range
        if 'complexity_range' in criteria:
            max_score += 1.0
            min_complexity, max_complexity = criteria['complexity_range']
            complexity_map = {'low': 0.25, 'medium': 0.5, 'high': 0.75, 'expert': 1.0}
            reflection_complexity = complexity_map.get(reflection.complexity, 0.5)
            if min_complexity <= reflection_complexity <= max_complexity:
                score += 1.0
        
        # Check keywords
        if 'keywords' in criteria and criteria['keywords']:
            max_score += 1.0
            reflection_keywords = reflection.keywords or []
            keyword_matches = sum(1 for keyword in criteria['keywords'] 
                                if keyword.lower() in [k.lower() for k in reflection_keywords])
            if keyword_matches > 0:
                score += min(keyword_matches / len(criteria['keywords']), 1.0)
        
        return score / max_score if max_score > 0 else 0.0
    
    def _reflection_to_dict(self, reflection: Reflection) -> Dict:
        """Convert reflection model to dictionary"""
        return {
            'id': reflection.id,
            'problem_statement': reflection.problem_statement,
            'technical_challenge': reflection.technical_challenge,
            'solution_breakthrough': reflection.solution_breakthrough,
            'key_insights': reflection.key_insights or [],
            'technologies': reflection.technologies or [],
            'domains': reflection.domains or [],
            'complexity': reflection.complexity,
            'keywords': reflection.keywords or [],
            'created_at': reflection.created_at.isoformat() if reflection.created_at else None
        }
    
    def update_all_reflection_metadata(self) -> Dict:
        """
        Update metadata for all existing reflections (useful for migration/updates)
        
        Returns:
            Dictionary with update statistics
        """
        try:
            reflections = Reflection.query.all()
            updated_count = 0
            failed_count = 0
            
            for reflection in reflections:
                try:
                    # Build reflection data for metadata extraction
                    reflection_data = {
                        'problem_statement': reflection.problem_statement,
                        'technical_challenge': reflection.technical_challenge,
                        'solution_breakthrough': reflection.solution_breakthrough,
                        'key_insights': reflection.key_insights or [],
                        'failed_approaches': reflection.failed_approaches or [],
                        'technologies': reflection.technologies or [],
                        'code_patterns': reflection.code_patterns or [],
                        'keywords': reflection.keywords or [],
                        'iteration_count': reflection.iteration_count,
                        'time_to_solution': reflection.time_to_solution
                    }
                    
                    # Extract new metadata
                    metadata = self.extract_keywords_and_metadata(reflection_data)
                    
                    # Update reflection with enhanced keywords
                    enhanced_keywords = list(set(
                        (reflection.keywords or []) + 
                        metadata['technical_keywords'] + 
                        metadata['error_keywords'] + 
                        metadata['code_pattern_keywords']
                    ))
                    
                    reflection.keywords = enhanced_keywords[:20]  # Limit to 20 keywords
                    updated_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to update metadata for reflection {reflection.id}: {e}")
                    failed_count += 1
            
            db.session.commit()
            
            return {
                'total_reflections': len(reflections),
                'updated_count': updated_count,
                'failed_count': failed_count
            }
            
        except Exception as e:
            logger.error(f"Error updating reflection metadata: {e}")
            db.session.rollback()
            return {'error': str(e)}