import os
import requests
from math import radians, sin, cos, sqrt, atan2
from itertools import permutations

GOOGLE_MAPS_KEY = os.environ.get('QUASAR_GOOGLE_MAPS_KEY', '')

def haversine_distance(lat1, lng1, lat2, lng2):
    R = 6371
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c


def get_distance_matrix_google(locations):
    if not GOOGLE_MAPS_KEY or len(locations) < 2:
        return None
    
    origins = '|'.join([f"{loc['lat']},{loc['lng']}" for loc in locations])
    destinations = origins
    
    try:
        response = requests.get(
            'https://maps.googleapis.com/maps/api/distancematrix/json',
            params={
                'origins': origins,
                'destinations': destinations,
                'key': GOOGLE_MAPS_KEY,
                'mode': 'driving',
                'language': 'es'
            },
            timeout=30
        )
        data = response.json()
        
        if data.get('status') != 'OK':
            return None
        
        n = len(locations)
        distance_matrix = [[0] * n for _ in range(n)]
        duration_matrix = [[0] * n for _ in range(n)]
        
        for i, row in enumerate(data.get('rows', [])):
            for j, element in enumerate(row.get('elements', [])):
                if element.get('status') == 'OK':
                    distance_matrix[i][j] = element['distance']['value'] / 1000
                    duration_matrix[i][j] = element['duration']['value'] // 60
                else:
                    distance_matrix[i][j] = haversine_distance(
                        locations[i]['lat'], locations[i]['lng'],
                        locations[j]['lat'], locations[j]['lng']
                    )
                    duration_matrix[i][j] = int(distance_matrix[i][j] * 2)
        
        return {
            'distances': distance_matrix,
            'durations': duration_matrix
        }
    except Exception as e:
        print(f"Error getting distance matrix: {e}")
        return None


def get_distance_matrix_haversine(locations):
    n = len(locations)
    distance_matrix = [[0] * n for _ in range(n)]
    duration_matrix = [[0] * n for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            if i != j:
                dist = haversine_distance(
                    locations[i]['lat'], locations[i]['lng'],
                    locations[j]['lat'], locations[j]['lng']
                )
                distance_matrix[i][j] = dist
                duration_matrix[i][j] = int(dist * 2)
    
    return {
        'distances': distance_matrix,
        'durations': duration_matrix
    }


def nearest_neighbor_tsp(distance_matrix, start_index=0):
    n = len(distance_matrix)
    if n <= 1:
        return list(range(n)), 0
    
    visited = [False] * n
    path = [start_index]
    visited[start_index] = True
    total_distance = 0
    
    current = start_index
    for _ in range(n - 1):
        nearest = None
        nearest_distance = float('inf')
        
        for j in range(n):
            if not visited[j] and distance_matrix[current][j] < nearest_distance:
                nearest = j
                nearest_distance = distance_matrix[current][j]
        
        if nearest is not None:
            visited[nearest] = True
            path.append(nearest)
            total_distance += nearest_distance
            current = nearest
    
    return path, total_distance


def two_opt_improvement(path, distance_matrix):
    n = len(path)
    if n <= 3:
        return path
    
    improved = True
    while improved:
        improved = False
        for i in range(1, n - 1):
            for j in range(i + 1, n):
                if j == i + 1:
                    continue
                
                d1 = distance_matrix[path[i-1]][path[i]] + distance_matrix[path[j-1]][path[j]]
                d2 = distance_matrix[path[i-1]][path[j-1]] + distance_matrix[path[i]][path[j]]
                
                if d2 < d1:
                    path[i:j] = reversed(path[i:j])
                    improved = True
    
    return path


def optimize_route_order(stops, start_location=None, return_to_start=False):
    if len(stops) <= 1:
        return stops, 0, 0
    
    locations = []
    
    if start_location:
        locations.append({
            'lat': start_location['lat'],
            'lng': start_location['lng'],
            'is_start': True
        })
    
    for stop in stops:
        locations.append({
            'lat': stop.lat,
            'lng': stop.lng,
            'stop': stop
        })
    
    matrix = get_distance_matrix_google(locations)
    if not matrix:
        matrix = get_distance_matrix_haversine(locations)
    
    start_index = 0 if start_location else 0
    
    priority_stops = []
    normal_stops = []
    
    for i, loc in enumerate(locations):
        if 'stop' in loc:
            stop = loc['stop']
            if stop.priority > 0 or stop.time_window_start:
                priority_stops.append((i, stop))
            else:
                normal_stops.append(i)
    
    if len(normal_stops) <= 10:
        path, total_distance = nearest_neighbor_tsp(matrix['distances'], start_index)
        path = two_opt_improvement(path, matrix['distances'])
    else:
        path, total_distance = nearest_neighbor_tsp(matrix['distances'], start_index)
        path = two_opt_improvement(path, matrix['distances'])
    
    total_duration = 0
    for i in range(len(path) - 1):
        total_duration += matrix['durations'][path[i]][path[i + 1]]
    
    optimized_stops = []
    new_order = 0
    
    for idx in path:
        if 'stop' in locations[idx]:
            stop = locations[idx]['stop']
            stop.order = new_order
            
            if new_order > 0:
                prev_idx = path[path.index(idx) - 1]
                stop.distance_from_prev = matrix['distances'][prev_idx][idx]
                stop.duration_from_prev = matrix['durations'][prev_idx][idx]
            
            optimized_stops.append(stop)
            new_order += 1
    
    if return_to_start and start_location and len(path) > 1:
        last_idx = path[-1]
        total_distance += matrix['distances'][last_idx][0]
        total_duration += matrix['durations'][last_idx][0]
    
    return optimized_stops, round(total_distance, 2), total_duration


def calculate_etas(stops, start_time=None):
    from datetime import datetime, timedelta
    
    if not start_time:
        start_time = datetime.now()
    
    current_time = start_time
    
    for stop in sorted(stops, key=lambda s: s.order):
        if stop.duration_from_prev:
            current_time += timedelta(minutes=stop.duration_from_prev)
        
        stop.eta = current_time
        
        stop_duration = stop.duration or 5
        current_time += timedelta(minutes=stop_duration)
    
    return stops


def get_directions_google(origin, destination, waypoints=None):
    if not GOOGLE_MAPS_KEY:
        return None
    
    params = {
        'origin': f"{origin['lat']},{origin['lng']}",
        'destination': f"{destination['lat']},{destination['lng']}",
        'key': GOOGLE_MAPS_KEY,
        'mode': 'driving',
        'language': 'es'
    }
    
    if waypoints:
        wp_str = '|'.join([f"{w['lat']},{w['lng']}" for w in waypoints])
        params['waypoints'] = f"optimize:false|{wp_str}"
    
    try:
        response = requests.get(
            'https://maps.googleapis.com/maps/api/directions/json',
            params=params,
            timeout=30
        )
        return response.json()
    except Exception as e:
        print(f"Error getting directions: {e}")
        return None
