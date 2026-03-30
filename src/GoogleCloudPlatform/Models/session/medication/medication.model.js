const mongoose = require('mongoose')
const Schema = mongoose.Schema

const MedicationSchema = new Schema({
    title: String,
    description: String,
    icon: String,
    preference: String,
    experience: String,
})

module.exports = mongoose.model('Medication', MedicationSchema)