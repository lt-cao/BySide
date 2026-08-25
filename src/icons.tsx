import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = { viewBox: "0 0 18 18", "aria-hidden": true } as const;

export function LayoutColumnsIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="1.5" y="2" width="6.25" height="14" rx="1.2"/><rect x="10.25" y="2" width="6.25" height="14" rx="1.2"/></svg>;
}

export function LayoutRowsIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="2" y="1.5" width="14" height="6.25" rx="1.2"/><rect x="2" y="10.25" width="14" height="6.25" rx="1.2"/></svg>;
}

export function BeforeAfterIcon(props: IconProps) {
  return <svg {...base} {...props}>
    <rect x="1.75" y="2" width="14.5" height="14" rx="2"/>
    <path d="M9 2v14M6.7 7 4.8 9l1.9 2M11.3 7l1.9 2-1.9 2"/>
  </svg>;
}

export function RulerIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M3.4 14.6 14.6 3.4a1.35 1.35 0 0 1 1.9 0l.1.1a1.35 1.35 0 0 1 0 1.9L5.4 16.6a1.35 1.35 0 0 1-1.9 0l-.1-.1a1.35 1.35 0 0 1 0-1.9Z"/><path d="m12.4 5.6 1.4 1.4M10.1 7.9l1.4 1.4M7.8 10.2l1.4 1.4M5.5 12.5l1.4 1.4"/></svg>;
}

export function ResetIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M3.4 6.3A6.3 6.3 0 1 1 3 11.7"/><path d="M2.4 2.8v4.1h4.1"/></svg>;
}

export function ImageAddIcon(props: IconProps) {
  return <svg viewBox="0 0 48 48" aria-hidden="true" {...props}><rect x="6" y="9" width="29" height="28" rx="3"/><circle cx="16" cy="18" r="3"/><path d="m9 33 9-9 6 6 4-4 7 7M39 12v12M33 18h12"/></svg>;
}

export function MinimizeIcon(props: IconProps) {
  return <svg viewBox="0 0 12 12" aria-hidden="true" {...props}><path d="M1.5 6.5h9"/></svg>;
}

export function MaximizeIcon(props: IconProps) {
  return <svg viewBox="0 0 12 12" aria-hidden="true" {...props}><rect x="1.75" y="1.75" width="8.5" height="8.5"/></svg>;
}

export function CloseIcon(props: IconProps) {
  return <svg viewBox="0 0 12 12" aria-hidden="true" {...props}><path d="m2 2 8 8M10 2 2 10"/></svg>;
}
