export interface Rect { x: number; y: number; width: number; height: number }
export type EdgeSide = "left" | "right";

export function closestEdge(pet: Rect, screen: Rect): EdgeSide {
  const center = pet.x + pet.width / 2;
  return center < screen.x + screen.width / 2 ? "left" : "right";
}

/** Leave about 45% of the character visible at the nearest horizontal edge. */
export function peekX(pet: Rect, screen: Rect, side = closestEdge(pet, screen)): number {
  return side === "left"
    ? screen.x - Math.round(pet.width * .55)
    : screen.x + screen.width - Math.round(pet.width * .45);
}

export function revealX(pet: Rect, screen: Rect, side: EdgeSide): number {
  const margin = Math.min(8, Math.round(pet.width * .05));
  return side === "left"
    ? screen.x + margin
    : screen.x + screen.width - pet.width - margin;
}
