const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ConditionSchema = new Schema({
    title: String,
    icon: String,
})

module.exports = mongoose.model('Condition', ConditionSchema)