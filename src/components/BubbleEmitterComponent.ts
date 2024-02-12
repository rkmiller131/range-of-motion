import { EntityUUID } from '@etherealengine/common/src/interfaces/EntityUUID'
import {
  defineComponent,
  Entity,
  useEntityContext,
  useComponent,
  removeEntity,
  getComponent,
  createEntity,
  useExecute,
  getMutableComponent,
  setComponent,
  SimulationSystemGroup,
} from '@etherealengine/ecs'

import { getState, NO_PROXY } from '@etherealengine/hyperflux'
import { Vector3, Mesh, BufferGeometry, MeshStandardMaterial, MathUtils, Quaternion } from 'three'
import { BubbleComponent } from './BubbleComponent'

import { ECSState } from '@etherealengine/ecs/src/ECSState'
import { GroupComponent } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { TransformComponent } from '@etherealengine/spatial/src/transform/components/TransformComponent'
import React, { useEffect } from 'react'
import matches from 'ts-matches'
import { makeBubble } from '../systems/BubbleState'
import { createBubblePopEmitter } from '../BubbleParticles'

export const BubbleEmitterComponent = defineComponent({
  name: 'Bubble Emitter Component',
  jsonID: 'bubbleEmitter',
  onInit: (entity) => {
    // OnInit, I want these bubbles to spawn on either the left or right side of the avatar, and remain static.
    // Left and Right information determine + or - for bubble angle, and will have to be pulled from global practitioner state.
    return {
      position: new Vector3(), // center the array at almost an arm's length away from avatar,
      // bubbleQuantity: 5, // how many bubbles should exist in the array - also set by practitioner input
      bubbleEntities: [] as Entity[] | null
    }
  },

  onSet: (entity, component, json) => {
      if (!json) return
      if (json.position?.isVector3) component.position.set(json.position);
      // if (matches.number.test(json.bubbleQuantity)) component.bubbleQuantity = json.bubbleQuantity;
    },

    toJSON: (entity, component) => {
      return {
        position: component.position.value,
        // bubbleQuantity: component.bubbleQuantity.value,
      }
    },

    reactor: () => {
      const entity = useEntityContext();
      const emitterComponent = useComponent(entity, BubbleEmitterComponent);

      useEffect(() => {
        return () => {
          for (let ent of emitterComponent.bubbleEntities.value!) {
            removeEntity(ent)
          }
        }
      }, [])

      useEffect(() => {
        // if the length ever hits 0, then remove the whole emitter and eventually dispatch to the global state that a set has been complete
        if (emitterComponent.bubbleEntities.value!.length === 0) {
          removeEntity(emitterComponent);
        }
        // if we've lost a bubble (it was popped by player or time), then make the first bubble bright and give collider
        const activeBubbleEntity = emitterComponent.bubbleEntities.value![0];
        const activeBubbleComponent = getMutableComponent(emitterComponent.bubbleEntities.value![0], BubbleComponent);

        activeBubbleComponent.opacity.set(1);

        const { particleEntity } = createBubblePopEmitter();
        makeBubble(activeBubbleEntity, particleEntity);

        // every time the bubble at index 0 in bubble entities array is a different bubble reference (the array has shifted)
      }, [emitterComponent.bubbleEntities.value![0]])

      // when an emitter is created, get how many targets we need from global practitioner state
      // spawn that many bubbles (without colliders), and distribute them evenly (180 degrees/num of desired targets)

    }

  }

    // a useEffect with dependencies will run whenever the dependencies change
    // Whenever the color is changed this will rerun and update all child bubble materials
    useEffect(() => {
      for (let ent of emitterComponent.bubbleEntities.value!) {
        const groupComponent = getComponent(ent, GroupComponent)
        const obj = groupComponent[0]
        obj.traverse((obj: Mesh<BufferGeometry, MeshStandardMaterial>) => {
          if (obj.isMesh) {
            const material = obj.material as MeshStandardMaterial
            material.color.copy(emitterComponent.color.value)
          }
        })
      }
    }, [emitterComponent.color])

    // useExecute is a way we can define a System within a reactive context
    // Systems will run once per frame
    // You must explicitly say where you want your system to run(i.e. after SimulationSystemGroup)
    useExecute(
      () => {
        const deltaSeconds = getState(ECSState).deltaSeconds
        ageEmitterBubbles(entity, deltaSeconds) // This function is accumulating the age of every bubble with the time from deltaSeconds.
        // deltaSeconds is the time since the last system execute occured

        // Spawning a single bubble as an example
        // [Exercise 1]: Using this system. Spawn multiple bubbles with varying x,z Localtransform positons
        // [Exercise 3]: Remove them if they are too old(bubble.age > N seconds)[This can be done in a couple ways(reactively and within this sytem synchronosly)]
        if (emitterComponent.bubbleEntities.value!.length < 1) {
          //For example ensuring there is only one bubble being added
          const bubbleEntity = createEntity()
          setComponent(bubbleEntity, BubbleComponent)
          setComponent(bubbleEntity, EntityTreeComponent, {
            parentEntity: entity,
            uuid: MathUtils.generateUUID() as EntityUUID
          })
          emitterComponent.bubbleEntities.merge([bubbleEntity])
        }

        const bubble = getComponent(emitterComponent.bubbleEntities.value![0], BubbleComponent)

        if (bubble.age >= 5) {
          // Delete one bubble after its age is greater than 5 seconds
          removeBubble(entity, emitterComponent.bubbleEntities.value![0])
        }
      },
      { after: SimulationSystemGroup }
    )

    return null
  }
})

// These functions are not to be changed (unless there's a bug in them and I messed up.)

/**
 * Remove bubble entity from emitter
 */
export function removeBubble(emitterEntity: Entity, bubbleEntity: Entity): void {
  const emitter = getMutableComponent(emitterEntity, BubbleEmitterComponent) // Reactive incase someone wants to use it reactively
  const currEntities = emitter.bubbleEntities.get(NO_PROXY)!
  const index = currEntities.indexOf(bubbleEntity)
  if (index > -1) {
    // only splice array when item is found
    currEntities.splice(index, 1) // deletes one entiry from array in place. 2nd Parameter means remove only one
    emitter.bubbleEntities.set(currEntities)
    removeEntity(bubbleEntity) // removes the given entity from the ECS
  }
}

export function ageEmitterBubbles(emitterEntity: Entity, deltaSeconds: number): void {
  const emitter = getComponent(emitterEntity, BubbleEmitterComponent)
  for (const bubbleEntity of emitter.bubbleEntities!) {
    const bubble = getMutableComponent(bubbleEntity, BubbleComponent) // getMutable gets the reactified version of the component that will respond to effects(if you want to try checking age reactively)
    const currAge = bubble.age.get(NO_PROXY)
    bubble.age.set(currAge + deltaSeconds) // increment individual bubble age.
  }
}