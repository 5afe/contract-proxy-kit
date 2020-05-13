type Json =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | Json[];

type JsonObject = { [property: string]: Json }

export type Address = string;

export type Abi = JsonObject[];

export type NumberLike = number | string | bigint | object;
