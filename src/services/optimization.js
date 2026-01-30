function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateDuration(distanceKm, avgSpeedKmh = 30) {
  return (distanceKm / avgSpeedKmh) * 60;
}

export async function optimizeRouteOrder(stops, startLocation = null, returnToStart = false) {
  if (stops.length < 2) {
    return {
      optimizedStops: stops.map((s, i) => ({ ...s.toDict(), order: i })),
      totalDistance: 0,
      totalDuration: 0
    };
  }
  
  const stopsData = stops.map(s => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    priority: s.priority || 0,
    duration: s.duration || 5,
    ...s.toDict()
  }));
  
  let currentLocation = startLocation || { lat: stopsData[0].lat, lng: stopsData[0].lng };
  const visited = new Set();
  const optimizedOrder = [];
  let totalDistance = 0;
  let totalDuration = 0;
  
  const highPriority = stopsData.filter(s => s.priority > 0).sort((a, b) => b.priority - a.priority);
  for (const stop of highPriority) {
    visited.add(stop.id);
    const distance = calculateDistance(currentLocation.lat, currentLocation.lng, stop.lat, stop.lng);
    const duration = estimateDuration(distance);
    
    optimizedOrder.push({
      ...stop,
      order: optimizedOrder.length,
      distance_from_prev: distance,
      duration_from_prev: duration
    });
    
    totalDistance += distance;
    totalDuration += duration + (stop.duration || 5);
    currentLocation = { lat: stop.lat, lng: stop.lng };
  }
  
  while (visited.size < stopsData.length) {
    let nearest = null;
    let minDistance = Infinity;
    
    for (const stop of stopsData) {
      if (visited.has(stop.id)) continue;
      
      const distance = calculateDistance(currentLocation.lat, currentLocation.lng, stop.lat, stop.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = stop;
      }
    }
    
    if (nearest) {
      visited.add(nearest.id);
      const duration = estimateDuration(minDistance);
      
      optimizedOrder.push({
        ...nearest,
        order: optimizedOrder.length,
        distance_from_prev: minDistance,
        duration_from_prev: duration
      });
      
      totalDistance += minDistance;
      totalDuration += duration + (nearest.duration || 5);
      currentLocation = { lat: nearest.lat, lng: nearest.lng };
    }
  }
  
  if (returnToStart && startLocation) {
    const returnDistance = calculateDistance(currentLocation.lat, currentLocation.lng, startLocation.lat, startLocation.lng);
    totalDistance += returnDistance;
    totalDuration += estimateDuration(returnDistance);
  }
  
  return {
    optimizedStops: optimizedOrder,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalDuration: Math.round(totalDuration)
  };
}

export function calculateEtas(stops, startTime) {
  let currentTime = new Date(startTime);
  
  return stops.map(stop => {
    if (stop.duration_from_prev) {
      currentTime = new Date(currentTime.getTime() + stop.duration_from_prev * 60000);
    }
    
    const eta = new Date(currentTime);
    
    currentTime = new Date(currentTime.getTime() + (stop.duration || 5) * 60000);
    
    return {
      ...stop,
      eta
    };
  });
}
