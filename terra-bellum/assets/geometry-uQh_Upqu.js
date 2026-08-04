import{M as De,Z as Be,b as W,F as A,a as P,_ as te,m as D,$ as J,a0 as ee,a1 as Ee,a2 as Fe,C as S,V as C,A as G,Y as Ne,a3 as Ue,a4 as Ge,a5 as Oe,a6 as Ie,a7 as He,a8 as ke,a9 as Me,aa as Le,ab as We,p as Ve,q as Qe,l as X,w as ce,N as Te,ac as $e,j as je,c as k,g as Ke,D as xe,I as qe,z as K,t as Xe,O as Ae,s as _e,ad as Ye,u as Ze,J as Je}from"./three-DGYFdwI7.js";import{aH as E,$ as q}from"./index-DY3nRUHA.js";const Re={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class V{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const et=new Be(-1,1,1,-1,0,1);class tt extends W{constructor(){super(),this.setAttribute("position",new A([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new A([0,2,0,0,2,0],2))}}const it=new tt;class he{constructor(e){this._mesh=new De(it,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,et)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class Pe extends V{constructor(e,t){super(),this.textureID=t!==void 0?t:"tDiffuse",e instanceof P?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=te.clone(e.uniforms),this.material=new P({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this.fsQuad=new he(this.material)}render(e,t,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this.fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}class be extends V{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,i){const a=e.getContext(),s=e.state;s.buffers.color.setMask(!1),s.buffers.depth.setMask(!1),s.buffers.color.setLocked(!0),s.buffers.depth.setLocked(!0);let r,u;this.inverse?(r=0,u=1):(r=1,u=0),s.buffers.stencil.setTest(!0),s.buffers.stencil.setOp(a.REPLACE,a.REPLACE,a.REPLACE),s.buffers.stencil.setFunc(a.ALWAYS,r,4294967295),s.buffers.stencil.setClear(u),s.buffers.stencil.setLocked(!0),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),s.buffers.color.setLocked(!1),s.buffers.depth.setLocked(!1),s.buffers.color.setMask(!0),s.buffers.depth.setMask(!0),s.buffers.stencil.setLocked(!1),s.buffers.stencil.setFunc(a.EQUAL,1,4294967295),s.buffers.stencil.setOp(a.KEEP,a.KEEP,a.KEEP),s.buffers.stencil.setLocked(!0)}}class ot extends V{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class at{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const i=e.getSize(new D);this._width=i.width,this._height=i.height,t=new J(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:ee}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Pe(Re),this.copyPass.material.blending=Ee,this.clock=new Fe}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const t=this.renderer.getRenderTarget();let i=!1;for(let a=0,s=this.passes.length;a<s;a++){const r=this.passes[a];if(r.enabled!==!1){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(a),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,i),r.needsSwap){if(i){const u=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(u.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(u.EQUAL,1,4294967295)}this.swapBuffers()}be!==void 0&&(r instanceof be?i=!0:r instanceof ot&&(i=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new D);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const i=this._width*this._pixelRatio,a=this._height*this._pixelRatio;this.renderTarget1.setSize(i,a),this.renderTarget2.setSize(i,a);for(let s=0;s<this.passes.length;s++)this.passes[s].setSize(i,a)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class st extends V{constructor(e,t,i=null,a=null,s=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=i,this.clearColor=a,this.clearAlpha=s,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new S}render(e,t,i){const a=e.autoClear;e.autoClear=!1;let s,r;this.overrideMaterial!==null&&(r=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(s=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:i),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(s),this.overrideMaterial!==null&&(this.scene.overrideMaterial=r),e.autoClear=a}}const rt={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new S(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class L extends V{constructor(e,t,i,a){super(),this.strength=t!==void 0?t:1,this.radius=i,this.threshold=a,this.resolution=e!==void 0?new D(e.x,e.y):new D(256,256),this.clearColor=new S(0,0,0),this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let s=Math.round(this.resolution.x/2),r=Math.round(this.resolution.y/2);this.renderTargetBright=new J(s,r,{type:ee}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let c=0;c<this.nMips;c++){const d=new J(s,r,{type:ee});d.texture.name="UnrealBloomPass.h"+c,d.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(d);const f=new J(s,r,{type:ee});f.texture.name="UnrealBloomPass.v"+c,f.texture.generateMipmaps=!1,this.renderTargetsVertical.push(f),s=Math.round(s/2),r=Math.round(r/2)}const u=rt;this.highPassUniforms=te.clone(u.uniforms),this.highPassUniforms.luminosityThreshold.value=a,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new P({uniforms:this.highPassUniforms,vertexShader:u.vertexShader,fragmentShader:u.fragmentShader}),this.separableBlurMaterials=[];const l=[3,5,7,9,11];s=Math.round(this.resolution.x/2),r=Math.round(this.resolution.y/2);for(let c=0;c<this.nMips;c++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(l[c])),this.separableBlurMaterials[c].uniforms.invSize.value=new D(1/s,1/r),s=Math.round(s/2),r=Math.round(r/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const m=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=m,this.bloomTintColors=[new C(1,1,1),new C(1,1,1),new C(1,1,1),new C(1,1,1),new C(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors;const n=Re;this.copyUniforms=te.clone(n.uniforms),this.blendMaterial=new P({uniforms:this.copyUniforms,vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,blending:G,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new S,this.oldClearAlpha=1,this.basic=new Ne,this.fsQuad=new he(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this.basic.dispose(),this.fsQuad.dispose()}setSize(e,t){let i=Math.round(e/2),a=Math.round(t/2);this.renderTargetBright.setSize(i,a);for(let s=0;s<this.nMips;s++)this.renderTargetsHorizontal[s].setSize(i,a),this.renderTargetsVertical[s].setSize(i,a),this.separableBlurMaterials[s].uniforms.invSize.value=new D(1/i,1/a),i=Math.round(i/2),a=Math.round(a/2)}render(e,t,i,a,s){e.getClearColor(this._oldClearColor),this.oldClearAlpha=e.getClearAlpha();const r=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),s&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=i.texture,e.setRenderTarget(null),e.clear(),this.fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this.fsQuad.render(e);let u=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this.fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=u.texture,this.separableBlurMaterials[l].uniforms.direction.value=L.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this.fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=L.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this.fsQuad.render(e),u=this.renderTargetsVertical[l];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this.fsQuad.render(e),this.fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,s&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(i),this.fsQuad.render(e)),e.setClearColor(this._oldClearColor,this.oldClearAlpha),e.autoClear=r}getSeperableBlurMaterial(e){const t=[];for(let i=0;i<e;i++)t.push(.39894*Math.exp(-.5*i*i/(e*e))/e);return new P({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new D(.5,.5)},direction:{value:new D(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}getCompositeMaterial(e){return new P({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}L.BlurDirectionX=new D(1,0);L.BlurDirectionY=new D(0,1);const nt={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class lt extends V{constructor(){super();const e=nt;this.uniforms=te.clone(e.uniforms),this.material=new Ue({name:e.name,uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader}),this.fsQuad=new he(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Ge.getTransfer(this._outputColorSpace)===Oe&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Ie?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===He?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===ke?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Me?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===Le?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===We&&(this.material.defines.NEUTRAL_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}const ut=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,ct=`
precision highp float;

uniform sampler2D tDiffuse;
uniform vec2  uResolution;
uniform float uTime;
uniform float uStrength;
uniform float uChromatic;
uniform float uScanline;
uniform float uGrain;
uniform float uVignette;
uniform vec3  uHoloTint;
uniform float uHoloLift;

varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = vUv;
  vec2 centred = uv - 0.5;
  float r2 = dot(centred, centred);

  // ── 1. chromatic aberration, zero at the centre, strongest at the corners
  float ca = uChromatic * uStrength * (0.35 + 2.6 * r2);
  vec2 dir = centred * 2.0;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + dir * ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - dir * ca).b;

  // ── 2. hologram lift: shadows drift toward cold cyan.
  //      The buffer is still LINEAR here, so this stays deliberately tiny —
  //      a few thousandths already reads as a visible phosphor bleed.
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float shadow = 1.0 - smoothstep(0.0, 0.08, lum);
  col += uHoloTint * shadow * uHoloLift * uStrength;

  // ── 3. rolling scanlines (two frequencies so they never look like a moire)
  float lines = sin((uv.y * uResolution.y * 0.85) - uTime * 14.0);
  float roll = sin((uv.y * 2.4) - uTime * 0.35);
  float scan = (lines * 0.5 + 0.5) * (0.75 + 0.25 * (roll * 0.5 + 0.5));
  col *= 1.0 - uScanline * uStrength * scan;

  // a single bright sweep bar crawling down the panel
  float bar = smoothstep(0.986, 1.0, sin(uv.y * 3.0 - uTime * 0.22));
  col += uHoloTint * bar * 0.012 * uStrength;

  // ── 4. animated film grain
  float g = hash12(uv * uResolution + fract(uTime) * 977.0);
  col += (g - 0.5) * uGrain * uStrength;

  // ── 5. vignette + corner darkening
  // (written as 1 - smoothstep(lo, hi, x); a descending smoothstep is
  //  undefined in the GLSL ES spec even though most drivers tolerate it)
  float vig = 1.0 - smoothstep(0.18, 0.90, r2 * 2.2);
  col *= mix(1.0, vig, uVignette * uStrength);

  // faint edge falloff so the panel reads as glass behind a bezel
  float edge = smoothstep(0.0, 0.09, uv.x) * (1.0 - smoothstep(0.91, 1.0, uv.x))
             * smoothstep(0.0, 0.06, uv.y) * (1.0 - smoothstep(0.94, 1.0, uv.y));
  col *= mix(1.0, 0.72 + 0.28 * edge, 0.5 * uStrength);

  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;function ht(o,e){const t=new D;o.getSize(t);const i=Math.max(1,t.x),a=Math.max(1,t.y),s=new at(o);s.setPixelRatio(o.getPixelRatio()),s.setSize(i,a);const r=new Ve,u=new Qe,l=new st(r,u);s.addPass(l);const m=e==="low",n=e==="medium",c=m?E.lowBloomStrength:n?(E.bloomStrength+E.lowBloomStrength)*.5:E.bloomStrength,d=m?E.bloomRadius*.7:E.bloomRadius,f=new L(new D(i,a),c,d,E.bloomThreshold);s.addPass(f);const p=m?.55:n?.8:1,h=new Pe({uniforms:{tDiffuse:{value:null},uResolution:{value:new D(i,a)},uTime:{value:0},uStrength:{value:1},uChromatic:{value:E.chromatic*p},uScanline:{value:E.scanlineIntensity*p},uGrain:{value:E.grain*p},uVignette:{value:E.vignette},uHoloTint:{value:new S(5104639)},uHoloLift:{value:m?.006:.011}},vertexShader:ut,fragmentShader:ct});h.material.name="tb.consoleComposite",s.addPass(h);const v=new lt;s.addPass(v);const g={composer:s,renderPass:l,bloom:f,composite:h,output:v,strength:1,setScene(x,b){l.scene=x,l.camera=b},setStrength(x){const b=Math.max(0,x);g.strength=b,h.uniforms.uStrength.value=b,f.strength=c*(.55+.45*Math.min(2,b))},setSize(x,b,w){s.setPixelRatio(w),s.setSize(x,b),f.resolution.set(x,b),h.uniforms.uResolution.value.set(x*w,b*w)},update(x){h.uniforms.uTime.value=x},dispose(){s.dispose(),f.dispose(),h.material.dispose(),h.fsQuad.dispose(),v.dispose(),r.clear()}};return g.setSize(i,a,o.getPixelRatio()),g}const le=new Set;function N(o,e){const t=o;t.update=a=>{t.uniforms.uTime&&(t.uniforms.uTime.value=a)};const i=P.prototype.dispose;return t.dispose=function(){le.delete(this),i.call(this)},le.add(t),t}function ft(o){M.uTime.value=o;for(const e of le)e.update(o)}const U={keyDir:new C(-.42,.86,.3).normalize(),keyColor:8379647,keyIntensity:1.05,rimDir:new C(.66,.3,-.68).normalize(),rimColor:16757575,rimIntensity:.55,hemiSky:2772088,hemiGround:329743,hemiIntensity:.55,sunDistance:140},M={uTime:{value:0},uCamPos:{value:new C},uKeyDir:{value:U.keyDir.clone()},uKeyColor:{value:new S(U.keyColor).multiplyScalar(U.keyIntensity)},uRimDir:{value:U.rimDir.clone()},uRimColor:{value:new S(U.rimColor).multiplyScalar(U.rimIntensity)},uAmbTop:{value:new S(U.hemiSky).multiplyScalar(.46)},uAmbBottom:{value:new S(U.hemiGround).multiplyScalar(1.4)},uFog:{value:new S(q.void)},uFogNear:{value:58},uFogFar:{value:210}};function mt(o){M.uCamPos.value.copy(o)}function fe(){return{uTime:M.uTime,uCamPos:M.uCamPos,uKeyDir:M.uKeyDir,uKeyColor:M.uKeyColor,uRimDir:M.uRimDir,uRimColor:M.uRimColor,uAmbTop:M.uAmbTop,uAmbBottom:M.uAmbBottom,uFog:M.uFog,uFogNear:M.uFogNear,uFogFar:M.uFogFar}}const me=`
uniform float uTime;
uniform vec3  uCamPos;
uniform vec3  uKeyDir;
uniform vec3  uKeyColor;
uniform vec3  uRimDir;
uniform vec3  uRimColor;
uniform vec3  uAmbTop;
uniform vec3  uAmbBottom;
uniform vec3  uFog;
uniform float uFogNear;
uniform float uFogFar;
`,ie=`
float tbHash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float tbHash21(vec2 p){
  vec3 p3 = fract(vec3(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float tbHash31(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float tbNoise2(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tbHash21(i), tbHash21(i + vec2(1.0, 0.0)), u.x),
             mix(tbHash21(i + vec2(0.0, 1.0)), tbHash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float tbNoise3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = tbHash31(i);
  float n100 = tbHash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = tbHash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = tbHash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = tbHash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = tbHash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = tbHash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = tbHash31(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float tbFbm2(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * tbNoise2(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
float tbFbm3(vec3 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * tbNoise3(p); p = p * 2.02 + 11.3; a *= 0.5; }
  return v;
}
/** Hex distance in local hex space; 1.0 exactly on the pointy-top boundary. */
float tbHexDist(vec2 p){ return max(abs(p.y), abs(p.y) * 0.5 + abs(p.x) * 0.8660254); }
`,ze=`
vec4 tbBillboard(mat4 im, vec2 quad, vec2 size) {
  vec4 world = modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 mv = viewMatrix * world;
  mv.xy += quad * size;
  return projectionMatrix * mv;
}
`,Q=`
mat4 tbInstanceMatrix() {
  #ifdef USE_INSTANCING
    return instanceMatrix;
  #else
    return mat4(1.0);
  #endif
}
`,dt=`
${Q}

attribute float aFace;
attribute vec3  iColor;
attribute vec3  iOwner;
attribute vec4  iState;
attribute float iSeed;

varying vec3  vTerrain;
varying vec3  vOwner;
varying vec4  vState;
varying float vSeed;
varying float vGas;
varying float vFace;
varying vec2  vHexUv;
varying vec3  vWorld;
varying vec3  vNrm;

void main() {
  mat4 im = tbInstanceMatrix();
  float sy = max(length(im[1].xyz), 0.0001);

  vec4 world = modelMatrix * im * vec4(position, 1.0);
  vWorld = world.xyz;

  // Instances only carry translation + non-uniform Y scale, so the normal is
  // corrected analytically rather than with a full inverse-transpose.
  vec3 n = normalize(vec3(normal.x, normal.y / sy, normal.z));
  vNrm = normalize((modelMatrix * vec4(n, 0.0)).xyz);

  vHexUv = uv;
  vFace = aFace;
  vTerrain = iColor;
  vOwner = iOwner;
  vState = iState;
  vGas = step(1.5, iSeed);
  vSeed = fract(iSeed);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`,vt=`
precision highp float;
${me}
uniform vec3  uNeutral;
uniform float uStrength;
uniform float uSweepSpeed;

varying vec3  vTerrain;
varying vec3  vOwner;
varying vec4  vState;
varying float vSeed;
varying float vGas;
varying float vFace;
varying vec2  vHexUv;
varying vec3  vWorld;
varying vec3  vNrm;

${ie}

void main() {
  vec3 N = normalize(vNrm);
  vec3 V = normalize(uCamPos - vWorld);

  float topM  = step(0.75, vFace);          // flat top only
  float faceM = step(0.25, vFace);          // top + bevel

  float owned  = vState.x;
  float fort   = vState.y;
  float cap    = clamp(vState.z, 0.0, 1.0);
  float locked = clamp(vState.w, 0.0, 1.0);

  // ── base plate ────────────────────────────────────────────────────────────
  vec3 albedo = vTerrain * mix(0.30, 1.0, topM);
  albedo *= 0.86 + 0.30 * vSeed;
  float micro = tbNoise2(vWorld.xz * 5.5 + vSeed * 41.0);
  albedo *= 1.0 + 0.16 * (micro - 0.5) * topM;

  vec3 K = normalize(uKeyDir);
  vec3 R = normalize(uRimDir);
  float ndl = max(dot(N, K), 0.0);
  float ndr = max(dot(N, R), 0.0);
  vec3 amb = mix(uAmbBottom, uAmbTop, N.y * 0.5 + 0.5);

  vec3 col = albedo * amb;
  col += albedo * uKeyColor * ndl * 0.62;
  col += albedo * uRimColor * ndr * 0.22;

  // brushed-metal specular
  vec3 H = normalize(K + V);
  float spec = pow(max(dot(N, H), 0.0), 58.0);
  col += uKeyColor * spec * (0.035 + 0.10 * topM);

  // ── fresnel rim, tinted by the owning guild ───────────────────────────────
  // Kept deliberately modest: the field is thousands of instances and the
  // bloom pass sums all of them, so a "pretty" single-hex value floods.
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  vec3 rimCol = mix(uNeutral, vOwner, owned);
  col += rimCol * fres * (0.05 + 0.17 * owned) * uStrength;

  // ── slow holographic sweep across the whole field, in world space ─────────
  float sweepPhase = (vWorld.x * 0.105 + vWorld.z * 0.185) - uTime * uSweepSpeed;
  float sweep = smoothstep(0.982, 1.0, sin(sweepPhase));
  col += vec3(0.16, 0.62, 0.92) * sweep * 0.20 * uStrength;
  col *= 1.0 + 0.035 * (0.5 + 0.5 * sin(vWorld.z * 7.5 - uTime * 0.85));

  // ── local hex coordinates (top face + bevel) ──────────────────────────────
  vec2 p = vHexUv * 2.0 - 1.0;
  float hd = tbHexDist(p);
  float angN = atan(p.y, p.x) * 0.15915494 + 0.5;

  // rim band wrapping the top edge onto the bevel
  float band = smoothstep(0.80, 0.90, hd) * (1.0 - smoothstep(1.04, 1.18, hd));
  band *= faceM;

  // ── animated edge trace on owned hexes ────────────────────────────────────
  float travel = fract(angN - uTime * 0.10 + vSeed);
  float head = pow(smoothstep(0.78, 1.0, travel), 2.0);
  col += vOwner * band * owned * (0.09 + 0.62 * head) * uStrength;

  // ── fortification tier ring ───────────────────────────────────────────────
  float fRing = smoothstep(0.29, 0.335, hd) * (1.0 - smoothstep(0.40, 0.45, hd));
  col += vOwner * fRing * topM * step(0.5, fort) * (0.06 + 0.06 * fort);

  // ── rotating radial capture wipe ──────────────────────────────────────────
  float capOn = step(0.002, cap);
  float wipe = fract(angN + uTime * 0.075);
  float inside = step(wipe, cap);
  float edge = inside * smoothstep(cap - 0.05, cap, wipe);
  vec3 capCol = mix(vec3(1.0, 0.62, 0.20), vOwner, 0.4);
  col += capCol * capOn * (
      inside * faceM * 0.10 * (0.6 + 0.4 * sin(uTime * 5.2))
    + edge   * faceM * 0.62
    + band   * 0.22
  );

  // ── volatile gas vent pulse ───────────────────────────────────────────────
  float gp = 0.5 + 0.5 * sin(uTime * 1.35 + vSeed * 25.0);
  float inner = 1.0 - smoothstep(0.05, 0.80, hd);
  col += vec3(0.18, 1.0, 0.76) * vGas * topM * inner * (0.035 + 0.09 * gp);

  // ── locked sector: desaturate, fog, dissolve, ghost grid ──────────────────
  if (locked > 0.002) {
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 dead = mix(col, vec3(lum) * 0.65, 0.92);
    float nz = tbFbm2(vWorld.xz * 0.55 + uTime * 0.018);
    float diss = smoothstep(0.32, 0.72, nz + 0.18 * sin(uTime * 0.45 + vSeed * 33.0));
    dead = mix(dead, vec3(0.026, 0.038, 0.066), 0.42 + 0.44 * diss);
    vec2 g = abs(fract(vWorld.xz * 1.05) - 0.5);
    float grid = 1.0 - smoothstep(0.0, 0.05, min(g.x, g.y));
    dead += vec3(0.08, 0.26, 0.42) * grid * topM * (0.42 - 0.34 * diss);
    dead += vec3(0.08, 0.26, 0.42) * band * 0.30;
    col = mix(col, dead, locked);
  }

  // ── depth haze into the void ──────────────────────────────────────────────
  float dist = length(uCamPos - vWorld);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, dist));

  gl_FragColor = vec4(col, 1.0);
}
`;function Rt(){const o=new P({uniforms:{...fe(),uNeutral:{value:new S(q.edge).multiplyScalar(1.6)},uStrength:{value:1},uSweepSpeed:{value:.42}},vertexShader:dt,fragmentShader:vt,side:ce,transparent:!1});return o.name="tb.hex",N(o)}function Pt(o){const e=new P({uniforms:{uTime:M.uTime,uColor:{value:new S(o)},uOpacity:{value:1},uScroll:{value:.34},uHeightFade:{value:.9}},vertexShader:`
      ${Q}
      attribute float aIntensity;
      attribute vec3 aTint;
      varying vec2 vUvC;
      varying float vI;
      varying vec3 vTint;
      varying vec3 vWorld;
      void main() {
        vUvC = uv;
        vI = aIntensity;
        vTint = aTint;
        vec4 world = modelMatrix * tbInstanceMatrix() * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,fragmentShader:`
      precision highp float;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uScroll;
      uniform float uHeightFade;
      varying vec2 vUvC;
      varying float vI;
      varying vec3 vTint;
      varying vec3 vWorld;
      ${ie}
      void main() {
        float top = 1.0 - smoothstep(0.05, uHeightFade, vUvC.y);
        float n1 = tbFbm2(vec2(vUvC.x * 7.0, vUvC.y * 2.2 - uTime * uScroll));
        float n2 = tbNoise2(vec2(vUvC.x * 21.0 + 5.0, vUvC.y * 5.0 - uTime * uScroll * 1.9));
        float stripes = 0.62 + 0.38 * sin(vUvC.x * 220.0 + uTime * 1.4);
        float base = smoothstep(0.0, 0.10, vUvC.y);
        float a = top * (0.30 + 0.70 * n1) * (0.55 + 0.60 * n2) * stripes;
        a *= mix(0.35, 1.0, base);
        a *= uOpacity * vI * (0.78 + 0.22 * sin(uTime * 1.9 + vWorld.x * 0.2));
        if (a <= 0.002) discard;
        vec3 c = uColor * vTint * (1.0 + n1 * 0.85 + top * 0.5);
        gl_FragColor = vec4(c, a);
      }
    `,transparent:!0,blending:G,depthWrite:!1,side:X});return e.name="tb.energy",N(e)}function zt(o,e={}){const t=new P({uniforms:{uTime:M.uTime,uColor:{value:new S(o)},uOpacity:{value:e.opacity??.9},uDash:{value:e.dash?1:0},uDashSize:{value:e.dashSize??.42},uGapSize:{value:e.gapSize??.3},uDashSpeed:{value:e.dashSpeed??1.1},uHead:{value:-999},uHeadWidth:{value:e.headWidth??.55}},vertexShader:`
      attribute float aDist;
      attribute vec3 aColor;
      varying float vDist;
      varying vec3 vCol;
      varying vec2 vUvC;
      void main() {
        vDist = aDist;
        vCol = aColor;
        vUvC = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,fragmentShader:`
      precision highp float;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uDash;
      uniform float uDashSize;
      uniform float uGapSize;
      uniform float uDashSpeed;
      uniform float uHead;
      uniform float uHeadWidth;
      varying float vDist;
      varying vec3 vCol;
      varying vec2 vUvC;
      void main() {
        float across = abs(vUvC.y * 2.0 - 1.0);
        float core = pow(1.0 - clamp(across, 0.0, 1.0), 1.7);
        float dashOn = 1.0;
        if (uDash > 0.5) {
          float period = uDashSize + uGapSize;
          float cyc = mod(vDist - uTime * uDashSpeed, period);
          dashOn = 1.0 - smoothstep(uDashSize, uDashSize + 0.07, cyc);
        }
        float hd = (vDist - uHead) / max(uHeadWidth, 0.001);
        float head = exp(-hd * hd);
        float pulse = 0.70 + 0.30 * sin(uTime * 3.1 - vDist * 1.6);
        float a = uOpacity * core * dashOn * pulse + head * core * 1.35;
        if (a <= 0.002) discard;
        vec3 c = uColor * vCol * (0.75 + 0.85 * core + head * 2.4);
        gl_FragColor = vec4(c, a);
      }
    `,transparent:!0,blending:G,depthWrite:!1,side:X});return t.name="tb.holoLine",N(t)}function Dt(o,e={}){const t=e.ghost===!0,i=new P({uniforms:{...fe(),uColor:{value:new S(o)},uHull:{value:new S(q.plate).multiplyScalar(e.hull??1)},uEmissive:{value:e.emissive??1},uGhost:{value:t?1:0}},vertexShader:`
      ${Q}
      attribute vec3 iColor;
      attribute vec3 iAux;
      varying vec3 vNrm;
      varying vec3 vWorld;
      varying vec3 vCol;
      varying vec3 vAux;
      void main() {
        mat4 im = tbInstanceMatrix();
        vec4 world = modelMatrix * im * vec4(position, 1.0);
        vWorld = world.xyz;
        vNrm = normalize((modelMatrix * im * vec4(normal, 0.0)).xyz);
        vCol = iColor;
        vAux = iAux;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,fragmentShader:`
      precision highp float;
      ${me}
      uniform vec3 uColor;
      uniform vec3 uHull;
      uniform float uEmissive;
      uniform float uGhost;
      varying vec3 vNrm;
      varying vec3 vWorld;
      varying vec3 vCol;
      varying vec3 vAux;
      ${ie}
      void main() {
        vec3 N = normalize(vNrm);
        vec3 V = normalize(uCamPos - vWorld);
        vec3 tint = uColor * vCol;
        float alpha = vAux.x;
        float hostile = vAux.y;
        float boost = vAux.z;

        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.1);
        float ndl = max(dot(N, normalize(uKeyDir)), 0.0);
        float ndr = max(dot(N, normalize(uRimDir)), 0.0);

        // The hull carries a fraction of the guild tint so a token reads in
        // its owner's colour even on the shadow side.
        vec3 hull = uHull + tint * 0.14 * uEmissive;
        vec3 col = hull * (0.30 + 0.70 * ndl) + hull * uAmbTop * 0.8;
        col += hull * uRimColor * ndr * 0.45;
        col += tint * fres * (0.55 + 0.45 * boost) * uEmissive;

        // emissive trim on the upward-facing panels
        float top = smoothstep(0.45, 0.94, N.y);
        col += tint * top * (0.26 + 0.34 * boost) * uEmissive;

        // scan wash so tokens read as projections
        float scan = 0.5 + 0.5 * sin(vWorld.y * 26.0 - uTime * 3.2);
        col += tint * scan * 0.07 * uEmissive;

        // hostile threat pulse
        col += tint * hostile * fres * (0.30 + 0.30 * sin(uTime * 4.6 + vWorld.x));

        if (uGhost > 0.5) {
          float wire = 1.0 - smoothstep(0.0, 0.55, abs(dot(N, V)));
          col = tint * (0.35 + 1.5 * wire);
          alpha *= 0.28 + 0.72 * wire;
        }

        float dist = length(uCamPos - vWorld);
        col = mix(col, uFog, smoothstep(uFogNear, uFogFar, dist) * (1.0 - uGhost));

        gl_FragColor = vec4(col, alpha);
      }
    `,transparent:e.translucent===!0||t,blending:t?G:Te,depthWrite:!(e.translucent===!0||t),side:ce});return i.name=t?"tb.tokenGhost":"tb.token",N(i)}function Bt(o,e=2.4){const t=new P({uniforms:{uTime:M.uTime,uColor:{value:new S(o)},uSoft:{value:e},uOpacity:{value:1},uCore:{value:.9}},vertexShader:`
      ${Q}
      ${ze}
      attribute vec3 iColor;
      attribute vec3 iAux;
      varying vec2 vQ;
      varying vec3 vCol;
      varying float vA;
      varying float vPhase;
      void main() {
        mat4 im = tbInstanceMatrix();
        vQ = uv * 2.0 - 1.0;
        vCol = iColor;
        vA = iAux.y;
        vPhase = iAux.z;
        gl_Position = tbBillboard(im, position.xy, vec2(iAux.x));
      }
    `,fragmentShader:`
      precision highp float;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uSoft;
      uniform float uOpacity;
      uniform float uCore;
      varying vec2 vQ;
      varying vec3 vCol;
      varying float vA;
      varying float vPhase;
      void main() {
        float d = length(vQ);
        if (d > 1.0) discard;
        float falloff = pow(max(0.0, 1.0 - d), uSoft);
        float core = pow(max(0.0, 1.0 - d), 12.0) * uCore;
        float tw = 0.82 + 0.18 * sin(uTime * 2.3 + vPhase * 6.2831853);
        float a = (falloff + core) * vA * uOpacity * tw;
        if (a <= 0.002) discard;
        gl_FragColor = vec4(uColor * vCol * (1.0 + core * 2.0), a);
      }
    `,transparent:!0,blending:G,depthWrite:!1,depthTest:!0,side:X});return t.name="tb.glow",N(t)}function Et(o,e={}){const t=e.mode==="ring",i=e.additive!==!1,a=new P({uniforms:{uTime:M.uTime,uColor:{value:new S(o)},uSoft:{value:e.softness??2.2},uOpacity:{value:e.opacity??1},uRing:{value:t?1:0}},vertexShader:`
      ${Q}
      attribute vec3 iColor;
      attribute vec3 iAux;
      varying vec2 vUvC;
      varying vec3 vCol;
      varying vec3 vAux;
      void main() {
        mat4 im = tbInstanceMatrix();
        vUvC = uv;
        vCol = iColor;
        vAux = iAux;
        vec4 world = modelMatrix * im * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,fragmentShader:`
      precision highp float;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uSoft;
      uniform float uOpacity;
      uniform float uRing;
      varying vec2 vUvC;
      varying vec3 vCol;
      varying vec3 vAux;
      void main() {
        vec2 p = vUvC * 2.0 - 1.0;
        float disc = pow(max(0.0, 1.0 - length(p)), uSoft);
        float band = 1.0 - abs(vUvC.y * 2.0 - 1.0);
        float ringM = pow(clamp(band, 0.0, 1.0), 0.85);
        float shape = mix(disc, ringM, uRing);

        // optional radial wipe — ring geometry maps u to the angle fraction
        float sweep = vAux.z;
        float gate = 1.0;
        if (uRing > 0.5 && sweep > 0.001) {
          gate = step(vUvC.x, sweep) * (0.55 + 0.45 * smoothstep(sweep - 0.09, sweep, vUvC.x));
        }

        float flick = 0.86 + 0.14 * sin(uTime * 4.0 + vAux.y * 6.2831853);
        float a = shape * vAux.x * uOpacity * gate * flick;
        if (a <= 0.002) discard;
        gl_FragColor = vec4(uColor * vCol * (0.8 + shape * 1.5), a);
      }
    `,transparent:!0,blending:i?G:Te,depthWrite:!1,depthTest:!0,side:X});return a.name=t?"tb.decalRing":"tb.decalDisc",N(a)}function Ft(o,e=!1){const t=new P({uniforms:{uTime:M.uTime,uMap:{value:o},uOpacity:{value:1}},vertexShader:`
      ${Q}
      ${ze}
      attribute vec4 iRect;
      attribute vec3 iAux;
      attribute vec3 iColor;
      varying vec2 vUvT;
      varying float vA;
      varying vec3 vCol;
      void main() {
        mat4 im = tbInstanceMatrix();
        vUvT = iRect.xy + uv * iRect.zw;
        vA = iAux.z;
        vCol = iColor;
        gl_Position = tbBillboard(im, position.xy, iAux.xy);
      }
    `,fragmentShader:`
      precision highp float;
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying vec2 vUvT;
      varying float vA;
      varying vec3 vCol;
      void main() {
        vec4 t = texture2D(uMap, vUvT);
        float a = t.a * vA * uOpacity;
        if (a <= 0.004) discard;
        gl_FragColor = vec4(t.rgb * vCol, a);
      }
    `,transparent:!0,depthWrite:!1,depthTest:e,side:X});return t.name="tb.atlas",N(t)}function Nt(){const o=new P({uniforms:{...fe(),uGrid:{value:new S(q.cyanDeep).multiplyScalar(.55)},uBase:{value:new S(q.abyss)},uRadius:{value:100}},vertexShader:`
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,fragmentShader:`
      precision highp float;
      ${me}
      uniform vec3 uGrid;
      uniform vec3 uBase;
      uniform float uRadius;
      varying vec3 vWorld;
      ${ie}
      void main() {
        float r = length(vWorld.xz);
        float fade = 1.0 - smoothstep(uRadius * 0.35, uRadius, r);
        vec2 g = abs(fract(vWorld.xz * 0.2887) - 0.5);
        float lines = 1.0 - smoothstep(0.0, 0.02, min(g.x, g.y));
        float rings = 1.0 - smoothstep(0.0, 0.018, abs(fract(r * 0.08 - uTime * 0.02) - 0.5) );
        float n = tbFbm2(vWorld.xz * 0.05 + 3.7);
        vec3 col = uBase * (0.5 + 0.9 * n);
        col += uGrid * lines * 0.5 * fade;
        col += uGrid * rings * 0.35 * fade;
        col = mix(uFog, col, fade);
        gl_FragColor = vec4(col, 1.0);
      }
    `,side:ce,depthWrite:!0});return o.name="tb.ground",N(o)}function Ut(o,e=1){const t=new P({uniforms:{uTime:M.uTime,uColor:{value:new S(o)},uPixelRatio:{value:e},uHeight:{value:2.2},uOpacity:{value:.42}},vertexShader:`
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aSize;
      attribute vec2 aSpread;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uHeight;
      varying float vLife;
      void main() {
        float life = fract(aPhase + uTime * aSpeed * 0.14);
        vLife = life;
        vec3 p = position;
        p.y += life * uHeight;
        p.x += aSpread.x * life * 1.6 + sin(uTime * 0.8 + aPhase * 30.0) * 0.05 * life;
        p.z += aSpread.y * life * 1.6 + cos(uTime * 0.7 + aPhase * 21.0) * 0.05 * life;
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uPixelRatio * (18.0 / max(0.1, -mv.z)) * (0.4 + life);
        gl_Position = projectionMatrix * mv;
      }
    `,fragmentShader:`
      precision highp float;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vLife;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float d = dot(q, q);
        if (d > 1.0) discard;
        float a = (1.0 - d) * (1.0 - d);
        a *= smoothstep(0.0, 0.15, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
        gl_FragColor = vec4(uColor * (1.4 - vLife * 0.6), a * uOpacity);
      }
    `,transparent:!0,blending:G,depthWrite:!1});return t.name="tb.vent",N(t)}const pt=/swiftshader|llvmpipe|software|mesa offscreen|adreno \(tm\) [1-5][0-9][0-9]\b|mali-[tg]?[0-6][0-9]{0,2}\b|powervr (sgx|rogue g6)|apple a([789]|10)\b|intel\(r\) hd graphics [2-5]/i,gt=/apple m[1-9]|apple a1[5-9]|rtx|radeon rx|geforce gtx 1[06-9]|adreno \(tm\) (7[0-9][0-9]|6[5-9][0-9])/i;function xt(){let o="",e=!1;try{const t=document.createElement("canvas"),i=t.getContext("webgl2")??t.getContext("webgl");if(i){e=typeof WebGL2RenderingContext<"u"&&i instanceof WebGL2RenderingContext;const a=i.getExtension("WEBGL_debug_renderer_info");a&&(o=String(i.getParameter(a.UNMASKED_RENDERER_WEBGL)??"")),o||(o=String(i.getParameter(i.RENDERER)??"")),i.getExtension("WEBGL_lose_context")?.loseContext()}}catch{}return{gl2:e,renderer:o}}function bt(){const o=typeof window<"u"&&window.devicePixelRatio||1,e=typeof navigator<"u"&&navigator.hardwareConcurrency||4,t=typeof navigator<"u"?navigator.deviceMemory??4:4,i=typeof navigator<"u"?navigator.userAgent:"",a=/android|iphone|ipad|ipod|mobile|silk/i.test(i),{gl2:s,renderer:r}=xt();let u=0;u+=s?2:-2,u+=e>=8?2:e>=6?1:e>=4?0:-2,u+=t>=8?1:t>=4?0:-2,u+=a?-1:1,pt.test(r)&&(u-=4),gt.test(r)&&(u+=3),o>=3&&a&&(u-=1);const l=u>=4?"high":u>=1?"medium":"low",m=l==="high"?Math.min(o,2):l==="medium"?Math.min(o,1.75):Math.min(o,1.25);return{quality:l,webgl2:s,devicePixelRatio:o,maxPixelRatio:m,cores:e,memoryGb:t,rendererString:r,mobile:a,antialias:l==="high"&&o<2,shadows:!1}}class Gt{simNow=0;lastSim=0;lastReal=0;rate=1;sync(e){const t=typeof performance<"u"?performance.now():Date.now();if(this.lastReal>0){const i=t-this.lastReal,a=e-this.lastSim;if(i>30&&a>=0){const s=Math.min(600,a/i);this.rate=this.rate*.72+s*.28}}this.lastReal=t,this.lastSim=e,this.simNow=this.simNow>e?this.simNow*.5+e*.5:e}advance(e){this.simNow+=e*1e3*this.rate}get now(){return this.simNow}get timeScale(){return this.rate}reset(){this.simNow=0,this.lastSim=0,this.lastReal=0,this.rate=1}}const yt=new C(1,0,0),wt=new C(0,1,0),St=new C(0,0,1);class Ot{renderer;composer;post;profile;quality;canvas;container;observer=null;scene=null;camera=null;onFrame=null;rafId=0;running=!1;lastTime=0;elapsed=0;width=1;height=1;shakeAmp=0;shakeDecay=6;shakeSeed=Math.random()*1e3;shakeOffset=new C;shakeApplied=new C;camScratch=new C;axisScratch=new C;disposed=!1;constructor(e){this.container=e,this.profile=bt(),this.quality=this.profile.quality,this.renderer=new $e({antialias:this.profile.antialias,alpha:!1,powerPreference:this.profile.quality==="low"?"low-power":"high-performance",stencil:!1,depth:!0,preserveDrawingBuffer:!1}),this.canvas=this.renderer.domElement,this.canvas.style.display="block",this.canvas.style.width="100%",this.canvas.style.height="100%",this.canvas.style.touchAction="none",this.canvas.style.outline="none",this.renderer.setPixelRatio(this.profile.maxPixelRatio),this.renderer.outputColorSpace=je,this.renderer.toneMapping=Me,this.renderer.toneMappingExposure=1.06,this.renderer.shadowMap.enabled=!1,this.renderer.setClearColor(198156,1),this.renderer.info.autoReset=!0;const t=e.getBoundingClientRect();this.width=Math.max(1,Math.floor(t.width||e.clientWidth||1)),this.height=Math.max(1,Math.floor(t.height||e.clientHeight||1)),this.renderer.setSize(this.width,this.height,!1),e.appendChild(this.canvas),this.post=ht(this.renderer,this.quality),this.composer=this.post.composer,this.post.setSize(this.width,this.height,this.profile.maxPixelRatio),typeof ResizeObserver<"u"&&(this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(e))}setScene(e,t){this.scene=e,this.camera=t,this.post.setScene(e,t),t.aspect=this.width/this.height,t.updateProjectionMatrix()}start(e){if(this.onFrame=e,this.running||this.disposed)return;this.running=!0,this.lastTime=performance.now();const t=i=>{if(!this.running)return;this.rafId=requestAnimationFrame(t);const a=Math.min(.064,Math.max(0,(i-this.lastTime)/1e3));this.lastTime=i,this.elapsed+=a,this.tick(a)};this.rafId=requestAnimationFrame(t)}stop(){this.running=!1,this.rafId&&cancelAnimationFrame(this.rafId),this.rafId=0}tick(e){const{scene:t,camera:i}=this;if(this.onFrame?.(e,this.elapsed),!t||!i)return;mt(i.getWorldPosition(this.camScratch)),ft(this.elapsed),this.post.update(this.elapsed);let a=!1;if(this.shakeAmp>5e-5){const s=this.elapsed,r=this.shakeSeed;this.shakeOffset.set(Math.sin(s*47.3+r)*.6+Math.sin(s*91.7+r*1.7)*.4,Math.sin(s*53.9+r*2.3)*.6+Math.sin(s*113.1+r)*.4,Math.sin(s*61.1+r*3.1)*.5);const u=this.shakeAmp,l=this.shakeApplied.set(0,0,0);l.addScaledVector(this.axisScratch.copy(yt).applyQuaternion(i.quaternion),this.shakeOffset.x*u),l.addScaledVector(this.axisScratch.copy(wt).applyQuaternion(i.quaternion),this.shakeOffset.y*u),l.addScaledVector(this.axisScratch.copy(St).applyQuaternion(i.quaternion),this.shakeOffset.z*u*.35),i.position.add(l),i.updateMatrixWorld(!0),this.shakeAmp*=Math.exp(-this.shakeDecay*e),this.shakeAmp<5e-5&&(this.shakeAmp=0),a=!0}this.composer.render(e),a&&(i.position.sub(this.shakeApplied),i.updateMatrixWorld(!0))}shake(e,t=320){this.shakeAmp=Math.max(this.shakeAmp,e),this.shakeDecay=Math.max(1.5,4200/Math.max(60,t)),this.shakeSeed=Math.random()*1e3}setPostStrength(e){this.post.setStrength(e)}resize(){if(this.disposed)return;const e=this.container.getBoundingClientRect(),t=Math.max(1,Math.floor(e.width||this.container.clientWidth||1)),i=Math.max(1,Math.floor(e.height||this.container.clientHeight||1));t===this.width&&i===this.height||(this.width=t,this.height=i,this.renderer.setSize(t,i,!1),this.post.setSize(t,i,this.profile.maxPixelRatio),this.camera&&(this.camera.aspect=t/i,this.camera.updateProjectionMatrix()))}get size(){return{width:this.width,height:this.height}}get drawCalls(){return this.renderer.info.render.calls}dispose(){this.disposed||(this.disposed=!0,this.stop(),this.observer?.disconnect(),this.post.dispose(),this.scene=null,this.camera=null,this.onFrame=null,this.renderer.dispose(),this.renderer.forceContextLoss(),this.canvas.parentNode&&this.canvas.parentNode.removeChild(this.canvas))}}function Ct(o,e=!1){const t=o[0].index!==null,i=new Set(Object.keys(o[0].attributes)),a=new Set(Object.keys(o[0].morphAttributes)),s={},r={},u=o[0].morphTargetsRelative,l=new W;let m=0;for(let n=0;n<o.length;++n){const c=o[n];let d=0;if(t!==(c.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+n+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const f in c.attributes){if(!i.has(f))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+n+'. All geometries must have compatible attributes; make sure "'+f+'" attribute exists among all geometries, or in none of them.'),null;s[f]===void 0&&(s[f]=[]),s[f].push(c.attributes[f]),d++}if(d!==i.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+n+". Make sure all geometries have the same number of attributes."),null;if(u!==c.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+n+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const f in c.morphAttributes){if(!a.has(f))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+n+".  .morphAttributes must be consistent throughout all geometries."),null;r[f]===void 0&&(r[f]=[]),r[f].push(c.morphAttributes[f])}if(e){let f;if(t)f=c.index.count;else if(c.attributes.position!==void 0)f=c.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+n+". The geometry must have either an index or a position attribute"),null;l.addGroup(m,f,n),m+=f}}if(t){let n=0;const c=[];for(let d=0;d<o.length;++d){const f=o[d].index;for(let p=0;p<f.count;++p)c.push(f.getX(p)+n);n+=o[d].attributes.position.count}l.setIndex(c)}for(const n in s){const c=ye(s[n]);if(!c)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+n+" attribute."),null;l.setAttribute(n,c)}for(const n in r){const c=r[n][0].length;if(c===0)break;l.morphAttributes=l.morphAttributes||{},l.morphAttributes[n]=[];for(let d=0;d<c;++d){const f=[];for(let h=0;h<r[n].length;++h)f.push(r[n][h][d]);const p=ye(f);if(!p)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+n+" morphAttribute."),null;l.morphAttributes[n].push(p)}}return l}function ye(o){let e,t,i,a=-1,s=0;for(let m=0;m<o.length;++m){const n=o[m];if(e===void 0&&(e=n.array.constructor),e!==n.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=n.itemSize),t!==n.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(i===void 0&&(i=n.normalized),i!==n.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(a===-1&&(a=n.gpuType),a!==n.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;s+=n.count*t}const r=new e(s),u=new k(r,t,i);let l=0;for(let m=0;m<o.length;++m){const n=o[m];if(n.isInterleavedBufferAttribute){const c=l/t;for(let d=0,f=n.count;d<f;d++)for(let p=0;p<t;p++){const h=n.getComponent(d,p);u.setComponent(d+c,p,h)}}else r.set(n.array,l);l+=n.count*t}return a!==void 0&&(u.gpuType=a),u}const T={side:0,bevel:.5,top:1},ue=Math.PI*2,we=new Map;function F(o,e){const t=we.get(o);if(t)return t;const i=e();return i.name=o,we.set(o,i),i}function It(o=1,e=1,t=.15){return F(`hexPrism|${o}|${e}|${t}`,()=>{const i=o*(1-t),a=e,s=e*(1-t*1.35),r=[],u=[],l=[],m=[],n=v=>Math.PI/2+v*Math.PI/3,c=(v,g,x,b,w,_,z,R,y)=>{r.push(v,g,x),u.push(b,w,_),l.push(z,R),m.push(y)},d=(v,g)=>[v/i*.5+.5,g/i*.5+.5];for(let v=0;v<6;v++){const g=n(v),x=n(v+1),b=i*Math.cos(g),w=i*Math.sin(g),_=i*Math.cos(x),z=i*Math.sin(x),R=d(0,0),y=d(b,w),B=d(_,z);c(0,a,0,0,1,0,R[0],R[1],T.top),c(_,a,z,0,1,0,B[0],B[1],T.top),c(b,a,w,0,1,0,y[0],y[1],T.top)}const f=o-i,p=a-s;for(let v=0;v<6;v++){const g=n(v),x=n(v+1),b=(g+x)*.5,w=Math.cos(b),_=Math.sin(b),z=Math.hypot(p,f)||1,R=w*p/z,y=f/z,B=_*p/z,oe=i*Math.cos(g),ae=i*Math.sin(g),de=i*Math.cos(x),ve=i*Math.sin(x),$=o*Math.cos(g),j=o*Math.sin(g),O=o*Math.cos(x),I=o*Math.sin(x),Y=d(oe,ae),pe=d(de,ve),ge=d($,j),Z=d(O,I);c(oe,a,ae,R,y,B,Y[0],Y[1],T.bevel),c(O,s,I,R,y,B,Z[0],Z[1],T.bevel),c($,s,j,R,y,B,ge[0],ge[1],T.bevel),c(oe,a,ae,R,y,B,Y[0],Y[1],T.bevel),c(de,a,ve,R,y,B,pe[0],pe[1],T.bevel),c(O,s,I,R,y,B,Z[0],Z[1],T.bevel);const se=v/6,re=(v+1)/6;c($,s,j,w,0,_,se,1,T.side),c(O,0,I,w,0,_,re,0,T.side),c($,0,j,w,0,_,se,0,T.side),c($,s,j,w,0,_,se,1,T.side),c(O,s,I,w,0,_,re,1,T.side),c(O,0,I,w,0,_,re,0,T.side)}const h=new W;return h.setAttribute("position",new A(r,3)),h.setAttribute("normal",new A(u,3)),h.setAttribute("uv",new A(l,2)),h.setAttribute("aFace",new A(m,1)),h.computeBoundingSphere(),h.computeBoundingBox(),h})}function Ht(o=1){return F(`hexPlate|${o}`,()=>{const e=[],t=[],i=[],a=[],s=u=>Math.PI/2+u*Math.PI/3;for(let u=0;u<6;u++){const l=s(u),m=s(u+1),n=o*Math.cos(l),c=o*Math.sin(l),d=o*Math.cos(m),f=o*Math.sin(m);e.push(0,0,0,d,0,f,n,0,c),t.push(0,1,0,0,1,0,0,1,0),i.push(.5,.5,d/o*.5+.5,f/o*.5+.5,n/o*.5+.5,c/o*.5+.5),a.push(T.top,T.top,T.top)}const r=new W;return r.setAttribute("position",new A(e,3)),r.setAttribute("normal",new A(t,3)),r.setAttribute("uv",new A(i,2)),r.setAttribute("aFace",new A(a,1)),r.computeBoundingSphere(),r})}function Mt(o,e){const t=o.length,i=new Je,a=(s,r,u)=>{const l=r[0]-s[0],m=r[1]-s[1],n=Math.hypot(l,m)||1,c=Math.min(u,n*.45)/n;return[s[0]+l*c,s[1]+m*c]};for(let s=0;s<t;s++){const r=o[(s-1+t)%t],u=o[s],l=o[(s+1)%t],m=a(u,r,e),n=a(u,l,e);s===0?i.moveTo(m[0],m[1]):i.lineTo(m[0],m[1]),i.quadraticCurveTo(u[0],u[1],n[0],n[1])}return i.closePath(),i}function kt(o=1){return F(`chevron|${o}`,()=>{const e=Mt([[0,1.02],[.82,-.62],[0,-.2],[-.82,-.62]],.24),t=new Ze(e,{depth:.34,bevelEnabled:!0,bevelThickness:.07,bevelSize:.07,bevelOffset:0,bevelSegments:2,curveSegments:6});t.rotateX(Math.PI/2),t.computeBoundingBox();const i=t.boundingBox;return i&&t.translate(0,-i.min.y,0),t.scale(o,o,o),t.computeVertexNormals(),t.computeBoundingSphere(),t})}function Lt(o=1){return F(`diamond|${o}`,()=>{const e=new Ae(o,0);return e.scale(.66,1.5,.66),e.translate(0,o*1.5,0),e.computeVertexNormals(),e.computeBoundingSphere(),e})}function Wt(o=1,e=.09,t=72){return F(`ring|${o}|${e}|${t}`,()=>{const i=o-e*.5,a=o+e*.5,s=[],r=[],u=[];for(let m=0;m<t;m++){const n=m/t,c=(m+1)/t,d=n*ue,f=c*ue,p=Math.cos(d),h=Math.sin(d),v=Math.cos(f),g=Math.sin(f),x=[i*p,0,i*h],b=[a*p,0,a*h],w=[a*v,0,a*g],_=[i*v,0,i*g];s.push(...x,...w,...b,...x,..._,...w);for(let z=0;z<6;z++)r.push(0,1,0);u.push(n,0,c,1,n,1,n,0,c,0,c,1)}const l=new W;return l.setAttribute("position",new A(s,3)),l.setAttribute("normal",new A(r,3)),l.setAttribute("uv",new A(u,2)),l.computeBoundingSphere(),l})}function Vt(o=.32,e=6,t=14){return F(`column|${o}|${e}|${t}`,()=>{const i=new K(o*1.9,o,e,t,1,!0);return i.translate(0,e*.5,0),i.computeBoundingSphere(),i})}function Qt(o=1){return F(`quad|${o}`,()=>{const e=new _e(o,o,1,1);return e.computeBoundingSphere(),e})}function $t(o=1){return F(`groundQuad|${o}`,()=>{const e=new _e(o,o,1,1);return e.rotateX(-Math.PI/2),e.computeBoundingSphere(),e})}function jt(o=1){return F(`mote|${o}`,()=>{const e=new Ye(o,0);return e.scale(1,.72,1),e.computeVertexNormals(),e.computeBoundingSphere(),e})}function Kt(o){return F(`obelisk|${o}`,()=>{const e=[],t=h=>{h.index?(e.push(h.toNonIndexed()),h.dispose()):e.push(h)},i=.2+o*.055,a=.08+o*.02,s=new K(i*.86,i,a,6,1,!1);s.translate(0,a*.5,0),t(s);const r=o===1?.4:o===2?.66:.98,u=o===1?.055:o===2?.062:.072,l=o===1?.13:o===2?.15:.175,m=new K(u,l,r,4,1,!1);if(m.rotateY(Math.PI/4),m.translate(0,a+r*.5,0),t(m),o>=2){const h=a+r*.62,v=new K(.185,.185,.045,6,1,!1);v.translate(0,h,0),t(v)}if(o===3){const h=new K(.145,.145,.04,6,1,!1);h.translate(0,a+r*.34,0),t(h)}const n=o===1?0:o===2?2:3;for(let h=0;h<n;h++){const v=h/Math.max(1,n)*ue+Math.PI/6,g=new Xe(.035,r*.46,.12);g.translate(0,a+r*.3,.17),g.rotateY(v),t(g)}const c=a+r+(o===3?.12:.045),d=o===1?.07:o===2?.085:.105,f=new Ae(d,0);f.scale(1,1.55,1),f.translate(0,c,0),t(f);const p=Ct(e,!1);for(const h of e)h.dispose();return p.computeVertexNormals(),p.computeBoundingSphere(),p})}const Se=new C,Ce=new C,H=new C,ne=new C,Tt=new C(0,1,0);function qt(o,e,t={}){const i=new W,a=o.length;if(a<2)return i.setAttribute("position",new A([],3)),i.setAttribute("normal",new A([],3)),i.setAttribute("uv",new A([],2)),i.setAttribute("aDist",new A([],1)),i.setAttribute("aColor",new A([],3)),i.userData.length=0,i;const s=[0];let r=0;for(let h=1;h<a;h++)r+=o[h].distanceTo(o[h-1]),s.push(r);const u=r||1,l=t.taper??1,m=new Float32Array(a*2*3),n=new Float32Array(a*2*3),c=new Float32Array(a*2*2),d=new Float32Array(a*2),f=new Float32Array(a*2*3);for(let h=0;h<a;h++){const v=o[h];Se.copy(o[Math.max(0,h-1)]),Ce.copy(o[Math.min(a-1,h+1)]),H.subVectors(Ce,Se),H.y=0,H.lengthSq()<1e-9&&H.set(0,0,1),H.normalize(),ne.crossVectors(Tt,H).normalize();const g=s[h]/u,x=e*.5*(1-(1-l)*g),b=t.colors?t.colors[Math.min(h,t.colors.length-1)]:null,w=b?b.r:1,_=b?b.g:1,z=b?b.b:1;for(let R=0;R<2;R++){const y=h*2+R,B=R===0?-1:1;m[y*3+0]=v.x+ne.x*x*B,m[y*3+1]=v.y,m[y*3+2]=v.z+ne.z*x*B,n[y*3+1]=1,c[y*2+0]=g,c[y*2+1]=R,d[y]=s[h],f[y*3+0]=w,f[y*3+1]=_,f[y*3+2]=z}}const p=[];for(let h=0;h<a-1;h++){const v=h*2;p.push(v,v+1,v+3,v,v+3,v+2)}return i.setAttribute("position",new k(m,3)),i.setAttribute("normal",new k(n,3)),i.setAttribute("uv",new k(c,2)),i.setAttribute("aDist",new k(d,1)),i.setAttribute("aColor",new k(f,3)),i.setIndex(p),i.computeBoundingSphere(),i.userData.length=r,i}class Xt{mesh;base;material;attrs;parent;cursor=0;capacity;dirty=new Set;matrixDirty=!1;renderOrder=0;constructor(e,t,i,a,s=[]){this.parent=e,this.base=t,this.material=i,this.attrs=s,this.capacity=Math.max(1,a),this.mesh=this.build(this.capacity),e.add(this.mesh)}build(e){const t=this.base.clone();for(const a of this.attrs){const s=new Float32Array(e*a.size);if(a.fill)for(let u=0;u<e;u++)for(let l=0;l<a.size;l++)s[u*a.size+l]=a.fill[l]??0;const r=new Ke(s,a.size);r.setUsage(xe),t.setAttribute(a.name,r)}const i=new qe(t,this.material,e);return i.instanceMatrix.setUsage(xe),i.frustumCulled=!1,i.count=0,i.renderOrder=this.renderOrder,i}ensure(e){if(e<=this.capacity)return;let t=this.capacity;for(;t<e;)t=Math.ceil(t*1.75)+8;const i=this.mesh;this.capacity=t,this.mesh=this.build(t),this.mesh.renderOrder=i.renderOrder,this.mesh.visible=i.visible,this.parent.remove(i),i.geometry.dispose(),i.dispose(),this.parent.add(this.mesh)}begin(){this.cursor=0,this.dirty.clear(),this.matrixDirty=!1}add(e){if(this.cursor>=this.capacity)return-1;const t=this.cursor++;return this.mesh.setMatrixAt(t,e),this.matrixDirty=!0,t}set(e,t,...i){if(e<0)return;const a=this.mesh.geometry.getAttribute(t);if(!a)return;const s=a.array,r=e*a.itemSize;for(let u=0;u<a.itemSize&&u<i.length;u++)s[r+u]=i[u];this.dirty.add(t)}end(){this.mesh.count=this.cursor,this.matrixDirty&&(this.mesh.instanceMatrix.needsUpdate=!0);for(const e of this.dirty){const t=this.mesh.geometry.getAttribute(e);t&&(t.needsUpdate=!0)}this.dirty.clear()}get count(){return this.cursor}setRenderOrder(e){this.renderOrder=e,this.mesh.renderOrder=e}setVisible(e){this.mesh.visible=e}dispose(){this.parent.remove(this.mesh),this.mesh.geometry.dispose(),this.mesh.dispose()}}export{ie as G,Xt as I,U as M,Gt as S,Nt as a,Et as b,Bt as c,Ut as d,Dt as e,Wt as f,Qt as g,It as h,zt as i,Ft as j,$t as k,kt as l,Rt as m,jt as n,Kt as o,qt as p,Pt as q,N as r,Ht as s,Vt as t,Lt as u,Ot as v,Ct as w};
//# sourceMappingURL=geometry-uQh_Upqu.js.map
