import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat'
import { EntityUUID } from '@etherealengine/common/src/interfaces/EntityUUID'
import { UserID } from '@etherealengine/common/src/schema.type.module'
import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import { Entity, PresentationSystemGroup, defineSystem, getComponent, setComponent } from '@etherealengine/ecs'
import { defineAction, defineState, getMutableState, getState, none, useHookstate } from '@etherealengine/hyperflux'
import { TransformComponent } from '@etherealengine/spatial'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { UUIDComponent } from '@etherealengine/spatial/src/common/UUIDComponent'
import { boolean, matchesEntityUUID, matchesVector3 } from '@etherealengine/spatial/src/common/functions/MatchesUtils'
import { randomSphereOffset } from '@etherealengine/spatial/src/common/functions/MathFunctions'
import { WorldNetworkAction } from '@etherealengine/spatial/src/networking/functions/WorldNetworkAction'
import { Physics } from '@etherealengine/spatial/src/physics/classes/Physics'
import { getInteractionGroups } from '@etherealengine/spatial/src/physics/functions/getInteractionGroups'
import { PhysicsState } from '@etherealengine/spatial/src/physics/state/PhysicsState'
import { addObjectToGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import React, { useEffect } from 'react'
import { Mesh, SphereGeometry, Vector3 } from 'three'
import { createBubblePopEmitter } from '../BubbleParticles'
import { BubbleComponent } from '../components/BubbleComponent'
import { getBubbleMaterial } from '../materials/BubbleShader'
import { BubbleCollisionGroups } from './BubblePhysicsSystem'
import matches from 'ts-matches'
import { BubbleEmitterComponent } from '../components/BubbleEmitterComponent'

export const PractitionerActions = {
  setReps: defineAction({
    type: 'uvx.rom-game.SET_REPS',
    entityUUID: matchesEntityUUID,
    reps: matches.number
  }),
  setSets: defineAction({
    type: 'uvx.rom-game.SET_SETS',
    entityUUID: matchesEntityUUID,
    sets: matches.number
  }),
  setTimeToPop: defineAction({
    type: 'uvx.rom-game.SET_POP_TIME',
    entityUUID: matchesEntityUUID,
    timeToPop: matches.number
  })
}

export type PractitionerSettingsType = Array<{
  reps: number,
}>

export const PractitionerSettingsState = defineState({
  name: 'uvx.rom-game.PractitionerSettingsState',
  initial: {} as PractitionerSettingsType,

  receptors: {
    onSetReps: PractitionerActions.setReps.receive((action) => {
      const { reps = 5 } = action;
      // update the bubbleEmitter onInit's bubbleQuantity to have the number of reps received from the action.
    })
  }
})
export const BubbleScoreState = defineState({
  name: 'uvx.bubble-pop.BubbleScoreState',
  initial: {} as Record<UserID, ScoreType>,

  receptors: {
    onPopBubble: BubbleActions.popBubble.receive((action) => {
      console.log('action is ', action)
      console.log('mutable state for this entity? ', getMutableState(BubbleScoreState)[action.entityUUID])
      getMutableState(BubbleScoreState)[action.entityUUID].merge([
        // when popBubble gets dispatched, these actions are passed. See BubblePhysicsSystem for dispatch
        {
          time: action.$time,
          velocity: action.velocity,
          position: action.position,
        }
      ])
    })
  }
})

export const BubbleEntityState = defineState({
  name: 'uvx.bubble-pop.BubbleEntityState',
  initial: {} as Record<EntityUUID, true>,

  receptors: {
    onSpawnBubble: BubbleActions.spawnBubble.receive((action) => {
      getMutableState(BubbleEntityState)[action.entityUUID].set(true)
    }),
    onPopBubble: WorldNetworkAction.destroyObject.receive((action) => {
      getMutableState(BubbleEntityState)[action.entityUUID].set(none)
    })
  }
})

export const makeBubble = (entity: Entity, emitter: Entity) => {
  if (isClient) {
    const bubbleGeometry = new SphereGeometry(0.1, 8, 8)
    addObjectToGroup(entity, new Mesh(bubbleGeometry, getBubbleMaterial()))
  }

  const uuid = getComponent(entity, UUIDComponent)
  setComponent(entity, NameComponent, uuid)
  setComponent(entity, VisibleComponent)

  const transform = getComponent(entity, TransformComponent)
  setComponent(entity, BubbleComponent, { startPosition: transform.position.clone() })

  const bubbleColliderDesc = ColliderDesc.ball(0.1)
  const bubbleInteractionGroups = getInteractionGroups(BubbleCollisionGroups.Bubble, BubbleCollisionGroups.Hand)
  bubbleColliderDesc.setCollisionGroups(bubbleInteractionGroups)
  bubbleColliderDesc.setMass(0.001)

  const physicsWorld = getState(PhysicsState).physicsWorld
  Physics.createRigidBody(entity, physicsWorld, RigidBodyDesc.kinematicPositionBased(), [bubbleColliderDesc])
}

/** @todo these should be put in hyperflux state */
const { particleEntity, particleSystem } = createBubblePopEmitter()

const BubbleEntityReactor = ({ entityUUID }: { entityUUID: EntityUUID }) => {
  const entity = UUIDComponent.useEntityByUUID(entityUUID)

  useEffect(() => {
    if (!entity) return
    makeBubble(entity, particleEntity)
  }, [entity])

  return null
}

const UserScoreReactor = ({ userID }: { userID: UserID }) => {
  const scoreState = useHookstate(getMutableState(BubbleScoreState)[userID])

  useEffect(() => {
    if (scoreState.length === 0) return

    const pos = scoreState.value.at(-1)?.position

    if (!pos) return

    getComponent(particleEntity, TransformComponent).position.set(pos.x, pos.y, pos.z)
    particleSystem.restart()
  }, [scoreState.length])

  return null
}

const reactor = () => {
  const bubbleEntities = useHookstate(getMutableState(BubbleEntityState))
  const scoreState = useHookstate(getMutableState(BubbleScoreState))

  return (
    <>
      {bubbleEntities.keys.map((entityUUID: EntityUUID) => (
        <BubbleEntityReactor key={entityUUID} entityUUID={entityUUID} />
      ))}
      {scoreState.keys.map((userID: UserID) => (
        <UserScoreReactor key={userID} userID={userID} />
      ))}
    </>
  )
}
export const BubbleStateSystem = defineSystem({
  uuid: 'uvx.bubble-pop.BubbleStateSystem',
  insert: { after: PresentationSystemGroup },
  reactor
})