
const _ = require('lodash')
const {fetchPostProcessedRadarFrame} = require('./fmi-radar-images')
const {fetchRadarImageUrls} = require('./fmi-radar-frames')
const fs = require('fs')
const os = require('os')
const path = require('path')

/* eslint-disable no-await-in-loop */

const CACHE_FOLDER = fs.mkdtempSync(path.join(os.tmpdir(), 'sataako-frames-'))
console.log(`Radar frames cached at ${CACHE_FOLDER}`)

const IMAGE_CACHE = []
const REFRESH_ONE_MINUTE = 60 * 1000

refreshCache()

async function refreshCache() {
  try {
    const radarImageUrls = await fetchRadarImageUrls()
    const newImageUrls = radarImageUrls.filter(({url}) => !_.find(IMAGE_CACHE, {url}))
    await fetchAndCacheImages(newImageUrls)
    await pruneCache(radarImageUrls)
  } catch (err) {
    console.error(`Failed to fetch radar frames list from FMI API: ${err.message}`)
  }

  setTimeout(refreshCache, REFRESH_ONE_MINUTE)
}

async function fetchAndCacheImages(imageUrls) {
  for (const {url, timestamp} of imageUrls) {
    try {
      await fetchPostProcessedRadarFrame(url, path.join(CACHE_FOLDER, timestamp))
      IMAGE_CACHE.push({timestamp, url})
    } catch (err) {
      console.error(`Failed to fetch radar image from ${url}: ${err.message}`)
    }
  }
}

async function pruneCache(validImageUrls) {
  const removed = _.remove(IMAGE_CACHE, ({url}) => !_.find(validImageUrls, {url}))
  for (const {timestamp} of removed) {
    await fs.promises.unlink(path.join(CACHE_FOLDER, `${timestamp}.png`))
    await fs.promises.unlink(path.join(CACHE_FOLDER, `${timestamp}.webp`))
  }
}

function imageFileForTimestamp(timestamp) {
  const image = _.find(IMAGE_CACHE, {timestamp})
  if (!image) {
    return null
  }

  return {
    png: path.join(CACHE_FOLDER, `${timestamp}.png`),
    webp: path.join(CACHE_FOLDER, `${timestamp}.webp`)
  }
}

function framesList(publicFramesRootUrl) {
  return _(IMAGE_CACHE)
  .map(({timestamp}) => ({
    image: publicFramesRootUrl + timestamp,
    timestamp
  }))
  .sortBy(['timestamp'])
  .value()
}

module.exports = {
  imageFileForTimestamp,
  framesList
}
