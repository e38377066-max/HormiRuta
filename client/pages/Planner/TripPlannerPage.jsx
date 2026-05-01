import { useEffect, useState, useRef } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import api from '../../api'
import { usePlanner } from '../../layouts/PlannerLayout'
import { getCurrentPosition, watchPosition, vibrate, setupStatusBar, isNative, platform, takePhoto, dataUrlToFile, keepScreenAwake, allowScreenSleep, speakInstruction, stopSpeaking } from '../../utils/capacitor'
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
  const navLineRef = useRef(null)
  const navRendererRef = useRef(null)
  const pendingNavRestoreRef = useRef(false)
  const userToStopLineRef = useRef(null)
  const fullRouteFallbackRef = useRef(null)
  const [userLocation, setUserLocation] = useState(null)
  const [gpsError, setGpsError] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState(null)
  
  const [stops, setStops] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [panelExpanded, setPanelExpanded] = useState(true)
  const [isOptimized, setIsOptimized] = useState(false)
  const [navigationMode, setNavigationMode] = useState(false)
  const [selectedStopIndex, setSelectedStopIndex] = useState(null)
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
  const [routeCommission, setRouteCommission] = useState(0)
  const [panelHeight, setPanelHeight] = useState(45)
  const [panelSnap, setPanelSnap] = useState('mid')
  const [dispatchRoutes, setDispatchRoutes] = useState([])
  const [loadingDispatch, setLoadingDispatch] = useState(false)
  const [showDispatchRoutes, setShowDispatchRoutes] = useState(true)
  const [autoFollow, setAutoFollow] = useState(true)
  const [navEta, setNavEta] = useState('')
  const [navDistance, setNavDistance] = useState('')
  const [navSteps, setNavSteps] = useState([])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [currentSpeed, setCurrentSpeed] = useState(null)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const lastSpokenStepRef = useRef(-1)
  const [showEvidenceModal, setShowEvidenceModal] = useState(null)
  const [evidencePreview, setEvidencePreview] = useState(null)
  const [evidenceFile, setEvidenceFile] = useState(null)
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [amountCollected, setAmountCollected] = useState('')
  const [messageModal, setMessageModal] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageSuccess, setMessageSuccess] = useState('')
  const [payDeliveryModal, setPayDeliveryModal] = useState(null)
  const [payDeliveryMethod, setPayDeliveryMethod] = useState('')
  const [deliveringPay, setDeliveringPay] = useState(false)
  const [navChooserOpen, setNavChooserOpen] = useState(false)
  const [navChooserStop, setNavChooserStop] = useState(null)
  const fileInputRef = useRef(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)
  const SNAP_POINTS = { min: 25, mid: 45, max: 80 }

  useEffect(() => {
    initMap()
    loadDispatchRoutes()
  }, [])

  useEffect(() => {
    if (isOptimized && pendingNavRestoreRef.current) {
      pendingNavRestoreRef.current = false
      setNavigationMode(true)
      setAutoFollow(true)
      keepScreenAwake()
      const savedStop = localStorage.getItem('selectedStop')
      if (savedStop !== null && savedStop !== 'null') {
        setSelectedStopIndex(parseInt(savedStop))
      }
    }
  }, [isOptimized])

  useEffect(() => {
    if (currentRouteId) {
      localStorage.setItem(`isOptimized_${currentRouteId}`, String(isOptimized))
    }
  }, [isOptimized, currentRouteId])

  const deliverRoutePayment = async () => {
    if (!payDeliveryModal || !payDeliveryMethod) return
    setDeliveringPay(true)
    try {
      await api.put(`/api/dispatch/routes/${payDeliveryModal.id}/deliver-payment`, { payment_method: payDeliveryMethod })
      setPayDeliveryModal(null)
      setPayDeliveryMethod('')
      loadDispatchRoutes()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al registrar entrega de pago')
    } finally {
      setDeliveringPay(false)
    }
  }

  const loadDispatchRoutes = async () => {
    try {
      setLoadingDispatch(true)
      const res = await api.get('/api/dispatch/routes')
      const relevant = (res.data.routes || []).filter(r =>
        r.status === 'assigned' ||
        (r.status === 'completed' && !r.payment_delivered)
      )
      setDispatchRoutes(relevant)
      const savedRouteId = localStorage.getItem('activeRouteId')
      if (savedRouteId) {
        const savedRoute = relevant.find(r => String(r.id) === String(savedRouteId))
        if (savedRoute) {
          const wasNavigating = localStorage.getItem('navMode') === 'true'
          if (wasNavigating) {
            pendingNavRestoreRef.current = true
          }
          loadDispatchRoute(savedRoute)
        } else {
          localStorage.removeItem('activeRouteId')
          localStorage.removeItem('navMode')
          localStorage.removeItem('selectedStop')
        }
      }
    } catch (err) {
      console.error('Error loading dispatch routes:', err)
    } finally {
      setLoadingDispatch(false)
    }
  }

  const loadDispatchRoute = (route) => {
    const routeStops = (route.stops || [])
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({
        id: i + 1,
        dbId: s.id,
        address: s.address,
        latitude: s.lat,
        longitude: s.lng,
        name: s.customer_name || '',
        phone: s.phone || '',
        note: s.note || '',
        completed: s.status === 'completed',
        skipped: s.status === 'skipped',
        photo_url: s.photo_url || null,
        color: '#EA4335',
        order_cost: s.order_cost,
        deposit_amount: s.deposit_amount,
        total_to_collect: s.total_to_collect,
        payment_method: s.payment_method,
        amount_collected: s.amount_collected,
        payment_status: s.payment_status,
        apartment_number: s.apartment_number || ''
      }))

    setStops(routeStops)
    setRouteName(route.name || 'Ruta Asignada')
    const wasOptimized = route.is_optimized || localStorage.getItem(`isOptimized_${route.id}`) === 'true'
    setIsOptimized(!!wasOptimized)
    setTotalDistance(route.total_distance || 0)
    setTotalDuration(route.total_duration || 0)
    setCurrentRouteId(route.id)
    localStorage.setItem('activeRouteId', String(route.id))
    setRouteCommission(route.driver_commission_total || 0)
    setShowDispatchRoutes(false)
    updateMapMarkers(routeStops)
    if (routeStops.length >= 2) {
      setTimeout(() => calculateRoute(routeStops), 500)
    }
  }

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
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#4285F4', strokeWeight: 5, strokeOpacity: 0.8 }
    })

    mapInstanceRef.current.addListener('dragstart', () => {
      if (navigationMode) {
        setAutoFollow(false)
      }
    })

    startLocationTracking()
  }

  const startLocationTracking = async () => {
    if (isNative) {
      setupStatusBar()
    }
    
    try {
      const pos = await getCurrentPosition()
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setUserLocation(loc)
      setGpsError(false)
      mapInstanceRef.current?.setCenter(loc)
      reverseGeocode(loc)
      updateUserLocationMarker(loc)
    } catch (err) {
      console.error('Geolocation error:', err)
      setGpsError(true)
    }

    const clearWatch = watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setGpsError(false)
        updateUserLocationMarker(loc, pos.coords.accuracy)
        if (pos.coords.speed != null && pos.coords.speed >= 0) {
          setCurrentSpeed(Math.round(pos.coords.speed * 3.6))
        }
      },
      (err) => {
        console.error('Watch position error:', err)
        setGpsError(true)
      },
      { maximumAge: 3000 }
    )
    
    watchIdRef.current = clearWatch
  }

  useEffect(() => {
    if (navigationMode && autoFollow && userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(userLocation)
    }
    if (navigationMode && userLocation && navSteps.length > 0) {
      const idx = findCurrentStep(userLocation, navSteps)
      setCurrentStepIndex(idx)
      if (voiceEnabled && idx !== lastSpokenStepRef.current && navSteps[idx]) {
        lastSpokenStepRef.current = idx
        const step = navSteps[idx]
        const voiceText = step.distance 
          ? `En ${step.distance}, ${step.instruction}` 
          : step.instruction
        speakInstruction(voiceText)
      }
    }
  }, [userLocation, navigationMode, autoFollow])

  useEffect(() => {
    if (navigationMode && userLocation) {
      const pending = stops.find(s => !s.completed)
      if (pending && pending.latitude && pending.longitude) {
        updateNavLine(userLocation, { lat: pending.latitude, lng: pending.longitude })
        calculateNavEta(userLocation, { lat: pending.latitude, lng: pending.longitude })
      } else {
        if (navLineRef.current) {
          navLineRef.current.setMap(null)
          navLineRef.current = null
        }
        if (navRendererRef.current) {
          navRendererRef.current.setMap(null)
          navRendererRef.current = null
        }
        setNavEta('')
        setNavDistance('')
      }
    } else {
      if (navLineRef.current) {
        navLineRef.current.setMap(null)
        navLineRef.current = null
      }
      if (navRendererRef.current) {
        navRendererRef.current.setMap(null)
        navRendererRef.current = null
      }
      setNavEta('')
      setNavDistance('')
    }
  }, [userLocation, navigationMode, stops])

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return
    if (userToStopLineRef.current) {
      userToStopLineRef.current.setMap(null)
      userToStopLineRef.current = null
    }
    if (!navigationMode && userLocation && stops.length > 0) {
      const pending = stops.find(s => !s.completed && !s.skipped)
      if (pending && pending.latitude && pending.longitude) {
        userToStopLineRef.current = new window.google.maps.Polyline({
          path: [userLocation, { lat: pending.latitude, lng: pending.longitude }],
          map: mapInstanceRef.current,
          strokeColor: '#4285F4',
          strokeOpacity: 0,
          strokeWeight: 3,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 3 },
            offset: '0',
            repeat: '12px'
          }]
        })
      }
    }
  }, [userLocation, navigationMode, stops])

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return

    if (!navigationMode) {
      if (fullRouteFallbackRef.current) {
        fullRouteFallbackRef.current.setMap(null)
        fullRouteFallbackRef.current = null
      }
      return
    }

    const pending = stops.filter(s => !s.completed && !s.skipped && s.latitude && s.longitude)
    if (pending.length === 0) {
      if (fullRouteFallbackRef.current) {
        fullRouteFallbackRef.current.setMap(null)
        fullRouteFallbackRef.current = null
      }
      return
    }

    const path = []
    if (userLocation) path.push(userLocation)
    pending.forEach(s => path.push({ lat: s.latitude, lng: s.longitude }))

    if (fullRouteFallbackRef.current) {
      fullRouteFallbackRef.current.setPath(path)
    } else {
      fullRouteFallbackRef.current = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#4285F4',
        strokeOpacity: 0.55,
        strokeWeight: 4,
        map: mapInstanceRef.current,
        zIndex: 1
      })
    }
  }, [navigationMode, userLocation, stops])

  const lastRecalcUserLocRef = useRef(null)
  useEffect(() => {
    if (!navigationMode || !userLocation || stops.length === 0) return
    const last = lastRecalcUserLocRef.current
    if (last) {
      const dLat = (userLocation.lat - last.lat) * 111000
      const dLng = (userLocation.lng - last.lng) * 111000 * Math.cos(userLocation.lat * Math.PI / 180)
      const distM = Math.sqrt(dLat * dLat + dLng * dLng)
      if (distM < 200) return
    }
    lastRecalcUserLocRef.current = { lat: userLocation.lat, lng: userLocation.lng }
    recalculateNavRoute(stops)
  }, [userLocation, navigationMode])

  const navLastUpdateRef = useRef(0)
  const navLastRouteRef = useRef(null)
  const fullRouteLastUpdateRef = useRef(0)

  const isOffRoute = (currentPos) => {
    if (!navLastRouteRef.current) return true
    const routePath = navLastRouteRef.current
    let minDist = Infinity
    for (let i = 0; i < routePath.length; i++) {
      const p = routePath[i]
      const d = Math.sqrt(Math.pow((currentPos.lat - p.lat) * 111000, 2) + Math.pow((currentPos.lng - p.lng) * 111000 * Math.cos(currentPos.lat * Math.PI / 180), 2))
      if (d < minDist) minDist = d
    }
    return minDist > 50
  }

  const drawFallbackLine = (from, to) => {
    if (navRendererRef.current) {
      navRendererRef.current.setMap(null)
      navRendererRef.current = null
    }
    if (navLineRef.current) {
      navLineRef.current.setPath([from, to])
    } else if (mapInstanceRef.current) {
      navLineRef.current = new window.google.maps.Polyline({
        path: [from, to],
        geodesic: true,
        strokeColor: '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      })
    }
  }

  const getManeuverIcon = (maneuver) => {
    if (!maneuver) return 'straight'
    if (maneuver.includes('left')) return 'turn_left'
    if (maneuver.includes('right')) return 'turn_right'
    if (maneuver.includes('uturn')) return 'u_turn_left'
    if (maneuver.includes('merge')) return 'merge'
    if (maneuver.includes('ramp')) return 'ramp_right'
    if (maneuver.includes('fork')) return 'fork_right'
    if (maneuver.includes('roundabout')) return 'roundabout_right'
    return 'straight'
  }

  const findCurrentStep = (userPos, steps) => {
    if (!steps || steps.length === 0) return 0
    let minDist = Infinity
    let closestIdx = 0
    for (let i = 0; i < steps.length; i++) {
      const endLat = steps[i].endLat
      const endLng = steps[i].endLng
      const d = Math.sqrt(
        Math.pow((userPos.lat - endLat) * 111000, 2) + 
        Math.pow((userPos.lng - endLng) * 111000 * Math.cos(userPos.lat * Math.PI / 180), 2)
      )
      if (d < minDist) {
        minDist = d
        closestIdx = i
      }
    }
    if (minDist < 30) return Math.min(closestIdx + 1, steps.length - 1)
    return closestIdx
  }

  const updateNavLine = async (from, to) => {
    const now = Date.now()
    const hasRenderer = !!navRendererRef.current
    const offRoute = isOffRoute(from)
    const throttle = offRoute ? 5000 : 15000
    if (hasRenderer && now - navLastUpdateRef.current < throttle) return
    navLastUpdateRef.current = now
    try {
      const directionsService = new window.google.maps.DirectionsService()
      const result = await directionsService.route({
        origin: from,
        destination: to,
        travelMode: window.google.maps.TravelMode[travelMode]
      })

      if (!result.routes || !result.routes[0]) {
        drawFallbackLine(from, to)
        setNavSteps([])
        return
      }

      const path = result.routes[0].overview_path?.map(p => ({ lat: p.lat(), lng: p.lng() })) || []
      navLastRouteRef.current = path

      const leg = result.routes[0].legs[0]
      if (leg && leg.steps) {
        const steps = leg.steps.map(s => ({
          instruction: s.instructions?.replace(/<[^>]*>/g, '') || '',
          distance: s.distance?.text || '',
          duration: s.duration?.text || '',
          maneuver: s.maneuver || '',
          icon: getManeuverIcon(s.maneuver),
          endLat: s.end_location?.lat() || 0,
          endLng: s.end_location?.lng() || 0
        }))
        setNavSteps(steps)
        const idx = findCurrentStep(from, steps)
        setCurrentStepIndex(idx)
      }

      if (navLineRef.current) {
        navLineRef.current.setMap(null)
        navLineRef.current = null
      }

      if (!navRendererRef.current && mapInstanceRef.current) {
        navRendererRef.current = new window.google.maps.DirectionsRenderer({
          map: mapInstanceRef.current,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#4285F4', strokeWeight: 5, strokeOpacity: 0.9 },
          preserveViewport: true
        })
      }
      if (navRendererRef.current) {
        navRendererRef.current.setDirections(result)
      }
    } catch (err) {
      drawFallbackLine(from, to)
      setNavSteps([])
    }
  }

  const calculateNavEta = async (from, to) => {
    try {
      const service = new window.google.maps.DistanceMatrixService()
      const result = await service.getDistanceMatrix({
        origins: [from],
        destinations: [to],
        travelMode: window.google.maps.TravelMode[travelMode]
      })
      if (result.rows[0]?.elements[0]?.status === 'OK') {
        setNavDistance(result.rows[0].elements[0].distance.text)
        setNavEta(result.rows[0].elements[0].duration.text)
      }
    } catch (err) {
      console.log('ETA calc error:', err)
    }
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
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14" fill="#4285F4" fill-opacity="0.2" stroke="#4285F4" stroke-width="1.5"/>
              <circle cx="16" cy="16" r="9" fill="#4285F4" stroke="white" stroke-width="3"/>
              <circle cx="16" cy="16" r="4" fill="white"/>
            </svg>
          `),
          anchor: new window.google.maps.Point(16, 16),
          scaledSize: new window.google.maps.Size(32, 32)
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
      if (watchIdRef.current && typeof watchIdRef.current === 'function') {
        watchIdRef.current()
      }
      allowScreenSleep()
      stopSpeaking()
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
    vibrate('medium')
    
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

  const moveStop = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= stops.length) return
    const updatedStops = [...stops]
    const temp = updatedStops[index]
    updatedStops[index] = updatedStops[newIndex]
    updatedStops[newIndex] = temp
    const reindexed = updatedStops.map((s, i) => ({ ...s, id: i + 1 }))
    setStops(reindexed)
    setIsOptimized(false)
    updateMapMarkers(reindexed)
    vibrate('light')
    if (reindexed.length >= 2) {
      calculateRoute(reindexed)
    }
  }

  const toggleStopComplete = (index) => {
    const stop = stops[index]
    if (stop.completed || stop.skipped) return
    setShowEvidenceModal(index)
    setEvidencePreview(null)
    setEvidenceFile(null)
    setSelectedPaymentMethod('')
    setAmountCollected(stop.total_to_collect != null && stop.total_to_collect > 0 ? Number(stop.total_to_collect).toFixed(2) : '0.00')
  }

  const handleEvidencePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setEvidenceFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setEvidencePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const captureEvidenceNative = async () => {
    try {
      const photo = await takePhoto()
      if (photo && photo.dataUrl) {
        setEvidencePreview(photo.dataUrl)
        const file = dataUrlToFile(photo.dataUrl, `evidence_${Date.now()}.${photo.format || 'jpeg'}`)
        setEvidenceFile(file)
      }
    } catch (err) {
      if (err.message?.includes('cancelled') || err.message?.includes('User cancelled')) return
      console.error('Camera error:', err)
      alert(err.message || 'Error al abrir la cámara')
    }
  }

  const openEvidenceCapture = () => {
    if (isNative) {
      captureEvidenceNative()
    } else {
      fileInputRef.current?.click()
    }
  }

  const retakeEvidence = () => {
    setEvidencePreview(null)
    setEvidenceFile(null)
    if (isNative) {
      captureEvidenceNative()
    } else {
      fileInputRef.current?.click()
    }
  }

  const confirmStopWithEvidence = async () => {
    if (showEvidenceModal === null) return
    setUploadingEvidence(true)
    try {
      const stop = stops[showEvidenceModal]
      const stopDbId = stop.dbId || stop.id

      const formData = new FormData()
      if (evidenceFile) {
        formData.append('photo', evidenceFile)
      }
      if (selectedPaymentMethod) {
        formData.append('payment_method', selectedPaymentMethod)
      }
      if (amountCollected !== '') {
        formData.append('amount_collected', amountCollected)
      }
      
      const res = await api.post(`/api/dispatch/stops/${stopDbId}/evidence`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (res.data.success) {
        const updatedStops = stops.map((s, i) => 
          i === showEvidenceModal ? {
            ...s,
            completed: true,
            photo_url: res.data.stop.photo_url,
            payment_method: res.data.stop.payment_method,
            amount_collected: res.data.stop.amount_collected,
            payment_status: res.data.stop.payment_status
          } : s
        )
        setStops(updatedStops)
        updateMapMarkers(updatedStops)
      }
    } catch (err) {
      console.error('Error uploading evidence:', err)
      const errorMsg = err.response?.data?.error || 'Error al subir la evidencia. Intenta de nuevo.'
      alert(errorMsg)
    } finally {
      setUploadingEvidence(false)
      setShowEvidenceModal(null)
      setEvidencePreview(null)
      setEvidenceFile(null)
      setSelectedStopIndex(null)
      localStorage.removeItem('selectedStop')
    }
  }

  const skipStop = async (index) => {
    const stop = stops[index]

    const closeModal = () => {
      setShowEvidenceModal(null)
      setEvidencePreview(null)
      setEvidenceFile(null)
      setSelectedPaymentMethod('')
      setAmountCollected('')
    }

    if (!stop.skippedOnce) {
      const rest = stops.filter((_, i) => i !== index)
      const deferred = { ...stop, skippedOnce: true }
      const newStops = [...rest, deferred].map((s, i) => ({ ...s, id: i + 1 }))
      setStops(newStops)
      updateMapMarkers(newStops)
      closeModal()
      return
    }

    const stopDbId = stop.dbId || stop.id
    try {
      if (stopDbId && currentRouteId) {
        await api.put(`/api/dispatch/stops/${stopDbId}/skip`)
      }
      const updatedStops = stops.map((s, i) =>
        i === index ? { ...s, skipped: true, skippedOnce: false, completed: false } : s
      )
      setStops(updatedStops)
      updateMapMarkers(updatedStops)
      closeModal()
    } catch (err) {
      console.error('Error skipping stop:', err)
      alert(err.response?.data?.error || 'Error al saltar parada')
    }
  }

  const openMessageModal = async (stop) => {
    setMessageModal(stop)
    setMessageSuccess('')
    if (templates.length === 0) {
      setLoadingTemplates(true)
      try {
        const res = await api.get('/api/dispatch/templates')
        setTemplates(res.data.templates || [])
      } catch (err) {
        console.error('Error loading templates:', err)
      } finally {
        setLoadingTemplates(false)
      }
    }
  }

  const sendTemplate = async (template) => {
    if (!messageModal || sendingMessage) return
    setSendingMessage(true)
    setMessageSuccess('')
    try {
      const stopId = messageModal.dbId
      const endpoint = stopId 
        ? `/api/dispatch/stops/${stopId}/send-template`
        : `/api/dispatch/orders/${messageModal.orderId || messageModal.id}/send-template`
      await api.post(endpoint, {
        templateName: template.name,
        languageCode: template.language || 'es',
        components: template.components || []
      })
      setMessageSuccess(`Template "${template.name}" enviado`)
      setTimeout(() => setMessageSuccess(''), 3000)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar template')
    } finally {
      setSendingMessage(false)
    }
  }

  const finishRoute = async () => {
    if (!currentRouteId) {
      exitNavigation()
      return
    }
    try {
      await api.put(`/api/dispatch/routes/${currentRouteId}/complete`)
      exitNavigation()
      clearRoute()
      loadDispatchRoutes()
    } catch (err) {
      console.error('Error completing route:', err)
      alert(err.response?.data?.error || 'Error al finalizar ruta')
    }
  }

  const sortByGpsDistance = (stopsArr, loc) => {
    if (!loc) return stopsArr
    return [...stopsArr].sort((a, b) => {
      const dA = Math.pow(a.latitude - loc.lat, 2) + Math.pow(a.longitude - loc.lng, 2)
      const dB = Math.pow(b.latitude - loc.lat, 2) + Math.pow(b.longitude - loc.lng, 2)
      return dA - dB
    }).map((s, i) => ({ ...s, id: i + 1 }))
  }

  const optimizeRoute = async () => {
    if (stops.length < 2) return
    setOptimizing(true)

    try {
      const oldDistance = totalDistance
      const useGpsOrigin = useCurrentLocation && userLocation

      if (useGpsOrigin) {
        const sorted = sortByGpsDistance(stops, userLocation)
        setStops(sorted)
        updateMapMarkers(sorted)

        try {
          let routeId = currentRouteId
          if (!routeId) {
            const response = await api.post('/api/routes', { name: routeName })
            routeId = response.data.route?.id || response.data.id
            setCurrentRouteId(routeId)
            for (const stop of sorted) {
              await api.post(`/api/routes/${routeId}/stops`, {
                address: stop.address, lat: stop.latitude, lng: stop.longitude,
                customer_name: stop.name || '', phone: stop.phone || '', note: stop.note || '',
                order_cost: stop.order_cost, deposit_amount: stop.deposit_amount,
                total_to_collect: stop.total_to_collect
              })
            }
          }
          await api.post(`/api/routes/${routeId}/optimize`, {
            start_lat: userLocation.lat, start_lng: userLocation.lng, return_to_start: roundTrip
          })
        } catch (backendErr) {
          console.log('Backend save error, continuing with local GPS sort')
        }

        await calculateRoute(sorted, userLocation)
        if (oldDistance > 0) setSavedDistance(0)
        setIsOptimized(true)
        setOptimizing(false)
        return
      }

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
              lng: stop.longitude,
              customer_name: stop.name || '',
              phone: stop.phone || '',
              note: stop.note || '',
              order_cost: stop.order_cost,
              deposit_amount: stop.deposit_amount,
              total_to_collect: stop.total_to_collect
            })
          }
        }
        
        const optimized = await api.post(`/api/routes/${routeId}/optimize`, {
          start_lat: stops[0].latitude,
          start_lng: stops[0].longitude,
          return_to_start: roundTrip
        })
        
        if (optimized.data.route?.stops) {
          const backendStops = optimized.data.route.stops.map((s, i) => {
            const original = stops.find(orig => 
              (orig.dbId && orig.dbId === s.id) ||
              (Math.abs((orig.latitude || 0) - (s.lat || 0)) < 0.0001 && Math.abs((orig.longitude || 0) - (s.lng || 0)) < 0.0001)
            )
            return {
              ...(original || {}),
              id: i + 1,
              dbId: s.id || (original?.dbId),
              address: s.address,
              latitude: s.lat,
              longitude: s.lng,
              name: s.customer_name || original?.name || '',
              phone: s.phone || original?.phone || '',
              note: s.note || original?.note || '',
              completed: s.status === 'completed' || false,
              skipped: s.status === 'skipped' || false,
              color: '#EA4335',
              order_cost: s.order_cost ?? original?.order_cost,
              deposit_amount: s.deposit_amount ?? original?.deposit_amount,
              total_to_collect: s.total_to_collect ?? original?.total_to_collect,
              payment_method: s.payment_method ?? original?.payment_method,
              amount_collected: s.amount_collected ?? original?.amount_collected,
              payment_status: s.payment_status ?? original?.payment_status
            }
          })
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
      const waypoints = stops.slice(1, -1).map(stop => ({
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
        const middleStops = stops.slice(1, -1)
        const optimizedMiddle = waypointOrder.map(i => middleStops[i])
        const optimizedStops = roundTrip
          ? [stops[0], ...waypointOrder.map(i => stops[i])]
          : [stops[0], ...optimizedMiddle, stops[stops.length - 1]]
        const reorderedStops = optimizedStops.map((stop, i) => ({ ...stop, id: i + 1 }))
        
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
        if (oldDistance > 0) setSavedDistance(oldDistance - (distance / 1000))
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

    const visibleStops = stopsList.filter(s => !s.completed && !s.skipped)
    const hasActivePending = stopsList.some(s => !s.completed && !s.skipped && !s.skippedOnce)

    let visibleCounter = 0
    stopsList.forEach((stop, index) => {
      if (stop.latitude && stop.longitude) {
        if (stop.completed || stop.skipped) return
        if (navigationMode && stop.skippedOnce && hasActivePending) return
        visibleCounter += 1
        const color = '#EA4335'
        
        const marker = new window.google.maps.Marker({
          position: { lat: stop.latitude, lng: stop.longitude },
          map: mapInstanceRef.current,
          label: {
            text: String(visibleCounter),
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

    const stopsForBounds = visibleStops
    if (stopsForBounds.length > 1) {
      const bounds = new window.google.maps.LatLngBounds()
      stopsForBounds.forEach(stop => {
        if (stop.latitude && stop.longitude) {
          bounds.extend({ lat: stop.latitude, lng: stop.longitude })
        }
      })
      if (userLocation) {
        bounds.extend(userLocation)
      }
      if (!navigationMode) {
        mapInstanceRef.current.fitBounds(bounds, 80)
        const listener = window.google.maps.event.addListener(mapInstanceRef.current, 'idle', () => {
          if (mapInstanceRef.current.getZoom() > 16) {
            mapInstanceRef.current.setZoom(16)
          }
          window.google.maps.event.removeListener(listener)
        })
      }
    } else if (stopsForBounds.length === 1 && stopsForBounds[0].latitude) {
      if (!navigationMode) {
        mapInstanceRef.current.panTo({ lat: stopsForBounds[0].latitude, lng: stopsForBounds[0].longitude })
      }
    }

    if (navigationMode) {
      recalculateNavRoute(stopsList)
    }
  }

  const recalculateNavRoute = async (stopsList, force = false) => {
    if (!directionsRendererRef.current || !window.google) {
      console.warn('[NavRoute] Map not ready yet')
      return
    }
    const now = Date.now()
    if (!force && now - fullRouteLastUpdateRef.current < 25000) return
    fullRouteLastUpdateRef.current = now

    const hasActive = stopsList.some(s => !s.completed && !s.skipped && !s.skippedOnce)
    const pending = stopsList.filter(s => {
      if (s.completed || s.skipped || !s.latitude || !s.longitude) return false
      if (s.skippedOnce && hasActive) return false
      return true
    })
    if (pending.length < 1) {
      directionsRendererRef.current.setDirections({ routes: [] })
      return
    }
    try {
      const directionsService = new window.google.maps.DirectionsService()
      const gpsOrigin = userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null
      const origin = gpsOrigin || { lat: pending[0].latitude, lng: pending[0].longitude }
      const stopsForRoute = gpsOrigin ? pending : pending.slice(1)

      if (stopsForRoute.length === 0) {
        directionsRendererRef.current.setDirections({ routes: [] })
        return
      }

      const destination = { lat: stopsForRoute[stopsForRoute.length - 1].latitude, lng: stopsForRoute[stopsForRoute.length - 1].longitude }
      const waypoints = stopsForRoute.slice(0, -1).map(stop => ({
        location: { lat: stop.latitude, lng: stop.longitude },
        stopover: true
      }))

      console.log('[NavRoute] Solicitando ruta', { origin, waypoints: waypoints.length, destination, hasGps: !!gpsOrigin })
      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS
        }
      })
      directionsRendererRef.current.setDirections(result)
      console.log('[NavRoute] Ruta dibujada con', result.routes?.[0]?.legs?.length || 0, 'tramos')
    } catch (err) {
      console.error('[NavRoute] Error al calcular ruta:', err?.message || err, err)
    }
  }

  const calculateRoute = async (stopsList, gpsOrigin = null) => {
    if (stopsList.length < 1) return
    if (!gpsOrigin && stopsList.length < 2) return

    const directionsService = new window.google.maps.DirectionsService()

    const origin = gpsOrigin || { lat: stopsList[0].latitude, lng: stopsList[0].longitude }
    const destination = { lat: stopsList[stopsList.length - 1].latitude, lng: stopsList[stopsList.length - 1].longitude }
    const middleStops = gpsOrigin ? stopsList.slice(0, -1) : stopsList.slice(1, -1)
    const waypoints = middleStops.map(stop => ({
      location: { lat: stop.latitude, lng: stop.longitude },
      stopover: true
    }))

    try {
      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: window.google.maps.TravelMode[travelMode],
        avoidHighways,
        avoidTolls,
        drivingOptions: travelMode === 'DRIVING' ? {
          departureTime: new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS
        } : undefined
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

  const startRoute = () => {
    setNavigationMode(true)
    setSelectedStopIndex(null)
    setAutoFollow(true)
    localStorage.setItem('navMode', 'true')
    localStorage.removeItem('selectedStop')
    keepScreenAwake()

    if (mapInstanceRef.current) {
      const bounds = new window.google.maps.LatLngBounds()
      let hasPoint = false
      if (userLocation) {
        bounds.extend(userLocation)
        hasPoint = true
      }
      stops.forEach(s => {
        if (!s.completed && !s.skipped && s.latitude && s.longitude) {
          bounds.extend({ lat: s.latitude, lng: s.longitude })
          hasPoint = true
        }
      })
      if (hasPoint) {
        mapInstanceRef.current.fitBounds(bounds, 80)
      }
    }

    recalculateNavRoute(stops, true)
  }

  const exitNavigation = () => {
    setNavigationMode(false)
    setSelectedStopIndex(null)
    setAutoFollow(false)
    setNavSteps([])
    setCurrentStepIndex(0)
    setCurrentSpeed(null)
    lastSpokenStepRef.current = -1
    localStorage.setItem('navMode', 'false')
    localStorage.removeItem('selectedStop')
    allowScreenSleep()
    stopSpeaking()
    navLastRouteRef.current = null
    if (navLineRef.current) {
      navLineRef.current.setMap(null)
      navLineRef.current = null
    }
    if (navRendererRef.current) {
      navRendererRef.current.setMap(null)
      navRendererRef.current = null
    }
  }

  const reOptimize = () => {
    setIsOptimized(false)
    setShowRouteMenu(false)
    setTimeout(() => optimizeRoute(), 100)
  }

  const clearRoute = () => {
    setStops([])
    setIsOptimized(false)
    setNavigationMode(false)
    setCurrentRouteId(null)
    localStorage.removeItem('activeRouteId')
    localStorage.removeItem('navMode')
    localStorage.removeItem('selectedStop')
    setTotalDistance(0)
    setTotalDuration(0)
    setSavedDistance(0)
    setAutoFollow(false)
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] })
    }
    if (navLineRef.current) {
      navLineRef.current.setMap(null)
      navLineRef.current = null
    }
    if (navRendererRef.current) {
      navRendererRef.current.setMap(null)
      navRendererRef.current = null
    }
  }

  const toggleMapType = () => {
    const newType = mapType === 'roadmap' ? 'satellite' : 'roadmap'
    setMapType(newType)
    mapInstanceRef.current?.setMapTypeId(newType)
  }

  const centerOnLocation = async () => {
    if (userLocation) {
      mapInstanceRef.current?.setCenter(userLocation)
      mapInstanceRef.current?.setZoom(16)
      vibrate('light')
      if (navigationMode) setAutoFollow(true)
    } else {
      try {
        const pos = await getCurrentPosition()
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        mapInstanceRef.current?.setCenter(loc)
        mapInstanceRef.current?.setZoom(16)
        updateUserLocationMarker(loc)
        vibrate('light')
        if (navigationMode) setAutoFollow(true)
      } catch (err) {
        console.error('Could not get location:', err)
      }
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

  const openNavChooser = (stop) => {
    vibrate('light')
    setNavChooserStop(stop)
    setNavChooserOpen(true)
  }

  const launchNavApp = (app) => {
    setNavChooserOpen(false)
    const stop = navChooserStop
    if (!stop) return
    const lat = stop.latitude
    const lng = stop.longitude
    const loc = userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null

    if (app === 'google') {
      let url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
      if (loc) url += `&origin=${loc.lat},${loc.lng}`
      window.open(url, '_system')
    } else if (app === 'waze') {
      const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes${loc ? `&from=${loc.lat},${loc.lng}` : ''}`
      window.open(url, '_system')
    } else if (app === 'apple') {
      let url = `maps://?daddr=${lat},${lng}&dirflg=d`
      if (loc) url += `&saddr=${loc.lat},${loc.lng}`
      window.open(url, '_system')
    }
  }

  const activePendingStops = stops.filter(s => !s.completed && !s.skipped && !s.skippedOnce)
  const deferredPendingStops = stops.filter(s => !s.completed && !s.skipped && s.skippedOnce)
  const nextPendingStop = activePendingStops.length > 0 ? activePendingStops[0] : deferredPendingStops[0]
  const nextPendingIndex = nextPendingStop ? stops.indexOf(nextPendingStop) : -1

  return (
    <div className="trip-planner-page">
      <div className="map-section">
        <div id="trip-map" className="map-container" ref={mapRef}></div>
        
        {gpsError && (
          <div className="gps-error-banner" onClick={startLocationTracking}>
            <span className="material-icons">location_off</span>
            <span>GPS no disponible — toca para reintentar</span>
          </div>
        )}

        <button
          className="menu-fab"
          onClick={onToggleDrawer}
          onTouchStart={(e) => { e.stopPropagation(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onToggleDrawer(); }}
        >
          <span className="material-icons">menu</span>
        </button>

        {navigationMode && nextPendingStop && (
          <div className="nav-bar">
            {navSteps.length > 0 && navSteps[currentStepIndex] && (
              <div className="nav-step-banner">
                <span className="material-icons nav-step-icon">{navSteps[currentStepIndex].icon}</span>
                <div className="nav-step-info">
                  <div className="nav-step-instruction">{navSteps[currentStepIndex].instruction || 'Continua recto'}</div>
                  <div className="nav-step-distance">{navSteps[currentStepIndex].distance}</div>
                </div>
              </div>
            )}
            <div className="nav-bar-stop">
              <span className="nav-bar-number">{nextPendingIndex + 1}</span>
              <div className="nav-bar-info">
                <div className="nav-bar-address">{nextPendingStop.name || nextPendingStop.address?.split(',')[0] || 'Siguiente parada'}</div>
                <div className="nav-bar-eta">
                  {navDistance && <span>{navDistance}</span>}
                  {navEta && <span> · {navEta}</span>}
                </div>
              </div>
              <div className="nav-bar-controls">
                <button 
                  className={`nav-control-btn ${voiceEnabled ? 'active' : ''}`}
                  onClick={() => { setVoiceEnabled(!voiceEnabled); if (voiceEnabled) stopSpeaking(); }}
                >
                  <span className="material-icons" style={{ fontSize: 20 }}>{voiceEnabled ? 'volume_up' : 'volume_off'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {navigationMode && currentSpeed != null && (
          <div className="speed-indicator">
            <span className="speed-value">{currentSpeed}</span>
            <span className="speed-unit">km/h</span>
          </div>
        )}

        {navigationMode && !autoFollow && (
          <button className="auto-follow-btn" onClick={() => { setAutoFollow(true); if (userLocation) mapInstanceRef.current?.panTo(userLocation); }}>
            <span className="material-icons">my_location</span>
            <span>Centrar</span>
          </button>
        )}
        
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
      
      <div className={`bottom-panel ${isDragging.current ? 'dragging' : ''}`} style={{ height: `${Math.floor(window.innerHeight * panelHeight / 100)}px` }}>
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
            {routeCommission > 0 && (
              <span className="route-commission-badge">
                <span className="material-icons">paid</span> ${routeCommission.toFixed(2)}
              </span>
            )}
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
          {showDispatchRoutes && dispatchRoutes.length > 0 && stops.length === 0 && (
            <div className="dispatch-routes-section">
              <div className="dispatch-routes-header">
                <span className="material-icons">assignment</span>
                <span>Rutas Asignadas</span>
              </div>
              {loadingDispatch ? (
                <div className="dispatch-loading">Cargando...</div>
              ) : (
                dispatchRoutes.map(dr => {
                  const isCompleted = dr.status === 'completed'
                  return (
                  <div
                    key={dr.id}
                    className={`dispatch-route-item${isCompleted ? ' completed-pending-pay' : ''}`}
                    onClick={() => !isCompleted && loadDispatchRoute(dr)}
                    style={isCompleted ? { cursor: 'default', borderLeft: '4px solid #f59e0b' } : {}}
                  >
                    <div className="dispatch-route-top">
                      <span className="dispatch-route-name">{dr.name}</span>
                      {isCompleted
                        ? <span className="dispatch-badge-opt" style={{ background: '#f59e0b', color: '#fff' }}>Completada</span>
                        : dr.is_optimized && <span className="dispatch-badge-opt">Optimizada</span>
                      }
                    </div>
                    <div className="dispatch-route-meta">
                      <span>{dr.stops_count} parada{dr.stops_count !== 1 ? 's' : ''}</span>
                      {dr.total_distance > 0 && <span> - {dr.total_distance} km</span>}
                    </div>
                    {isCompleted && dr.route_total_collected > 0 && (
                      <div className="dispatch-route-pay-pending">
                        <span className="material-icons" style={{ fontSize: 15 }}>payments</span>
                        Total cobrado: <strong>${Number(dr.route_total_collected).toFixed(2)}</strong>
                      </div>
                    )}
                    {!isCompleted && dr.driver_commission_total > 0 && (
                      <div className="dispatch-route-commission">
                        <span className="material-icons">paid</span> Tu comisión: ${dr.driver_commission_total.toFixed(2)}
                      </div>
                    )}
                    {isCompleted && (
                      <button
                        className="btn-deliver-payment"
                        onClick={e => { e.stopPropagation(); setPayDeliveryModal(dr); setPayDeliveryMethod('') }}
                      >
                        <span className="material-icons">local_atm</span>
                        Entregar Pago
                      </button>
                    )}
                  </div>
                  )
                })
              )}
            </div>
          )}

          <div className="route-name-section" onClick={() => setShowRouteNameDialog(true)}>
            <h2 className="route-name">{routeName}</h2>
          </div>

          {isOptimized && totalDistance > 0 && (
            <div className="route-stats">
              <div className="route-stat">
                <span className="material-icons">straighten</span>
                <span>{totalDistance.toFixed(1)} km</span>
              </div>
              <div className="route-stat">
                <span className="material-icons">schedule</span>
                <span>{formatDuration(totalDuration)}</span>
              </div>
            </div>
          )}
          
          {stops.length > 0 && (
            <>
              <div className="stops-section-header">Parada</div>
              {(() => {
                let listCounter = 0
                return stops.map((stop, index) => {
                  const isActive = !stop.completed && !stop.skipped
                  const displayNumber = isActive ? ++listCounter : null
                  return { stop, index, displayNumber }
                })
              })().map(({ stop, index, displayNumber }) => (
                <div
                  key={stop.id}
                  className={`stop-row ${navigationMode ? 'stop-row-nav' : ''} ${stop.skipped ? 'stop-row-skipped' : ''} ${navigationMode && selectedStopIndex === index ? 'stop-row-selected' : ''}`}
                  onClick={() => {
                    if (navigationMode && !stop.completed && !stop.skipped) {
                      setSelectedStopIndex(prev => {
                        const next = prev === index ? null : index
                        if (next === null) {
                          localStorage.removeItem('selectedStop')
                        } else {
                          localStorage.setItem('selectedStop', String(next))
                        }
                        return next
                      })
                    }
                  }}
                >
                  <div className="stop-row-top">
                    {navigationMode ? (
                      <span
                        className="material-icons stop-checkbox"
                        style={{ color: stop.completed ? '#22c55e' : stop.skipped ? '#999' : '#5b8def', fontSize: 22 }}
                        onClick={e => { e.stopPropagation(); if (!stop.completed && !stop.skipped) toggleStopComplete(index) }}
                      >
                        {stop.completed ? 'check_circle' : stop.skipped ? 'cancel' : 'radio_button_unchecked'}
                      </span>
                    ) : (
                      <span className="stop-number">{displayNumber != null ? String(displayNumber).padStart(2, '0') : '--'}</span>
                    )}
                    <div className="stop-info-block">
                      <span className={`stop-name ${stop.completed ? 'stop-completed' : ''} ${stop.skipped ? 'stop-skipped-label' : ''} ${stop.skippedOnce ? 'stop-skipped-label' : ''}`}>
                        <span className="stop-num-inline">{displayNumber != null ? `${displayNumber}.` : ''}</span> {stop.name || stop.address?.split(',')[0] || 'Parada'}
                        {stop.skipped && <span className="badge-saltada">Saltada</span>}
                        {stop.skippedOnce && <span className="badge-diferida">Al final</span>}
                      </span>
                      <span className="stop-address-detail">{stop.address || ''}{stop.apartment_number && <span style={{ color: '#1976d2', fontWeight: 600 }}> Apt {stop.apartment_number}</span>}</span>
                      {stop.phone && (
                        <div className="stop-contact-row">
                          <span className="stop-phone"><span className="material-icons" style={{ fontSize: 13 }}>phone</span> {stop.phone}</span>
                          <div className="stop-contact-btns" onClick={e => e.stopPropagation()}>
                            <a href={`tel:${stop.phone.replace(/[^0-9+]/g, '')}`} className="stop-contact-btn stop-call-btn">
                              <span className="material-icons" style={{ fontSize: 16 }}>call</span>
                            </a>
                          </div>
                        </div>
                      )}
                      {stop.note && <span className="stop-note"><span className="material-icons" style={{ fontSize: 13 }}>sticky_note_2</span> {stop.note}</span>}
                      {stop.total_to_collect != null && stop.total_to_collect > 0 && (
                        <span className="stop-billing-tag">
                          <span className="material-icons" style={{ fontSize: 13 }}>payments</span>
                          Cobrar: ${Number(stop.total_to_collect).toFixed(2)}
                          {stop.payment_status === 'paid' && <span className="stop-paid-badge">Pagado</span>}
                          {stop.payment_status === 'partial' && <span className="stop-partial-badge">Parcial</span>}
                        </span>
                      )}
                    </div>
                    <div className="stop-actions-row">
                      <button 
                        className="stop-move-btn"
                        onClick={(e) => { e.stopPropagation(); moveStop(index, -1); }}
                        disabled={index === 0}
                      >
                        <span className="material-icons" style={{ fontSize: 16 }}>arrow_upward</span>
                      </button>
                      <button 
                        className="stop-move-btn"
                        onClick={(e) => { e.stopPropagation(); moveStop(index, 1); }}
                        disabled={index === stops.length - 1}
                      >
                        <span className="material-icons" style={{ fontSize: 16 }}>arrow_downward</span>
                      </button>
                      {!currentRouteId && (
                        <button 
                          className="header-btn" 
                          onClick={(e) => { e.stopPropagation(); removeStop(index); }}
                        >
                          <span className="material-icons" style={{ fontSize: 18, color: '#666' }}>close</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={`stop-indicator ${stop.completed ? 'completed' : stop.skipped ? 'skipped' : ''}`}></div>
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
          ) : navigationMode ? (
            stops.every(s => s.completed || s.skipped) ? (
              <button className="btn-optimize" onClick={finishRoute}>
                <span className="material-icons">check_circle</span>
                Finalizar ruta
              </button>
            ) : (
              <div className="nav-footer-actions">
                {selectedStopIndex !== null && stops[selectedStopIndex] && !stops[selectedStopIndex].completed && !stops[selectedStopIndex].skipped ? (
                  <>
                    <button
                      className="btn-native-nav"
                      onClick={() => openNavChooser(stops[selectedStopIndex])}
                    >
                      <span className="material-icons">near_me</span>
                      Navegar
                    </button>
                    <button
                      className="btn-skip-nav"
                      onClick={() => { skipStop(selectedStopIndex); setSelectedStopIndex(null); localStorage.removeItem('selectedStop') }}
                    >
                      <span className="material-icons">skip_next</span>
                      {stops[selectedStopIndex]?.skippedOnce ? 'Saltar definitivo' : 'Saltar parada'}
                    </button>
                  </>
                ) : (
                  <span className="nav-footer-hint">
                    <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>touch_app</span>
                    Selecciona una parada
                  </span>
                )}
              </div>
            )
          ) : isOptimized ? (
            <button className="btn-start-route" onClick={startRoute}>
              <span className="material-icons">navigation</span>
              Iniciar ruta
            </button>
          ) : stops.length >= 2 ? (
            <button
              className="btn-optimize"
              onClick={optimizeRoute}
              disabled={optimizing}
            >
              <span className="material-icons">autorenew</span>
              {optimizing ? 'Optimizando...' : 'Optimizar la ruta'}
            </button>
          ) : (
            <span className="nav-footer-hint">
              <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>assignment</span>
              Selecciona una ruta asignada
            </span>
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
            <div className="menu-item" onClick={() => { setShowConfigModal('settings'); setShowRouteMenu(false) }}>
              <span className="material-icons">settings</span>
              <span>Ajustes de ruta</span>
            </div>
            {isOptimized && !navigationMode && (
              <div className="menu-item" onClick={reOptimize}>
                <span className="material-icons">autorenew</span>
                <span>Re-optimizar ruta</span>
              </div>
            )}
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

      {showConfigModal === 'settings' && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(null)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>Ajustes de ruta</h3>
              <button className="header-btn" onClick={() => setShowConfigModal(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="settings-modal-body">
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
      {showEvidenceModal !== null && (
        <div className="modal-overlay" onClick={() => { setShowEvidenceModal(null); setEvidencePreview(null); setEvidenceFile(null); }}>
          <div className="evidence-modal" onClick={e => e.stopPropagation()}>
            <div className="evidence-modal-header">
              <h3>Confirmar parada {showEvidenceModal + 1}</h3>
              <button className="header-btn" onClick={() => { setShowEvidenceModal(null); setEvidencePreview(null); setEvidenceFile(null); }}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="evidence-scroll-content">
            <div className="evidence-client-info">
              {stops[showEvidenceModal]?.name && (
                <div className="evidence-info-row">
                  <span className="material-icons">person</span>
                  <span>{stops[showEvidenceModal].name}</span>
                </div>
              )}
              {stops[showEvidenceModal]?.phone && (
                <div className="evidence-info-row evidence-contact-row">
                  <span className="material-icons">phone</span>
                  <span>{stops[showEvidenceModal].phone}</span>
                  <div className="evidence-contact-btns">
                    <a href={`tel:${stops[showEvidenceModal].phone.replace(/[^0-9+]/g, '')}`} className="evidence-contact-btn evidence-call-btn" onClick={e => e.stopPropagation()}>
                      <span className="material-icons">call</span> Llamar
                    </a>
                  </div>
                </div>
              )}
              <div className="evidence-info-row">
                <span className="material-icons">place</span>
                <span>{stops[showEvidenceModal]?.address || 'Parada'}</span>
              </div>
              {stops[showEvidenceModal]?.note && (
                <div className="evidence-info-row">
                  <span className="material-icons">sticky_note_2</span>
                  <span>{stops[showEvidenceModal].note}</span>
                </div>
              )}
            </div>
            {(stops[showEvidenceModal]?.total_to_collect != null || stops[showEvidenceModal]?.order_cost != null) && (
              <div className="evidence-billing-block">
                <div className="evidence-billing-title">
                  <span className="material-icons" style={{ fontSize: 18, color: '#4CAF50' }}>payments</span>
                  Cobranza
                </div>
                <div className="evidence-billing-details">
                  {stops[showEvidenceModal]?.order_cost != null && (
                    <div className="evidence-billing-line">
                      <span>Costo:</span>
                      <strong>${Number(stops[showEvidenceModal].order_cost).toFixed(2)}</strong>
                    </div>
                  )}
                  {stops[showEvidenceModal]?.deposit_amount > 0 && (
                    <div className="evidence-billing-line">
                      <span>Deposito:</span>
                      <strong>-${Number(stops[showEvidenceModal].deposit_amount).toFixed(2)}</strong>
                    </div>
                  )}
                  {stops[showEvidenceModal]?.total_to_collect != null && (
                    <div className="evidence-billing-line total-line">
                      <span>Total a cobrar:</span>
                      <strong>${Number(stops[showEvidenceModal].total_to_collect).toFixed(2)}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="evidence-payment-section">
              <label className="evidence-section-label">Metodo de pago</label>
              <div className="payment-method-options">
                {[
                  { value: 'cash', label: 'Efectivo', icon: 'payments' },
                  { value: 'zelle', label: 'Zelle', icon: 'account_balance' },
                  { value: 'card', label: 'Tarjeta', icon: 'credit_card' },
                  { value: 'other', label: 'Otro', icon: 'more_horiz' }
                ].map(pm => (
                  <button
                    key={pm.value}
                    className={`payment-method-btn ${selectedPaymentMethod === pm.value ? 'active' : ''}`}
                    onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === pm.value ? '' : pm.value)}
                  >
                    <span className="material-icons">{pm.icon}</span>
                    {pm.label}
                  </button>
                ))}
              </div>
              <div className="payment-amount-row">
                <label>Monto a cobrar $</label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={amountCollected}
                  onChange={e => {
                    const val = e.target.value
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setAmountCollected(val)
                    }
                  }}
                  placeholder="0.00"
                  className="payment-amount-input"
                />
              </div>
            </div>

            <div className="evidence-modal-body">
              {selectedPaymentMethod === 'zelle' ? (
                evidencePreview ? (
                  <div className="evidence-preview-container">
                    <img src={evidencePreview} alt="Evidencia" className="evidence-preview-img" />
                    <button className="evidence-retake-btn" onClick={retakeEvidence}>
                      <span className="material-icons">refresh</span>
                      Tomar otra
                    </button>
                  </div>
                ) : (
                  <div className="evidence-capture-area" onClick={openEvidenceCapture}>
                    <span className="material-icons" style={{ fontSize: 48, color: '#5b8def' }}>camera_alt</span>
                    <p>Foto de constancia Zelle</p>
                    <p className="evidence-hint">Toca para capturar foto del comprobante</p>
                  </div>
                )
              ) : selectedPaymentMethod ? (
                <div className="evidence-no-photo-needed">
                  <span className="material-icons" style={{ fontSize: 32, color: '#4CAF50' }}>check_circle</span>
                  <p>No se requiere foto para pago con {selectedPaymentMethod === 'cash' ? 'efectivo' : selectedPaymentMethod === 'card' ? 'tarjeta' : 'otro metodo'}</p>
                </div>
              ) : (
                <div className="evidence-no-photo-needed">
                  <span className="material-icons" style={{ fontSize: 32, color: '#999' }}>info</span>
                  <p>Selecciona un metodo de pago (opcional)</p>
                </div>
              )}
            </div>
            </div>
            <div className="evidence-modal-footer">
              <div className="evidence-footer-row">
                <button className="btn-cancel" onClick={() => { setShowEvidenceModal(null); setEvidencePreview(null); setEvidenceFile(null); setSelectedPaymentMethod(''); setAmountCollected(''); }}>
                  Cancelar
                </button>
                <button
                  className="btn-skip-stop"
                  onClick={() => skipStop(showEvidenceModal)}
                  disabled={uploadingEvidence}
                >
                  <span className="material-icons">skip_next</span>
                  {stops[showEvidenceModal]?.skippedOnce ? 'Saltar definitivo' : 'Mover al final'}
                </button>
              </div>
              <button 
                className="btn-optimize" 
                onClick={confirmStopWithEvidence} 
                disabled={uploadingEvidence}
                style={{ width: '100%' }}
              >
                <span className="material-icons">{uploadingEvidence ? 'hourglass_empty' : 'check'}</span>
                {uploadingEvidence ? 'Subiendo...' : evidenceFile ? 'Confirmar con foto' : 'Confirmar entrega'}
              </button>
            </div>
          </div>
        </div>
      )}

      <input 
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleEvidencePhoto}
      />

      {payDeliveryModal && (
        <div className="evidence-modal-overlay" onClick={() => setPayDeliveryModal(null)}>
          <div className="evidence-modal" onClick={e => e.stopPropagation()}>
            <div className="evidence-modal-header">
              <h3 style={{ margin: 0, fontSize: 17 }}>Entregar Pago</h3>
              <button className="evidence-close-btn" onClick={() => setPayDeliveryModal(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="evidence-modal-body" style={{ paddingTop: 12 }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>Ruta: {payDeliveryModal.name}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#22c55e' }}>
                  ${Number(payDeliveryModal.route_total_collected || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>Total cobrado a entregar a la empresa</div>
              </div>

              <div className="evidence-payment-section">
                <div className="payment-method-label">Método de entrega</div>
                <div className="payment-methods-grid">
                  {[
                    { key: 'cash', label: 'Efectivo', icon: 'payments' },
                    { key: 'card', label: 'Tarjeta', icon: 'credit_card' },
                    { key: 'transfer', label: 'Transferencia', icon: 'account_balance' },
                    { key: 'check', label: 'Cheque', icon: 'description' },
                    { key: 'zelle', label: 'Zelle', icon: 'send_to_mobile' }
                  ].map(m => (
                    <button
                      key={m.key}
                      className={`payment-method-btn${payDeliveryMethod === m.key ? ' selected' : ''}`}
                      onClick={() => setPayDeliveryMethod(m.key)}
                    >
                      <span className="material-icons">{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="evidence-modal-footer">
              <button
                className="btn-confirm-delivery"
                disabled={!payDeliveryMethod || deliveringPay}
                onClick={deliverRoutePayment}
              >
                <span className="material-icons">check_circle</span>
                {deliveringPay ? 'Registrando...' : 'Confirmar entrega de pago'}
              </button>
            </div>
          </div>
        </div>
      )}
      {navChooserOpen && navChooserStop && (
        <div className="modal-overlay" onClick={() => setNavChooserOpen(false)}>
          <div className="modal-card nav-chooser-card" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Navegar con...</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              {navChooserStop.name || navChooserStop.address}
            </div>
            <div className="nav-chooser-options">
              <button className="nav-app-btn" onClick={() => launchNavApp('google')}>
                <span className="material-icons" style={{ color: '#4285F4', fontSize: 28 }}>map</span>
                <span>Google Maps</span>
              </button>
              <button className="nav-app-btn" onClick={() => launchNavApp('waze')}>
                <span className="material-icons" style={{ color: '#06C3E6', fontSize: 28 }}>directions_car</span>
                <span>Waze</span>
              </button>
              {platform === 'ios' && (
                <button className="nav-app-btn" onClick={() => launchNavApp('apple')}>
                  <span className="material-icons" style={{ color: '#888', fontSize: 28 }}>map</span>
                  <span>Apple Maps</span>
                </button>
              )}
            </div>
            <button className="btn-flat" style={{ marginTop: 12, width: '100%' }} onClick={() => setNavChooserOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
