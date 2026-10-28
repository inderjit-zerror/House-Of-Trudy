"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";

// "Marble Bust 01" by Rico Cilliers, Poly Haven (CC0).
const MODEL_URL = "/models/marble-bust/marble_bust_01_2k.gltf";
useGLTF.preload(MODEL_URL);

// The shots are framed for a 16:9 screen; other shapes are cropped like
// `object-fit: cover`, as the reference's pre-rendered frames are.
const FRAME_ASPECT = 16 / 9;
const FRAME_FOV = 24;

// Shots over the statue's scroll progress (0 → 1), matched to the
// reference's frames: it starts on the front, turns its right shoulder
// towards the camera, looks down on its shoulders and back from close up,
// then pulls out and settles on a three-quarter view of its left side,
// just left of centre. The statue turns on a turntable under fixed lights,
// so every side of it stays lit.
// azimuth and elevation in degrees, distances in metres (the bust is 0.52m).
const SHOTS = [
  { at: 0, azimuth: -4, elevation: 2, distance: 1.5, height: 0.252, shift: 0 },
  { at: 0.095, azimuth: -15, elevation: 4, distance: 1.36, height: 0.262, shift: 0 },
  { at: 0.186, azimuth: -28, elevation: 8, distance: 1.1, height: 0.275, shift: -0.01 },
  { at: 0.272, azimuth: -45, elevation: 13, distance: 0.92, height: 0.27, shift: -0.025 },
  { at: 0.355, azimuth: -72, elevation: 20, distance: 0.78, height: 0.245, shift: -0.04 },
  { at: 0.395, azimuth: -95, elevation: 24, distance: 0.68, height: 0.23, shift: -0.035 },
  { at: 0.433, azimuth: -130, elevation: 28, distance: 0.6, height: 0.215, shift: -0.02 },
  { at: 0.472, azimuth: -163, elevation: 30, distance: 0.56, height: 0.2, shift: -0.01 },
  { at: 0.509, azimuth: -182, elevation: 30, distance: 0.6, height: 0.205, shift: 0 },
  { at: 0.545, azimuth: -200, elevation: 25, distance: 0.74, height: 0.225, shift: 0.03 },
  { at: 0.58, azimuth: -215, elevation: 18, distance: 0.98, height: 0.25, shift: 0.07 },
  { at: 0.614, azimuth: -226, elevation: 12, distance: 1.1, height: 0.26, shift: 0.06 },
  { at: 0.647, azimuth: -240, elevation: 9, distance: 1.16, height: 0.265, shift: 0.045 },
  { at: 0.71, azimuth: -261, elevation: 6, distance: 1.2, height: 0.27, shift: 0.035 },
  { at: 0.769, azimuth: -284, elevation: 4, distance: 1.22, height: 0.27, shift: 0.025 },
  { at: 0.87, azimuth: -306, elevation: 3, distance: 1.24, height: 0.27, shift: 0.012 },
  { at: 1, azimuth: -318, elevation: 2, distance: 1.26, height: 0.27, shift: 0.01 },
];

// Monotone cubic interpolation, so the camera eases through each shot
// without overshooting it.
function monotone(xs, ys) {
  const n = xs.length;
  const slopes = [];
  for (let i = 0; i < n - 1; i++) slopes.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const tangents = [slopes[0]];
  for (let i = 1; i < n - 1; i++) {
    tangents.push(slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2);
  }
  tangents.push(slopes[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      tangents[i] = k * a * slopes[i];
      tangents[i + 1] = k * b * slopes[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * tangents[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * tangents[i + 1]
    );
  };
}

const shotAt = Object.fromEntries(
  ["azimuth", "elevation", "distance", "height", "shift"].map((key) => [
    key,
    monotone(
      SHOTS.map((shot) => shot.at),
      SHOTS.map((shot) => shot[key])
    ),
  ])
);

function Statue() {
  const { scene } = useGLTF(MODEL_URL);

  const statue = useMemo(() => {
    const root = scene.clone();
    // Stand the bust on the origin so it turns about its own axis.
    const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;

    root.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      // The roughness texture packs AO in red; use it. Lift the stone towards
      // a clean white marble with a satin finish.
      child.material.aoMap = child.material.roughnessMap;
      child.material.color.setScalar(1.15);
      child.material.roughness = 0.8;
      child.material.envMapIntensity = 0.6;
      child.material.needsUpdate = true;
    });
    return root;
  }, [scene]);

  return <primitive object={statue} />;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.05} />
      <directionalLight
        position={[-1.3, 1.7, 1.5]}
        intensity={4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.015}
      >
        <orthographicCamera attach="shadow-camera" args={[-0.6, 0.6, 0.6, -0.6, 0.1, 6]} />
      </directionalLight>
      <directionalLight position={[1.6, 0.8, -1.2]} intensity={0.6} />
      <Environment resolution={256} frames={1}>
        {/* Lightformers face the origin by default. */}
        <Lightformer intensity={1.6} position={[0, 4, 1]} scale={[6, 6, 1]} />
        <Lightformer intensity={2.4} position={[-3, 1.5, 2.5]} scale={[2.5, 5, 1]} />
        <Lightformer intensity={0.7} position={[3, 1, -2]} scale={[2, 4, 1]} />
        <Lightformer intensity={0.3} position={[0, -3, 0]} scale={[6, 6, 1]} />
      </Environment>
    </>
  );
}

const lookAt = new THREE.Vector3();

// Turns the statue and places the camera for the current point on the path.
function Turntable({ motion }) {
  const turntable = useRef(null);

  useFrame(({ camera, size }) => {
    const aspect = size.width / size.height;
    const fov =
      aspect > FRAME_ASPECT
        ? THREE.MathUtils.radToDeg(
            2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(FRAME_FOV / 2)) * FRAME_ASPECT) / aspect)
          )
        : FRAME_FOV;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const t = motion.current.statue;
    const elevation = THREE.MathUtils.degToRad(shotAt.elevation(t));
    const distance = shotAt.distance(t);
    // Moving the camera and its target sideways together slides the statue
    // across the frame without turning it.
    const shift = shotAt.shift(t);

    turntable.current.rotation.y = -THREE.MathUtils.degToRad(shotAt.azimuth(t));
    lookAt.set(shift, shotAt.height(t), 0);
    camera.position.set(
      shift,
      lookAt.y + Math.sin(elevation) * distance,
      Math.cos(elevation) * distance
    );
    camera.lookAt(lookAt);
  });

  return (
    <group ref={turntable}>
      <Statue />
    </group>
  );
}

// Renders on demand: a new frame only when the scroll timeline moves or
// the canvas is resized (which clears it).
function Driver({ motion }) {
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);

  useEffect(() => {
    invalidate();
  }, [size, invalidate]);

  useEffect(() => {
    let frame = 0;
    let last = -1;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (motion.current.statue !== last) {
        last = motion.current.statue;
        invalidate();
      }
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [motion, invalidate]);

  return null;
}

// Mounts once the model has loaded; waits for shaders to compile and the
// first frame to land before telling the hero to reveal the statue.
function Ready({ onReady }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let frame = 0;
    gl.compileAsync(scene, camera).then(() => {
      invalidate();
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => onReady?.());
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [gl, scene, camera, invalidate, onReady]);

  return null;
}

export default function StatueCanvas({ motion, onReady }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      shadows
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: FRAME_FOV, near: 0.01, far: 20, position: [0, 0.3, 1.4] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      <Suspense fallback={null}>
        <Lights />
        <Turntable motion={motion} />
        <Driver motion={motion} />
        <Ready onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
