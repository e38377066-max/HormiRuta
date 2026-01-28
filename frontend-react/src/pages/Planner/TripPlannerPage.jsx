import { useEffect, useState, useRef } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import api from '../../api'
import { usePlanner } from '../../layouts/PlannerLayout'
import './TripPlannerPage.css'

export default function TripPlannerPage() {
  const plannerContext = usePlanner()
  const onToggleDrawer = plannerContext?.toggleDrawer || (() => {})
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const directionsRendererRef = useRef(null)
  const searchInputRef = useRef(null)
  
  const [stops, setStops] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [panelExpanded, setPanelExpanded] = useState(true)
  const [isOptimized, setIsOptimized] = useState(false)
  const [navigationMode, setNavigationMode] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [routeName, setRouteName] = useState('Mi Ruta')
  const [totalDistance, setTotalDistance] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [savedDistance, setSavedDistance] = useState(0)
  const [savedDuration, setSavedDuration] = useState(0)
  const [startAddress, setStartAddress] = useState('')
  const [roundTrip, setRoundTrip] = useState(false)
  const [showRouteMenu, setShowRouteMenu] = useState(false)
  const [showRouteNameDialog, setShowRouteNameDialog] = useState(false)
  const [mapType, setMapType] = useState('roadmap')
  const [currentRouteId, setCurrentRouteId] = useState(null)
  const [panelHeight, setPanelHeight] = useState(45)
  const [panelSnap, setPanelSnap] = useState('mid')
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)
  const SNAP_POINTS = { min: 15, mid: 45, max: 80 }

  useEffect(() => {
    initMap()
  }, [])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return
      const deltaY = startY.current - e.clientY
      const deltaPercent = (deltaY / window.innerHeight) * 100
      const newHeight = Math.min(90, Math.max(10, startHeight.current + deltaPercent))
      setPanelHeight(newHeight)
    }

    const snapToNearest = (height) => {
      const snapValues = Object.values(SNAP_POINTS)
      let closest = snapValues[0]
      let minDist = Math.abs(height - closest)
      
      for (const snap of snapValues) {
        const dist = Math.abs(height - snap)
        if (dist < minDist) {
          minDist = dist
          closest = snap
        }
      }
      
      setPanelHeight(closest)
      if (closest === SNAP_POINTS.min) setPanelSnap('min')
      else if (closest === SNAP_POINTS.max) setPanelSnap('max')
      else setPanelSnap('mid')
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        snapToNearest(panelHeight)
      }
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    const handleTouchMove = (e) => {
      if (!isDragging.current) return
      const touch = e.touches[0]
      const deltaY = startY.current - touch.clientY
      const deltaPercent = (deltaY / window.innerHeight) * 100
      const newHeight = Math.min(90, Math.max(10, startHeight.current + deltaPercent))
      setPanelHeight(newHeight)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleMouseUp)
    }
  }, [panelHeight])

  const handlePanelDragStart = (e) => {
    isDragging.current = true
    startY.current = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY
    startHeight.current = panelHeight
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  const initMap = async () => {
    const loader = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
      version: 'weekly',
      libraries: ['places', 'geometry']
    })

    const google = await loader.load()
    
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 20.6597, lng: -103.3496 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false
    })

    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map: mapInstanceRef.current,
      suppressMarkers: false,
      polylineOptions: { strokeColor: '#1976d2', strokeWeight: 4 }
    })

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        mapInstanceRef.current.setCenter(loc)
        reverseGeocode(loc)
      })
    }
  }

  const reverseGeocode = async (location) => {
    const geocoder = new window.google.maps.Geocoder()
    try {
      const result = await geocoder.geocode({ location })
      if (result.results[0]) {
        setStartAddress(result.results[0].formatted_address)
      }
    } catch (err) {
      console.error('Reverse geocode error:', err)
    }
  }

  const searchAddress = async (query) => {
    setSearchQuery(query)
    if (!query || query.length < 3) {
      setSearchSuggestions([])
      return
    }

    const service = new window.google.maps.places.AutocompleteService()
    service.getPlacePredictions({ input: query, componentRestrictions: { country: 'mx' } }, (predictions) => {
      setSearchSuggestions(predictions || [])
    })
  }

  const selectSearchSuggestion = async (suggestion) => {
    setShowSearch(false)
    setSearchQuery('')
    setSearchSuggestions([])

    const geocoder = new window.google.maps.Geocoder()
    try {
      const result = await geocoder.geocode({ placeId: suggestion.place_id })
      if (result.results[0]) {
        const location = result.results[0].geometry.location
        addStop({
          address: suggestion.description,
          latitude: location.lat(),
          longitude: location.lng()
        })
      }
    } catch (err) {
      console.error('Geocode error:', err)
    }
  }

  const addStop = async (stopData) => {
    const newStop = {
      id: stops.length + 1,
      address: stopData.address,
      latitude: stopData.latitude,
      longitude: stopData.longitude,
      name: '',
      completed: false,
      color: '#1976d2'
    }
    
    const updatedStops = [...stops, newStop]
    setStops(updatedStops)
    setIsOptimized(false)
    updateMapMarkers(updatedStops)

    if (currentRouteId) {
      try {
        await api.post(`/api/routes/${currentRouteId}/stops`, stopData)
      } catch (err) {
        console.error('Error saving stop:', err)
      }
    }
  }

  const removeStop = (index) => {
    const updatedStops = stops.filter((_, i) => i !== index)
    setStops(updatedStops)
    setIsOptimized(false)
    updateMapMarkers(updatedStops)
  }

  const toggleStopComplete = (index) => {
    const updatedStops = stops.map((stop, i) => 
      i === index ? { ...stop, completed: !stop.completed } : stop
    )
    setStops(updatedStops)
  }

  const optimizeRoute = async () => {
    if (stops.length < 2) return
    setOptimizing(true)

    try {
      if (!currentRouteId) {
        const response = await api.post('/api/routes', { name: routeName })
        setCurrentRouteId(response.data.id)
        
        for (const stop of stops) {
          await api.post(`/api/routes/${response.data.id}/stops`, {
            address: stop.address,
            latitude: stop.latitude,
            longitude: stop.longitude
          })
        }
        
        const optimized = await api.post(`/api/routes/${response.data.id}/optimize`)
        if (optimized.data.stops) {
          const oldDistance = totalDistance
          setStops(optimized.data.stops.map((s, i) => ({ ...s, id: i + 1 })))
          await calculateRoute(optimized.data.stops)
          setSavedDistance(oldDistance - totalDistance)
        }
      } else {
        const optimized = await api.post(`/api/routes/${currentRouteId}/optimize`)
        if (optimized.data.stops) {
          setStops(optimized.data.stops.map((s, i) => ({ ...s, id: i + 1 })))
          await calculateRoute(optimized.data.stops)
        }
      }
      setIsOptimized(true)
    } catch (err) {
      console.error('Error optimizing:', err)
    } finally {
      setOptimizing(false)
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
          label: { text: String(index + 1), color: 'white' },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: stop.completed ? '#4caf50' : (stop.color || '#1976d2'),
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: 'white'
          }
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
      mapInstanceRef.current.fitBounds(bounds, 50)
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
      
      let distance = 0, duration = 0
      result.routes[0].legs.forEach(leg => {
        distance += leg.distance.value
        duration += leg.duration.value
      })
      setTotalDistance(distance / 1000)
      setTotalDuration(duration / 60)
    } catch (err) {
      console.error('Route calculation error:', err)
    }
  }

  const confirmRoute = () => {
    setNavigationMode(true)
  }

  const exitNavigation = () => {
    setNavigationMode(false)
  }

  const clearRoute = () => {
    setStops([])
    setIsOptimized(false)
    setNavigationMode(false)
    setCurrentRouteId(null)
    setTotalDistance(0)
    setTotalDuration(0)
    setSavedDistance(0)
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] })
    }
  }

  const toggleMapType = () => {
    const newType = mapType === 'roadmap' ? 'satellite' : 'roadmap'
    setMapType(newType)
    mapInstanceRef.current?.setMapTypeId(newType)
  }

  const centerOnLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        mapInstanceRef.current?.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        mapInstanceRef.current?.setZoom(15)
      })
    }
  }

  const focusSearch = () => {
    searchInputRef.current?.focus()
    setShowSearch(true)
  }

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${Math.round(minutes)} min`
    const hrs = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hrs}h ${mins}m`
  }

  const formatTime = (date) => {
    if (!date) return ''
    return new Date(date).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  const nextPendingStop = stops.find(s => !s.completed)

  return (
    <div className="trip-planner-page">
      <div className="map-section">
        <div id="trip-map" className="map-container" ref={mapRef}></div>
        
        <button className="menu-fab" onClick={onToggleDrawer}>
          <span className="material-icons">menu</span>
        </button>
        
        {savedDistance > 0 && (
          <div className="savings-banner">
            <span className="material-icons text-positive">check_circle</span>
            <span>{savedDistance.toFixed(1)} km, {Math.round(savedDuration)} min ahorrados</span>
            <button className="close-btn" onClick={() => setSavedDistance(0)}>
              <span className="material-icons">close</span>
            </button>
          </div>
        )}
        
        <div className="map-controls">
          <button className="map-control-btn" onClick={toggleMapType}>
            <span className="material-icons">layers</span>
          </button>
          <button className="map-control-btn" onClick={centerOnLocation}>
            <span className="material-icons">my_location</span>
          </button>
        </div>
      </div>
      
      <div className={`bottom-panel ${isDragging.current ? 'dragging' : ''}`} style={{ height: `${panelHeight}vh` }}>
        <div 
          className="panel-handle" 
          onMouseDown={handlePanelDragStart}
          onTouchStart={handlePanelDragStart}
        >
          <div className="handle-bar"></div>
        </div>
        
        <div className="panel-header">
          <div className="panel-header-left">
            <span className="stops-count">{stops.length} parada{stops.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="panel-header-right">
            <button className="header-btn" onClick={focusSearch}>
              <span className="material-icons">search</span>
            </button>
            <button className="header-btn" onClick={() => setShowRouteMenu(true)}>
              <span className="material-icons">more_vert</span>
            </button>
          </div>
        </div>
        
        <div className="panel-scrollable">
          <div className="route-name-section" onClick={() => setShowRouteNameDialog(true)}>
            <h2 className="route-name">{routeName}</h2>
          </div>
          
          <div className="config-section">
            <div className="config-label">Configuración de ruta</div>
            
            <div className="config-item">
              <div className="config-item-left">
                <span className="config-time">{formatDuration(totalDuration).split(' ')[0]}</span>
                <div className="config-content">
                  <div className="config-title">Empezar desde la ubicación actual</div>
                  <div className="config-subtitle">Utiliza la posición del GPS al optimizar</div>
                </div>
              </div>
              <span className="material-icons config-icon">home</span>
            </div>
            
            <div className="config-item" onClick={() => setRoundTrip(!roundTrip)}>
              <div className="config-item-left">
                <span className="config-time">•</span>
                <div className="config-content">
                  <div className="config-title">Viaje de ida y vuelta</div>
                  <div className="config-subtitle">{roundTrip ? 'Regresa al punto de inicio' : 'Volver al punto de partida'}</div>
                </div>
              </div>
              <span className="material-icons config-icon">{roundTrip ? 'check_box' : 'flag'}</span>
            </div>
            
            <div className="config-item">
              <div className="config-item-left">
                <span className="config-time">•</span>
                <div className="config-content">
                  <div className="config-title">Sin descanso</div>
                  <div className="config-subtitle">Pulsa para planificar un descanso</div>
                </div>
              </div>
              <span className="material-icons config-icon">free_breakfast</span>
            </div>
          </div>
          
          {stops.length > 0 && (
            <>
              <div className="stops-section-header">Parada</div>
              {stops.map((stop, index) => (
                <div key={stop.id} className="stop-row" onClick={() => navigationMode && toggleStopComplete(index)}>
                  <span className="stop-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="stop-name">{stop.name || stop.address?.split(',')[0] || 'Lugar sin nombre'}</span>
                  {!navigationMode && (
                    <button 
                      className="header-btn" 
                      onClick={(e) => { e.stopPropagation(); removeStop(index); }}
                      style={{ marginRight: -8 }}
                    >
                      <span className="material-icons" style={{ fontSize: 18, color: '#666' }}>close</span>
                    </button>
                  )}
                  <div className={`stop-indicator ${stop.completed ? 'completed' : ''}`}></div>
                </div>
              ))}
            </>
          )}
        </div>
        
        <div className="panel-footer">
          <button 
            className="btn-optimize" 
            onClick={stops.length >= 2 ? optimizeRoute : focusSearch} 
            disabled={optimizing}
          >
            <span className="material-icons">{stops.length >= 2 ? 'autorenew' : 'add'}</span>
            {optimizing ? 'Optimizando...' : stops.length >= 2 ? 'Optimizar la ruta' : 'Añadir paradas'}
          </button>
        </div>
      </div>
      
      {showSearch && (
        <div className="search-overlay">
          <div className="search-header">
            <button className="search-back" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchSuggestions([]); }}>
              <span className="material-icons">arrow_back</span>
            </button>
            <input
              ref={searchInputRef}
              type="text"
              className="search-input-full"
              value={searchQuery}
              onChange={(e) => searchAddress(e.target.value)}
              placeholder="Pulsa para añadir más"
              autoFocus
            />
          </div>
          <div className="search-results">
            {searchSuggestions.map((sug, i) => (
              <div key={i} className="search-result-item" onClick={() => selectSearchSuggestion(sug)}>
                <span className="material-icons">place</span>
                <span className="search-result-text">{sug.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {showRouteMenu && (
        <div className="modal-overlay" onClick={() => setShowRouteMenu(false)}>
          <div className="modal-bottom" onClick={e => e.stopPropagation()}>
            <div className="menu-item" onClick={() => { setRoundTrip(!roundTrip); setShowRouteMenu(false) }}>
              <span className="material-icons">replay</span>
              <span>{roundTrip ? 'Solo ida' : 'Ida y vuelta'}</span>
            </div>
            <div className="menu-item" onClick={() => { setShowRouteNameDialog(true); setShowRouteMenu(false) }}>
              <span className="material-icons">edit</span>
              <span>Editar nombre de ruta</span>
            </div>
            <div className="menu-divider"></div>
            <div className="menu-item text-negative" onClick={() => { clearRoute(); setShowRouteMenu(false) }}>
              <span className="material-icons">delete_sweep</span>
              <span>Borrar todo</span>
            </div>
          </div>
        </div>
      )}
      
      {showRouteNameDialog && (
        <div className="modal-overlay" onClick={() => setShowRouteNameDialog(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Nombre de la ruta</h3>
            <input
              type="text"
              className="q-input"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Mi Ruta"
            />
            <div className="modal-actions">
              <button className="btn-flat" onClick={() => setShowRouteNameDialog(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => setShowRouteNameDialog(false)}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
