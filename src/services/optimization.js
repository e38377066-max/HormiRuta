/**
 * @fileoverview Servicio para la optimización de rutas utilizando Google Maps Distance Matrix API.
 * Proporciona funciones para calcular distancias, construir tablas de distancias y optimizar el orden de las paradas.
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Calcula la distancia de Haversine entre dos puntos geográficos.
 * @description Utiliza la fórmula de Haversine para estimar la distancia en línea recta sobre la superficie terrestre.
 * @param {number} lat1 - Latitud del punto 1.
 * @param {number} lng1 - Longitud del punto 1.
 * @param {number} lat2 - Latitud del punto 2.
 * @param {number} lng2 - Longitud del punto 2.
 * @returns {number} Distancia en kilómetros.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Obtiene la matriz de distancias desde la API de Google Maps.
 * @description Realiza una petición a la API Distance Matrix para obtener distancias y tiempos de viaje reales.
 * @param {Array<Object>} origins - Lista de puntos de origen {lat, lng}.
 * @param {Array<Object>} destinations - Lista de puntos de destino {lat, lng}.
 * @returns {Promise<Object|null>} El objeto de respuesta de la API o null si falla.
 */
async function getDistanceMatrix(origins, destinations) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('No Google Maps API key, falling back to haversine distances');
    return null;
  }

  try {
    const originsStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
    const destsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originsStr)}&destinations=${encodeURIComponent(destsStr)}&mode=driving&language=es&departure_time=now&traffic_model=best_guess&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Distance Matrix API error:', data.status, data.error_message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error calling Distance Matrix API:', error.message);
    return null;
  }
}

/**
 * Construye tablas de distancia y duración entre todos los puntos.
 * @description Genera matrices n x n con las distancias (km) y duraciones (min) entre cada par de puntos.
 * @param {Array<Object>} points - Lista de puntos {lat, lng}.
 * @returns {Promise<Object>} Objeto con distTable y durTable.
 */
async function buildDistanceTable(points) {
  const n = points.length;
  const distTable = Array.from({ length: n }, () => Array(n).fill(0));
  const durTable = Array.from({ length: n }, () => Array(n).fill(0));

  const MAX_ELEMENTS = 25;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j += MAX_ELEMENTS) {
      const destEnd = Math.min(j + MAX_ELEMENTS, n);
      const destBatch = points.slice(j, destEnd);

      const matrix = await getDistanceMatrix([points[i]], destBatch);

      if (!matrix || !matrix.rows?.[0]) {
        for (let di = j; di < destEnd; di++) {
          const dist = haversineDistance(points[i].lat, points[i].lng, points[di].lat, points[di].lng);
          distTable[i][di] = dist;
          durTable[i][di] = (dist / 30) * 60;
        }
        continue;
      }

      const row = matrix.rows[0];
      for (let di = 0; di < row.elements.length; di++) {
        const element = row.elements[di];
        const globalIdx = j + di;
        if (element.status === 'OK') {
          distTable[i][globalIdx] = element.distance.value / 1000;
          const durationVal = element.duration_in_traffic
            ? element.duration_in_traffic.value
            : element.duration.value;
          durTable[i][globalIdx] = durationVal / 60;
        } else {
          const dist = haversineDistance(points[i].lat, points[i].lng, points[globalIdx].lat, points[globalIdx].lng);
          distTable[i][globalIdx] = dist;
          durTable[i][globalIdx] = (dist / 30) * 60;
        }
      }
    }
  }

  return { distTable, durTable };
}

/**
 * Optimiza el orden de las paradas en una ruta.
 * @description Utiliza un algoritmo de "vecino más cercano" (Greedy) priorizando las paradas de alta prioridad.
 * @param {Array<Object>} stops - Lista de paradas a optimizar.
 * @param {Object} [startLocation=null] - Ubicación de inicio {lat, lng}.
 * @param {boolean} [returnToStart=false] - Si la ruta debe regresar al punto de inicio.
 * @returns {Promise<Object>} Objeto con optimizedStops, totalDistance y totalDuration.
 */
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

  const allPoints = [];
  let startIdx = -1;

  if (startLocation) {
    startIdx = 0;
    allPoints.push({ lat: startLocation.lat, lng: startLocation.lng });
    stopsData.forEach(s => allPoints.push({ lat: s.lat, lng: s.lng }));
  } else {
    stopsData.forEach(s => allPoints.push({ lat: s.lat, lng: s.lng }));
  }

  console.log(`Optimizing route with ${stopsData.length} stops using Google Maps Distance Matrix...`);
  const { distTable, durTable } = await buildDistanceTable(allPoints);

  const stopOffset = startLocation ? 1 : 0;
  const visited = new Set();
  const optimizedOrder = [];
  let totalDistance = 0;
  let totalDuration = 0;

  let currentIdx = startLocation ? 0 : -1;

  const highPriority = stopsData
    .map((s, i) => ({ ...s, origIdx: i }))
    .filter(s => s.priority > 0)
    .sort((a, b) => b.priority - a.priority);

  for (const stop of highPriority) {
    visited.add(stop.origIdx);
    const pointIdx = stop.origIdx + stopOffset;
    let dist = 0, dur = 0;

    if (currentIdx >= 0) {
      dist = distTable[currentIdx][pointIdx];
      dur = durTable[currentIdx][pointIdx];
    }

    optimizedOrder.push({
      ...stop,
      order: optimizedOrder.length,
      distance_from_prev: Math.round(dist * 100) / 100,
      duration_from_prev: Math.round(dur)
    });

    totalDistance += dist;
    totalDuration += dur + (stop.duration || 5);
    currentIdx = pointIdx;
  }

  while (visited.size < stopsData.length) {
    let nearest = null;
    let nearestOrigIdx = -1;
    let minDur = Infinity;
    let nearestDist = 0;

    for (let i = 0; i < stopsData.length; i++) {
      if (visited.has(i)) continue;
      const pointIdx = i + stopOffset;

      let dur;
      if (currentIdx >= 0) {
        dur = durTable[currentIdx][pointIdx];
      } else {
        dur = 0;
      }

      if (dur < minDur) {
        minDur = dur;
        nearest = stopsData[i];
        nearestOrigIdx = i;
        nearestDist = currentIdx >= 0 ? distTable[currentIdx][pointIdx] : 0;
      }
    }

    if (nearest) {
      visited.add(nearestOrigIdx);
      const pointIdx = nearestOrigIdx + stopOffset;

      optimizedOrder.push({
        ...nearest,
        order: optimizedOrder.length,
        distance_from_prev: Math.round(nearestDist * 100) / 100,
        duration_from_prev: Math.round(minDur)
      });

      totalDistance += nearestDist;
      totalDuration += minDur + (nearest.duration || 5);
      currentIdx = pointIdx;
    }
  }

  if (returnToStart && startLocation && currentIdx >= 0) {
    const returnDist = distTable[currentIdx][0];
    const returnDur = durTable[currentIdx][0];
    totalDistance += returnDist;
    totalDuration += returnDur;
  }

  console.log(`Route optimized: ${Math.round(totalDistance * 100) / 100} km, ~${Math.round(totalDuration)} min (${GOOGLE_MAPS_API_KEY ? 'Google Maps' : 'haversine fallback'})`);

  return {
    optimizedStops: optimizedOrder,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalDuration: Math.round(totalDuration)
  };
}

/**
 * Calcula los ETAs estimados para cada parada.
 * @description Suma las duraciones de viaje y de servicio a partir de un tiempo de inicio dado.
 * @param {Array<Object>} stops - Paradas optimizadas con duration_from_prev.
 * @param {Date|string} startTime - Hora de inicio de la ruta.
 * @returns {Array<Object>} Paradas con el campo eta añadido.
 */
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

