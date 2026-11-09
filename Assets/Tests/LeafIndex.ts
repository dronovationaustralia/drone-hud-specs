import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {C1StartFlightPinchScenario} from "./C1StartFlightPinchScenario"
import {C2FlightTagScenario} from "./C2FlightTagScenario"
import {C3ReturnHomeScenario} from "./C3ReturnHomeScenario"
import {C4OffViewArrowScenario} from "./C4OffViewArrowScenario"
import {C5LandedResetScenario} from "./C5LandedResetScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-start-flight-pinch", typename: C1StartFlightPinchScenario.getTypeName()},
    {id: "c2-flight-tag", typename: C2FlightTagScenario.getTypeName()},
    {id: "c3-return-home", typename: C3ReturnHomeScenario.getTypeName()},
    {id: "c4-off-view-arrow", typename: C4OffViewArrowScenario.getTypeName()},
    {id: "c5-landed-reset", typename: C5LandedResetScenario.getTypeName()},
  ]
}
