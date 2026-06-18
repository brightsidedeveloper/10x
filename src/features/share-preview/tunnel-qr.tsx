import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type Props = {
  /** URL to encode. */
  value: string
  /** Pixel size of the rendered QR (square). */
  size?: number
}

/** Renders a scannable QR code for a URL as a PNG data-URL image. */
export function TunnelQr({ value, size = 160 }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-border bg-muted/30 text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        QR…
      </div>
    )
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={`QR code for ${value}`}
      className="rounded-md border border-border bg-white p-1"
    />
  )
}
