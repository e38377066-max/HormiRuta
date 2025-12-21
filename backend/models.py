from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    document = db.Column(db.String(50), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    google_id = db.Column(db.String(100), unique=True, nullable=True)
    profile_picture = db.Column(db.String(500), nullable=True)
    active = db.Column(db.Boolean, default=True)
    
    @property
    def is_active(self):
        return self.active
    subscription_type = db.Column(db.String(20), default='free')
    subscription_expires = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    routes = db.relationship('Route', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        if self.password_hash is None:
            return False
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'phone': self.phone,
            'document': self.document,
            'address': self.address,
            'profile_picture': self.profile_picture,
            'subscription_type': self.subscription_type,
            'subscription_expires': self.subscription_expires.isoformat() if self.subscription_expires else None,
            'created_at': self.created_at.isoformat()
        }


class Route(db.Model):
    __tablename__ = 'routes'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=True)
    is_optimized = db.Column(db.Boolean, default=False)
    total_distance = db.Column(db.Float, nullable=True)
    total_duration = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    stops = db.relationship('Stop', backref='route', lazy=True, cascade='all, delete-orphan', order_by='Stop.order')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'is_optimized': self.is_optimized,
            'total_distance': self.total_distance,
            'total_duration': self.total_duration,
            'status': self.status,
            'stops': [stop.to_dict() for stop in self.stops],
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class Stop(db.Model):
    __tablename__ = 'stops'
    
    id = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False)
    address = db.Column(db.String(300), nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0)
    note = db.Column(db.Text, nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    customer_name = db.Column(db.String(100), nullable=True)
    priority = db.Column(db.Integer, default=0)
    time_window_start = db.Column(db.Time, nullable=True)
    time_window_end = db.Column(db.Time, nullable=True)
    wait_time = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='pending')
    eta = db.Column(db.DateTime, nullable=True)
    arrived_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    signature_url = db.Column(db.String(500), nullable=True)
    photo_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'route_id': self.route_id,
            'address': self.address,
            'lat': self.lat,
            'lng': self.lng,
            'order': self.order,
            'note': self.note,
            'phone': self.phone,
            'customer_name': self.customer_name,
            'priority': self.priority,
            'time_window_start': self.time_window_start.isoformat() if self.time_window_start else None,
            'time_window_end': self.time_window_end.isoformat() if self.time_window_end else None,
            'wait_time': self.wait_time,
            'status': self.status,
            'eta': self.eta.isoformat() if self.eta else None,
            'arrived_at': self.arrived_at.isoformat() if self.arrived_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'signature_url': self.signature_url,
            'photo_url': self.photo_url
        }
