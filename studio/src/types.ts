// The shape validatePayload enforces (studio/src/payload/contract.mjs). That file is the
// authority; this only gives the UI types for a payload that has already passed it.
export interface Descriptors { descriptors: string[]; note?: string }
export interface CustomProp { name: string; type: string; description?: string }
export interface CustomComponent { name: string; description: string; guidance?: string; props?: CustomProp[] }

export interface Payload {
  version: 1
  name: string
  brand: { name: string; tagline?: string; mission?: string; vision?: string; voice?: Descriptors; tone?: Descriptors }
  tokens: { light?: Record<string, string>; dark?: Record<string, string>; fonts?: Record<string, string> }
  components?: { custom?: CustomComponent[] }
}
