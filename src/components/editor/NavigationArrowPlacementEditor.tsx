import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { NavigationPoint, Hotspot } from '@/types/tour';
import { useSphericalCoordinates } from '@/hooks/useSphericalCoordinates';
import { ArrowPlacementControls } from './ArrowPlacementControls';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface NavigationArrowPlacementEditorProps {
  hotspotId: string;
  panoramaUrl: string;
  existingPoints: NavigationPoint[];
  availableTargets: Array<{ id: string; title: string }>;
  onSave: (points: NavigationPoint[]) => Promise<void>;
}

export const NavigationArrowPlacementEditor = ({
  hotspotId,
  panoramaUrl,
  existingPoints,
  availableTargets,
  onSave
}: NavigationArrowPlacementEditorProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const arrowsGroupRef = useRef<THREE.Group | null>(null);
  const ghostArrowRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number>();
  
  const [mode, setMode] = useState<'view' | 'place' | 'drag'>('view');
  const [targetHotspot, setTargetHotspot] = useState<string | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ theta: number; phi: number } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<NavigationPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<NavigationPoint[]>(existingPoints);
  
  const { screenToSpherical, sphericalToCartesian } = useSphericalCoordinates();
  
  // Camera control refs
  const isUserInteracting = useRef(false);
  const onPointerDownMouseX = useRef(0);
  const onPointerDownMouseY = useRef(0);
  const lon = useRef(0);
  const onPointerDownLon = useRef(0);
  const lat = useRef(0);
  const onPointerDownLat = useRef(0);
  const raycaster = useRef(new THREE.Raycaster());
  
  // Inicializar escena 3D
  useEffect(() => {
    if (!mountRef.current) return;
    
    const mountNode = mountRef.current;
    
    // Crear escena
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    // Crear cámara
    const camera = new THREE.PerspectiveCamera(
      75,
      mountNode.clientWidth / mountNode.clientHeight,
      1,
      1100
    );
    cameraRef.current = camera;
    
    // Crear renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    mountNode.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Cargar textura panorámica
    const sphereGeometry = new THREE.SphereGeometry(500, 60, 40);
    sphereGeometry.scale(-1, 1, 1);
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      panoramaUrl,
      (texture) => {
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const mesh = new THREE.Mesh(sphereGeometry, material);
        scene.add(mesh);
        meshRef.current = mesh;
        setLoading(false);
      },
      undefined,
      (error) => {
        console.error('Error loading panorama:', error);
        toast.error('Error al cargar el panorama');
        setLoading(false);
      }
    );
    
    // Crear grupo para flechas
    const arrowsGroup = new THREE.Group();
    arrowsGroup.name = 'existingArrows';
    scene.add(arrowsGroup);
    arrowsGroupRef.current = arrowsGroup;
    
    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      const phi = THREE.MathUtils.degToRad(90 - lat.current);
      const theta = THREE.MathUtils.degToRad(lon.current);
      
      const x = 500 * Math.sin(phi) * Math.cos(theta);
      const y = 500 * Math.cos(phi);
      const z = 500 * Math.sin(phi) * Math.sin(theta);
      
      camera.lookAt(x, y, z);
      renderer.render(scene, camera);
    };
    animate();
    
    // Resize handler
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountNode.clientWidth / mountNode.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Cleanup
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        (meshRef.current.material as THREE.Material).dispose();
      }
      if (renderer) {
        renderer.dispose();
        if (mountNode.contains(renderer.domElement)) {
          mountNode.removeChild(renderer.domElement);
        }
      }
    };
  }, [panoramaUrl]);
  
  // Renderizar flechas existentes
  useEffect(() => {
    if (!arrowsGroupRef.current || !sceneRef.current) return;
    
    // Limpiar flechas anteriores
    while (arrowsGroupRef.current.children.length > 0) {
      const child = arrowsGroupRef.current.children[0];
      arrowsGroupRef.current.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
        disposeObject(child);
      }
    }
    
    // Añadir flechas existentes
    points.forEach((point) => {
      if (!point.is_active) return;
      
      const { x, y, z } = sphericalToCartesian(point.theta, point.phi, 480, point.height_offset);
      const arrowMesh = createArrowMesh(point.style, false);
      arrowMesh.position.set(x, y, z);
      arrowMesh.lookAt(0, y, 0);
      arrowMesh.userData = {
        pointId: point.id,
        targetHotspotId: point.to_hotspot_id,
        isNavigationArrow: true
      };
      
      arrowsGroupRef.current!.add(arrowMesh);
      
      // Label
      if (point.label) {
        const labelSprite = createTextSprite(point.label);
        labelSprite.position.set(x, y + 30, z);
        arrowsGroupRef.current!.add(labelSprite);
      }
    });
  }, [points, sphericalToCartesian]);
  
  // Renderizar flecha fantasma
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Limpiar flecha fantasma anterior
    if (ghostArrowRef.current) {
      sceneRef.current.remove(ghostArrowRef.current);
      disposeObject(ghostArrowRef.current);
      ghostArrowRef.current = null;
    }
    
    // Crear nueva flecha fantasma si está en modo place
    if (mode === 'place' && ghostPosition) {
      const { x, y, z } = sphericalToCartesian(ghostPosition.theta, ghostPosition.phi, 480);
      const ghostMesh = createArrowMesh(undefined, true);
      ghostMesh.position.set(x, y, z);
      ghostMesh.lookAt(0, y, 0);
      
      sceneRef.current.add(ghostMesh);
      ghostArrowRef.current = ghostMesh;
    }
  }, [mode, ghostPosition, sphericalToCartesian]);
  
  // Manejo de eventos del mouse
  const handlePointerDown = useCallback((event: React.MouseEvent) => {
    if (!mountRef.current || !cameraRef.current) return;
    
    event.preventDefault();
    
    // Si estamos en modo place, colocar flecha
    if (mode === 'place' && ghostPosition && targetHotspot) {
      placeArrow(ghostPosition, targetHotspot);
      return;
    }
    
    // Si estamos en modo view, verificar si clickeamos una flecha
    if (mode === 'view') {
      const rect = mountRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      
      raycaster.current.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.current.intersectObjects(
        arrowsGroupRef.current?.children || [],
        true
      );
      
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData.isNavigationArrow && obj.parent) {
          obj = obj.parent as THREE.Object3D;
        }
        
        if (obj.userData.pointId) {
          const point = points.find(p => p.id === obj.userData.pointId);
          if (point) {
            setSelectedPoint(point);
            setMode('drag');
            return;
          }
        }
      }
    }
    
    // Si llegamos aquí, iniciar drag de cámara
    isUserInteracting.current = true;
    onPointerDownMouseX.current = event.clientX;
    onPointerDownMouseY.current = event.clientY;
    onPointerDownLon.current = lon.current;
    onPointerDownLat.current = lat.current;
  }, [mode, ghostPosition, targetHotspot, points]);
  
  const handlePointerMove = useCallback((event: React.MouseEvent) => {
    if (!mountRef.current || !cameraRef.current) return;
    
    // Actualizar posición de flecha fantasma o drag
    if (mode === 'place' || mode === 'drag') {
      const coords = screenToSpherical(
        event.clientX,
        event.clientY,
        cameraRef.current,
        mountRef.current
      );
      
      if (coords) {
        if (mode === 'place') {
          setGhostPosition(coords);
        } else if (mode === 'drag' && selectedPoint) {
          // Actualizar visualmente la flecha mientras se arrastra
          setGhostPosition(coords);
        }
      }
      return;
    }
    
    // Drag de cámara
    if (isUserInteracting.current) {
      lon.current = (onPointerDownMouseX.current - event.clientX) * 0.1 + onPointerDownLon.current;
      lat.current = (event.clientY - onPointerDownMouseY.current) * 0.1 + onPointerDownLat.current;
      lat.current = Math.max(-85, Math.min(85, lat.current));
    }
  }, [mode, screenToSpherical, selectedPoint]);
  
  const handlePointerUp = useCallback(() => {
    // Si estamos arrastrando una flecha, actualizar su posición
    if (mode === 'drag' && selectedPoint && ghostPosition) {
      updateArrowPosition(selectedPoint.id, ghostPosition);
    }
    
    isUserInteracting.current = false;
  }, [mode, selectedPoint, ghostPosition]);
  
  const handleWheel = useCallback((event: React.WheelEvent) => {
    if (!cameraRef.current) return;
    const newFov = cameraRef.current.fov + event.deltaY * 0.05;
    cameraRef.current.fov = THREE.MathUtils.clamp(newFov, 30, 120);
    cameraRef.current.updateProjectionMatrix();
  }, []);
  
  // ESC para cancelar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'place') {
          setMode('view');
          setGhostPosition(null);
          setTargetHotspot(null);
        } else if (mode === 'drag') {
          setMode('view');
          setSelectedPoint(null);
          setGhostPosition(null);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);
  
  // Funciones de BD
  const placeArrow = async (position: { theta: number; phi: number }, targetId: string) => {
    try {
      const { data, error } = await supabase
        .from('hotspot_navigation_points')
        .insert({
          from_hotspot_id: hotspotId,
          to_hotspot_id: targetId,
          theta: position.theta,
          phi: position.phi,
          is_active: true,
          style: { color: '#4F46E5', size: 1.0 }
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setPoints([...points, data as NavigationPoint]);
      toast.success('Flecha añadida');
      setMode('view');
      setGhostPosition(null);
      setTargetHotspot(null);
      await onSave([...points, data as NavigationPoint]);
    } catch (error) {
      console.error('Error placing arrow:', error);
      toast.error('Error al colocar la flecha');
    }
  };
  
  const updateArrowPosition = async (pointId: string, position: { theta: number; phi: number }) => {
    try {
      const { error } = await supabase
        .from('hotspot_navigation_points')
        .update({
          theta: position.theta,
          phi: position.phi
        })
        .eq('id', pointId);
      
      if (error) throw error;
      
      const updatedPoints = points.map(p => 
        p.id === pointId ? { ...p, theta: position.theta, phi: position.phi } : p
      );
      setPoints(updatedPoints);
      toast.success('Flecha reposicionada');
      setMode('view');
      setSelectedPoint(null);
      setGhostPosition(null);
      await onSave(updatedPoints);
    } catch (error) {
      console.error('Error updating arrow:', error);
      toast.error('Error al actualizar la flecha');
    }
  };
  
  const deleteArrow = async (pointId: string) => {
    try {
      const { error } = await supabase
        .from('hotspot_navigation_points')
        .delete()
        .eq('id', pointId);
      
      if (error) throw error;
      
      const updatedPoints = points.filter(p => p.id !== pointId);
      setPoints(updatedPoints);
      toast.success('Flecha eliminada');
      await onSave(updatedPoints);
    } catch (error) {
      console.error('Error deleting arrow:', error);
      toast.error('Error al eliminar la flecha');
    }
  };
  
  const startEditingPoint = (point: NavigationPoint) => {
    setSelectedPoint(point);
    setMode('drag');
    setGhostPosition({ theta: point.theta, phi: point.phi });
  };
  
  return (
    <div className="space-y-4">
      {/* Visor 3D */}
      <Card>
        <CardContent className="p-0">
          <div
            ref={mountRef}
            className="relative w-full h-[500px] bg-black rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onWheel={handleWheel}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            )}
            
            {mode === 'place' && ghostPosition && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm z-10">
                θ: {ghostPosition.theta}°, φ: {ghostPosition.phi}°
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Controles */}
      <ArrowPlacementControls
        mode={mode}
        onModeChange={setMode}
        targetHotspot={targetHotspot}
        onTargetChange={setTargetHotspot}
        availableTargets={availableTargets}
        existingPoints={points}
        onDeletePoint={deleteArrow}
        onEditPoint={startEditingPoint}
        disabled={loading}
      />
    </div>
  );
};

// Helpers
function createArrowMesh(style?: NavigationPoint['style'], isGhost: boolean = false) {
  const color = isGhost ? '#10B981' : (style?.color || '#4F46E5');
  const size = style?.size || 1.0;
  const opacity = isGhost ? 0.6 : 0.9;
  
  const group = new THREE.Group();
  
  const coneGeometry = new THREE.ConeGeometry(5 * size, 15 * size, 8);
  const coneMaterial = new THREE.MeshBasicMaterial({ 
    color,
    transparent: true,
    opacity
  });
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.position.y = 10 * size;
  cone.rotation.x = Math.PI;
  
  const cylinderGeometry = new THREE.CylinderGeometry(2 * size, 2 * size, 10 * size);
  const cylinder = new THREE.Mesh(cylinderGeometry, coneMaterial);
  
  const circleGeometry = new THREE.CircleGeometry(8 * size, 32);
  const circleMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: opacity * 0.5,
    side: THREE.DoubleSide
  });
  const circle = new THREE.Mesh(circleGeometry, circleMaterial);
  circle.position.y = -5 * size;
  circle.rotation.x = Math.PI / 2;
  
  group.add(cone, cylinder, circle);
  group.userData.isNavigationArrow = true;
  
  return group;
}

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

function disposeObject(obj: THREE.Object3D) {
  if (obj instanceof THREE.Mesh) {
    obj.geometry.dispose();
    if (Array.isArray(obj.material)) {
      obj.material.forEach(m => m.dispose());
    } else {
      obj.material.dispose();
    }
  } else if (obj instanceof THREE.Sprite) {
    if (obj.material.map) obj.material.map.dispose();
    obj.material.dispose();
  } else if (obj instanceof THREE.Group) {
    obj.children.forEach(child => disposeObject(child));
  }
}
