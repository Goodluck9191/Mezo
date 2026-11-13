"use client";

import { useState } from "react";

import { reorderCategoriesAction } from "@/app/actions/menu";
import { ArrowRightIcon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";

/** Move a category up/down one slot within the visible order. */
export function CategoryMoveButton({
  direction,
  index,
  orderedIds,
  restaurantId,
  disabled,
}: {
  direction: "up" | "down";
  index: number;
  orderedIds: string[];
  restaurantId: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    const moved = [...orderedIds];
    const target = direction === "up" ? index - 1 : index + 1;

    if (target < 0 || target >= moved.length) {
      return;
    }

    [moved[index]!, moved[target]!] = [moved[target]!, moved[index]!];

    const formData = new FormData();
    formData.append("restaurantId", restaurantId);
    for (const id of moved) {
      formData.append("orderedId", id);
    }

    setPending(true);
    try {
      await reorderCategoriesAction(formData);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      aria-label={direction === "up" ? "Move category up" : "Move category down"}
      className="grid size-8 place-items-center rounded-full border border-border text-muted transition-colors hover:bg-surface hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      <ArrowRightIcon className={cn("size-3.5", direction === "up" ? "-rotate-90" : "rotate-90")} />
    </button>
  );
}
