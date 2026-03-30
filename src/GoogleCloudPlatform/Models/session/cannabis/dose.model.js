const mongoose = require('mongoose')
const Schema = mongoose.Schema

const DoseSchema = new Schema({
    value: String,
})

module.exports = mongoose.model('Dose', DoseSchema)