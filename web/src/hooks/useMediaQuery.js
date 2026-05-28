import { useState, useEffect } from 'react'

/**
 * 响应式断点检测 hook
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event) => setMatches(event.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

/**
 * 常用断点
 */
export const BREAKPOINTS = {
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1199px)',
  desktop: '(min-width: 1200px)'
}

/**
 * 检测是否为移动端
 */
export function useIsMobile() {
  return useMediaQuery(BREAKPOINTS.mobile)
}

/**
 * 检测是否为平板
 */
export function useIsTablet() {
  return useMediaQuery(BREAKPOINTS.tablet)
}

/**
 * 检测是否为桌面
 */
export function useIsDesktop() {
  return useMediaQuery(BREAKPOINTS.desktop)
}

export default { useMediaQuery, BREAKPOINTS, useIsMobile, useIsTablet, useIsDesktop }