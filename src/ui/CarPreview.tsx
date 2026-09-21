import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Driver } from '../race/drivers';
import { buildCar, type CarRig } from '../three/car';

interface CarPreviewProps {
  driver: Driver;
}

/** Lightweight Three.js turntable used by the driver carousel. */
export function CarPreview({ driver }: CarPreviewProps) {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const rig = useRef<CarRig | null>(null);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    const previewScene = new THREE.Scene();
    scene.current = previewScene;
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(6.8, 3.2, 7.7);
    camera.lookAt(0, 0.65, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);

    previewScene.add(new THREE.HemisphereLight('#dcebff', '#14213d', 2.2));
    const key = new THREE.DirectionalLight('#fff4de', 4.2);
    key.position.set(5, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    previewScene.add(key);
    const rim = new THREE.DirectionalLight('#4d8fff', 3.2);
    rim.position.set(-6, 3, -4);
    previewScene.add(rim);

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: '#162541',
      roughness: 0.86,
      transparent: true,
      opacity: 0.82,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5.6, 64), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    previewScene.add(floor);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new THREE.Clock();
    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      const elapsed = clock.getElapsedTime();
      if (rig.current) {
        rig.current.group.rotation.y = 0.55 + Math.sin(elapsed * 0.55) * 0.18;
        rig.current.group.position.y = Math.sin(elapsed * 1.6) * 0.025;
      }
      renderer.render(previewScene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.current = null;
      rig.current = null;
      floor.geometry.dispose();
      floorMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const previewScene = scene.current;
    if (!previewScene) return;
    if (rig.current) previewScene.remove(rig.current.group);

    const next = buildCar(driver.colors[0], driver.colors[1], driver.accent, driver.model);
    next.group.rotation.y = 0.55;
    next.group.scale.setScalar(driver.model ? 1.38 : 1.18);
    previewScene.add(next.group);
    rig.current = next;

    return () => {
      previewScene.remove(next.group);
      if (rig.current === next) rig.current = null;
    };
  }, [driver]);

  return (
    <div
      className="car-preview"
      ref={mount}
      role="img"
      aria-label={`Vista 3D del auto de ${driver.name}`}
    />
  );
}
