import { useEffect, useState, useRef } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import api from '../../api'
import './TripPlannerPage.css'

export default function TripPlannerPage() {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const directionsRendererRef = useRef(null)
  
  const [routes, setRoutes] = useState([])
  const [currentRoute, setCurrentRoute] = useState(null)
  const [stops, setStops] = useState([])
  const [newAddress, setNewAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [showStopsList, setShowStopsList] = useState(true)
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    initMap()
    fetchRoutes()
  }, [])

  const initMap = async () => {
    const loader = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
      version: 'weekly',
      libraries: ['places', 'geometry']
    })

    const google = await loader.load()
    
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 32.7767, lng: -96.7970 },
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    })

    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map: mapInstanceRef.current,
      suppressMarkers: false
    })
  }

  const fetchRoutes = async () => {
    try {
      const response = await api.get('/api/routes')
      setRoutes(response.data.routes || [])
    } catch (error) {
      console.error('Error fetching routes:', error)
    }
  }

  const createRoute = async () => {
    try {
      const response = await api.post('/api/routes', {
        name: `Ruta ${new Date().toLocaleDateString()}`
      })
      setCurrentRoute(response.data)
      setStops([])
      fetchRoutes()
    } catch (error) {
      console.error('Error creating route:', error)
    }
  }

  const loadRoute = async (routeId) => {
    try {
      const response = await api.get(`/api/routes/${routeId}`)
      setCurrentRoute(response.data)
      setStops(response.data.stops || [])
      updateMapMarkers(response.data.stops || [])
    } catch (error) {
      console.error('Error loading route:', error)
    }
  }

  const addStop = async () => {
    if (!newAddress.trim() || !currentRoute) return

    setLoading(true)
    try {
      const geocoder = new window.google.maps.Geocoder()
      const result = await geocoder.geocode({ address: newAddress })
      
      if (result.results.length > 0) {
        const location = result.results[0].geometry.location
        
        const response = await api.post(`/api/routes/${currentRoute.id}/stops`, {
          address: newAddress,
          latitude: location.lat(),
          longitude: location.lng()
        })
        
        const updatedStops = [...stops, response.data]
        setStops(updatedStops)
        setNewAddress('')
        updateMapMarkers(updatedStops)
      }
    } catch (error) {
      console.error('Error adding stop:', error)
    } finally {
      setLoading(false)
    }
  }

  const removeStop = async (stopId) => {
    try {
      await api.delete(`/api/stops/${stopId}`)
      const updatedStops = stops.filter(s => s.id !== stopId)
      setStops(updatedStops)
      updateMapMarkers(updatedStops)
    } catch (error) {
      console.error('Error removing stop:', error)
    }
  }

  const optimizeRoute = async () => {
    if (!currentRoute) return
    
    setLoading(true)
    try {
      const response = await api.post(`/api/routes/${currentRoute.id}/optimize`)
      setStops(response.data.stops || [])
      updateMapMarkers(response.data.stops || [])
      calculateRoute(response.data.stops || [])
    } catch (error) {
      console.error('Error optimizing route:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateMapMarkers = (stopsList) => {
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    stopsList.forEach((stop, index) => {
      if (stop.latitude && stop.longitude) {
        const marker = new window.google.maps.Marker({
          position: { lat: stop.latitude, lng: stop.longitude },
          map: mapInstanceRef.current,
          label: String(index + 1),
          title: stop.address
        })
        markersRef.current.push(marker)
      }
    })

    if (stopsList.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      stopsList.forEach(stop => {
        if (stop.latitude && stop.longitude) {
          bounds.extend({ lat: stop.latitude, lng: stop.longitude })
        }
      })
      mapInstanceRef.current.fitBounds(bounds)
    }
  }

  const calculateRoute = async (stopsList) => {
    if (stopsList.length < 2) return

    const directionsService = new window.google.maps.DirectionsService()
    
    const waypoints = stopsList.slice(1, -1).map(stop => ({
      location: { lat: stop.latitude, lng: stop.longitude },
      stopover: true
    }))

    try {
      const result = await directionsService.route({
        origin: { lat: stopsList[0].latitude, lng: stopsList[0].longitude },
        destination: { lat: stopsList[stopsList.length - 1].latitude, lng: stopsList[stopsList.length - 1].longitude },
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING
      })

      directionsRendererRef.current.setDirections(result)
    } catch (error) {
      console.error('Error calculating route:', error)
    }
  }

  const startNavigation = async () => {
    if (!currentRoute || stops.length < 2) return
    
    try {
      await api.post(`/api/routes/${currentRoute.id}/start`)
      setIsNavigating(true)
      calculateRoute(stops)
    } catch (error) {
      console.error('Error starting navigation:', error)
    }
  }

  const completeStop = async (stopId) => {
    try {
      await api.post(`/api/stops/${stopId}/complete`)
      const updatedStops = stops.map(s => 
        s.id === stopId ? { ...s, status: 'completed' } : s
      )
      setStops(updatedStops)
    } catch (error) {
      console.error('Error completing stop:', error)
    }
  }

  return (
    <div className="trip-planner">
      <div className={`stops-panel ${showStopsList ? 'open' : 'closed'}`}>
        <div className="panel-header">
          <h3>Paradas</h3>
          <button className="toggle-panel" onClick={() => setShowStopsList(!showStopsList)}>
            {showStopsList ? '◀' : '▶'}
          </button>
        </div>

        {showStopsList && (
          <>
            <div className="route-selector">
              {!currentRoute ? (
                <button className="btn btn-primary btn-full" onClick={createRoute}>
                  + Nueva Ruta
                </button>
              ) : (
                <div className="current-route">
                  <span>{currentRoute.name}</span>
                  <button className="btn btn-outline btn-small" onClick={() => setCurrentRoute(null)}>
                    Cambiar
                  </button>
                </div>
              )}
              
              {!currentRoute && routes.length > 0 && (
                <div className="routes-list mt-2">
                  {routes.slice(0, 5).map(route => (
                    <button 
                      key={route.id}
                      className="route-item"
                      onClick={() => loadRoute(route.id)}
                    >
                      {route.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {currentRoute && (
              <>
                <div className="add-stop-form">
                  <input
                    type="text"
                    className="input"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Agregar direccion..."
                    onKeyPress={(e) => e.key === 'Enter' && addStop()}
                  />
                  <button 
                    className="btn btn-primary" 
                    onClick={addStop}
                    disabled={loading}
                  >
                    +
                  </button>
                </div>

                <div className="stops-list">
                  {stops.map((stop, index) => (
                    <div key={stop.id} className={`stop-item ${stop.status === 'completed' ? 'completed' : ''}`}>
                      <span className="stop-number">{index + 1}</span>
                      <div className="stop-info">
                        <span className="stop-address">{stop.address}</span>
                      </div>
                      {isNavigating && stop.status !== 'completed' && (
                        <button 
                          className="btn btn-positive btn-small"
                          onClick={() => completeStop(stop.id)}
                        >
                          ✓
                        </button>
                      )}
                      {!isNavigating && (
                        <button 
                          className="btn btn-negative btn-small"
                          onClick={() => removeStop(stop.id)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="panel-actions">
                  <button 
                    className="btn btn-secondary btn-full"
                    onClick={optimizeRoute}
                    disabled={stops.length < 2 || loading}
                  >
                    🔄 Optimizar Ruta
                  </button>
                  <button 
                    className="btn btn-positive btn-full mt-1"
                    onClick={startNavigation}
                    disabled={stops.length < 2}
                  >
                    🚗 Iniciar Navegacion
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="map-container" ref={mapRef}></div>
    </div>
  )
}
