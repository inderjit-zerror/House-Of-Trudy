"use client";

import { useEffect, useRef } from "react";

// Drifting smoke, drawn in a shader instead of a looping video. The hero
// lays it over the statue at 10% with color-burn, like the reference.

const VERTEX = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;

float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.103, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
      mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x),
      u.y
    ),
    mix(
      mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
      mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x),
      u.y
    ),
    u.z
  );
}

// Time runs along z, so the smoke billows in place instead of sliding.
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 turn = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) {
    value += amplitude * noise(p);
    p = vec3(turn * p.xy, p.z * 1.7);
    amplitude *= 0.5;
  }
  return value;
}

// Dark smoke with bright cloud masses and crinkled edges.
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.y;
  float t = uTime * 0.15;

  vec2 warp = vec2(fbm(vec3(uv * 1.5, t * 0.5)), fbm(vec3(uv * 1.5 + 5.2, t * 0.5)));
  vec3 p = vec3(uv * 1.8 + 0.8 * warp, t);
  float mass = fbm(p);
  float edges = fbm(vec3(p.xy * 8.0, t * 2.0));
  float density = mass + 0.5 * (edges - 0.5);

  float haze = smoothstep(0.4, 0.62, mass) * 0.2;
  float cloud = smoothstep(0.52, 0.8, density);

  gl_FragColor = vec4(vec3(0.06 + haze + cloud * 0.5), 1.0);
}
`;

// Smoke has no fine detail, so half resolution is plenty.
const RESOLUTION_SCALE = 0.5;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

export default function FogCanvas({ className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false });
    if (!gl) return;

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    gl.useProgram(program);

    // One triangle that covers the whole viewport.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = 0;
    let visible = true;

    const draw = (now) => {
      gl.uniform1f(uTime, (now - start) / 1000 + 40);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (visible && !still) frame = requestAnimationFrame(draw);
    };

    const resize = () => {
      const width = Math.max(1, Math.round(canvas.clientWidth * RESOLUTION_SCALE));
      const height = Math.max(1, Math.round(canvas.clientHeight * RESOLUTION_SCALE));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uResolution, width, height);
      // Resizing clears the canvas; a paused fog needs repainting.
      if (still) draw(performance.now());
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) frame = requestAnimationFrame(draw);
    });
    intersection.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      intersection.disconnect();
      resizeObserver.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
