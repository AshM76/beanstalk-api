const mongoose = require('mongoose')
const Schema = mongoose.Schema

const TimelineSchema = new Schema({
    type: String,
    timeline: Object,
    time: Date,
    rate: Number,
})

module.exports = mongoose.model('Timeline', TimelineSchema)