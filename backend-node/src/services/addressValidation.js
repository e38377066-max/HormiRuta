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

  async validateAddress(address) {
    const zipCode = this.extractZipCode(address);
    const addressType = this.detectAddressType(address);
    const coverageResult = await this.checkCoverage(zipCode);

    return {
      address,
      zipCode,
      addressType,
      hasCoverage: coverageResult.hasCoverage,
      zone: coverageResult.zone,
      validationMessage: coverageResult.hasCoverage
        ? `Direccion validada. Tipo: ${addressType === 'apartment' ? 'Apartamento' : 'Casa'}. ZIP: ${zipCode}`
        : coverageResult.reason
    };
  }
}

export default AddressValidationService;
