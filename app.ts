require("dotenv").config()
import express from "express"
import http from "http"
import { Server } from "socket.io"
import cors from "cors"
import type { CursorPosition } from "./lib/cursor/types"

const app = express()
const server = http.createServer(app)

app.use(cors({ origin: process.env.CLIENT_URL as string }))

const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL as string, methods: ["GET", "POST"] },
})

let currentText = ""
const cursors: Record<string, { x: number; y: number }> = {}
const users: Record<string, string> = {}

io.on("connection", (socket) => {
    socket.emit("updateText", currentText)

    const cursorsWithIds: Record<string, CursorPosition> = {}
    for (const [id, pos] of Object.entries(cursors)) {
        cursorsWithIds[id] = { socketId: id, ...pos, name: users[id] }
    }
    socket.emit("updateCursors", cursorsWithIds)

    socket.on("registername", (name: string) => {
        users[socket.id] = name
        socket.broadcast.emit("userRegistered", { id: socket.id, name })

        const existingUsers = Object.entries(users)
            .filter(([id]) => id !== socket.id)
            .map(([id, username]) => ({ id, name: username }))

        existingUsers.forEach(({ id, name }) => {
            socket.emit("userRegistered", { id, name })
        })
    })

    socket.on("textChange", (text: string) => {
        currentText = text
        socket.broadcast.emit("updateText", text)
    })

    socket.on("cursorMove", (position: { x: number; y: number }) => {
        cursors[socket.id] = position
        const name = users[socket.id]
        socket.broadcast.emit("updateCursor", { socketId: socket.id, ...position, name })
    })

    socket.on("disconnect", () => {
        delete cursors[socket.id]
        delete users[socket.id]
        io.emit("removeCursor", socket.id)
    })
})

server.listen(process.env.PORT || 4000, () =>
    console.log(`Server running`)
)
