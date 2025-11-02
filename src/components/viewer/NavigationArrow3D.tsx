import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { NavigationPoint } from '@/types/tour';

interface NavigationArrow3DProps {
  navigationPoints: NavigationPoint[];
  scene: THREE.Scene;
  camera: THREE.Camera;
  onPointClick: (targetHotspotId: string) => void;
}

export const NavigationArrow3D = ({
  navigationPoints,
  scene,
  camera,
  onPointClick
}: NavigationArrow3DProps) => {
  const arrowGroupRef = useRef<THREE.Group | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  
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
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi) + (point.height_offset || 0);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      
      // Crear geometría de flecha
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
        labelSprite.position.set(x, y + 30, z);
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

// Helper: crear mesh de flecha
function createArrowMesh(style?: NavigationPoint['style']) {
  const color = style?.color || '#4F46E5';
  const size = style?.size || 1.0;
  
  const group = new THREE.Group();
  group.userData.isNavigation = true;
  
  // Cono (punta)
  const coneGeometry = new THREE.ConeGeometry(5 * size, 15 * size, 8);
  const coneMaterial = new THREE.MeshBasicMaterial({ 
    color,
    transparent: true,
    opacity: 0.9
  });
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.position.y = 10 * size;
  cone.rotation.x = Math.PI;
  
  // Cilindro (cuerpo)
  const cylinderGeometry = new THREE.CylinderGeometry(2 * size, 2 * size, 10 * size);
  const cylinder = new THREE.Mesh(cylinderGeometry, coneMaterial);
  cylinder.position.y = 0;
  
  // Círculo base (para mejor visibilidad)
  const circleGeometry = new THREE.CircleGeometry(8 * size, 32);
  const circleMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
  });
  const circle = new THREE.Mesh(circleGeometry, circleMaterial);
  circle.position.y = -5 * size;
  circle.rotation.x = Math.PI / 2;
  
  group.add(cone, cylinder, circle);
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
