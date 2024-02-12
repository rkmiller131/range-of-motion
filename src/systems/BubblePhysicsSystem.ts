import { ActiveCollisionTypes, ActiveEvents, ColliderDesc, JointData, RigidBodyDesc } from '@dimforge/rapier3d-compat'

import { AvatarRigComponent } from '@etherealengine/engine/src/avatar/components/AvatarAnimationComponent'
import { dispatchAction, getMutableState, getState, useHookstate } from '@etherealengine/hyperflux'

import { EntityUUID } from '@etherealengine/common/src/interfaces/EntityUUID'
import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import {
  Engine,
  Entity,
  SimulationSystemGroup,
  createEntity,
  defineQuery,
  defineSystem,
  getComponent,
  getOptionalComponent,
  setComponent
} from '@etherealengine/ecs'
import { ECSState } from '@etherealengine/ecs/src/ECSState'
import { SceneState } from '@etherealengine/engine/src/scene/Scene'
import { TransformComponent } from '@etherealengine/spatial'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { UUIDComponent } from '@etherealengine/spatial/src/common/UUIDComponent'
import { NetworkObjectComponent } from '@etherealengine/spatial/src/networking/components/NetworkObjectComponent'
import { WorldNetworkAction } from '@etherealengine/spatial/src/networking/functions/WorldNetworkAction'
import { Physics } from '@etherealengine/spatial/src/physics/classes/Physics'
import { CollisionComponent } from '@etherealengine/spatial/src/physics/components/CollisionComponent'
import { RigidBodyComponent } from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'
import { getInteractionGroups } from '@etherealengine/spatial/src/physics/functions/getInteractionGroups'
import { PhysicsState } from '@etherealengine/spatial/src/physics/state/PhysicsState'
import { useEffect } from 'react'
import { BubbleComponent } from '../components/BubbleComponent'
import { BubbleActions } from './BubbleState'

export enum BubbleCollisionGroups {
  // bitwise shifts. The values are often used in collision detection systems where each bit represents a specific category or group.
  // allows you to combine or check for groups efficiently
  Bubble = 1 << 10, // 1024
  Hand = 1 << 11 // 2048
}

const leftHandUUID = 'leftHand' as EntityUUID
const rightHandUUID = 'rightHand' as EntityUUID
const leftHandDynamicUUID = 'leftHandDynamic' as EntityUUID
const rightHandDynamicUUID = 'rightHandDynamic' as EntityUUID

const setupHand = (handedness: 'left' | 'right') => {
  const targetHandDynamic = createEntity()
  const targetHand = createEntity()

  // what's the difference between Right/Left Hand Kinematic and Dynamic?
  const physicsWorld = getState(PhysicsState).physicsWorld
  setComponent(targetHand, NameComponent, (handedness === 'right' ? 'Right' : 'Left') + 'Hand Kinematic')
  setComponent(targetHand, UUIDComponent, handedness === 'right' ? rightHandUUID : leftHandUUID)
  setComponent(targetHand, TransformComponent)

  // Why also do we need a fixed position for the hand?
  const handFixed = Physics.createRigidBody(targetHand, physicsWorld, RigidBodyDesc.kinematicPositionBased(), [])

  const kinematicBody = getComponent(targetHand, RigidBodyComponent)
  kinematicBody.targetKinematicLerpMultiplier = 50 // what's this? If 0 automatically moves body to target pose, what does 50 do?

  setComponent(targetHandDynamic, NameComponent, handedness === 'right' ? 'Right' : 'Left' + 'Hand Dynamic')
  setComponent(targetHandDynamic, UUIDComponent, handedness === 'right' ? rightHandDynamicUUID : leftHandDynamicUUID)
  setComponent(targetHandDynamic, TransformComponent)

  const handColliderDesc = ColliderDesc.ball(0.1) // creating a new collider that is in the shape of a ball, radius 0.1
  const handInteractionGroups = getInteractionGroups(BubbleCollisionGroups.Hand, BubbleCollisionGroups.Bubble) // setting up bitwise shifting to allow hands and bubbles to interact with each other
  handColliderDesc.setCollisionGroups(handInteractionGroups) // does this mean both the hands and bubbles are shaped like balls? And can interact with each other upon the two balls hitting?
  handColliderDesc.setActiveCollisionTypes(ActiveCollisionTypes.ALL)
  handColliderDesc.setActiveEvents(ActiveEvents.COLLISION_EVENTS | ActiveEvents.CONTACT_FORCE_EVENTS)
  handColliderDesc.setMass(0.5)

  const handDynamic = Physics.createRigidBody(targetHandDynamic, physicsWorld, RigidBodyDesc.dynamic(), [
    handColliderDesc
  ])
  handDynamic.enableCcd(true)
  const handToDynamicJointData = JointData.fixed(
    { x: 0.0, y: 0.0, z: 0.0 },
    { w: 1.0, x: 0.0, y: 0.0, z: 0.0 },
    { x: 0.0, y: 0.0, z: 0.0 },
    { w: 1.0, x: 0.0, y: 0.0, z: 0.0 }
  )
  physicsWorld.createImpulseJoint(handToDynamicJointData, handFixed, handDynamic, true)
}

const setHandPosition = (handedness: 'left' | 'right', targetHand: Entity, targetHandDynamic: Entity) => {
  const rig = getComponent(Engine.instance.localClientEntity, AvatarRigComponent)

  const handPose = handedness === 'right' ? rig.rawRig.rightHand.node : rig.rawRig.leftHand.node
  const rigidbodyKinematic = getComponent(targetHand, RigidBodyComponent)
  const rigidbodyDynamic = getComponent(targetHandDynamic, RigidBodyComponent)
  handPose.getWorldPosition(rigidbodyKinematic.targetKinematicPosition)
  rigidbodyDynamic.body.wakeUp()
}

const testHandCollisions = (targetHandDynamic: Entity) => {
  const collisions = getComponent(targetHandDynamic, CollisionComponent)
  if (collisions?.size) {
    for (const [entity, collision] of Array.from(collisions)) {
      const rigidbody = getComponent(targetHandDynamic, RigidBodyComponent)
      console.log('rigid body is ', rigidbody)
      const networkComponent = getOptionalComponent(entity, NetworkObjectComponent)
      if (!networkComponent) continue
      const entityUUID = getComponent(entity, UUIDComponent)
      dispatchAction(
        BubbleActions.popBubble({
          playerPopped: true,
          entityUUID,
          velocity: rigidbody.linearVelocity,
          position: rigidbody.position
        })
      )
      dispatchAction(WorldNetworkAction.destroyObject({ entityUUID }))
    }
  }
}

const nameQuery = defineQuery([NameComponent])
const maxDist = 1.5
const query = defineQuery([RigidBodyComponent, BubbleComponent])

const execute = () => {
  if (!isClient) return

  const rig = getOptionalComponent(Engine.instance.localClientEntity, AvatarRigComponent)
  if (rig) {
    const rightHand = UUIDComponent.getEntityByUUID(rightHandUUID)
    const leftHand = UUIDComponent.getEntityByUUID(leftHandUUID)
    const rightHandDynamic = UUIDComponent.getEntityByUUID(rightHandDynamicUUID)
    const leftHandDynamic = UUIDComponent.getEntityByUUID(leftHandDynamicUUID)

    if (rightHand && leftHand && rightHandDynamic && leftHandDynamic) {
      setHandPosition('right', rightHand, rightHandDynamic)
      setHandPosition('left', leftHand, leftHandDynamic)
      testHandCollisions(rightHandDynamic)
      testHandCollisions(leftHandDynamic)
    }
  }

  const fixedDeltaSeconds = getState(ECSState).simulationTimestep / 1000

  for (const bubble of query()) {
    const transformComponent = getComponent(bubble, TransformComponent)

    if (transformComponent.position.z > maxDist) {
      const entityUUID = getComponent(bubble, UUIDComponent)
      dispatchAction(
        BubbleActions.popBubble({
          entityUUID,
          playerPopped: false
        })
      )
      dispatchAction(WorldNetworkAction.destroyObject({ entityUUID }))
      continue
    }

    const rigidbody = getComponent(bubble, RigidBodyComponent)

    const bubbleComponent = getComponent(bubble, BubbleComponent)
    transformComponent.position.z += fixedDeltaSeconds
    transformComponent.position.setY(
      bubbleComponent.startPosition.y + Math.sin(transformComponent.position.z * 2) * 0.1
    )
    transformComponent.position.setX(
      bubbleComponent.startPosition.x + Math.cos(transformComponent.position.z * 2) * 0.1
    )
    rigidbody.targetKinematicPosition.copy(transformComponent.position)
  }
}

const reactor = () => {
  if (!isClient) return null

  const sceneLoaded = useHookstate(getMutableState(SceneState).sceneLoaded)

  useEffect(() => {
    if (!sceneLoaded.value) return

    /** Ensure we only load this for scenes that are a bubble pop game */
    for (const entity of nameQuery()) {
      if (getComponent(entity, NameComponent) === 'Bubble Emitter') {
        setupHand('left')
        setupHand('right')
        break
      }
    }
  }, [sceneLoaded.value])

  return null
}

export default defineSystem({
  uuid: 'uvx.bubble-pop.BubblePhysicsSystem',
  insert: { with: SimulationSystemGroup },
  execute,
  reactor
})
