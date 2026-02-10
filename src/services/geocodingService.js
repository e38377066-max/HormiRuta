import axios from 'axios';

class GeocodingService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    this.cache = new Map();
    this.CACHE_MAX_SIZE = 500;
    this.CACHE_TTL_MS = 60 * 60 * 1000;
    this.ERROR_CACHE_TTL_MS = 5 * 60 * 1000;
    this.rateLimitedUntil = 0;
  }

  async geocodeAddress(rawAddress) {
    if (!this.apiKey) {
      console.warn('[Geocoding] No API key configured');
      return { success: false, error: 'No API key', original: rawAddress };
    }

    if (!rawAddress || rawAddress.trim().length < 5) {
      return { success: false, error: 'Address too short', original: rawAddress };
    }

    if (Date.now() < this.rateLimitedUntil) {
      return { success: false, error: 'Rate limited, waiting', original: rawAddress };
    }

    const cacheKey = rawAddress.toLowerCase().trim();
    const cached = this.cache.get(cacheKey);
    if (cached) {
      const ttl = cached.isError ? this.ERROR_CACHE_TTL_MS : this.CACHE_TTL_MS;
      if ((Date.now() - cached.timestamp) < ttl) {
        return cached.result;
      }
      this.cache.delete(cacheKey);
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          address: rawAddress,
          key: this.apiKey,
          language: 'en',
          components: 'country:US'
        },
        timeout: 5000
      });

      const data = response.data;

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const bestResult = data.results[0];
        const components = this.parseAddressComponents(bestResult.address_components);
        const formatted = bestResult.formatted_address;
        const cleanFormatted = formatted.replace(/,\s*USA?\s*$/i, '').trim();

        const locationType = bestResult.geometry?.location_type;
        const isHighConfidence = locationType === 'ROOFTOP' || locationType === 'RANGE_INTERPOLATED';

        const builtAddress = this.buildCleanAddress(components);
        const finalAddress = builtAddress && builtAddress.length > 5 ? builtAddress : cleanFormatted;

        const result = {
          success: true,
          original: rawAddress,
          corrected: cleanFormatted,
          streetNumber: components.streetNumber,
          street: components.street,
          city: components.city,
          state: components.state,
          zip: components.zip,
          county: components.county,
          fullAddress: finalAddress,
          latitude: bestResult.geometry?.location?.lat,
          longitude: bestResult.geometry?.location?.lng,
          confidence: isHighConfidence ? 'high' : 'low',
          locationType: locationType,
          wasChanged: rawAddress.toLowerCase().trim() !== cleanFormatted.toLowerCase().trim()
        };

        this.addToCache(cacheKey, result, false);
        return result;
      }

      if (data.status === 'ZERO_RESULTS') {
        const result = { success: false, error: 'Address not found', original: rawAddress };
        this.addToCache(cacheKey, result, true);
        return result;
      }

      if (data.status === 'OVER_QUERY_LIMIT') {
        console.warn('[Geocoding] Rate limit reached, pausing for 60 seconds');
        this.rateLimitedUntil = Date.now() + 60 * 1000;
        return { success: false, error: 'Rate limited', original: rawAddress };
      }

      if (data.status === 'REQUEST_DENIED') {
        console.error('[Geocoding] API request denied - check API key and Geocoding API is enabled');
        this.rateLimitedUntil = Date.now() + 5 * 60 * 1000;
        return { success: false, error: 'API request denied', original: rawAddress };
      }

      const errorResult = { success: false, error: `API status: ${data.status}`, original: rawAddress };
      this.addToCache(cacheKey, errorResult, true);
      return errorResult;

    } catch (error) {
      console.error('[Geocoding] Request error:', error.message);
      return { success: false, error: error.message, original: rawAddress };
    }
  }

  parseAddressComponents(components) {
    const result = {
      streetNumber: '',
      street: '',
      city: '',
      state: '',
      stateShort: '',
      zip: '',
      county: '',
      country: ''
    };

    for (const comp of components) {
      const types = comp.types || [];

      if (types.includes('street_number')) {
        result.streetNumber = comp.long_name;
      } else if (types.includes('route')) {
        result.street = comp.short_name;
      } else if (types.includes('locality')) {
        result.city = comp.long_name;
      } else if (types.includes('sublocality_level_1') && !result.city) {
        result.city = comp.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        result.state = comp.long_name;
        result.stateShort = comp.short_name;
      } else if (types.includes('postal_code')) {
        result.zip = comp.long_name;
      } else if (types.includes('administrative_area_level_2')) {
        result.county = comp.long_name;
      } else if (types.includes('country')) {
        result.country = comp.short_name;
      }
    }

    return result;
  }

  buildCleanAddress(components) {
    const parts = [];

    if (components.streetNumber && components.street) {
      parts.push(`${components.streetNumber} ${components.street}`);
    } else if (components.street) {
      parts.push(components.street);
    }

    if (components.city) {
      parts.push(components.city);
    }

    if (components.stateShort) {
      parts.push(components.stateShort);
    }

    if (components.zip) {
      parts.push(components.zip);
    }

    return parts.join(', ');
  }

  addToCache(key, result, isError = false) {
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { result, timestamp: Date.now(), isError });
  }
}

const geocodingServiceInstance = new GeocodingService();
export default geocodingServiceInstance;
