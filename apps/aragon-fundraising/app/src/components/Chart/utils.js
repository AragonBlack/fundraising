import { differenceInDays, format, startOfMinute, startOfMonth, startOfWeek } from 'date-fns'

// TODO: filter DAI orders

const roundTimeHalfAnHour = time => {
  const timeToReturn = new Date(time)
  timeToReturn.setMilliseconds(Math.round(time.getMilliseconds() / 1000) * 1000)
  timeToReturn.setSeconds(Math.round(timeToReturn.getSeconds() / 60) * 60)
  timeToReturn.setMinutes(Math.round(timeToReturn.getMinutes() / 30) * 30)
  return timeToReturn
}

const roundTime6Hours = time => {
  const timeToReturn = new Date(time)
  timeToReturn.setMilliseconds(Math.round(time.getMilliseconds() / 1000) * 1000)
  timeToReturn.setSeconds(Math.round(timeToReturn.getSeconds() / 60) * 60)
  timeToReturn.setMinutes(Math.round(timeToReturn.getMinutes() / 60) * 60)
  timeToReturn.setHours(Math.round(timeToReturn.getHours() / 6) * 6)
  return timeToReturn
}

const roundTime12Hours = time => {
  const timeToReturn = new Date(time)
  timeToReturn.setMilliseconds(Math.round(time.getMilliseconds() / 1000) * 1000)
  timeToReturn.setSeconds(Math.round(timeToReturn.getSeconds() / 60) * 60)
  timeToReturn.setMinutes(Math.round(timeToReturn.getMinutes() / 60) * 60)
  timeToReturn.setHours(Math.round(timeToReturn.getHours() / 12) * 12)
  return timeToReturn
}

const getFilteredData = (data, timestampFilter) => {
  const cache = {}
  data.forEach(item => {
    const timestamp = timestampFilter(item.timestamp).getTime()
    const current = cache[timestamp]
    let avg, iteration
    if (current) {
      avg = item.startPrice.plus(current.avg.times(current.iteration)).div(current.iteration + 1)
      iteration = current.iteration + 1
    } else {
      avg = item.startPrice
      iteration = 1
    }
    cache[timestamp] = {
      avg,
      iteration,
    }
  })
  return cache
}

export const filter = (batches, period, interval) => {
  if (!batches) return []
  if (period === 0) {
    const cache = getFilteredData(batches, startOfMinute)

    return Object.keys(cache)
      .slice(-60)
      .map(key => ({
        price: cache[key].avg.toFixed(2),
        date: format(Number(key), 'HH:mm'),
      }))
  }

  if (period === 1) {
    const cache = getFilteredData(batches, timestamp => roundTimeHalfAnHour(new Date(timestamp)))

    return Object.keys(cache)
      .slice(-48)
      .map(key => ({
        price: cache[key].avg.toFixed(2),
        date: format(Number(key), 'MMM dd HH:mm'),
      }))
  }

  if (period === 2) {
    const cache = getFilteredData(batches, timestamp => roundTime12Hours(new Date(timestamp)))

    return Object.keys(cache)
      .slice(-60)
      .map(key => ({
        price: cache[key].avg.toFixed(2),
        date: format(Number(key), 'MMM dd HH:mm'),
      }))
  }

  if (period === 3) {
    const cache = getFilteredData(batches, startOfWeek)

    return Object.keys(cache)
      .slice(-56)
      .map(key => ({
        price: cache[key].avg.toFixed(2),
        date: format(Number(key), 'y MMM dd'),
      }))
  }

  if (period === 4) {
    const cache = getFilteredData(batches, startOfMonth)

    return Object.keys(cache).map(key => ({
      price: cache[key].avg.toFixed(2),
      date: format(Number(key), 'y MMM dd'),
    }))
  }

  if (period === 5) {
    const difference = differenceInDays(interval.end, interval.start)
    if (difference < 2) {
      const cache = getFilteredData(batches, timestamp => roundTimeHalfAnHour(new Date(timestamp)))

      return Object.keys(cache)
        .filter(key => Number(key) > interval.start && Number(key) < interval.end)
        .map(key => ({
          price: cache[key].avg.toFixed(2),
          date: format(Number(key), 'MMM dd HH:mm'),
        }))
    } else if (difference < 31) {
      const cache = getFilteredData(batches, timestamp => roundTime6Hours(new Date(timestamp)))

      return Object.keys(cache)
        .filter(key => Number(key) > interval.start && Number(key) < interval.end)
        .map(key => ({
          price: cache[key].avg.toFixed(2),
          date: format(Number(key), 'MMM dd HH:mm'),
        }))
    } else if (difference < 365) {
      const cache = getFilteredData(batches, startOfWeek)

      return Object.keys(cache)
        .filter(key => Number(key) > interval.start && Number(key) < interval.end)
        .map(key => ({
          price: cache[key].avg.toFixed(2),
          date: format(Number(key), 'y MMM dd'),
        }))
    } else {
      const cache = getFilteredData(batches, startOfMonth)

      return Object.keys(cache)
        .filter(key => Number(key) > interval.start && Number(key) < interval.end)
        .map(key => ({
          price: cache[key].avg.toFixed(2),
          date: format(Number(key), 'y MMM dd'),
        }))
    }
  }
}
