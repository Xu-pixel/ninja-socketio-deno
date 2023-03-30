import { omit, remove } from 'npm:lodash-es'
import { Server } from "https://deno.land/x/socket_io@0.1.1/mod.ts";

export class NinjaRoom {
    /**
     * 
     * @param {string} id 
     * @param {Server} io 
     */
    constructor(id, io, hostId) {
        this.io = io
        this.id = id
        this.hostId = hostId //房主
        this.shurikens = []
        this.state = []
        this.initShurikens()
    }

    initShurikens() {
        this.shurikens = []
        for (let i = 0; i < 14; i++) {
            this.shurikens.push(2)
            this.shurikens.push(3)
            if (i % 2) this.shurikens.push(4)
        }
    }

    reset(userId) {
        if (this.hostId != userId) return
        for (const player of this.state) {
            player.scores = []
        }
        this.initShurikens()
        this.sync()
    }


    drawShurikenTo(userId) {
        const i = Math.floor(Math.random() * this.shurikens.length) 
        const player = this.getPlayer(userId)
        player.scores.push(this.shurikens[i])
        // console.log(this.shurikens)
        this.shurikens.splice(i, 1) //删除标记
        this.sync()
    }

    addUser(userId, userName) {
        const player = this.getPlayer(userId)
        if (player) {
            player.isConnected = true
            player.userName = userName
        } else {
            this.state.push({
                userId,
                userName,
                scores: [],
                isConnected: true
            })
        }
        this.sync()
    }

    disconnectUser(userId) {
        const player = this.getPlayer(userId)
        if(!player)return 
        player.isConnected = false
        this.sync()
    }

    removeUser(userId) {
        const player = this.getPlayer(userId)
        if(!player)return 
        this.shurikens = this.shurikens.concat(player.scores) //把分数放回去
        remove(this.state, player => player.userId === userId)
        if (userId === this.hostId) {
            const nextHost = Math.floor(Math.random() * this.state.length)
            this.hostId = this.state[nextHost]?.userId
        }
        this.sync()
    }

    sync() {
        this.io.to(this.id).emit(
            'sync',
            this.state
                .map(player => {
                    const omittedPlayer = omit(player, 'scores')
                    omittedPlayer.scoresLength = player.scores.length
                    return omittedPlayer
                }),
            this.hostId,
            this.id
        )
    }


    getPlayer(userId) {
        return this.state.find(player => player.userId === userId)
    }


    //撤销抽取
    undo(userId) {
        const player = this.getPlayer(userId)
        if(!player.scores.length)return 
        this.shurikens.push(player.scores.pop())
        this.sync()
    }


    getScores(userId) {
        const player = this.getPlayer(userId)
        return player ? player.scores : []
    }


    swapScore(userId,targetId,i,j){
        const player = this.getPlayer(userId)
        const target = this.getPlayer(targetId)
        const t = player.scores[i]
        player.scores[i] = target.scores[j]
        target.scores[j] = t
        this.sync()
    }
}