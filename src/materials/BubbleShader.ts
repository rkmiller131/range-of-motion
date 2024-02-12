//Just dropping the .vert/.frag shader into a ts file until we add vite support for importing glsl

import { AssetLoader } from '@etherealengine/engine/src/assets/classes/AssetLoader'
import { MeshMatcapMaterial, Texture } from 'three'

import config from '@etherealengine/common/src/config'
import { addOBCPlugin } from '@etherealengine/spatial/src/common/functions/OnBeforeCompilePlugin'

let material: MeshMatcapMaterial

let matcap: Texture | null = null

export function getBubbleMaterial(): MeshMatcapMaterial {
  if (material) return material
  material = new MeshMatcapMaterial()
  addOBCPlugin(material, {
    id: 'bubble',
    compile: (shader, renderer) => {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `varying vec3 vPos;
				void main() {`
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
				vec4 modelPosition = modelMatrix * vec4(position, 1.0);
				vec4 viewPosition = viewMatrix * modelPosition;
				vec4 clipPosition = projectionMatrix * viewPosition;
				vPos = (modelMatrix * vec4(position, 1.0)).xyz;
				transformed += vec3(sin(length(vPos*14.0))*0.0125);`
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `varying vec3 vPos;
				void main() {`
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
				 float fresnel = pow(1.0 - dot(viewDir, normal), 3.0);
				 vec3 bubbleFresnelColor = 0.5 * (1.0 + cos(vPos * 5.0 + vec3(0.0, 2.0, 4.0)));
				 bubbleFresnelColor = mix(bubbleFresnelColor, vec3(1.0), fresnel * 0.5);
				 gl_FragColor = vec4(outgoingLight * bubbleFresnelColor, 1.0);`
      )
    }
  })
  const setMatcap = (_matcap) => {
    material.matcap = matcap
    material.needsUpdate = true
  }
  matcap && setMatcap(matcap)
  !matcap &&
    AssetLoader.load(
      `${config.client.fileServer}/projects/uvx-bubble-pop/assets/3E95CC_65D9F1_A2E2F6_679BD4-64px.ktx2`,
      {},
      (texture) => {
        matcap = texture
        setMatcap(matcap)
      },
      undefined,
      (err) => {
        console.error('Error loading matcap texture', err)
      }
    )
  return material
}
