import {
  AgXToneMapping,
  type Camera,
  HalfFloatType,
  type Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RENDER } from './config';

const gradeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * The camera "film". FXAA smooths edges (measured on compressed luminance, so
 * it works on the HDR image), then a gentle split tone (cool shadows, warm
 * highlights) and a vignette in linear light, the filmic tone curve and a
 * little contrast, and fine grain on top so flat night gradients don't band.
 */
const gradeFragment = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 texel;
  uniform vec2 resolution;
  uniform float time;
  uniform float vignette;
  uniform float grain;
  uniform float contrast;
  varying vec2 vUv;

  float luma(vec3 c) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return sqrt(l / (1.0 + l));
  }
  vec3 tap(vec2 offset) {
    return texture2D(tDiffuse, vUv + offset * texel).rgb;
  }
  vec3 fxaa() {
    vec3 nw = tap(vec2(-1.0, -1.0));
    vec3 ne = tap(vec2(1.0, -1.0));
    vec3 sw = tap(vec2(-1.0, 1.0));
    vec3 se = tap(vec2(1.0, 1.0));
    vec3 m = tap(vec2(0.0));
    float lNW = luma(nw), lNE = luma(ne), lSW = luma(sw), lSE = luma(se), lM = luma(m);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    if (lMax - lMin < max(0.04, lMax * 0.12)) return m;
    vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
    float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
    dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -8.0, 8.0);
    vec3 a = 0.5 * (tap(dir * (1.0 / 3.0 - 0.5)) + tap(dir * (2.0 / 3.0 - 0.5)));
    vec3 b = a * 0.5 + 0.25 * (tap(dir * -0.5) + tap(dir * 0.5));
    float lB = luma(b);
    return (lB < lMin || lB > lMax) ? a : b;
  }
  float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
  }

  void main() {
    vec3 col = fxaa();
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col *= mix(vec3(0.9, 0.97, 1.1), vec3(1.08, 1.0, 0.9), smoothstep(0.02, 0.5, lum));
    vec2 centred = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
    col *= mix(1.0, smoothstep(1.25, 0.25, length(centred)), vignette);
    // three prepends toneMapping() (the renderer's curve) and the output colour space to this shader.
    gl_FragColor = linearToOutputTexel(vec4(toneMapping(col), 1.0));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * gl_FragColor.rgb * (3.0 - 2.0 * gl_FragColor.rgb), contrast);
    gl_FragColor.rgb += (hash(vUv * resolution + fract(time) * 100.0) - 0.5) * grain;
  }
`;

/**
 * The render pipeline: the scene goes into an HDR buffer, bright lights bleed
 * into a quarter-resolution bloom, and one last pass antialiases, grades, tone
 * maps and adds grain on the way to the screen. The scene buffer's resolution
 * adapts to the frame rate, so slower GPUs trade sharpness for a steady 60 fps.
 */
export class RenderPipeline {
  private readonly target: WebGLRenderTarget;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private readonly canvasSize = new Vector2();
  /** Share of the canvas resolution the scene renders at. */
  private scale = 1;
  private slowTime = 0;
  private fastTime = 0;

  constructor(private readonly renderer: WebGLRenderer) {
    renderer.toneMapping = AgXToneMapping; // applied once, in the grade pass
    renderer.toneMappingExposure = RENDER.exposure;
    renderer.info.autoReset = false; // count every pass's draws, not just the last one's
    this.target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), RENDER.bloomStrength, RENDER.bloomRadius, RENDER.bloomThreshold);
    // A soft knee rather than a hard cut, so lights fade into their glow.
    (this.bloom.highPassUniforms as Record<string, { value: number }>)['smoothWidth']!.value = RENDER.bloomSoftness;
    this.grade = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        texel: { value: new Vector2() },
        resolution: { value: this.canvasSize },
        time: { value: 0 },
        vignette: { value: RENDER.vignette },
        grain: { value: RENDER.grain },
        contrast: { value: RENDER.contrast },
      },
      vertexShader: gradeVertex,
      fragmentShader: gradeFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.grade);
    this.setSize(window.innerWidth, window.innerHeight);
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.renderer.getDrawingBufferSize(this.canvasSize);
    const w = Math.max(1, Math.round(this.canvasSize.x * this.scale));
    const h = Math.max(1, Math.round(this.canvasSize.y * this.scale));
    this.target.setSize(w, h);
    (this.grade.uniforms['texel']!.value as Vector2).set(1 / w, 1 / h);
    // The bloom halves whatever it's given, so this runs it from quarter resolution down.
    this.bloom.setSize(Math.round(w / 2), Math.round(h / 2));
  }

  render(scene: Scene, camera: Camera, elapsed: number, dt: number): void {
    this.adapt(dt);
    const renderer = this.renderer;
    renderer.info.reset();
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    this.bloom.render(renderer, this.target, this.target, 0, false); // adds its glow back into the target
    this.grade.uniforms['time']!.value = elapsed;
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
  }

  /** Drops the scene resolution after a run of slow frames; creeps back up after a long run of fast ones. */
  private adapt(dt: number): void {
    if (dt <= 0 || dt > 0.1) return; // hitches and throttled background tabs say nothing about the GPU
    this.slowTime = dt > 1 / 50 ? this.slowTime + dt : Math.max(0, this.slowTime - dt);
    this.fastTime = dt < 1 / 57 ? this.fastTime + dt : 0;
    let next = this.scale;
    if (this.slowTime > 1) next = Math.max(RENDER.minScale, this.scale - 0.1);
    else if (this.fastTime > 4) next = Math.min(1, this.scale + 0.05);
    if (next === this.scale) return;
    this.scale = next;
    this.slowTime = this.fastTime = 0;
    this.setSize(window.innerWidth, window.innerHeight);
  }
}
