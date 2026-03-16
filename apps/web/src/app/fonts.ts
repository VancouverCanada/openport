import localFont from 'next/font/local'

export const notoSans = localFont({
  src: [
    { path: '../../public/fonts/noto-sans/NotoSans-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/noto-sans/NotoSans-Italic.ttf', weight: '400', style: 'italic' },
    { path: '../../public/fonts/noto-sans/NotoSans-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../../public/fonts/noto-sans/NotoSans-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../../public/fonts/noto-sans/NotoSans-Bold.ttf', weight: '700', style: 'normal' }
  ],
  variable: '--font-body',
  display: 'swap',
  preload: true
})

export const firaCode = localFont({
  src: [
    { path: '../../public/fonts/fira-code/FiraCode-Light.woff2', weight: '300', style: 'normal' },
    { path: '../../public/fonts/fira-code/FiraCode-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/fira-code/FiraCode-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/fira-code/FiraCode-SemiBold.woff2', weight: '600', style: 'normal' }
  ],
  variable: '--font-mono',
  display: 'swap',
  preload: true
})

export const dmSerifDisplay = localFont({
  src: [
    { path: '../../public/fonts/DMSerifDisplay-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/DMSerifDisplay-Italic.woff2', weight: '400', style: 'italic' }
  ],
  variable: '--font-serif',
  display: 'swap',
  preload: true
})

export const dinDisplay = localFont({
  src: [
    { path: '../../public/fonts/din/DIN Alternate Bold.ttf', weight: '700', style: 'normal' },
    { path: '../../public/fonts/din/DIN Condensed Bold.ttf', weight: '700', style: 'normal' }
  ],
  variable: '--font-din',
  display: 'swap',
  preload: true
})

export const calSans = localFont({
  src: [{ path: '../../public/fonts/cal-sans/CalSans-Regular.ttf', weight: '400', style: 'normal' }],
  variable: '--font-cal-sans',
  display: 'swap',
  preload: true
})
