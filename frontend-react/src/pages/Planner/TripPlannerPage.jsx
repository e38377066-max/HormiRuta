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
  const userLocationMarkerRef = useRef(null)
  const watchIdRef = useRef(null)
  const selectedMarkerRef = useRef(null)
  const [userLocation, setUserLocation] = useState(null)
  const [selectedPoint, setSelectedPoint] = useState(null)
  
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
  const [useCurrentLocation, setUseCurrentLocation] = useState(true)
  const [startTime, setStartTime] = useState(null)
  const [stopDuration, setStopDuration] = useState(5)
  const [breakTime, setBreakTime] = useState(null)
  const [travelMode, setTravelMode] = useState('DRIVING')
  const [avoidHighways, setAvoidHighways] = useState(false)
  const [avoidTolls, setAvoidTolls] = useState(false)
  const [trafficModel, setTrafficModel] = useState('best_guess')
  const [showRouteMenu, setShowRouteMenu] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(null)
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
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      gestureHandling: 'greedy'
    })

    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map: mapInstanceRef.current,
      suppressMarkers: false,
      polylineOptions: { strokeColor: '#5b8def', strokeWeight: 5 }
    })

    mapInstanceRef.current.addListener('click', handleMapClick)

    startLocationTracking()
  }

  const startLocationTracking = () => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        mapInstanceRef.current?.setCenter(loc)
        reverseGeocode(loc)
        updateUserLocationMarker(loc)
      },
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: true }
    )

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        updateUserLocationMarker(loc, pos.coords.accuracy)
      },
      (err) => console.error('Watch position error:', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )
  }

  const updateUserLocationMarker = (location, accuracy = 30) => {
    if (!mapInstanceRef.current) return

    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.marker.setPosition(location)
      userLocationMarkerRef.current.accuracyCircle.setCenter(location)
      userLocationMarkerRef.current.accuracyCircle.setRadius(accuracy)
    } else {
      const accuracyCircle = new window.google.maps.Circle({
        map: mapInstanceRef.current,
        center: location,
        radius: accuracy,
        fillColor: '#4285F4',
        fillOpacity: 0.15,
        strokeColor: '#4285F4',
        strokeOpacity: 0.4,
        strokeWeight: 1,
        clickable: false
      })

      const marker = new window.google.maps.Marker({
        position: location,
        map: mapInstanceRef.current,
        icon: {
          url: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="white" stroke-width="3"/>
            </svg>
          `),
          anchor: new window.google.maps.Point(12, 12),
          scaledSize: new window.google.maps.Size(24, 24)
        },
        zIndex: 999,
        clickable: false
      })

      userLocationMarkerRef.current = { marker, accuracyCircle }
    }
  }

  const handleMapClick = async (e) => {
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null)
    }

    selectedMarkerRef.current = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      icon: {
        url: 'data:image/svg+xml,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
            <path d="M20 0C8.954 0 0 8.954 0 20c0 15 20 30 20 30s20-15 20-30c0-11.046-8.954-20-20-20z" fill="#5b8def" stroke="white" stroke-width="2"/>
            <circle cx="20" cy="18" r="8" fill="white"/>
          </svg>
        `),
        anchor: new window.google.maps.Point(20, 50),
        scaledSize: new window.google.maps.Size(40, 50)
      },
      animation: window.google.maps.Animation.DROP,
      zIndex: 1000
    })

    let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    
    const geocoder = new window.google.maps.Geocoder()
    try {
      const result = await geocoder.geocode({ location: { lat, lng } })
      if (result.results && result.results[0]) {
        address = result.results[0].formatted_address
      }
    } catch (err) {
      console.log('Using coordinates as address')
    }

    setSelectedPoint({ lat, lng, address })
  }

  const addSelectedPoint = () => {
    if (!selectedPoint) return

    addStop({
      address: selectedPoint.address,
      latitude: selectedPoint.lat,
      longitude: selectedPoint.lng
    })

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null)
      selectedMarkerRef.current = null
    }
    setSelectedPoint(null)
  }

  const cancelSelectedPoint = () => {
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null)
      selectedMarkerRef.current = null
    }
    setSelectedPoint(null)
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

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
      const oldDistance = totalDistance
      
      // Intentar usar el backend primero
      try {
        let routeId = currentRouteId
        
        if (!routeId) {
          const response = await api.post('/api/routes', { name: routeName })
          routeId = response.data.route?.id || response.data.id
          setCurrentRouteId(routeId)
          
          for (const stop of stops) {
            await api.post(`/api/routes/${routeId}/stops`, {
              address: stop.address,
              lat: stop.latitude,
              lng: stop.longitude
            })
          }
        }
        
        const startLoc = userLocation || (stops[0] ? { lat: stops[0].latitude, lng: stops[0].longitude } : null)
        
        const optimized = await api.post(`/api/routes/${routeId}/optimize`, {
          start_lat: startLoc?.lat,
          start_lng: startLoc?.lng,
          return_to_start: roundTrip
        })
        
        if (optimized.data.route?.stops) {
          const backendStops = optimized.data.route.stops.map((s, i) => ({
            id: i + 1,
            address: s.address,
            latitude: s.lat,
            longitude: s.lng,
            completed: false,
            color: '#EA4335'
          }))
          setStops(backendStops)
          updateMapMarkers(backendStops)
          await calculateRoute(backendStops)
          
          if (optimized.data.total_distance_km) {
            setTotalDistance(optimized.data.total_distance_km)
            setTotalDuration(optimized.data.total_duration_min)
          }
        }
        
        setIsOptimized(true)
        setOptimizing(false)
        return
      } catch (backendErr) {
        console.log('Backend not available, using Google Maps optimization')
      }

      // Fallback: usar Google Maps directamente
      if (stops.length === 2) {
        await calculateRoute(stops)
        setIsOptimized(true)
        setOptimizing(false)
        return
      }

      const directionsService = new window.google.maps.DirectionsService()
      
      const origin = { lat: stops[0].latitude, lng: stops[0].longitude }
      const destination = roundTrip 
        ? origin 
        : { lat: stops[stops.length - 1].latitude, lng: stops[stops.length - 1].longitude }
      
      const waypointStops = roundTrip ? stops : stops.slice(1, -1)
      const waypoints = waypointStops.map(stop => ({
        location: { lat: stop.latitude, lng: stop.longitude },
        stopover: true
      }))

      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: true,
        travelMode: window.google.maps.TravelMode[travelMode],
        avoidHighways,
        avoidTolls,
        drivingOptions: travelMode === 'DRIVING' ? {
          departureTime: startTime ? new Date(startTime) : new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS
        } : undefined
      })

      if (result.routes[0].waypoint_order) {
        const waypointOrder = result.routes[0].waypoint_order
        let optimizedStops
        
        if (roundTrip) {
          optimizedStops = [stops[0], ...waypointOrder.map(i => stops[i])]
        } else {
          const middleStops = stops.slice(1, -1)
          const optimizedMiddle = waypointOrder.map(i => middleStops[i])
          optimizedStops = [stops[0], ...optimizedMiddle, stops[stops.length - 1]]
        }
        
        const reorderedStops = optimizedStops.map((stop, i) => ({
          ...stop,
          id: i + 1
        }))
        
        setStops(reorderedStops)
        updateMapMarkers(reorderedStops)
        
        directionsRendererRef.current.setDirections(result)
        
        let distance = 0, duration = 0
        result.routes[0].legs.forEach(leg => {
          distance += leg.distance.value
          duration += leg.duration.value
        })
        setTotalDistance(distance / 1000)
        setTotalDuration(duration / 60)
        
        if (oldDistance > 0) {
          setSavedDistance(oldDistance - (distance / 1000))
        }
      }
      
      setIsOptimized(true)
    } catch (err) {
      console.error('Error optimizing:', err)
      await calculateRoute(stops)
      setIsOptimized(true)
    } finally {
      setOptimizing(false)
    }
  }

  const updateMapMarkers = (stopsList) => {
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    stopsList.forEach((stop, index) => {
      if (stop.latitude && stop.longitude) {
        const isCompleted = stop.completed
        const color = isCompleted ? '#22c55e' : '#EA4335'
        
        const marker = new window.google.maps.Marker({
          position: { lat: stop.latitude, lng: stop.longitude },
          map: mapInstanceRef.current,
          label: {
            text: String(index + 1),
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold'
          },
          icon: {
            url: 'data:image/svg+xml,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
                <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="${color}"/>
                <circle cx="16" cy="14" r="6" fill="white" opacity="0.3"/>
              </svg>
            `),
            anchor: new window.google.maps.Point(16, 40),
            scaledSize: new window.google.maps.Size(32, 40),
            labelOrigin: new window.google.maps.Point(16, 14)
          }
        })
        markersRef.current.push(marker)
      }
    })

    if (stopsList.length > 1) {
      const bounds = new window.google.maps.LatLngBounds()
      stopsList.forEach(stop => {
        if (stop.latitude && stop.longitude) {
          bounds.extend({ lat: stop.latitude, lng: stop.longitude })
        }
      })
      if (userLocation) {
        bounds.extend(userLocation)
      }
      mapInstanceRef.current.fitBounds(bounds, 80)
      
      const listener = window.google.maps.event.addListener(mapInstanceRef.current, 'idle', () => {
        if (mapInstanceRef.current.getZoom() > 16) {
          mapInstanceRef.current.setZoom(16)
        }
        window.google.maps.event.removeListener(listener)
      })
    } else if (stopsList.length === 1 && stopsList[0].latitude) {
      mapInstanceRef.current.panTo({ lat: stopsList[0].latitude, lng: stopsList[0].longitude })
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
    if (userLocation) {
      mapInstanceRef.current?.setCenter(userLocation)
      mapInstanceRef.current?.setZoom(16)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        mapInstanceRef.current?.setCenter(loc)
        mapInstanceRef.current?.setZoom(16)
        updateUserLocationMarker(loc)
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
            
            <div className="config-item" onClick={() => setUseCurrentLocation(!useCurrentLocation)}>
              <div className="config-item-left">
                <span className="config-time">{startTime ? new Date(startTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : 'Ahora'}</span>
                <div className="config-content">
                  <div className="config-title">{useCurrentLocation ? 'Empezar desde la ubicación actual' : 'Empezar desde primera parada'}</div>
                  <div className="config-subtitle">{useCurrentLocation ? 'Utiliza la posición del GPS al optimizar' : 'Inicia desde la primera parada de la lista'}</div>
                </div>
              </div>
              <span className="material-icons config-icon" style={{ color: useCurrentLocation ? '#5b8def' : '#666' }}>
                {useCurrentLocation ? 'gps_fixed' : 'location_off'}
              </span>
            </div>
            
            <div className="config-item" onClick={() => setRoundTrip(!roundTrip)}>
              <div className="config-item-left">
                <span className="config-time">•</span>
                <div className="config-content">
                  <div className="config-title">Viaje de ida y vuelta</div>
                  <div className="config-subtitle">{roundTrip ? 'Regresa al punto de inicio' : 'Termina en la última parada'}</div>
                </div>
              </div>
              <span className="material-icons config-icon" style={{ color: roundTrip ? '#22c55e' : '#666' }}>
                {roundTrip ? 'check_box' : 'check_box_outline_blank'}
              </span>
            </div>
            
            <div className="config-item" onClick={() => setShowConfigModal('break')}>
              <div className="config-item-left">
                <span className="config-time">•</span>
                <div className="config-content">
                  <div className="config-title">{breakTime ? `Descanso a las ${breakTime}` : 'Sin descanso'}</div>
                  <div className="config-subtitle">{breakTime ? 'Pulsa para editar' : 'Pulsa para planificar un descanso'}</div>
                </div>
              </div>
              <span className="material-icons config-icon" style={{ color: breakTime ? '#f59e0b' : '#666' }}>
                {breakTime ? 'coffee' : 'free_breakfast'}
              </span>
            </div>
            
            <div className="config-item" onClick={() => setShowConfigModal('duration')}>
              <div className="config-item-left">
                <span className="config-time">•</span>
                <div className="config-content">
                  <div className="config-title">{stopDuration} min por parada</div>
                  <div className="config-subtitle">Tiempo estimado en cada entrega</div>
                </div>
              </div>
              <span className="material-icons config-icon" style={{ color: '#666' }}>timer</span>
            </div>
            
            <div className="config-item" onClick={() => setShowConfigModal('vehicle')}>
              <div className="config-item-left">
                <span className="config-time">•</span>
                <div className="config-content">
                  <div className="config-title">{travelMode === 'DRIVING' ? 'Carro/Moto' : travelMode === 'BICYCLING' ? 'Bicicleta' : 'A pie'}</div>
                  <div className="config-subtitle">Tipo de vehículo para la ruta</div>
                </div>
              </div>
              <span className="material-icons config-icon" style={{ color: '#666' }}>
                {travelMode === 'DRIVING' ? 'directions_car' : travelMode === 'BICYCLING' ? 'pedal_bike' : 'directions_walk'}
              </span>
            </div>
            
            <div className="config-item" onClick={() => setAvoidTolls(!avoidTolls)}>
              <div className="config-item-left">
                <span className="config-time">•</span>
                <div className="config-content">
                  <div className="config-title">Evitar peajes</div>
                  <div className="config-subtitle">{avoidTolls ? 'Activado' : 'Desactivado'}</div>
                </div>
              </div>
              <span className="material-icons config-icon" style={{ color: avoidTolls ? '#22c55e' : '#666' }}>
                {avoidTolls ? 'check_box' : 'check_box_outline_blank'}
              </span>
            </div>
            
            <div className="config-item" onClick={() => setAvoidHighways(!avoidHighways)}>
              <div className="config-item-left">
                <span className="config-time">•</span>
                <div className="config-content">
                  <div className="config-title">Evitar autopistas</div>
                  <div className="config-subtitle">{avoidHighways ? 'Activado' : 'Desactivado'}</div>
                </div>
              </div>
              <span className="material-icons config-icon" style={{ color: avoidHighways ? '#22c55e' : '#666' }}>
                {avoidHighways ? 'check_box' : 'check_box_outline_blank'}
              </span>
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
          {selectedPoint ? (
            <div className="selected-point-footer">
              <div className="selected-point-info">
                <span className="material-icons" style={{ color: '#5b8def' }}>place</span>
                <span className="selected-address">{selectedPoint.address?.split(',')[0] || 'Ubicación seleccionada'}</span>
              </div>
              <div className="selected-point-actions">
                <button className="btn-cancel" onClick={cancelSelectedPoint}>
                  Cancelar
                </button>
                <button className="btn-add-stop" onClick={addSelectedPoint}>
                  <span className="material-icons">add</span>
                  Parada {stops.length + 1}
                </button>
              </div>
            </div>
          ) : (
            <button 
              className="btn-optimize" 
              onClick={stops.length >= 2 ? optimizeRoute : focusSearch} 
              disabled={optimizing}
            >
              <span className="material-icons">{stops.length >= 2 ? 'autorenew' : 'add'}</span>
              {optimizing ? 'Optimizando...' : stops.length >= 2 ? 'Optimizar la ruta' : 'Añadir paradas'}
            </button>
          )}
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
      
      {showConfigModal === 'break' && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Programar descanso</h3>
            <p style={{ color: '#999', marginBottom: 16 }}>Selecciona la hora para tu descanso</p>
            <input
              type="time"
              className="q-input"
              value={breakTime || ''}
              onChange={(e) => setBreakTime(e.target.value)}
            />
            <div className="modal-actions">
              {breakTime && (
                <button className="btn-flat text-negative" onClick={() => { setBreakTime(null); setShowConfigModal(null); }}>
                  Quitar descanso
                </button>
              )}
              <button className="btn-primary" onClick={() => setShowConfigModal(null)}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      
      {showConfigModal === 'duration' && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Tiempo por parada</h3>
            <p style={{ color: '#999', marginBottom: 16 }}>Minutos estimados en cada entrega</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[2, 3, 5, 10, 15, 20].map(min => (
                <button 
                  key={min}
                  className={`duration-option ${stopDuration === min ? 'active' : ''}`}
                  onClick={() => setStopDuration(min)}
                >
                  {min} min
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowConfigModal(null)}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      
      {showConfigModal === 'vehicle' && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Tipo de vehículo</h3>
            <p style={{ color: '#999', marginBottom: 16 }}>Selecciona cómo te desplazas</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button 
                className={`vehicle-option ${travelMode === 'DRIVING' ? 'active' : ''}`}
                onClick={() => setTravelMode('DRIVING')}
              >
                <span className="material-icons">directions_car</span>
                <span>Carro / Moto</span>
              </button>
              <button 
                className={`vehicle-option ${travelMode === 'BICYCLING' ? 'active' : ''}`}
                onClick={() => setTravelMode('BICYCLING')}
              >
                <span className="material-icons">pedal_bike</span>
                <span>Bicicleta</span>
              </button>
              <button 
                className={`vehicle-option ${travelMode === 'WALKING' ? 'active' : ''}`}
                onClick={() => setTravelMode('WALKING')}
              >
                <span className="material-icons">directions_walk</span>
                <span>A pie</span>
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowConfigModal(null)}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
