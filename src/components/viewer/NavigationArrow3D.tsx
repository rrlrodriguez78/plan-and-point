import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { NavigationPoint } from '@/types/tour';

interface NavigationArrow3DProps {
  navigationPoints: NavigationPoint[];
  scene: THREE.Scene;
  camera: THREE.Camera;
  currentZoom: number;
  onPointClick: (targetHotspotId: string) => void;
}

export const NavigationArrow3D = ({
  navigationPoints,
  scene,
  camera,
  currentZoom,
  onPointClick
}: NavigationArrow3DProps) => {
  const arrowGroupRef = useRef<THREE.Group | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const animationFrameRef = useRef<number>();
  
  // Calcular escala base según zoom (FOV 120 = grande, FOV 30 = pequeño)
  const baseScale = 1.0 - ((currentZoom - 30) / (120 - 30)) * 0.65;
  
  useEffect(() => {
    if (!scene) return;
    
    const arrowGroup = new THREE.Group();
    arrowGroup.name = 'navigationArrows';
    
    navigationPoints.forEach((point) => {
      if (!point.is_active) return;
      
      // Convertir coordenadas esféricas a cartesianas
      const radius = 480; // un poco dentro de la esfera panorámica (500)
      const theta = THREE.MathUtils.degToRad(point.theta);
      const phi = THREE.MathUtils.degToRad(point.phi);
      
      // ✅ Conversión estándar esférica → cartesiana (la esfera ya maneja la inversión con scale)
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi) + (point.height_offset || 0);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      
      // Crear geometría de flecha con nuevo diseño circular
      const arrowMesh = createArrowMesh(point.style);
      arrowMesh.position.set(x, y, z);
      
      // Orientar la flecha hacia el centro (usuario)
      arrowMesh.lookAt(0, y, 0);
      
      // Almacenar datos para el raycasting
      arrowMesh.userData = {
        targetHotspotId: point.to_hotspot_id,
        label: point.label,
        isNavigation: true
      };
      
      arrowGroup.add(arrowMesh);
      
      // Añadir sprite de texto (label)
      if (point.label) {
        const labelSprite = createTextSprite(point.label);
        labelSprite.position.set(x, y + 40, z);
        labelSprite.userData = {
          targetHotspotId: point.to_hotspot_id,
          isLabel: true
        };
        arrowGroup.add(labelSprite);
      }
    });
    
    scene.add(arrowGroup);
    arrowGroupRef.current = arrowGroup;
    
    return () => {
      if (arrowGroupRef.current) {
        scene.remove(arrowGroupRef.current);
        disposeGroup(arrowGroupRef.current);
      }
    };
  }, [navigationPoints, scene]);
  
  // Animación de pulsación y escala según zoom
  useEffect(() => {
    if (!arrowGroupRef.current) return;
    
    const animate = () => {
      if (!arrowGroupRef.current) return;
      
      const time = Date.now() * 0.001;
      const pulseScale = 1 + Math.sin(time * 2) * 0.08; // Pulsación sutil ±8%
      
      arrowGroupRef.current.children.forEach((child) => {
        if (child.userData.isNavigation) {
          // Combinar escala base (zoom) con pulsación
          const finalScale = baseScale * pulseScale;
          child.scale.set(finalScale, finalScale, finalScale);
        }
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [baseScale]);
  
  // Animación de hover y pulsación
  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (!arrowGroupRef.current || !camera) return;
      
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      
      raycaster.current.setFromCamera(mouse, camera);
      const intersects = raycaster.current.intersectObjects(
        arrowGroupRef.current.children,
        true
      );
      
      // Reset scale de todas las flechas
      arrowGroupRef.current.children.forEach((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
          if (child.userData.isNavigation) {
            child.scale.set(1, 1, 1);
          }
        }
      });
      
      // Escalar flecha bajo hover
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        
        // Si es parte de un grupo, buscar el grupo padre
        while (obj.parent && !obj.userData.isNavigation && obj.parent !== arrowGroupRef.current) {
          obj = obj.parent as THREE.Object3D;
        }
        
        if (obj.userData.isNavigation || obj.userData.targetHotspotId) {
          if (obj.userData.isNavigation) {
            obj.scale.set(1.3, 1.3, 1.3);
          }
          document.body.style.cursor = 'pointer';
        }
      } else {
        document.body.style.cursor = 'default';
      }
    };
    
    const handleClick = (event: MouseEvent) => {
      if (!arrowGroupRef.current || !camera) return;
      
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      
      raycaster.current.setFromCamera(mouse, camera);
      const intersects = raycaster.current.intersectObjects(
        arrowGroupRef.current.children,
        true
      );
      
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        
        // Buscar el objeto con targetHotspotId
        while (obj && !obj.userData.targetHotspotId && obj.parent !== arrowGroupRef.current) {
          obj = obj.parent as THREE.Object3D;
        }
        
        const targetId = obj?.userData?.targetHotspotId;
        if (targetId) {
          onPointClick(targetId);
        }
      }
    };
    
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('click', handleClick);
    
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('click', handleClick);
      document.body.style.cursor = 'default';
    };
  }, [camera, onPointClick]);
  
  return null;
};

// Helper: crear mesh de flecha con diseño circular moderno
function createArrowMesh(style?: NavigationPoint['style']) {
  const color = style?.color || '#FFFFFF';
  const size = style?.size || 1.0;
  
  const group = new THREE.Group();
  group.userData.isNavigation = true;
  
  // Círculo exterior (fondo con borde)
  const outerCircleGeometry = new THREE.CircleGeometry(18 * size, 64);
  const outerCircleMaterial = new THREE.MeshBasicMaterial({
    color: '#FFFFFF',
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide
  });
  const outerCircle = new THREE.Mesh(outerCircleGeometry, outerCircleMaterial);
  
  // Círculo medio (fondo sólido)
  const middleCircleGeometry = new THREE.CircleGeometry(16 * size, 64);
  const middleCircleMaterial = new THREE.MeshBasicMaterial({
    color: '#FFFFFF',
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide
  });
  const middleCircle = new THREE.Mesh(middleCircleGeometry, middleCircleMaterial);
  middleCircle.position.z = 0.5;
  
  // Anillo interior (borde decorativo)
  const ringGeometry = new THREE.RingGeometry(12 * size, 14 * size, 64);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: '#E5E5E5',
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.z = 1;
  
  // Flecha hacia arriba (chevron doble estilizado)
  const arrowShape = new THREE.Shape();
  const arrowSize = 6 * size;
  
  // Primera chevron
  arrowShape.moveTo(-arrowSize, 2);
  arrowShape.lineTo(0, -arrowSize + 2);
  arrowShape.lineTo(arrowSize, 2);
  arrowShape.lineTo(arrowSize - 1.5, 2);
  arrowShape.lineTo(0, -arrowSize + 5);
  arrowShape.lineTo(-arrowSize + 1.5, 2);
  arrowShape.closePath();
  
  // Segunda chevron (más arriba)
  arrowShape.moveTo(-arrowSize, 7);
  arrowShape.lineTo(0, -arrowSize + 7);
  arrowShape.lineTo(arrowSize, 7);
  arrowShape.lineTo(arrowSize - 1.5, 7);
  arrowShape.lineTo(0, -arrowSize + 10);
  arrowShape.lineTo(-arrowSize + 1.5, 7);
  arrowShape.closePath();
  
  const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
  const arrowMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  });
  const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
  arrow.position.z = 2;
  
  group.add(outerCircle, middleCircle, ring, arrow);
  return group;
}

// Helper: crear sprite de texto
function createTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = 256;
  canvas.height = 64;
  
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.font = 'Bold 20px Arial';
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(50, 12.5, 1);
  
  return sprite;
}

function disposeGroup(group: THREE.Group) {
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    } else if (child instanceof THREE.Sprite) {
      if (child.material.map) {
        child.material.map.dispose();
      }
      child.material.dispose();
    } else if (child instanceof THREE.Group) {
      disposeGroup(child);
    }
  });
}
