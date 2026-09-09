import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/20 text-primary border border-primary/30",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/20 text-rose-400 border border-destructive/30",
        outline: "text-foreground border-border",
        success:
          "border-transparent bg-emerald-950/60 text-emerald-400 border border-emerald-500/30",
        warning:
          "border-transparent bg-amber-950/60 text-amber-400 border border-amber-500/30",
        gold:
          "border-transparent bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm",
        silver:
          "border-transparent bg-slate-400/20 text-slate-300 border border-slate-400/50",
        bronze:
          "border-transparent bg-amber-800/20 text-amber-600 border border-amber-800/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
