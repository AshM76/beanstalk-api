const mongoose = require('mongoose')
const Schema = mongoose.Schema

const MeasurementSchema = new Schema({
    title: String,
})

module.exports = mongoose.model('Measurement', MeasurementSchema)