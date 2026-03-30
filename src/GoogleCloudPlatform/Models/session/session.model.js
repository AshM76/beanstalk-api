const mongoose = require('mongoose')
const Schema = mongoose.Schema

var Symptom = require('../session/symptom/symptom.model') 
var Medication = require('../session/medication/medication.model') 
var Specie = require('../session/cannabis/specie.model')
var Measurement = require('../session/cannabis/measurement.model')
var Cannabinoid = require('../session/cannabis/cannabinoid.model')
var Terpenes = require('../session/cannabis/terpene.model')
var Dose = require('../session/cannabis/dose.model')
var Timeline = require('../session/timeline/timeline.model')

const SessionSchema = new Schema({
    user_id: String,

    symptoms: [Symptom.schema],
    medication: Medication.schema,
    //ProductName
    strain: String,
    product: String,
    brand: String,
    //Species
    species: [Specie.schema],
    //Temperature
    temperature: String,
    temperatureMeasurement: Measurement.schema,
    //ActiveIngredients
    cannabinoids: [Cannabinoid.schema],
    terpenes: [Terpenes.schema],
    activeIngredientsMeasurement: Measurement.schema,
    //Dose
    dose: Dose.schema,
    doseMeasurement: Measurement.schema,
    //Note
    note: String,
    //SessionData
    session_rate: { type: Number, default: 0 },
    session_notes: [String],
    session_timelines: [Timeline.schema],
    //SessionDates
    session_startTime: Date,
    session_endTime: Date,
    session_durationTime: String,
    session_durationParameter: String,
    session_status: { type: String, default: "stored" },
})

module.exports = mongoose.model('Session', SessionSchema)