import { defineComponent, getComponent, setComponent, useEntityContext } from '@etherealengine/ecs'
import { Vector3, SphereGeometry, Mesh } from 'three'
import matches from 'ts-matches'
import { useEffect } from 'react'
import { addObjectToGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import  { TransformComponent } from '@etherealengine/spatial'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import { getBubbleMaterial } from '../materials/BubbleShader'
import { UUIDComponent } from '@etherealengine/spatial/src/common/UUIDComponent'
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat'
import { getInteractionGroups } from '@etherealengine/spatial/src/physics/functions/getInteractionGroups'
import { BubbleCollisionGroups } from '../systems/BubblePhysicsSystem'
import { getState } from '@etherealengine/hyperflux'
import { Physics } from '@etherealengine/spatial/src/physics/classes/Physics'
import { PhysicsState } from '@etherealengine/spatial/src/physics/state/PhysicsState'

// every bubble has a starting position and age so that we can adjust its initial pos and keep track of its life timer
// Timer is tracked incrementally - emitter component will have an array of these bubbles and iterate through on an interval
// So bubble 0 in the array has like... 3 sec life, then pops. Then shift. Then next bubble has 5 sec life, etc.
export const BubbleComponent = defineComponent({
  name: 'Bubble',
  onInit(entity) {
    return {
      // age: 3 as number,
      angle: 0,
      opacity: 0.5, // I want bubbles to be slightly transparent, where only one bubble at a time gets full opacity
    }
  },

  onSet: (entity, component, json) => {
    if (!json) return
    // if (matches.number.test(json.age)) component.age = json.age
    if (matches.number.test(json.opacity)) component.opacity = json.opacity
    if (matches.number.test(json.angle)) component.angle = json.angle
  },

  // // when the individual bubble is first spawned/initialized, it gets set up with geometry and colliders here
  // reactor: () => {
  //   const entity = useEntityContext();

  //   useEffect(() => {
  //     const bubbleGeometry = new SphereGeometry(0.1, 8, 8);
  //     addObjectToGroup(entity, new Mesh(bubbleGeometry, getBubbleMaterial()));

  //     const uuid = getComponent(entity, UUIDComponent);
  //     setComponent(entity, NameComponent, uuid);
  //     setComponent(entity, VisibleComponent);
  //     setComponent(entity, TransformComponent); // note to self, look back at line 79 in bubble state.

  //     const bubbleColliderDesc = ColliderDesc.ball(0.1);
  //     const bubbleInteractionGroups = getInteractionGroups(BubbleCollisionGroups.Bubble, BubbleCollisionGroups.Hand);
  //     bubbleColliderDesc.setCollisionGroups(bubbleInteractionGroups);
  //     bubbleColliderDesc.setMass(0.5);

  //     const physicsWorld = getState(PhysicsState).physicsWorld;
  //     Physics.createRigidBody(entity, physicsWorld, RigidBodyDesc.kinematicPositionBased());

  //   }, [])

  //   return null;
  // }
})
