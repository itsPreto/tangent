import os
import jwt
import hashlib
from datetime import datetime, timedelta
from flask import current_app
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from werkzeug.security import generate_password_hash, check_password_hash

# Import the existing db instance
from ChatPersistenceService import db

class User(db.Model):
    __tablename__ = 'users'
    
    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    avatar_url = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_login = Column(DateTime, nullable=True)
    preferences = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Trial status fields
    subscription_plan = Column(String(50), default='trial')
    workspaces_used = Column(Integer, default=0)
    max_workspaces = Column(Integer, default=3)
    credits_used = Column(Integer, default=0)
    max_credits = Column(Integer, default=100)
    subscription_expires = Column(DateTime, nullable=True)

class UserService:
    def __init__(self, app=None):
        self.app = app
        self.secret_key = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this')
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        self.app = app
        
        # Create tables using the existing db instance
        with app.app_context():
            db.create_all()
    
    def _generate_user_id(self):
        """Generate a unique user ID"""
        import uuid
        return str(uuid.uuid4())
    
    def _generate_tokens(self, user_id):
        """Generate access and refresh tokens"""
        access_payload = {
            'user_id': user_id,
            'exp': datetime.utcnow() + timedelta(hours=1),
            'iat': datetime.utcnow(),
            'type': 'access'
        }
        
        refresh_payload = {
            'user_id': user_id,
            'exp': datetime.utcnow() + timedelta(days=30),
            'iat': datetime.utcnow(),
            'type': 'refresh'
        }
        
        access_token = jwt.encode(access_payload, self.secret_key, algorithm='HS256')
        refresh_token = jwt.encode(refresh_payload, self.secret_key, algorithm='HS256')
        
        return access_token, refresh_token
    
    def verify_token(self, token):
        """Verify JWT token and return user_id"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return payload['user_id']
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def register_user(self, email, name, password):
        """Register a new user"""
        try:
            # Check if user already exists
            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                return None, "User already exists"
            
            # Create new user
            user_id = self._generate_user_id()
            password_hash = generate_password_hash(password)
            
            # Set trial expiry to 30 days from now
            trial_expires = datetime.utcnow() + timedelta(days=30)
            
            user = User(
                id=user_id,
                email=email,
                name=name,
                password_hash=password_hash,
                subscription_expires=trial_expires
            )
            
            db.session.add(user)
            db.session.commit()
            
            # Generate tokens
            access_token, refresh_token = self._generate_tokens(user_id)
            
            return {
                'user': self._serialize_user(user),
                'access_token': access_token,
                'refresh_token': refresh_token
            }, None
            
        except Exception as e:
            db.session.rollback()
            return None, str(e)
    
    def login_user(self, email, password):
        """Login user"""
        try:
            user = User.query.filter_by(email=email).first()
            
            if not user or not check_password_hash(user.password_hash, password):
                return None, "Invalid credentials"
            
            if not user.is_active:
                return None, "Account is disabled"
            
            # Update last login
            user.last_login = datetime.utcnow()
            db.session.commit()
            
            # Generate tokens
            access_token, refresh_token = self._generate_tokens(user.id)
            
            return {
                'user': self._serialize_user(user),
                'access_token': access_token,
                'refresh_token': refresh_token
            }, None
            
        except Exception as e:
            db.session.rollback()
            return None, str(e)
    
    def refresh_token(self, refresh_token):
        """Refresh access token"""
        try:
            payload = jwt.decode(refresh_token, self.secret_key, algorithms=['HS256'])
            
            if payload.get('type') != 'refresh':
                return None, "Invalid token type"
            
            user_id = payload['user_id']
            
            # Generate new access token
            access_payload = {
                'user_id': user_id,
                'exp': datetime.utcnow() + timedelta(hours=1),
                'iat': datetime.utcnow(),
                'type': 'access'
            }
            
            new_access_token = jwt.encode(access_payload, self.secret_key, algorithm='HS256')
            
            return {'access_token': new_access_token}, None
            
        except jwt.ExpiredSignatureError:
            return None, "Refresh token expired"
        except jwt.InvalidTokenError:
            return None, "Invalid refresh token"
    
    def get_user_by_id(self, user_id):
        """Get user by ID"""
        try:
            user = User.query.filter_by(id=user_id).first()
            return self._serialize_user(user) if user else None
        except Exception as e:
            return None
    
    def update_user_profile(self, user_id, **kwargs):
        """Update user profile"""
        try:
            user = User.query.filter_by(id=user_id).first()
            if not user:
                return None, "User not found"
            
            # Update allowed fields
            allowed_fields = ['name', 'avatar_url', 'preferences']
            for field in allowed_fields:
                if field in kwargs:
                    setattr(user, field, kwargs[field])
            
            user.updated_at = datetime.utcnow()
            db.session.commit()
            
            return self._serialize_user(user), None
            
        except Exception as e:
            db.session.rollback()
            return None, str(e)
    
    def use_credits(self, user_id, credits=1):
        """Use credits for a user"""
        try:
            user = User.query.filter_by(id=user_id).first()
            if not user:
                return None, "User not found"
            
            if user.credits_used + credits > user.max_credits:
                return None, "Not enough credits"
            
            user.credits_used += credits
            user.updated_at = datetime.utcnow()
            db.session.commit()
            
            return self._serialize_user(user), None
            
        except Exception as e:
            db.session.rollback()
            return None, str(e)
    
    def increment_workspace_count(self, user_id):
        """Increment workspace count for user"""
        try:
            user = User.query.filter_by(id=user_id).first()
            if not user:
                return None, "User not found"
            
            if user.workspaces_used >= user.max_workspaces:
                return None, "Workspace limit reached"
            
            user.workspaces_used += 1
            user.updated_at = datetime.utcnow()
            db.session.commit()
            
            return self._serialize_user(user), None
            
        except Exception as e:
            db.session.rollback()
            return None, str(e)
    
    def _serialize_user(self, user):
        """Serialize user object for JSON response"""
        if not user:
            return None
            
        return {
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'avatar_url': user.avatar_url,
            'is_active': user.is_active,
            'is_verified': user.is_verified,
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'preferences': user.preferences or {},
            'created_at': user.created_at.isoformat(),
            'updated_at': user.updated_at.isoformat(),
            'trial_status': {
                'subscription_plan': user.subscription_plan,
                'workspaces_used': user.workspaces_used,
                'max_workspaces': user.max_workspaces,
                'workspaces_remaining': user.max_workspaces - user.workspaces_used,
                'credits_used': user.credits_used,
                'max_credits': user.max_credits,
                'credits_remaining': user.max_credits - user.credits_used,
                'can_create_workspace': user.workspaces_used < user.max_workspaces,
                'subscription_expires': user.subscription_expires.isoformat() if user.subscription_expires else None
            }
        }