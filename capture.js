// 参考：https://blog.guowenfh.com/2019/06/16/2019/puppeteer-pool/
const puppeteer = require("puppeteer");
const genericPool = require('generic-pool'); // https://github.com/coopernurse/node-pool
const config = require('./config.json')
const launchOpts = {
  headless: config.capture.headless
}
if (config.capture.executable_path != "") {
  launchOpts.executablePath = config.capture.executable_path;
}

const defaultParams = {
  width: 300,
  height: 0,
  max_count: 1024,
  min: 5,
  max: 50
}
if (config.capture.width != undefined) {
  defaultParams.width = config.capture.width;
}
if (config.capture.height != undefined) {
  defaultParams.height = config.capture.height;
}
if (config.capture.max_count != undefined) {
  defaultParams.max_count = config.capture.max_count;
}
if (config.capture.min != undefined) {
  defaultParams.min = config.capture.min;
}
if (config.capture.max != undefined) {
  defaultParams.max = config.capture.max;
}

// todo: google 进程被杀了，怎么重新拉起？ 或者无效的实例从 pool 中移除？
global.pool = (() => {
  if (global.pool) {
    global.pool.drain().then(() => global.pool.clear())
  }

  // https://github.com/coopernurse/node-pool#documentation
  const opt = {
    min: defaultParams.min, // minimum size of the pool
    max: defaultParams.max, // maximum size of the pool
    testOnBorrow: true, // should the pool validate resources before giving them to clients. Requires that factory.validate is specified.
    autostart: false, // should the pool start creating resources, initialize the evictor, etc once the constructor is called. If false, the pool can be started by calling pool.start, otherwise the first call to acquire will start the pool. (default true)
    idleTimeoutMillis: 1800000,// amount of time an object may sit idle in the pool before it is eligible for eviction by the idle object evictor (if any), with the extra condition that at least "min idle" object instances remain in the pool. Default -1 (nothing can get evicted)
    evictionRunIntervalMillis: 180000,// How often to run eviction checks. Default: 0 (does not run).
    validator: () => Promise.resolve(true)
  }
  const resourceFactory = {
    create: () =>
      puppeteer.launch(launchOpts).then(instance => {
        instance.usageCount = 0;
        return instance;
      }),
    destroy: instance => {
      instance.close()
    },
    validate: instance => {
      return opt.validator(instance).then(valid => Promise.resolve(valid && (
        defaultParams.max_count <= 0 || instance.usageCount < defaultParams.max_count)));
    }
  };
  const pool = genericPool.createPool(resourceFactory, opt)
  const acquirePool = pool.acquire.bind(pool)
  pool.acquire = () => acquirePool().then(instance => {
    instance.usageCount += 1
    return instance
  })
  pool.use = fn => {
    let resource
    return pool.acquire().then(res => {
      resource = res
      return resource
    }).then(fn).then( result => {
        pool.release(resource)
        return result
    }, err => {
        pool.release(resource)
        throw err
    })
  }
  return pool;
})()

module.exports = async(url,width,height) => {
  try {
    const browser = await global.pool.use()
    const page = await browser.newPage();
    await page.goto(url);

    if (width == 0) {
      width = defaultParams.width
    }

    if (height == 0) {
      height = defaultParams.height
    }

    // https://pptr.dev/api/puppeteer.page.setviewport/
    await page.setViewport({
      width: width,
      height: height
    });

    // https://pptr.dev/api/puppeteer.page.screenshot
    const base64 = await page.screenshot({
      fullPage: true,
      encoding: 'base64'
    });
    await page.close()
    return 'data:image/png;base64,'+ base64
  } catch (error) {
    throw error
  }
};
