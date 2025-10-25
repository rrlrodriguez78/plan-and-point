import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:bg-gradient-to-r group-[.toaster]:from-red-500 group-[.toaster]:to-pink-600 group-[.toaster]:text-white group-[.toaster]:border-red-400 group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-md",
        },
        duration: 4000,
        closeButton: true,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
