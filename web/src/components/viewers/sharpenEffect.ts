import { EffectBase } from '@google/model-viewer-effects'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform } from 'three'

/**
 * Unsharp mask (Laplacian), like Sketchfab's "Sharpness" post-process filter.
 * `inputBuffer` and `texelSize` are provided by postprocessing's EffectMaterial.
 */
const fragmentShader = /* glsl */ `
uniform float amount;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 n = texture2D(inputBuffer, uv + vec2(0.0, texelSize.y)).rgb
         + texture2D(inputBuffer, uv - vec2(0.0, texelSize.y)).rgb
         + texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0)).rgb
         + texture2D(inputBuffer, uv - vec2(texelSize.x, 0.0)).rgb;
  vec3 c = inputColor.rgb;
  outputColor = vec4(clamp(c + amount * (4.0 * c - n), 0.0, 1.0), inputColor.a);
}
`

class SharpenEffect extends Effect {
  constructor(amount: number) {
    super('SharpenEffect', fragmentShader, {
      // Samples neighbouring pixels, so it needs its own pass.
      attributes: EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([['amount', new Uniform(amount)]]),
    })
  }
}

/** `<sharpen-effect amount="0.3">` for `<effect-composer>`. */
class SharpenEffectElement extends EffectBase {
  static properties = { amount: { type: Number } }
  declare amount: number

  constructor() {
    super()
    this.amount = 0.3
    this.effects = [new SharpenEffect(this.amount)]
  }

  updated(changed: Map<PropertyKey, unknown>) {
    super.updated(changed)
    if (changed.has('amount')) {
      this.effects[0]!.uniforms.get('amount')!.value = this.amount
      this.effectComposer?.queueRender()
    }
  }
}

if (!customElements.get('sharpen-effect')) customElements.define('sharpen-effect', SharpenEffectElement)
