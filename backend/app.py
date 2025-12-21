import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from email_validator import validate_email, EmailNotValidError

from models import db, User, Route, Stop

app = Flask(__name__)

app.config['SECRET_KEY'] = os.environ.get('SESSION_SECRET', 'dev-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_recycle': 300,
    'pool_pre_ping': True,
}

db.init_app(app)

allowed_origins = [
    f"https://{os.environ.get('REPLIT_DEV_DOMAIN', 'localhost')}",
    f"https://{os.environ.get('REPLIT_DEV_DOMAIN', 'localhost')}:5000",
    "http://localhost:5000",
    "http://localhost:9000",
    "capacitor://localhost",
    "http://localhost"
]
CORS(app, supports_credentials=True, origins=allowed_origins)

login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "No autorizado"}), 401

from google_auth import google_auth
app.register_blueprint(google_auth)


@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "message": "HormiRuta API funcionando"})


@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    username = data.get('username', '').strip()
    phone = data.get('phone', '').strip()
    
    if not email or not password or not username:
        return jsonify({"error": "Email, contraseña y nombre son requeridos"}), 400
    
    try:
        valid = validate_email(email)
        email = valid.email
    except EmailNotValidError as e:
        return jsonify({"error": f"Email inválido: {str(e)}"}), 400
    
    if len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Este email ya está registrado"}), 400
    
    user = User(
        username=username,
        email=email,
        phone=phone
    )
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()
    
    login_user(user)
    
    return jsonify({
        "success": True,
        "message": "Usuario registrado exitosamente",
        "user": user.to_dict()
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({"error": "Email y contraseña son requeridos"}), 400
    
    user = User.query.filter_by(email=email).first()
    
    if not user or not user.check_password(password):
        return jsonify({"error": "Credenciales inválidas"}), 401
    
    if not user.active:
        return jsonify({"error": "Esta cuenta está desactivada"}), 401
    
    login_user(user)
    
    return jsonify({
        "success": True,
        "message": "Inicio de sesión exitoso",
        "user": user.to_dict()
    })


@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"success": True, "message": "Sesión cerrada"})


@app.route('/api/auth/me')
@login_required
def get_current_user():
    return jsonify({"user": current_user.to_dict()})


@app.route('/api/auth/update', methods=['PUT'])
@login_required
def update_user():
    data = request.get_json()
    
    if 'username' in data:
        current_user.username = data['username'].strip()
    if 'phone' in data:
        current_user.phone = data['phone'].strip()
    if 'document' in data:
        current_user.document = data['document'].strip()
    if 'address' in data:
        current_user.address = data['address'].strip()
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Datos actualizados",
        "user": current_user.to_dict()
    })


@app.route('/api/routes', methods=['GET'])
@login_required
def get_routes():
    routes = Route.query.filter_by(user_id=current_user.id).order_by(Route.created_at.desc()).all()
    return jsonify({"routes": [route.to_dict() for route in routes]})


@app.route('/api/routes', methods=['POST'])
@login_required
def create_route():
    data = request.get_json()
    
    route = Route(
        user_id=current_user.id,
        name=data.get('name', f"Ruta {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    )
    db.session.add(route)
    db.session.flush()
    
    stops_data = data.get('stops', [])
    for i, stop_data in enumerate(stops_data):
        stop = Stop(
            route_id=route.id,
            address=stop_data.get('address', ''),
            lat=stop_data.get('lat', 0),
            lng=stop_data.get('lng', 0),
            order=i,
            note=stop_data.get('note'),
            phone=stop_data.get('phone'),
            customer_name=stop_data.get('customer_name'),
            priority=stop_data.get('priority', 0),
            wait_time=stop_data.get('wait_time', 0)
        )
        
        if stop_data.get('time_window_start'):
            try:
                stop.time_window_start = datetime.strptime(stop_data['time_window_start'], '%H:%M').time()
            except ValueError:
                pass
        
        if stop_data.get('time_window_end'):
            try:
                stop.time_window_end = datetime.strptime(stop_data['time_window_end'], '%H:%M').time()
            except ValueError:
                pass
        
        db.session.add(stop)
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "route": route.to_dict()
    }), 201


@app.route('/api/routes/<int:route_id>', methods=['GET'])
@login_required
def get_route(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    return jsonify({"route": route.to_dict()})


@app.route('/api/routes/<int:route_id>', methods=['PUT'])
@login_required
def update_route(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    data = request.get_json()
    
    if 'name' in data:
        route.name = data['name']
    if 'status' in data:
        route.status = data['status']
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "route": route.to_dict()
    })


@app.route('/api/routes/<int:route_id>', methods=['DELETE'])
@login_required
def delete_route(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    db.session.delete(route)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Ruta eliminada"})


@app.route('/api/routes/<int:route_id>/stops', methods=['POST'])
@login_required
def add_stop(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    data = request.get_json()
    
    max_order = db.session.query(db.func.max(Stop.order)).filter_by(route_id=route_id).scalar() or -1
    
    stop = Stop(
        route_id=route_id,
        address=data.get('address', ''),
        lat=data.get('lat', 0),
        lng=data.get('lng', 0),
        order=max_order + 1,
        note=data.get('note'),
        phone=data.get('phone'),
        customer_name=data.get('customer_name'),
        priority=data.get('priority', 0),
        wait_time=data.get('wait_time', 0)
    )
    
    db.session.add(stop)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "stop": stop.to_dict()
    }), 201


@app.route('/api/stops/<int:stop_id>', methods=['PUT'])
@login_required
def update_stop(stop_id):
    stop = Stop.query.join(Route).filter(
        Stop.id == stop_id,
        Route.user_id == current_user.id
    ).first()
    
    if not stop:
        return jsonify({"error": "Parada no encontrada"}), 404
    
    data = request.get_json()
    
    if 'address' in data:
        stop.address = data['address']
    if 'lat' in data:
        stop.lat = data['lat']
    if 'lng' in data:
        stop.lng = data['lng']
    if 'order' in data:
        stop.order = data['order']
    if 'note' in data:
        stop.note = data['note']
    if 'phone' in data:
        stop.phone = data['phone']
    if 'customer_name' in data:
        stop.customer_name = data['customer_name']
    if 'priority' in data:
        stop.priority = data['priority']
    if 'status' in data:
        stop.status = data['status']
        if data['status'] == 'arrived':
            stop.arrived_at = datetime.utcnow()
        elif data['status'] == 'completed':
            stop.completed_at = datetime.utcnow()
    if 'signature_url' in data:
        stop.signature_url = data['signature_url']
    if 'photo_url' in data:
        stop.photo_url = data['photo_url']
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "stop": stop.to_dict()
    })


@app.route('/api/stops/<int:stop_id>', methods=['DELETE'])
@login_required
def delete_stop(stop_id):
    stop = Stop.query.join(Route).filter(
        Stop.id == stop_id,
        Route.user_id == current_user.id
    ).first()
    
    if not stop:
        return jsonify({"error": "Parada no encontrada"}), 404
    
    route_id = stop.route_id
    deleted_order = stop.order
    
    db.session.delete(stop)
    
    stops_to_update = Stop.query.filter(
        Stop.route_id == route_id,
        Stop.order > deleted_order
    ).all()
    
    for s in stops_to_update:
        s.order -= 1
    
    db.session.commit()
    
    return jsonify({"success": True, "message": "Parada eliminada"})


@app.route('/api/routes/<int:route_id>/reorder', methods=['POST'])
@login_required
def reorder_stops(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    data = request.get_json()
    stop_order = data.get('stop_order', [])
    
    for i, stop_id in enumerate(stop_order):
        stop = Stop.query.filter_by(id=stop_id, route_id=route_id).first()
        if stop:
            stop.order = i
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "route": route.to_dict()
    })


with app.app_context():
    db.create_all()
    print("Base de datos inicializada correctamente")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
