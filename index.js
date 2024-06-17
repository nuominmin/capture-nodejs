const express = require('express')
const capture = require('./capture')
const app = express()
const errors = require("http-errors")
const config = require('./config.json')

app.use(express.json())
app.post('/capture', (req, res) => {
	const url = req.body['url'];
    const width = req.body['width']??0;
    const height = req.body['height']??0;
    if (!url) {
        res.json({
            status: -1,
            message: "url 不能为空"
        })
        return
    }
    capture(url,width,height).then(data => {
        res.json({
            status: 0,
            message: "截图成功",
            data: data
        })
    }).catch(err => {
        res.json({
            status: -1,
            message: String(err)
        })
    })
});
app.use((err, res, next) => {
  next(errors(404));
})
app.use((err, req, res, next) => {
  res.status(err.status||500).json({
    status: -1,
    message: err.message
  })
})
app.listen(config.server.port, '0.0.0.0', () => {
  console.log('server statt. http://%s:%s', '0.0.0.0', config.server.port);
});