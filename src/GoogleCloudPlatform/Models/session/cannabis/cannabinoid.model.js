const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CannabinoidSchema = new Schema({
    title: String,
    value: String,
})

module.exports = mongoose.model('Cannabinoid', CannabinoidSchema)