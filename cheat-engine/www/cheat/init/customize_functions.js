import {MessageCheat} from '../js/CheatHelper.js'
import {installOverlayInput} from '../js/OverlayInput.js'

export function customizeRPGMakerFunctions (mainComponent) {
    const restoreInput = installOverlayInput(mainComponent)
    MessageCheat.initialize()
    return restoreInput
}
