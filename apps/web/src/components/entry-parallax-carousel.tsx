'use client'

import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useRef } from 'react'

type Slide = {
  id: string
  imageUrl: string
  objectPosition: string
}

const slides: Slide[] = [
  { id: '1', imageUrl: '/images/openport-hero.jpg', objectPosition: 'center 38%' },
  { id: '2', imageUrl: '/images/openport-hero.jpg', objectPosition: 'center 52%' },
  { id: '3', imageUrl: '/images/openport-hero.jpg', objectPosition: 'center 64%' }
]

function useParallax(mainApi: ReturnType<typeof useEmblaCarousel>[1], enabled: boolean): void {
  const tweenFactor = useRef(0)
  const tweenNodes = useRef<HTMLElement[]>([])
  const factorBase = 0.24

  const setTweenNodes = useCallback((api: NonNullable<typeof mainApi>) => {
    tweenNodes.current = api
      .slideNodes()
      .map((node) => node.querySelector<HTMLElement>('.entry-carousel-parallax'))
      .filter((node): node is HTMLElement => Boolean(node))
  }, [])

  const setTweenFactor = useCallback((api: NonNullable<typeof mainApi>) => {
    tweenFactor.current = factorBase * api.scrollSnapList().length
  }, [])

  const tween = useCallback((api: NonNullable<typeof mainApi>, eventName?: string) => {
    const engine = api.internalEngine()
    const progress = api.scrollProgress()
    const inView = api.slidesInView()
    const isScrollEvent = eventName === 'scroll'

    api.scrollSnapList().forEach((snap, snapIndex) => {
      let diffToTarget = snap - progress
      const slidesInSnap = engine.slideRegistry[snapIndex]

      slidesInSnap.forEach((slideIndex) => {
        if (isScrollEvent && !inView.includes(slideIndex)) return

        if (engine.options.loop) {
          engine.slideLooper.loopPoints.forEach((loopItem) => {
            const target = loopItem.target()
            if (slideIndex === loopItem.index && target !== 0) {
              const sign = Math.sign(target)
              if (sign === -1) diffToTarget = snap - (1 + progress)
              if (sign === 1) diffToTarget = snap + (1 - progress)
            }
          })
        }

        const translateValue = diffToTarget * (-1 * tweenFactor.current) * 100
        const node = tweenNodes.current[slideIndex]
        if (node) node.style.transform = `translateX(${translateValue}%)`
      })
    })
  }, [])

  useEffect(() => {
    if (!mainApi || !enabled) return
    setTweenNodes(mainApi)
    setTweenFactor(mainApi)
    tween(mainApi)
    mainApi.on('reInit', setTweenNodes).on('reInit', setTweenFactor).on('reInit', tween).on('scroll', tween).on('slideFocus', tween)
  }, [enabled, mainApi, setTweenFactor, setTweenNodes, tween])
}

export function EntryParallaxCarousel() {
  const [viewportRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: true,
    skipSnaps: false
  })

  useParallax(emblaApi, true)

  return (
    <section aria-label="OpenPort preview" className="entry-carousel">
      <div className="entry-carousel-viewport" ref={viewportRef}>
        <div className="entry-carousel-container">
          {slides.map((slide) => (
            <div className="entry-carousel-slide" key={slide.id}>
              <div className="entry-carousel-parallax">
                <img alt="" aria-hidden="true" src={slide.imageUrl} style={{ objectPosition: slide.objectPosition }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

