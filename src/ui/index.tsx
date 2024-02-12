import React from 'react'
import { Vector3 } from 'three'

import { getMutableState, useHookstate } from '@etherealengine/hyperflux'
import { createXRUI } from '@etherealengine/spatial/src/xrui/functions/createXRUI'
import { BubbleScoreState, ScoreType } from '../systems/BubbleState'

export const createCounterView = (entity: number) => {
  const ui = createXRUI(function Counter() {
    return <CounterView entity={entity} />
  })
  return ui
}

// const StatsStyle = (props) => {
//   return (
//     <style>{`
//     #stats-container {
//       align-items: center;
//       font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
//     }

//     #score-number {
//       font-size: 48px;
//       color: white;
//     }

//     #statistics-heading {
//       font-size: 16px;
//       font-weight: bold;
//       color: white;
//     }

//     #statistic {
//       font-size: 14px;
//       color: white;
//     }
//     `}</style>
//   )
// }

const CounterView = (props) => {
  const scoreState = useHookstate(getMutableState(BubbleScoreState)).value
  /** @todo for now, we only have UI for one user, so just grab the first user in the state */

  // console.log('score state is ', scoreState)
  const userState = scoreState[Object.keys(scoreState)[0]] as ScoreType | undefined
  // console.log('user state is ', userState)
  const last = userState?.at(-1)
  // console.log('last is ', last)
  const count = userState?.length ?? 0

  const vel = last?.velocity ? new Vector3(last.velocity.x, last.velocity.y, last.velocity.z) : new Vector3(0, 0, 0)

  const velocityDisplay = `velocity length: ${vel.length().toFixed(2)}`

  const pos = last?.position ? last.position : new Vector3(0, 0, 0)
  const positionDisplay = `distance: ${pos.z.toFixed(2)}`

  return (
    <>
      {/* <StatsStyle />
      <div id="stats-container" xr-layer="true" xr-pixel-ratio="3">
        <div id="score-number" xr-layer="true" xr-pixel-ratio="4">
          {count}
        </div>
        <div id="statistics-heading" xr-layer="true">
          last pop stats:
        </div>
        <div id="statistic" xr-layer="true">
          {velocityDisplay}
        </div>
        <div id="statistic" xr-layer="true">
          {positionDisplay}
        </div>
      </div> */}
      <div className="flex items-center font-sans">
        <div className="text-4xl text-white">
          {count}
        </div>
        <div className="text-sm font-bold text-orange-500">
          last pop stats:
        </div>
        <div className="text-base text-white">
          {velocityDisplay}
        </div>
        <div className="text-base text-white">
          {positionDisplay}
        </div>
      </div>
    </>
  )
}
