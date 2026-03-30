const mongoose = require('mongoose')
const Schema = mongoose.Schema

const SymptomSchema = new Schema({
    title: String,
})

module.exports = mongoose.model('Symptom', SymptomSchema)