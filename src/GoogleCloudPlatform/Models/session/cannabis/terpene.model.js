const mongoose = require('mongoose')
const Schema = mongoose.Schema

const TerpeneSchema = new Schema({
    title: String,
    value: String,
})

module.exports = mongoose.model('Terpene', TerpeneSchema)