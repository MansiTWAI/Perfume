import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import NoteField from './NoteField';
import { useStore } from '../../context/StoreContext';

// On the home stage the notes circle the bottle beside the copy on wide
// screens (to its right in English, to its left in Arabic) and above it on
// phones; this matches the placement of .opening-product.
function Placement({ stage, mirror, children }) {
  const { viewport, size } = useThree();
  const narrow = viewport.aspect < 1;
  const side = mirror ? -1 : 1;
  // 24% of the width from centre, but never more than 400px.
  const frac = Math.min(0.24, 400 / size.width);
  const pos = !stage ? [0, 0.08, 0] : narrow ? [0, 0.5, 0] : [side * viewport.width * frac, -0.12, 0];
  const scale = !stage ? 1 : narrow ? Math.min(viewport.width / 2.3, 0.72) : 0.9;
  return (
    <group position={pos} scale={scale}>
      {children}
    </group>
  );
}

// Lights rise from darkness when the scene first appears.
function Reveal({ onReady, calm }) {
  const { scene } = useThree();
  const start = useRef(null);
  const ready = useRef(onReady);
  useEffect(() => {
    scene.environmentIntensity = 0;
    ready.current?.();
  }, [scene]);
  useFrame((state) => {
    if (start.current === null) start.current = state.clock.elapsedTime;
    const k = calm ? 1 : Math.min((state.clock.elapsedTime - start.current) / 2.4, 1);
    scene.environmentIntensity = 1.1 * (1 - Math.pow(1 - k, 3));
  });
  return null;
}

// The fragrance notes in 3D, drawn on a transparent canvas layered around a
// product render: one canvas behind it (side="back"), one in front ("front").
export default function NotesScene({ variant = 'zafreon', progress, stage = false, side = 'all', radius = 1, emerge = true, calm = false, active = true, onReady }) {
  const { dir } = useStore();
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.2, 5], fov: 30 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <Reveal onReady={onReady} calm={calm} />
      <ambientLight intensity={0.08} />
      <spotLight position={[3, 4, 3]} angle={0.4} penumbra={0.9} intensity={28} color="#ffd6a0" />
      <pointLight position={[-2.5, 1.5, -2]} intensity={10} color="#ffb870" />
      <Placement stage={stage} mirror={dir === 'rtl'}>
        <NoteField progress={progress} calm={calm} variant={variant} side={side} radius={radius} emerge={emerge} />
      </Placement>
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={5} color="#ffe6c2" position={[2.2, 0.5, 1.5]} rotation-y={-Math.PI / 3} scale={[0.35, 4, 1]} />
        <Lightformer form="rect" intensity={3} color="#ffc27a" position={[-2.4, 0.5, 1]} rotation-y={Math.PI / 3} scale={[0.25, 4, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 3, 0]} rotation-x={Math.PI / 2} scale={[2, 0.5, 1]} />
      </Environment>
    </Canvas>
  );
}
