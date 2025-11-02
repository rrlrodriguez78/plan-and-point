import * as THREE from 'three';
import { useCallback } from 'react';

export interface SphericalCoordinates {
  theta: number; // -180 to 180 degrees
  phi: number;   // 0 to 180 degrees
}

export interface CartesianCoordinates {
  x: number;
  y: number;
  z: number;
}

/**
 * Hook para conversión entre coordenadas de pantalla y esféricas (theta/phi)
 * Utilizado por el editor visual WYSIWYG de flechas de navegación 3D
 */
export const useSphericalCoordinates = () => {
  
  /**
   * Convierte coordenadas de mouse/touch a coordenadas esféricas (theta, phi)
   * usando raycasting sobre la esfera panorámica
   */
  const screenToSpherical = useCallback((
    mouseX: number, 
    mouseY: number, 
    camera: THREE.Camera,
    container: HTMLElement
  ): SphericalCoordinates | null => {
    try {
      // 1. Obtener dimensiones del contenedor
      const rect = container.getBoundingClientRect();
      
      // 2. Normalizar coordenadas de pantalla a [-1, 1]
      const ndcX = ((mouseX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((mouseY - rect.top) / rect.height) * 2 + 1;
      
      // 3. Raycasting desde cámara
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      
      // 4. Intersección con esfera panorámica (radio 480 para quedar dentro de 500)
      const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 480);
      const intersectionPoint = new THREE.Vector3();
      const hasIntersection = raycaster.ray.intersectSphere(sphere, intersectionPoint);
      
      if (!hasIntersection) {
        return null;
      }
      
      // 5. Convertir XYZ a coordenadas esféricas
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(intersectionPoint);
      
      console.log('🔵 [screenToSpherical] Raw spherical:', {
        thetaRad: spherical.theta,
        phiRad: spherical.phi,
        thetaDeg: THREE.MathUtils.radToDeg(spherical.theta),
        phiDeg: THREE.MathUtils.radToDeg(spherical.phi),
        intersectionPoint: { x: intersectionPoint.x, y: intersectionPoint.y, z: intersectionPoint.z }
      });
      
      // 6. Convertir a grados (formato BD)
      let theta = THREE.MathUtils.radToDeg(spherical.theta);
      const phi = THREE.MathUtils.radToDeg(spherical.phi);
      
      // CRÍTICO: Invertir theta porque la esfera está mirrored (scale -1, 1, 1)
      theta = -theta;
      
      console.log('🔵 [screenToSpherical] After inversion:', {
        theta: theta,
        phi: phi,
        note: 'theta invertido para compensar scale(-1, 1, 1)'
      });
      
      // 7. Ajustar theta al rango [-180, 180]
      if (theta > 180) theta -= 360;
      if (theta < -180) theta += 360;
      
      // 8. Validar rangos
      const validTheta = Math.max(-180, Math.min(180, theta));
      const validPhi = Math.max(0, Math.min(180, phi));
      
      console.log('🟢 [screenToSpherical] FINAL:', {
        theta: Math.round(validTheta),
        phi: Math.round(validPhi),
        raw: { theta: validTheta, phi: validPhi }
      });
      
      return {
        theta: Math.round(validTheta),
        phi: Math.round(validPhi)
      };
    } catch (error) {
      console.error('Error converting screen to spherical:', error);
      return null;
    }
  }, []);
  
  /**
   * Convierte coordenadas esféricas (theta, phi) a cartesianas (x, y, z)
   * para posicionar objetos en la escena 3D
   */
  const sphericalToCartesian = useCallback((
    theta: number, 
    phi: number, 
    radius: number = 480,
    heightOffset: number = 0
  ): CartesianCoordinates => {
    // Invertir theta para matchear con la esfera invertida
    const thetaRad = THREE.MathUtils.degToRad(-theta);
    const phiRad = THREE.MathUtils.degToRad(phi);
    
    const x = radius * Math.sin(phiRad) * Math.cos(thetaRad);
    const y = radius * Math.cos(phiRad) + heightOffset;
    const z = radius * Math.sin(phiRad) * Math.sin(thetaRad);
    
    console.log('🔄 [sphericalToCartesian]', {
      input: { theta, phi, radius, heightOffset },
      thetaRad: thetaRad,
      phiRad: phiRad,
      output: { x, y, z },
      note: 'theta invertido en conversión'
    });
    
    return { x, y, z };
  }, []);
  
  /**
   * Valida que las coordenadas esféricas estén en el rango correcto
   */
  const validateCoordinates = useCallback((coords: SphericalCoordinates): boolean => {
    return coords.theta >= -180 && 
           coords.theta <= 180 && 
           coords.phi >= 0 && 
           coords.phi <= 180;
  }, []);
  
  return {
    screenToSpherical,
    sphericalToCartesian,
    validateCoordinates
  };
};
