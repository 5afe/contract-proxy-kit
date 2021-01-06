type Json = string | number | boolean | null | undefined | JsonObject | Json[]

type JsonObject = { [property: string]: Json }

export type Address = string

export type Abi = JsonObject[]

export type NumberLike = number | string | bigint | Record<string, any>
