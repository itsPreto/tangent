import * as React from "react"
import { cn } from "../../utils/utils"

const Button = React.forwardRef(({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
  
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: [
      "border border-input hover:bg-accent hover:text-accent-foreground",
      // Light theme
      "text-foreground",
      // Dark theme
      "dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
      // Hextech Nordic theme
      "hextech-nordic:text-[hsl(183,100%,95%)] hextech-nordic:border-[hsl(195,96%,65%/0.3)] hextech-nordic:hover:bg-[hsl(195,96%,65%/0.1)] hextech-nordic:hover:border-[hsl(195,96%,65%/0.5)]",
      // Singed theme
      "singed-theme:text-[hsl(120,20%,95%)] singed-theme:border-[hsl(150,70%,35%/0.3)] singed-theme:hover:bg-[hsl(150,70%,35%/0.1)] singed-theme:hover:border-[hsl(150,70%,35%/0.5)]",
      // Celestial theme
      "celestial-theme:text-[hsl(280,100%,95%)] celestial-theme:border-[hsl(280,90%,70%/0.3)] celestial-theme:hover:bg-[hsl(280,90%,70%/0.1)] celestial-theme:hover:border-[hsl(280,90%,70%/0.5)]",
      // Void theme
      "void-theme:text-[hsl(240,20%,98%)] void-theme:border-[hsl(270,100%,60%/0.3)] void-theme:hover:bg-[hsl(270,100%,60%/0.1)] void-theme:hover:border-[hsl(270,100%,60%/0.5)]"
    ].join(" "),
    secondary: [
      "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      "dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
      "hextech-nordic:bg-[hsl(228,20%,20%)] hextech-nordic:text-[hsl(183,100%,95%)]",
      "singed-theme:bg-[hsl(165,25%,15%)] singed-theme:text-[hsl(120,20%,95%)]",
      "celestial-theme:bg-[hsl(280,25%,15%)] celestial-theme:text-[hsl(280,100%,95%)]",
      "void-theme:bg-[hsl(240,45%,8%)] void-theme:text-[hsl(240,20%,98%)]"
    ].join(" "),
    ghost: [
      "hover:bg-accent hover:text-accent-foreground",
      "text-foreground",
      "dark:text-slate-100 dark:hover:bg-slate-800",
      "hextech-nordic:text-[hsl(183,100%,95%)] hextech-nordic:hover:bg-[hsl(195,96%,65%/0.1)]",
      "singed-theme:text-[hsl(120,20%,95%)] singed-theme:hover:bg-[hsl(150,70%,35%/0.1)]",
      "celestial-theme:text-[hsl(280,100%,95%)] celestial-theme:hover:bg-[hsl(280,90%,70%/0.1)]",
      "void-theme:text-[hsl(240,20%,98%)] void-theme:hover:bg-[hsl(270,100%,60%/0.1)]"
    ].join(" "),
    link: [
      "text-primary underline-offset-4 hover:underline",
      "dark:text-blue-400",
      "hextech-nordic:text-[hsl(195,96%,65%)]",
      "singed-theme:text-[hsl(150,70%,35%)]",
      "celestial-theme:text-[hsl(280,90%,70%)]",
      "void-theme:text-[hsl(270,100%,60%)]"
    ].join(" ")
  }

  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10"
  }

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  )
})
Button.displayName = "Button"

export { Button }