const express = require('express')
const { MongoClient, ObjectId } = require('mongodb')

const app = express()
app.use(express.json())
const cors = require('cors')
app.use(cors())

const port = 3001

async function connectToCollection (collectionName) {
    const connection = await MongoClient.connect("mongodb://root:password@localhost:27017")
    const db = connection.db('robot-store')
    return db.collection(collectionName)
}

async function getCategories (db) {
    return db.distinct("category")
}

async function getCharacters(db) {
    return db.distinct("character")
}

async function logError (request, response, next) {
    console.log('in log error func')
    const status = response.statusCode
    if (status >= 400 && status < 600) {
        const currentTime = Date.now()
        const ipAddress = request.ip
        const url = request.originalUrl
        const errorLog = {
            "time": currentTime,
            "IP address": ipAddress,
            "URL": url,
            "status code": status
        }
        const errorCollection = await connectToCollection('errors')
        const result = await errorCollection.insertOne(errorLog)
        if ((result).insertedId) {
            console.log('error logged in database')
        } else {
            console.log('error not logged')
        }
    }
}

const unexpectedErrorResponse = {"message": "Unexpected error", "data": []}

app.get('/products', async (request, response, next) => {
    try {
        const query = {}
        const robotCollection = await connectToCollection('robots')
        const categoryList = await getCategories(robotCollection)
        const characterList = await getCharacters(robotCollection)
        if (request.query.hasOwnProperty('categories')) {
            const categories = request.query.categories.split(",")
            categories.forEach((category) => {
                if (!categoryList.includes(category)) {
                    throw new Error("Unknown category")
                }
            })
            query.category = {$in: categories}
        }
        if (request.query.hasOwnProperty('characters')) {
            const characters = request.query.characters.split(",")
            characters.forEach((character) => {
                if (!characterList.includes(character)) {
                    throw new Error("Unknown character")
                }
            })
            query.character = {$in: characters}
        }
        const allRobots = await robotCollection.find(query).toArray()
        const successResponse = {"message": "Successfully found products.", "data": allRobots}
        return response.json(successResponse)
    } catch (e) {
        switch (e.message) {
            case "Unknown category":
                return response.status(400).json({"message": e.message, "data": []}), next()
            break
            case "Unknown character":
                return response.status(400).json({"message": e.message, "data": []}), next()
            break
            default:
                return response.status(500).json(unexpectedErrorResponse), next()
        }
    }
}, logError)

app.get('/products/:id', async (request, response, next) => {
    try {
        const robotCollection = await connectToCollection('robots')
        const id = new ObjectId(request.params.id)
        const robotById = await robotCollection.findOne({_id: id})
        if (robotById.length === 0) {
            throw new Error("Unknown product ID")
        } else {
            const successResponse = {"message": "Successfully found product.", "data": robotById}
            response.json(successResponse)
        }
    } catch (e) {
        switch (e.message) {
            case "Unknown product ID":
                return response.status(400).json({"message": e.message, "data": []}), next()
            break
            default:
                return response.status(500).json(unexpectedErrorResponse), next()
        }
    }
}, logError)

app.post('/products', async (request, response, next) => {
    try {
        const robotCollection = await connectToCollection('robots')
        const result = await robotCollection.insertOne(request.body)
        if (result.insertedId !== null) {
            response.status(201).json({"message": "Successfully created product."})
        } else {
            throw new Error("Invalid product data")
        }
    } catch (e) {
        switch (e.message) {
            case "Invalid product data" :
                return response.status(400).json({"message": "Invalid product data", "data": []}), next()
            default:
                return response.status(500).json(unexpectedErrorResponse), next()
        }
    }
}, logError)

app.get('/categories', async (request, response, next) => {
    try {
        const robotCollection = await connectToCollection('robots')
        const categories = await getCategories(robotCollection)
        const successResponse = {"message": "Successfully found categories.", "data": categories}
        response.json(successResponse)
    } catch {
       response.status(500).json(unexpectedErrorResponse)
    }
    next()
}, logError)

app.get('/characters', async (request, response, next) => {
    try {
        const robotCollection = await connectToCollection('robots')
        const characters = await getCharacters(robotCollection)
        const successResponse = {"message": "Successfully found characters.", "data": characters}
        response.json(successResponse)
    } catch {
        response.status(500).json(unexpectedErrorResponse)
    }
    next()
}, logError)

app.listen(port)