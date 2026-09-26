import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import NoteField from './NoteField';

// Proportions follow the real 100 ml flacon: a squared body with a thick
// glass base, an engraved gold collar and a faceted crystal cap.
const VARIANTS = {
  zafreon: {
    label: '/media/label-zafreon.webp',
    core: { color: '#020202', roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.9 },
    cap: '#e9e4de',
    foil: 0.8,
  },
  elarisse: {
    label: '/media/label-elarisse.webp',
    core: { color: '#9c560f', roughness: 0.1, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04, emissive: '#6e3405', emissiveIntensity: 0.8, envMapIntensity: 1.3 },
    foil: 1.1,
    cap: '#ffffff',
  },
};

const GOLD = { color: '#c9a35c', metalness: 1, roughness: 0.28 };
// Clear glass is drawn as a reflective, mostly transparent shell. It reads as
// thick glass around the dark core and renders reliably on every GPU.
// Additive blending adds only the reflections, so the glass stays clear.
// Colour is added, alpha is left untouched, so it also works over light pages.
const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
const GLASS = { ...ADD, color: '#000000', transparent: true, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false };
const CRYSTAL = { transparent: true, opacity: 0.2, roughness: 0.02, metalness: 0, clearcoat: 1, envMapIntensity: 2.5, flatShading: true, depthWrite: false, emissive: '#3a3028', emissiveIntensity: 0.6 };
const FACETS = { ...GLASS, flatShading: true, envMapIntensity: 6 };

function Bottle({ variant, progress, pointer, autoRotate }) {
  const v = VARIANTS[variant] || VARIANTS.zafreon;
  const group = useRef();
  const label = useTexture(v.label);
  label.colorSpace = THREE.SRGBColorSpace;
  label.anisotropy = 8;

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const p = progress?.get?.() ?? 0;
    const spin = autoRotate ? t * 0.18 : 0;
    // Scroll turns the bottle; the pointer tilts it gently.
    const targetY = -0.35 + p * Math.PI * 2 + spin + pointer.current.x * 0.35;
    const targetX = pointer.current.y * 0.12;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetY, 4, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetX, 4, dt);
    g.position.y = -0.3 + Math.sin(t * 0.7) * 0.03;
  });


  return (
    <group ref={group} position={[0, -0.3, 0]}>
      {/* thick clear glass shell */}
      <RoundedBox args={[1.02, 1.16, 0.5]} radius={0.07} smoothness={6} position={[0, 0, 0]}>
        <meshPhysicalMaterial {...GLASS} />
      </RoundedBox>
      {/* the fragrance itself */}
      <RoundedBox args={[0.86, 0.94, 0.36]} radius={0.04} smoothness={4} position={[0, 0.06, 0]}>
        <meshPhysicalMaterial {...v.core} />
      </RoundedBox>
      {/* gold-foil label on the front of the core */}
      <mesh position={[0, 0.07, 0.182]}>
        <planeGeometry args={[0.6, 0.68]} />
        <meshStandardMaterial map={label} emissiveMap={label} emissive="#b48a3c" emissiveIntensity={v.foil} transparent alphaTest={0.04} metalness={0.8} roughness={0.3} color="#fff0c8" envMapIntensity={1.8} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      {/* neck and engraved collar */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.08, 40]} />
        <meshStandardMaterial {...GOLD} />
      </mesh>
      <mesh position={[0, 0.74, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.17, 64]} />
        <meshStandardMaterial {...GOLD} roughness={0.38} />
      </mesh>
      {[0.66, 0.82].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.012, 12, 64]} />
          <meshStandardMaterial {...GOLD} roughness={0.18} />
        </mesh>
      ))}
      {/* faceted crystal cap */}
      <mesh position={[0, 0.99, 0]}>
        <cylinderGeometry args={[0.29, 0.31, 0.26, 8]} />
        <meshPhysicalMaterial {...CRYSTAL} color={v.cap} />
      </mesh>
      <mesh position={[0, 0.99, 0]} scale={1.002}>
        <cylinderGeometry args={[0.29, 0.31, 0.26, 8]} />
        <meshPhysicalMaterial {...FACETS} />
      </mesh>
      <mesh position={[0, 1.17, 0]}>
        <cylinderGeometry args={[0.19, 0.29, 0.08, 8]} />
        <meshPhysicalMaterial {...FACETS} />
      </mesh>
    </group>
  );
}

// On the home stage the bottle sits to the right of the copy on wide
// screens and above it on phones.
function Placement({ stage, children }) {
  const { viewport } = useThree();
  const narrow = viewport.aspect < 1;
  const pos = !stage ? [0, 0, 0] : narrow ? [0, 0.5, 0] : [Math.min(viewport.width * 0.24, 1.35), -0.12, 0];
  const scale = !stage ? 1 : narrow ? Math.min(viewport.width / 2.3, 0.72) : 0.9;
  return (
    <group position={pos} scale={scale}>
      {children}
    </group>
  );
}

// Lights rise from darkness when the scene first appears.
function Reveal({ onReady }) {
  const { scene } = useThree();
  const start = useRef(null);
  const ready = useRef(onReady);
  useEffect(() => {
    scene.environmentIntensity = 0;
    ready.current?.();
  }, [scene]);
  useFrame((state) => {
    if (start.current === null) start.current = state.clock.elapsedTime;
    const k = Math.min((state.clock.elapsedTime - start.current) / 2.4, 1);
    scene.environmentIntensity = 1.1 * (1 - Math.pow(1 - k, 3));
  });
  return null;
}

export default function BottleScene({ variant = 'zafreon', progress, interactive = false, stage = false, active = true, onReady }) {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (interactive) return;
    const move = (e) => {
      pointer.current.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / innerHeight) * 2 - 1;
    };
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, [interactive]);

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.2, 5], fov: 30 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ touchAction: interactive ? 'pan-y' : 'auto' }}
    >
      <Reveal onReady={onReady} />
      <ambientLight intensity={0.08} />
      <spotLight position={[3, 4, 3]} angle={0.4} penumbra={0.9} intensity={28} color="#ffd6a0" />
      <pointLight position={[-2.5, 1.5, -2]} intensity={10} color="#ffb870" />
      <Placement stage={stage}>
        <Bottle variant={variant} progress={progress} pointer={pointer} autoRotate={interactive} />
        <ContactShadows position={[0, -0.9, 0]} opacity={0.55} scale={4} blur={2.6} far={1.4} color="#000000" />
        {stage && <NoteField progress={progress} />}
      </Placement>
      <Environment resolution={256}>
        {/* narrow vertical strips: crisp edge highlights, dark faces */}
        <Lightformer form="rect" intensity={5} color="#ffe6c2" position={[2.2, 0.5, 1.5]} rotation-y={-Math.PI / 3} scale={[0.35, 4, 1]} />
        <Lightformer form="rect" intensity={3} color="#ffc27a" position={[-2.4, 0.5, 1]} rotation-y={Math.PI / 3} scale={[0.25, 4, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 3, 0]} rotation-x={Math.PI / 2} scale={[2, 0.5, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#b8955a" position={[0, 0, -3]} scale={[4, 3, 1]} />
      </Environment>
      {interactive && <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 2.6} maxPolarAngle={Math.PI / 1.9} rotateSpeed={0.6} />}
    </Canvas>
  );
}
