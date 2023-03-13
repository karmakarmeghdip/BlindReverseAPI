import express from 'express'
import crypto from 'crypto'
import mongoose from 'mongoose'
import cors from 'cors'
const app = express()
const port = 3000
import fetch from 'node-fetch'
const eventId = "63f3b59791f11324dc3d29a3"


app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

async function dbInit() {
    await mongoose.connect(process.env['mongoURI'])
    const Question = new mongoose.model('Question', new mongoose.Schema({
        question: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        points: {
            type: Number,
            required: true
        },
        testcases: [{input: String, output: String}],
        roundNo: {
            type: Number,
            required: true
        }
    }))
    const User = new mongoose.model('User', new mongoose.Schema({
        name: String,
        userId: String,
        token: String,
        points: Number,
        startTime: [Date],
        endTime: [Date],
        questionsCompleted: [String],
        qualified: {
            type: Boolean,
            default: true
        }
    }))
    return [Question, User]
}
const pModels = dbInit()

app.get('/', function(req, res) {
    res.send({
        status: 'OK'
    })
})

const token = process.env['token']

const adminAcc = [
    {
        userId: "admin",
        hash: "hwYWBbB5F+t+hOagKMFgeorDcTm74lYcI9spoZ3e7IA="
    }
]



app.post('/admin/login', async (req, res) => {
    /*
        Admin Login endpoint expects a JSON in it's body in this format
        {
        "userId": email or whatever is used to login
        "pass": password
        }

        it will return a token which can be passed to authorised endpoints
    */
    if(!req.body) {
        res.status(400)
        res.send({
            error: "req body invalid"
        })
    }
    const userId = req.body.userId
    const hash = crypto.createHash('sha256').update(req.body.pass).digest('base64')

    for (let acc of adminAcc) {
        if(acc.userId===userId && acc.hash===hash) {
            res.send(token)
        } else {
            res.status(401)
            res.send({
                error: "Invalid Username or Password"
            })
        }
    }
})


app.get('/questions', async (req, res) => {
    /*
    Returns all the questions as an array
    */
    const Question = (await pModel)[1]
    try {
        const questions = await Question.find()
        console.log(questions)
        res.send(questions)
    } catch {
        res.send([])
    }
})

app.post('/questions', async (req, res) => {
    /*
    Add a question to the db, expects to follow schema but doesn't enforce it
    {
    title: String,
    points: int,
    testcases: [{input: String, output: String},...]
    roundNo: int
    }

    the request body must be
    {
    question: Question,
    token: String
    }
    */
    console.log(req.body, token)
    const question = req.body.data
    const tok = req.body.token
    if(tok===token) {
        const Question = (await pModels)[0]
        try {
            const q = new Question(question)
            console.log(q)
            await q.save()
            res.send("Success")
        } catch (error) {
            res.status(400)
            res.send({
                error: error
            })
        }
    } else {
        res.send("Invalid Token")
    }
})

app.post('/admin/advance', async (req, res) => {
    /*
    Call to move to next round, requires token to auth
    sets qualified to false for all the users below threshold
    */
    if (req.body!==token) {
        res.status(401)
        res.send({
            error: "Invalid Token"
        })
    } else {
        const users = await (await pModel)[1].find({ points: { $lt: 50 } })
        for (const user of users) {
            user.qualified=false
            await user.save()
        }
        res.send("Success")
    }
})

app.post('/user/login', async (req, res) => {
    /*
    Login endpoint for users, expects a JSON in it's body in this format
    {
    "userId": for now, is espektro id, will be changed to email,
    "password": password
    }
    */
    const userId = req.body.userId
    const password = req.body.password
    const User = (await pModels)[1]
    const resp = await fetch(`https://tessarus-staging.gdsckgec.in/api/events/checkin/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            eventId: eventId,
            espektroId: userId,
            password: password
        })
    })
    const user = (await resp.json()).user
    const userInDB = await User.findById(user._id)
    if(userInDB) {
        res.send({
            token: userInDB.token
        })
    } else {
        const newUser = new User({
            _id: user._id,
            name: user.name,
            userId: user.espektroId,
            token: crypto.randomBytes(16).toString('base64'),
            points: 0,
            startTime: [],
            endTime: [],
            questionsCompleted: []
        })
        await newUser.save()
        res.send({
            token: newUser.token
        })
    }

})

app.listen(port, () => {
  console.log(`Hello world app listening on port ${port}!`)
})