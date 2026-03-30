const mongoose = require('mongoose')
const Schema = mongoose.Schema

const SpecieSchema = new Schema({
    title: String,
})

module.exports = mongoose.model('Specie', SpecieSchema)