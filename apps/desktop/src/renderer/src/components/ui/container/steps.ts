/**
 * Container query steps (Tailwind's container scale at the 14px root):
 * sm 24rem · md 28rem · lg 32rem · xl 36rem · 2xl 42rem · 3xl 48rem ·
 * 4xl 56rem · 5xl 64rem · 6xl 72rem · 7xl 80rem.
 *
 * Components that switch layout by width query the nearest container with
 * unnamed `@<step>:` variants; components that offer a threshold as a prop
 * type it with this union and keep a static class map per step so Tailwind
 * sees every class.
 */
export const CONTAINER_STEPS = [
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl'
] as const

export type ContainerStep = (typeof CONTAINER_STEPS)[number]
