import { MeshBasicMaterial, NormalBlending, Vector3, Vector4 } from 'three'
import {
  ApplyForce,
  Bezier,
  ColorRange,
  ConstantValue,
  IntervalValue,
  ParticleSystem,
  PiecewiseBezier,
  RenderMode,
  SizeOverLife,
  SphereEmitter
} from 'three.quarks'

import { getState } from '@etherealengine/hyperflux'

import { createEntity, setComponent } from '@etherealengine/ecs'
import { AssetLoader } from '@etherealengine/engine/src/assets/classes/AssetLoader'
import { ParticleState } from '@etherealengine/engine/src/scene/components/ParticleSystemComponent'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { addObjectToGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { setVisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'

export const createBubblePopEmitter = () => {
  const particleEntity = createEntity()
  setVisibleComponent(particleEntity, true)
  setComponent(particleEntity, NameComponent, 'Bubble Pop Particles')

  AssetLoader.load(`/static/editor/dot.png`, {}).then((texture) => {
    if (!texture) return
    material.map = texture
  })
  const material = new MeshBasicMaterial({
    transparent: true,
    blending: NormalBlending
  })
  const batchRenderer = getState(ParticleState).batchRenderer

  const particleSystem = new ParticleSystem({
    duration: 5,
    looping: false,
    startLife: new IntervalValue(0.5, 1),
    startSpeed: new IntervalValue(1, 3),
    startSize: new ConstantValue(0.075),
    startColor: new ColorRange(new Vector4(1, 1, 1, 1), new Vector4(0.9, 0.9, 0.9, 1)),
    worldSpace: true,
    emissionOverTime: new ConstantValue(0),
    emissionBursts: [
      {
        time: 0,
        count: new ConstantValue(50),
        cycle: 10,
        interval: 0.1,
        probability: 1
      }
    ],
    shape: new SphereEmitter({ radius: 0.125 }),
    material,
    renderMode: RenderMode.BillBoard,
    rendererEmitterSettings: {
      startLength: new ConstantValue(40)
    },
    uTileCount: 1,
    vTileCount: 1
  })
  particleSystem.emitter.name = 'burst'
  particleSystem.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.95, 0.75, 0), 0]])))
  particleSystem.addBehavior(new ApplyForce(new Vector3(0, -1, 0), new ConstantValue(10)))
  batchRenderer.addSystem(particleSystem)
  addObjectToGroup(particleEntity, particleSystem.emitter)
  return {
    particleSystem,
    particleEntity
  }
}
