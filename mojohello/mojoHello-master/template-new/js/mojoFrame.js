

const CMD_INNER_READY = 'innerReady'
const CMD_RESPONSE = 'response'
const CMD_WRAPPER_READY = 'wrapperReady'
const CMD_PING = 'ping'
const CMD_PONG = 'pong'
const CMD_WRAPPER_OPENED_WEBSOCKET = 'wrapperOpenedWebsocket'
const CMD_WRAPPER_CLOSE_WEBSOCKET = 'wrapperClosedWebsocket'

class mojoFrame {
    constructor(url) {
        this.url = url
        this.waiting_cb = {}
        this.wrapper_nonce = document.location.href.replace(/.*wrapper_nonce=([A-Za-z0-9]+).*/, "$1")
        this.connect()
        this.next_message_id = 1
        this.init()
    }

    init() {
        return this
    }

    connect() {
        this.target = window.parent
        window.addEventListener('message', e => this.onMessage(e), false)
        this.cmd(CMD_INNER_READY)
    }

    onMessage(e) {
        let message = e.data
        let cmd = message.cmd
        if (cmd === CMD_RESPONSE) {
            if (this.waiting_cb[message.to] !== undefined) {
                this.waiting_cb[message.to](message.result)
                delete this.waiting_cb[message.to]
            }
            else {
                this.log("Websocket callback not found:", message)
            }
        } else if (cmd === CMD_WRAPPER_READY) {
            this.cmd(CMD_INNER_READY)
        } else if (cmd === CMD_PING) {
            this.response(message.id, CMD_PONG)
        } else if (cmd === CMD_WRAPPER_OPENED_WEBSOCKET) {
            this.onOpenWebsocket()
        } else if (cmd === CMD_WRAPPER_CLOSE_WEBSOCKET) {
            this.onCloseWebsocket()
        } else {
            this.onRequest(cmd, message)
        }
    }

    onRequest(cmd, message) {
        this.log("Unknown request", message)
    }

    response(to, result) {
        this.send({
            cmd: CMD_RESPONSE,
            to: to,
            result: result
        })
    }

    cmd(cmd, params={}, cb=null) {
        this.send({
            cmd: cmd,
            params: params
        }, cb)
    }

    cmdp(cmd, params={}) {
        return new Promise((resolve, reject) => {
            this.cmd(cmd, params, (res) => {
                if (res && res.error) {
                    reject(res.error)
                } else {
                    resolve(res)
                }
            })
        })
    }

    send(message, cb=null) {
        message.wrapper_nonce = this.wrapper_nonce
        message.id = this.next_message_id
        this.next_message_id++
        this.target.postMessage(message, '*')
        if (cb) {
            this.waiting_cb[message.id] = cb
        }
    }

    log(...args) {
        console.log.apply(console, ['[mojoFrame]'].concat(args))
    }

    onOpenWebsocket() {
        this.log('Websocket open')
    }

    onCloseWebsocket() {
        this.log('Websocket close')
    }

    async monkeyPatchAjax() {
        var page = this
        XMLHttpRequest.prototype.realOpen = XMLHttpRequest.prototype.open
        var newOpen = function (method, url, async) {
            url += "?ajax_key=" + page.ajax_key
            return this.realOpen(method, url, async)
        }
        XMLHttpRequest.prototype.open = newOpen

        window.realFetch = window.fetch
        var newFetch = function (url) {
            url += "?ajax_key=" + page.ajax_key
            return window.realFetch(url)
        }
        window.fetch = newFetch

        this.ajax_key = await page.cmdp("wrapperGetAjaxKey", [])
    }
}
