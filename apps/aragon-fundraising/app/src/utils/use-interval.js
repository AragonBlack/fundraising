import { useEffect, useRef } from 'react'

/**
 * Interval hook that auto cleans on unmounting the component using it
 * @param {function} callback - function to be called
 * @param {Number} delay - interval delay
 * @returns {void}
 */
export const useInterval = (callback, delay) => {
  const savedCallback = useRef()

  // remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // set up the interval.
  useEffect(() => {
    const tick = () => {
      savedCallback.current()
    }
    if (delay !== null) {
      const id = setInterval(tick, delay)
      return () => clearInterval(id)
    }
  }, [delay])
}
