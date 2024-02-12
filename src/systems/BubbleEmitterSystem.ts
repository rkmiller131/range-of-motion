import { EntityUUID } from '@etherealengine/common/src/interfaces/EntityUUID'
import { dispatchAction, getState } from '@etherealengine/hyperflux'

import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import { PresentationSystemGroup, defineSystem, getComponent } from '@etherealengine/ecs'
import { ECSState } from '@etherealengine/ecs/src/ECSState'
import { TransformComponent } from '@etherealengine/spatial'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { randomSphereOffset } from '@etherealengine/spatial/src/common/functions/MathFunctions'
import { Vector3 } from 'three'
import { BubbleActions } from './BubbleState'
import { bubbleEmitterName } from './BubbleUISystem'

let nextSpawnCountdown = 3

let index = 0

const vec3 = new Vector3()

const execute = () => {
  if (!isClient) return

  if (nextSpawnCountdown > 0) {
    nextSpawnCountdown -= getState(ECSState).simulationTimestep / 1000
  } else {
    const entity = NameComponent.entitiesByName[bubbleEmitterName]?.[0]
    if (!entity) return
    const transform = getComponent(entity, TransformComponent)
    const uuid = (index + '_bubble') as EntityUUID

    const offset = randomSphereOffset(0.5, Math.random)
    vec3.set(offset.x, offset.y, offset.z).applyQuaternion(transform.rotation).add(transform.position)

    dispatchAction(
      BubbleActions.spawnBubble({
        entityUUID: uuid,
        position: vec3
      })
    )

    nextSpawnCountdown = 3

    index++
  }
}

export default defineSystem({
  uuid: 'uvx.bubble-pop.BubbleEmitterSystem',
  insert: { after: PresentationSystemGroup },
  execute
})
