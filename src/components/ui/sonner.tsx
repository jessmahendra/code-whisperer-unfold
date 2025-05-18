

import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
        // Reduce the toast duration to 3 seconds (from the default 4 seconds)
        duration: 3000,
      }}
      // Explicitly set closeButton to true to ensure dismiss option is visible
      closeButton={true}
      // Set position to bottom-right for consistency
      position="bottom-right"
      {...props}
    />
  )
}

// Force dismiss any toast by ID
const dismissToast = (id?: string) => {
  if (id) {
    toast.dismiss(id);
  } else {
    // Dismiss all toasts if no ID is provided
    toast.dismiss();
  }
};

export { Toaster, toast, dismissToast }

