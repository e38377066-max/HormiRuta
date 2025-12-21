import os
import csv
import io
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from email_validator import validate_email, EmailNotValidError

from models import db, User, Route, Stop, RouteHistory
from optimization import optimize_route_order, calculate_etas, get_directions_google

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
    "http://127.0.0.1:5000",
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


@app.route('/api/routes/<int:route_id>/optimize', methods=['POST'])
@login_required
def optimize_route(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    if len(route.stops) < 2:
        return jsonify({"error": "Se necesitan al menos 2 paradas para optimizar"}), 400
    
    data = request.get_json() or {}
    
    start_location = None
    if route.start_lat and route.start_lng:
        start_location = {'lat': route.start_lat, 'lng': route.start_lng}
    elif data.get('start_lat') and data.get('start_lng'):
        start_location = {'lat': data['start_lat'], 'lng': data['start_lng']}
        route.start_lat = data['start_lat']
        route.start_lng = data['start_lng']
        route.start_address = data.get('start_address', '')
    
    return_to_start = data.get('return_to_start', route.return_to_start)
    route.return_to_start = return_to_start
    
    optimized_stops, total_distance, total_duration = optimize_route_order(
        route.stops,
        start_location=start_location,
        return_to_start=return_to_start
    )
    
    for stop in optimized_stops:
        db_stop = Stop.query.get(stop.id)
        if db_stop:
            db_stop.order = stop.order
            if stop.original_order is None:
                db_stop.original_order = stop.order
            db_stop.distance_from_prev = stop.distance_from_prev
            db_stop.duration_from_prev = stop.duration_from_prev
    
    start_time = None
    if data.get('start_time'):
        try:
            start_time = datetime.fromisoformat(data['start_time'])
        except ValueError:
            start_time = datetime.now()
    else:
        start_time = datetime.now()
    
    calculate_etas(optimized_stops, start_time)
    
    for stop in optimized_stops:
        db_stop = Stop.query.get(stop.id)
        if db_stop:
            db_stop.eta = stop.eta
    
    route.is_optimized = True
    route.total_distance = total_distance
    route.total_duration = total_duration
    route.optimization_mode = data.get('mode', 'fastest')
    
    db.session.commit()
    
    updated_route = Route.query.get(route_id)
    
    return jsonify({
        "success": True,
        "route": updated_route.to_dict(),
        "total_distance_km": total_distance,
        "total_duration_min": total_duration
    })


@app.route('/api/routes/<int:route_id>/start', methods=['POST'])
@login_required
def start_route(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    route.status = 'in_progress'
    route.started_at = datetime.utcnow()
    
    calculate_etas(route.stops, datetime.now())
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "route": route.to_dict()
    })


@app.route('/api/routes/<int:route_id>/complete', methods=['POST'])
@login_required
def complete_route(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    route.status = 'completed'
    route.completed_at = datetime.utcnow()
    
    stops_data = []
    for stop in route.stops:
        stop_dict = stop.to_dict()
        stop_dict['pod_data'] = {
            'recipient_name': stop.recipient_name,
            'signature_url': stop.signature_url,
            'photo_url': stop.photo_url,
            'delivery_notes': stop.delivery_notes,
            'failed_reason': stop.failed_reason
        }
        stops_data.append(stop_dict)
    
    route_data = route.to_dict()
    route_data['stops_with_pod'] = stops_data
    
    history = RouteHistory(
        user_id=current_user.id,
        route_name=route.name,
        total_stops=len(route.stops),
        completed_stops=len([s for s in route.stops if s.status == 'completed']),
        failed_stops=len([s for s in route.stops if s.status == 'failed']),
        total_distance=route.total_distance,
        total_duration=route.total_duration,
        started_at=route.started_at,
        completed_at=route.completed_at,
        route_data=route_data
    )
    db.session.add(history)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "route": route.to_dict(),
        "history_id": history.id
    })


@app.route('/api/stops/<int:stop_id>/complete', methods=['POST'])
@login_required
def complete_stop(stop_id):
    stop = Stop.query.join(Route).filter(
        Stop.id == stop_id,
        Route.user_id == current_user.id
    ).first()
    
    if not stop:
        return jsonify({"error": "Parada no encontrada"}), 404
    
    data = request.get_json() or {}
    
    stop.status = 'completed'
    stop.completed_at = datetime.utcnow()
    
    if 'recipient_name' in data:
        stop.recipient_name = data['recipient_name']
    if 'signature_url' in data:
        stop.signature_url = data['signature_url']
    if 'photo_url' in data:
        stop.photo_url = data['photo_url']
    if 'delivery_notes' in data:
        stop.delivery_notes = data['delivery_notes']
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "stop": stop.to_dict()
    })


@app.route('/api/stops/<int:stop_id>/fail', methods=['POST'])
@login_required
def fail_stop(stop_id):
    stop = Stop.query.join(Route).filter(
        Stop.id == stop_id,
        Route.user_id == current_user.id
    ).first()
    
    if not stop:
        return jsonify({"error": "Parada no encontrada"}), 404
    
    data = request.get_json() or {}
    
    stop.status = 'failed'
    stop.completed_at = datetime.utcnow()
    stop.failed_reason = data.get('reason', 'No especificado')
    
    if 'photo_url' in data:
        stop.photo_url = data['photo_url']
    if 'delivery_notes' in data:
        stop.delivery_notes = data['delivery_notes']
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "stop": stop.to_dict()
    })


@app.route('/api/routes/<int:route_id>/import-csv', methods=['POST'])
@login_required
def import_stops_csv(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    data = request.get_json()
    csv_content = data.get('csv_content', '')
    
    if not csv_content:
        return jsonify({"error": "Contenido CSV vacío"}), 400
    
    reader = csv.DictReader(io.StringIO(csv_content))
    
    max_order = db.session.query(db.func.max(Stop.order)).filter_by(route_id=route_id).scalar() or -1
    
    imported_count = 0
    errors = []
    
    for i, row in enumerate(reader):
        try:
            address = row.get('address') or row.get('direccion') or row.get('Address') or ''
            lat = float(row.get('lat') or row.get('latitude') or row.get('Lat') or 0)
            lng = float(row.get('lng') or row.get('longitude') or row.get('Lng') or row.get('lon') or 0)
            
            if not address and (lat == 0 or lng == 0):
                errors.append(f"Fila {i+1}: Dirección o coordenadas requeridas")
                continue
            
            stop = Stop(
                route_id=route_id,
                address=address,
                lat=lat,
                lng=lng,
                order=max_order + 1 + imported_count,
                customer_name=row.get('customer_name') or row.get('nombre') or row.get('Name') or '',
                phone=row.get('phone') or row.get('telefono') or row.get('Phone') or '',
                note=row.get('note') or row.get('nota') or row.get('Note') or '',
                priority=int(row.get('priority') or row.get('prioridad') or 0),
                package_count=int(row.get('packages') or row.get('paquetes') or 1),
                package_location=row.get('package_location') or row.get('ubicacion_paquete') or ''
            )
            
            time_start = row.get('time_start') or row.get('hora_inicio') or ''
            time_end = row.get('time_end') or row.get('hora_fin') or ''
            
            if time_start:
                try:
                    stop.time_window_start = datetime.strptime(time_start, '%H:%M').time()
                except ValueError:
                    pass
            
            if time_end:
                try:
                    stop.time_window_end = datetime.strptime(time_end, '%H:%M').time()
                except ValueError:
                    pass
            
            db.session.add(stop)
            imported_count += 1
            
        except Exception as e:
            errors.append(f"Fila {i+1}: {str(e)}")
    
    db.session.commit()
    
    route.is_optimized = False
    db.session.commit()
    
    return jsonify({
        "success": True,
        "imported_count": imported_count,
        "errors": errors,
        "route": route.to_dict()
    })


@app.route('/api/routes/<int:route_id>/import-text', methods=['POST'])
@login_required
def import_stops_text(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    data = request.get_json()
    text_content = data.get('text', '')
    
    if not text_content:
        return jsonify({"error": "Contenido vacío"}), 400
    
    lines = [line.strip() for line in text_content.split('\n') if line.strip()]
    
    max_order = db.session.query(db.func.max(Stop.order)).filter_by(route_id=route_id).scalar() or -1
    
    imported_count = 0
    
    for i, line in enumerate(lines):
        stop = Stop(
            route_id=route_id,
            address=line,
            lat=0,
            lng=0,
            order=max_order + 1 + imported_count
        )
        db.session.add(stop)
        imported_count += 1
    
    db.session.commit()
    
    route.is_optimized = False
    db.session.commit()
    
    return jsonify({
        "success": True,
        "imported_count": imported_count,
        "route": route.to_dict(),
        "message": f"{imported_count} direcciones importadas. Geocodificación pendiente."
    })


@app.route('/api/history', methods=['GET'])
@login_required
def get_history():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    history = RouteHistory.query.filter_by(user_id=current_user.id)\
        .order_by(RouteHistory.created_at.desc())\
        .paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        "history": [h.to_dict() for h in history.items],
        "total": history.total,
        "pages": history.pages,
        "current_page": page
    })


@app.route('/api/history/<int:history_id>', methods=['GET'])
@login_required
def get_history_detail(history_id):
    history = RouteHistory.query.filter_by(id=history_id, user_id=current_user.id).first()
    if not history:
        return jsonify({"error": "Registro no encontrado"}), 404
    
    return jsonify({"history": history.to_dict()})


@app.route('/api/routes/<int:route_id>/directions', methods=['GET'])
@login_required
def get_route_directions(route_id):
    route = Route.query.filter_by(id=route_id, user_id=current_user.id).first()
    if not route:
        return jsonify({"error": "Ruta no encontrada"}), 404
    
    if len(route.stops) < 1:
        return jsonify({"error": "La ruta no tiene paradas"}), 400
    
    sorted_stops = sorted(route.stops, key=lambda s: s.order)
    
    if route.start_lat and route.start_lng:
        origin = {'lat': route.start_lat, 'lng': route.start_lng}
    else:
        origin = {'lat': sorted_stops[0].lat, 'lng': sorted_stops[0].lng}
        sorted_stops = sorted_stops[1:]
    
    if not sorted_stops:
        return jsonify({"error": "Se necesitan más paradas"}), 400
    
    destination = {'lat': sorted_stops[-1].lat, 'lng': sorted_stops[-1].lng}
    waypoints = [{'lat': s.lat, 'lng': s.lng} for s in sorted_stops[:-1]]
    
    directions = get_directions_google(origin, destination, waypoints if waypoints else None)
    
    if not directions:
        return jsonify({"error": "No se pudieron obtener direcciones"}), 500
    
    return jsonify({
        "success": True,
        "directions": directions
    })


with app.app_context():
    db.create_all()
    print("Base de datos inicializada correctamente")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
