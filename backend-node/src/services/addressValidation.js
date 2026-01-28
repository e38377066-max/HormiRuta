import { CoverageZone } from '../models/index.js';

class AddressValidationService {
  constructor(userId) {
    this.userId = userId;
  }

  extractZipCode(address) {
    const usZipPattern = /\b\d{5}(-\d{4})?\b/;
    const match = address.match(usZipPattern);
    return match ? match[0].substring(0, 5) : null;
  }

  detectAddressType(address) {
    const lowerAddress = address.toLowerCase();
    
    const apartmentIndicators = [
      'apt', 'apartment', 'unit', 'suite', 'ste', '#',
      'floor', 'fl', 'building', 'bldg', 'room', 'rm',
      'penthouse', 'ph', 'condo', 'condominium'
    ];
    
    for (const indicator of apartmentIndicators) {
      if (lowerAddress.includes(indicator)) {
        return 'apartment';
      }
    }
    
    return 'house';
  }

  async checkCoverage(zipCode) {
    if (!zipCode) {
      return {
        hasCoverage: false,
        zone: null,
        reason: 'No se pudo extraer el codigo postal de la direccion'
      };
    }

    const zone = await CoverageZone.findOne({
      where: {
        user_id: this.userId,
        zip_code: zipCode,
        is_active: true
      }
    });

    if (zone) {
      return {
        hasCoverage: true,
        zone: zone.toDict(),
        reason: null
      };
    }

    return {
      hasCoverage: false,
      zone: null,
      reason: `No hay cobertura en el codigo postal ${zipCode}`
    };
  }

  isLikelyAddress(text) {
    if (!text || text.length < 10) return false;
    
    const lowerText = text.toLowerCase();
    
    const addressIndicators = [
      'street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr',
      'lane', 'ln', 'boulevard', 'blvd', 'way', 'court', 'ct',
      'place', 'pl', 'circle', 'cir', 'highway', 'hwy',
      'calle', 'avenida', 'carretera', 'camino',
      'apt', 'apartment', 'suite', 'unit', '#',
      'floor', 'building', 'bldg'
    ];
    
    const hasAddressWord = addressIndicators.some(ind => lowerText.includes(ind));
    const hasNumber = /\d+/.test(text);
    const hasZipCode = this.extractZipCode(text) !== null;
    
    return hasZipCode || (hasAddressWord && hasNumber);
  }

  async validateAddress(address) {
    const zipCode = this.extractZipCode(address);
    const addressType = this.detectAddressType(address);
    const coverageResult = await this.checkCoverage(zipCode);
    const isAddress = this.isLikelyAddress(address);

    return {
      address,
      zipCode,
      addressType,
      isAddress,
      hasCoverage: coverageResult.hasCoverage,
      zone: coverageResult.zone,
      validationMessage: coverageResult.hasCoverage
        ? `Direccion validada. Tipo: ${addressType === 'apartment' ? 'Apartamento' : 'Casa'}. ZIP: ${zipCode}`
        : coverageResult.reason
    };
  }
}

export default AddressValidationService;
