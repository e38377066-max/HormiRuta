---
name: Apple Maps y CarPlay
description: Formato de navegación nativa que funciona de forma consistente en Apple Maps y CarPlay.
---

Para abrir navegación en iOS se debe enviar un único destino por coordenadas mediante el enlace universal de Apple Maps, usando `daddr`, `dirflg=d` y una etiqueta opcional. No se debe incluir `saddr`, waypoints con `to:` ni forzar una dirección textual como destino.

**Why:** El iPhone podía resolver la combinación de dirección, origen GPS y waypoints, pero CarPlay la rechazaba con “Directions Not Available”. El formato simplificado fue confirmado funcionando en la app normal y en CarPlay.

**How to apply:** Mantener la navegación por coordenadas y dejar que Apple Maps determine automáticamente la ubicación actual del teléfono como origen. Validar cambios futuros en ambos destinos antes de modificar el formato.