'use strict'
const express = require('express')

const app = express()
app.use(express.json())

app.get('/api/forecast', (req, res) => {
  res.json({ city: req.query.city ?? 'bogota', tempC: 18 })
})

app.listen(process.env.PORT ?? 3000)
