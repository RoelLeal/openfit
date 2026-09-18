/**
 * Passes a newly created food back to the screen that asked for it
 * (add-food or the meal editor) while navigating back in history.
 */
let pendingFoodId: string | null = null;

export function handOffFood(id: string): void {
  pendingFoodId = id;
}

export function takeHandedOffFood(): string | null {
  const id = pendingFoodId;
  pendingFoodId = null;
  return id;
}
