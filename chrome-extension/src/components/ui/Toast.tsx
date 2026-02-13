import { useEffect } from "react"

interface ToastProps {
  message: string
  type: "success" | "error" | "info"
  onClose: () => void
}

const typeStyles: Record<ToastProps["type"], string> = {
  success: "border-emerald-300/60 bg-card text-foreground",
  error: "border-destructive/45 bg-card text-foreground",
  info: "border-border bg-card text-foreground",
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3200)
    return () => window.clearTimeout(timer)
  }, [onClose])

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[100]">
      <div
        className={`vp-float pointer-events-auto rounded-xl border px-4 py-3 text-[13px] font-medium shadow-[0_16px_32px_-24px_rgba(22,22,22,0.68)] ${typeStyles[type]}`}
      >
        {message}
      </div>
    </div>
  )
}

export default Toast
