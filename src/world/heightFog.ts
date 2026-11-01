import { ShaderChunk } from 'three';
import { ATMOSPHERE } from '../game/config';
import { STREET_Y } from './props/obstacles';

const glsl = (n: number): string => n.toFixed(6);
const { mistDensity, mistFalloff } = ATMOSPHERE;

/*
 * Replaces three's fog with a two-part night haze, for every built-in material:
 *  - a thin exponential haze everywhere (the scene's FogExp2 density, used linearly);
 *  - a ground mist that is thickest at street level and thins with height, so
 *    the streets and arches fade first while towers and landmarks rise clear.
 * The mist is integrated exactly along each view ray (exponential height fog).
 * Must be imported before any material compiles.
 */
ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogOffset;
#endif
`;

// The world-space offset from the camera: view space rotated back by the view matrix.
ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogOffset = mvPosition.xyz * mat3( viewMatrix );
#endif
`;

ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying vec3 vFogOffset;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif
`;

ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  float fogDist = length( vFogOffset );
  #ifdef FOG_EXP2
    float fogRise = vFogOffset.y * ${glsl(mistFalloff)};
    float fogAtEye = ${glsl(mistDensity)} * exp( - ( cameraPosition.y - (${glsl(STREET_Y)}) ) * ${glsl(mistFalloff)} );
    float fogSpread = abs( fogRise ) > 1e-4 ? ( 1.0 - exp( - fogRise ) ) / fogRise : 1.0;
    float fogFactor = 1.0 - exp( - fogDist * ( fogDensity + fogAtEye * fogSpread ) );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, fogDist );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;
