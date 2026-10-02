import "dotenv/config"
import cors from "cors"
import express from "express"
import healthRouter from "./routes/health.js"

const app = express()
const port = Number(process.env.PORT) || 5000
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173"

app.use(cors({ origin: clientUrl }))
app.use(express.json())
app.use("/api", healthRouter)

app.listen(port, () => {
  console.log(`KezSpeak API listening on http://localhost:${port}`)
})
