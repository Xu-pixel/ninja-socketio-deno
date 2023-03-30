import { forOwn, pickBy, sum } from 'https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js';
import { serve } from "https://deno.land/std@0.150.0/http/server.ts";
import { Server } from "https://deno.land/x/socket_io@0.1.1/mod.ts";
import { NinjaRoom } from "./NinjaRoom.js";


const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
  }
});
const socket2userId = {}
const roomPool = {}
const vulnerableRooms = new Set()
io.on("connection", (socket) => {
  let room = ''

  socket.on("disconnect", () => {
    if (!roomPool[room]) return
    roomPool[room]?.disconnectUser(socket2userId[socket.id])
    delete socket2userId[socket.id]
    console.log(socket.id, 'disconnect')
  })

  socket.on("login", (userId) => {
    socket2userId[socket.id] = userId
    console.log(socket2userId)
  })

  socket.on("draw", () => {
    roomPool[room]?.drawShurikenTo(socket2userId[socket.id])
  })

  socket.on("undo", () => {
    roomPool[room]?.undo(socket2userId[socket.id])
  })

  socket.on("logout", () => {
    socket.leave(room)
    roomPool[room]?.removeUser(socket2userId[socket.id])
  })

  socket.on("reset", () => {
    roomPool[room]?.reset(socket2userId[socket.id])
  })

  socket.on("get-scores", (userId, response) => {
    response(roomPool[room]?.getScores(userId))
  })

  socket.on('swap', (userId, targetId, i, j) => {
    const socket2targetId = pickBy(socket2userId, (v) => v === targetId) //用targetid查询出对应的socketid
    forOwn(
      socket2targetId,
      (v, k) => {
        io.to(k).emit('notice', `${userId} 交换了你的 token`)
      }
    )
    roomPool[room]?.swapScore(userId, targetId, i, j)
  })

  socket.on('create-or-join-ninja-room', (roomId, userName) => {
    console.log(roomId, userName)
    socket.join(roomId)
    room = roomId
    if (!roomPool[roomId]) {
      roomPool[roomId] = new NinjaRoom(roomId, io, socket2userId[socket.id])
    }
    roomPool[roomId].addUser(socket2userId[socket.id], userName)
  })
});

//每过十分钟检查是否有房间一个人都没,如果都断线了，则标记为易损房间,下次看到还是则删掉
setInterval(() => {
  console.log("checking...")
  forOwn(roomPool, (room, id) => {
    if (sum(room.state.map(player => player.isConnected ? 1 : 0)) === 0) {
      if (vulnerableRooms.has(id)) {
        vulnerableRooms.delete(id)
        delete roomPool[id]
      } else {
        vulnerableRooms.add(id)
      }
    } else {
      vulnerableRooms.delete(id)
    }
  })
  console.log("checking finished")
}, 600_000)

await serve(io.handler(), {
  port: 8998,
});