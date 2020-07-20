import {
  useReducer,
  Reducer,
  ReducerState,
  Dispatch,
  ReducerAction
} from "react"
type ReducerType = Reducer<any, any>
type State = {
  [key: string]: any
}
const customReducer = (prevState: State, updatedProperty: Partial<State>) => ({
  ...prevState,
  ...updatedProperty
})
function useCustomReducer<S extends ReducerState<ReducerType>>(
  initialState: S
): [S, Dispatch<ReducerAction<any>>] {
  return useReducer<ReducerType>(customReducer, initialState)
}
export default useCustomReducer
