import { getMutableState, useHookstate } from '@etherealengine/hyperflux'

import { SimulationSystemGroup, defineSystem, getComponent, setComponent } from '@etherealengine/ecs'
import { SceneState } from '@etherealengine/engine/src/scene/Scene'
import { TransformComponent } from '@etherealengine/spatial'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { XRUI } from '@etherealengine/spatial/src/xrui/functions/createXRUI'
import { useEffect } from 'react'
import { createCounterView } from '../ui'

export const bubbleEmitterName = 'Bubble Emitter'

let ui = undefined! as XRUI<any>

const execute = () => {
  if (ui) ui.container.updateWorldMatrix(true, true)
}

const reactor = () => {
  const sceneLoaded = useHookstate(getMutableState(SceneState).sceneLoaded)

  useEffect(() => {
    if (!sceneLoaded.value) return

    const entity = NameComponent.entitiesByName[bubbleEmitterName]?.[0]
    if (!entity) return console.warn('Bubble Emitter not found')

    ui = createCounterView(entity)

    setComponent(ui.entity, NameComponent, 'Counter XRUI')
    const transform = getComponent(ui.entity, TransformComponent)
    const pos = getComponent(entity, TransformComponent).position
    transform.position.set(pos.x, pos.y + 1.5, pos.z)
    transform.scale.multiplyScalar(15)
  }, [sceneLoaded.value])

  return null
}

export default defineSystem({
  uuid: 'uvx.bubble-pop.BubbleUISystem',
  insert: { with: SimulationSystemGroup },
  execute,
  reactor
})
