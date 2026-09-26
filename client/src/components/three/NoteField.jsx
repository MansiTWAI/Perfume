import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles, useTexture } from '@react-three/drei';
import * as THREE from 'three';

// The fragrance pyramid in three dimensions. As the story reaches each tier,
// its materials rise out of the bottle and orbit it, passing in front of and
// behind the glass:
//   top   – saffron threads, cardamom pods, black pepper
//   heart – rose petals, frankincense tears, incense smoke
//   base  – oud wood, amber, patchouli leaves, smoke
// Scroll progress p runs 0 (opening) → 1/3 (top) → 2/3 (heart) → 1 (base).
const WINDOWS = { top: [0.18, 0.5], heart: [0.5, 0.84], base: [0.84, 1.2] };

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const weight = (tier, p) => {
  const [a, b] = WINDOWS[tier];
  return smooth(a - 0.08, a + 0.05, p) * (1 - smooth(b - 0.05, b + 0.08, p));
};

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// Orbit parameters for n instances, seeded so the layout is stable.
function orbits(n, seed, { r = [0.85, 1.35], y = [-0.7, 0.9], speed = [0.12, 0.3], scale = [0.8, 1.25] } = {}) {
  const rand = rng(seed);
  return Array.from({ length: n }, () => ({
    a: rand() * Math.PI * 2,
    r: r[0] + rand() * (r[1] - r[0]),
    y: y[0] + rand() * (y[1] - y[0]),
    s: (speed[0] + rand() * (speed[1] - speed[0])) * (rand() > 0.5 ? 1 : -1),
    k: scale[0] + rand() * (scale[1] - scale[0]),
    rx: rand() * Math.PI, ry: rand() * Math.PI, rz: rand() * Math.PI,
    spin: (rand() - 0.5) * 1.2,
    bob: rand() * Math.PI * 2,
  }));
}

function Swarm({ tier, progress, geometry, material, count, seed, opts, lift = 0, calm }) {
  const mesh = useRef();
  const key = JSON.stringify(opts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => orbits(count, seed, opts), [count, seed, key]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const w = useRef(0);

  useFrame((state, dt) => {
    const m = mesh.current;
    if (!m) return;
    const target = weight(tier, progress?.get?.() ?? 0);
    w.current = THREE.MathUtils.damp(w.current, target, 3, dt);
    m.visible = w.current > 0.01;
    if (!m.visible) return;
    const t = calm ? 0 : state.clock.elapsedTime;
    const e = w.current;
    items.forEach((it, i) => {
      if (!calm) it.a += it.s * dt;
      const r = it.r * (0.25 + 0.75 * e); // they emerge from the bottle outward
      dummy.position.set(Math.cos(it.a) * r, it.y * (0.4 + 0.6 * e) + Math.sin(t * 0.8 + it.bob) * 0.05 + lift * e, Math.sin(it.a) * r * 0.75);
      dummy.rotation.set(it.rx + t * it.spin, it.ry + t * it.spin * 0.6, it.rz);
      dummy.scale.setScalar(it.k * e);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />;
}

// Soft rising smoke made of additive sprites.
function Smoke({ tiers, progress, calm, count = 36, seed = 9 }) {
  const ref = useRef();
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,220,0.55)');
    grad.addColorStop(0.5, 'rgba(255,230,200,0.18)');
    grad.addColorStop(1, 'rgba(255,230,200,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const parts = useMemo(() => orbits(count, seed, { r: [0.1, 0.9], y: [0, 1], speed: [0.05, 0.15] }), [count, seed]);
  const w = useRef(0);

  useFrame((state, dt) => {
    const grp = ref.current;
    if (!grp) return;
    const p = progress?.get?.() ?? 0;
    const target = Math.max(...tiers.map((tier) => weight(tier, p)));
    w.current = THREE.MathUtils.damp(w.current, target, 2, dt);
    grp.visible = w.current > 0.01;
    if (!grp.visible) return;
    grp.children.forEach((s, i) => {
      const it = parts[i];
      if (!calm) it.y += dt * 0.12;
      if (it.y > 1) it.y = 0;
      it.a += it.s * dt;
      s.position.set(Math.cos(it.a) * it.r * (0.6 + it.y), 0.9 + it.y * 1.4, Math.sin(it.a) * it.r * 0.5);
      const life = Math.sin(it.y * Math.PI);
      s.material.opacity = 0.22 * life * w.current;
      s.scale.setScalar(0.5 + it.y * 1.4);
    });
  });

  return (
    <group ref={ref}>
      {parts.map((_, i) => (
        <sprite key={i}>
          <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ffe6c8" />
        </sprite>
      ))}
    </group>
  );
}

export default function NoteField({ progress, calm = false, radius = 1 }) {
  const oudTex = useTexture('/media/ing-oud.webp');
  oudTex.colorSpace = THREE.SRGBColorSpace;

  const geo = useMemo(() => {
    const thread = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.06, 0.02), new THREE.Vector3(0.07, 0.14, -0.01), new THREE.Vector3(0.05, 0.22, 0)]),
      16, 0.0075, 5, false
    );
    const pod = new THREE.SphereGeometry(0.045, 14, 10);
    pod.scale(1.7, 1, 1);
    const corn = new THREE.IcosahedronGeometry(0.026, 1);
    const petal = new THREE.SphereGeometry(0.13, 14, 10, 0, 1.3, 0, 1.25);
    const tear = new THREE.IcosahedronGeometry(0.045, 0);
    tear.scale(1, 1.35, 0.9);
    const chip = new THREE.BoxGeometry(0.19, 0.055, 0.075, 2, 1, 1);
    const drop = new THREE.IcosahedronGeometry(0.05, 1);
    drop.scale(1.2, 0.85, 1);
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.07, 0.08, 0, 0.2);
    leafShape.quadraticCurveTo(-0.07, 0.08, 0, 0);
    const leaf = new THREE.ShapeGeometry(leafShape, 8);
    return { thread, pod, corn, petal, tear, chip, drop, leaf };
  }, []);

  const mat = useMemo(
    () => ({
      saffron: new THREE.MeshStandardMaterial({ color: '#b3200c', emissive: '#4a0800', emissiveIntensity: 0.6, roughness: 0.45 }),
      cardamom: new THREE.MeshStandardMaterial({ color: '#76844a', roughness: 0.6 }),
      pepper: new THREE.MeshStandardMaterial({ color: '#1c1512', roughness: 0.75 }),
      petal: new THREE.MeshPhysicalMaterial({ color: '#6e0a18', roughness: 0.45, sheen: 1, sheenColor: new THREE.Color('#ff6f7c'), sheenRoughness: 0.5, side: THREE.DoubleSide }),
      tear: new THREE.MeshPhysicalMaterial({ color: '#e7c27c', roughness: 0.25, emissive: '#6b4310', emissiveIntensity: 0.35, clearcoat: 1, transparent: true, opacity: 0.92 }),
      oud: new THREE.MeshStandardMaterial({ map: oudTex, color: '#d8b89a', roughness: 0.8 }),
      amber: new THREE.MeshPhysicalMaterial({ color: '#9a4f0c', emissive: '#7a3a06', emissiveIntensity: 0.5, roughness: 0.12, clearcoat: 1, flatShading: true, transparent: true, opacity: 0.78 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#4a4a26', roughness: 0.7, side: THREE.DoubleSide }),
    }),
    [oudTex]
  );

  const R = (a, b) => [a * radius, b * radius];

  return (
    <group>
      <Sparkles count={70} scale={[3.4, 2.6, 2]} size={2.2} speed={calm ? 0 : 0.25} opacity={0.55} color="#d9bb86" />
      <Swarm tier="top" progress={progress} geometry={geo.thread} material={mat.saffron} count={46} seed={3} opts={{ r: R(0.75, 1.3) }} calm={calm} />
      <Swarm tier="top" progress={progress} geometry={geo.pod} material={mat.cardamom} count={12} seed={5} opts={{ r: R(0.8, 1.25) }} calm={calm} />
      <Swarm tier="top" progress={progress} geometry={geo.corn} material={mat.pepper} count={22} seed={7} opts={{ r: R(0.8, 1.35) }} calm={calm} />
      <Swarm tier="heart" progress={progress} geometry={geo.petal} material={mat.petal} count={30} seed={11} opts={{ r: R(0.8, 1.35), scale: [0.8, 1.4] }} calm={calm} />
      <Swarm tier="heart" progress={progress} geometry={geo.tear} material={mat.tear} count={16} seed={13} opts={{ r: R(0.75, 1.2) }} calm={calm} />
      <Swarm tier="base" progress={progress} geometry={geo.chip} material={mat.oud} count={18} seed={17} opts={{ r: R(0.8, 1.3), y: [-0.8, 0.4] }} lift={-0.1} calm={calm} />
      <Swarm tier="base" progress={progress} geometry={geo.drop} material={mat.amber} count={12} seed={19} opts={{ r: R(0.75, 1.2), y: [-0.6, 0.6], scale: [0.6, 1] }} calm={calm} />
      <Swarm tier="base" progress={progress} geometry={geo.leaf} material={mat.leaf} count={12} seed={23} opts={{ r: R(0.85, 1.3) }} calm={calm} />
      <Smoke tiers={['heart', 'base']} progress={progress} calm={calm} />
    </group>
  );
}
