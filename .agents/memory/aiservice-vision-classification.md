---
name: Vision classification tarjetas vs magneticos
description: Criterio usado en el prompt de análisis de imagen (GPT-4o vision, analyzeImageForSales en aiService.js) para distinguir productos "tarjetas" de "magneticos".
---

El bot de ventas analiza imágenes que los clientes mandan (referencias de diseño) para detectar qué producto quieren pedir. Se confundía diseños de tarjetas de presentación con "magnéticos" (letreros para vehículo) cuando el negocio del cliente era de servicio a domicilio (HVAC, plomería, towing, etc.), aunque la imagen no mostraba ningún vehículo.

**Regla aplicada:** solo clasificar como "magneticos" si el diseño se ve realmente montado/pegado en la carrocería de un vehículo, o si es un rectángulo ancho tipo letrero (proporción ~12x24 o 18x24). Si se ven uno o dos diseños rectangulares tipo tarjeta (proporción ~2x3.5, con info de contacto) sin vehículo visible, debe clasificarse como "tarjetas" — sin importar el tipo de negocio.

**Why:** el tipo de negocio (ej. HVAC, towing) NO determina el producto; mucha gente de servicio a domicilio pide tarjetas de presentación normales, no magnéticos. Cuando hay duda razonable, el prompt prefiere "tarjetas" (producto más común) y baja la confianza de `isDesignReference`.

**How to apply:** si se reportan más confusiones de clasificación de producto en el análisis de imagen, ajustar el bloque "CRITERIO PARA DIFERENCIAR" dentro del prompt de `analyzeImageForSales` en `src/services/aiService.js`, no solo el modelo/detail de la llamada a vision. También se subió `detail` de la imagen de `low` a `high` para mejorar precisión general.
